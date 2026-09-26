"""'Your portfolio' lessons: personalizable question templates.

Prompts contain `{holding.<name>}` placeholders. Each placeholder, and each answer, is
defined by a tiny arithmetic expression over a company record (`fundamentals.x`,
`metrics.x`, `price`, `latest_fy`, `ticker`, `name`), so the app can fill them from
companies.json for the user's own holding. The shipped answer/example is computed
for a real example company so the lesson also works before any account is linked.
Content is purely explanatory.
"""
from __future__ import annotations

import ast
import math
import operator
import random
from typing import Any, Optional

from .curriculum import L, UnitSpec
from .fmt import fmt, short_name

# name -> (expression, display format)
PLACEHOLDERS: dict[str, tuple[str, str]] = {
    "ticker": ("ticker", "text"), "name": ("name", "text"), "fy": ("latest_fy", "year"),
    "revenue": ("fundamentals.revenue", "usd"), "gross_profit": ("fundamentals.gross_profit", "usd"),
    "net_income": ("fundamentals.net_income", "usd"), "operating_cash_flow": ("fundamentals.operating_cash_flow", "usd"),
    "capex": ("fundamentals.capex", "usd"), "free_cash_flow": ("fundamentals.free_cash_flow", "usd"),
    "cash": ("fundamentals.cash", "usd"), "total_debt": ("fundamentals.total_debt", "usd"),
    "gross_margin": ("metrics.gross_margin", "percent"), "operating_margin": ("metrics.operating_margin", "percent"),
    "net_margin": ("metrics.net_margin", "percent"), "fcf_margin": ("metrics.fcf_margin", "percent"),
    "net_cash": ("metrics.net_cash", "usd"), "market_cap": ("metrics.market_cap", "usd"),
    "price": ("price", "usd_share"), "eps_diluted": ("fundamentals.eps_diluted", "usd_share"),
    "pe": ("metrics.pe", "multiple"), "earnings_yield": ("metrics.earnings_yield", "percent"),
    "fcf_yield": ("metrics.fcf_yield", "percent"), "dividend_yield": ("metrics.dividend_yield", "percent"),
    "implied_growth": ("0.09 - fundamentals.eps_diluted / price", "percent"),
}

_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
        ast.Lt: operator.lt, ast.Gt: operator.gt, ast.LtE: operator.le, ast.GtE: operator.ge}


def evaluate(expr: str, raw: dict) -> Any:
    """Safely evaluate a placeholder/answer expression against a company record."""

    def ev(n):
        if isinstance(n, ast.Expression):
            return ev(n.body)
        if isinstance(n, ast.Constant) and isinstance(n.value, (int, float)):
            return n.value
        if isinstance(n, ast.Name):
            return raw.get(n.id)
        if isinstance(n, ast.Attribute) and isinstance(n.value, ast.Name) and n.value.id in ("fundamentals", "metrics"):
            v = (raw.get(n.value.id) or {}).get(n.attr)
            return v if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else None
        if isinstance(n, ast.UnaryOp) and isinstance(n.op, ast.USub):
            v = ev(n.operand)
            return None if v is None else -v
        if isinstance(n, ast.BinOp) and type(n.op) in _OPS:
            a, b = ev(n.left), ev(n.right)
            if a is None or b is None or (isinstance(n.op, ast.Div) and b == 0):
                return None
            return _OPS[type(n.op)](a, b)
        if isinstance(n, ast.Compare) and len(n.ops) == 1 and type(n.ops[0]) in _OPS:
            a, b = ev(n.left), ev(n.comparators[0])
            return None if a is None or b is None else _OPS[type(n.ops[0])](a, b)
        raise ValueError(f"unsupported expression: {expr}")

    return ev(ast.parse(expr, mode="eval"))


def render(text: str, raw: dict) -> Optional[str]:
    out = text
    for name, (expr, f) in PLACEHOLDERS.items():
        token = "{holding." + name + "}"
        if token not in out:
            continue
        v = evaluate(expr, raw)
        if v is None:
            return None
        if f == "text":
            s = short_name(v) if name == "name" else str(v)
        elif f == "year":
            s = str(v)
        else:
            s = fmt(v, f)
        out = out.replace(token, s)
    return out


