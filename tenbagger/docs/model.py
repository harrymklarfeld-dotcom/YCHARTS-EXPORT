import json
S = {
 "bear": dict(inst0=800,  g=0.04, conv=0.015, ann_share=0.50, p_m=9.99,  p_a=59.99,  ret_m12=0.095, ann_renew=0.307, paid_share=0.25, cpi=5.00, link_share=0.20, agg=2.50, data=450),
 "base": dict(inst0=1500, g=0.07, conv=0.025, ann_share=0.60, p_m=12.99, p_a=79.99,  ret_m12=0.17, ann_renew=0.44, paid_share=0.30, cpi=3.50, link_share=0.30, agg=1.50, data=400),
 "bull": dict(inst0=3000, g=0.09, conv=0.040, ann_share=0.65, p_m=14.99, p_a=99.99,  ret_m12=0.25, ann_renew=0.54, paid_share=0.30, cpi=2.50, link_share=0.40, agg=1.25, data=350),
}
FEE=0.15; LINK_START=13; FOUNDER=5000
def run(p):
    cm = 1-p["ret_m12"]**(1/12)
    monthly=0.0; ann_cohorts={}  # start month -> count
    rows=[]; cum=0; cum_inst=0; mau_tail=0.0
    be_op=None; be_ramen=None; trough=0
    for m in range(1,37):
        inst=p["inst0"]*(1+p["g"])**(m-1); cum_inst+=inst
        new=inst*p["conv"]
        monthly=monthly*(1-cm)+new*(1-p["ann_share"])
        # annual renewals
        for s in list(ann_cohorts):
            if (m-s)%12==0 and m!=s:
                ann_cohorts[s]*=p["ann_renew"]
        ann_cohorts[m]=new*p["ann_share"]
        annual=sum(ann_cohorts.values())
        paid=monthly+annual
        rev=monthly*p["p_m"]+annual*p["p_a"]/12   # recognized MRR
        mau=inst+mau_tail; mau_tail=(mau_tail*0.93)+inst*0.25
        store=rev*FEE
        rc=max(0,(rev-2500))*0.01
        data=p["data"]
        agg=(paid*p["link_share"]*p["agg"]+100) if m>=LINK_START else 0
        host=50+0.01*mau
        tools=150+10   # legal/misc + dev accounts
        mkt=inst*p["paid_share"]*p["cpi"]
        cost=store+rc+data+agg+host+tools+mkt
        net=rev-cost; cum+=net; trough=min(trough,cum)
        if be_op is None and net>=0: be_op=m
        if be_ramen is None and net>=FOUNDER: be_ramen=m
        rows.append(dict(m=m,inst=round(inst),cum_inst=round(cum_inst),mau=round(mau),paid=round(paid),rev=round(rev),store=round(store),data=data,agg=round(agg),host=round(host),mkt=round(mkt),other=round(tools+rc),net=round(net),cum=round(cum)))
    return rows,be_op,be_ramen,round(trough),cm
out={}
for k,p in S.items():
    rows,bo,br,tr,cm=run(p); out[k]=dict(rows=rows,be_op=bo,be_ramen=br,trough=tr,cm=cm)
    print(k,"churn_m=%.3f"%cm,"BE_op",bo,"BE_ramen",br,"trough",tr)
    for r in rows:
        if r["m"] in (1,6,12,18,24,30,36): print(r)
    print("Y1 rev",sum(r["rev"] for r in rows[:12]),"Y2",sum(r["rev"] for r in rows[12:24]),"Y3",sum(r["rev"] for r in rows[24:]))
    print("Y3 net",sum(r["net"] for r in rows[24:]))
json.dump(out,open("/tmp/claude-0/-home-user-YCHARTS-EXPORT/9b917b63-e332-5d79-9136-67e03d9d7099/scratchpad/model.json","w"))
print()
for k,p in S.items():
    cm=1-p["ret_m12"]**(1/12)
    ltv_m=p["p_m"]*(1-FEE)/cm
    ltv_a=p["p_a"]*(1-FEE)/(1-p["ann_renew"])
    ltv=ltv_m*(1-p["ann_share"])+ltv_a*p["ann_share"]
    cac=p["cpi"]/p["conv"]
    arpu=(p["p_m"]*(1-p["ann_share"])+p["p_a"]/12*p["ann_share"])
    print(k,"gross ARPPU/mo %.2f net %.2f"%(arpu,arpu*.85),"LTV_m %.0f LTV_a %.0f blended %.0f"%(ltv_m,ltv_a,ltv),"CAC/paid %.0f"%cac,"LTV/CAC %.2f"%(ltv/cac),"maxCPI %.2f"%(ltv*p["conv"]))
    o=out[k]
    print("| Month | Installs/mo | Cum. installs | MAU (est.) | Paid subs | Paid/MAU | MRR | Store fee | Data | Aggregation | Hosting | Paid UA | Other | Net/mo | Cumulative |")
    for r in o["rows"]:
        if r["m"] in (1,6,12,18,24,30,36):
            print(f'| {r["m"]} | {r["inst"]:,} | {r["cum_inst"]:,} | {r["mau"]:,} | {r["paid"]:,} | {r["paid"]/r["mau"]*100:.1f}% | ${r["rev"]:,} | ${r["store"]:,} | ${r["data"]:,} | ${r["agg"]:,} | ${r["host"]:,} | ${r["mkt"]:,} | ${r["other"]:,} | ${r["net"]:,} | ${r["cum"]:,} |')
    rows=o["rows"]
    print("Y1/Y2/Y3 revenue", sum(r["rev"] for r in rows[:12]),sum(r["rev"] for r in rows[12:24]),sum(r["rev"] for r in rows[24:]), "M36 ARR", rows[-1]["rev"]*12)
    # breakeven sustained
    print("cum breakeven month", next((r["m"] for r in rows if r["cum"]>=0 and r["m"]>1),None))
