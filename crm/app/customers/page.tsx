const customers=[
 ["JK","John Kato","Bachelor of Nursing","Active","UGX 4.2M"],
 ["AM","Amina Mohamed","Master of Public Health","Active","UGX 6.8M"],
 ["DO","Daniel Okello","BIT","New","UGX 2.4M"],
 ["FN","Faith Nankunda","Midwifery","Active","UGX 3.1M"],
 ["SM","Sarah Mugisha","MBA","Inactive","UGX 5.6M"],
];

export default function Customers(){
 return <>
  <div className="crm-page-heading"><div><h1>Customers</h1><p>Manage your active customers and their relationships.</p></div><button className="crm-btn">+ Add Customer</button></div>
  <div className="crm-kpis">
   <div className="crm-kpi"><span className="crm-kpi-label">Total Customers</span><div className="crm-kpi-value">86</div><span className="crm-kpi-change">↗ 8.7%</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Active</span><div className="crm-kpi-value">72</div><span className="crm-kpi-change">83.7%</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">New This Month</span><div className="crm-kpi-value">14</div><span className="crm-kpi-change">↗ 18%</span></div>
   <div className="crm-kpi"><span className="crm-kpi-label">Customer Value</span><div className="crm-kpi-value">UGX 184M</div><span className="crm-kpi-change">Lifetime value</span></div>
  </div>
  <div className="crm-card">
   <div className="crm-filterbar"><input placeholder="🔍 Search customers..." /><select><option>All Customers</option><option>Active</option><option>Inactive</option></select></div>
   <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Customer</th><th>Program</th><th>Status</th><th>Value</th><th>Last Activity</th><th>Action</th></tr></thead><tbody>
   {customers.map(c=><tr key={c[1]}><td><strong>{c[0]} &nbsp; {c[1]}</strong></td><td>{c[2]}</td><td><span className={`crm-badge ${c[3]==="Inactive"?"red":""}`}>{c[3]}</span></td><td>{c[4]}</td><td>2 days ago</td><td>⋮</td></tr>)}
   </tbody></table></div>
  </div>
 </>
}