def used_placeholders(*texts: str) -> dict:
    return {f"holding.{n}": {"expr": e, "format": f} for n, (e, f) in PLACEHOLDERS.items()
            if any("{holding." + n + "}" in t for t in texts if t)}


HOLDING = "{holding.name} ({holding.ticker})"

# kind, prompt, answer_expr | fixed choices, unit, explanation, (requires positive exprs)
TEMPLATES: dict[str, list[dict]] = {
    "u9-l1": [
        dict(type="numeric", unit="percent", answer_expr="fundamentals.gross_profit / fundamentals.revenue",
             prompt=f"Your largest holding is {HOLDING}. In FY{{holding.fy}} it had revenue of {{holding.revenue}} and gross profit of {{holding.gross_profit}}. What was its gross margin? Answer as a percentage.",
             explanation="Gross margin = gross profit ÷ revenue = {holding.gross_profit} ÷ {holding.revenue} = {holding.gross_margin}. Out of every $1 of sales, {holding.ticker} kept that share after paying for what it sold.",
             requires=["fundamentals.revenue"]),
        dict(type="multiple_choice", unit="none",
             prompt="{holding.ticker}'s gross margin was {holding.gross_margin}. What does that number measure?",
             choices=["The share of each sales dollar left after paying for the goods or services sold",
                      "The share of each sales dollar left after every cost, interest and tax",
                      "How much the share price changed over the year",
                      "The share of profit paid out as dividends"],
             explanation="Gross margin looks only at the first layer of costs, the cost of revenue. Net margin is the one that includes every cost, interest and tax."),
        dict(type="numeric", unit="percent", answer_expr="fundamentals.net_income / fundamentals.revenue",
             prompt="{holding.ticker} earned net income of {holding.net_income} on revenue of {holding.revenue} in FY{holding.fy}. What was its net margin? Answer as a percentage.",
             explanation="Net margin = net income ÷ revenue = {holding.net_income} ÷ {holding.revenue} = {holding.net_margin}. It's the bottom line as a share of sales.",
             requires=["fundamentals.revenue"]),
        dict(type="true_false", unit="none", answer_expr="metrics.operating_margin < metrics.gross_margin",
             prompt="True or false? {holding.ticker}'s operating margin ({holding.operating_margin}) was lower than its gross margin ({holding.gross_margin}).",
             explanation="Operating margin = gross margin minus operating expenses (R&D, sales, admin) as a share of revenue: {holding.gross_margin} at the gross level vs. {holding.operating_margin} at the operating level."),
        dict(type="multiple_choice", unit="none",
             prompt="The gap between {holding.ticker}'s gross margin ({holding.gross_margin}) and its operating margin ({holding.operating_margin}) mostly reflects what?",
             choices=["Operating expenses such as R&D, sales and administration", "Interest paid on debt",
                      "Income taxes", "Changes in the share price"],
             explanation="Interest and taxes come after operating income, so they sit between operating margin and net margin, not between gross and operating margin."),
    ],
    "u9-l2": [
        dict(type="numeric", unit="usd", answer_expr="fundamentals.operating_cash_flow - fundamentals.capex",
             prompt="In FY{holding.fy}, {holding.ticker} generated {holding.operating_cash_flow} of operating cash flow and spent {holding.capex} on capital expenditures. What was its free cash flow? Answer in dollars.",
             explanation="Free cash flow = operating cash flow − capex = {holding.operating_cash_flow} − {holding.capex} = {holding.free_cash_flow}. That's the cash left after running and reinvesting in the business."),
        dict(type="true_false", unit="none", answer_expr="fundamentals.operating_cash_flow > fundamentals.net_income",
             prompt="True or false? {holding.ticker} brought in more operating cash flow ({holding.operating_cash_flow}) than it reported in net income ({holding.net_income}).",
             explanation="Net income follows accounting rules; operating cash flow counts cash actually received. Non-cash costs like depreciation usually push cash flow above profit."),
        dict(type="numeric", unit="percent", answer_expr="(fundamentals.operating_cash_flow - fundamentals.capex) / fundamentals.revenue",
             prompt="{holding.ticker} had free cash flow of {holding.free_cash_flow} on revenue of {holding.revenue}. What was its FCF margin? Answer as a percentage.",
             explanation="FCF margin = free cash flow ÷ revenue = {holding.free_cash_flow} ÷ {holding.revenue} = {holding.fcf_margin}.",
             requires=["fundamentals.revenue"]),
        dict(type="multiple_choice", unit="none",
             prompt="{holding.ticker}'s net cash (cash − total debt) was {holding.net_cash}. What would a negative number here mean?",
             choices=["The company owes more debt than it holds in cash (net debt)",
                      "The company lost money this year", "The company paid no dividend",
                      "The share price fell during the year"],
             explanation="Net cash compares only two balance-sheet items: cash {holding.cash} and total debt {holding.total_debt}. It says nothing about this year's profit or the share price."),
        dict(type="true_false", unit="none", answer_expr="fundamentals.cash > fundamentals.total_debt",
             prompt="True or false? At the end of FY{holding.fy}, {holding.ticker} held more cash ({holding.cash}) than debt ({holding.total_debt}).",
             explanation="Net cash = cash − total debt = {holding.net_cash}. Positive means net cash; negative means net debt."),
    ],
    "u9-l3": [
        dict(type="numeric", unit="multiple", answer_expr="price / fundamentals.eps_diluted",
             prompt="{holding.ticker}'s share price was {holding.price} and its FY{holding.fy} diluted EPS was {holding.eps_diluted}. What was its P/E ratio? Answer as a multiple.",
             explanation="P/E = price ÷ EPS = {holding.price} ÷ {holding.eps_diluted} = {holding.pe}. The market was paying that many dollars per $1 of last year's earnings. Prices are sample snapshots and change daily.",
             requires=["fundamentals.eps_diluted", "price"]),
        dict(type="multiple_choice", unit="none",
             prompt="{holding.ticker} traded at a P/E of {holding.pe}, an earnings yield of {holding.earnings_yield}. Which statement is accurate?",
             choices=["Earnings yield is 1 ÷ P/E, so a higher P/E means a lower earnings yield",
                      "Earnings yield is the dividend the company pays each year",
                      "A higher P/E means the company earned more profit",
                      "P/E and earnings yield are unrelated numbers"],
             explanation="Earnings yield = EPS ÷ price = 1 ÷ P/E. At {holding.pe}, that's {holding.earnings_yield}.",
             requires=["fundamentals.eps_diluted", "price"]),
        dict(type="numeric", unit="percent", answer_expr="0.09 - fundamentals.eps_diluted / price",
             prompt="Using return ≈ earnings yield + growth and a 9% required return, what long-run growth rate does {holding.ticker}'s P/E of {holding.pe} imply? Answer as a percentage.",
             explanation="Implied growth ≈ 9% − earnings yield = 9% − {holding.earnings_yield} = {holding.implied_growth}. This is what the current price already assumes, not a forecast.",
             requires=["fundamentals.eps_diluted", "price"]),
        dict(type="numeric", unit="percent", answer_expr="(fundamentals.operating_cash_flow - fundamentals.capex) / metrics.market_cap",
             prompt="{holding.ticker} produced {holding.free_cash_flow} of free cash flow and had a market cap of {holding.market_cap}. What was its FCF yield? Answer as a percentage.",
             explanation="FCF yield = free cash flow ÷ market cap = {holding.free_cash_flow} ÷ {holding.market_cap} = {holding.fcf_yield}.",
             requires=["metrics.market_cap"]),
        dict(type="true_false", unit="none", answer_expr="metrics.fcf_yield > metrics.dividend_yield",
             prompt="True or false? {holding.ticker}'s FCF yield ({holding.fcf_yield}) was higher than its dividend yield ({holding.dividend_yield}).",
             explanation="If FCF yield exceeds dividend yield, the dividend was covered by free cash flow with room to spare; the rest can go to buybacks, debt paydown or reinvestment."),
    ],
}

