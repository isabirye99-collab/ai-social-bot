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
  created_at: string;
};

type Activity = {
  id: string;
  lead_id: string | null;
  type: string;
  subject: string;
  description: string | null;
  activity_at: string;
  created_by: string | null;
};

const leadStatusMap: Record<string, string> = {
  new: "Pending",
  contacted: "Called",
  qualified: "Interested",
  unqualified: "Not interested",
  converted: "Converted",
  lost: "Lost Leads",
};

const displayStatuses = [
  "Pending",
  "Called",
  "WhatsApped",
  "Email sent",
  "Interested",
  "Not interested",
  "Follow up later",
  "Converted",
  "Paid Fees",
  "Financial issues",
  "Lost Leads",
  "Dropped",
  "Ineffective Data",
  "Unreachable",
  "No Answer",
];

const outcomeOptions = [
  "Answered - Interested",
  "Answered - Follow up later",
  "Answered - Not interested",
  "Financial issues",
  "Application started",
  "Application submitted",
  "Admitted",
  "Acceptance paid",
  "Enrolled",
  "No Answer",
  "Unreachable",
  "Wrong Number",
  "Dropped",
  "Other",
];

function cleanPhone(phone: string) {
  return phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function formatDate(date: string | null) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: string | null) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function outcomeToLeadStatus(outcome: string) {
  const value = outcome.toLowerCase();

  if (value.includes("interested")) return "qualified";
  if (value.includes("not interested")) return "unqualified";
  if (value.includes("converted")) return "converted";
  if (value.includes("enrolled")) return "converted";
  if (value.includes("acceptance paid")) return "converted";
  if (value.includes("admitted")) return "qualified";
  if (value.includes("application")) return "qualified";
  if (value.includes("financial")) return "qualified";
  if (value.includes("dropped")) return "lost";
  if (value.includes("wrong number")) return "unqualified";
  if (value.includes("unreachable")) return "contacted";
  if (value.includes("no answer")) return "contacted";
  if (value.includes("follow up")) return "contacted";

  return "contacted";
}

function outcomeToDisplayStatus(outcome: string) {
  const value = outcome.toLowerCase();

  if (value.includes("interested")) return "Interested";
  if (value.includes("not interested")) return "Not interested";
  if (value.includes("financial")) return "Financial issues";
  if (value.includes("application started")) return "Called";
  if (value.includes("application submitted")) return "Called";
  if (value.includes("admitted")) return "Interested";
  if (value.includes("acceptance paid")) return "Paid Fees";
  if (value.includes("enrolled")) return "Converted";
  if (value.includes("no answer")) return "No Answer";
  if (value.includes("unreachable")) return "Unreachable";
  if (value.includes("wrong number")) return "Ineffective Data";
  if (value.includes("dropped")) return "Dropped";
  if (value.includes("follow up")) return "Follow up later";

  return "Called";
}

