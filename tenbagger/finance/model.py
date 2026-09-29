#!/usr/bin/env python3
"""Tenbagger 36-month financial model (income statement, KPIs, sensitivities).

    python tenbagger/finance/model.py            # build everything, verify with LibreOffice
    python tenbagger/finance/model.py --no-verify

Inputs : tenbagger/finance/assumptions.yaml  (base drivers + bear/bull overrides)
Outputs: tenbagger/finance/out/
    Tenbagger_Model.xlsx  live-formula workbook driven by its Assumptions sheet
    summary.md            annual P&L tables, KPIs, sensitivities, takeaways
    pnl_chart.csv         monthly series for charting

Design: every monthly line, annual line, derived assumption and KPI is written ONCE
as a small Python function of a context `c`. The same function is evaluated two ways:
  * NumCtx  -> floats (the Python model, used for summary.md, sensitivities, tests)
  * SymCtx  -> Excel formula strings (the workbook)
so the spreadsheet and the Python numbers cannot drift apart. `--verify` recalculates the
workbook in headless LibreOffice and compares every formula cell with the Python value.

Dependencies: Python 3.9+ stdlib, PyYAML, openpyxl. LibreOffice (soffice) optional.
"""
from __future__ import annotations

import argparse
import copy
import csv
import datetime as dt
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

import yaml
from openpyxl import Workbook, load_workbook
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

HERE = Path(__file__).resolve().parent
DOCS = HERE.parent / "docs"
MONTHS = 36
SCENARIOS = ["base", "bear", "bull"]          # display order everywhere
SHEET = {"base": "Monthly_Base", "bear": "Monthly_Bear", "bull": "Monthly_Bull"}
ASSUMP_COL = {"base": "E", "bear": "F", "bull": "G"}   # scenario columns on Assumptions


# =============================================================================
# 1. Expression backends
# =============================================================================
def _f(v) -> str:
    """Render a value as Excel formula text."""
    if isinstance(v, X):
        return v.t
    if isinstance(v, bool):
        return "TRUE" if v else "FALSE"
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        if v == int(v) and abs(v) < 1e15:
            return str(int(v))
        return repr(v)
    raise TypeError(f"cannot render {v!r} in a formula")


class X:
    """A symbolic Excel expression. Arithmetic builds formula text."""
    __slots__ = ("t",)
    __hash__ = None

    def __init__(self, t: str):
        self.t = t

    def _b(a, b, op):
        return X(f"({_f(a)}{op}{_f(b)})")

    def __add__(s, o): return X._b(s, o, "+")
    def __radd__(s, o): return X._b(o, s, "+")
    def __sub__(s, o): return X._b(s, o, "-")
    def __rsub__(s, o): return X._b(o, s, "-")
    def __mul__(s, o): return X._b(s, o, "*")
    def __rmul__(s, o): return X._b(o, s, "*")
    def __truediv__(s, o): return X._b(s, o, "/")
    def __rtruediv__(s, o): return X._b(o, s, "/")
    def __pow__(s, o): return X._b(s, o, "^")
    def __rpow__(s, o): return X._b(o, s, "^")
    def __neg__(s): return X(f"(-{s.t})")
    def __ge__(s, o): return X._b(s, o, ">=")
    def __gt__(s, o): return X._b(s, o, ">")
    def __le__(s, o): return X._b(s, o, "<=")
    def __lt__(s, o): return X._b(s, o, "<")
    def __eq__(s, o): return X._b(s, o, "=")  # type: ignore[override]

    def __bool__(self):
        raise TypeError("symbolic expression used in a Python boolean context; use c.IF/c.AND")


class NumOps:
    @staticmethod
    def IF(c, a, b): return a if c else b
    @staticmethod
    def MAX(*a): return max(a)
    @staticmethod
    def MIN(*a): return min(a)
    @staticmethod
    def AND(*a): return all(a)
    @staticmethod
    def CHOOSE(i, *o): return o[int(round(i)) - 1]
    @staticmethod
    def MOD(a, b): return a % b
    @staticmethod
    def EQ(a, b): return abs(a - b) < 1e-12
    @staticmethod
    def DIV(a, b): return 0.0 if b == 0 else a / b
    @staticmethod
    def frac(p, q): return p / q


class SymOps:
    @staticmethod
    def IF(c, a, b): return X(f"IF({_f(c)},{_f(a)},{_f(b)})")
    @staticmethod
    def MAX(*a): return X("MAX(" + ",".join(_f(v) for v in a) + ")")
    @staticmethod
    def MIN(*a): return X("MIN(" + ",".join(_f(v) for v in a) + ")")
    @staticmethod
    def AND(*a): return X("AND(" + ",".join(_f(v) for v in a) + ")")
    @staticmethod
    def CHOOSE(i, *o): return X(f"CHOOSE({_f(i)}," + ",".join(_f(v) for v in o) + ")")
    @staticmethod
    def MOD(a, b): return X(f"MOD({_f(a)},{_f(b)})")
    @staticmethod
    def EQ(a, b): return X(f"({_f(a)}={_f(b)})")
    @staticmethod
    def DIV(a, b): return X(f"IF({_f(b)}=0,0,{_f(a)}/{_f(b)})")
    @staticmethod
    def frac(p, q): return X(f"({p}/{q})")


def col(m: int) -> str:
    """Worksheet column for model month m (month 1 -> column C)."""
    return get_column_letter(m + 2)


# =============================================================================
# 2. Assumptions
# =============================================================================
@dataclass
class Driver:
    key: str
    section: str
    v: float
    unit: str
    label: str
    src: str


def load_assumptions(path: Path | str = HERE / "assumptions.yaml") -> dict:
    with open(path) as fh:
        raw = yaml.safe_load(fh)
    drivers: dict[str, Driver] = {}
    for section, items in raw["drivers"].items():
        for key, d in items.items():
            if key in drivers:
                raise ValueError(f"duplicate driver {key}")
            for req in ("v", "unit", "label", "src"):
                if req not in d:
                    raise ValueError(f"driver {key} missing '{req}'")
            drivers[key] = Driver(key, section, float(d["v"]), d["unit"], d["label"], d["src"])
    scen = raw.get("scenarios", {}) or {}
    for name, ov in scen.items():
        for k in (ov or {}):
            if k not in drivers:
                raise KeyError(f"scenario '{name}' overrides unknown driver '{k}'")
    return {"meta": raw.get("meta", {}), "drivers": drivers,
            "scenarios": {n: dict(scen.get(n) or {}) for n in ("bear", "bull")}}


def scenario_params(A: dict, name: str, overrides: dict | None = None) -> dict:
    """Base values, then the scenario's yaml overrides, then ad-hoc overrides; plus derived."""
    p = {k: d.v for k, d in A["drivers"].items()}
    if name != "base":
        p.update({k: float(v) for k, v in A["scenarios"].get(name, {}).items()})
    for k, v in (overrides or {}).items():
        if k not in p:
            raise KeyError(f"unknown driver '{k}'")
        p[k] = float(v)
    add_derived(p)
    return p


# Derived assumptions: shown as formulas at the bottom of the Assumptions sheet.
DERIVED = [
    ("mix_student", "New payers choosing student plan (1 - monthly - annual)", "pct",
     lambda c: 1 - c.a("mix_monthly") - c.a("mix_annual")),
    ("churn_monthly", "Monthly-plan churn per month = 1 - ret12^(1/12)", "pct",
     lambda c: 1 - c.a("ret12_monthly") ** c.frac(1, 12)),
    ("install_to_paid", "Install-to-paid = activation x trial start x trial-to-paid", "pct",
     lambda c: c.a("activation_rate") * c.a("trial_start_rate") * c.a("trial_to_paid")),
    ("net_factor", "Share of gross in-app sales kept = (1 - refunds) x (1 - store fee)", "pct",
     lambda c: (1 - c.a("refund_rate")) * (1 - c.a("store_fee"))),
    ("ad_rev_per_ad_mau", "Ad revenue per ad-seeing free MAU per month", "usd_c",
     lambda c: (c.a("imps_article") * c.a("ecpm_article") + c.a("imps_screener") * c.a("ecpm_screener")
                + c.a("imps_rewarded") * c.a("ecpm_rewarded")) / 1000 * c.a("ad_fill_rate")),
    ("var_cost_per_payer", "Variable cost per payer per month (LLM + Plaid Pro), steady state", "usd_c",
     lambda c: c.a("llm_on") * c.a("llm_cost_per_payer")
     + c.a("plaid_on") * c.a("plaid_pro_link_share") * c.a("plaid_pro_items") * c.a("plaid_pro_item_cost")),
]


class _ANum(NumOps):
    def __init__(self, p): self.p = p
    def a(self, k): return self.p[k]


def add_derived(p: dict) -> None:
    c = _ANum(p)
    for key, _, _, fn in DERIVED:
        p[key] = fn(c)
    if p["mix_student"] < -1e-9:
        raise ValueError("mix_monthly + mix_annual exceeds 100%")


# =============================================================================
# 3. Monthly model spec (one definition -> Python values and Excel formulas)
# =============================================================================
@dataclass
class Row:
    key: str | None
    label: str
    fmt: str = "count"
    fn: object = None
    kind: str = "row"          # row | total | header | backward


def H(label): return Row(None, label, kind="header")
def R(key, label, fmt, fn): return Row(key, label, fmt, fn)
def T(key, label, fmt, fn): return Row(key, label, fmt, fn, "total")
def B(key, label, fmt, fn): return Row(key, label, fmt, fn, "backward")


def _budget(c, m, start, m1, g):
    return c.IF(c.mo(m) >= c.a(start), c.a(m1) * (1 + c.a(g)) ** (c.mo(m) - c.a(start)), 0)


def _renewals(c, m, bill_key, renew_key):
    return c.a(renew_key) * c.r(bill_key, m - 12) if m > 12 else 0


def _on(c, m, toggle, start):
    return c.AND(c.EQ(c.a(toggle), 1), c.mo(m) >= c.a(start))