PORTFOLIO_UNIT = UnitSpec("u9-portfolio", 9, "Your portfolio",
                          "The same ideas, applied to the companies you own. Filled in from your linked holdings.", [
    L("u9-l1", "Your holding's margins", """
This lesson uses **your own largest holding**. Everything here is explanation, not a judgment of the
investment. You'll work out its gross margin and net margin from the reported numbers, then read the
**margin stack**: gross margin at the top, operating margin after running costs, net margin after
interest and taxes. Seeing where each cent of a sales dollar goes is the fastest way to understand
what kind of business you actually own. Until you link an account, we'll show an example company.""", []),
    L("u9-l2", "Your holding's cash", """
Profit is an accounting number; cash is what actually lands in the bank. In this lesson you'll compute
**free cash flow** for a company you own (operating cash flow minus capital expenditures), express it
as a share of revenue, and check whether its cash covers its debt. These are the same checks from
Units 4 and 5, applied to your own holding. Nothing here is a signal to act. It's a way to understand
the business behind the ticker. Until you link an account, we'll show an example company.""", []),
    L("u9-l3", "Your holding's valuation", """
Now bring in the share price for a company you own. You'll compute its **P/E**, flip it into an
**earnings yield**, reverse-engineer the **growth the price implies**, and compare its **FCF yield**
with its dividend yield. None of this says whether the price is right. Valuation numbers describe what
the market is currently assuming, and they change every day. Treat them as questions to investigate,
not answers. Until you link an account, we'll show an example company.""", []),
])


