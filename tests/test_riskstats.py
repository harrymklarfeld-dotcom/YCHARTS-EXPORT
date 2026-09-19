import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from portfolio import riskstats as rs
from datetime import date, timedelta

def series(fn, n=1400, start=date(2020,1,1)):
    out,d,i=[],start,0
    while len(out)<n:
        if d.weekday()<5: out.append((d.isoformat(), max(0.01,fn(i)))); i+=1
        d+=timedelta(days=1)
    return out

def test_trailing_and_maxdd():
    s=series(lambda i: 100*(1.0003)**i)   # steady uptrend
    tr=rs.trailing_returns(s)
    assert tr["1Y"]>0 and tr["3Y"]>0
    assert rs.max_drawdown(s) > -1.0        # tiny drawdown on a smooth uptrend
    down=series(lambda i: 100-0.02*i)
    assert rs.max_drawdown(down) < -5

def test_vol_sharpe_sortino_var():
    s=series(lambda i: 100*(1.0002)**i)
    assert rs.volatility(s) is not None and rs.volatility(s) >= 0
    assert rs.sharpe(s) is not None
    assert rs.value_at_risk(s) is not None

def test_beta_alpha_vs_self_is_one():
    s=series(lambda i: 100*(1.0004)**i + (i%7))
    beta,alpha=rs.beta_alpha(s,s)
    assert abs(beta-1.0)<1e-6 and abs(alpha)<1e-6

def test_annual_returns_keys():
    s=series(lambda i:100+0.05*i, n=1000, start=date(2022,1,3))
    a=rs.annual_returns(s)
    assert "2022" in a and "2023" in a

if __name__=="__main__":
    for k,v in list(globals().items()):
        if k.startswith("test_"): v(); print("ok",k)