ROWS: list[Row] = [
    H("ACQUISITION"),
    R("inst_org", "Installs: organic / SEO / ASO", "count",
      lambda c, m: c.a("organic_installs_m1") * (1 + c.a("organic_growth")) ** (c.mo(m) - 1)),
    R("inst_ref", "Installs: referral (x prior-month MAU)", "count",
      lambda c, m: c.a("referral_installs_per_mau") * c.r("mau_total", m - 1)),
    R("spend_creators", "Creator spend", "usd",
      lambda c, m: _budget(c, m, "creator_start_month", "creator_budget_m1", "creator_budget_growth")),
    R("inst_creators", "Installs: creators", "count",
      lambda c, m: c.DIV(c.r("spend_creators", m), c.a("creator_cpi"))),
    R("spend_asa", "Apple Search Ads spend", "usd",
      lambda c, m: _budget(c, m, "asa_start_month", "asa_budget_m1", "asa_budget_growth")),
    R("inst_asa", "Installs: paid Apple Search Ads", "count",
      lambda c, m: c.DIV(c.r("spend_asa", m), c.a("asa_cpi"))),
    T("inst_total", "Total installs", "count",
      lambda c, m: c.r("inst_org", m) + c.r("inst_ref", m) + c.r("inst_creators", m) + c.r("inst_asa", m)),

    H("FUNNEL (free -> trial -> paid)"),
    R("activated", "Activated users", "count", lambda c, m: c.r("inst_total", m) * c.a("activation_rate")),
    R("trial_starts", "Trial / paywall starts", "count", lambda c, m: c.r("activated", m) * c.a("trial_start_rate")),
    T("new_paid", "New paid subscribers", "count", lambda c, m: c.r("trial_starts", m) * c.a("trial_to_paid")),
    R("new_monthly", "  of which monthly plan", "count", lambda c, m: c.r("new_paid", m) * c.a("mix_monthly")),
    R("new_annual", "  of which annual plan", "count", lambda c, m: c.r("new_paid", m) * c.a("mix_annual")),
    R("new_student", "  of which student plan", "count", lambda c, m: c.r("new_paid", m) * c.a("mix_student")),
    R("pass_sales", "Recruiting Pass purchases (one-time)", "count",
      lambda c, m: c.r("activated", m) * c.a("pass_rate")),

    H("SUBSCRIBERS"),
    R("subs_monthly", "Monthly-plan subscribers (end of month)", "count",
      lambda c, m: c.r("subs_monthly", m - 1) * (1 - c.a("churn_monthly")) + c.r("new_monthly", m)),
    R("bill_annual", "Annual plans billed (new + renewals)", "count",
      lambda c, m: c.r("new_annual", m) + _renewals(c, m, "bill_annual", "renew_annual")),
    R("subs_annual", "Annual-plan subscribers (billed in last 12 months)", "count",
      lambda c, m: c.SUM("bill_annual", m - 11, m)),
    R("bill_student", "Student plans billed (new + renewals)", "count",
      lambda c, m: c.r("new_student", m) + _renewals(c, m, "bill_student", "renew_student")),
    R("subs_student", "Student-plan subscribers", "count",
      lambda c, m: c.SUM("bill_student", m - 11, m)),
    T("subs_paid", "Paid subscribers (end of month)", "count",
      lambda c, m: c.r("subs_monthly", m) + c.r("subs_annual", m) + c.r("subs_student", m)),
    R("bill_gross", "Gross in-app billings, cash basis (= RevenueCat MTR)", "usd",
      lambda c, m: c.r("subs_monthly", m) * c.a("price_monthly") + c.r("bill_annual", m) * c.a("price_annual")
      + c.r("bill_student", m) * c.a("price_student") + c.r("pass_sales", m) * c.a("price_pass")),

    H("ACTIVE USERS"),
    R("free_new", "New free users this month", "count", lambda c, m: c.r("inst_total", m) - c.r("new_paid", m)),
    R("free_pool", "Retained free users from earlier months", "count",
      lambda c, m: c.r("free_pool", m - 1) * (1 - c.a("retained_decay")) + c.r("free_new", m - 1) * c.a("d30_retention")),
    R("mau_free", "Free MAU", "count", lambda c, m: c.r("free_new", m) + c.r("free_pool", m)),
    T("mau_total", "Total MAU (free + paid)", "count", lambda c, m: c.r("mau_free", m) + c.r("subs_paid", m)),
    R("paid_share", "Paid subscribers / MAU", "pct", lambda c, m: c.DIV(c.r("subs_paid", m), c.r("mau_total", m))),

    H("ADS, AFFILIATE, B2B AND LINKING VOLUMES"),
    R("ad_mau", "Free MAU seeing ads", "count",
      lambda c, m: c.IF(_on(c, m, "ads_on", "ads_start_month"), c.r("mau_free", m) * c.a("ad_share_free_mau"), 0)),
    R("imps_article", "Ad impressions: article / lesson end", "count", lambda c, m: c.r("ad_mau", m) * c.a("imps_article")),
    R("imps_screener", "Ad impressions: screener native", "count", lambda c, m: c.r("ad_mau", m) * c.a("imps_screener")),
    R("imps_rewarded", "Ad impressions: opt-in rewarded", "count", lambda c, m: c.r("ad_mau", m) * c.a("imps_rewarded")),
    R("aff_clicks", "Affiliate clicks", "count",
      lambda c, m: c.IF(_on(c, m, "affiliate_on", "affiliate_start_month"),
                        c.r("mau_total", m) / 1000 * c.a("aff_clicks_per_1k_mau"), 0)),
    R("aff_funded", "Affiliate funded accounts", "count", lambda c, m: c.r("aff_clicks", m) * c.a("aff_conversion")),
    R("teachers", "Classroom Pro teachers", "count",
      lambda c, m: c.IF(_on(c, m, "b2b_on", "b2b_start_month"),
                        c.a("teachers_at_start") + c.a("teachers_added_per_month") * (c.mo(m) - c.a("b2b_start_month")), 0)),
    R("campus", "Campus / club licences", "count",
      lambda c, m: c.IF(_on(c, m, "b2b_on", "b2b_start_month"),
                        c.a("campus_at_start") + c.a("campus_added_per_month") * (c.mo(m) - c.a("b2b_start_month")), 0)),
    R("link_on", "Linking live (1 = yes)", "flag",
      lambda c, m: c.IF(_on(c, m, "plaid_on", "plaid_start_month"), 1, 0)),
    R("items_free", "Linked Items: free users (capped at 1 bank)", "count",
      lambda c, m: c.r("link_on", m) * c.r("mau_free", m) * c.a("plaid_free_link_share")),
    R("items_pro", "Linked Items: Pro users", "count",
      lambda c, m: c.r("link_on", m) * c.r("subs_paid", m) * c.a("plaid_pro_link_share") * c.a("plaid_pro_items")),

    H("REVENUE"),
    R("rev_monthly", "Gross: monthly plans", "usd", lambda c, m: c.r("subs_monthly", m) * c.a("price_monthly")),
    R("rev_annual", "Gross: annual plans (recognised 1/12 a month)", "usd",
      lambda c, m: c.r("subs_annual", m) * c.a("price_annual") / 12),
    R("rev_student", "Gross: student plans (recognised 1/12 a month)", "usd",
      lambda c, m: c.r("subs_student", m) * c.a("price_student") / 12),
    R("rev_pass", "Gross: Recruiting Pass", "usd", lambda c, m: c.r("pass_sales", m) * c.a("price_pass")),
    T("rev_iap_gross", "Gross in-app sales", "usd",
      lambda c, m: c.r("rev_monthly", m) + c.r("rev_annual", m) + c.r("rev_student", m) + c.r("rev_pass", m)),
    R("refunds", "Less: refunds", "usd", lambda c, m: -c.r("rev_iap_gross", m) * c.a("refund_rate")),
    R("store_fee", "Less: app store commission", "usd",
      lambda c, m: -(c.r("rev_iap_gross", m) + c.r("refunds", m)) * c.a("store_fee")),
    T("rev_subs_net", "Subscriptions & in-app, net of store fee", "usd",
      lambda c, m: c.r("rev_iap_gross", m) + c.r("refunds", m) + c.r("store_fee", m)),
    R("rev_ads_article", "Ads: article / lesson end", "usd",
      lambda c, m: c.r("imps_article", m) / 1000 * c.a("ecpm_article") * c.a("ad_fill_rate")),
    R("rev_ads_screener", "Ads: screener native", "usd",
      lambda c, m: c.r("imps_screener", m) / 1000 * c.a("ecpm_screener") * c.a("ad_fill_rate")),
    R("rev_ads_rewarded", "Ads: opt-in rewarded", "usd",
      lambda c, m: c.r("imps_rewarded", m) / 1000 * c.a("ecpm_rewarded") * c.a("ad_fill_rate")),
    T("rev_ads", "Advertising revenue", "usd",
      lambda c, m: c.r("rev_ads_article", m) + c.r("rev_ads_screener", m) + c.r("rev_ads_rewarded", m)),
    R("rev_aff", "Affiliate revenue", "usd", lambda c, m: c.r("aff_funded", m) * c.a("aff_payout")),
    R("rev_b2b", "B2B / Edu licence revenue", "usd",
      lambda c, m: c.r("teachers", m) * c.a("teacher_price_annual") / 12 + c.r("campus", m) * c.a("campus_price_annual") / 12),
    T("rev_total", "TOTAL REVENUE", "usd",
      lambda c, m: c.r("rev_subs_net", m) + c.r("rev_ads", m) + c.r("rev_aff", m) + c.r("rev_b2b", m)),

    H("COST OF REVENUE (COGS)"),
    R("cogs_data", "Data licensing (beta, or scale phase above MAU threshold)", "usd",
      lambda c, m: c.IF(c.r("mau_total", m) >= c.a("data_scale_mau"), c.a("data_scale_cost"), c.a("data_beta_cost"))),
    R("cogs_plaid", "Plaid / aggregation", "usd",
      lambda c, m: c.r("items_free", m) * c.a("plaid_free_item_cost") + c.r("items_pro", m) * c.a("plaid_pro_item_cost")
      + c.r("link_on", m) * c.a("plaid_platform_fee")),
    R("cogs_hosting", "Hosting / Supabase / Expo", "usd",
      lambda c, m: c.a("hosting_fixed") + c.a("hosting_per_mau") * c.r("mau_total", m)),
    R("cogs_llm", "LLM tutor tokens", "usd",
      lambda c, m: c.IF(_on(c, m, "llm_on", "llm_start_month"),
                        c.r("subs_paid", m) * c.a("llm_cost_per_payer") + c.r("mau_free", m) * c.a("llm_cost_per_free_mau"), 0)),
    R("cogs_rc", "RevenueCat (1% of MTR above $2.5k)", "usd",
      lambda c, m: c.MAX(0, c.r("bill_gross", m) - c.a("rc_threshold")) * c.a("rc_rate")),
    R("cogs_b2b", "B2B card processing", "usd", lambda c, m: c.r("rev_b2b", m) * c.a("b2b_processing_rate")),
    T("cogs_total", "Total COGS", "usd",
      lambda c, m: c.r("cogs_data", m) + c.r("cogs_plaid", m) + c.r("cogs_hosting", m) + c.r("cogs_llm", m)
      + c.r("cogs_rc", m) + c.r("cogs_b2b", m)),
    T("gross_profit", "GROSS PROFIT", "usd", lambda c, m: c.r("rev_total", m) - c.r("cogs_total", m)),
    R("gross_margin", "Gross margin", "pct", lambda c, m: c.DIV(c.r("gross_profit", m), c.r("rev_total", m))),

    H("OPERATING EXPENSES"),
    R("opex_founder", "Founder salary", "usd", lambda c, m: c.a("founder_salary_on") * c.a("founder_salary")),
    R("opex_contractors", "Contractors", "usd",
      lambda c, m: c.CHOOSE(c.fy(m), c.a("contractors_fy1"), c.a("contractors_fy2"), c.a("contractors_fy3"))),
    R("opex_asa", "Marketing: Apple Search Ads", "usd", lambda c, m: c.r("spend_asa", m)),
    R("opex_creators", "Marketing: creators", "usd", lambda c, m: c.r("spend_creators", m)),
    R("opex_mkt_other", "Marketing: other", "usd", lambda c, m: c.a("mkt_other_monthly")),
    R("opex_legal", "Legal & compliance", "usd",
      lambda c, m: c.IF(c.EQ(c.mo(m), 1), c.a("legal_llc") + c.a("legal_counsel_review") + c.a("legal_privacy")
                        + c.a("legal_trademark"), 0)
      + c.a("legal_monthly")
      + c.IF(c.AND(c.mo(m) > 1, c.EQ(c.MOD(c.mo(m) - 1, 12), 0)), c.a("legal_annual_review"), 0)
      + c.IF(_on(c, m, "soc2_on", "soc2_start_month"), c.a("soc2_monthly"), 0)),
    R("opex_tools", "Software / tools", "usd",
      lambda c, m: c.CHOOSE(c.fy(m), c.a("tools_fy1"), c.a("tools_fy2"), c.a("tools_fy3"))),
    R("opex_stores", "Apple / Google developer fees", "usd",
      lambda c, m: c.IF(c.EQ(c.MOD(c.mo(m) - 1, 12), 0), c.a("apple_dev_fee"), 0)
      + c.IF(c.EQ(c.mo(m), 1), c.a("google_dev_fee"), 0)),
    R("opex_insurance", "Insurance", "usd", lambda c, m: c.a("insurance_monthly")),
    T("opex_total", "Total operating expenses", "usd",
      lambda c, m: c.r("opex_founder", m) + c.r("opex_contractors", m) + c.r("opex_asa", m) + c.r("opex_creators", m)
      + c.r("opex_mkt_other", m) + c.r("opex_legal", m) + c.r("opex_tools", m) + c.r("opex_stores", m)
      + c.r("opex_insurance", m)),
    T("ebit", "OPERATING INCOME (EBIT)", "usd", lambda c, m: c.r("gross_profit", m) - c.r("opex_total", m)),
    R("ebit_margin", "Operating margin", "pct", lambda c, m: c.DIV(c.r("ebit", m), c.r("rev_total", m))),

    H("CASH"),
    R("bill_net", "In-app billings net of refunds & store fee", "usd",
      lambda c, m: c.r("bill_gross", m) * c.a("net_factor")),
    R("deferred_chg", "Change in deferred revenue (annual plans paid upfront)", "usd",
      lambda c, m: c.r("bill_net", m) - c.r("rev_subs_net", m)),
    T("cash_flow", "Operating cash flow", "usd", lambda c, m: c.r("ebit", m) + c.r("deferred_chg", m)),
    T("cash_cum", "Cumulative cash (from $0 at launch)", "usd", lambda c, m: c.r("cash_cum", m - 1) + c.r("cash_flow", m)),
    R("ebit_cum", "Cumulative operating income", "usd", lambda c, m: c.r("ebit_cum", m - 1) + c.r("ebit", m)),

    H("KPIs"),
    R("arpu", "ARPU: total revenue / MAU", "usd_c", lambda c, m: c.DIV(c.r("rev_total", m), c.r("mau_total", m))),
    R("arppu", "ARPPU: net subscription revenue / paid subscriber", "usd_c",
      lambda c, m: c.DIV(c.r("rev_subs_net", m), c.r("subs_paid", m))),
    R("cac_paid", "CAC: paid channels (ASA + creators) per payer they bring", "usd",
      lambda c, m: c.DIV(c.r("spend_asa", m) + c.r("spend_creators", m),
                         (c.r("inst_asa", m) + c.r("inst_creators", m)) * c.a("install_to_paid"))),
    R("flag_be", "EBIT >= 0 this month (1 = yes)", "flag", lambda c, m: c.IF(c.r("ebit", m) >= 0, 1, 0)),
    B("flag_be_sus", "EBIT >= 0 this month and every month after", "flag",
      lambda c, m: c.IF(c.r("ebit", m) >= 0, 1, 0) if m == MONTHS
      else c.IF(c.AND(c.r("ebit", m) >= 0, c.EQ(c.r("flag_be_sus", m + 1), 1)), 1, 0)),
    B("flag_cash_sus", "Cumulative cash >= 0 this month and every month after", "flag",
      lambda c, m: c.IF(c.r("cash_cum", m) >= 0, 1, 0) if m == MONTHS
      else c.IF(c.AND(c.r("cash_cum", m) >= 0, c.EQ(c.r("flag_cash_sus", m + 1), 1)), 1, 0)),
]
ROW_BY_KEY = {r.key: r for r in ROWS if r.key}