export default function LeadsPage() {
  const supabase = createClient();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [programFilter, setProgramFilter] = useState("All");

  const [showAddLead, setShowAddLead] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityLead, setActivityLead] = useState<Lead | null>(null);
  const [activityType, setActivityType] = useState<
    "call" | "whatsapp" | "email"
  >("call");
  const [activityOutcome, setActivityOutcome] = useState("");
  const [activityFeedback, setActivityFeedback] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [newLead, setNewLead] = useState({
    ciu_number: "",
    name: "",
    phone: "",
    email: "",
    product_service: "",
    status: "new",
    follow_up_status: "",
    next_follow_up_at: "",
  });

  async function loadLeads() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("leads")
        .select(
          `
          id,
          ciu_number,
          name,
          phone,
          email,
          product_service,
          status,
          follow_up_status,
          next_follow_up_at,
          created_at
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setLeads((data || []) as Lead[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const programs = useMemo(() => {
    const values = leads
      .map((lead) => lead.product_service)
      .filter(Boolean) as string[];

    return Array.from(new Set(values)).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const displayStatus =
        leadStatusMap[lead.status || ""] || lead.status || "Pending";

      const matchesSearch =
        !query ||
        [
          lead.ciu_number,
          lead.name,
          lead.phone,
          lead.email,
          lead.product_service,
          displayStatus,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "All" || displayStatus === statusFilter;

      const matchesProgram =
        programFilter === "All" ||
        (lead.product_service || "") === programFilter;

      return matchesSearch && matchesStatus && matchesProgram;
    });
  }, [leads, search, statusFilter, programFilter]);

  const totalLeads = leads.length;

  const interestedLeads = leads.filter((lead) => {
    const status = leadStatusMap[lead.status || ""] || lead.status;
    return status === "Interested";
  }).length;

  const convertedLeads = leads.filter(
    (lead) =>
      lead.status === "converted" ||
      leadStatusMap[lead.status || ""] === "Converted"
  ).length;

  const followUps = leads.filter(
    (lead) => lead.next_follow_up_at
  ).length;

  async function handleAddLead(event: React.FormEvent) {
    event.preventDefault();

    if (!newLead.name.trim() || !newLead.phone.trim()) {
      alert("Please enter the student's name and telephone number.");
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.from("leads").insert({
        ciu_number: newLead.ciu_number.trim() || null,
        name: newLead.name.trim(),
        phone: newLead.phone.trim(),
        email: newLead.email.trim() || null,
        product_service: newLead.product_service.trim() || null,
        status: newLead.status,
        follow_up_status: newLead.follow_up_status.trim() || null,
        next_follow_up_at: newLead.next_follow_up_at
          ? new Date(newLead.next_follow_up_at).toISOString()
          : null,
      });

      if (error) {
        throw error;
      }

      setNewLead({
        ciu_number: "",
        name: "",
        phone: "",
        email: "",
        product_service: "",
        status: "new",
        follow_up_status: "",
        next_follow_up_at: "",
      });

      setShowAddLead(false);
      await loadLeads();
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Failed to add lead.");
    } finally {
      setSaving(false);
    }
  }

  function openActivityWorkflow(
    lead: Lead,
    type: "call" | "whatsapp" | "email"
  ) {
    if (type === "call" && !lead.phone) {
      alert("This lead does not have a telephone number.");
      return;
    }

    if (type === "whatsapp" && !lead.phone) {
      alert("This lead does not have a telephone number.");
      return;
    }

    if (type === "email" && !lead.email) {
      alert("This lead does not have an email address.");
      return;
    }

    setOpenMenuId(null);
    setActivityLead(lead);
    setActivityType(type);
    setActivityOutcome("");
    setActivityFeedback("");
    setNextFollowUp("");
    setShowActivityModal(true);

    if (type === "call" && lead.phone) {
      window.open(`tel:${lead.phone}`, "_self");
    }

    if (type === "whatsapp" && lead.phone) {
      const phone = cleanPhone(lead.phone);

      if (phone) {
        window.open(`https://wa.me/${phone}`, "_blank");
      }
    }

    if (type === "email" && lead.email) {
      window.location.href = `mailto:${lead.email}`;
    }
  }

  async function handleSaveActivity() {
    if (!activityLead) return;

    if (!activityOutcome) {
      alert("Please select the outcome of the interaction.");
      return;
    }

    try {
      setSavingActivity(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let profileId: string | null = null;

      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (profile?.id) {
          profileId = profile.id;
        }
      }

      const channelLabel =
        activityType === "call"
          ? "Call"
          : activityType === "whatsapp"
          ? "WhatsApp"
          : "Email";

      const displayOutcome = outcomeToDisplayStatus(activityOutcome);
      const leadStatus = outcomeToLeadStatus(activityOutcome);

      const description = [
        `Outcome: ${activityOutcome}`,
        activityFeedback.trim()
          ? `Feedback: ${activityFeedback.trim()}`
          : null,
        nextFollowUp
          ? `Next Follow Up: ${formatDateTime(
              new Date(nextFollowUp).toISOString()
            )}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      const { error: activityError } = await supabase
        .from("activities")
        .insert({
          lead_id: activityLead.id,
          type: activityType,
          subject: `${channelLabel} - ${activityOutcome}`,
          description: description || null,
          activity_at: new Date().toISOString(),
          created_by: profileId,
        });

      if (activityError) {
        throw activityError;
      }

      const nextFollowUpISO = nextFollowUp
        ? new Date(nextFollowUp).toISOString()
        : null;

      const { error: leadError } = await supabase
        .from("leads")
        .update({
          status: leadStatus,
          follow_up_status: displayOutcome,
          next_follow_up_at: nextFollowUpISO,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activityLead.id);

      if (leadError) {
        throw leadError;
      }

      if (nextFollowUpISO) {
        const taskPayload: Record<string, any> = {
          title: `Follow up: ${activityLead.name || "Lead"}`,
          description:
            activityFeedback.trim() ||
            `Follow up after ${channelLabel.toLowerCase()} - ${activityOutcome}`,
          task_type: activityType,
          lead_id: activityLead.id,
          due_at: nextFollowUpISO,
          status: "pending",
        };

        if (profileId) {
          taskPayload.assigned_to = profileId;
          taskPayload.created_by = profileId;
        }

        const { error: taskError } = await supabase
          .from("tasks")
          .insert(taskPayload);

        if (taskError) {
          console.warn("Follow-up task could not be created:", taskError);
        }
      }

      setShowActivityModal(false);
      setActivityLead(null);
      await loadLeads();

      alert(
        `${channelLabel} activity saved successfully.\n\n` +
          `Outcome: ${activityOutcome}\n` +
          `Status: ${displayOutcome}` +
          (nextFollowUp
            ? `\nNext Follow Up: ${formatDateTime(nextFollowUpISO)}`
            : "")
      );
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Failed to save the activity.");
    } finally {
      setSavingActivity(false);
    }
  }

  async function openHistory(lead: Lead) {
    setOpenMenuId(null);
    setHistoryLead(lead);
    setActivities([]);
    setShowHistoryModal(true);
    setLoadingHistory(true);

    try {
      const { data, error } = await supabase
        .from("activities")
        .select(
          `
          id,
          lead_id,
          type,
          subject,
          description,
          activity_at,
          created_by
        `
        )
        .eq("lead_id", lead.id)
        .order("activity_at", { ascending: false });

      if (error) {
        throw error;
      }

      setActivities((data || []) as Activity[]);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Failed to load communication history.");
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleView(lead: Lead) {
    const status =
      leadStatusMap[lead.status || ""] || lead.status || "Pending";

    setOpenMenuId(null);

    alert(
      `LEAD DETAILS\n\n` +
        `CIU Number: ${lead.ciu_number || "—"}\n` +
        `Name: ${lead.name || "—"}\n` +
        `Phone: ${lead.phone || "—"}\n` +
        `Email: ${lead.email || "—"}\n` +
        `Programme: ${lead.product_service || "—"}\n` +
        `Status: ${status}\n` +
        `Follow Up: ${lead.follow_up_status || "—"}\n` +
        `Next Follow Up: ${formatDateTime(lead.next_follow_up_at)}`
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
        padding: "24px",
        color: "#172033",
      }}
    >
      <div
        style={{
          maxWidth: "1600px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "30px",
                fontWeight: 800,
              }}
            >
              Leads
            </h1>

            <p
              style={{
                margin: "6px 0 0",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Manage, contact, record outcomes and follow up with prospective
              students.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddLead(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 18px",
              borderRadius: "10px",
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
              visibility: "visible",
              opacity: 1,
            }}
          >
            + Add New Lead
          </button>
        </div>

        {/* KPI CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <KpiCard label="Total Leads" value={totalLeads} />
          <KpiCard label="Interested" value={interestedLeads} />
          <KpiCard label="Converted" value={convertedLeads} />
          <KpiCard label="Follow Ups" value={followUps} />
        </div>

        {/* FILTERS */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "18px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email, CIU number..."
            style={{
              flex: "1 1 320px",
              minWidth: "240px",
              padding: "11px 13px",
              border: "1px solid #d1d5db",
              borderRadius: "9px",
              outline: "none",
              fontSize: "14px",
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "11px 13px",
              border: "1px solid #d1d5db",
              borderRadius: "9px",
              background: "#ffffff",
              minWidth: "170px",
              fontSize: "14px",
            }}
          >
            <option value="All">All Statuses</option>

            {displayStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            style={{
              padding: "11px 13px",
              border: "1px solid #d1d5db",
              borderRadius: "9px",
              background: "#ffffff",
              minWidth: "190px",
              fontSize: "14px",
            }}
          >
            <option value="All">All Programmes</option>

            {programs.map((program) => (
              <option key={program} value={program}>
                {program}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadLeads}
            style={{
              padding: "11px 16px",
              border: "1px solid #cbd5e1",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              visibility: "visible",
              opacity: 1,
            }}
          >
            Refresh
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "18px",
            }}
          >
            {error}
          </div>
        )}

        {/* TABLE */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            overflow: "visible",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid #e5e7eb",
              fontWeight: 700,
            }}
          >
            Lead Records ({filteredLeads.length})
          </div>

          {loading ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              Loading leads...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              No leads found.
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                overflowY: "visible",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "1150px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <th style={thStyle}>CIU NUMBER</th>
                    <th style={thStyle}>FULL NAMES</th>
                    <th style={thStyle}>TELEPHONE NUMBER</th>
                    <th style={thStyle}>EMAIL</th>
                    <th style={thStyle}>PROGRAM</th>
                    <th style={thStyle}>STATUS</th>
                    <th style={thStyle}>FOLLOW UP</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>
                      ACTIONS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLeads.map((lead) => {
                    const displayStatus =
                      leadStatusMap[lead.status || ""] ||
                      lead.status ||
                      "Pending";

                    return (
                      <tr
                        key={lead.id}
                        style={{
                          borderBottom: "1px solid #eef2f7",
                        }}
                      >
                        <td style={tdStyle}>
                          {lead.ciu_number || "—"}
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            fontWeight: 700,
                          }}
                        >
                          {lead.name || "—"}
                        </td>

                        <td style={tdStyle}>
                          {lead.phone || "—"}
                        </td>

                        <td style={tdStyle}>
                          {lead.email || (
                            <span
                              style={{
                                color: "#94a3b8",
                                fontStyle: "italic",
                              }}
                            >
                              No email
                            </span>
                          )}
                        </td>

                        <td style={tdStyle}>
                          {lead.product_service || "—"}
                        </td>

                        <td style={tdStyle}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "5px 9px",
                              borderRadius: "999px",
                              background:
                                displayStatus === "Converted"
                                  ? "#dcfce7"
                                  : displayStatus === "Interested"
                                  ? "#dbeafe"
                                  : "#f1f5f9",
                              color:
                                displayStatus === "Converted"
                                  ? "#166534"
                                  : displayStatus === "Interested"
                                  ? "#1d4ed8"
                                  : "#475569",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {displayStatus}
                          </span>
                        </td>

                        <td style={tdStyle}>
                          <div>
                            <div style={{ fontWeight: 600 }}>
                              {lead.follow_up_status || "—"}
                            </div>

                            {lead.next_follow_up_at && (
                              <div
                                style={{
                                  color: "#64748b",
                                  fontSize: "12px",
                                  marginTop: "3px",
                                }}
                              >
                                {formatDateTime(lead.next_follow_up_at)}
                              </div>
                            )}
                          </div>
                        </td>

                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "center",
                            position: "relative",
                            minWidth: "130px",
                          }}
                        >
                          <div
                            style={{
                              position: "relative",
                              display: "inline-block",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setOpenMenuId(
                                  openMenuId === lead.id ? null : lead.id
                                )
                              }
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "7px",
                                padding: "9px 13px",
                                borderRadius: "8px",
                                border: "1px solid #2563eb",
                                background: "#2563eb",
                                color: "#ffffff",
                                fontWeight: 700,
                                fontSize: "13px",
                                cursor: "pointer",
                                visibility: "visible",
                                opacity: 1,
                                whiteSpace: "nowrap",
                              }}
                            >
                              Actions
                              <span
                                style={{
                                  fontSize: "11px",
                                  transition: "transform 0.2s",
                                  transform:
                                    openMenuId === lead.id
                                      ? "rotate(180deg)"
                                      : "rotate(0deg)",
                                }}
                              >
                                ▼
                              </span>
                            </button>

                            {openMenuId === lead.id && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "calc(100% + 6px)",
                                  right: 0,
                                  width: "205px",
                                  background: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                  borderRadius: "10px",
                                  boxShadow:
                                    "0 12px 30px rgba(15, 23, 42, 0.15)",
                                  zIndex: 9999,
                                  padding: "6px",
                                  textAlign: "left",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    openActivityWorkflow(lead, "call")
                                  }
                                  style={menuButtonStyle}
                                >
                                  <span>📞</span>
                                  <span>Call & Record Outcome</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openActivityWorkflow(lead, "whatsapp")
                                  }
                                  style={menuButtonStyle}
                                >
                                  <span>💬</span>
                                  <span>WhatsApp & Record</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openActivityWorkflow(lead, "email")
                                  }
                                  disabled={!lead.email}
                                  style={{
                                    ...menuButtonStyle,
                                    color: lead.email
                                      ? "#334155"
                                      : "#94a3b8",
                                    cursor: lead.email
                                      ? "pointer"
                                      : "not-allowed",
                                    background: lead.email
                                      ? "#ffffff"
                                      : "#f8fafc",
                                  }}
                                >
                                  <span>✉️</span>
                                  <span>Email & Record</span>
                                </button>

                                <div
                                  style={{
                                    height: "1px",
                                    background: "#e2e8f0",
                                    margin: "5px 4px",
                                  }}
                                />

                                <button
                                  type="button"
                                  onClick={() => openHistory(lead)}
                                  style={menuButtonStyle}
                                >
                                  <span>📋</span>
                                  <span>Communication History</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleView(lead)}
                                  style={menuButtonStyle}
                                >
                                  <span>👁</span>
                                  <span>View Lead</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ACTIVITY / OUTCOME MODAL */}
        {showActivityModal && activityLead && (
          <ModalOverlay
            onClose={() => {
              if (!savingActivity) {
                setShowActivityModal(false);
              }
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "650px",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 25px 60px rgba(15, 23, 42, 0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "16px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "22px",
                      fontWeight: 800,
                    }}
                  >
                    Record {activityType === "call"
                      ? "Call"
                      : activityType === "whatsapp"
                      ? "WhatsApp"
                      : "Email"}
                  </h2>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#64748b",
                      fontSize: "13px",
                    }}
                  >
                    {activityLead.name || "Lead"}{" "}
                    {activityLead.phone
                      ? `• ${activityLead.phone}`
                      : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!savingActivity) {
                      setShowActivityModal(false);
                    }
                  }}
                  style={closeButtonStyle}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: "10px",
                  padding: "12px",
                  marginBottom: "18px",
                  color: "#1e40af",
                  fontSize: "13px",
                }}
              >
                The interaction has been opened. Record what happened below so
                the CRM keeps a complete communication history.
              </div>

              <div style={{ display: "grid", gap: "17px" }}>
                <div>
                  <label style={labelStyle}>
                    Communication Outcome *
                  </label>

                  <select
                    value={activityOutcome}
                    onChange={(e) =>
                      setActivityOutcome(e.target.value)
                    }
                    style={inputStyle}
                  >
                    <option value="">Select outcome...</option>

                    {outcomeOptions.map((outcome) => (
                      <option key={outcome} value={outcome}>
                        {outcome}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>
                    Feedback / Notes
                  </label>

                  <textarea
                    value={activityFeedback}
                    onChange={(e) =>
                      setActivityFeedback(e.target.value)
                    }
                    placeholder="What did the student say? What are their concerns, interests or next steps?"
                    rows={5}
                    style={{
                      ...inputStyle,
                      resize: "vertical",
                      minHeight: "120px",
                    }}
                  />
                </div>

                <div>
                  <label style={labelStyle}>
                    Next Follow Up
                  </label>

                  <input
                    type="datetime-local"
                    value={nextFollowUp}
                    onChange={(e) =>
                      setNextFollowUp(e.target.value)
                    }
                    style={inputStyle}
                  />

                  <div
                    style={{
                      marginTop: "6px",
                      color: "#64748b",
                      fontSize: "12px",
                    }}
                  >
                    Leave blank if no follow-up is required.
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "24px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowActivityModal(false)}
                  disabled={savingActivity}
                  style={secondaryButtonStyle}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSaveActivity}
                  disabled={savingActivity}
                  style={{
                    ...primaryButtonStyle,
                    background: savingActivity
                      ? "#93c5fd"
                      : "#2563eb",
                    cursor: savingActivity
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {savingActivity
                    ? "Saving..."
                    : "Save Interaction"}
                </button>
              </div>
            </div>
          </ModalOverlay>
        )}

        {/* HISTORY MODAL */}
        {showHistoryModal && historyLead && (
          <ModalOverlay
            onClose={() => setShowHistoryModal(false)}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "800px",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 25px 60px rgba(15, 23, 42, 0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "16px",
                  marginBottom: "20px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "22px",
                      fontWeight: 800,
                    }}
                  >
                    Communication History
                  </h2>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "#64748b",
                      fontSize: "13px",
                    }}
                  >
                    {historyLead.name || "Lead"}{" "}
                    {historyLead.phone
                      ? `• ${historyLead.phone}`
                      : ""}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowHistoryModal(false)}
                  style={closeButtonStyle}
                >
                  ×
                </button>
              </div>

              {loadingHistory ? (
                <div
                  style={{
                    padding: "45px",
                    textAlign: "center",
                    color: "#64748b",
                  }}
                >
                  Loading communication history...
                </div>
              ) : activities.length === 0 ? (
                <div
                  style={{
                    padding: "40px",
                    textAlign: "center",
                    background: "#f8fafc",
                    borderRadius: "10px",
                    color: "#64748b",
                  }}
                >
                  No communication history has been recorded for this lead
                  yet.
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "15px",
                        background: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "15px",
                          flexWrap: "wrap",
                          marginBottom: "8px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "9px",
                          }}
                        >
                          <span
                            style={{
                              padding: "5px 9px",
                              borderRadius: "999px",
                              background:
                                activity.type === "call"
                                  ? "#dbeafe"
                                  : activity.type === "whatsapp"
                                  ? "#dcfce7"
                                  : "#fef3c7",
                              color:
                                activity.type === "call"
                                  ? "#1d4ed8"
                                  : activity.type === "whatsapp"
                                  ? "#166534"
                                  : "#92400e",
                              fontSize: "11px",
                              fontWeight: 800,
                              textTransform: "uppercase",
                            }}
                          >
                            {activity.type}
                          </span>

                          <strong style={{ fontSize: "14px" }}>
                            {activity.subject}
                          </strong>
                        </div>

                        <span
                          style={{
                            color: "#64748b",
                            fontSize: "12px",
                          }}
                        >
                          {formatDateTime(activity.activity_at)}
                        </span>
                      </div>

                      {activity.description && (
                        <div
                          style={{
                            whiteSpace: "pre-wrap",
                            color: "#475569",
                            fontSize: "13px",
                            lineHeight: 1.6,
                          }}
                        >
                          {activity.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ModalOverlay>
        )}

        {/* ADD LEAD MODAL */}
        {showAddLead && (
          <ModalOverlay
            onClose={() => {
              if (!saving) {
                setShowAddLead(false);
              }
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: "650px",
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 25px 60px rgba(15, 23, 42, 0.25)",
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
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "22px",
                      fontWeight: 800,
                    }}
                  >
                    Add New Lead
                  </h2>

                  <p
                    style={{
                      margin: "5px 0 0",
                      color: "#64748b",
                      fontSize: "13px",
                    }}
                  >
                    Add a new prospective student to the CRM.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddLead(false)}
                  style={closeButtonStyle}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAddLead}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: "16px",
                  }}
                >
                  <FormField
                    label="CIU Number"
                    value={newLead.ciu_number}
                    onChange={(value) =>
                      setNewLead({
                        ...newLead,
                        ciu_number: value,
                      })
                    }
                    placeholder="CIU number"
                  />

                  <FormField
                    label="Full Name *"
                    value={newLead.name}
                    onChange={(value) =>
                      setNewLead({
                        ...newLead,
                        name: value,
                      })
                    }
                    placeholder="Student full name"
                  />

                  <FormField
                    label="Telephone Number *"
                    value={newLead.phone}
                    onChange={(value) =>
                      setNewLead({
                        ...newLead,
                        phone: value,
                      })
                    }
                    placeholder="+256..."
                  />

                  <FormField
                    label="Email"
                    value={newLead.email}
                    onChange={(value) =>
                      setNewLead({
                        ...newLead,
                        email: value,
                      })
                    }
                    placeholder="student@email.com"
                    type="email"
                  />

                  <FormField
                    label="Programme"
                    value={newLead.product_service}
                    onChange={(value) =>
                      setNewLead({
                        ...newLead,
                        product_service: value,
                      })
                    }
                    placeholder="Programme / course"
                  />

                  <div>
                    <label style={labelStyle}>Status</label>

                    <select
                      value={newLead.status}
                      onChange={(e) =>
                        setNewLead({
                          ...newLead,
                          status: e.target.value,
                        })
                      }
                      style={inputStyle}
                    >
                      <option value="new">Pending</option>
                      <option value="contacted">Called</option>
                      <option value="qualified">
                        Interested
                      </option>
                      <option value="unqualified">
                        Not interested
                      </option>
                      <option value="converted">
                        Converted
                      </option>
                      <option value="lost">Lost Leads</option>
                    </select>
                  </div>

                  <FormField
                    label="Follow Up Status"
                    value={newLead.follow_up_status}
                    onChange={(value) =>
                      setNewLead({
                        ...newLead,
                        follow_up_status: value,
                      })
                    }
                    placeholder="e.g. Call tomorrow"
                  />

                  <div>
                    <label style={labelStyle}>
                      Next Follow Up
                    </label>

                    <input
                      type="datetime-local"
                      value={newLead.next_follow_up_at}
                      onChange={(e) =>
                        setNewLead({
                          ...newLead,
                          next_follow_up_at: e.target.value,
                        })
                      }
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: "10px",
                    marginTop: "24px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowAddLead(false)}
                    style={secondaryButtonStyle}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      ...primaryButtonStyle,
                      background: saving
                        ? "#93c5fd"
                        : "#2563eb",
                      cursor: saving
                        ? "not-allowed"
                        : "pointer",
                    }}
                  >
                    {saving ? "Saving..." : "Save Lead"}
                  </button>
                </div>
              </form>
            </div>
          </ModalOverlay>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        padding: "18px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "13px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: 800,
          marginTop: "5px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ModalOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "13px 14px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 800,
  color: "#64748b",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px",
  fontSize: "13px",
  color: "#334155",
  verticalAlign: "middle",
};

const menuButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 11px",
  border: "none",
  borderRadius: "7px",
  background: "#ffffff",
  color: "#334155",
  fontSize: "13px",
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "left",
  visibility: "visible",
  opacity: 1,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: 700,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#172033",
  fontSize: "14px",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "11px 18px",
  border: "1px solid #2563eb",
  borderRadius: "9px",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
  visibility: "visible",
  opacity: 1,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "11px 17px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 700,
  cursor: "pointer",
  visibility: "visible",
  opacity: 1,
};

const closeButtonStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: "18px",
  color: "#64748b",
};

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>

      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}