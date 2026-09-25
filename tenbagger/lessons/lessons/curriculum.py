"""Curriculum as data: units -> lessons -> ordered question slots.

A slot is (kind, metric_key). kind: mc | num | tf | cmp | ord. The generator fills
slots in order, skipping any that can't be built safely, and keeps up to 8.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class LessonSpec:
    id: str
    title: str
    intro: str
    slots: list[tuple[str, str]]
    xp: int = 10


@dataclass
class UnitSpec:
    id: str
    order: int
    title: str
    summary: str
    lessons: list[LessonSpec] = field(default_factory=list)


def L(id, title, intro, slots, xp=10):
    return LessonSpec(id, title, " ".join(intro.split()), slots, xp)


UNITS: list[UnitSpec] = [
    UnitSpec("u1-revenue", 1, "What a company sells",
             "Revenue is where every analysis starts: how much a company sells and how fast that is growing.", [
        L("u1-l1", "Revenue: the top line", """
**Revenue** (also called sales or the *top line*) is the total money a company brings in from customers
during its fiscal year, before paying any costs. It sits on the first line of the income statement.
Company reports print it in huge raw numbers, so analysts shorten them: **M** for million, **B** for
billion, **T** for trillion. $416,161,000,000 becomes $416.2B. Revenue tells you the *scale* of a business,
not whether it is profitable: a grocery chain can have enormous sales and thin profits. In this lesson
you'll read and compare the revenue of real companies.""",
          [("mc", "revenue"), ("cmp", "revenue"), ("tf", "revenue"), ("mc", "revenue"), ("ord", "revenue"),
           ("cmp", "revenue"), ("tf", "revenue")]),
        L("u1-l2", "Revenue growth", """
**Revenue growth** tells you how much bigger (or smaller) sales got compared with the year before.
The formula is simple: **this year ÷ last year − 1**. If revenue went from $100B to $112B, growth is
112 ÷ 100 − 1 = 12%. Always divide by the *earlier* year; dividing by the later year understates growth.
Growth can be negative, which means sales shrank. A fast grower and a slow grower can both be good
businesses, but growth is one of the biggest drivers of how the market values a company.""",
          [("mc", "revenue_growth_yoy"), ("num", "revenue_growth_yoy"), ("cmp", "revenue_growth_yoy"),
           ("tf", "revenue_growth_yoy"), ("ord", "revenue_growth_yoy"), ("mc", "revenue_growth_yoy"),
           ("num", "revenue_growth_yoy")]),
        L("u1-l3", "Compounding: 3-year CAGR", """
One year of growth can be a fluke. The **compound annual growth rate (CAGR)** smooths several years
into a single per-year rate: **(end ÷ start)^(1/years) − 1**. Why not just divide total growth by the
number of years? Because growth compounds: each year grows on top of the last. Revenue that rises 33%
over three years grew about 10% a year, not 11%. CAGR is the fairest way to compare growth across
companies and to feed a growth assumption into a valuation later in the course.""",
          [("mc", "revenue_cagr_3y"), ("num", "revenue_cagr_3y"), ("cmp", "revenue_cagr_3y"),
           ("tf", "revenue_cagr_3y"), ("ord", "revenue_cagr_3y"), ("mc", "revenue_cagr_3y")]),
    ]),
    UnitSpec("u2-margins", 2, "Margins",
             "Margins show how many cents of each sales dollar a company keeps at each step of the income statement.", [
        L("u2-l1", "Gross profit & gross margin", """
**Gross profit** is revenue minus the **cost of revenue**: what it cost to make or purchase the things the
company sold. **Gross margin** is gross profit ÷ revenue. A software company with a 70% gross margin keeps
70 cents of each sales dollar after delivering its product; a warehouse retailer might keep 12 cents.
Neither is automatically better. Low-margin retailers can win on volume, while high gross margins leave
room to spend on research and marketing. The classic mistake is using net income instead of gross profit.""",
          [("mc", "gross_profit"), ("mc", "gross_margin"), ("num", "gross_margin"), ("cmp", "gross_margin"),
           ("tf", "gross_margin"), ("ord", "gross_margin"), ("num", "gross_profit")]),
        L("u2-l2", "Operating margin", """
Below gross profit come the costs of running the business: research and development, sales and
marketing, and general administration. Subtract them and you get **operating income**, the profit from
the core business before interest and taxes. **Operating margin** = operating income ÷ revenue. It
shows how efficiently a company turns sales into profit from what it actually does. If the margin is
negative, the business spent more to run itself than its products earned. Watch the trend across
years: rising operating margins often mean a company is getting more efficient as it grows.""",
          [("mc", "operating_margin"), ("num", "operating_margin"), ("cmp", "operating_margin"),
           ("tf", "operating_margin"), ("ord", "operating_margin"), ("mc", "operating_margin"),
           ("num", "operating_margin")]),
        L("u2-l3", "Net margin", """
**Net income** is what remains after *everything*: product costs, operating expenses, interest, one-off
charges and taxes. **Net margin** = net income ÷ revenue, the famous "bottom line" as a share of sales.
Because it includes one-time items and tax quirks, net margin can jump around more than operating
margin. A company can have a healthy operating margin but a weak net margin if it carries lots of debt
(interest) or takes a big write-down. Compare net margin to operating margin to spot those gaps.""",
          [("mc", "net_margin"), ("num", "net_margin"), ("cmp", "net_margin"), ("tf", "net_margin"),
           ("ord", "net_margin"), ("mc", "net_margin")]),
        L("u2-l4", "The margin stack", """
Put the three margins together and you get the **margin stack**: gross margin at the top, operating
margin in the middle, net margin at the bottom. The gap between gross and operating margin is the share
of revenue spent on **operating expenses** (R&D, sales, admin). A company with a high gross margin but a
low operating margin is spending heavily, maybe investing for growth, maybe running inefficiently.
Reading the stack tells you *where* the money goes, which is more useful than any single margin.""",
          [("mc", "opex_ratio"), ("num", "opex_ratio"), ("cmp", "opex_ratio"), ("ord", "operating_margin"),
           ("tf", "opex_ratio"), ("cmp", "net_margin"), ("ord", "gross_margin")]),
    ]),
    UnitSpec("u3-profit", 3, "Profit & EPS",
             "From total profit to one share's slice of it, and what taxes take along the way.", [
        L("u3-l1", "Net income", """
**Net income** is the company's profit after every cost, interest payment and tax, the last line of
the income statement. You can reconstruct it from revenue and net margin: **net income = revenue × net
margin**. A company with huge revenue can still earn less than a smaller, more profitable rival. When
net income is negative, the company reported a **net loss** for the year. Losses aren't automatically
bad (young or cyclical companies have them), but they do mean the business consumed value that year
instead of creating it.""",
          [("mc", "net_income"), ("cmp", "net_income"), ("tf", "profitable"), ("ord", "net_income"),
           ("num", "net_income"), ("tf", "net_income"), ("cmp", "net_income")]),
        L("u3-l2", "Earnings per share", """
If you own one share, your slice of the profit is **earnings per share (EPS)** = net income ÷ shares
outstanding. Analysts use **diluted** shares, which count stock options and other securities that could
turn into shares. EPS lets you track profit growth from a single owner's point of view: if a company
repurchases shares, EPS rises even when total profit stays flat. Don't compare EPS *between* companies. A
$20 EPS isn't better than $2 if the share prices are $900 and $50.""",
          [("mc", "eps_calc"), ("num", "eps_calc"), ("tf", "eps_calc"), ("mc", "eps_calc"),
           ("num", "eps_calc"), ("tf", "eps_calc")]),
        L("u3-l3", "EPS growth", """
**EPS growth** = this year's EPS ÷ last year's EPS − 1. It's the per-share version of profit growth and
the number most often quoted in earnings headlines. EPS growth can differ from net income growth because
of **buybacks** (fewer shares means a bigger slice each) or **dilution** (new shares shrink each slice).
Big swings are common after a bad year: going from $0.70 to $7.59 is growth of nearly 1,000%, which says
more about how weak the starting year was than about the future.""",
          [("mc", "eps_growth_yoy"), ("num", "eps_growth_yoy"), ("cmp", "eps_growth_yoy"),
           ("tf", "eps_growth_yoy"), ("ord", "eps_growth_yoy"), ("mc", "eps_growth_yoy")]),
        L("u3-l4", "Taxes: the effective rate", """
Governments take a cut of profits. The **effective tax rate** = income tax ÷ pre-tax income. It's what
the company actually paid, and it often differs from the 21% US federal rate because of foreign
profits, tax credits, and one-time items. A sudden drop in the tax rate can make net income jump
without the business improving at all. That's why analysts also look at operating income, which comes
before tax. Only calculate the rate when pre-tax income is positive; with a loss the ratio is meaningless.""",
          [("mc", "tax_rate"), ("num", "tax_rate"), ("cmp", "tax_rate"), ("tf", "tax_rate"), ("ord", "tax_rate"),
           ("mc", "tax_rate")]),
    ]),
    UnitSpec("u4-cashflow", 4, "Cash flow & FCF",
             "Profit is an opinion, cash is a fact: reading the cash-flow statement.", [
        L("u4-l1", "Cash from operations vs. profit", """
Net income follows accounting rules, which count some costs that aren't paid in cash (like
**depreciation**, the slow write-off of equipment) and some sales that haven't been collected yet.
The cash-flow statement fixes that. **Operating cash flow (OCF)** is the cash the business actually
generated from its operations. Comparing OCF with net income, a ratio we'll call **cash conversion**,
is a quick quality check. Consistently above 1x is a healthy sign; profits that never turn into cash
deserve a closer look.""",
          [("mc", "cash_conversion"), ("num", "cash_conversion"), ("tf", "ocf_gt_ni"), ("cmp", "cash_conversion"),
           ("ord", "cash_conversion"), ("tf", "ocf_gt_ni"), ("mc", "cash_conversion")]),
        L("u4-l2", "Free cash flow", """
Operating cash flow isn't all spare cash: a company must also spend on **capital expenditures
(capex)**, which means factories, equipment, data centers and stores. **Free cash flow (FCF) =
operating cash flow − capex**. It's the cash left over that could pay dividends, repurchase shares,
repay debt or pile up in the bank. The most common slip is adding capex instead of subtracting it. FCF
can be negative in heavy investment years even for a healthy company. What matters is whether the
spending eventually pays off.""",
          [("mc", "free_cash_flow"), ("num", "free_cash_flow"), ("tf", "free_cash_flow"),
           ("cmp", "free_cash_flow"), ("ord", "free_cash_flow"), ("mc", "free_cash_flow")]),
        L("u4-l3", "FCF margin", """
Just like profit margins, you can express free cash flow as a share of revenue: **FCF margin = free
cash flow ÷ revenue**. It tells you how many cents of each sales dollar end up as spare cash after the
company has paid to run *and* reinvest in the business. Asset-light software companies often have FCF
margins above 30%, while retailers and manufacturers are usually in single digits. Comparing FCF margin
with net margin shows whether reported profits are backed by cash.""",
          [("mc", "fcf_margin"), ("num", "fcf_margin"), ("cmp", "fcf_margin"), ("tf", "fcf_margin"),
           ("ord", "fcf_margin"), ("mc", "fcf_margin")]),
        L("u4-l4", "Capex intensity", """
Some businesses need huge, constant investment just to stay competitive. **Capex intensity = capex ÷
revenue** measures how much of each sales dollar goes back into physical assets. Chipmakers building
fabs can spend 30-45% of revenue on capex; a software company might spend under 5%, and much of that on
data centers. High capex intensity isn't bad, but it means less free cash flow per dollar of profit,
and the return on all that spending really matters. You'll measure that return in the next unit.""",
          [("mc", "capex_intensity"), ("num", "capex_intensity"), ("cmp", "capex_intensity"),
           ("tf", "capex_intensity"), ("ord", "capex_intensity"), ("mc", "capex_intensity")]),
    ]),
    UnitSpec("u5-balance", 5, "Balance sheet & debt",
             "What a company owns, what it owes, and whether it can pay its bills.", [
        L("u5-l1", "Assets = liabilities + equity", """
The balance sheet is a snapshot on the last day of the fiscal year. **Assets** are what the company
owns (cash, inventory, factories, patents). **Liabilities** are what it owes (debt, unpaid bills, taxes
due). The difference is **shareholders' equity**: the owners' claim on what's left. It always balances:
**assets = liabilities + equity**, so equity = assets − liabilities. Equity is an accounting number,
not a market price, and buybacks can shrink it a lot even at very profitable companies.""",
          [("mc", "equity_calc"), ("num", "equity_calc"), ("tf", "equity_calc"), ("cmp", "equity_calc"),
           ("ord", "equity_calc"), ("mc", "equity_calc")]),
        L("u5-l2", "Net cash vs. net debt", """
Debt matters less if a company holds a pile of cash to match it. **Net cash = cash − total debt**.
If the result is positive, the company could repay every lender tomorrow and still have money left.
If it's negative, the company has **net debt**. Net debt isn't automatically dangerous: steady
businesses often borrow at low rates on purpose. But in a downturn, net cash gives a company time while net debt
demands interest payments no matter what. You'll use net cash again when you value a company.""",
          [("mc", "net_cash"), ("num", "net_cash"), ("tf", "net_cash_positive"), ("cmp", "net_cash"),
           ("ord", "net_cash"), ("tf", "net_cash_positive"), ("mc", "net_cash")]),
        L("u5-l3", "Debt-to-equity", """
**Debt-to-equity (D/E) = total debt ÷ shareholders' equity**. It shows how much the company leans on
borrowed money compared with the owners' capital. A D/E of 0.2x is conservative; 2x or more is heavy
leverage, which magnifies both good and bad years. Be careful: companies that repurchase lots of stock
shrink their equity, which can push D/E very high even when the debt is easily covered by cash flow.
Always read D/E alongside net cash and cash flow.""",
          [("mc", "debt_to_equity"), ("num", "debt_to_equity"), ("cmp", "debt_to_equity"),
           ("tf", "debt_to_equity"), ("ord", "debt_to_equity"), ("mc", "debt_to_equity")]),
        L("u5-l4", "Current ratio", """
**Current** on a balance sheet means "within about a year." **Current assets** (cash, receivables,
inventory) can be turned into cash soon; **current liabilities** (supplier bills, short-term debt) are
due soon. **Current ratio = current assets ÷ current liabilities**. Above 1x, short-term resources cover
short-term obligations. Below 1x isn't always a warning sign: big retailers collect cash from shoppers
before they pay suppliers, so they run below 1x on purpose. Context matters more than any rule of thumb.""",
          [("mc", "current_ratio"), ("num", "current_ratio"), ("cmp", "current_ratio"), ("tf", "current_ratio"),
           ("ord", "current_ratio"), ("mc", "current_ratio")]),
    ]),
    UnitSpec("u6-returns", 6, "Returns on capital",
             "How much profit a business squeezes out of the money invested in it.", [
        L("u6-l1", "Return on equity (ROE)", """
**Return on equity (ROE) = net income ÷ shareholders' equity**. It answers the question: for every dollar
the owners have in the business (on the books), how much profit did it make this year? Consistently high
ROE often signals a strong business. But ROE has a trap: because equity is in the denominator, anything
that shrinks equity (debt-funded buybacks, large losses in past years) can inflate ROE without the
business getting better. That's why we'll also look at ROA and ROIC.""",
          [("mc", "roe"), ("num", "roe"), ("cmp", "roe"), ("tf", "roe"), ("ord", "roe"), ("mc", "roe")]),
        L("u6-l2", "Return on assets (ROA)", """
**Return on assets (ROA) = net income ÷ total assets**. Instead of just the owners' money, it measures
profit against *everything* the company controls, however it was financed. Banks and asset-heavy
businesses usually have low ROAs (1-5%), while asset-light companies can reach 20% or more. Because ROA
doesn't depend on how much debt a company uses, comparing ROA and ROE tells you how much of the ROE comes
from the business itself and how much comes from leverage.""",
          [("mc", "roa"), ("num", "roa"), ("cmp", "roa"), ("tf", "roa"), ("ord", "roa"), ("mc", "roa")]),
        L("u6-l3", "Return on invested capital (ROIC)", """
**ROIC** is many analysts' favorite quality measure. **Invested capital = debt + equity − cash**: the
money lenders and owners have actually put to work. **ROIC = operating income × (1 − tax rate) ÷
invested capital**. Using after-tax operating income ignores how the company is financed, so ROIC compares
businesses fairly. A company that earns a high ROIC and can keep reinvesting at that rate compounds
value quickly. A company whose ROIC is below its cost of capital destroys value as it grows.""",
          [("mc", "invested_capital"), ("mc", "roic"), ("num", "roic"), ("cmp", "roic"), ("ord", "roic"),
           ("tf", "roic"), ("num", "invested_capital")], xp=15),
        L("u6-l4", "Leverage and ROE", """
Here's the link between the returns: **ROE = ROA × equity multiplier**, where the **equity multiplier =
total assets ÷ equity**. A multiplier of 5x means only one-fifth of the assets are funded by the owners;
the rest is debt and other liabilities. Leverage lifts ROE in good years and deepens the damage in bad
ones. When ROE is far above ROIC, check the balance sheet: the gap is usually debt or buybacks, not a
better business.""",
          [("mc", "equity_multiplier"), ("num", "equity_multiplier"), ("tf", "roe_gt_roic"),
           ("cmp", "equity_multiplier"), ("ord", "equity_multiplier"), ("tf", "roe_gt_roic"),
           ("mc", "equity_multiplier")], xp=15),
    ]),
    UnitSpec("u7-valuation", 7, "Valuation multiples",
             "Bringing in the share price: what the market is paying for each dollar of sales, profit and cash.", [
        L("u7-l1", "Market cap & enterprise value", """
Now we bring in the share price. **Market capitalization = share price × diluted shares**: what the
stock market values all the shares at together. But owning a whole company also means taking on its
debt and getting its cash. **Enterprise value (EV) = market cap + debt − cash** is the price of the whole
business. Two companies with the same market cap can have very different EVs. (Share prices in this app
are sample snapshots for teaching, and valuations move every day.)""",
          [("mc", "market_cap"), ("num", "market_cap"), ("mc", "enterprise_value"), ("num", "enterprise_value"),
           ("cmp", "market_cap"), ("ord", "enterprise_value"), ("tf", "market_cap")]),
        L("u7-l2", "P/E & earnings yield", """
The **price-to-earnings ratio (P/E) = share price ÷ EPS**. A P/E of 25x means the market pays $25 for each
$1 of last year's earnings. Flip it over and you get the **earnings yield** (EPS ÷ price): a P/E of 25x is a
4% earnings yield, which you can line up against a bond or savings rate. A P/E can't be calculated when
earnings are negative. A high P/E usually means the market expects strong growth, and a low one can mean
doubts about the future. It's a starting question, not a verdict.""",
          [("mc", "pe"), ("num", "pe"), ("num", "earnings_yield"), ("cmp", "pe"), ("ord", "pe"), ("tf", "pe"),
           ("mc", "earnings_yield")], xp=15),
        L("u7-l3", "P/S & EV/EBITDA", """
Two more multiples. **Price-to-sales (P/S) = market cap ÷ revenue** works even when a company is losing
money, but a dollar of sales is worth far more at a 70%-margin business than at a 12%-margin one.
**EV/EBITDA = enterprise value ÷ (operating income + depreciation & amortization)** compares the whole
business, debt included, with a rough measure of operating cash earnings. Because it uses EV, it's less
distorted by how much debt a company carries, which makes it popular for comparing companies within an
industry.""",
          [("mc", "ps"), ("num", "ps"), ("mc", "ev_ebitda"), ("num", "ev_ebitda"), ("cmp", "ev_ebitda"),
           ("ord", "ps"), ("tf", "ev_ebitda")], xp=15),
        L("u7-l4", "FCF yield & dividend yield", """
Yields turn multiples upside down so you can compare them with interest rates. **FCF yield = free cash
flow ÷ market cap** is the spare cash the business produced per dollar of market value. **Dividend yield =
dividends paid ÷ market cap** is the part of that cash actually handed to shareholders. A company can have
a low dividend yield but a high FCF yield if it prefers buybacks or reinvestment. A dividend that is larger
than free cash flow has to be funded some other way, usually by borrowing.""",
          [("mc", "fcf_yield"), ("num", "fcf_yield"), ("num", "dividend_yield"), ("cmp", "dividend_yield"),
           ("ord", "fcf_yield"), ("tf", "dividend_yield"), ("mc", "dividend_yield")], xp=15),
        L("u7-l5", "What a P/E implies about growth", """
Every multiple hides an assumption. A handy rough identity: **required return ≈ earnings yield +
growth**. If investors want about 9% a year and a stock's earnings yield is 3% (a P/E of about 33x), the
price only makes sense if earnings grow roughly **6% a year, for a very long time**. So **implied growth
≈ 9% − 1/P/E**. This reverse-engineering doesn't forecast anything. It shows what the current price
already assumes, so you can ask whether that assumption looks reasonable next to the company's history.""",
          [("mc", "implied_growth"), ("num", "implied_growth"), ("tf", "implied_gt_cagr"), ("cmp", "implied_growth"),
           ("ord", "implied_growth"), ("tf", "implied_gt_cagr"), ("mc", "implied_growth")], xp=20),
    ]),
    UnitSpec("u8-intrinsic", 8, "Intrinsic value",
             "Discounted cash flow basics: estimating what a business is worth, and why the estimate is fragile.", [
        L("u8-l1", "A one-line DCF", """
A business is worth the cash it will produce in the future, **discounted** back to today, because a
dollar next year is worth less than a dollar now. The simplest version assumes free cash flow grows at a
steady rate *g* forever and discounts it at a rate *r*: **value = FCF × (1 + g) ÷ (r − g)**. Add net cash
(or subtract net debt) to get the value of the equity, then divide by shares for a per-share figure. We'll
use r = 9% and g = 2.5% throughout. These are assumptions, not facts.""",
          [("mc", "dcf_equity"), ("num", "dcf_equity"), ("mc", "dcf_per_share"), ("num", "dcf_per_share"),
           ("tf", "dcf_per_share"), ("mc", "dcf_per_share")], xp=20),
        L("u8-l2", "A two-stage DCF", """
Most companies don't grow at 2.5% from day one. A **two-stage DCF** lets FCF grow faster for a few years
(here: five years at the company's own 3-year revenue CAGR, capped at 15%), then settles into 2.5% forever.
You discount each of the five years separately, then add a **terminal value** (the one-line formula
applied in year 5) discounted back five years. Notice how much of the total sits in that terminal value:
long-run assumptions dominate every DCF.""",
          [("mc", "dcf2_per_share"), ("num", "dcf2_per_share"), ("tf", "dcf2_per_share"), ("mc", "dcf2_per_share"),
           ("num", "dcf2_per_share")], xp=20),
        L("u8-l3", "Price vs. estimate & sensitivity", """
Once you have an estimate of value, you can compare it with the share price: **price ÷ estimate − 1**.
Investors call a gap between value and price a **margin of safety**, a cushion for being wrong. But
be humble about the estimate. Changing the discount rate from 10% to 8% can raise a one-line DCF by 40%
or more, because *r − g* is a small number. A big gap between price and model usually means the market
assumes something different from your model, so question the assumptions before trusting the answer.""",
          [("mc", "price_vs_dcf"), ("num", "price_vs_dcf"), ("num", "dcf_rate_sensitivity"),
           ("mc", "dcf_rate_sensitivity"), ("tf", "price_vs_dcf"), ("mc", "price_vs_dcf")], xp=20),
        L("u8-l4", "Cycles: why one DCF can mislead", """
Some industries, such as memory chips, commodities and autos, move in **cycles**. When supply is tight,
prices and margins soar; when capacity catches up, they collapse, sometimes into losses. A DCF built on a
peak year multiplies that peak into the far future, so it can overstate value many times over. Built on a
trough year, it can understate it. The fix is to look at the full history and use a **normalized**,
cycle-average cash flow. This lesson uses real 5-10 year histories to measure how big the swings are.""",
          [("mc", "fcf_peak_to_avg"), ("num", "fcf_peak_to_avg"), ("mc", "gm_range"), ("num", "gm_range"),
           ("tf", "had_loss_year"), ("cmp", "gm_range"), ("ord", "gm_range"), ("tf", "had_loss_year")], xp=20),
    ]),
]
