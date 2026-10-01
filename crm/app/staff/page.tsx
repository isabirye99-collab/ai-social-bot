const staff=[["NI","Nicholas Isabirye","Business Development","Admin","Active"],["SK","Stuart Kato","Admissions","Manager","Active"],["BK","Bruno Kintu","Marketing","Officer","Active"],["VM","Vivian Kayaga","Alumni Relations","Officer","Active"],["SS","Godfrey Ssentamu","Student Recruitment","Agent","Active"]];

export default function Staff(){
 return <>
  <div className="crm-page-heading"><div><h1>Staff & Team</h1><p>Manage team members, roles and assignments.</p></div><button className="crm-btn">+ Add Staff</button></div>
  <div className="crm-grid crm-grid-3" style={{marginBottom:18}}>
   {staff.slice(0,3).map(s=><div className="crm-card" key={s[1]}><div className="crm-card-body" style={{display:"flex",gap:13,alignItems:"center"}}><div className="crm-avatar">{s[0]}</div><div><strong style={{fontSize:13}}>{s[1]}</strong><div style={{fontSize:10,color:"var(--muted)",marginTop:4}}>{s[2]}</div><span className="crm-badge" style={{marginTop:8}}>{s[4]}</span></div></div></div>)}
  </div>
  <div className="crm-card"><div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Staff Member</th><th>Department</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{staff.map(s=><tr key={s[1]}><td><strong>{s[0]} &nbsp; {s[1]}</strong></td><td>{s[2]}</td><td>{s[3]}</td><td><span className="crm-badge">{s[4]}</span></td><td>⋮</td></tr>)}</tbody></table></div></div>
 </>
}
