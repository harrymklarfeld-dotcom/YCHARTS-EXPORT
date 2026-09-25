"""us-gaap tag -> contract field mapping, with ordered fallbacks.

Resolution is per fiscal year: for each year the first tag in the list that has an
annual 10-K value wins. That handles filers that switched tags over time (e.g.
SalesRevenueNet before ASC 606, RevenueFromContractWithCustomer... after).
"""
from __future__ import annotations

USD, EPS_UNIT, SHARES = "USD", "USD/shares", "shares"

# field: (kind, unit, [tags...])   kind: "flow" (duration ~1y) | "instant" (balance sheet)
FIELD_TAGS: dict[str, tuple[str, str, list[str]]] = {
    "revenue": ("flow", USD, [
        "Revenues",
        "RevenueFromContractWithCustomerExcludingAssessedTax",
        "RevenueFromContractWithCustomerIncludingAssessedTax",
        "SalesRevenueNet",
        "SalesRevenueGoodsNet",
        "RevenuesNetOfInterestExpense",
    ]),
    "cost_of_revenue": ("flow", USD, [
        "CostOfRevenue",
        "CostOfGoodsAndServicesSold",
        "CostOfGoodsSold",
        "CostOfGoodsAndServiceExcludingDepreciationDepletionAndAmortization",
    ]),
    "gross_profit": ("flow", USD, ["GrossProfit"]),
    "operating_income": ("flow", USD, ["OperatingIncomeLoss"]),
    "net_income": ("flow", USD, [
        "NetIncomeLoss",
        "NetIncomeLossAvailableToCommonStockholdersBasic",
        "ProfitLoss",
    ]),
    "eps_diluted": ("flow", EPS_UNIT, ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"]),
    "shares_diluted": ("flow", SHARES, [
        "WeightedAverageNumberOfDilutedSharesOutstanding",
        "WeightedAverageNumberOfShareOutstandingBasicAndDiluted",
    ]),
    "operating_cash_flow": ("flow", USD, [
        "NetCashProvidedByUsedInOperatingActivities",
        "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
    ]),
    "capex": ("flow", USD, [
        "PaymentsToAcquirePropertyPlantAndEquipment",
        "PaymentsToAcquireProductiveAssets",
        "PaymentsForCapitalImprovements",
        "PaymentsToAcquireOtherPropertyPlantAndEquipment",
    ]),
    "dividends_paid": ("flow", USD, [
        "PaymentsOfDividends",
        "PaymentsOfDividendsCommonStock",
        "PaymentsOfOrdinaryDividends",
    ]),
    "d_and_a": ("flow", USD, [
        "DepreciationDepletionAndAmortization",
        "DepreciationAmortizationAndAccretionNet",
        "DepreciationAndAmortization",
        "DepreciationAmortizationAndOther",
        "Depreciation",
    ]),
    "income_tax": ("flow", USD, ["IncomeTaxExpenseBenefit"]),
    "pretax_income": ("flow", USD, [
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
        "IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic",
    ]),
    "cash": ("instant", USD, [
        "CashAndCashEquivalentsAtCarryingValue",
        "CashAndDueFromBanks",
        "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
        "Cash",
    ]),
    "total_assets": ("instant", USD, ["Assets"]),
    "total_liabilities": ("instant", USD, ["Liabilities"]),
    "total_equity": ("instant", USD, [
        "StockholdersEquity",
        "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    ]),
    "current_assets": ("instant", USD, ["AssetsCurrent"]),
    "current_liabilities": ("instant", USD, ["LiabilitiesCurrent"]),
    "inventory": ("instant", USD, ["InventoryNet", "InventoryGross", "InventoryFinishedGoods"]),
}

# Helper (non-contract) inputs used to derive composite fields.
HELPER_TAGS: dict[str, tuple[str, str, list[str]]] = {
    # debt
    "lt_debt_noncurrent": ("instant", USD, [
        "LongTermDebtNoncurrent",
        "LongTermDebtAndCapitalLeaseObligations",
        "LongTermDebtAndFinanceLeaseObligationsNoncurrent",
    ]),
    "lt_debt_total": ("instant", USD, ["LongTermDebt"]),  # includes current maturities
    "lt_debt_current": ("instant", USD, [
        "LongTermDebtCurrent",
        "LongTermDebtAndCapitalLeaseObligationsCurrent",
    ]),
    "debt_current": ("instant", USD, ["DebtCurrent"]),  # all current debt incl. short-term borrowings
    "short_term_debt": ("instant", USD, ["CommercialPaper", "ShortTermBorrowings"]),
    # liabilities fallback
    "liab_and_equity": ("instant", USD, ["LiabilitiesAndStockholdersEquity"]),
    "equity_incl_nci": ("instant", USD, ["StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"]),
}

ALL_TAGS = {**FIELD_TAGS, **HELPER_TAGS}

FUNDAMENTAL_FIELDS = [
    "revenue", "cost_of_revenue", "gross_profit", "operating_income", "net_income", "eps_diluted",
    "shares_diluted", "operating_cash_flow", "capex", "free_cash_flow", "dividends_paid",
    "cash", "total_assets", "total_liabilities", "total_equity", "total_debt", "current_assets",
    "current_liabilities", "inventory", "d_and_a", "income_tax", "pretax_income",
]
