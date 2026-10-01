type PipelineStage = [string, string[], string[]];

const stages: PipelineStage[] = [
 ["New",["BBA Application","Nursing Direct"],["UGX 3.2M","UGX 5.1M"]],
 ["Contacted",["MBA Enquiry","BIT Applicant"],["UGX 4.8M","UGX 2.6M"]],
 ["Qualified",["MPH Admission","Nursing Top-Up"],["UGX 7.2M","UGX 5.4M"]],
 ["Proposal",["Corporate Training","Public Health Group"],["UGX 9.5M","UGX 6.8M"]],
 ["Won",["CIU Registration","MBA Registration"],["UGX 4.2M","UGX 6.1M"]]
];

export default function Pipeline(){
 return <>
  <div className="crm-page-heading"><div><h1>Sales Pipeline</h1><p>Track opportunities from first contact to conversion.</p></div><button className="crm-btn">+ New Deal</button></div>
  <div className="crm-kpis">
   <div className="crm-kpi"><span className="crm-kpi-label">Pipeline Value</span><div className="crm-kpi-value">UGX 58.4M</div><span className="crm-kpi-change">34 open deals</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Expected Revenue</span><div className="crm-kpi-value">UGX 38.2M</div><span className="crm-kpi-change">65% weighted</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Won This Month</span><div className="crm-kpi-value">UGX 14.6M</div><span className="crm-kpi-change">↗ 16.4%</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Conversion</span><div className="crm-kpi-value">31.4%</div><span className="crm-kpi-change">Current rate</span></div>
  </div>
  <div className="crm-pipeline">
   {stages.map(([stage,deals,values])=><div className="crm-stage" key={String(stage)}>
    <div className="crm-stage-head"><strong>{stage}</strong><span>{deals.length} deals</span></div>
    {deals.map((deal,i)=><div className="crm-deal" key={deal}><strong>{deal}</strong><small>Business opportunity</small><div className="crm-deal-value">{values[i]}</div><div className="crm-progress"><div style={{width:`${25+i*25}%`}}/></div></div>)}
   </div>)}
  </div>
 </>
}