class NumCtx(NumOps):
    def __init__(self, p):
        self.p = p
        self.v = {r.key: [0.0] * (MONTHS + 2) for r in ROWS if r.key}

    def a(self, k): return self.p[k]
    def r(self, k, m): return 0.0 if m < 1 or m > MONTHS else self.v[k][m]
    def mo(self, m): return m
    def fy(self, m): return (m - 1) // 12 + 1
    def SUM(self, k, m1, m2): return sum(self.v[k][max(1, m1):m2 + 1])


def run_scenario(p: dict) -> dict:
    """Run the monthly model. Returns {row_key: [None, m1, ..., m36]}."""
    c = NumCtx(p)
    fwd = [r for r in ROWS if r.key and r.kind != "backward"]
    back = [r for r in ROWS if r.kind == "backward"]
    for m in range(1, MONTHS + 1):
        for r in fwd:
            c.v[r.key][m] = float(r.fn(c, m))
    for m in range(MONTHS, 0, -1):
        for r in back:
            c.v[r.key][m] = float(r.fn(c, m))
    return {k: [None] + v[1:MONTHS + 1] for k, v in c.v.items()}


def first_month(flags: list) -> int | str:
    """First month (1-based) whose flag is 1, else 'Never'. `flags` is [None, m1..]."""
    for m in range(1, len(flags)):
        if flags[m] == 1:
            return m
    return "Never"


def breakeven(ebit: list) -> dict:
    """Break-even detection on an EBIT series [None, m1..mN]."""
    n = len(ebit) - 1
    first = next((m for m in range(1, n + 1) if ebit[m] >= 0), "Never")
    sustained = "Never"
    for m in range(n, 0, -1):
        if ebit[m] >= 0:
            sustained = m
        else:
            break
    return {"first": first, "sustained": sustained}


# =============================================================================
# 4. Annual P&L and KPI specs
# =============================================================================
def _s(key):
    return lambda c, fy: c.fysum(key, fy)


