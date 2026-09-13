import sys, os, json, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from portfolio import edgar, macro, valuation_gauge as vg

def test_edgar_annual_and_latest():
    facts={"facts":{"us-gaap":{
      "Revenues":{"units":{"USD":[
        {"fy":2024,"fp":"FY","form":"10-K","end":"2024-08-31","val":25e9},
        {"fy":2025,"fp":"FY","form":"10-K","end":"2025-08-31","val":37e9},
        {"fy":2025,"fp":"Q1","form":"10-Q","end":"2025-11-30","val":10e9}]}}}}}
    a=edgar._annual(facts, edgar.CONCEPTS["revenue"])
    assert a=={2024:25e9,2025:37e9}                 # only FY 10-K rows
    assert edgar._latest(facts, edgar.CONCEPTS["revenue"])==10e9   # latest by end date

def test_macro_stats():
    rows=[(f"2026-01-{i:02d}",10.0+i) for i in range(1,28)]
    s=macro._stats(rows)
    assert s["last"]==rows[-1][1] and s["yr_high"]==rows[-1][1]
    assert 0<=s["pctile_1y"]<=100

def test_macro_regime_shape():
    # offline: fetch will fail (no network) but regime() must not crash and returns a label
    r=macro.regime()
    assert "regime" in r and "series" in r

def test_gauge_flags_expensive(tmpdir=None):
    os.makedirs("data/fundamentals",exist_ok=True)
    json.dump({"ticker":"ZZZ","as_of":"2026-09-13","annual":[
      {"fy":2024,"eps":1.0,"equity":10e9,"shares":1e9,"fcf":0.5e9},
      {"fy":2025,"eps":1.2,"equity":11e9,"shares":1e9,"fcf":0.6e9}]},
      open("data/fundamentals/ZZZ.json","w"))
    vg._price_now=lambda t:(500.0,{ "2024-12-30":50,"2025-12-30":480})
    g=vg.gauge("ZZZ")
    assert g["verdict"] in ("Expensive","Fair","Cheap")
    assert g["blended_margin_pct"] < 0            # price 500 vs ~1.2 eps -> expensive
    os.remove("data/fundamentals/ZZZ.json")

if __name__=="__main__":
    for k,v in list(globals().items()):
        if k.startswith("test_"): v(); print("ok",k)
