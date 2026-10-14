"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type PipelineStage = {
  id: string;
  name: string;
  position: number;
  probability: number | null;
  is_won: boolean | null;
  is_lost: boolean | null;
};

type Lead = {
  id: string;
  ciu_number: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  product_service: string | null;
  contact_id: string | null;
  assigned_to: string | null;
};

type Opportunity = {
  id: string;
  lead_id: string | null;
  title: string;
  value: number | null;
  probability: number | null;
  stage_id: string;
  status: string;
  assigned_to: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
  is_active: boolean | null;
};

const WORKFLOW = [
  {
    name: "Leads",
    probability: 10,
  },
  {
    name: "Applied",
    probability: 40,
  },
  {
    name: "Paid Application Fee",
    probability: 75,
  },
  {
    name: "Paid Acceptance Fee",
    probability: 100,
  },
  {
    name: "Enrolled",
    probability: 100,
  },
];

function normalizeStageName(
  value: string | null | undefined,
) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function stageMatches(
  stageName: string,
  workflowName: string,
) {
  const actual = normalizeStageName(stageName);
  const expected = normalizeStageName(workflowName);

  if (actual === expected) {
    return true;
  }

  const aliases: Record<string, string[]> = {
    leads: [
      "lead",
      "new lead",
      "new leads",
    ],

    applied: [
      "application",
      "application started",
      "admitted",
      "admission",
    ],

    "paid application fee": [
      "application fee paid",
      "paid application",
      "application fee",
      "paid app fee",
    ],

    "paid acceptance fee": [
      "acceptance fee paid",
      "acceptance paid",
      "acceptance fee",
      "fee paid",
    ],

    enrolled: [
      "enrollment",
      "enrolled student",
    ],
  };

  return (
    aliases[expected]?.includes(actual) ??
    false
  );
}

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

function formatCurrency(
  value: number | null,
) {
  if (
    value === null ||
    value === undefined ||
    Number.isNaN(Number(value))
  ) {
    return "—";
  }

  return `UGX ${Number(value).toLocaleString(
    "en-UG",
  )}`;
}

