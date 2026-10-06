"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Lead = {
  id: string;
  ciu_number: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  product_service: string | null;
  status: string | null;
  follow_up_status: string | null;
  next_follow_up_at: string | null;
  created_at: string | null;
};

const leadStatusMap: Record<string, string> = {
  Pending: "new",
  Called: "contacted",
  WhatsApped: "contacted",
  "Email sent": "contacted",
  Interested: "qualified",
  "Not interested": "unqualified",
  "Follow up later": "contacted",
  Converted: "converted",
  "Paid Fees": "converted",
  "Financial issues": "unqualified",
  "Lost Leads": "lost",
  Dropped: "lost",
  "Ineffective Data": "unqualified",
  Unreachable: "unqualified",
  "No Answer": "contacted",
};
export default function Leads() {
  const supabase = createClient();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [programFilter, setProgramFilter] = useState("All Programs");
const [showAddLead, setShowAddLead] = useState(false);
const [savingLead, setSavingLead] = useState(false);

const [newLead, setNewLead] = useState({
  name: "",
  phone: "",
  email: "",
  product_service: "",
  status: "Pending",
  follow_up_status: "Pending",
});

  useEffect(() => {
    async function loadLeads() {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, ciu_number, name, phone, email, product_service, status, follow_up_status, next_follow_up_at, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase leads error:", error);
        setErrorMessage(error.message);
        setLeads([]);
      } else {
        setLeads((data as Lead[]) || []);
      }

      setLoading(false);
    }

    loadLeads();
  }, [supabase]);

  const statuses = useMemo(() => {
    const values = leads
      .map((lead) => lead.follow_up_status || lead.status || "")
      .filter(Boolean);

    return ["All Statuses", ...Array.from(new Set(values))];
  }, [leads]);

  const programs = useMemo(() => {
    const values = leads
      .map((lead) => lead.product_service || "")
      .filter(Boolean);

    return ["All Programs", ...Array.from(new Set(values))];
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const status = lead.follow_up_status || lead.status || "";
      const program = lead.product_service || "";

      const matchesSearch =
        !query ||
        [
          lead.name,
          lead.phone,
          lead.email,
          lead.ciu_number,
          lead.product_service,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "All Statuses" || status === statusFilter;

      const matchesProgram =
        programFilter === "All Programs" || program === programFilter;

      return matchesSearch && matchesStatus && matchesProgram;
    });
  }, [leads, search, statusFilter, programFilter]);

  const interestedCount = leads.filter(
    (lead) =>
      (lead.follow_up_status || lead.status || "").toLowerCase() ===
      "interested"
  ).length;

  const followUpCount = leads.filter((lead) => {
    const status = (lead.follow_up_status || lead.status || "").toLowerCase();

    return (
      status.includes("follow") ||
      status === "pending" ||
      Boolean(lead.next_follow_up_at)
    );
  }).length;

  const convertedCount = leads.filter((lead) => {
    const status = (lead.follow_up_status || lead.status || "").toLowerCase();

    return status === "converted";
  }).length;
  async function handleAddLead(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newLead.name.trim()) {
      alert("Please enter the lead's full name.");
      return;
    }

    setSavingLead(true);

    const { error } = await supabase.from("leads").insert({
      name: newLead.name.trim(),
      phone: newLead.phone.trim() || null,
      email: newLead.email.trim() || null,
      product_service: newLead.product_service.trim() || null,
      status: leadStatusMap[newLead.status] || "new",
      follow_up_status: newLead.follow_up_status,
    });

    if (error) {
      console.error("Error adding lead:", error);
      alert(`Unable to add lead: ${error.message}`);
      setSavingLead(false);
      return;
    }

    setNewLead({
      name: "",
      phone: "",
      email: "",
      product_service: "",
      status: "Pending",
      follow_up_status: "Pending",
    });

    setShowAddLead(false);
    setSavingLead(false);

    const { data } = await supabase
      .from("leads")
      .select(
        "id, ciu_number, name, phone, email, product_service, status, follow_up_status, next_follow_up_at, created_at"
      )
      .order("created_at", { ascending: false });

    setLeads((data as Lead[]) || []);
  }

  function displayDate(date: string | null) {
    if (!date) return "—";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return "—";

    return parsed.toLocaleDateString("en-UG", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function badgeClass(status: string) {
    const value = status.toLowerCase();

    if (value === "converted" || value === "paid fees") return "green";
    if (value === "interested") return "green";
    if (value.includes("follow") || value === "pending") return "yellow";
    if (value === "not interested" || value === "lost leads") return "red";

    return "";
  }

  return (
    <>
      <div className="crm-page-heading">
        <div>
          <h1>Leads</h1>
          <p>Manage prospects, conversations and follow-ups.</p>
        </div>

      <div
  className="crm-actions"
  style={{
    display: "flex",
    gap: "9px",
    flexWrap: "wrap",
    alignItems: "center",
  }}
>
  <button
    className="crm-btn secondary"
    type="button"
    style={{
      display: "inline-block",
      visibility: "visible",
      opacity: 1,
    }}
  >
    Export
  </button>

  <button
    className="crm-btn"
    type="button"
    onClick={() => setShowAddLead(true)}
    style={{
      display: "inline-block",
      visibility: "visible",
      opacity: 1,
    }}
  >
    + Add New Lead
  </button>
</div>
</div>

      {showAddLead && (
        <div
          className="crm-card"
          style={{
            marginBottom: "20px",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
            }}
          >
            <div>
              <h2 style={{ margin: 0 }}>Add New Lead</h2>
              <p style={{ margin: "6px 0 0", color: "#667085" }}>
                Enter the lead's details below.
              </p>
            </div>

            <button
              type="button"
              className="crm-btn secondary"
              onClick={() => setShowAddLead(false)}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleAddLead}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              <div>
                <label>Full Name *</label>
                <input
                  required
                  value={newLead.name}
                  onChange={(event) =>
                    setNewLead({
                      ...newLead,
                      name: event.target.value,
                    })
                  }
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label>Telephone Number</label>
                <input
                  value={newLead.phone}
                  onChange={(event) =>
                    setNewLead({
                      ...newLead,
                      phone: event.target.value,
                    })
                  }
                  placeholder="+256..."
                />
              </div>

              <div>
                <label>Email Address</label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={(event) =>
                    setNewLead({
                      ...newLead,
                      email: event.target.value,
                    })
                  }
                  placeholder="example@email.com"
                />
              </div>

              <div>
                <label>Program / Product</label>
                <input
                  value={newLead.product_service}
                  onChange={(event) =>
                    setNewLead({
                      ...newLead,
                      product_service: event.target.value,
                    })
                  }
                  placeholder="e.g. Bachelor of Nursing"
                />
              </div>

              <div>
                <label>Status</label>
                <select
                  value={newLead.status}
                  onChange={(event) =>
                    setNewLead({
                      ...newLead,
                      status: event.target.value,
                    })
                  }
                >
                  <option>Pending</option>
                  <option>Called</option>
                  <option>WhatsApped</option>
                  <option>Email sent</option>
                  <option>Interested</option>
                  <option>Not interested</option>
                  <option>Follow up later</option>
                  <option>Converted</option>
                  <option>Paid Fees</option>
                  <option>Financial issues</option>
                  <option>Lost Leads</option>
                  <option>Dropped</option>
                  <option>Unreachable</option>
                  <option>No Answer</option>
                </select>
              </div>

              <div>
                <label>Follow Up</label>
                <select
                  value={newLead.follow_up_status}
                  onChange={(event) =>
                    setNewLead({
                      ...newLead,
                      follow_up_status: event.target.value,
                    })
                  }
                >
                  <option>Pending</option>
                  <option>Called</option>
                  <option>WhatsApped</option>
                  <option>Email sent</option>
                  <option>Interested</option>
                  <option>Follow up later</option>
                  <option>Converted</option>
                  <option>No Answer</option>
                </select>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                className="crm-btn secondary"
                onClick={() => setShowAddLead(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="crm-btn"
                disabled={savingLead}
              >
                {savingLead ? "Saving..." : "Save Lead"}
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="crm-kpis">
        <div className="crm-kpi">
          <span className="crm-kpi-label">All Leads</span>
          <div className="crm-kpi-value">
            {loading ? "…" : leads.length}
          </div>
          <span className="crm-kpi-change">
            {loading ? "Loading..." : "Live from Supabase"}
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">Interested</span>
          <div className="crm-kpi-value">
            {loading ? "…" : interestedCount}
          </div>
          <span className="crm-kpi-change">
            {leads.length
              ? `${((interestedCount / leads.length) * 100).toFixed(1)}% of leads`
              : "0% of leads"}
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">Follow-ups</span>
          <div className="crm-kpi-value">
            {loading ? "…" : followUpCount}
          </div>
          <span className="crm-kpi-change">From live lead records</span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">Converted</span>
          <div className="crm-kpi-value">
            {loading ? "…" : convertedCount}
          </div>
          <span className="crm-kpi-change">Live conversion count</span>
        </div>
      </div>

      <div className="crm-card">
        <div className="crm-filterbar">
          <input
            placeholder="🔍  Search leads..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={programFilter}
            onChange={(event) => setProgramFilter(event.target.value)}
          >
            {programs.map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </select>

          <select defaultValue="All Sources">
            <option>All Sources</option>
            <option>Website</option>
            <option>WhatsApp</option>
            <option>Referral</option>
          </select>
        </div>

        {errorMessage && (
          <div
            style={{
              margin: "16px 20px",
              padding: "14px 16px",
              borderRadius: "10px",
              background: "#fff4f4",
              color: "#b42318",
              border: "1px solid #f3c7c7",
            }}
          >
            <strong>Unable to load leads.</strong>
            <div style={{ marginTop: 4 }}>{errorMessage}</div>
          </div>
        )}

        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>CIU Number</th>
                <th>Full Name</th>
                <th>Telephone</th>
                <th>Program</th>
                <th>Status</th>
                <th>Follow Up</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40 }}>
                    Loading live leads from Supabase...
                  </td>
                </tr>
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 40 }}>
                    No leads found.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const status =
                    lead.follow_up_status || lead.status || "Pending";

                  return (
                    <tr key={lead.id}>
                      <td>
                        <strong>{lead.ciu_number || "—"}</strong>
                      </td>

                      <td>{lead.name || "—"}</td>

                      <td>{lead.phone || "—"}</td>

                      <td>{lead.product_service || "—"}</td>

                      <td>
                        <span className={`crm-badge ${badgeClass(status)}`}>
                          {status}
                        </span>
                      </td>

                      <td>
                        {lead.next_follow_up_at
                          ? displayDate(lead.next_follow_up_at)
                          : "—"}
                      </td>

                      <td>⋮</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
