"""Metric registry: every number a question uses is computed here from companies.json.

Each Metric knows how to compute its value from a company (returning None when the
inputs are missing or meaningless), how to show the arithmetic with the real numbers,
which common mistakes make good distractors, and a plain-English gloss.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from statistics import mean, median
from typing import Callable, Optional

from .company import Co
from .fmt import fmt, mult, pct, usd

REQUIRED_RETURN = 0.09   # discount rate / required return used in units 7-8
TERMINAL_GROWTH = 0.025  # perpetual growth in DCFs
DCF_YEARS = 5


@dataclass
class Calc:
    value: float | bool
    arith: str                       # arithmetic with the actual numbers, ends in "= result"
    inputs: dict = field(default_factory=dict)
    params: dict = field(default_factory=dict)
    ctx: dict = field(default_factory=dict)


@dataclass
class Metric:
    key: str
    label: str
    unit: str                         # percent | usd | usd_share | multiple | bool
    formula: str                      # machine-ish formula, quoted in source.formula
    pretty: str                       # human formula for explanations
    compute: Callable[[Co], Optional[Calc]]
    given: Callable[[Co, Calc], str] = lambda c, k: ""
    ask: str = ""
    mistakes: Callable[[Co, Calc], list] = lambda c, k: []
    gloss: Callable[[Co, Calc], str] = lambda c, k: ""
    statement: Callable[[Co, Calc], str] | None = None  # bool metrics only
    comparable: bool = True           # safe to compare across companies
    fields: tuple = ()                # companies.json inputs (for docs / source.metrics)

    @property
    def json_unit(self) -> str:
        return {"percent": "percent", "usd": "usd", "usd_share": "usd", "multiple": "multiple"}.get(self.unit, "none")

    def f(self, v: float) -> str:
        return fmt(v, self.unit)


REGISTRY: dict[str, Metric] = {}


def metric(**kw) -> Metric:
    m = Metric(**kw)
    REGISTRY[m.key] = m
    return m


def pos(*vals) -> bool:
    return all(v is not None and v > 0 for v in vals)


def have(*vals) -> bool:
    return all(v is not None for v in vals)


def cents(v: float) -> str:
    return f"{v * 100:.0f} cents"


def fy(c: Co) -> str:
    return f"FY{c.fy}"


# --------------------------------------------------------------------- unit 1
def _revenue(c: Co):
    r = c.f("revenue")
    if not pos(r):
        return None
    return Calc(r, usd(r), {"revenue": r})


metric(key="revenue", label="revenue", unit="usd", formula="revenue", pretty="total sales for the year",
       fields=("revenue",), compute=_revenue,
       given=lambda c, k: f"{c.label} reported {fy(c)} revenue of {k.value:,.0f} dollars.",
       ask="Which is the same amount written the short way?",
       mistakes=lambda c, k: [("dropping a zero", k.value / 10), ("adding a zero", k.value * 10),
                              ("confusing billions with millions", k.value / 1000)],
       gloss=lambda c, k: "M = million (1,000,000), B = billion (1,000,000,000), T = trillion (1,000 billion).")


def _rev_growth(c: Co):
    if c.fy is None:
        return None
    a, b = c.hist_at("revenue", c.fy - 1), c.hist_at("revenue", c.fy)
    if not pos(a, b):
        return None
    g = b / a - 1
    return Calc(g, f"{usd(b)} ÷ {usd(a)} − 1 = {pct(g)}", {"revenue_prior": a, "revenue": b},
                ctx={"a": a, "b": b})


metric(key="revenue_growth_yoy", label="revenue growth", unit="percent", formula="revenue_fy / revenue_fy-1 - 1",
       pretty="this year's revenue ÷ last year's revenue − 1", fields=("history.revenue",), compute=_rev_growth,
       given=lambda c, k: f"{c.label}'s revenue went from {usd(k.ctx['a'])} in FY{c.fy - 1} to {usd(k.ctx['b'])} in {fy(c)}.",
       ask="By what percentage did revenue grow?",
       mistakes=lambda c, k: [("dividing the change by the new year instead of the old", (k.ctx['b'] - k.ctx['a']) / k.ctx['b']),
                              ("forgetting to subtract 1", k.ctx['b'] / k.ctx['a']),
                              ("dividing the wrong way round", k.ctx['a'] / k.ctx['b'] - 1)],
       gloss=lambda c, k: (f"Revenue {'grew' if k.value >= 0 else 'shrank'} by {pct(abs(k.value))} in one year."))


def _cagr(c: Co):
    if c.fy is None:
        return None
    a, b = c.hist_at("revenue", c.fy - 3), c.hist_at("revenue", c.fy)
    if not pos(a, b):
        return None
    g = (b / a) ** (1 / 3) - 1
    return Calc(g, f"({usd(b)} ÷ {usd(a)})^(1/3) − 1 = {pct(g)} per year",
                {"revenue_fy-3": a, "revenue": b}, ctx={"a": a, "b": b})


metric(key="revenue_cagr_3y", label="3-year revenue growth rate (CAGR)", unit="percent",
       formula="(revenue_fy / revenue_fy-3)^(1/3) - 1", pretty="(revenue now ÷ revenue 3 years ago)^(1/3) − 1",
       fields=("history.revenue",), compute=_cagr,
       given=lambda c, k: f"{c.label}'s revenue was {usd(k.ctx['a'])} in FY{c.fy - 3} and {usd(k.ctx['b'])} in {fy(c)}.",
       ask="What was its compound annual growth rate (CAGR) over those 3 years?",
       mistakes=lambda c, k: [("dividing total growth by 3 (ignores compounding)", (k.ctx['b'] / k.ctx['a'] - 1) / 3),
                              ("reporting total growth instead of per-year", k.ctx['b'] / k.ctx['a'] - 1),
                              ("taking the square root instead of the cube root", (k.ctx['b'] / k.ctx['a']) ** 0.5 - 1)],
       gloss=lambda c, k: "Compounding means each year's growth builds on the last, so the per-year rate is less than total growth ÷ 3.")


# --------------------------------------------------------------------- unit 2
def _gp(c: Co):
    r, cost = c.f("revenue"), c.f("cost_of_revenue")
    if not pos(r) or not have(cost) or cost < 0:
        return None
    gp = r - cost
    return Calc(gp, f"{usd(r)} − {usd(cost)} = {usd(gp)}", {"revenue": r, "cost_of_revenue": cost},
                ctx={"r": r, "cost": cost})


metric(key="gross_profit", label="gross profit", unit="usd", formula="revenue - cost_of_revenue",
       pretty="revenue − cost of revenue", fields=("revenue", "cost_of_revenue"), compute=_gp,
       given=lambda c, k: f"In {fy(c)}, {c.label} had revenue of {usd(k.ctx['r'])} and cost of revenue of {usd(k.ctx['cost'])}.",
       ask="What was its gross profit?",
       mistakes=lambda c, k: [("adding cost instead of subtracting it", k.ctx['r'] + k.ctx['cost']),
                              ("reporting the cost itself", k.ctx['cost']),
                              ("using net income", c.f("net_income"))],
       gloss=lambda c, k: "Gross profit is what's left from sales after paying for the products or services themselves.")


def _ratio_calc(num_key: str, num: float | None, rev: float | None, num_label: str):
    if not have(num) or not pos(rev):
        return None
    v = num / rev
    return Calc(v, f"{usd(num)} ÷ {usd(rev)} = {pct(v)}", {num_key: num, "revenue": rev}, ctx={"n": num, "r": rev})


def _gm(c: Co):
    gp = c.gross_profit()
    return _ratio_calc("gross_profit", gp, c.f("revenue"), "gross profit")


def _margin_mistakes(c: Co, k: Calc, skip: str):
    r = k.ctx["r"]
    gp, oi, ni = c.gross_profit(), c.f("operating_income"), c.f("net_income")
    opts = {"gross": ("using gross profit", gp), "op": ("using operating income", oi),
            "net": ("using net income", ni)}
    out = [(d, v / r) for key, (d, v) in opts.items() if key != skip and v is not None]
    return out


metric(key="gross_margin", label="gross margin", unit="percent", formula="gross_profit / revenue",
       pretty="gross profit ÷ revenue", fields=("gross_profit", "revenue"), compute=_gm,
       given=lambda c, k: f"In {fy(c)}, {c.label} had revenue of {usd(k.ctx['r'])} and gross profit of {usd(k.ctx['n'])}.",
       ask="What was its gross margin?",
       mistakes=lambda c, k: _margin_mistakes(c, k, "gross") + (
           [("using cost of revenue instead of gross profit", c.f("cost_of_revenue") / k.ctx['r'])]
           if c.f("cost_of_revenue") is not None else []),
       gloss=lambda c, k: f"Out of every $1 of sales, {c.name} kept about {cents(k.value)} after paying for what it sold.")


metric(key="operating_margin", label="operating margin", unit="percent", formula="operating_income / revenue",
       pretty="operating income ÷ revenue", fields=("operating_income", "revenue"),
       compute=lambda c: _ratio_calc("operating_income", c.f("operating_income"), c.f("revenue"), "operating income"),
       given=lambda c, k: f"In {fy(c)}, {c.label} had revenue of {usd(k.ctx['r'])} and operating income of {usd(k.ctx['n'])}.",
       ask="What was its operating margin?",
       mistakes=lambda c, k: _margin_mistakes(c, k, "op") + (
           [("dividing by gross profit instead of revenue", k.ctx['n'] / c.gross_profit())]
           if pos(c.gross_profit()) else []),
       gloss=lambda c, k: (f"After product costs and running the business (R&D, sales, admin), {c.name} kept about "
                           f"{cents(k.value)} per $1 of sales." if k.value >= 0 else
                           f"{c.name} spent more running the business than its gross profit, so it lost about "
                           f"{cents(-k.value)} per $1 of sales at the operating level."))


metric(key="net_margin", label="net margin", unit="percent", formula="net_income / revenue",
       pretty="net income ÷ revenue", fields=("net_income", "revenue"),
       compute=lambda c: _ratio_calc("net_income", c.f("net_income"), c.f("revenue"), "net income"),
       given=lambda c, k: f"In {fy(c)}, {c.label} had revenue of {usd(k.ctx['r'])} and net income of {usd(k.ctx['n'])}.",
       ask="What was its net margin?",
       mistakes=lambda c, k: _margin_mistakes(c, k, "net") + (
           [("dividing by gross profit instead of revenue", k.ctx['n'] / c.gross_profit())]
           if pos(c.gross_profit()) else []),
       gloss=lambda c, k: (f"After every cost, interest and tax, {c.name} kept about {cents(k.value)} of each $1 of sales."
                           if k.value >= 0 else f"{c.name} lost about {cents(-k.value)} on each $1 of sales after all costs."))


def _opex(c: Co):
    gp, oi, r = c.gross_profit(), c.f("operating_income"), c.f("revenue")
    if not have(gp, oi) or not pos(r) or gp - oi <= 0:
        return None
    v = (gp - oi) / r
    return Calc(v, f"({usd(gp)} − {usd(oi)}) ÷ {usd(r)} = {pct(v)}",
                {"gross_profit": gp, "operating_income": oi, "revenue": r}, ctx={"gp": gp, "oi": oi, "r": r})


metric(key="opex_ratio", label="operating expenses as a share of revenue", unit="percent",
       formula="(gross_profit - operating_income) / revenue", pretty="(gross profit − operating income) ÷ revenue",
       fields=("gross_profit", "operating_income", "revenue"), compute=_opex,
       given=lambda c, k: (f"In {fy(c)}, {c.label} had revenue of {usd(k.ctx['r'])}, gross profit of {usd(k.ctx['gp'])} "
                           f"and operating income of {usd(k.ctx['oi'])}."),
       ask="What share of revenue went to operating expenses (R&D, sales, admin)?",
       mistakes=lambda c, k: [("reporting gross margin", k.ctx['gp'] / k.ctx['r']),
                              ("reporting operating margin", k.ctx['oi'] / k.ctx['r']),
                              ("dividing by gross profit instead of revenue", (k.ctx['gp'] - k.ctx['oi']) / k.ctx['gp'])],
       gloss=lambda c, k: f"Gross margin minus operating margin is the slice of each sales dollar ({cents(k.value)}) spent running the business.")


# --------------------------------------------------------------------- unit 3
def _ni(c: Co):
    ni, r = c.f("net_income"), c.f("revenue")
    if not have(ni) or not pos(r):
        return None
    m = ni / r
    return Calc(ni, f"{usd(r)} × {pct(m)} = {usd(ni)}", {"revenue": r, "net_income": ni}, ctx={"r": r, "m": m})


metric(key="net_income", label="net income", unit="usd", formula="net_income", pretty="revenue × net margin",
       fields=("net_income", "revenue"), compute=_ni,
       given=lambda c, k: f"In {fy(c)}, {c.label} had revenue of {usd(k.ctx['r'])} and a net margin of {pct(k.ctx['m'])}.",
       ask="Roughly how much net income (profit after all costs and taxes) did it earn?",
       mistakes=lambda c, k: [("using 1 − net margin", k.ctx['r'] * (1 - k.ctx['m'])),
                              ("reporting gross profit", c.gross_profit()),
                              ("reporting operating income", c.f("operating_income"))],
       gloss=lambda c, k: "Net income is the bottom line of the income statement: revenue minus every cost, interest and tax.")


def _profitable(c: Co):
    ni, r = c.f("net_income"), c.f("revenue")
    if not have(ni) or not pos(r) or abs(ni) < 0.005 * r:
        return None
    return Calc(ni > 0, f"net income was {usd(ni)}", {"net_income": ni})


metric(key="profitable", label="profitability", unit="bool", formula="net_income > 0", pretty="net income above zero",
       fields=("net_income",), compute=_profitable, comparable=False,
       statement=lambda c, k: f"{c.label} reported a profit (positive net income) in {fy(c)}.",
       gloss=lambda c, k: "A negative bottom line is called a net loss.")


def _eps(c: Co):
    ni, sh = c.f("net_income"), c.f("shares_diluted")
    if not have(ni) or not pos(sh):
        return None
    v = ni / sh
    return Calc(v, f"{usd(ni)} ÷ {sh / 1e9:,.2f}B shares = {usd(v, True)}", {"net_income": ni, "shares_diluted": sh},
                ctx={"ni": ni, "sh": sh})


metric(key="eps_calc", label="earnings per share (EPS)", unit="usd_share", formula="net_income / shares_diluted",
       pretty="net income ÷ diluted shares", fields=("net_income", "shares_diluted"), compute=_eps, comparable=False,
       given=lambda c, k: f"In {fy(c)}, {c.label} earned net income of {usd(k.ctx['ni'])} with {k.ctx['sh'] / 1e9:,.2f} billion diluted shares.",
       ask="What was its earnings per share?",
       mistakes=lambda c, k: [("dividing revenue by shares", c.f("revenue") / k.ctx['sh'] if c.f("revenue") else None),
                              ("dividing operating income by shares", c.f("operating_income") / k.ctx['sh'] if c.f("operating_income") is not None else None),
                              ("dividing free cash flow by shares", c.f("free_cash_flow") / k.ctx['sh'] if c.f("free_cash_flow") is not None else None)],
       gloss=lambda c, k: "EPS is one share's slice of the year's profit. Different companies have very different share counts, so compare EPS over time, not across companies.")


def _eps_growth(c: Co):
    if c.fy is None:
        return None
    a, b = c.hist_at("eps_diluted", c.fy - 1), c.hist_at("eps_diluted", c.fy)
    if not pos(a) or b is None:
        return None
    g = b / a - 1
    return Calc(g, f"{usd(b, True)} ÷ {usd(a, True)} − 1 = {pct(g)}", {"eps_prior": a, "eps": b}, ctx={"a": a, "b": b})


metric(key="eps_growth_yoy", label="EPS growth", unit="percent", formula="eps_fy / eps_fy-1 - 1",
       pretty="this year's EPS ÷ last year's EPS − 1", fields=("history.eps_diluted",), compute=_eps_growth,
       given=lambda c, k: f"{c.label}'s diluted EPS went from {usd(k.ctx['a'], True)} in FY{c.fy - 1} to {usd(k.ctx['b'], True)} in {fy(c)}.",
       ask="By what percentage did EPS change?",
       mistakes=lambda c, k: [("dividing the change by the new year", (k.ctx['b'] - k.ctx['a']) / k.ctx['b'] if k.ctx['b'] else None),
                              ("forgetting to subtract 1", k.ctx['b'] / k.ctx['a']),
                              ("dividing the wrong way round", k.ctx['a'] / k.ctx['b'] - 1 if k.ctx['b'] else None)],
       gloss=lambda c, k: "EPS can grow faster than net income when a company buys back shares, because the profit is split across fewer shares.")


def _tax(c: Co):
    t, p = c.f("income_tax"), c.f("pretax_income")
    if not pos(p) or not have(t) or not (0 <= t / p <= 0.6):
        return None
    v = t / p
    return Calc(v, f"{usd(t)} ÷ {usd(p)} = {pct(v)}", {"income_tax": t, "pretax_income": p}, ctx={"t": t, "p": p})


metric(key="tax_rate", label="effective tax rate", unit="percent", formula="income_tax / pretax_income",
       pretty="income tax ÷ pre-tax income", fields=("income_tax", "pretax_income"), compute=_tax,
       given=lambda c, k: f"In {fy(c)}, {c.label} had pre-tax income of {usd(k.ctx['p'])} and paid income tax of {usd(k.ctx['t'])}.",
       ask="What was its effective tax rate?",
       mistakes=lambda c, k: [("dividing tax by revenue", k.ctx['t'] / c.f("revenue") if pos(c.f("revenue")) else None),
                              ("dividing tax by net income", k.ctx['t'] / c.f("net_income") if pos(c.f("net_income")) else None),
                              ("using the 21% US statutory rate", 0.21)],
       gloss=lambda c, k: "The effective rate is what the company actually paid; it differs from the 21% US headline rate because of foreign profits, credits and one-offs.")


# --------------------------------------------------------------------- unit 4
def _conv(c: Co):
    ocf, ni = c.f("operating_cash_flow"), c.f("net_income")
    if not pos(ocf, ni):
        return None
    v = ocf / ni
    return Calc(v, f"{usd(ocf)} ÷ {usd(ni)} = {mult(v)}", {"operating_cash_flow": ocf, "net_income": ni},
                ctx={"ocf": ocf, "ni": ni})


metric(key="cash_conversion", label="cash conversion (operating cash flow ÷ net income)", unit="multiple",
       formula="operating_cash_flow / net_income", pretty="operating cash flow ÷ net income",
       fields=("operating_cash_flow", "net_income"), compute=_conv,
       given=lambda c, k: f"In {fy(c)}, {c.label} reported net income of {usd(k.ctx['ni'])} and operating cash flow of {usd(k.ctx['ocf'])}.",
       ask="What was its cash conversion (operating cash flow ÷ net income)?",
       mistakes=lambda c, k: [("dividing the wrong way round", k.ctx['ni'] / k.ctx['ocf']),
                              ("using free cash flow instead", c.f("free_cash_flow") / k.ctx['ni'] if c.f("free_cash_flow") is not None else None),
                              ("dividing by operating income", k.ctx['ocf'] / c.f("operating_income") if pos(c.f("operating_income")) else None)],
       gloss=lambda c, k: ("Above 1x means the business brought in more cash than its reported profit (often thanks to non-cash "
                           "costs like depreciation)." if k.value >= 1 else
                           "Below 1x means reported profit was not fully backed by cash this year (e.g. money tied up in inventory or receivables)."))


def _ocf_gt_ni(c: Co):
    ocf, ni = c.f("operating_cash_flow"), c.f("net_income")
    if not have(ocf, ni) or abs(ocf - ni) < 0.1 * max(abs(ni), abs(ocf)):
        return None
    return Calc(ocf > ni, f"operating cash flow {usd(ocf)} vs. net income {usd(ni)}",
                {"operating_cash_flow": ocf, "net_income": ni})


metric(key="ocf_gt_ni", label="cash vs. profit", unit="bool", formula="operating_cash_flow > net_income",
       pretty="operating cash flow compared with net income", fields=("operating_cash_flow", "net_income"),
       compute=_ocf_gt_ni, comparable=False,
       statement=lambda c, k: f"{c.label}'s operating cash flow was larger than its net income in {fy(c)}.",
       gloss=lambda c, k: "Net income follows accounting rules; operating cash flow counts the cash that actually came in.")


def _fcf(c: Co):
    ocf, capex = c.f("operating_cash_flow"), c.f("capex")
    if not have(ocf, capex) or capex < 0:
        return None
    v = ocf - capex
    return Calc(v, f"{usd(ocf)} − {usd(capex)} = {usd(v)}", {"operating_cash_flow": ocf, "capex": capex},
                ctx={"ocf": ocf, "capex": capex})


metric(key="free_cash_flow", label="free cash flow", unit="usd", formula="operating_cash_flow - capex",
       pretty="operating cash flow − capital expenditures", fields=("operating_cash_flow", "capex"), compute=_fcf,
       given=lambda c, k: f"In {fy(c)}, {c.label} generated {usd(k.ctx['ocf'])} of operating cash flow and spent {usd(k.ctx['capex'])} on capital expenditures.",
       ask="What was its free cash flow?",
       mistakes=lambda c, k: [("adding capex instead of subtracting it", k.ctx['ocf'] + k.ctx['capex']),
                              ("forgetting capex", k.ctx['ocf']),
                              ("starting from net income", c.f("net_income") - k.ctx['capex'] if c.f("net_income") is not None else None)],
       gloss=lambda c, k: ("Free cash flow is the cash left after keeping the business running and growing; it can fund dividends, buybacks, debt paydown or savings."
                           if k.value >= 0 else "Negative free cash flow means spending on the business exceeded the cash it produced, so the gap had to come from savings or borrowing."))


def _fcf_margin(c: Co):
    k = _fcf(c)
    r = c.f("revenue")
    if k is None or not pos(r):
        return None
    v = k.value / r
    return Calc(v, f"({usd(k.ctx['ocf'])} − {usd(k.ctx['capex'])}) ÷ {usd(r)} = {usd(k.value)} ÷ {usd(r)} = {pct(v)}",
                {"operating_cash_flow": k.ctx['ocf'], "capex": k.ctx['capex'], "revenue": r},
                ctx={**k.ctx, "r": r, "fcf": k.value})


metric(key="fcf_margin", label="FCF margin", unit="percent", formula="(operating_cash_flow - capex) / revenue",
       pretty="free cash flow ÷ revenue", fields=("operating_cash_flow", "capex", "revenue"), compute=_fcf_margin,
       given=lambda c, k: f"In {fy(c)}, {c.label} had revenue of {usd(k.ctx['r'])}, operating cash flow of {usd(k.ctx['ocf'])} and capex of {usd(k.ctx['capex'])}.",
       ask="What was its free-cash-flow margin?",
       mistakes=lambda c, k: [("forgetting to subtract capex", k.ctx['ocf'] / k.ctx['r']),
                              ("using net income", c.f("net_income") / k.ctx['r'] if c.f("net_income") is not None else None),
                              ("reporting capex ÷ revenue", k.ctx['capex'] / k.ctx['r'])],
       gloss=lambda c, k: f"Each $1 of sales turned into about {cents(k.value)} of free cash." if k.value >= 0 else
       f"Each $1 of sales came with about {cents(-k.value)} of cash burn after investment.")


def _capex_int(c: Co):
    capex, r = c.f("capex"), c.f("revenue")
    if not pos(capex, r):
        return None
    v = capex / r
    return Calc(v, f"{usd(capex)} ÷ {usd(r)} = {pct(v)}", {"capex": capex, "revenue": r}, ctx={"capex": capex, "r": r})


metric(key="capex_intensity", label="capex intensity (capex ÷ revenue)", unit="percent", formula="capex / revenue",
       pretty="capital expenditures ÷ revenue", fields=("capex", "revenue"), compute=_capex_int,
       given=lambda c, k: f"In {fy(c)}, {c.label} had revenue of {usd(k.ctx['r'])} and capital expenditures of {usd(k.ctx['capex'])}.",
       ask="What was its capex intensity (capex ÷ revenue)?",
       mistakes=lambda c, k: [("dividing capex by operating cash flow", k.ctx['capex'] / c.f("operating_cash_flow") if pos(c.f("operating_cash_flow")) else None),
                              ("reporting operating cash flow ÷ revenue", c.f("operating_cash_flow") / k.ctx['r'] if c.f("operating_cash_flow") is not None else None),
                              ("dividing capex by net income", k.ctx['capex'] / c.f("net_income") if pos(c.f("net_income")) else None)],
       gloss=lambda c, k: f"{c.name} reinvested about {cents(k.value)} of every sales dollar in factories, equipment, data centers or stores.")


# --------------------------------------------------------------------- unit 5
def _equity_calc(c: Co):
    a, l = c.f("total_assets"), c.f("total_liabilities")
    if not pos(a) or not have(l) or l < 0:
        return None
    v = a - l
    return Calc(v, f"{usd(a)} − {usd(l)} = {usd(v)}", {"total_assets": a, "total_liabilities": l}, ctx={"a": a, "l": l})


metric(key="equity_calc", label="shareholders' equity", unit="usd", formula="total_assets - total_liabilities",
       pretty="total assets − total liabilities", fields=("total_assets", "total_liabilities"), compute=_equity_calc,
       given=lambda c, k: f"At the end of {fy(c)}, {c.label} had total assets of {usd(k.ctx['a'])} and total liabilities of {usd(k.ctx['l'])}.",
       ask="How much shareholders' equity did it have?",
       mistakes=lambda c, k: [("adding liabilities to assets", k.ctx['a'] + k.ctx['l']),
                              ("reporting liabilities", k.ctx['l']),
                              ("reporting total assets", k.ctx['a'])],
       gloss=lambda c, k: "Assets = liabilities + equity always balances; equity is the owners' claim on what's left after all obligations.")


def _net_cash(c: Co):
    cash, debt = c.f("cash"), c.f("total_debt")
    if not have(cash, debt) or cash < 0 or debt < 0:
        return None
    v = cash - debt
    return Calc(v, f"{usd(cash)} − {usd(debt)} = {usd(v)}", {"cash": cash, "total_debt": debt}, ctx={"cash": cash, "debt": debt})


metric(key="net_cash", label="net cash", unit="usd", formula="cash - total_debt", pretty="cash − total debt",
       fields=("cash", "total_debt"), compute=_net_cash,
       given=lambda c, k: f"At the end of {fy(c)}, {c.label} held {usd(k.ctx['cash'])} of cash and investments and had {usd(k.ctx['debt'])} of total debt.",
       ask="What was its net cash (negative means net debt)?",
       mistakes=lambda c, k: [("adding debt to cash", k.ctx['cash'] + k.ctx['debt']),
                              ("subtracting the wrong way round", k.ctx['debt'] - k.ctx['cash']),
                              ("ignoring debt", k.ctx['cash'])],
       gloss=lambda c, k: (f"{c.name} could repay all its debt from cash and still have {usd(k.value)} left."
                           if k.value >= 0 else f"{c.name} owed {usd(-k.value)} more than it held in cash (net debt)."))


def _nc_pos(c: Co):
    cash, debt = c.f("cash"), c.f("total_debt")
    if not have(cash, debt) or max(cash, debt) <= 0 or abs(cash - debt) < 0.1 * max(cash, debt):
        return None
    return Calc(cash > debt, f"cash {usd(cash)} vs. debt {usd(debt)}", {"cash": cash, "total_debt": debt})


metric(key="net_cash_positive", label="cash vs. debt", unit="bool", formula="cash > total_debt",
       pretty="cash compared with total debt", fields=("cash", "total_debt"), compute=_nc_pos, comparable=False,
       statement=lambda c, k: f"At the end of {fy(c)}, {c.label} held more cash than debt.",
       gloss=lambda c, k: "A company with more cash than debt is in a 'net cash' position; the opposite is 'net debt'.")


def _de(c: Co):
    d, e = c.f("total_debt"), c.f("total_equity")
    if not have(d) or d < 0 or not pos(e):
        return None
    v = d / e
    return Calc(v, f"{usd(d)} ÷ {usd(e)} = {mult(v)}", {"total_debt": d, "total_equity": e}, ctx={"d": d, "e": e})


metric(key="debt_to_equity", label="debt-to-equity", unit="multiple", formula="total_debt / total_equity",
       pretty="total debt ÷ shareholders' equity", fields=("total_debt", "total_equity"), compute=_de,
       given=lambda c, k: f"At the end of {fy(c)}, {c.label} had total debt of {usd(k.ctx['d'])} and shareholders' equity of {usd(k.ctx['e'])}.",
       ask="What was its debt-to-equity ratio?",
       mistakes=lambda c, k: [("dividing the wrong way round", k.ctx['e'] / k.ctx['d'] if k.ctx['d'] else None),
                              ("dividing by debt + equity", k.ctx['d'] / (k.ctx['d'] + k.ctx['e'])),
                              ("dividing by total assets", k.ctx['d'] / c.f("total_assets") if pos(c.f("total_assets")) else None)],
       gloss=lambda c, k: f"For every $1 of equity, {c.name} carried about {usd(k.value, True)} of debt. Buybacks can shrink equity and push this ratio up even when debt is steady.")


def _cr(c: Co):
    a, l = c.f("current_assets"), c.f("current_liabilities")
    if not pos(a, l):
        return None
    v = a / l
    return Calc(v, f"{usd(a)} ÷ {usd(l)} = {mult(v)}", {"current_assets": a, "current_liabilities": l}, ctx={"a": a, "l": l})


metric(key="current_ratio", label="current ratio", unit="multiple", formula="current_assets / current_liabilities",
       pretty="current assets ÷ current liabilities", fields=("current_assets", "current_liabilities"), compute=_cr,
       given=lambda c, k: f"At the end of {fy(c)}, {c.label} had current assets of {usd(k.ctx['a'])} and current liabilities of {usd(k.ctx['l'])}.",
       ask="What was its current ratio?",
       mistakes=lambda c, k: [("dividing the wrong way round", k.ctx['l'] / k.ctx['a']),
                              ("excluding inventory (that's the quick ratio)", (k.ctx['a'] - c.f("inventory")) / k.ctx['l'] if c.f("inventory") is not None else None),
                              ("dividing by total liabilities", k.ctx['a'] / c.f("total_liabilities") if pos(c.f("total_liabilities")) else None)],
       gloss=lambda c, k: "Current means due or usable within a year. Above 1x, short-term assets cover short-term bills; retailers that collect cash fast often run below 1x on purpose.")


# --------------------------------------------------------------------- unit 6
def _roe(c: Co):
    ni, e = c.f("net_income"), c.f("total_equity")
    if not have(ni) or not pos(e):
        return None
    v = ni / e
    return Calc(v, f"{usd(ni)} ÷ {usd(e)} = {pct(v)}", {"net_income": ni, "total_equity": e}, ctx={"ni": ni, "e": e})


metric(key="roe", label="return on equity (ROE)", unit="percent", formula="net_income / total_equity",
       pretty="net income ÷ shareholders' equity", fields=("net_income", "total_equity"), compute=_roe,
       given=lambda c, k: f"In {fy(c)}, {c.label} earned net income of {usd(k.ctx['ni'])}, and its shareholders' equity was {usd(k.ctx['e'])}.",
       ask="What was its return on equity?",
       mistakes=lambda c, k: [("dividing by total assets (that's ROA)", k.ctx['ni'] / c.f("total_assets") if pos(c.f("total_assets")) else None),
                              ("dividing by revenue (that's net margin)", k.ctx['ni'] / c.f("revenue") if pos(c.f("revenue")) else None),
                              ("using operating income", c.f("operating_income") / k.ctx['e'] if c.f("operating_income") is not None else None)],
       gloss=lambda c, k: f"Each $1 of shareholders' equity on the books produced about {cents(k.value)} of profit in the year.")


def _roa(c: Co):
    ni, a = c.f("net_income"), c.f("total_assets")
    if not have(ni) or not pos(a):
        return None
    v = ni / a
    return Calc(v, f"{usd(ni)} ÷ {usd(a)} = {pct(v)}", {"net_income": ni, "total_assets": a}, ctx={"ni": ni, "a": a})


metric(key="roa", label="return on assets (ROA)", unit="percent", formula="net_income / total_assets",
       pretty="net income ÷ total assets", fields=("net_income", "total_assets"), compute=_roa,
       given=lambda c, k: f"In {fy(c)}, {c.label} earned net income of {usd(k.ctx['ni'])} on total assets of {usd(k.ctx['a'])}.",
       ask="What was its return on assets?",
       mistakes=lambda c, k: [("dividing by equity (that's ROE)", k.ctx['ni'] / c.f("total_equity") if pos(c.f("total_equity")) else None),
                              ("dividing by revenue", k.ctx['ni'] / c.f("revenue") if pos(c.f("revenue")) else None),
                              ("using operating income", c.f("operating_income") / k.ctx['a'] if c.f("operating_income") is not None else None)],
       gloss=lambda c, k: "ROA ignores how the assets were financed, so it isn't boosted by debt the way ROE can be.")


def tax_rate_for_roic(c: Co) -> tuple[float, str]:
    t, p = c.f("income_tax"), c.f("pretax_income")
    if have(t) and pos(p):
        raw = t / p
        return min(max(raw, 0.0), 0.35), f"tax rate {usd(t)} ÷ {usd(p)} = {pct(raw)}" + (
            f", clamped to {pct(min(max(raw, 0.0), 0.35))}" if not 0 <= raw <= 0.35 else "")
    return 0.21, "tax rate defaults to 21% (pre-tax income not positive)"


def _ic(c: Co):
    d, e, cash = c.f("total_debt"), c.f("total_equity"), c.f("cash")
    if not have(d, e, cash):
        return None
    v = d + e - cash
    if v <= 0:
        return None
    return Calc(v, f"{usd(d)} + {usd(e)} − {usd(cash)} = {usd(v)}", {"total_debt": d, "total_equity": e, "cash": cash},
                ctx={"d": d, "e": e, "cash": cash})


metric(key="invested_capital", label="invested capital", unit="usd", formula="total_debt + total_equity - cash",
       pretty="total debt + shareholders' equity − cash", fields=("total_debt", "total_equity", "cash"), compute=_ic,
       given=lambda c, k: f"At the end of {fy(c)}, {c.label} had total debt of {usd(k.ctx['d'])}, shareholders' equity of {usd(k.ctx['e'])} and cash of {usd(k.ctx['cash'])}.",
       ask="How much invested capital did it have (debt + equity − cash)?",
       mistakes=lambda c, k: [("adding cash instead of subtracting it", k.ctx['d'] + k.ctx['e'] + k.ctx['cash']),
                              ("forgetting to subtract cash", k.ctx['d'] + k.ctx['e']),
                              ("leaving out debt", k.ctx['e'] - k.ctx['cash'])],
       gloss=lambda c, k: "Invested capital is the money lenders and owners have put to work in the operations, net of idle cash.")


def _roic(c: Co):
    ic, oi = _ic(c), c.f("operating_income")
    if ic is None or not have(oi):
        return None
    t, tnote = tax_rate_for_roic(c)
    v = oi * (1 - t) / ic.value
    return Calc(v, f"{usd(oi)} × (1 − {pct(t)}) ÷ {usd(ic.value)} = {pct(v)} ({tnote}; invested capital {ic.arith})",
                {"operating_income": oi, "income_tax": c.f("income_tax"), "pretax_income": c.f("pretax_income"),
                 **ic.inputs}, params={"tax_rate": t}, ctx={"oi": oi, "t": t, "ic": ic.value, **ic.ctx})


metric(key="roic", label="return on invested capital (ROIC)", unit="percent",
       formula="operating_income * (1 - tax_rate) / (total_debt + total_equity - cash)",
       pretty="operating income × (1 − tax rate) ÷ invested capital",
       fields=("operating_income", "income_tax", "pretax_income", "total_debt", "total_equity", "cash"), compute=_roic,
       given=lambda c, k: (f"In {fy(c)}, {c.label} had operating income of {usd(k.ctx['oi'])}, a tax rate of {pct(k.ctx['t'])}, "
                           f"and invested capital (debt + equity − cash) of {usd(k.ctx['ic'])}."),
       ask="What was its ROIC?",
       mistakes=lambda c, k: [("forgetting taxes", k.ctx['oi'] / k.ctx['ic']),
                              ("using ROE instead", c.f("net_income") / c.f("total_equity") if pos(c.f("total_equity")) and c.f("net_income") is not None else None),
                              ("forgetting to subtract cash", k.ctx['oi'] * (1 - k.ctx['t']) / (k.ctx['d'] + k.ctx['e']) if k.ctx['d'] + k.ctx['e'] > 0 else None)],
       gloss=lambda c, k: "ROIC asks how much after-tax operating profit each $1 of capital in the business produces, whether that capital came from lenders or owners.")


def _em(c: Co):
    a, e = c.f("total_assets"), c.f("total_equity")
    if not pos(a, e):
        return None
    v = a / e
    return Calc(v, f"{usd(a)} ÷ {usd(e)} = {mult(v)}", {"total_assets": a, "total_equity": e}, ctx={"a": a, "e": e})


metric(key="equity_multiplier", label="equity multiplier (assets ÷ equity)", unit="multiple",
       formula="total_assets / total_equity", pretty="total assets ÷ shareholders' equity",
       fields=("total_assets", "total_equity"), compute=_em,
       given=lambda c, k: f"At the end of {fy(c)}, {c.label} had total assets of {usd(k.ctx['a'])} and shareholders' equity of {usd(k.ctx['e'])}.",
       ask="What was its equity multiplier (assets ÷ equity)?",
       mistakes=lambda c, k: [("dividing the wrong way round", k.ctx['e'] / k.ctx['a']),
                              ("using liabilities ÷ equity", c.f("total_liabilities") / k.ctx['e'] if c.f("total_liabilities") is not None else None),
                              ("using assets ÷ liabilities", k.ctx['a'] / c.f("total_liabilities") if pos(c.f("total_liabilities")) else None)],
       gloss=lambda c, k: f"ROE = ROA × equity multiplier. At {mult(k.value)}, every 1% of ROA shows up as about {k.value:.1f}% of ROE; debt and buybacks raise the multiplier.")


def _roe_gt_roic(c: Co):
    a, b = _roe(c), _roic(c)
    if a is None or b is None or abs(a.value - b.value) < max(0.01, 0.1 * max(abs(a.value), abs(b.value))):
        return None
    return Calc(a.value > b.value, f"ROE {pct(a.value)} vs. ROIC {pct(b.value)}", {**a.inputs, **b.inputs},
                params=b.params)


metric(key="roe_gt_roic", label="ROE vs. ROIC", unit="bool", formula="roe > roic", pretty="ROE compared with ROIC",
       fields=("net_income", "total_equity", "operating_income", "total_debt", "cash"), compute=_roe_gt_roic,
       comparable=False,
       statement=lambda c, k: f"{c.label}'s ROE was higher than its ROIC in {fy(c)}.",
       gloss=lambda c, k: "ROE only counts owners' money; ROIC counts debt and equity. A small equity base (from debt or buybacks) lifts ROE above ROIC.")


# --------------------------------------------------------------------- unit 7
def _mcap(c: Co):
    p, sh = c.price, c.f("shares_diluted")
    if not pos(p, sh):
        return None
    v = p * sh
    return Calc(v, f"{usd(p, True)} × {sh / 1e9:,.2f}B shares = {usd(v)}", {"price": p, "shares_diluted": sh},
                ctx={"p": p, "sh": sh})


PRICE_NOTE = "Prices are a sample snapshot for teaching; valuations move every day."

metric(key="market_cap", label="market capitalization", unit="usd", formula="price * shares_diluted",
       pretty="share price × diluted shares", fields=("price", "shares_diluted"), compute=_mcap,
       given=lambda c, k: f"{c.label}'s share price was {usd(k.ctx['p'], True)} and it had {k.ctx['sh'] / 1e9:,.2f} billion diluted shares.",
       ask="What was its market capitalization?",
       mistakes=lambda c, k: [("multiplying EPS by shares (that's net income)", c.f("net_income")),
                              ("confusing billions with millions", k.value / 1000),
                              ("reporting revenue", c.f("revenue"))],
       gloss=lambda c, k: "Market cap is what the stock market values all of the company's shares at together. " + PRICE_NOTE)


def _ev(c: Co):
    mc = _mcap(c)
    d, cash = c.f("total_debt"), c.f("cash")
    if mc is None or not have(d, cash):
        return None
    v = mc.value + d - cash
    return Calc(v, f"{usd(mc.value)} + {usd(d)} − {usd(cash)} = {usd(v)}",
                {**mc.inputs, "total_debt": d, "cash": cash}, ctx={"mc": mc.value, "d": d, "cash": cash})


metric(key="enterprise_value", label="enterprise value (EV)", unit="usd", formula="market_cap + total_debt - cash",
       pretty="market cap + total debt − cash", fields=("price", "shares_diluted", "total_debt", "cash"), compute=_ev,
       given=lambda c, k: f"{c.label} had a market cap of {usd(k.ctx['mc'])}, total debt of {usd(k.ctx['d'])} and cash of {usd(k.ctx['cash'])}.",
       ask="What was its enterprise value?",
       mistakes=lambda c, k: [("adding cash instead of subtracting it", k.ctx['mc'] + k.ctx['d'] + k.ctx['cash']),
                              ("flipping the signs of debt and cash", k.ctx['mc'] - k.ctx['d'] + k.ctx['cash']),
                              ("using market cap alone", k.ctx['mc'])],
       gloss=lambda c, k: "EV is roughly the price of the whole business: you'd take on its debt but also get its cash.")


def _pe(c: Co):
    p, e = c.price, c.f("eps_diluted")
    if not pos(p, e):
        return None
    v = p / e
    return Calc(v, f"{usd(p, True)} ÷ {usd(e, True)} = {mult(v)}", {"price": p, "eps_diluted": e}, ctx={"p": p, "e": e})


def _per_share(c: Co, key: str):
    v, sh = c.f(key), c.f("shares_diluted")
    return v / sh if have(v) and pos(sh) else None


metric(key="pe", label="P/E ratio", unit="multiple", formula="price / eps_diluted", pretty="share price ÷ diluted EPS",
       fields=("price", "eps_diluted"), compute=_pe,
       given=lambda c, k: f"{c.label}'s share price was {usd(k.ctx['p'], True)} and its {fy(c)} diluted EPS was {usd(k.ctx['e'], True)}.",
       ask="What was its P/E ratio?",
       mistakes=lambda c, k: [("dividing price by revenue per share (that's P/S)", k.ctx['p'] / _per_share(c, "revenue") if pos(_per_share(c, "revenue")) else None),
                              ("dividing price by free cash flow per share", k.ctx['p'] / _per_share(c, "free_cash_flow") if pos(_per_share(c, "free_cash_flow")) else None),
                              ("dividing price by operating income per share", k.ctx['p'] / _per_share(c, "operating_income") if pos(_per_share(c, "operating_income")) else None)],
       gloss=lambda c, k: f"Buyers of the stock were paying about {usd(k.value, True)} for each $1 of last year's earnings. " + PRICE_NOTE)


def _ey(c: Co):
    p, e = c.price, c.f("eps_diluted")
    if not pos(p) or not have(e):
        return None
    v = e / p
    return Calc(v, f"{usd(e, True)} ÷ {usd(p, True)} = {pct(v)}", {"price": p, "eps_diluted": e}, ctx={"p": p, "e": e})


metric(key="earnings_yield", label="earnings yield", unit="percent", formula="eps_diluted / price",
       pretty="diluted EPS ÷ share price (the P/E flipped over)", fields=("price", "eps_diluted"), compute=_ey,
       given=lambda c, k: f"{c.label}'s share price was {usd(k.ctx['p'], True)} and its {fy(c)} diluted EPS was {usd(k.ctx['e'], True)}.",
       ask="What was its earnings yield?",
       mistakes=lambda c, k: [("using free cash flow ÷ market cap", c.f("free_cash_flow") / _mcap(c).value if _mcap(c) and c.f("free_cash_flow") is not None else None),
                              ("using dividends ÷ market cap", c.f("dividends_paid") / _mcap(c).value if _mcap(c) and c.f("dividends_paid") is not None else None),
                              ("using net margin", c.f("net_income") / c.f("revenue") if pos(c.f("revenue")) and c.f("net_income") is not None else None)],
       gloss=lambda c, k: "Earnings yield lets you line a stock's earnings up against a bond yield or savings rate. " + PRICE_NOTE)


def _ps(c: Co):
    mc, r = _mcap(c), c.f("revenue")
    if mc is None or not pos(r):
        return None
    v = mc.value / r
    return Calc(v, f"{usd(mc.value)} ÷ {usd(r)} = {mult(v)}", {**mc.inputs, "revenue": r}, ctx={"mc": mc.value, "r": r})


metric(key="ps", label="price-to-sales (P/S)", unit="multiple", formula="market_cap / revenue",
       pretty="market cap ÷ revenue", fields=("price", "shares_diluted", "revenue"), compute=_ps,
       given=lambda c, k: f"{c.label} had a market cap of {usd(k.ctx['mc'])} and {fy(c)} revenue of {usd(k.ctx['r'])}.",
       ask="What was its price-to-sales ratio?",
       mistakes=lambda c, k: [("dividing by net income (that's P/E)", k.ctx['mc'] / c.f("net_income") if pos(c.f("net_income")) else None),
                              ("dividing by gross profit", k.ctx['mc'] / c.gross_profit() if pos(c.gross_profit()) else None),
                              ("dividing the wrong way round", k.ctx['r'] / k.ctx['mc'])],
       gloss=lambda c, k: "P/S works even when profits are negative, but a dollar of sales is worth more at a high-margin business than a low-margin one. " + PRICE_NOTE)


def _ev_ebitda(c: Co):
    ev, oi, da = _ev(c), c.f("operating_income"), c.f("d_and_a")
    if ev is None or not have(oi, da) or oi + da <= 0 or ev.value <= 0:
        return None
    eb = oi + da
    v = ev.value / eb
    return Calc(v, f"{usd(ev.value)} ÷ ({usd(oi)} + {usd(da)}) = {usd(ev.value)} ÷ {usd(eb)} = {mult(v)}",
                {**ev.inputs, "operating_income": oi, "d_and_a": da}, ctx={"ev": ev.value, "oi": oi, "da": da, "eb": eb, **ev.ctx})


metric(key="ev_ebitda", label="EV/EBITDA", unit="multiple", formula="enterprise_value / (operating_income + d_and_a)",
       pretty="enterprise value ÷ (operating income + depreciation & amortization)",
       fields=("price", "shares_diluted", "total_debt", "cash", "operating_income", "d_and_a"), compute=_ev_ebitda,
       given=lambda c, k: f"{c.label} had an enterprise value of {usd(k.ctx['ev'])}, operating income of {usd(k.ctx['oi'])} and depreciation & amortization of {usd(k.ctx['da'])}.",
       ask="What was its EV/EBITDA?",
       mistakes=lambda c, k: [("forgetting to add back D&A (EV/EBIT)", k.ctx['ev'] / k.ctx['oi'] if k.ctx['oi'] > 0 else None),
                              ("using market cap instead of EV", k.ctx['mc'] / k.ctx['eb']),
                              ("adding cash to EV instead of subtracting", (k.ctx['mc'] + k.ctx['d'] + k.ctx['cash']) / k.ctx['eb'])],
       gloss=lambda c, k: "EV/EBITDA compares the whole business (debt included) with a rough measure of operating cash earnings, so it is less distorted by debt levels than P/E. " + PRICE_NOTE)


def _fcfy(c: Co):
    mc, fcf = _mcap(c), _fcf(c)
    if mc is None or fcf is None:
        return None
    v = fcf.value / mc.value
    return Calc(v, f"{usd(fcf.value)} ÷ {usd(mc.value)} = {pct(v)}", {**fcf.inputs, **mc.inputs},
                ctx={"fcf": fcf.value, "mc": mc.value})


metric(key="fcf_yield", label="free-cash-flow yield", unit="percent", formula="(operating_cash_flow - capex) / market_cap",
       pretty="free cash flow ÷ market cap", fields=("operating_cash_flow", "capex", "price", "shares_diluted"), compute=_fcfy,
       given=lambda c, k: f"{c.label} generated {usd(k.ctx['fcf'])} of free cash flow in {fy(c)} and had a market cap of {usd(k.ctx['mc'])}.",
       ask="What was its free-cash-flow yield?",
       mistakes=lambda c, k: [("dividing by revenue (that's FCF margin)", k.ctx['fcf'] / c.f("revenue") if pos(c.f("revenue")) else None),
                              ("using net income", c.f("net_income") / k.ctx['mc'] if c.f("net_income") is not None else None),
                              ("using operating cash flow", c.f("operating_cash_flow") / k.ctx['mc'] if c.f("operating_cash_flow") is not None else None)],
       gloss=lambda c, k: "FCF yield is the free cash the business produced per $1 of market value. " + PRICE_NOTE)


def _divy(c: Co):
    mc, dv = _mcap(c), c.f("dividends_paid")
    if mc is None or not pos(dv):
        return None
    v = dv / mc.value
    return Calc(v, f"{usd(dv)} ÷ {usd(mc.value)} = {pct(v)}", {"dividends_paid": dv, **mc.inputs}, ctx={"dv": dv, "mc": mc.value})


metric(key="dividend_yield", label="dividend yield", unit="percent", formula="dividends_paid / market_cap",
       pretty="dividends paid ÷ market cap", fields=("dividends_paid", "price", "shares_diluted"), compute=_divy,
       given=lambda c, k: f"{c.label} paid {usd(k.ctx['dv'])} of dividends in {fy(c)} and had a market cap of {usd(k.ctx['mc'])}.",
       ask="What was its dividend yield?",
       mistakes=lambda c, k: [("dividing by net income (that's the payout ratio)", k.ctx['dv'] / c.f("net_income") if pos(c.f("net_income")) else None),
                              ("dividing by revenue", k.ctx['dv'] / c.f("revenue") if pos(c.f("revenue")) else None),
                              ("using free cash flow yield", c.f("free_cash_flow") / k.ctx['mc'] if c.f("free_cash_flow") is not None else None)],
       gloss=lambda c, k: "Dividend yield is the cash paid out to shareholders per $1 of market value. " + PRICE_NOTE)


def _implied(c: Co):
    ey = _ey(c)
    if ey is None or not pos(ey.value):
        return None
    r = REQUIRED_RETURN
    v = r - ey.value
    pe = 1 / ey.value
    return Calc(v, f"{pct(r)} − (1 ÷ {mult(pe)}) = {pct(r)} − {pct(ey.value)} = {pct(v)}", ey.inputs,
                params={"required_return": r}, ctx={"pe": pe, "ey": ey.value, "r": r})


metric(key="implied_growth", label="growth implied by the P/E", unit="percent", formula="required_return - eps_diluted / price",
       pretty="required return − earnings yield", fields=("price", "eps_diluted"), compute=_implied,
       given=lambda c, k: f"{c.label} traded at a P/E of {mult(k.ctx['pe'])}. Assume investors want a {pct(k.ctx['r'], 0)} yearly return and use: return ≈ earnings yield + growth.",
       ask="What long-run growth rate does that P/E imply?",
       mistakes=lambda c, k: [("reporting the earnings yield itself", k.ctx['ey']),
                              ("adding the earnings yield instead of subtracting", k.ctx['r'] + k.ctx['ey']),
                              ("reporting the required return", k.ctx['r'])],
       gloss=lambda c, k: ("A higher P/E means a lower earnings yield, so more of the return has to come from growth. "
                           "This is a rough identity for building intuition, not a forecast."))


def _implied_vs_cagr(c: Co):
    a, b = _implied(c), _cagr(c)
    if a is None or b is None or abs(a.value - b.value) < 0.01:
        return None
    return Calc(a.value > b.value, f"implied growth {pct(a.value)} vs. 3-year revenue CAGR {pct(b.value)}",
                {**a.inputs, **b.inputs}, params=a.params, ctx={"g": a.value, "cagr": b.value})


metric(key="implied_gt_cagr", label="implied vs. past growth", unit="bool",
       formula="(required_return - eps_diluted / price) > revenue_cagr_3y", pretty="implied growth compared with 3-year revenue CAGR",
       fields=("price", "eps_diluted", "history.revenue"), compute=_implied_vs_cagr, comparable=False,
       statement=lambda c, k: (f"With a {pct(REQUIRED_RETURN, 0)} required return, the growth implied by {c.label}'s P/E is higher "
                               f"than its revenue growth rate over the last 3 years."),
       gloss=lambda c, k: "Comparing implied growth with past growth is a sanity check on what the price already assumes; past growth is no promise of future growth.")


# --------------------------------------------------------------------- unit 8
def dcf_perpetuity(fcf: float, net_cash: float, r: float, g: float) -> float:
    return fcf * (1 + g) / (r - g) + net_cash


def _dcf_inputs(c: Co):
    fcf, nc, sh = _fcf(c), _net_cash(c), c.f("shares_diluted")
    if fcf is None or nc is None or not pos(sh) or fcf.value <= 0:
        return None
    return fcf.value, nc.value, sh, {**fcf.inputs, **nc.inputs, "shares_diluted": sh}


def _dcf_eq(c: Co):
    x = _dcf_inputs(c)
    if x is None:
        return None
    fcf, nc, sh, inp = x
    r, g = REQUIRED_RETURN, TERMINAL_GROWTH
    v = dcf_perpetuity(fcf, nc, r, g)
    if v <= 0:
        return None
    return Calc(v, f"{usd(fcf)} × {1 + g:.3f} ÷ ({pct(r)} − {pct(g)}) + {usd(nc)} = {usd(v)}", inp,
                params={"discount_rate": r, "terminal_growth": g}, ctx={"fcf": fcf, "nc": nc, "sh": sh, "r": r, "g": g})


metric(key="dcf_equity", label="one-line DCF value of the equity", unit="usd",
       formula="fcf * (1 + g) / (r - g) + (cash - total_debt)", pretty="FCF × (1 + g) ÷ (r − g) + net cash",
       fields=("operating_cash_flow", "capex", "cash", "total_debt"), compute=_dcf_eq, comparable=False,
       given=lambda c, k: (f"{c.label} produced {usd(k.ctx['fcf'])} of free cash flow in {fy(c)} and had net cash of {usd(k.ctx['nc'])}. "
                           f"Assume FCF grows {pct(k.ctx['g'])} a year forever and a {pct(k.ctx['r'], 0)} discount rate."),
       ask="What is the one-line DCF value of the equity?",
       mistakes=lambda c, k: [("forgetting net cash", k.value - k.ctx['nc']),
                              ("dividing by r instead of r − g", k.ctx['fcf'] / k.ctx['r'] + k.ctx['nc']),
                              ("dividing by r + g", k.ctx['fcf'] * (1 + k.ctx['g']) / (k.ctx['r'] + k.ctx['g']) + k.ctx['nc'])],
       gloss=lambda c, k: "This growing-perpetuity formula is the simplest DCF. Every input is an assumption, so treat the output as a range, not a fact.")


def _dcf_ps(c: Co):
    k = _dcf_eq(c)
    if k is None:
        return None
    v = k.value / k.ctx["sh"]
    return Calc(v, f"({usd(k.ctx['fcf'])} × {1 + k.ctx['g']:.3f} ÷ ({pct(k.ctx['r'])} − {pct(k.ctx['g'])}) + {usd(k.ctx['nc'])}) "
                   f"÷ {k.ctx['sh'] / 1e9:,.2f}B shares = {usd(k.value)} ÷ {k.ctx['sh'] / 1e9:,.2f}B = {usd(v, True)}",
                k.inputs, params=k.params, ctx={**k.ctx, "eq": k.value})


metric(key="dcf_per_share", label="one-line DCF value per share", unit="usd_share",
       formula="(fcf * (1 + g) / (r - g) + (cash - total_debt)) / shares_diluted", pretty="(FCF × (1 + g) ÷ (r − g) + net cash) ÷ diluted shares",
       fields=("operating_cash_flow", "capex", "cash", "total_debt", "shares_diluted"), compute=_dcf_ps, comparable=False,
       given=lambda c, k: (f"{c.label}: {fy(c)} free cash flow {usd(k.ctx['fcf'])}, net cash {usd(k.ctx['nc'])}, "
                           f"{k.ctx['sh'] / 1e9:,.2f} billion diluted shares. Assume {pct(k.ctx['g'])} growth forever and a {pct(k.ctx['r'], 0)} discount rate."),
       ask="What is the one-line DCF value per share?",
       mistakes=lambda c, k: [("forgetting net cash", (k.ctx['eq'] - k.ctx['nc']) / k.ctx['sh']),
                              ("dividing by r instead of r − g", (k.ctx['fcf'] / k.ctx['r'] + k.ctx['nc']) / k.ctx['sh']),
                              ("dividing by r + g", (k.ctx['fcf'] * (1 + k.ctx['g']) / (k.ctx['r'] + k.ctx['g']) + k.ctx['nc']) / k.ctx['sh'])],
       gloss=lambda c, k: "Dividing the equity value by the share count turns it into a per-share estimate you can line up against the share price.")


def dcf_two_stage(fcf: float, nc: float, sh: float, g1: float, r: float, g: float, years: int = DCF_YEARS):
    flows = [fcf * (1 + g1) ** t for t in range(1, years + 1)]
    pv = sum(f / (1 + r) ** t for t, f in enumerate(flows, 1))
    tv = flows[-1] * (1 + g) / (r - g)
    pv_tv = tv / (1 + r) ** years
    return (pv + pv_tv + nc) / sh, pv, tv, pv_tv


def _dcf2(c: Co):
    x, cg = _dcf_inputs(c), _cagr(c)
    if x is None or cg is None:
        return None
    fcf, nc, sh, inp = x
    g1 = min(max(round(cg.value, 2), 0.0), 0.15)
    r, g = REQUIRED_RETURN, TERMINAL_GROWTH
    v, pv, tv, pv_tv = dcf_two_stage(fcf, nc, sh, g1, r, g)
    if v <= 0:
        return None
    arith = (f"5 years of FCF growing {pct(g1, 0)} from {usd(fcf)}, discounted at {pct(r, 0)}, is worth {usd(pv)} today; "
             f"the year-5 terminal value {usd(tv)} discounted back is {usd(pv_tv)}; "
             f"({usd(pv)} + {usd(pv_tv)} + {usd(nc)} net cash) ÷ {sh / 1e9:,.2f}B shares = {usd(v, True)}")
    return Calc(v, arith, {**inp, **cg.inputs}, params={"discount_rate": r, "terminal_growth": g, "stage1_growth": g1,
                                                       "stage1_years": DCF_YEARS},
                ctx={"fcf": fcf, "nc": nc, "sh": sh, "g1": g1, "r": r, "g": g, "pv": pv, "tv": tv, "pv_tv": pv_tv,
                     "cagr": cg.value})


metric(key="dcf2_per_share", label="two-stage DCF value per share", unit="usd_share",
       formula="(sum(fcf*(1+g1)^t/(1+r)^t, t=1..5) + fcf*(1+g1)^5*(1+g)/(r-g)/(1+r)^5 + cash - total_debt) / shares_diluted",
       pretty="PV of 5 growth years + PV of terminal value + net cash, per share",
       fields=("operating_cash_flow", "capex", "cash", "total_debt", "shares_diluted", "history.revenue"),
       compute=_dcf2, comparable=False,
       given=lambda c, k: (f"{c.label}: {fy(c)} FCF {usd(k.ctx['fcf'])}, net cash {usd(k.ctx['nc'])}, {k.ctx['sh'] / 1e9:,.2f}B shares. "
                           f"Assume FCF grows {pct(k.ctx['g1'], 0)} a year for 5 years (its recent revenue CAGR, rounded and capped at 15%), "
                           f"then {pct(k.ctx['g'])} forever, discounted at {pct(k.ctx['r'], 0)}."),
       ask="What is the two-stage DCF value per share?",
       mistakes=lambda c, k: [("using only the one-line perpetuity", (dcf_perpetuity(k.ctx['fcf'], k.ctx['nc'], k.ctx['r'], k.ctx['g'])) / k.ctx['sh']),
                              ("forgetting to discount the terminal value", (k.ctx['pv'] + k.ctx['tv'] + k.ctx['nc']) / k.ctx['sh']),
                              ("forgetting net cash", k.value - k.ctx['nc'] / k.ctx['sh'])],
       gloss=lambda c, k: "Most of a DCF's value usually sits in the terminal value, which is why small changes in long-run assumptions move the answer so much.")


def _pvv(c: Co):
    k = _dcf_ps(c)
    if k is None or not pos(c.price):
        return None
    v = c.price / k.value - 1
    return Calc(v, f"{usd(c.price, True)} ÷ {usd(k.value, True)} − 1 = {pct(v)}", {**k.inputs, "price": c.price},
                params=k.params, ctx={"p": c.price, "val": k.value})


metric(key="price_vs_dcf", label="gap between price and the one-line DCF", unit="percent",
       formula="price / dcf_per_share - 1", pretty="share price ÷ DCF value per share − 1",
       fields=("price", "operating_cash_flow", "capex", "cash", "total_debt", "shares_diluted"), compute=_pvv,
       comparable=False,
       given=lambda c, k: f"{c.label}'s sample share price was {usd(k.ctx['p'], True)}, and a one-line DCF (9% discount rate, 2.5% growth) gave {usd(k.ctx['val'], True)} per share.",
       ask="By what percentage is the price above (+) or below (−) that estimate?",
       mistakes=lambda c, k: [("dividing the wrong way round", k.ctx['val'] / k.ctx['p'] - 1),
                              ("dividing the gap by the price instead of the estimate", (k.ctx['p'] - k.ctx['val']) / k.ctx['p']),
                              ("flipping the sign", -k.value)],
       gloss=lambda c, k: ("The gap between an estimate of value and the price is what investors call the margin of safety. "
                           "A large gap often means the market is assuming very different growth than the model, so question the assumptions first. " + PRICE_NOTE))


def _sens(c: Co):
    x = _dcf_inputs(c)
    if x is None:
        return None
    fcf, nc, sh, inp = x
    g = TERMINAL_GROWTH
    lo, hi = dcf_perpetuity(fcf, nc, 0.08, g) / sh, dcf_perpetuity(fcf, nc, 0.10, g) / sh
    if lo <= 0 or hi <= 0:
        return None
    v = lo / hi
    return Calc(v, f"{usd(lo, True)} (at 8%) ÷ {usd(hi, True)} (at 10%) = {mult(v)}", inp,
                params={"discount_rate_low": 0.08, "discount_rate_high": 0.10, "terminal_growth": g},
                ctx={"lo": lo, "hi": hi, "fcf": fcf, "nc": nc})


metric(key="dcf_rate_sensitivity", label="DCF sensitivity to the discount rate", unit="multiple",
       formula="dcf_per_share(r=8%) / dcf_per_share(r=10%)", pretty="value at an 8% discount rate ÷ value at a 10% discount rate",
       fields=("operating_cash_flow", "capex", "cash", "total_debt", "shares_diluted"), compute=_sens, comparable=False,
       given=lambda c, k: (f"A one-line DCF of {c.label} (FCF {usd(k.ctx['fcf'])}, 2.5% growth) gives {usd(k.ctx['lo'], True)} per share "
                           f"at an 8% discount rate and {usd(k.ctx['hi'], True)} at 10%."),
       ask="How many times larger is the 8% value than the 10% value?",
       mistakes=lambda c, k: [("assuming value scales with the rate (10 ÷ 8)", 1.25),
                              ("assuming the rate barely matters", 1.0),
                              ("dividing the wrong way round", k.ctx['hi'] / k.ctx['lo'])],
       gloss=lambda c, k: "Moving the discount rate by just 2 points changes the estimate a lot, because r − g in the denominator is a small number.")


def _gm_range(c: Co):
    h = [v for _, v in c.hist("gross_margin")]
    if len(h) < 5:
        return None
    hi, lo = max(h), min(h)
    yrs = c.hist("gross_margin")
    v = hi - lo
    return Calc(v, f"{pct(hi)} − {pct(lo)} = {pct(v)} (percentage points)", {"history.gross_margin": yrs},
                ctx={"hi": hi, "lo": lo, "y0": yrs[0][0], "y1": yrs[-1][0], "avg": mean(h), "latest": h[-1]})


metric(key="gm_range", label="gross-margin swing over the history", unit="percent",
       formula="max(history.gross_margin) - min(history.gross_margin)", pretty="highest gross margin − lowest gross margin",
       fields=("history.gross_margin",), compute=_gm_range,
       given=lambda c, k: f"Between FY{k.ctx['y0']} and FY{k.ctx['y1']}, {c.label}'s gross margin peaked at {pct(k.ctx['hi'])} and bottomed at {pct(k.ctx['lo'])}.",
       ask="How wide was the swing, in percentage points?",
       mistakes=lambda c, k: [("reporting the peak", k.ctx['hi']),
                              ("reporting the average", k.ctx['avg']),
                              ("dividing peak by trough", k.ctx['hi'] / k.ctx['lo'] - 1 if k.ctx['lo'] > 0 else None)],
       gloss=lambda c, k: "A wide swing is the signature of a cyclical business: when supply and demand flip, prices, and margins, move together.")


def _fcf_peak(c: Co):
    h = c.hist("free_cash_flow")
    vals = [v for _, v in h]
    if len(vals) < 5 or mean(vals) <= 0 or max(vals) <= 0:
        return None
    avg, pk = mean(vals), max(vals)
    pk_year = max(h, key=lambda t: t[1])[0]
    v = pk / avg
    return Calc(v, f"{usd(pk)} (FY{pk_year}) ÷ {usd(avg)} average over FY{h[0][0]}–FY{h[-1][0]} = {mult(v)}",
                {"history.free_cash_flow": h}, ctx={"pk": pk, "avg": avg, "pk_year": pk_year, "y0": h[0][0], "y1": h[-1][0],
                                                   "med": median(vals), "latest": vals[-1]})


metric(key="fcf_peak_to_avg", label="peak FCF vs. average FCF", unit="multiple",
       formula="max(history.free_cash_flow) / mean(history.free_cash_flow)", pretty="peak-year FCF ÷ average FCF across the cycle",
       fields=("history.free_cash_flow",), compute=_fcf_peak,
       given=lambda c, k: (f"{c.label}'s free cash flow peaked at {usd(k.ctx['pk'])} in FY{k.ctx['pk_year']}; its average from "
                           f"FY{k.ctx['y0']} to FY{k.ctx['y1']} was {usd(k.ctx['avg'])}."),
       ask="A DCF built on the peak year would start from how many times the cycle-average FCF?",
       mistakes=lambda c, k: [("dividing the wrong way round", k.ctx['avg'] / k.ctx['pk']),
                              ("comparing the peak with the median", k.ctx['pk'] / k.ctx['med'] if k.ctx['med'] > 0 else None),
                              ("comparing the peak with the latest year", k.ctx['pk'] / k.ctx['latest'] if k.ctx['latest'] > 0 else None)],
       gloss=lambda c, k: ("Because a DCF value is proportional to its starting cash flow, starting from a peak year would inflate the estimate by the same multiple. "
                           "For cyclical companies, use a cycle-average (normalized) cash flow instead."))


def _loss_year(c: Co):
    h = c.hist("net_income")
    if len(h) < 5:
        return None
    losses = [y for y, v in h if v < 0]
    return Calc(bool(losses), ("net losses in " + ", ".join(f"FY{y}" for y in losses)) if losses else
                f"net income was positive every year from FY{h[0][0]} to FY{h[-1][0]}", {"history.net_income": h},
                ctx={"y0": h[0][0], "y1": h[-1][0]})


metric(key="had_loss_year", label="loss years", unit="bool", formula="any(history.net_income < 0)",
       pretty="any year with negative net income", fields=("history.net_income",), compute=_loss_year, comparable=False,
       statement=lambda c, k: f"{c.label} reported a net loss in at least one year between FY{k.ctx['y0']} and FY{k.ctx['y1']}.",
       gloss=lambda c, k: "Losses in down-cycle years are normal for cyclical businesses; one good year's profit is not a steady-state number.")


def get(key: str) -> Metric:
    return REGISTRY[key]
