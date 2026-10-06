const tasks=[
 ["Call John Kato","Lead follow-up","Today • 10:00 AM","High"],
 ["Send MPH fee structure","Amina Mohamed","Today • 11:30 AM","High"],
 ["Follow up BBA applicant","Sarah Namukasa","Today • 2:00 PM","Medium"],
 ["Complete BIT registration","Daniel Okello","Today • 4:00 PM","High"],
 ["Review new website leads","Marketing Team","Tomorrow • 9:00 AM","Medium"],
 ["Prepare school outreach list","Business Development","Tomorrow • 2:00 PM","Low"],
];

export default function Tasks(){
 return <>
  <div className="crm-page-heading"><div><h1>Tasks & Follow-ups</h1><p>Stay on top of activities and never miss an opportunity.</p></div><button className="crm-btn">+ New Task</button></div>
  <div className="crm-kpis">
   <div className="crm-kpi"><span className="crm-kpi-label">Due Today</span><div className="crm-kpi-value">17</div><span className="crm-kpi-change">Needs attention</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Overdue</span><div className="crm-kpi-value">4</div><span className="crm-kpi-change">Requires action</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Completed</span><div className="crm-kpi-value">126</div><span className="crm-kpi-change">This month</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Completion Rate</span><div className="crm-kpi-value">88%</div><span className="crm-kpi-change">↗ 4.2%</span></div>
  </div>
  <div className="crm-card"><div className="crm-card-header"><div><h2>My Tasks</h2><span>Today's priority activities</span></div><span>All tasks ▾</span></div><div className="crm-card-body">
  {tasks.map(t=><div className="crm-task" key={t[0]}><div className="crm-check"/><div style={{flex:1}}><strong>{t[0]}</strong><small>{t[1]} • {t[2]}</small></div><span className={`crm-badge ${t[3]==="High"?"red":t[3]==="Medium"?"yellow":""}`}>{t[3]}</span></div>)}
  </div></div>
 </>
}
