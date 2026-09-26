"""Tiny companyfacts builders for unit tests."""


def fact(val, end, start=None, fy=None, fp="FY", form="10-K", filed=None):
    e = {"end": end, "val": val, "fy": fy or int(end[:4]), "fp": fp, "form": form,
         "filed": filed or f"{int(end[:4])}-{end[5:7]}-28"}
    if start:
        e["start"] = start
    return e


def doc(tags: dict, unit_overrides: dict | None = None) -> dict:
    """tags: {TagName: [facts]} -> companyfacts document (USD unless overridden)."""
    unit_overrides = unit_overrides or {}
    return {"cik": 1, "entityName": "TEST CO", "facts": {"us-gaap": {
        t: {"label": t, "units": {unit_overrides.get(t, "USD"): rows}} for t, rows in tags.items()}}}
