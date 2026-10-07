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
            null,

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

  function handleView(
    lead: Lead
  ) {
    setSelectedLead(lead);
    setShowViewModal(true);
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
                color: "#8bc63f",
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
              currentRole ===
              "salesperson"
                ? "My Leads"
                : "Total Leads"
            }
            value={leads.length}
            description="Current CRM records"
            type="total"
          />

          <KpiCard
            label="Active Prospects"
            value={activeLeads}
            description="Current CRM records"
            type="active"
          />

          <KpiCard
            label="Interested"
            value={interestedLeads}
            description="Current CRM records"
            type="interested"
          />

          <KpiCard
            label="Closed / Unqualified"
            value={closedLeads}
            description="Current CRM records"
            type="closed"
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
                color: "#00695c",
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

                              <button
                                type="button"
                                onClick={() =>
                                  openHistory(
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
                                History
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

                <div
                  style={{
                    marginTop: 22,
                    padding: 13,
                    borderRadius: 9,
                    background:
                      "#eaf5f2",
                    color: "#00695c",
                    fontSize: 13,
                  }}
                >
                  <strong>
                    CRM workflow:
                  </strong>{" "}
                  Lead prospecting is
                  handled here. Actual
                  calls, WhatsApp,
                  email follow-ups and
                  scheduled work are
                  managed from Tasks.
                </div>
              </div>
            </ModalOverlay>
          )}

        {/* HISTORY MODAL */}
        {showHistoryModal &&
          historyLead && (
            <ModalOverlay
              onClose={() =>
                setShowHistoryModal(
                  false
                )
              }
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 800,
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
                  title="Communication History"
                  subtitle={
                    historyLead.name ||
                    "Lead"
                  }
                  onClose={() =>
                    setShowHistoryModal(
                      false
                    )
                  }
                />

                {loadingHistory ? (
                  <div
                    style={{
                      padding: 45,
                      textAlign: "center",
                      color:
                        "#6b7f78",
                    }}
                  >
                    Loading
                    communication
                    history...
                  </div>
                ) : activities.length ===
                  0 ? (
                  <div
                    style={{
                      marginTop: 20,
                      padding: 40,
                      textAlign:
                        "center",
                      background:
                        "#f5f8f7",
                      borderRadius: 10,
                      color:
                        "#6b7f78",
                    }}
                  >
                    No communication
                    history has been
                    recorded for this
                    lead yet.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gap: 12,
                      marginTop: 20,
                    }}
                  >
                    {activities.map(
                      (activity) => (
                        <div
                          key={
                            activity.id
                          }
                          style={{
                            border:
                              "1px solid #dfe9e5",
                            borderRadius:
                              12,
                            padding: 15,
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: 15,
                              flexWrap:
                                "wrap",
                              marginBottom:
                                8,
                            }}
                          >
                            <strong>
                              {
                                activity.subject
                              }
                            </strong>

                            <span
                              style={{
                                color:
                                  "#6b7f78",
                                fontSize:
                                  12,
                              }}
                            >
                              {formatDateTime(
                                activity.activity_at
                              )}
                            </span>
                          </div>

                          {activity.description && (
                            <div
                              style={{
                                whiteSpace:
                                  "pre-wrap",
                                color:
                                  "#53665f",
                                fontSize:
                                  13,
                                lineHeight:
                                  1.6,
                              }}
                            >
                              {
                                activity.description
                              }
                            </div>
                          )}
                        </div>
                      )
                    )}
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
}: {
  label: string;
  value: number;
  description: string;
  type:
    | "total"
    | "active"
    | "interested"
    | "closed";
}) {
  const styles = {
    total: {
      border: "#dbe8e4",
      background: "#ffffff",
      accent: "#00695c",
    },

    active: {
      border: "#dcebd4",
      background: "#fbfdf9",
      accent: "#5d8f1f",
    },

    interested: {
      border: "#cfe7df",
      background: "#f8fcfa",
      accent: "#00866f",
    },

    closed: {
      border: "#eadbdd",
      background: "#fffafa",
      accent: "#b45363",
    },
  };

  const selected =
    styles[type];

  return (
    <div
      style={{
        position: "relative",
        minWidth: 0,
        minHeight: 132,
        padding: "20px 20px 18px",
        border:
          `1px solid ${selected.border}`,
        borderRadius: 14,
        background:
          selected.background,
        boxShadow:
          "0 5px 18px rgba(23, 50, 44, 0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background:
            selected.accent,
        }}
      />

      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#6b7f78",
          textTransform:
            "uppercase",
          letterSpacing:
            "0.04em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 9,
          fontSize: 34,
          lineHeight: 1,
          fontWeight: 900,
          color: "#17322c",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 9,
          fontSize: 12,
          color: "#6b7f78",
        }}
      >
        {description}
      </div>
    </div>
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
          ? "#00695c"
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