ANNUAL = [
    H("REVENUE"),
    ("Gross in-app sales", "usd", "row", _s("rev_iap_gross")),
    ("Less: refunds", "usd", "row", _s("refunds")),
    ("Less: app store commission", "usd", "row", _s("store_fee")),
    ("Subscriptions & in-app, net", "usd", "total", _s("rev_subs_net")),
    ("Advertising", "usd", "row", _s("rev_ads")),
    ("Affiliate", "usd", "row", _s("rev_aff")),
    ("B2B / Edu licences", "usd", "row", _s("rev_b2b")),
    ("TOTAL REVENUE", "usd", "total", _s("rev_total")),
    H("COST OF REVENUE"),
    ("Data licensing", "usd", "row", _s("cogs_data")),
    ("Plaid / aggregation", "usd", "row", _s("cogs_plaid")),
    ("Hosting", "usd", "row", _s("cogs_hosting")),
    ("LLM tutor", "usd", "row", _s("cogs_llm")),
    ("RevenueCat", "usd", "row", _s("cogs_rc")),
    ("B2B processing", "usd", "row", _s("cogs_b2b")),
    ("Total COGS", "usd", "total", _s("cogs_total")),
    ("GROSS PROFIT", "usd", "total", _s("gross_profit")),
    ("Gross margin", "pct", "row", lambda c, fy: c.DIV(c.fysum("gross_profit", fy), c.fysum("rev_total", fy))),
    H("OPERATING EXPENSES"),
    ("Founder salary", "usd", "row", _s("opex_founder")),
    ("Contractors", "usd", "row", _s("opex_contractors")),
    ("Marketing: Apple Search Ads", "usd", "row", _s("opex_asa")),
    ("Marketing: creators", "usd", "row", _s("opex_creators")),
    ("Marketing: other", "usd", "row", _s("opex_mkt_other")),
    ("Legal & compliance", "usd", "row", _s("opex_legal")),
    ("Software / tools", "usd", "row", _s("opex_tools")),
    ("Apple / Google developer fees", "usd", "row", _s("opex_stores")),
    ("Insurance", "usd", "row", _s("opex_insurance")),
    ("Total operating expenses", "usd", "total", _s("opex_total")),
    ("OPERATING INCOME (EBIT)", "usd", "total", _s("ebit")),
    ("Operating margin", "pct", "row", lambda c, fy: c.DIV(c.fysum("ebit", fy), c.fysum("rev_total", fy))),
    H("MEMO"),
    ("Ads as share of revenue", "pct", "row", lambda c, fy: c.DIV(c.fysum("rev_ads", fy), c.fysum("rev_total", fy))),
    ("EBIT if ads were switched off (no other change)", "usd", "row",
     lambda c, fy: c.fysum("ebit", fy) - c.fysum("rev_ads", fy)),
    ("Operating cash flow", "usd", "row", _s("cash_flow")),
    ("Cumulative cash, end of period", "usd", "row", lambda c, fy: c.eop("cash_cum", fy)),
    ("Installs", "count", "row", _s("inst_total")),
    ("New paid subscribers", "count", "row", _s("new_paid")),
    ("MAU, end of period", "count", "row", lambda c, fy: c.eop("mau_total", fy)),
    ("Paid subscribers, end of period", "count", "row", lambda c, fy: c.eop("subs_paid", fy)),
]


def ltv(c):
    nf, vc = c.a("net_factor"), c.a("var_cost_per_payer")
    return (c.a("mix_monthly") * (c.a("price_monthly") * nf - vc) / c.a("churn_monthly")
            + c.a("mix_annual") * (c.a("price_annual") * nf - 12 * vc) / (1 - c.a("renew_annual"))
            + c.a("mix_student") * (c.a("price_student") * nf - 12 * vc) / (1 - c.a("renew_student")))


def contrib(c):
    arppu = (c.a("mix_monthly") * c.a("price_monthly") + c.a("mix_annual") * c.a("price_annual") / 12
             + c.a("mix_student") * c.a("price_student") / 12) * c.a("net_factor")
    return arppu - c.a("var_cost_per_payer")


def cac_asa(c): return c.DIV(c.a("asa_cpi"), c.a("install_to_paid"))
def cac_cre(c): return c.DIV(c.a("creator_cpi"), c.a("install_to_paid"))


def cac_blend(c, fy=3):
    return c.DIV(c.fysum("spend_asa", fy) + c.fysum("spend_creators", fy), c.fysum("new_paid", fy))


KPIS = [
    H("SCALE"),
    ("Installs, 36 months", "count", lambda c: c.fysum("inst_total", 0)),
    ("MAU, month 12", "count", lambda c: c.cell("mau_total", 12)),
    ("MAU, month 24", "count", lambda c: c.cell("mau_total", 24)),
    ("MAU, month 36", "count", lambda c: c.cell("mau_total", 36)),
    ("Paid subscribers, month 12", "count", lambda c: c.cell("subs_paid", 12)),
    ("Paid subscribers, month 24", "count", lambda c: c.cell("subs_paid", 24)),
    ("Paid subscribers, month 36", "count", lambda c: c.cell("subs_paid", 36)),
    ("Paid subscribers / MAU, month 36 (Duolingo FY25: 9.2%)", "pct", lambda c: c.cell("paid_share", 36)),
    ("Net subscription ARR run-rate, month 36", "usd", lambda c: c.cell("rev_subs_net", 36) * 12),
    ("Total revenue run-rate (x12), month 36", "usd", lambda c: c.cell("rev_total", 36) * 12),
    H("MONETISATION"),
    ("Install-to-paid conversion", "pct", lambda c: c.a("install_to_paid")),
    ("ARPU per MAU per month, FY3", "usd_c", lambda c: c.DIV(c.fysum("rev_total", 3), c.fysum("mau_total", 3))),
    ("ARPPU (net subs revenue per payer per month), FY3", "usd_c",
     lambda c: c.DIV(c.fysum("rev_subs_net", 3), c.fysum("subs_paid", 3))),
    ("Ad revenue per ad-seeing free MAU per month", "usd_c", lambda c: c.a("ad_rev_per_ad_mau")),
    H("UNIT ECONOMICS (steady-state plan mix)"),
    ("Contribution per payer per month (net ARPPU - LLM - Plaid)", "usd_c", contrib),
    ("LTV per payer (net of store fee, refunds, variable cost)", "usd", ltv),
    ("CAC per payer: Apple Search Ads (CPI / install-to-paid)", "usd", cac_asa),
    ("CAC per payer: creators", "usd", cac_cre),
    ("CAC per payer: organic / SEO and referral (no media spend)", "usd", lambda c: 0 * c.a("install_to_paid")),
    ("CAC blended: paid media / all new payers, FY3", "usd", cac_blend),
    ("LTV / CAC: Apple Search Ads", "ratio", lambda c: c.DIV(ltv(c), cac_asa(c))),
    ("LTV / CAC: creators", "ratio", lambda c: c.DIV(ltv(c), cac_cre(c))),
    ("LTV / CAC: blended, FY3", "ratio", lambda c: c.DIV(ltv(c), cac_blend(c))),
    ("Payback months: Apple Search Ads", "months", lambda c: c.DIV(cac_asa(c), contrib(c))),
    ("Payback months: creators", "months", lambda c: c.DIV(cac_cre(c), contrib(c))),
    ("Break-even CPI (LTV x install-to-paid)", "usd_c", lambda c: ltv(c) * c.a("install_to_paid")),
    H("PROFITABILITY AND CASH"),
    ("First month with EBIT >= 0", "month", lambda c: c.first("flag_be")),
    ("Break-even month (EBIT >= 0 from then on)", "month", lambda c: c.first("flag_be_sus")),
    ("Month cumulative cash turns positive for good", "month", lambda c: c.first("flag_cash_sus")),
    ("Cumulative operating income, 36 months", "usd", lambda c: c.cell("ebit_cum", 36)),
    ("Max cash need (deepest cumulative cash)", "usd",
     lambda c: c.IF(c.rmin("cash_cum") < 0, -c.rmin("cash_cum"), 0)),
    ("Month of cash trough", "month", lambda c: c.argmin("cash_cum")),
    ("Cumulative cash, month 36", "usd", lambda c: c.cell("cash_cum", 36)),
    H("ADS VS NO ADS"),
    ("Ad revenue, FY1", "usd", lambda c: c.fysum("rev_ads", 1)),
    ("Ad revenue, FY2", "usd", lambda c: c.fysum("rev_ads", 2)),
    ("Ad revenue, FY3", "usd", lambda c: c.fysum("rev_ads", 3)),
    ("Ads as share of revenue, FY3", "pct", lambda c: c.DIV(c.fysum("rev_ads", 3), c.fysum("rev_total", 3))),
    ("Ads as share of revenue, 36 months", "pct", lambda c: c.DIV(c.fysum("rev_ads", 0), c.fysum("rev_total", 0))),
    ("EBIT FY3, with ads", "usd", lambda c: c.fysum("ebit", 3)),
    ("EBIT FY3, ads switched off", "usd", lambda c: c.fysum("ebit", 3) - c.fysum("rev_ads", 3)),
    ("Affiliate revenue, FY3", "usd", lambda c: c.fysum("rev_aff", 3)),
]


def _fy_range(fy):
    return (1, MONTHS) if fy == 0 else (12 * (fy - 1) + 1, 12 * fy)


class AggNum(NumOps):
    def __init__(self, p, v): self.p, self.v = p, v
    def a(self, k): return self.p[k]
    def cell(self, k, m): return self.v[k][m]
    def fysum(self, k, fy):
        m1, m2 = _fy_range(fy)
        return sum(self.v[k][m1:m2 + 1])
    def eop(self, k, fy): return self.v[k][_fy_range(fy)[1]]
    def first(self, k): return first_month(self.v[k])
    def rmin(self, k): return min(self.v[k][1:])
    def argmin(self, k):
        s = self.v[k][1:]
        return s.index(min(s)) + 1


class AggSym(SymOps):
    def __init__(self, scen, rowno, arow):
        self.sh, self.rowno, self.arow, self.acol = SHEET[scen], rowno, arow, ASSUMP_COL[scen]
    def a(self, k): return X(f"Assumptions!${self.acol}${self.arow[k]}")
    def cell(self, k, m): return X(f"{self.sh}!{col(m)}{self.rowno[k]}")
    def _rng(self, k, m1=1, m2=MONTHS): return f"{self.sh}!${col(m1)}${self.rowno[k]}:${col(m2)}${self.rowno[k]}"
    def fysum(self, k, fy): return X(f"SUM({self._rng(k, *_fy_range(fy))})")
    def eop(self, k, fy): return self.cell(k, _fy_range(fy)[1])
    def first(self, k):
        return X(f'IFERROR(INDEX({self.sh}!$C$2:${col(MONTHS)}$2,MATCH(1,{self._rng(k)},0)),"Never")')
    def rmin(self, k): return X(f"MIN({self._rng(k)})")
    def argmin(self, k):
        return X(f"INDEX({self.sh}!$C$2:${col(MONTHS)}$2,MATCH(MIN({self._rng(k)}),{self._rng(k)},0))")


def annual_values(p, v) -> dict:
    """{label: [FY1, FY2, FY3, Total]} for one scenario."""
    c = AggNum(p, v)
    out = {}
    for item in ANNUAL:
        if isinstance(item, Row):
            continue
        label, _, _, fn = item
        out[label] = [fn(c, fy) for fy in (1, 2, 3, 0)]
    return out


