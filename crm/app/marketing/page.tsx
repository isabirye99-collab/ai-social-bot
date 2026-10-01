export default function Marketing(){
 return <>
  <div className="crm-page-heading"><div><h1>Marketing</h1><p>Monitor campaigns, channels and lead generation.</p></div><button className="crm-btn">+ New Campaign</button></div>
  <div className="crm-kpis">
   <div className="crm-kpi"><span className="crm-kpi-label">Active Campaigns</span><div className="crm-kpi-value">8</div><span className="crm-kpi-change">Across 5 channels</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Leads Generated</span><div className="crm-kpi-value">1,284</div><span className="crm-kpi-change">↗ 21.4%</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Conversion Rate</span><div className="crm-kpi-value">14.8%</div><span className="crm-kpi-change">↗ 3.1%</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Campaign Spend</span><div className="crm-kpi-value">UGX 8.4M</div><span className="crm-kpi-change">This month</span></div>
  </div>
  <div className="crm-grid crm-grid-3">
   {[
    ["August Intake Campaign","Facebook • WhatsApp","542 leads","Active"],
    ["Nursing Recruitment","TikTok • Radio","318 leads","Active"],
    ["International Students","Website • Email","176 leads","Active"],
   ].map(c=><div className="crm-card" key={c[0]}><div className="crm-card-body"><span className="crm-badge">{c[3]}</span><h3 style={{margin:"14px 0 6px"}}>{c[0]}</h3><p style={{fontSize:11,color:"var(--muted)"}}>{c[1]}</p><div style={{fontSize:24,fontWeight:800,marginTop:18}}>{c[2]}</div><small style={{color:"var(--muted)"}}>Generated</small></div></div>)}
  </div>
 </>
}
