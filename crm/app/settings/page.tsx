export default function Settings(){
 return <>
  <div className="crm-page-heading"><div><h1>Settings</h1><p>Configure your CRM and organization preferences.</p></div><button className="crm-btn">Save Changes</button></div>
  <div className="crm-grid crm-grid-2">
   <div className="crm-card"><div className="crm-card-header"><h2>Organization</h2></div><div className="crm-card-body" style={{display:"grid",gap:14}}>
    <div className="crm-stat-box"><span>Organization Name</span><strong style={{fontSize:14}}>Clarke International University</strong></div>
    <div className="crm-stat-box"><span>CRM Name</span><strong style={{fontSize:14}}>CIU Business CRM</strong></div>
    <div className="crm-stat-box"><span>Default Currency</span><strong style={{fontSize:14}}>UGX — Ugandan Shilling</strong></div>
   </div></div>
   <div className="crm-card"><div className="crm-card-header"><h2>Preferences</h2></div><div className="crm-card-body" style={{display:"grid",gap:14}}>
    {["Email notifications","Lead follow-up reminders","Weekly performance reports","Marketing alerts"].map((x,i)=><div key={x} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 0",borderBottom:"1px solid var(--border)",fontSize:12}}><span>{x}</span><input type="checkbox" defaultChecked={i<3}/></div>)}
   </div></div>
  </div>
 </>
}