def kpi_values(p, v) -> dict:
    c = AggNum(p, v)
    return {item[0]: item[2](c) for item in KPIS if not isinstance(item, Row)}


# =============================================================================
# 5. Running all scenarios + sensitivities
# =============================================================================
def run_all(A: dict, overrides: dict | None = None) -> dict:
    res = {}
    for s in SCENARIOS:
        p = scenario_params(A, s, (overrides or {}).get(s))
        v = run_scenario(p)
        res[s] = {"p": p, "v": v, "annual": annual_values(p, v), "kpi": kpi_values(p, v)}
    return res


def _ebit36(p): return run_scenario(p)["ebit"][MONTHS]
def _fy3(v, k): return sum(v[k][25:37])


def sensitivities(A: dict) -> dict:
    base = scenario_params(A, "base")
    # Grid 1: month-36 EBIT vs install-to-paid x annual price (monthly price scaled in proportion).
    conv = [0.010, 0.015, 0.020, 0.025, 0.030, 0.040, 0.050]
    prices = [59.99, 79.99, 99.99, 119.99]
    ratio = base["price_monthly"] / base["price_annual"]
    grid1 = []
    for cv in conv:
        row = []
        for pa in prices:
            ts = cv / (base["activation_rate"] * base["trial_to_paid"])
            p = scenario_params(A, "base", {"trial_start_rate": ts, "price_annual": pa,
                                            "price_monthly": round(pa * ratio, 2)})
            row.append(_ebit36(p))
        grid1.append(row)
    # Grid 2: eCPM multiplier, all scenarios.
    mults = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0]
    grid2 = {}
    for s in SCENARIOS:
        p0 = scenario_params(A, s)
        rows = []
        for mlt in mults:
            ov = {k: p0[k] * mlt for k in ("ecpm_article", "ecpm_screener", "ecpm_rewarded")}
            v = run_scenario(scenario_params(A, s, ov))
            rows.append({"mult": mlt, "ebit36": v["ebit"][MONTHS], "ads_fy3": _fy3(v, "rev_ads"),
                         "share_fy3": _fy3(v, "rev_ads") / _fy3(v, "rev_total") if _fy3(v, "rev_total") else 0.0,
                         "ebit_fy3": _fy3(v, "ebit")})
        grid2[s] = rows
    # Ads on vs off.
    ads = {}
    for s in SCENARIOS:
        on = run_scenario(scenario_params(A, s))
        off = run_scenario(scenario_params(A, s, {"ads_on": 0}))
        ads[s] = {"on": breakeven(on["ebit"]), "off": breakeven(off["ebit"]),
                  "cash_on": -min(0, min(on["cash_cum"][1:])), "cash_off": -min(0, min(off["cash_cum"][1:]))}
    # Tornado: +/-20% on every numeric driver, effect on base FY3 EBIT.
    v0 = run_scenario(base)
    e0 = _fy3(v0, "ebit")
    torn = []
    for k, d in A["drivers"].items():
        if d.unit in ("toggle", "month"):
            continue
        lo, hi = d.v * 0.8, d.v * 1.2
        if d.unit == "pct":
            hi = min(hi, 1.0)
        try:
            el = _fy3(run_scenario(scenario_params(A, "base", {k: lo})), "ebit")
            eh = _fy3(run_scenario(scenario_params(A, "base", {k: hi})), "ebit")
        except ValueError:
            continue
        torn.append({"key": k, "label": d.label, "low": el - e0, "high": eh - e0, "swing": abs(eh - el)})
    torn.sort(key=lambda r: -r["swing"])
    return {"conv": conv, "prices": prices, "ratio": ratio, "grid1": grid1, "mults": mults,
            "grid2": grid2, "ads": ads, "tornado": torn, "ebit_fy3_base": e0}


# =============================================================================
# 6. Workbook
# =============================================================================
ARIAL = "Arial"
F_IN = Font(name=ARIAL, size=10, color="0000FF")
F_CALC = Font(name=ARIAL, size=10, color="000000")
F_BOLD = Font(name=ARIAL, size=10, bold=True)
F_HEAD = Font(name=ARIAL, size=10, bold=True, color="FFFFFF")
F_TITLE = Font(name=ARIAL, size=13, bold=True)
F_NOTE = Font(name=ARIAL, size=9, italic=True, color="555555")
FILL_HEAD = PatternFill("solid", fgColor="1F3864")
FILL_SEC = PatternFill("solid", fgColor="D9E1F2")
FILL_TOT = PatternFill("solid", fgColor="F2F2F2")
FILL_IN = PatternFill("solid", fgColor="FFF2CC")
TOP = Border(top=Side(style="thin", color="808080"))

NUMFMT = {
    "count": '#,##0;(#,##0);"-"',
    "usd": '$#,##0;($#,##0);"-"',
    "usd_c": '$#,##0.00;($#,##0.00);"-"',
    "pct": '0.0%;(0.0%);"-"',
    "x": '#,##0.0##;(#,##0.0##);"-"',
    "ratio": '0.00"x";(0.00"x");"-"',
    "months": '0.0;(0.0);"-"',
    "month": '0',
    "toggle": '0',
    "flag": '0',
}


