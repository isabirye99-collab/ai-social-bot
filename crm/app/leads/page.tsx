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
  assigned_to: string | null;
  created_at: string;
  organization_id?: string | null;
  contact_id?: string | null;
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

const displayStatuses = [
  "Pending",
  "Called",
  "WhatsApped",
  "Email sent",
  "Interested",
  "Follow up later",
  "Not interested",
  "Financial issues",
  "Lost Leads",
  "Dropped",
  "Ineffective Data",
  "Unreachable",
  "No Answer",
];

const statusMap: Record<string, string> = {
  new: "Pending",
  pending: "Pending",
  contacted: "Called",
  called: "Called",
  whatsapped: "WhatsApped",
  email_sent: "Email sent",
  "email sent": "Email sent",
  qualified: "Interested",
  interested: "Interested",
  follow_up_later: "Follow up later",
  "follow up later": "Follow up later",
  unqualified: "Not interested",
  financial: "Financial issues",
  "financial issues": "Financial issues",
  lost: "Lost Leads",
  dropped: "Dropped",
  ineffective: "Ineffective Data",
  unreachable: "Unreachable",
  "no answer": "No Answer",
  converted: "Interested",
};

function getDisplayStatus(status: string | null) {
  if (!status) return "Pending";

  return (
    statusMap[status.toLowerCase()] ||
    status ||
    "Pending"
  );
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

function statusIsQualified(status: string | null) {
  return getDisplayStatus(status) === "Interested";
}

function statusIsClosed(status: string | null) {
  return [
    "Not interested",
    "Financial issues",
    "Lost Leads",
    "Dropped",
    "Ineffective Data",
    "Unreachable",
    "No Answer",
  ].includes(getDisplayStatus(status));
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

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedLead, setSelectedLead] =
    useState<Lead | null>(null);

  const [showHistoryModal, setShowHistoryModal] =
    useState(false);
  const [historyLead, setHistoryLead] =
    useState<Lead | null>(null);

  const [activities, setActivities] =
    useState<Activity[]>([]);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [qualifyingLeadId, setQualifyingLeadId] =
    useState<string | null>(null);

  const [newLead, setNewLead] = useState({
    ciu_number: "",
    name: "",
    phone: "",
    email: "",
    product_service: "",
    status: "new",
  });

  const [currentUserId, setCurrentUserId] =
    useState("");

  const [currentRole, setCurrentRole] =
    useState("");

  async function loadLeads() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be signed in to view leads."
        );
      }

      setCurrentUserId(user.id);

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const role = profile?.role || "";

      setCurrentRole(role);

      let query = supabase
        .from("leads")
        .select(`
          id,
          ciu_number,
          name,
          phone,
          email,
          product_service,
          status,
          follow_up_status,
          next_follow_up_at,
          assigned_to,
          created_at,
          organization_id,
          contact_id
        `)
        .order("created_at", {
          ascending: false,
        });

      if (role === "salesperson") {
        query = query.eq(
          "assigned_to",
          user.id
        );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        throw error;
      }

      setLeads(
        (data || []) as Lead[]
      );
    } catch (err) {
      console.error(
        "Leads loading error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load leads."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const programs = useMemo(() => {
    const values = leads
      .map(
        (lead) =>
          lead.product_service
      )
      .filter(Boolean) as string[];

    return Array.from(
      new Set(values)
    ).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return leads.filter((lead) => {
      const displayStatus =
        getDisplayStatus(
          lead.status
        );

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
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          );

      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "__active__" && !statusIsClosed(lead.status)) ||
        (statusFilter === "__interested__" && statusIsQualified(lead.status)) ||
        (statusFilter === "__closed__" && statusIsClosed(lead.status)) ||
        displayStatus === statusFilter;

      const matchesProgram =
        programFilter === "All" ||
        (lead.product_service || "") ===
          programFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesProgram
      );
    });
  }, [
    leads,
    search,
    statusFilter,
    programFilter,
  ]);

  const activeLeads = leads.filter(
    (lead) =>
      !statusIsClosed(
        lead.status
      )
  ).length;

  const interestedLeads =
    leads.filter((lead) =>
      statusIsQualified(
        lead.status
      )
    ).length;

  const closedLeads =
    leads.filter((lead) =>
      statusIsClosed(
        lead.status
      )
    ).length;

  async function handleAddLead(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (
      !newLead.name.trim() ||
      !newLead.phone.trim()
    ) {
      alert(
        "Please enter the student's name and telephone number."
      );
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be signed in to add a lead."
        );
      }

      let assignedSalespersonId =
        user.id;

      if (
        currentRole !==
        "salesperson"
      ) {
        const {
          data: salespeople,
          error:
            salespersonError,
        } = await supabase
          .from("profiles")
          .select(
            "id, full_name"
          )
          .eq(
            "role",
            "salesperson"
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "full_name",
            {
              ascending: true,
            }
          );

        if (salespersonError) {
          throw salespersonError;
        }

        if (
          !salespeople ||
          salespeople.length === 0
        ) {
          throw new Error(
            "No active salesperson is available to receive this lead."
          );
        }

        const ids =
          salespeople.map(
            (person) =>
              person.id
          );

        const {
          data: assignedLeads,
          error:
            assignedLeadsError,
        } = await supabase
          .from("leads")
          .select(
            "assigned_to"
          )
          .in(
            "assigned_to",
            ids
          );

        if (assignedLeadsError) {
          throw assignedLeadsError;
        }

        const counts =
          new Map<
            string,
            number
          >();

        ids.forEach((id) =>
          counts.set(id, 0)
        );

        (
          assignedLeads || []
        ).forEach((lead) => {
          if (
            lead.assigned_to
          ) {
            counts.set(
              lead.assigned_to,
              (counts.get(
                lead.assigned_to
              ) || 0) + 1
            );
          }
        });

        const selected =
          salespeople.reduce(
            (
              current,
              person
            ) => {
              const currentCount =
                counts.get(
                  current.id
                ) || 0;

              const personCount =
                counts.get(
                  person.id
                ) || 0;

              return personCount <
                currentCount
                ? person
                : current;
            },
            salespeople[0]
          );

        assignedSalespersonId =
          selected.id;
      }

      const {
        error,
      } = await supabase
        .from("leads")
        .insert({
          ciu_number:
            newLead.ciu_number.trim() ||
            null,

          name:
            newLead.name.trim(),

          phone:
            newLead.phone.trim(),

          email:
            newLead.email.trim() ||
            null,

          product_service:
            newLead.product_service.trim() ||
            null,

          status:
            newLead.status,

         follow_up_status:
            "Pending",

          next_follow_up_at:
            null,

          assigned_to:
            assignedSalespersonId,
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
      });

      setShowAddLead(false);

      await loadLeads();

      alert(
        currentRole ===
          "salesperson"
          ? "Lead added successfully and assigned to you."
          : "Lead added successfully and assigned to a salesperson."
      );
    } catch (err) {
      console.error(
        "Add lead error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Failed to add lead."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleView(
    lead: Lead
  ) {
    if (
      currentRole === "salesperson" &&
      lead.assigned_to !== currentUserId
    ) {
      alert("You can only view details for leads assigned to you.");
      return;
    }

    setSelectedLead(lead);
    setActivities([]);
    setLoadingHistory(true);
    setShowViewModal(true);

    try {
      const { data, error } = await supabase
        .from("activities")
        .select("id, lead_id, type, subject, description, activity_at, created_by")
        .eq("lead_id", lead.id)
        .order("activity_at", { ascending: false });

      if (error) throw error;
      setActivities((data || []) as Activity[]);
    } catch (err) {
      console.error("Lead activity log error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load this lead's activity log."
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  async function openHistory(
    lead: Lead
  ) {
    if (
      currentRole ===
        "salesperson" &&
      lead.assigned_to !==
        currentUserId
    ) {
      alert(
        "You can only view history for leads assigned to you."
      );
      return;
    }

    setHistoryLead(lead);
    setActivities([]);
    setShowHistoryModal(true);
    setLoadingHistory(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("activities")
        .select(`
          id,
          lead_id,
          type,
          subject,
          description,
          activity_at,
          created_by
        `)
        .eq(
          "lead_id",
          lead.id
        )
        .order(
          "activity_at",
          {
            ascending: false,
          }
        );

      if (error) {
        throw error;
      }

      setActivities(
        (data || []) as Activity[]
      );
    } catch (err) {
      console.error(
        "History error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Failed to load communication history."
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  async function qualifyLead(
    lead: Lead
  ) {
    if (
      currentRole ===
        "salesperson" &&
      lead.assigned_to !==
        currentUserId
    ) {
      alert(
        "You can only qualify leads assigned to you."
      );
      return;
    }

    if (
      !lead.organization_id
    ) {
      alert(
        "This lead does not have an organization ID. The Pipeline opportunity cannot be created yet."
      );
      return;
    }

    setQualifyingLeadId(
      lead.id
    );

    setError("");

    try {
      const {
        data: stages,
        error:
          stageError,
      } = await supabase
        .from("pipeline_stages")
        .select(
          "id, name, probability"
        )
        .order(
          "position",
          {
            ascending: true,
          }
        );

      if (stageError) {
        throw stageError;
      }

      const interestedStage =
        (stages || []).find(
          (stage) =>
            stage.name
              .trim()
              .toLowerCase() ===
            "interested"
        );

      if (
        !interestedStage
      ) {
        throw new Error(
          'The "Interested" Pipeline stage could not be found.'
        );
      }

      const {
        data:
          existingOpportunity,
        error:
          opportunityLookupError,
      } = await supabase
        .from("opportunities")
        .select(
          "id, stage_id, status"
        )
        .eq(
          "lead_id",
          lead.id
        )
        .maybeSingle();

      if (
        opportunityLookupError
      ) {
        throw opportunityLookupError;
      }

      if (
        existingOpportunity
      ) {
        const {
          error:
            opportunityUpdateError,
        } = await supabase
          .from("opportunities")
          .update({
            stage_id:
              interestedStage.id,

            probability:
              Number(
                interestedStage.probability ||
                  0
              ),

            status:
              "open",

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            existingOpportunity.id
          );

        if (
          opportunityUpdateError
        ) {
          throw opportunityUpdateError;
        }
      } else {
        const {
          error:
            opportunityCreateError,
        } = await supabase
          .from("opportunities")
          .insert({
            lead_id:
              lead.id,

            organization_id:
              lead.organization_id,

            contact_id:
              lead.contact_id ||
              null,

            title:
              lead.name ||
              "Unnamed Lead",

            value: 0,

            currency:
              "UGX",

            stage_id:
              interestedStage.id,

            status:
              "open",

            probability:
              Number(
                interestedStage.probability ||
                  0
              ),

            assigned_to:
              lead.assigned_to,

            notes:
              "Qualified from Leads and moved into the Pipeline at Interested stage.",
          });

        if (
          opportunityCreateError
        ) {
          throw opportunityCreateError;
        }
      }

      const {
        error:
          leadUpdateError,
      } = await supabase
        .from("leads")
        .update({
          status:
            "qualified",

          follow_up_status:
            "Moved to Pipeline",

          next_follow_up_at:
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          lead.id
        );

      if (leadUpdateError) {
        throw leadUpdateError;
      }

      await loadLeads();

      alert(
        `${lead.name || "Lead"} has been qualified and moved to the Interested stage in Pipeline.`
      );
    } catch (err) {
      console.error(
        "Qualify lead error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "The lead could not be moved to Pipeline."
      );
    } finally {
      setQualifyingLeadId(
        null
      );
    }
  }

  return (
    <div className="ciu-page">
      <div className="ciu-page-inner">

        {/* HEADER */}
        <div
          className="ciu-hero"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#8dc642",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Prospecting
            </div>

            <h1>
              {currentRole ===
              "salesperson"
                ? "My Leads"
                : "Leads"}
            </h1>

            <p>
              Manage new prospects,
              identify interest and
              qualify students for the
              admissions Pipeline.
            </p>
          </div>

          {/* ADD NEW LEAD ON LEFT/HEADER AREA */}
          <button
            type="button"
            onClick={() =>
              setShowAddLead(true)
            }
            className="ciu-btn"
            style={{
              visibility: "visible",
              opacity: 1,
              minWidth: 150,
              height: 44,
              fontSize: 14,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            + Add New Lead
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              marginTop: 16,
              padding: 13,
              borderRadius: 9,
              background: "#fff1f2",
              border:
                "1px solid #fecdd3",
              color: "#be123c",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {/* KPI SECTION */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginTop: 20,
          }}
        >
          <KpiCard
            label={
              currentRole === "salesperson"
                ? "My Leads"
                : "Total Leads"
            }
            value={leads.length}
            description="View all lead records"
            type="total"
            selected={statusFilter === "All"}
            onClick={() => {
              setStatusFilter("All");
              setProgramFilter("All");
              setSearch("");
            }}
          />

          <KpiCard
            label="Active Prospects"
            value={activeLeads}
            description="View active prospects"
            type="active"
            selected={statusFilter === "__active__"}
            onClick={() => {
              setStatusFilter(statusFilter === "__active__" ? "All" : "__active__");
              setProgramFilter("All");
              setSearch("");
            }}
          />

          <KpiCard
            label="Interested"
            value={interestedLeads}
            description="View interested leads"
            type="interested"
            selected={statusFilter === "__interested__"}
            onClick={() => {
              setStatusFilter(statusFilter === "__interested__" ? "All" : "__interested__");
              setProgramFilter("All");
              setSearch("");
            }}
          />

          <KpiCard
            label="Closed / Unqualified"
            value={closedLeads}
            description="View closed and unqualified leads"
            type="closed"
            selected={statusFilter === "__closed__"}
            onClick={() => {
              setStatusFilter(statusFilter === "__closed__" ? "All" : "__closed__");
              setProgramFilter("All");
              setSearch("");
            }}
          />
        </div>

        {/* RESPONSIVE KPI STYLE */}
        <style jsx>{`
          @media (max-width: 1000px) {
            .ciu-page-inner
              > div:nth-child(3) {
              grid-template-columns: repeat(
                2,
                minmax(0, 1fr)
              ) !important;
            }
          }

          @media (max-width: 600px) {
            .ciu-page-inner
              > div:nth-child(3) {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {/* WORKFLOW STRIP */}
        <div
          className="ciu-strip"
          style={{
            marginTop: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 20,
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>
                Lead workflow
              </strong>

              <span
                style={{
                  marginLeft: 12,
                }}
              >
                Prospect → Contacted →
                Interested → Pipeline
              </span>
            </div>

            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#106053",
              }}
            >
              Follow-ups are managed in Tasks
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div
          className="ciu-card"
          style={{
            marginTop: 18,
            padding: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search name, phone, email, CIU number..."
              style={{
                ...inputStyle,
                flex: "1 1 320px",
                minWidth: 240,
              }}
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              style={{
                ...inputStyle,
                width: "auto",
                minWidth: 180,
              }}
            >
              <option value="All">
                All Statuses
              </option>

              {displayStatuses.map(
                (status) => (
                  <option
                    key={status}
                    value={status}
                  >
                    {status}
                  </option>
                )
              )}
            </select>

            <select
              value={programFilter}
              onChange={(event) =>
                setProgramFilter(
                  event.target.value
                )
              }
              style={{
                ...inputStyle,
                width: "auto",
                minWidth: 190,
              }}
            >
              <option value="All">
                All Programmes
              </option>

              {programs.map(
                (program) => (
                  <option
                    key={program}
                    value={program}
                  >
                    {program}
                  </option>
                )
              )}
            </select>

            <button
              type="button"
              onClick={loadLeads}
              className="ciu-btn-light"
              style={{
                visibility: "visible",
                opacity: 1,
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        {/* LEADS TABLE */}
        <div
          className="ciu-card"
          style={{
            marginTop: 18,
            overflow: "hidden",
          }}
        >
          <div className="ciu-card-head">
            <div>
              <strong>
                Lead Records
              </strong>

              <span>
                {filteredLeads.length}{" "}
                prospect
                {filteredLeads.length ===
                1
                  ? ""
                  : "s"}
              </span>
            </div>
          </div>

          {loading ? (
            <div
              style={{
                padding: 50,
                textAlign: "center",
                color: "#6b7f78",
              }}
            >
              Loading leads...
            </div>
          ) : filteredLeads.length ===
            0 ? (
            <div
              style={{
                padding: 50,
                textAlign: "center",
                color: "#6b7f78",
              }}
            >
              <strong>
                No leads found
              </strong>

              <div
                style={{
                  marginTop: 6,
                  fontSize: 13,
                }}
              >
                Try changing your
                search or filters,
                or add a new lead.
              </div>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                className="ciu-report-table"
                style={{
                  minWidth: 1200,
                }}
              >
                <thead>
                  <tr>
                    <th>
                      CIU NUMBER
                    </th>

                    <th>
                      FULL NAMES
                    </th>

                    <th>
                      TELEPHONE NUMBER
                    </th>

                    <th>
                      EMAIL
                    </th>

                    <th>
                      PROGRAM
                    </th>

                    <th>
                      STATUS
                    </th>

                    <th>
                      CREATED
                    </th>

                    <th>
                      ACTIONS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLeads.map(
                    (lead) => {
                      const displayStatus =
                        getDisplayStatus(
                          lead.status
                        );

                      const isInterested =
                        statusIsQualified(
                          lead.status
                        );

                      const isClosed =
                        statusIsClosed(
                          lead.status
                        );

                      return (
                        <tr
                          key={
                            lead.id
                          }
                        >
                          <td>
                            {lead.ciu_number ||
                              "—"}
                          </td>

                          <td
                            style={{
                              fontWeight: 700,
                            }}
                          >
                            {lead.name ||
                              "—"}
                          </td>

                          <td>
                            {lead.phone ||
                              "—"}
                          </td>

                          <td>
                            {lead.email ||
                              "—"}
                          </td>

                          <td>
                            {lead.product_service ||
                              "—"}
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                displayStatus
                              }
                            />
                          </td>

                          <td>
                            {formatDate(
                              lead.created_at
                            )}
                          </td>

                          <td>
                            <div
                              style={{
                                display:
                                  "flex",
                                gap: 7,
                                flexWrap:
                                  "wrap",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleView(
                                    lead
                                  )
                                }
                                className="ciu-btn-light"
                                style={{
                                  padding:
                                    "7px 10px",
                                  fontSize:
                                    12,
                                }}
                              >
                                View
                              </button>

                              {isInterested &&
                                !isClosed && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      qualifyLead(
                                        lead
                                      )
                                    }
                                    disabled={
                                      qualifyingLeadId ===
                                      lead.id
                                    }
                                    className="ciu-btn"
                                    style={{
                                      padding:
                                        "7px 11px",
                                      fontSize:
                                        12,
                                      visibility:
                                        "visible",
                                      opacity:
                                        1,
                                    }}
                                  >
                                    {qualifyingLeadId ===
                                    lead.id
                                      ? "Moving..."
                                      : "Move to Pipeline"}
                                  </button>
                                )}
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* VIEW LEAD MODAL */}
        {showViewModal &&
          selectedLead && (
            <ModalOverlay
              onClose={() =>
                setShowViewModal(
                  false
                )
              }
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 620,
                  background: "#ffffff",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow:
                    "0 25px 60px rgba(15, 23, 42, 0.25)",
                }}
              >
                <ModalHeader
                  title="Lead Details"
                  subtitle="Prospect information"
                  onClose={() =>
                    setShowViewModal(
                      false
                    )
                  }
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: 14,
                    marginTop: 22,
                  }}
                >
                  <DetailItem
                    label="CIU Number"
                    value={
                      selectedLead.ciu_number
                    }
                  />

                  <DetailItem
                    label="Full Name"
                    value={
                      selectedLead.name
                    }
                  />

                  <DetailItem
                    label="Telephone"
                    value={
                      selectedLead.phone
                    }
                  />

                  <DetailItem
                    label="Email"
                    value={
                      selectedLead.email
                    }
                  />

                  <DetailItem
                    label="Programme"
                    value={
                      selectedLead.product_service
                    }
                  />

                  <DetailItem
                    label="Status"
                    value={getDisplayStatus(
                      selectedLead.status
                    )}
                  />

                  <DetailItem
                    label="Created"
                    value={formatDateTime(
                      selectedLead.created_at
                    )}
                  />

                  <DetailItem
                    label="Follow-up"
                    value="Managed from Tasks"
                  />
                </div>

                <div style={{ marginTop: 24, borderTop: "1px solid #e5eee9", paddingTop: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#17322c", fontSize: 15, fontWeight: 800 }}>Contact & Activity History</h3>
                      <p style={{ margin: "4px 0 0", color: "#718078", fontSize: 11 }}>A dated log of recorded calls, messages, emails and follow-up activities.</p>
                    </div>
                    <span style={{ padding: "5px 9px", borderRadius: 999, background: "#eaf5f2", color: "#106053", fontSize: 10, fontWeight: 800 }}>
                      {activities.length} {activities.length === 1 ? "record" : "records"}
                    </span>
                  </div>

                  {loadingHistory ? (
                    <div style={{ padding: 24, textAlign: "center", color: "#718078", fontSize: 12 }}>Loading activity log...</div>
                  ) : activities.length === 0 ? (
                    <div style={{ padding: 20, borderRadius: 10, background: "#f6f9f7", border: "1px dashed #d7e5de", color: "#718078", fontSize: 12, textAlign: "center" }}>
                      No contact activities have been recorded for this lead yet. Contact dates will appear here when calls, WhatsApp messages, emails or other interactions are logged in the CRM.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 0 }}>
                      {activities.map((activity, index) => (
                        <div key={activity.id} style={{ display: "grid", gridTemplateColumns: "18px minmax(0, 1fr)", gap: 12, position: "relative", paddingBottom: index === activities.length - 1 ? 0 : 16 }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <span style={{ width: 10, height: 10, borderRadius: 99, background: "#8dc642", border: "2px solid #eaf5f2", marginTop: 3, zIndex: 1 }} />
                            {index !== activities.length - 1 && <span style={{ width: 2, flex: 1, background: "#e2ece6", marginTop: 2 }} />}
                          </div>
                          <div style={{ border: "1px solid #e2eae4", borderRadius: 10, padding: "11px 13px", background: "#fff" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                              <div>
                                <strong style={{ display: "block", color: "#17322c", fontSize: 12 }}>{activity.subject || activity.type || "Contact activity"}</strong>
                                <span style={{ display: "inline-block", marginTop: 5, color: "#106053", background: "#eaf5f2", borderRadius: 99, padding: "3px 7px", fontSize: 9, fontWeight: 800, textTransform: "capitalize" }}>{(activity.type || "activity").replaceAll("_", " ")}</span>
                              </div>
                              <time dateTime={activity.activity_at} style={{ color: "#718078", fontSize: 10, whiteSpace: "nowrap" }}>{formatDateTime(activity.activity_at)}</time>
                            </div>
                            {activity.description && <p style={{ margin: "9px 0 0", color: "#53665f", fontSize: 11, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{activity.description}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ModalOverlay>
          )}

        {/* ADD LEAD MODAL */}
        {showAddLead && (
          <ModalOverlay
            onClose={() => {
              if (!saving) {
                setShowAddLead(
                  false
                );
              }
            }}
          >
            <div
              onClick={(event) =>
                event.stopPropagation()
              }
              style={{
                width: "100%",
                maxWidth: 650,
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: 16,
                padding: 24,
                boxShadow:
                  "0 25px 60px rgba(15, 23, 42, 0.25)",
              }}
            >
              <ModalHeader
                title="Add New Lead"
                subtitle="Add a new prospective student to the CRM."
                onClose={() =>
                  setShowAddLead(
                    false
                  )
                }
              />

              <form
                onSubmit={
                  handleAddLead
                }
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: 16,
                    marginTop: 22,
                  }}
                >
                  <FormField
                    label="CIU Number"
                    value={
                      newLead.ciu_number
                    }
                    onChange={(value) =>
                      setNewLead({
                        ...newLead,
                        ciu_number:
                          value,
                      })
                    }
                    placeholder="CIU number"
                  />

                  <FormField
                    label="Full Name *"
                    value={
                      newLead.name
                    }
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
                    value={
                      newLead.phone
                    }
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
                    value={
                      newLead.email
                    }
                    onChange={(value) =>
                      setNewLead({
                        ...newLead,
                        email:
                          value,
                      })
                    }
                    placeholder="student@email.com"
                    type="email"
                  />

                  <FormField
                    label="Programme"
                    value={
                      newLead.product_service
                    }
                    onChange={(value) =>
                      setNewLead({
                        ...newLead,
                        product_service:
                          value,
                      })
                    }
                    placeholder="Programme / course"
                  />

                  <div>
                    <label
                      style={
                        labelStyle
                      }
                    >
                      Initial Status
                    </label>

                    <select
                      value={
                        newLead.status
                      }
                      onChange={(
                        event
                      ) =>
                        setNewLead({
                          ...newLead,
                          status:
                            event
                              .target
                              .value,
                        })
                      }
                      style={
                        inputStyle
                      }
                    >
                      <option value="new">
                        Pending
                      </option>

                      <option value="contacted">
                        Called
                      </option>

                      <option value="qualified">
                        Interested
                      </option>

                      <option value="unqualified">
                        Not interested
                      </option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 15,
                    padding: 12,
                    borderRadius: 9,
                    background:
                      "#f5f8f7",
                    color:
                      "#53665f",
                    fontSize: 12,
                  }}
                >
                  Follow-up scheduling
                  is handled in the
                  Tasks module, so
                  Leads are not assigned
                  duplicate follow-up
                  work here.
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "flex-end",
                    gap: 10,
                    marginTop: 24,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setShowAddLead(
                        false
                      )
                    }
                    disabled={
                      saving
                    }
                    className="ciu-btn-light"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving
                    }
                    className="ciu-btn"
                    style={{
                      visibility:
                        "visible",
                      opacity: 1,
                    }}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Lead"}
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

/* =========================
   KPI CARD
========================= */

function KpiCard({
  label,
  value,
  description,
  type,
  selected = false,
  onClick,
}: {
  label: string;
  value: number;
  description: string;
  type:
    | "total"
    | "active"
    | "interested"
    | "closed";
  selected?: boolean;
  onClick: () => void;
}) {
  const styles = {
    total: { accent: "#106053", icon: "users" },
    active: { accent: "#8dc642", icon: "target" },
    interested: { accent: "#106053", icon: "check" },
    closed: { accent: "#b45363", icon: "archive" },
  };

  const styleConfig = styles[type];

  const iconPaths: Record<string, React.ReactNode> = {
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    archive: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v11h14V9M10 13h4" /></>,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${label}: ${value}. ${description}`}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        minWidth: 0,
        minHeight: 126,
        width: "100%",
        padding: "16px 17px",
        border: selected ? "2px solid #106053" : "1px solid #e2eae4",
        borderRadius: 16,
        background: selected ? "#f2f8f5" : "#ffffff",
        boxShadow: selected ? "0 7px 22px rgba(16,96,83,.12)" : "0 5px 20px rgba(20,50,40,.04)",
        transition: "transform .18s ease, box-shadow .18s ease",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: "#819087", textTransform: "uppercase", letterSpacing: ".11em" }}>
          {label}
        </span>
        <span style={{ width: 34, height: 34, flex: "0 0 34px", display: "grid", placeItems: "center", borderRadius: 10, background: styleConfig.accent === "#8dc642" ? "rgba(141,198,66,.16)" : "rgba(16,96,83,.09)", color: styleConfig.accent }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {iconPaths[styleConfig.icon]}
          </svg>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8, marginTop: 13 }}>
        <span style={{ fontSize: 28, lineHeight: 1, fontWeight: 900, letterSpacing: "-.04em", color: "#17211b" }}>
          {value}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#7b8982", textAlign: "right" }}>
          {description}
        </span>
      </div>
      <div style={{ height: 3, borderRadius: 99, background: "#edf2ee", marginTop: 13, overflow: "hidden" }}>
        <div style={{ width: type === "total" ? "100%" : type === "active" ? "72%" : type === "interested" ? "56%" : "34%", height: "100%", background: styleConfig.accent, borderRadius: 99 }} />
      </div>
    </button>
  );
}

/* =========================
   STATUS BADGE
========================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const positive =
    status === "Interested";

  const closed = [
    "Not interested",
    "Financial issues",
    "Lost Leads",
    "Dropped",
    "Ineffective Data",
    "Unreachable",
    "No Answer",
  ].includes(status);

  return (
    <span
      style={{
        display: "inline-block",
        padding: "5px 9px",
        borderRadius: 999,
        background: positive
          ? "#eaf5f2"
          : closed
          ? "#fff1f2"
          : "#f1f5f3",
        color: positive
          ? "#106053"
          : closed
          ? "#be123c"
          : "#53665f",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

/* =========================
   MODAL HEADER
========================= */

function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        alignItems:
          "flex-start",
        gap: 15,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin:
              "6px 0 0",
            color:
              "#6b7f78",
            fontSize: 13,
          }}
        >
          {subtitle}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        style={
          closeButtonStyle
        }
      >
        ×
      </button>
    </div>
  );
}

/* =========================
   DETAIL ITEM
========================= */

function DetailItem({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <div
      style={{
        padding: 13,
        border:
          "1px solid #dfe9e5",
        borderRadius: 9,
        background: "#f8fbfa",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "#6b7f78",
          textTransform:
            "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#17322c",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

/* =========================
   MODAL OVERLAY
========================= */

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
        background:
          "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent:
          "center",
        padding: 20,
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) =>
          event.stopPropagation()
        }
        style={{
          width: "100%",
          display: "flex",
          justifyContent:
            "center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* =========================
   FORM FIELD
========================= */

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label
        style={labelStyle}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        style={inputStyle}
      />
    </div>
  );
}

/* =========================
   STYLES
========================= */

const labelStyle: React.CSSProperties =
  {
    display: "block",
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
  };

const inputStyle: React.CSSProperties =
  {
    width: "100%",
    boxSizing: "border-box",
    padding:
      "11px 12px",
    border:
      "1px solid #d1d5db",
    borderRadius: 8,
    background:
      "#ffffff",
    color: "#172033",
    fontSize: 14,
    outline: "none",
  };

const closeButtonStyle: React.CSSProperties =
  {
    width: 36,
    height: 36,
    borderRadius: 8,
    border:
      "1px solid #dfe9e5",
    background:
      "#ffffff",
    cursor: "pointer",
    fontSize: 18,
    color: "#6b7f78",
  };