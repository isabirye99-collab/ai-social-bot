export default function Reports(){
 return <>
  <div className="crm-page-heading"><div><h1>Reports & Analytics</h1><p>Understand performance and make data-driven decisions.</p></div><button className="crm-btn secondary">Export Report</button></div>
  <div className="crm-kpis">
   <div className="crm-kpi"><span className="crm-kpi-label">Lead Conversion</span><div className="crm-kpi-value">24.6%</div><span className="crm-kpi-change">↗ 5.4%</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Revenue</span><div className="crm-kpi-value">UGX 48.6M</div><span className="crm-kpi-change">↗ 12.8%</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Average Deal</span><div className="crm-kpi-value">UGX 1.43M</div><span className="crm-kpi-change">↗ 7.2%</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Response Rate</span><div className="crm-kpi-value">78.2%</div><span className="crm-kpi-change">↗ 4.6%</span></div>
  </div>
  <div className="crm-grid crm-grid-2">
   <div className="crm-card"><div className="crm-card-header"><h2>Monthly Performance</h2><span>2026</span></div><div className="crm-card-body"><div className="crm-chart">{[38,51,44,60,54,72,84,68,91].map((x,i)=><div key={i} className="crm-bar" style={{height:`${x}%`}}/>)}</div></div></div>
   <div className="crm-card"><div className="crm-card-header"><h2>Lead Sources</h2><span>Distribution</span></div><div className="crm-card-body" style={{display:"grid",gap:17}}>{[{name:"Website",value:42},{name:"WhatsApp",value:27},{name:"Referrals",value:18},{name:"Social Media",value:13}].map(x=><div key={x.name}><div style={{display:"flex",justifyContent:"space-between",fontSize:11}}><strong>{x.name}</strong><span>{x.value}%</span></div><div className="crm-progress"><div style={{width:`${x.value*2}%`}}/></div></div>)}</div></div>
  </div>
 </>
}