def _month_labels(meta):
    y, mth = map(int, str(meta.get("start_month", "2027-01")).split("-"))
    out = []
    for i in range(MONTHS):
        mm = mth - 1 + i
        out.append(dt.date(y + mm // 12, mm % 12 + 1, 1).strftime("%b-%y"))
    return out


class MSym(SymOps):
    def __init__(self, scen, rowno, arow):
        self.rowno, self.arow, self.acol = rowno, arow, ASSUMP_COL[scen]
    def a(self, k): return X(f"Assumptions!${self.acol}${self.arow[k]}")
    def r(self, k, m): return 0 if m < 1 or m > MONTHS else X(f"{col(m)}{self.rowno[k]}")
    def mo(self, m): return X(f"{col(m)}$2")
    def fy(self, m): return X(f"{col(m)}$3")
    def SUM(self, k, m1, m2): return X(f"SUM({col(max(1, m1))}{self.rowno[k]}:{col(m2)}{self.rowno[k]})")


class ASym(SymOps):
    def __init__(self, c, arow): self.c, self.arow = c, arow
    def a(self, k): return X(f"{self.c}{self.arow[k]}")


def _cited_sources(A) -> list[dict]:
    try:
        src = {s["id"]: s for s in json.load(open(DOCS / "sources.json"))}
    except (OSError, ValueError):
        return []
    ids = set()
    for d in A["drivers"].values():
        ids.update(re.findall(r"S\d+", d.src))
    return [src[i] for i in sorted(ids, key=lambda s: int(s[1:])) if i in src]


def build_workbook(A: dict, res: dict, sens: dict, path: Path) -> dict:
    """Write the workbook. Returns {(sheet, coord): expected python value} for verification."""
    expect: dict = {}
    wb = Workbook()
    ws = wb.active
    ws.title = "Assumptions"

    # ---------------- Assumptions ----------------
    ws["A1"] = "Tenbagger model: assumptions (edit the blue cells; everything else recalculates)"
    ws["A1"].font = F_TITLE
    ws["A2"] = ("Blue = input. Black = formula. Bear/Bull cells in black follow Base; type a value to override. "
                "Mirrors tenbagger/finance/assumptions.yaml (re-run model.py to refresh Python outputs).")
    ws["A2"].font = F_NOTE
    hdr = ["Section", "Key", "Driver", "Unit", "Base", "Bear", "Bull", "Source / why"]
    for i, h in enumerate(hdr, 1):
        c = ws.cell(row=3, column=i, value=h)
        c.font, c.fill = F_HEAD, FILL_HEAD
    arow: dict[str, int] = {}
    r = 4
    last_sec = None
    for k, d in A["drivers"].items():
        if d.section != last_sec:
            c = ws.cell(row=r, column=1, value=d.section.upper())
            c.font = F_BOLD
            for ci in range(1, 9):
                ws.cell(row=r, column=ci).fill = FILL_SEC
            r += 1
            last_sec = d.section
        arow[k] = r
        ws.cell(row=r, column=1, value=d.section).font = F_CALC
        ws.cell(row=r, column=2, value=k).font = F_NOTE
        ws.cell(row=r, column=3, value=d.label).font = F_CALC
        ws.cell(row=r, column=4, value=d.unit).font = F_CALC
        for s in SCENARIOS:
            cc = ws[f"{ASSUMP_COL[s]}{r}"]
            ov = A["scenarios"].get(s, {}) if s != "base" else {}
            if s == "base" or k in ov:
                cc.value = res[s]["p"][k]
                cc.font = F_IN
                cc.fill = FILL_IN
            else:
                cc.value = f"=$E{r}"
                cc.font = F_CALC
                expect[("Assumptions", cc.coordinate)] = res[s]["p"][k]
            cc.number_format = NUMFMT.get(d.unit, "General")
        ws.cell(row=r, column=8, value=d.src).font = F_NOTE
        r += 1
    r += 1
    ws.cell(row=r, column=1, value="DERIVED (formulas, do not edit)").font = F_BOLD
    for ci in range(1, 9):
        ws.cell(row=r, column=ci).fill = FILL_SEC
    r += 1
    for i, (key, label, fmt, fn) in enumerate(DERIVED):
        arow[key] = r + i
    for key, label, fmt, fn in DERIVED:
        rr = arow[key]
        ws.cell(row=rr, column=1, value="Derived").font = F_CALC
        ws.cell(row=rr, column=2, value=key).font = F_NOTE
        ws.cell(row=rr, column=3, value=label).font = F_CALC
        ws.cell(row=rr, column=4, value=fmt).font = F_CALC
        for s in SCENARIOS:
            c_ = ASSUMP_COL[s]
            cell = ws[f"{c_}{rr}"]
            cell.value = "=" + _f(fn(ASym(c_, arow)))
            cell.font = F_CALC
            cell.number_format = NUMFMT[fmt]
            expect[("Assumptions", cell.coordinate)] = res[s]["p"][key]
    for ci, w in zip(range(1, 9), (12, 24, 62, 8, 12, 12, 12, 90)):
        ws.column_dimensions[get_column_letter(ci)].width = w
    ws.freeze_panes = "E4"

    # ---------------- Monthly sheets ----------------
    labels = _month_labels(A["meta"])
    rowno: dict[str, int] = {}
    rr = 5
    layout = []
    for row in ROWS:
        if row.kind == "header":
            rr += 1 if rr > 5 else 0
            layout.append((rr, row))
            rr += 1
        else:
            rowno[row.key] = rr
            layout.append((rr, row))
            rr += 1
    for s in SCENARIOS:
        sh = wb.create_sheet(SHEET[s])
        sh["A1"] = f"Tenbagger: {s.capitalize()} case, monthly (USD). All cells are formulas driven by the Assumptions sheet."
        sh["A1"].font = F_TITLE
        for i, t in enumerate(("Month", "Fiscal year", "Calendar month"), 2):
            sh.cell(row=i, column=1, value=t).font = F_HEAD
            sh.cell(row=i, column=1).fill = FILL_HEAD
            sh.cell(row=i, column=2).fill = FILL_HEAD
        for m in range(1, MONTHS + 1):
            c1 = sh[f"{col(m)}2"]; c1.value = m
            c2 = sh[f"{col(m)}3"]; c2.value = (m - 1) // 12 + 1
            c3 = sh[f"{col(m)}4"]; c3.value = labels[m - 1]
            for cc in (c1, c2, c3):
                cc.font, cc.fill, cc.alignment = F_HEAD, FILL_HEAD, Alignment(horizontal="right")
        ctx = MSym(s, rowno, arow)
        vals = res[s]["v"]
        for rnum, row in layout:
            if row.kind == "header":
                sh.cell(row=rnum, column=1, value=row.label).font = F_BOLD
                for m in range(0, MONTHS + 2):
                    sh.cell(row=rnum, column=m + 1).fill = FILL_SEC
                continue
            lab = sh.cell(row=rnum, column=1, value=row.label)
            lab.font = F_BOLD if row.kind == "total" else F_CALC
            sh.cell(row=rnum, column=2, value=row.key).font = F_NOTE
            for m in range(1, MONTHS + 1):
                cell = sh[f"{col(m)}{rnum}"]
                cell.value = "=" + _f(row.fn(ctx, m))
                cell.font = F_BOLD if row.kind == "total" else F_CALC
                cell.number_format = NUMFMT[row.fmt]
                if row.kind == "total":
                    cell.fill, cell.border = FILL_TOT, TOP
                expect[(SHEET[s], cell.coordinate)] = vals[row.key][m]
            if row.kind == "total":
                sh.cell(row=rnum, column=1).fill = FILL_TOT
        sh.column_dimensions["A"].width = 52
        sh.column_dimensions["B"].width = 14
        for m in range(1, MONTHS + 1):
            sh.column_dimensions[col(m)].width = 11
        sh.freeze_panes = "C5"

    # ---------------- Annual_PnL ----------------
    sh = wb.create_sheet("Annual_PnL")
    sh["A1"] = "Tenbagger: annual income statement by scenario (USD). FY1 = months 1-12. Live formulas."
    sh["A1"].font = F_TITLE
    r = 3
    for s in SCENARIOS:
        c = sh.cell(row=r, column=1, value=f"{s.upper()} CASE")
        for ci, h in enumerate(["", "FY1", "FY2", "FY3", "3-year total"], 1):
            cell = sh.cell(row=r, column=ci, value=h if ci > 1 else f"{s.upper()} CASE")
            cell.font, cell.fill = F_HEAD, FILL_HEAD
        r += 1
        ctx = AggSym(s, rowno, arow)
        num = AggNum(res[s]["p"], res[s]["v"])
        for item in ANNUAL:
            if isinstance(item, Row):
                sh.cell(row=r, column=1, value=item.label).font = F_BOLD
                for ci in range(1, 6):
                    sh.cell(row=r, column=ci).fill = FILL_SEC
                r += 1
                continue
            label, fmt, kind, fn = item
            sh.cell(row=r, column=1, value=label).font = F_BOLD if kind == "total" else F_CALC
            for ci, fy in zip(range(2, 6), (1, 2, 3, 0)):
                cell = sh.cell(row=r, column=ci, value="=" + _f(fn(ctx, fy)))
                cell.font = F_BOLD if kind == "total" else F_CALC
                cell.number_format = NUMFMT[fmt]
                if kind == "total":
                    cell.fill, cell.border = FILL_TOT, TOP
                expect[("Annual_PnL", cell.coordinate)] = fn(num, fy)
            r += 1
        r += 1
    sh.column_dimensions["A"].width = 48
    for ci in "BCDE":
        sh.column_dimensions[ci].width = 15
    sh.freeze_panes = "B3"

    # ---------------- KPIs ----------------
    sh = wb.create_sheet("KPIs")
    sh["A1"] = "Tenbagger: KPIs and unit economics (live formulas)"
    sh["A1"].font = F_TITLE
    for ci, h in enumerate(["Metric", "Base", "Bear", "Bull"], 1):
        cell = sh.cell(row=3, column=ci, value=h)
        cell.font, cell.fill = F_HEAD, FILL_HEAD
    r = 4
    ctxs = {s: AggSym(s, rowno, arow) for s in SCENARIOS}
    nums = {s: AggNum(res[s]["p"], res[s]["v"]) for s in SCENARIOS}
    for item in KPIS:
        if isinstance(item, Row):
            sh.cell(row=r, column=1, value=item.label).font = F_BOLD
            for ci in range(1, 5):
                sh.cell(row=r, column=ci).fill = FILL_SEC
            r += 1
            continue
        label, fmt, fn = item
        sh.cell(row=r, column=1, value=label).font = F_CALC
        for ci, s in enumerate(SCENARIOS, 2):
            cell = sh.cell(row=r, column=ci, value="=" + _f(fn(ctxs[s])))
            cell.font = F_CALC
            cell.number_format = NUMFMT[fmt]
            cell.alignment = Alignment(horizontal="right")
            expect[("KPIs", cell.coordinate)] = fn(nums[s])
        r += 1
    sh.cell(row=r + 1, column=1, value=("Notes: LTV uses the steady-state plan mix and variable cost; it ignores Recruiting Pass, "
                                        "ads and affiliate revenue from the payer. CAC by channel assumes paid installs convert "
                                        "like organic ones (likely optimistic).")).font = F_NOTE
    sh.column_dimensions["A"].width = 62
    for ci in "BCD":
        sh.column_dimensions[ci].width = 15
    sh.freeze_panes = "B4"

    # ---------------- Sensitivity (static; computed by model.py) ----------------
    sh = wb.create_sheet("Sensitivity")
    sh["A1"] = "Sensitivities: VALUES computed by model.py from assumptions.yaml (not live). Re-run the script to refresh."
    sh["A1"].font = F_TITLE
    r = 3
    sh.cell(row=r, column=1, value="1. Base case: operating income (EBIT) in month 36, by install-to-paid conversion x annual price "
                                   f"(monthly price scaled at {sens['ratio']:.3f}x annual)").font = F_BOLD
    r += 1
    sh.cell(row=r, column=1, value="Install-to-paid \\ Annual price").font = F_HEAD
    sh.cell(row=r, column=1).fill = FILL_HEAD
    for j, pa in enumerate(sens["prices"], 2):
        c = sh.cell(row=r, column=j, value=pa)
        c.font, c.fill, c.number_format = F_HEAD, FILL_HEAD, NUMFMT["usd_c"]
    r += 1
    for i, cv in enumerate(sens["conv"]):
        c = sh.cell(row=r, column=1, value=cv)
        c.number_format, c.font = NUMFMT["pct"], F_BOLD
        for j, _ in enumerate(sens["prices"]):
            cc = sh.cell(row=r, column=j + 2, value=round(sens["grid1"][i][j], 2))
            cc.number_format, cc.font = NUMFMT["usd"], F_CALC
        r += 1
    r += 1
    sh.cell(row=r, column=1, value="2. Ads eCPM multiplier (all three placements scaled together)").font = F_BOLD
    r += 1
    heads = ["Scenario", "eCPM x", "Ad revenue FY3", "Ads share of FY3 revenue", "EBIT FY3", "EBIT month 36"]
    for j, h in enumerate(heads, 1):
        c = sh.cell(row=r, column=j, value=h)
        c.font, c.fill = F_HEAD, FILL_HEAD
    r += 1
    for s in SCENARIOS:
        for g in sens["grid2"][s]:
            vals = [s, g["mult"], g["ads_fy3"], g["share_fy3"], g["ebit_fy3"], g["ebit36"]]
            fmts = [None, '0.00"x"', NUMFMT["usd"], NUMFMT["pct"], NUMFMT["usd"], NUMFMT["usd"]]
            for j, (v_, f_) in enumerate(zip(vals, fmts), 1):
                c = sh.cell(row=r, column=j, value=round(v_, 4) if isinstance(v_, float) else v_)
                c.font = F_CALC
                if f_:
                    c.number_format = f_
            r += 1
    r += 1
    sh.cell(row=r, column=1, value="3. Ads on vs off").font = F_BOLD
    r += 1
    heads = ["Scenario", "Break-even month (ads on)", "Break-even month (ads off)", "Max cash need (ads on)",
             "Max cash need (ads off)"]
    for j, h in enumerate(heads, 1):
        c = sh.cell(row=r, column=j, value=h)
        c.font, c.fill = F_HEAD, FILL_HEAD
    r += 1
    for s in SCENARIOS:
        a = sens["ads"][s]
        for j, v_ in enumerate([s, a["on"]["sustained"], a["off"]["sustained"], a["cash_on"], a["cash_off"]], 1):
            c = sh.cell(row=r, column=j, value=round(v_, 2) if isinstance(v_, float) else v_)
            c.font = F_CALC
            if j >= 4:
                c.number_format = NUMFMT["usd"]
        r += 1
    r += 1
    sh.cell(row=r, column=1, value="4. Tornado: base FY3 EBIT change when each driver moves -20% / +20% (percentages capped at 100%)").font = F_BOLD
    r += 1
    for j, h in enumerate(["Driver", "Key", "-20%", "+20%", "Swing"], 1):
        c = sh.cell(row=r, column=j, value=h)
        c.font, c.fill = F_HEAD, FILL_HEAD
    r += 1
    for t in sens["tornado"][:20]:
        for j, v_ in enumerate([t["label"], t["key"], t["low"], t["high"], t["swing"]], 1):
            c = sh.cell(row=r, column=j, value=round(v_, 2) if isinstance(v_, float) else v_)
            c.font = F_CALC
            if j >= 3:
                c.number_format = NUMFMT["usd"]
        r += 1
    sh.column_dimensions["A"].width = 60
    for ci in "BCDEF":
        sh.column_dimensions[ci].width = 22
    sh.freeze_panes = "A3"

    # ---------------- Sources ----------------
    sh = wb.create_sheet("Sources")
    sh["A1"] = "Sources cited in assumptions.yaml (from tenbagger/docs/sources.json). [P] primary, [S] secondary, [U] unverified."
    sh["A1"].font = F_TITLE
    heads = ["ID", "Conf.", "Title", "Publisher", "Date", "Used for", "URL"]
    for j, h in enumerate(heads, 1):
        c = sh.cell(row=3, column=j, value=h)
        c.font, c.fill = F_HEAD, FILL_HEAD
    r = 4
    for s_ in _cited_sources(A):
        for j, k in enumerate(["id", "confidence", "title", "publisher", "date", "used_for", "url"], 1):
            sh.cell(row=r, column=j, value=s_.get(k, "")).font = F_CALC
        r += 1
    r += 1
    notes = [
        "Internal documents: BENCHMARKS.md (sections B, C), PRODUCT_STRATEGY.md (pricing, 90-day plan), "
        "MONEY_HUB_RESEARCH.md (Plaid costs, free tier = 1 bank), DATA_STRATEGY.md (data cost by phase).",
        "Ads eCPMs, fill rate, impressions, affiliate click/conversion/payout, insurance, contractors and legal "
        "line items are author estimates [U]; no source in sources.json covers them. Verify before relying on them.",
        "BENCHMARKS.md notes that its figures came from search snippets, not full reads; treat [P] as 'snippet says primary'.",
    ]
    for n in notes:
        sh.cell(row=r, column=1, value=n).font = F_NOTE
        r += 1
    for ci, w in zip("ABCDEFG", (6, 6, 60, 28, 11, 70, 60)):
        sh.column_dimensions[ci].width = w
    sh.freeze_panes = "A4"

    wb.calculation.fullCalcOnLoad = True
    path.parent.mkdir(parents=True, exist_ok=True)
    wb.save(path)
    return expect


# =============================================================================
# 7. LibreOffice verification
# =============================================================================
def verify_with_libreoffice(xlsx: Path, expect: dict, tol: float = 1e-6, keep: bool = True) -> dict:
    """Recalculate `xlsx` in headless LibreOffice and compare every formula cell with `expect`.

    If everything matches and `keep` is true, the recalculated copy replaces `xlsx`, so the shipped
    workbook carries cached values (handy for previewers) while keeping every formula."""
    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    if not soffice:
        return {"status": "skipped", "reason": "soffice not found; formulas not independently recalculated"}
    with tempfile.TemporaryDirectory() as td:
        prof = Path(td) / "profile"
        outd = Path(td) / "out"
        env = dict(os.environ, SAL_USE_VCLPLUGIN="svp")
        cmd = [soffice, f"-env:UserInstallation={prof.as_uri()}", "--headless", "--convert-to", "xlsx",
               "--outdir", str(outd), str(xlsx)]
        try:
            subprocess.run(cmd, capture_output=True, timeout=240, env=env, check=False)
        except subprocess.TimeoutExpired:
            return {"status": "skipped", "reason": "LibreOffice timed out"}
        conv = outd / xlsx.name
        if not conv.exists():
            return {"status": "skipped", "reason": "LibreOffice could not convert the file (is libreoffice-calc installed?)"}
        wb = load_workbook(conv, data_only=True)
        bad, errors, n = [], 0, 0
        for (sheet, coord), exp in expect.items():
            got = wb[sheet][coord].value
            n += 1
            if isinstance(got, str) and got.startswith("#"):
                errors += 1
                bad.append((sheet, coord, exp, got))
                continue
            if isinstance(exp, str) or isinstance(got, str):
                if str(exp) != str(got):
                    bad.append((sheet, coord, exp, got))
                continue
            got = 0.0 if got is None else float(got)
            if abs(got - exp) > tol * max(1.0, abs(exp)):
                bad.append((sheet, coord, exp, got))
        wb.close()
        if not bad and keep:
            shutil.copyfile(conv, xlsx)
        return {"status": "ok" if not bad else "mismatch", "cells": n, "mismatches": len(bad),
                "formula_errors": errors, "examples": bad[:10],
                "lo_version": subprocess.run([soffice, "--version"], capture_output=True, text=True).stdout.strip()}


# =============================================================================
# 8. Summary markdown + CSV
# =============================================================================
def _usd(v):
    if isinstance(v, str):
        return v
    s = f"${abs(v):,.0f}"
    return f"-{s}" if v < -0.5 else s


def _k(v):
    if abs(v) >= 1e6:
        return f"{'-' if v < 0 else ''}${abs(v) / 1e6:.2f}M"
    if abs(v) >= 1e3:
        return f"{'-' if v < 0 else ''}${abs(v) / 1e3:.0f}k"
    return _usd(v)


def _pct(v): return f"{v * 100:.1f}%"


def _mo(v): return "never (within 36 months)" if v == "Never" else f"month {v}"


def write_summary(res, sens, ver, path: Path):
    L = []
    L.append("# Tenbagger financial model: summary\n")
    L.append(f"Generated by `python tenbagger/finance/model.py` on {dt.date.today().isoformat()} from "
             "`assumptions.yaml`. Month 1 = public launch. FY1 = months 1-12. All USD. "
             "The workbook `Tenbagger_Model.xlsx` holds the same numbers as live formulas.\n")
    # Headline table
    L.append("## Headline: revenue, ad revenue and operating income\n")
    L.append("| Scenario | | FY1 | FY2 | FY3 |")
    L.append("|---|---|---:|---:|---:|")
    for s in SCENARIOS:
        a = res[s]["annual"]
        L.append(f"| **{s.capitalize()}** | Revenue | " + " | ".join(_usd(x) for x in a["TOTAL REVENUE"][:3]) + " |")
        L.append("| | Ad revenue | " + " | ".join(_usd(x) for x in a["Advertising"][:3]) + " |")
        L.append("| | Operating income | " + " | ".join(_usd(x) for x in a["OPERATING INCOME (EBIT)"][:3]) + " |")
    L.append("")
    # Annual P&L per scenario
    L.append("## Annual income statement by scenario\n")
    keep = ["Gross in-app sales", "Less: refunds", "Less: app store commission", "Subscriptions & in-app, net",
            "Advertising", "Affiliate", "B2B / Edu licences", "TOTAL REVENUE", "Total COGS", "GROSS PROFIT",
            "Gross margin", "Founder salary", "Contractors", "Marketing: Apple Search Ads", "Marketing: creators",
            "Marketing: other", "Legal & compliance", "Software / tools", "Apple / Google developer fees", "Insurance",
            "Total operating expenses", "OPERATING INCOME (EBIT)", "Operating margin", "Ads as share of revenue",
            "Cumulative cash, end of period", "MAU, end of period", "Paid subscribers, end of period"]
    pct_rows = {"Gross margin", "Operating margin", "Ads as share of revenue"}
    cnt_rows = {"MAU, end of period", "Paid subscribers, end of period"}
    for s in SCENARIOS:
        a = res[s]["annual"]
        L.append(f"### {s.capitalize()} case\n")
        L.append("| Line | FY1 | FY2 | FY3 | 3-yr total |")
        L.append("|---|---:|---:|---:|---:|")
        for k in keep:
            vals = a[k]
            if k in pct_rows:
                cells = [_pct(x) for x in vals]
            elif k in cnt_rows:
                cells = [f"{x:,.0f}" for x in vals]
            else:
                cells = [_usd(x) for x in vals]
            bold = k.isupper() or k.startswith("Total") or k.startswith("GROSS")
            name = f"**{k}**" if bold else k
            L.append(f"| {name} | " + " | ".join(cells) + " |")
        L.append("")
    # KPIs
    L.append("## Key KPIs\n")
    L.append("| KPI | Base | Bear | Bull |")
    L.append("|---|---:|---:|---:|")
    show = [("Paid subscribers, month 36", "n"), ("MAU, month 36", "n"),
            ("Paid subscribers / MAU, month 36 (Duolingo FY25: 9.2%)", "p"),
            ("Net subscription ARR run-rate, month 36", "u"), ("Install-to-paid conversion", "p"),
            ("ARPU per MAU per month, FY3", "c"), ("ARPPU (net subs revenue per payer per month), FY3", "c"),
            ("LTV per payer (net of store fee, refunds, variable cost)", "u"),
            ("CAC per payer: Apple Search Ads (CPI / install-to-paid)", "u"), ("CAC per payer: creators", "u"),
            ("CAC blended: paid media / all new payers, FY3", "u"),
            ("LTV / CAC: Apple Search Ads", "r"), ("LTV / CAC: creators", "r"), ("LTV / CAC: blended, FY3", "r"),
            ("Payback months: Apple Search Ads", "m"), ("Payback months: creators", "m"),
            ("First month with EBIT >= 0", "s"), ("Break-even month (EBIT >= 0 from then on)", "s"),
            ("Max cash need (deepest cumulative cash)", "u"), ("Month of cash trough", "s"),
            ("Cumulative cash, month 36", "u")]
    for k, t in show:
        cells = []
        for s in SCENARIOS:
            v = res[s]["kpi"][k]
            cells.append({"n": lambda x: f"{x:,.0f}", "p": _pct, "u": _usd, "c": lambda x: f"${x:,.2f}",
                          "r": lambda x: f"{x:.2f}x", "m": lambda x: f"{x:.1f}",
                          "s": lambda x: "Never" if x == "Never" else f"{x}"}[t](v))
        L.append(f"| {k} | " + " | ".join(cells) + " |")
    L.append("")
    # Ads vs no ads
    L.append("## Ads vs no ads\n")
    L.append("| Scenario | Ad revenue FY3 | Ads share of FY3 revenue | EBIT FY3 with ads | EBIT FY3 without ads | "
             "Break-even with ads | Break-even without ads |")
    L.append("|---|---:|---:|---:|---:|---:|---:|")
    for s in SCENARIOS:
        k = res[s]["kpi"]
        a = sens["ads"][s]
        L.append(f"| {s.capitalize()} | {_usd(k['Ad revenue, FY3'])} | {_pct(k['Ads as share of revenue, FY3'])} | "
                 f"{_usd(k['EBIT FY3, with ads'])} | {_usd(k['EBIT FY3, ads switched off'])} | "
                 f"{a['on']['sustained']} | {a['off']['sustained']} |")
    L.append("\nThe 'without ads' column assumes nothing else changes. In practice an ad-free free tier may retain "
             "and convert slightly better, which this model does not capture.\n")
    # Sensitivity
    L.append("## Sensitivities\n")
    L.append("**Base case, EBIT in month 36, by install-to-paid conversion (rows) and annual price (columns).** "
             f"Monthly price moves with the annual price ({sens['ratio']:.3f}x).\n")
    L.append("| Install-to-paid | " + " | ".join(f"${p:.2f}/yr" for p in sens["prices"]) + " |")
    L.append("|---|" + "---:|" * len(sens["prices"]))
    for cv, row in zip(sens["conv"], sens["grid1"]):
        L.append(f"| {_pct(cv)} | " + " | ".join(_usd(x) for x in row) + " |")
    L.append("\n**Ads eCPM multiplier (all placements), FY3.**\n")
    L.append("| Scenario | eCPM x | Ad revenue FY3 | Ads share | EBIT FY3 |")
    L.append("|---|---:|---:|---:|---:|")
    for s in SCENARIOS:
        for g in sens["grid2"][s]:
            if g["mult"] in (0.5, 1.0, 2.0, 3.0):
                L.append(f"| {s} | {g['mult']:.2f}x | {_usd(g['ads_fy3'])} | {_pct(g['share_fy3'])} | {_usd(g['ebit_fy3'])} |")
    L.append("\n**Tornado: base FY3 EBIT change for a -20% / +20% move in one driver (top 10).**\n")
    L.append("| Driver | -20% | +20% |")
    L.append("|---|---:|---:|")
    for t in sens["tornado"][:10]:
        L.append(f"| {t['label']} (`{t['key']}`) | {_usd(t['low'])} | {_usd(t['high'])} |")
    L.append("")
    # Takeaways
    L.append("## Five takeaways\n")
    for i, t in enumerate(takeaways(res, sens), 1):
        L.append(f"{i}. {t}")
    L.append("")
    # Verification
    L.append("## Formula check\n")
    if ver.get("status") == "ok":
        L.append(f"All {ver['cells']:,} formula cells in the workbook were recalculated by LibreOffice "
                 f"({ver['lo_version']}) headless and matched the Python model to within 1e-6 (relative). "
                 f"Formula errors: {ver['formula_errors']}.")
    elif ver.get("status") == "mismatch":
        L.append(f"WARNING: {ver['mismatches']} of {ver['cells']} cells differ from the Python model. "
                 f"Examples: {ver['examples'][:5]}")
    else:
        L.append(f"Not verified with LibreOffice: {ver.get('reason')}. Python values are still correct; "
                 "the workbook recalculates when opened in Excel or Google Sheets.")
    L.append("")
    path.write_text("\n".join(L))


def takeaways(res, sens) -> list[str]:
    b, be, bu = res["base"], res["bear"], res["bull"]
    kb = b["kpi"]
    share = kb["Ads as share of revenue, FY3"]
    word = ("a supplement, not a business model" if share < 0.15 else
            "a meaningful second line" if share < 0.35 else "a core revenue pillar")
    a = sens["ads"]["base"]
    rev3 = b["annual"]["TOTAL REVENUE"][2]
    subs3 = b["annual"]["Subscriptions & in-app, net"][2]
    t = []
    t.append(f"Ads are {_pct(share)} of base-case FY3 revenue ({_k(kb['Ad revenue, FY3'])} of {_k(rev3)}): {word}. "
             f"Switching ads off moves sustained break-even from {_mo(a['on']['sustained'])} to {_mo(a['off']['sustained'])}. "
             f"Even at 2x the assumed eCPMs, ads stay at "
             f"{_pct(next(g['share_fy3'] for g in sens['grid2']['base'] if g['mult'] == 2.0))} of revenue.")
    g = sens["grid1"]
    i25, i30 = sens["conv"].index(0.025), sens["conv"].index(0.030)
    j = sens["prices"].index(79.99)
    t.append(f"Subscriptions carry the business: {_pct(subs3 / rev3 if rev3 else 0)} of base FY3 revenue after the 15% store fee. "
             f"Each half-point of install-to-paid (2.5% to 3.0%) adds about {_k(g[i30][j] - g[i25][j])} a month "
             f"to month-36 operating income. Conversion is the lever to work on first.")
    t.append(f"Base case: break-even in {_mo(kb['Break-even month (EBIT >= 0 from then on)'])} "
             f"(first positive month {kb['First month with EBIT >= 0']}), with a maximum cash need of "
             f"{_usd(kb['Max cash need (deepest cumulative cash)'])} and FY3 operating income of "
             f"{_usd(b['annual']['OPERATING INCOME (EBIT)'][2])}. Bear: break-even "
             f"{_mo(be['kpi']['Break-even month (EBIT >= 0 from then on)'])}, cash need "
             f"{_usd(be['kpi']['Max cash need (deepest cumulative cash)'])}. Bull: break-even "
             f"{_mo(bu['kpi']['Break-even month (EBIT >= 0 from then on)'])}. None of this pays the founder "
             "(switch `founder_salary_on` to 1 to see the $5k/month version).")
    t.append(f"Paid acquisition does not pay back at freemium conversion. Apple Search Ads at "
             f"${b['p']['asa_cpi']:.2f} per install costs {_usd(kb['CAC per payer: Apple Search Ads (CPI / install-to-paid)'])} "
             f"per payer against an LTV of {_usd(kb['LTV per payer (net of store fee, refunds, variable cost)'])} "
             f"(LTV/CAC {kb['LTV / CAC: Apple Search Ads']:.2f}x; creators {kb['LTV / CAC: creators']:.2f}x). "
             f"Keep paid spend as a test budget until install-to-paid is near "
             f"{_pct(b['p']['asa_cpi'] / kb['LTV per payer (net of store fee, refunds, variable cost)'])}.")
    top = sens["tornado"][:3]
    an = b["annual"]
    cogs = {k: an[k][2] for k in ("Data licensing", "Plaid / aggregation", "Hosting", "LLM tutor", "RevenueCat")}
    big = max(cogs, key=cogs.get)
    t.append("The three biggest levers on base FY3 operating income (a -20% / +20% move) are "
             + "; ".join(f"{x['label'].lower()} ({_k(x['low'])} / +{_k(x['high'])})" for x in top)
             + f". On costs, COGS is {_pct(an['Total COGS'][2] / rev3 if rev3 else 0)} of FY3 revenue and the largest "
             f"line is {big.lower()} at {_k(cogs[big])} ({_pct(cogs[big] / rev3 if rev3 else 0)} of revenue), even with "
             "free users capped at one linked bank. Get a real Plaid quote before launching the Money Hub.")
    return t


def write_csv(res, path: Path):
    keys = ["inst_total", "mau_total", "subs_paid", "rev_subs_net", "rev_ads", "rev_aff", "rev_b2b", "rev_total",
            "cogs_total", "gross_profit", "opex_total", "ebit", "cash_flow", "cash_cum"]
    with open(path, "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["scenario", "month", "fiscal_year"] + keys)
        for s in SCENARIOS:
            v = res[s]["v"]
            for m in range(1, MONTHS + 1):
                w.writerow([s, m, (m - 1) // 12 + 1] + [round(v[k][m], 2) for k in keys])


# =============================================================================
# 9. CLI
# =============================================================================
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--assumptions", default=str(HERE / "assumptions.yaml"))
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--no-verify", action="store_true", help="skip the LibreOffice recalculation check")
    args = ap.parse_args(argv)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    A = load_assumptions(args.assumptions)
    res = run_all(A)
    sens = sensitivities(A)
    xlsx = out / "Tenbagger_Model.xlsx"
    expect = build_workbook(A, res, sens, xlsx)
    ver = {"status": "skipped", "reason": "--no-verify"} if args.no_verify else verify_with_libreoffice(xlsx, expect)
    write_summary(res, sens, ver, out / "summary.md")
    write_csv(res, out / "pnl_chart.csv")
    print(f"Wrote {xlsx}, {out / 'summary.md'}, {out / 'pnl_chart.csv'}")
    for s in SCENARIOS:
        a = res[s]["annual"]
        k = res[s]["kpi"]
        print(f"{s:5s} revenue FY1-3 " + " / ".join(_k(x) for x in a["TOTAL REVENUE"][:3])
              + " | ads " + " / ".join(_k(x) for x in a["Advertising"][:3])
              + " | EBIT " + " / ".join(_k(x) for x in a["OPERATING INCOME (EBIT)"][:3])
              + f" | break-even {k['Break-even month (EBIT >= 0 from then on)']}"
              + f" | max cash need {_k(k['Max cash need (deepest cumulative cash)'])}")
    print("Verification:", {k: v for k, v in ver.items() if k != "examples"})
    if ver.get("status") == "mismatch":
        for e in ver["examples"]:
            print("  mismatch", e)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