def _eligible(raw: dict, t: dict) -> bool:
    texts = [t["prompt"], t["explanation"]]
    if any(render(x, raw) is None for x in texts):
        return False
    for req in t.get("requires", []):
        v = evaluate(req, raw)
        if v is None or v <= 0:
            return False
    if "answer_expr" in t and evaluate(t["answer_expr"], raw) is None:
        return False
    return True


def build_question(t: dict, raw: dict, rng: random.Random, qid: str) -> dict:
    q: dict = {"id": qid, "type": t["type"], "prompt": t["prompt"]}
    if t["type"] == "multiple_choice":
        order = list(range(len(t["choices"])))
        rng.shuffle(order)
        q["choices"] = [t["choices"][i] for i in order]
        q["answer"] = order.index(0)
        rule = "fixed"
    else:
        v = evaluate(t["answer_expr"], raw)
        rule = "expr"
        if t["type"] == "true_false":
            q["answer"] = bool(v)
        else:
            q["answer"] = round(v, 2) if t["unit"] == "usd" else round(v, 6)
            q["tolerance"] = {"percent": 0.005, "multiple": round(max(0.1, 0.02 * abs(v)), 3)}.get(t["unit"], round(0.02 * abs(v), 2))
    q["unit"] = t["unit"]
    q["explanation"] = t["explanation"]
    q["source"] = {"ticker": raw["ticker"], "fy": raw.get("latest_fy"), "metrics": [t.get("answer_expr", "concept")],
                   "formula": t.get("answer_expr", "concept (fixed answer)"),
                   "example": True}
    q["personalization"] = {
        "slot": "holding", "selector": "largest_holding_by_market_value",
        "answer_rule": rule, "answer_expr": t.get("answer_expr"),
        "requires_positive": t.get("requires", []),
        "placeholders": used_placeholders(t["prompt"], t["explanation"]),
        "example": {"ticker": raw["ticker"], "prompt": render(t["prompt"], raw),
                    "explanation": render(t["explanation"], raw)},
    }
    return q


def build_unit(companies: list[dict], seed: int) -> dict:
    lessons = []
    for spec in PORTFOLIO_UNIT.lessons:
        rng = random.Random(f"{seed}:{spec.id}")
        temps = TEMPLATES[spec.id]
        eligible = [c for c in companies if all(_eligible(c, t) for t in temps)]
        if not eligible:
            continue
        example = rng.choice(sorted(eligible, key=lambda c: c["ticker"]))
        qs = [build_question(t, example, rng, f"q-{spec.id}-{i + 1:02d}") for i, t in enumerate(temps)]
        lessons.append({"id": spec.id, "title": spec.title, "xp": spec.xp, "intro": spec.intro,
                        "personalizable": True,
                        "personalization": {"slots": {"holding": "largest_holding_by_market_value"},
                                            "example_ticker": example["ticker"],
                                            "placeholder_syntax": "{holding.<name>}"},
                        "questions": qs})
    return {"id": PORTFOLIO_UNIT.id, "title": PORTFOLIO_UNIT.title, "summary": PORTFOLIO_UNIT.summary,
            "order": PORTFOLIO_UNIT.order, "personalizable": True, "lessons": lessons}