export default function Pipeline() {
  const supabase = createClient();

  const [stages, setStages] = useState<
    PipelineStage[]
  >([]);

  const [opportunities, setOpportunities] =
    useState<Opportunity[]>([]);

  const [leads, setLeads] = useState<Lead[]>(
    [],
  );

  const [currentProfile, setCurrentProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [selectedStage, setSelectedStage] =
    useState("Leads");

  const [searchTerm, setSearchTerm] =
    useState("");

  const isSalesperson =
    currentProfile?.role === "salesperson";

  const canViewAll =
    currentProfile?.role === "admin" ||
    currentProfile?.role === "super_admin" ||
    currentProfile?.role === "manager";

  async function loadPipeline(
    isRefresh = false,
  ) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You are not authenticated.",
        );
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, role, is_active",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profileData) {
        throw new Error(
          "Your CRM profile could not be found.",
        );
      }

      const profile =
        profileData as Profile;

      setCurrentProfile(profile);

      const {
        data: stageData,
        error: stageError,
      } = await supabase
        .from("pipeline_stages")
        .select(
          "id, name, position, probability, is_won, is_lost",
        )
        .order("position", {
          ascending: true,
        });

      if (stageError) {
        throw stageError;
      }

      let opportunityQuery =
        supabase
          .from("opportunities")
          .select(
            "id, lead_id, title, value, probability, stage_id, status, assigned_to, updated_at, created_at",
          )
          .order("created_at", {
            ascending: false,
          });

      let leadQuery =
        supabase
          .from("leads")
          .select(
            "id, ciu_number, name, phone, email, product_service, contact_id, assigned_to",
          )
          .order("name", {
            ascending: true,
          });

      if (profile.role === "salesperson") {
        opportunityQuery =
          opportunityQuery.eq(
            "assigned_to",
            user.id,
          );

        leadQuery =
          leadQuery.eq(
            "assigned_to",
            user.id,
          );
      }

      const [
        {
          data: opportunityData,
          error: opportunityError,
        },
        {
          data: leadData,
          error: leadError,
        },
      ] = await Promise.all([
        opportunityQuery,
        leadQuery,
      ]);

      if (opportunityError) {
        throw opportunityError;
      }

      if (leadError) {
        throw leadError;
      }

      setStages(
        (stageData as PipelineStage[]) || [],
      );

      setOpportunities(
        (opportunityData as Opportunity[]) ||
          [],
      );

      setLeads(
        (leadData as Lead[]) || [],
      );
    } catch (error) {
      console.error(
        "Pipeline loading error:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The pipeline could not be loaded.",
      );

      if (!isRefresh) {
        setStages([]);
        setOpportunities([]);
        setLeads([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadPipeline();
  }, []);

  const workflowStages = useMemo(() => {
    return WORKFLOW.map(
      (workflow, index) => {
        const existing =
          stages.find((stage) =>
            stageMatches(
              stage.name,
              workflow.name,
            ),
          );

        return {
          id:
            existing?.id ||
            `workflow-${index}`,

          name: workflow.name,

          probability:
            existing?.probability ??
            workflow.probability,

          is_won:
            workflow.name === "Enrolled",

          is_lost: false,

          position: index,

          databaseStage:
            existing || null,
        };
      },
    );
  }, [stages]);

  function getLead(
    opportunity: Opportunity,
  ) {
    return leads.find(
      (lead) =>
        lead.id === opportunity.lead_id,
    );
  }

  function getStageForOpportunity(
    opportunity: Opportunity,
  ) {
    const databaseStage =
      stages.find(
        (stage) =>
          stage.id ===
          opportunity.stage_id,
      );

    return workflowStages.find(
      (stage) =>
        databaseStage &&
        stageMatches(
          databaseStage.name,
          stage.name,
        ),
    );
  }

  function getStageStudents(
    workflowStageName: string,
  ) {
    return opportunities.filter(
      (opportunity) => {
        const currentStage =
          getStageForOpportunity(
            opportunity,
          );

        if (
          currentStage?.name !==
          workflowStageName
        ) {
          return false;
        }

        if (
          workflowStageName ===
          "Enrolled"
        ) {
          return (
            opportunity.status ===
              "won" ||
            opportunity.status ===
              "open"
          );
        }

        return (
          opportunity.status ===
          "open"
        );
      },
    );
  }

  const stageCounts = useMemo(() => {
    const counts: Record<
      string,
      number
    > = {};

    workflowStages.forEach(
      (stage) => {
        counts[stage.name] =
          getStageStudents(
            stage.name,
          ).length;
      },
    );

    return counts;
  }, [
    opportunities,
    stages,
    workflowStages,
  ]);

  const selectedStudents = useMemo(() => {
    const students =
      getStageStudents(
        selectedStage,
      );

    const search =
      searchTerm.trim().toLowerCase();

    if (!search) {
      return students;
    }

    return students.filter(
      (opportunity) => {
        const lead =
          getLead(opportunity);

        const searchable = [
          lead?.name,
          lead?.ciu_number,
          lead?.phone,
          lead?.email,
          lead?.product_service,
          opportunity.title,
          opportunity.status,
          opportunity.assigned_to,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(
          search,
        );
      },
    );
  }, [
    opportunities,
    stages,
    leads,
    workflowStages,
    selectedStage,
    searchTerm,
  ]);

  async function moveOpportunity(
    opportunityId: string,
    workflowStageName: string,
  ) {
    const workflowStage =
      workflowStages.find(
        (stage) =>
          stage.name === workflowStageName,
      );

    if (
      !workflowStage?.databaseStage
    ) {
      setErrorMessage(
        `The "${workflowStageName}" pipeline stage is not available in the database.`,
      );
      return;
    }

    const opportunity =
      opportunities.find(
        (item) =>
          item.id === opportunityId,
      );

    if (!opportunity) {
      return;
    }

    if (
      isSalesperson &&
      opportunity.assigned_to !==
        currentProfile?.id
    ) {
      setErrorMessage(
        "You can only manage opportunities assigned to you.",
      );
      return;
    }

    const previousStageId =
      opportunity.stage_id;

    const previousStatus =
      opportunity.status;

    const previousProbability =
      opportunity.probability;

    const selectedDatabaseStage =
      workflowStage.databaseStage;

    const now =
      new Date().toISOString();

    setSaving(true);
    setErrorMessage("");

    try {
      if (
        workflowStageName ===
        "Enrolled"
      ) {
        await moveToEnrolled(
          opportunity,
          selectedDatabaseStage,
          now,
          previousStageId,
          previousStatus,
          previousProbability,
        );

        return;
      }

      const newProbability =
        Number(
          selectedDatabaseStage.probability ??
            workflowStage.probability,
        );

      const { error } =
        await supabase
          .from("opportunities")
          .update({
            stage_id:
              selectedDatabaseStage.id,

            probability:
              newProbability,

            status: "open",

            updated_at: now,
          })
          .eq(
            "id",
            opportunityId,
          );

      if (error) {
        throw error;
      }

      setOpportunities(
        (current) =>
          current.map((item) =>
            item.id === opportunityId
              ? {
                  ...item,

                  stage_id:
                    selectedDatabaseStage.id,

                  probability:
                    newProbability,

                  status: "open",

                  updated_at: now,
                }
              : item,
          ),
      );

      setSelectedStage(
        workflowStageName,
      );
    } catch (error) {
      console.error(
        "Pipeline update error:",
        error,
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The pipeline stage could not be updated.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveToEnrolled(
    opportunity: Opportunity,
    selectedStage: PipelineStage,
    now: string,
    previousStageId: string,
    previousStatus: string,
    previousProbability: number | null,
  ) {
    if (!opportunity.lead_id) {
      throw new Error(
        "This opportunity has no linked lead and cannot be enrolled.",
      );
    }

    const lead =
      getLead(opportunity);

    if (!lead) {
      throw new Error(
        "The linked lead could not be found.",
      );
    }

    const assignedTo =
      opportunity.assigned_to ??
      lead.assigned_to ??
      currentProfile?.id ??
      null;

    const {
      data: admission,
      error:
        admissionLookupError,
    } = await supabase
      .from("admissions")
     .select(
  "id, lead_id, stage, assigned_to, enrolled_at",
)
      .eq(
        "lead_id",
        opportunity.lead_id,
      )
      .maybeSingle();

    if (admissionLookupError) {
      throw admissionLookupError;
    }

    let admissionId =
      admission?.id || null;

    if (!admission) {
      const {
        data: createdAdmission,
        error: createError,
      } = await supabase
        .from("admissions")
        .insert({
          lead_id: lead.id,

          contact_id:
            lead.contact_id,

          ciu_number:
            lead.ciu_number,

          full_names:
            lead.name,

          telephone:
            lead.phone,

          email:
            lead.email,

          program:
            lead.product_service,

          stage: "Enrolled",

          enrolled_at: now,

          assigned_to:
            assignedTo,

          application_fee: 0,

          application_paid: 0,

          acceptance_fee: 0,

          acceptance_paid: 0,

          tuition_fee:
            Number(
              opportunity.value || 0,
            ),

          tuition_paid: 0,

          last_contact: now,

          source: "Pipeline",

          notes:
            "Admission record created automatically when the student was moved to Enrolled from the Pipeline.",

          created_at: now,

          updated_at: now,
        })
        .select("id")
        .single();

      if (
        createError ||
        !createdAdmission
      ) {
        throw (
          createError ||
          new Error(
            "The admission record could not be created.",
          )
        );
      }

      admissionId =
        createdAdmission.id;
    }

    const {
      error: opportunityError,
    } = await supabase
      .from("opportunities")
      .update({
        stage_id:
          selectedStage.id,

        probability: 100,

        status: "won",

        assigned_to:
          assignedTo,

        updated_at: now,
      })
      .eq(
        "id",
        opportunity.id,
      );

    if (opportunityError) {
      if (!admission) {
        await supabase
          .from("admissions")
          .delete()
          .eq(
            "id",
            admissionId,
          );
      }

      throw opportunityError;
    }

    const {
      error:
        admissionUpdateError,
    } = await supabase
      .from("admissions")
            .update({
        stage: "Enrolled",

        enrolled_at: admission?.enrolled_at ?? now,

        assigned_to:
          assignedTo,

        full_names:
          lead.name,

        telephone:
          lead.phone,

        email:
          lead.email,

        program:
          lead.product_service,

        ciu_number:
          lead.ciu_number,

        updated_at: now,
      })
      .eq(
        "id",
        admissionId,
      );

    if (admissionUpdateError) {
      await supabase
        .from("opportunities")
        .update({
          stage_id:
            previousStageId,

          probability:
            previousProbability,

          status:
            previousStatus,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          opportunity.id,
        );

      if (!admission) {
        await supabase
          .from("admissions")
          .delete()
          .eq(
            "id",
            admissionId,
          );
      }

      throw new Error(
        "The admission could not be updated. The Pipeline change was rolled back.",
      );
    }

    setOpportunities(
      (current) =>
        current.map((item) =>
          item.id === opportunity.id
            ? {
                ...item,

                stage_id:
                  selectedStage.id,

                probability: 100,

                status: "won",

                assigned_to:
                  assignedTo,

                updated_at: now,
              }
            : item,
        ),
    );
  }

  function getStatusLabel(
    opportunity: Opportunity,
  ) {
    if (
      opportunity.status ===
      "won"
    ) {
      return "Enrolled";
    }

    if (
      opportunity.status ===
      "lost"
    ) {
      return "Lost";
    }

    return "Active";
  }

  function getStatusClass(
    opportunity: Opportunity,
  ) {
    if (
      opportunity.status ===
      "won"
    ) {
      return "status-enrolled";
    }

    if (
      opportunity.status ===
      "lost"
    ) {
      return "status-lost";
    }

    return "status-active";
  }

  function getInitials(
    name: string,
  ) {
    const parts = name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (parts.length === 0) {
      return "ST";
    }

    return parts
      .slice(0, 2)
      .map((part) =>
        part.charAt(0).toUpperCase(),
      )
      .join("");
  }

  function displayStageName(
    name: string,
  ) {
    if (name === "Applied") {
      return "Applied / Admitted";
    }

    if (
      name ===
      "Paid Application Fee"
    ) {
      return "Application Fee Paid";
    }

    if (
      name ===
      "Paid Acceptance Fee"
    ) {
      return "Acceptance Fee Paid";
    }

    return name;
  }

  return (
    <div className="ciu-page">
      <div className="ciu-page-inner">
        <div
          className="ciu-hero"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            width: "100%",
            position: "relative",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#00695c",
                textTransform:
                  "uppercase",
                letterSpacing:
                  "0.08em",
                marginBottom: 7,
              }}
            >
              Admissions Workflow
            </div>

            <h1>
              {isSalesperson
                ? "My Admissions Pipeline"
                : "Admissions Pipeline"}
            </h1>

            <p>
              Manage students through the
              complete CIU admission journey.
              Select a stage below to view
              the students currently at that
              stage.
            </p>
          </div>

          <button
            type="button"
            className="ciu-btn-light"
            onClick={() =>
              loadPipeline(true)
            }
            disabled={
              refreshing ||
              loading ||
              saving
            }
            style={{
              position: "relative",
              zIndex: 10,
              pointerEvents: "auto",
              minHeight: 42,
              flexShrink: 0,
            }}
          >
            {refreshing
              ? "Refreshing..."
              : "↻ Refresh"}
          </button>
        </div>

        {errorMessage && (
          <div
            style={{
              marginTop: 16,
              padding: "13px 16px",
              borderRadius: 12,
              background: "#fff1f2",
              border:
                "1px solid #fecdd3",
              color: "#be123c",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          className="pipeline-stage-tabs-wrap"
          style={{
            marginTop: 18,
          }}
        >
          <div className="pipeline-stage-tabs">
            {workflowStages.map(
              (stage) => {
                const isSelected =
                  selectedStage ===
                  stage.name;

                return (
                  <button
                    type="button"
                    key={stage.name}
                    className={`pipeline-stage-tab ${
                      isSelected
                        ? "pipeline-stage-tab-active"
                        : ""
                    }`}
                    onClick={() => {
                      setSelectedStage(
                        stage.name,
                      );
                      setSearchTerm("");
                    }}
                  >
                    <span>
                      {displayStageName(
                        stage.name,
                      )}
                    </span>

                    <strong>
                      {stageCounts[
                        stage.name
                      ] ?? 0}
                    </strong>
                  </button>
                );
              },
            )}
          </div>
        </div>

        {loading ? (
          <div
            className="ciu-card"
            style={{
              marginTop: 18,
              padding: 50,
              textAlign: "center",
              color: "#6b7f78",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 750,
                color: "#36564e",
              }}
            >
              Loading admissions
              pipeline...
            </div>

            <div
              style={{
                marginTop: 6,
                fontSize: 12,
              }}
            >
              Connecting to your CRM
              data.
            </div>
          </div>
        ) : (
          <div
            className="ciu-card"
            style={{
              marginTop: 18,
            }}
          >
            <div className="ciu-card-head">
              <div>
                <strong>
                  {displayStageName(
                    selectedStage,
                  )}
                </strong>

                <span>
                  {selectedStudents.length}{" "}
                  student
                  {selectedStudents.length ===
                  1
                    ? ""
                    : "s"}{" "}
                  in this stage
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 10,
                  minWidth: 280,
                }}
              >
                <input
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value,
                    )
                  }
                  placeholder="Search students..."
                  className="pipeline-search"
                />
              </div>
            </div>

            <div className="pipeline-table-scroll">
              <table className="pipeline-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>CIU Number</th>
                    <th>Telephone</th>
                    <th>Email</th>
                    <th>Programme</th>
                    <th>Status</th>
                    <th>Probability</th>
                    <th>Opportunity Value</th>
                    <th>Assigned To</th>
                    <th>Created</th>
                    <th>Updated</th>
                    <th>Move To</th>
                  </tr>
                </thead>

                <tbody>
                  {selectedStudents.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={12}
                        style={{
                          padding: 55,
                          textAlign:
                            "center",
                        }}
                      >
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            margin:
                              "0 auto 12px",
                            borderRadius: 14,
                            display: "grid",
                            placeItems:
                              "center",
                            background:
                              "#edf7f3",
                            color:
                              "#00695c",
                            fontSize: 20,
                            fontWeight: 800,
                          }}
                        >
                          —
                        </div>

                        <strong
                          style={{
                            color:
                              "#17322c",
                            fontSize: 14,
                          }}
                        >
                          {searchTerm
                            ? "No matching students"
                            : "No students in this stage"}
                        </strong>

                        <p
                          style={{
                            margin:
                              "6px auto 0",
                            maxWidth: 450,
                            color:
                              "#71817b",
                            fontSize: 12,
                            lineHeight:
                              1.6,
                          }}
                        >
                          {searchTerm
                            ? "Try another name, CIU number, telephone, email or programme."
                            : "Students will appear here when they enter this stage of the admissions workflow."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    selectedStudents.map(
                      (deal) => {
                        const lead =
                          getLead(
                            deal,
                          );

                        const studentName =
                          lead?.name ||
                          deal.title ||
                          "Unnamed Student";

                        const currentWorkflowStage =
                          getStageForOpportunity(
                            deal,
                          );

                        const probability =
                          deal.probability ??
                          currentWorkflowStage?.probability ??
                          0;

                        return (
                          <tr
                            key={
                              deal.id
                            }
                          >
                            <td>
                              <div className="student-cell">
                                <div className="student-avatar">
                                  {getInitials(
                                    studentName,
                                  )}
                                </div>

                                <div
                                  className="student-name-wrap"
                                >
                                  <strong>
                                    {
                                      studentName
                                    }
                                  </strong>

                                  <small>
                                    {
                                      deal.title
                                    }
                                  </small>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="table-primary">
                                {lead?.ciu_number ||
                                  "—"}
                              </span>
                            </td>

                            <td>
                              {lead?.phone ||
                                "—"}
                            </td>

                            <td>
                              <span className="table-email">
                                {lead?.email ||
                                  "—"}
                              </span>
                            </td>

                            <td>
                              <span className="programme-cell">
                                {lead?.product_service ||
                                  "Programme not set"}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`pipeline-status ${getStatusClass(
                                  deal,
                                )}`}
                              >
                                {getStatusLabel(
                                  deal,
                                )}
                              </span>
                            </td>

                            <td>
                              <div className="probability-cell">
                                <span>
                                  {Math.min(
                                    Math.max(
                                      Number(
                                        probability,
                                      ),
                                      0,
                                    ),
                                    100,
                                  )}
                                  %
                                </span>

                                <div className="mini-progress">
                                  <div
                                    style={{
                                      width: `${Math.min(
                                        Math.max(
                                          Number(
                                            probability,
                                          ),
                                          0,
                                        ),
                                        100,
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            </td>

                            <td>
                              {formatCurrency(
                                deal.value,
                              )}
                            </td>

                            <td>
                              <span className="assigned-cell">
                                {deal.assigned_to ||
                                  "Unassigned"}
                              </span>
                            </td>

                            <td>
                              {formatDate(
                                deal.created_at,
                              )}
                            </td>

                            <td>
                              {formatDate(
                                deal.updated_at,
                              )}
                            </td>

                            <td>
                              <select
                                value={
                                  currentWorkflowStage?.name ||
                                  selectedStage
                                }
                                disabled={
                                  saving ||
                                  !currentWorkflowStage?.databaseStage
                                }
                                onChange={(
                                  event,
                                ) =>
                                  moveOpportunity(
                                    deal.id,
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                className="pipeline-move-select"
                              >
                                {workflowStages.map(
                                  (
                                    option,
                                  ) => (
                                    <option
                                      key={
                                        option.name
                                      }
                                      value={
                                        option.name
                                      }
                                      disabled={
                                        !option.databaseStage
                                      }
                                    >
                                      {displayStageName(
                                        option.name,
                                      )}
                                    </option>
                                  ),
                                )}
                              </select>
                            </td>
                          </tr>
                        );
                      },
                    )
                  )}
                </tbody>
              </table>
            </div>

            <div className="pipeline-table-footer">
              <span>
                Showing{" "}
                <strong>
                  {selectedStudents.length}
                </strong>{" "}
                of{" "}
                <strong>
                  {stageCounts[
                    selectedStage
                  ] ?? 0}
                </strong>{" "}
                students in{" "}
                <strong>
                  {displayStageName(
                    selectedStage,
                  )}
                </strong>
              </span>

              {saving && (
                <span className="saving-indicator">
                  Saving pipeline change...
                </span>
              )}
            </div>
          </div>
        )}

        {!loading &&
          stages.length > 0 &&
          workflowStages.some(
            (stage) =>
              !stage.databaseStage,
          ) && (
            <div
              style={{
                marginTop: 18,
                padding: 14,
                borderRadius: 12,
                background: "#fff8e7",
                border:
                  "1px solid #f1d58a",
                color: "#755b13",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              <strong>
                Pipeline setup notice:
              </strong>{" "}
              Some required admission
              stages are not yet configured
              in Supabase. Those stages will
              become available after the
              corresponding pipeline stage
              records are created.
            </div>
          )}

        {!loading &&
          !isSalesperson &&
          !canViewAll && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                color: "#6b7f78",
              }}
            >
              Your role has limited
              pipeline visibility.
            </div>
          )}
      </div>

      <style jsx>{`
        .pipeline-stage-tabs-wrap {
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          padding-bottom: 3px;
          -webkit-overflow-scrolling: touch;
        }

        .pipeline-stage-tabs {
          display: flex;
          align-items: stretch;
          gap: 8px;
          width: max-content;
          min-width: 100%;
        }

        .pipeline-stage-tab {
          appearance: none;
          border: 1px solid #d8e5df;
          border-radius: 12px;
          background: #ffffff;
          color: #48635b;
          min-height: 52px;
          padding: 8px 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          white-space: nowrap;
          transition:
            background 0.15s ease,
            border-color 0.15s ease,
            color 0.15s ease,
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        .pipeline-stage-tab:hover {
          border-color: #a9c8bc;
          background: #f7fbf9;
          transform: translateY(-1px);
        }

        .pipeline-stage-tab strong {
          min-width: 27px;
          height: 27px;
          display: grid;
          place-items: center;
          padding: 0 7px;
          border-radius: 999px;
          background: #edf3f0;
          color: #5f756c;
          font-size: 11px;
        }

        .pipeline-stage-tab-active {
          border-color: #00695c;
          background: #00695c;
          color: #ffffff;
          box-shadow:
            0 6px 18px
            rgba(0, 105, 92, 0.18);
        }

        .pipeline-stage-tab-active:hover {
          background: #00574d;
          border-color: #00574d;
          color: #ffffff;
        }

        .pipeline-stage-tab-active strong {
          background: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }

        .pipeline-search {
          width: 100%;
          min-height: 40px;
          padding: 9px 12px;
          border: 1px solid #d6e3de;
          border-radius: 10px;
          outline: none;
          background: #ffffff;
          color: #36564e;
          font-family: inherit;
          font-size: 12px;
        }

        .pipeline-search::placeholder {
          color: #9aa8a3;
        }

        .pipeline-search:focus {
          border-color: #7db9a8;
          box-shadow:
            0 0 0 3px
            rgba(0, 105, 92, 0.09);
        }

        .pipeline-table-scroll {
          width: 100%;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: auto;
          max-height: calc(100vh - 350px);
          min-height: 350px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: auto;
        }

        .pipeline-table-scroll::-webkit-scrollbar {
          width: 11px;
          height: 12px;
        }

        .pipeline-table-scroll::-webkit-scrollbar-track {
          background: #eef3f0;
        }

        .pipeline-table-scroll::-webkit-scrollbar-thumb {
          background: #9bb8ad;
          border-radius: 999px;
          border: 3px solid #eef3f0;
        }

        .pipeline-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #6f9c8d;
        }

        .pipeline-table {
          width: max-content;
          min-width: 1500px;
          border-collapse: separate;
          border-spacing: 0;
          color: #314840;
          font-size: 12px;
        }

        .pipeline-table th {
          position: sticky;
          top: 0;
          z-index: 3;
          padding: 13px 14px;
          border-bottom: 1px solid #dfe9e5;
          background: #f7faf8;
          color: #687a73;
          font-size: 10px;
          font-weight: 850;
          letter-spacing: 0.055em;
          text-align: left;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .pipeline-table td {
          padding: 13px 14px;
          border-bottom: 1px solid #edf2ef;
          background: #ffffff;
          vertical-align: middle;
          white-space: nowrap;
        }

        .pipeline-table tbody tr:hover td {
          background: #f9fcfa;
        }

        .pipeline-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .student-cell {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 220px;
        }

        .student-avatar {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: #e8f4ef;
          color: #00695c;
          font-size: 10px;
          font-weight: 850;
        }

        .student-name-wrap {
          min-width: 0;
        }

        .student-name-wrap strong {
          display: block;
          max-width: 220px;
          overflow: hidden;
          color: #17322c;
          font-size: 12px;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .student-name-wrap small {
          display: block;
          margin-top: 3px;
          color: #84938e;
          font-size: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 220px;
        }

        .table-primary {
          color: #00695c;
          font-weight: 750;
        }

        .table-email {
          color: #526b63;
        }

        .programme-cell {
          display: block;
          max-width: 230px;
          overflow: hidden;
          color: #36564e;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pipeline-status {
          display: inline-flex;
          align-items: center;
          min-height: 27px;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
        }

        .status-active {
          background: #eef7f3;
          color: #00695c;
        }

        .status-enrolled {
          background: #e7f5ed;
          color: #187447;
        }

        .status-lost {
          background: #fff1f2;
          color: #be123c;
        }

        .probability-cell {
          min-width: 95px;
        }

        .probability-cell > span {
          display: block;
          margin-bottom: 5px;
          color: #00695c;
          font-size: 11px;
          font-weight: 800;
        }

        .mini-progress {
          width: 75px;
          height: 5px;
          overflow: hidden;
          border-radius: 999px;
          background: #e6efeb;
        }

        .mini-progress > div {
          height: 100%;
          border-radius: inherit;
          background: #00695c;
          transition: width 0.25s ease;
        }

        .assigned-cell {
          color: #526b63;
          font-size: 11px;
        }

        .pipeline-move-select {
          min-width: 165px;
          min-height: 35px;
          padding: 7px 9px;
          border: 1px solid #d6e3de;
          border-radius: 9px;
          outline: none;
          background: #ffffff;
          color: #36564e;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .pipeline-move-select:focus {
          border-color: #7db9a8;
          box-shadow:
            0 0 0 3px
            rgba(0, 105, 92, 0.09);
        }

        .pipeline-move-select:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .pipeline-table-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 13px 16px;
          border-top: 1px solid #edf2ef;
          background: #fafcfb;
          color: #71817b;
          font-size: 11px;
        }

        .pipeline-table-footer strong {
          color: #36564e;
        }

        .saving-indicator {
          color: #00695c;
          font-weight: 800;
        }

        @media (max-width: 700px) {
          .ciu-hero {
            padding-bottom: 72px;
          }

          .ciu-hero button {
            top: auto !important;
            right: 23px !important;
            bottom: 20px !important;
          }

          .pipeline-stage-tab {
            min-height: 48px;
            padding: 7px 11px;
            font-size: 11px;
          }

          .ciu-card-head {
            align-items: stretch;
            flex-direction: column;
          }

          .pipeline-search {
            min-width: 100%;
          }

          .pipeline-table-scroll {
            max-height: calc(100vh - 390px);
          }
        }
      `}</style>
    </div>
  );
}