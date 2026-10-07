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
    name: "Interested",
    probability: 20,
  },
  {
    name: "Applied",
    probability: 35,
  },
  {
    name: "Application Submitted",
    probability: 50,
  },
  {
    name: "Admitted",
    probability: 65,
  },
  {
    name: "Acceptance Fee Paid",
    probability: 85,
  },
  {
    name: "Enrolled",
    probability: 100,
  },
];

function normalizeStageName(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function stageMatches(
  stageName: string,
  workflowName: string
) {
  const actual = normalizeStageName(stageName);
  const expected = normalizeStageName(workflowName);

  if (actual === expected) return true;

  const aliases: Record<string, string[]> = {
    interested: ["qualified", "new opportunity"],
    applied: ["application", "application started"],
    "application submitted": [
      "submitted",
      "application complete",
    ],
    admitted: ["admission", "accepted"],
    "acceptance fee paid": [
      "acceptance paid",
      "acceptance fee",
      "fee paid",
    ],
    enrolled: ["enrollment", "enrolled student"],
  };

  return aliases[expected]?.includes(actual) ?? false;
}

export default function Pipeline() {
  const supabase = createClient();

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [opportunities, setOpportunities] = useState<
    Opportunity[]
  >([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [currentProfile, setCurrentProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isSalesperson =
    currentProfile?.role === "salesperson";

  const canViewAll =
    currentProfile?.role === "admin" ||
    currentProfile?.role === "super_admin";

  async function loadPipeline() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error(
          "You are not authenticated."
        );
      }

      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            "id, full_name, role, is_active"
          )
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) throw profileError;

      if (!profileData) {
        throw new Error(
          "Your CRM profile could not be found."
        );
      }

      const profile = profileData as Profile;
      setCurrentProfile(profile);

      const { data: stageData, error: stageError } =
        await supabase
          .from("pipeline_stages")
          .select(
            "id, name, position, probability, is_won, is_lost"
          )
          .order("position", {
            ascending: true,
          });

      if (stageError) throw stageError;

      let opportunityQuery = supabase
        .from("opportunities")
        .select(
          "id, lead_id, title, value, probability, stage_id, status, assigned_to, updated_at, created_at"
        )
        .order("created_at", {
          ascending: false,
        });

      let leadQuery = supabase
        .from("leads")
        .select(
          "id, ciu_number, name, phone, email, product_service, contact_id, assigned_to"
        )
        .order("name", {
          ascending: true,
        });

      if (profile.role === "salesperson") {
        opportunityQuery = opportunityQuery.eq(
          "assigned_to",
          user.id
        );

        leadQuery = leadQuery.eq(
          "assigned_to",
          user.id
        );
      }

      const [
        { data: opportunityData, error: opportunityError },
        { data: leadData, error: leadError },
      ] = await Promise.all([
        opportunityQuery,
        leadQuery,
      ]);

      if (opportunityError) throw opportunityError;
      if (leadError) throw leadError;

      setStages(
        (stageData as PipelineStage[]) || []
      );

      setOpportunities(
        (opportunityData as Opportunity[]) || []
      );

      setLeads((leadData as Lead[]) || []);
    } catch (error) {
      console.error(
        "Pipeline loading error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The pipeline could not be loaded."
      );

      setStages([]);
      setOpportunities([]);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPipeline();
  }, []);

  const workflowStages = useMemo(() => {
    return WORKFLOW.map((workflow, index) => {
      const existing = stages.find((stage) =>
        stageMatches(stage.name, workflow.name)
      );

      return {
        id: existing?.id || `workflow-${index}`,
        name: workflow.name,
        probability:
          existing?.probability ??
          workflow.probability,
        is_won: workflow.name === "Enrolled",
        is_lost: false,
        position: index,
        databaseStage: existing || null,
      };
    });
  }, [stages]);

  const openOpportunities = opportunities.filter(
    (opportunity) =>
      opportunity.status === "open"
  );

  const wonOpportunities = opportunities.filter(
    (opportunity) =>
      opportunity.status === "won"
  );

  const lostOpportunities = opportunities.filter(
    (opportunity) =>
      opportunity.status === "lost"
  );

  const pipelineValue = openOpportunities.reduce(
    (sum, opportunity) =>
      sum + Number(opportunity.value || 0),
    0
  );

  const expectedRevenue = openOpportunities.reduce(
    (sum, opportunity) => {
      const stage = stages.find(
        (item) =>
          item.id === opportunity.stage_id
      );

      const probability =
        opportunity.probability ??
        stage?.probability ??
        0;

      return (
        sum +
        Number(opportunity.value || 0) *
          (Number(probability) / 100)
      );
    },
    0
  );

  const startOfMonth = new Date();

  startOfMonth.setDate(1);
  startOfMonth.setHours(
    0,
    0,
    0,
    0
  );

  const wonThisMonth = wonOpportunities
    .filter((opportunity) => {
      const date =
        opportunity.updated_at ||
        opportunity.created_at;

      return (
        date &&
        new Date(date) >= startOfMonth
      );
    })
    .reduce(
      (sum, opportunity) =>
        sum + Number(opportunity.value || 0),
      0
    );

  const closedDeals =
    wonOpportunities.length +
    lostOpportunities.length;

  const conversionRate =
    closedDeals > 0
      ? (wonOpportunities.length /
          closedDeals) *
        100
      : 0;

  function formatCurrency(value: number) {
    if (value >= 1000000) {
      return `UGX ${(value / 1000000).toFixed(
        1
      )}M`;
    }

    if (value >= 1000) {
      return `UGX ${(value / 1000).toFixed(
        0
      )}K`;
    }

    return `UGX ${value.toLocaleString()}`;
  }

  function getLead(opportunity: Opportunity) {
    return leads.find(
      (lead) =>
        lead.id === opportunity.lead_id
    );
  }

  function getStageForOpportunity(
    opportunity: Opportunity
  ) {
    const databaseStage = stages.find(
      (stage) =>
        stage.id === opportunity.stage_id
    );

    return workflowStages.find(
      (stage) =>
        databaseStage &&
        stageMatches(
          databaseStage.name,
          stage.name
        )
    );
  }

  async function moveOpportunity(
    opportunityId: string,
    workflowStageName: string
  ) {
    const workflowStage = workflowStages.find(
      (stage) =>
        stage.name === workflowStageName
    );

    if (!workflowStage?.databaseStage) {
      setErrorMessage(
        `The "${workflowStageName}" pipeline stage is not available in the database.`
      );
      return;
    }

    const opportunity = opportunities.find(
      (item) =>
        item.id === opportunityId
    );

    if (!opportunity) return;

    if (
      isSalesperson &&
      opportunity.assigned_to !==
        currentProfile?.id
    ) {
      setErrorMessage(
        "You can only manage opportunities assigned to you."
      );
      return;
    }

    const previousStageId =
      opportunity.stage_id;

    const previousStatus =
      opportunity.status;

    const previousProbability =
      opportunity.probability;

    const selectedStage =
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
          selectedStage,
          now,
          previousStageId,
          previousStatus,
          previousProbability
        );

        return;
      }

      const { error } = await supabase
        .from("opportunities")
        .update({
          stage_id:
            selectedStage.id,
          probability:
            Number(
              selectedStage.probability ??
                workflowStage.probability
            ),
          status: "open",
          updated_at: now,
        })
        .eq(
          "id",
          opportunityId
        );

      if (error) throw error;

      setOpportunities(
        (current) =>
          current.map((item) =>
            item.id === opportunityId
              ? {
                  ...item,
                  stage_id:
                    selectedStage.id,
                  probability:
                    Number(
                      selectedStage.probability ??
                        workflowStage.probability
                    ),
                  status: "open",
                  updated_at: now,
                }
              : item
          )
      );
    } catch (error) {
      console.error(
        "Pipeline update error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The pipeline stage could not be updated."
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
    previousProbability: number | null
  ) {
    if (!opportunity.lead_id) {
      throw new Error(
        "This opportunity has no linked lead and cannot be enrolled."
      );
    }

    const lead = getLead(opportunity);

    if (!lead) {
      throw new Error(
        "The linked lead could not be found."
      );
    }

    const {
      data: admission,
      error: admissionLookupError,
    } = await supabase
      .from("admissions")
      .select(
        "id, lead_id, stage"
      )
      .eq(
        "lead_id",
        opportunity.lead_id
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
          application_fee: 0,
          application_paid: 0,
          acceptance_fee: 0,
          acceptance_paid: 0,
          tuition_fee:
            Number(
              opportunity.value || 0
            ),
          tuition_paid: 0,
          last_contact: now,
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
            "The admission record could not be created."
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
        updated_at: now,
      })
      .eq(
        "id",
        opportunity.id
      );

    if (opportunityError) {
      throw opportunityError;
    }

    const {
      error: admissionUpdateError,
    } = await supabase
      .from("admissions")
      .update({
        stage: "Enrolled",
        updated_at: now,
      })
      .eq(
        "id",
        admissionId
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
          opportunity.id
        );

      throw new Error(
        "The admission could not be updated. The Pipeline change was rolled back."
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
                updated_at: now,
              }
            : item
        )
    );
  }

  function renderStageCards() {
    return workflowStages.map(
      (workflowStage) => {
        const stageDeals =
          opportunities.filter(
            (opportunity) => {
              const currentStage =
                getStageForOpportunity(
                  opportunity
                );

              if (
                currentStage?.name !==
                workflowStage.name
              ) {
                return false;
              }

              if (
                workflowStage.name ===
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
            }
          );

        return (
          <div
            className="crm-stage"
            key={
              workflowStage.name
            }
          >
            <div className="crm-stage-head">
              <strong>
                {workflowStage.name}
              </strong>

              <span>
                {stageDeals.length}{" "}
                {stageDeals.length ===
                1
                  ? "student"
                  : "students"}
              </span>
            </div>

            <div
              style={{
                fontSize: 11,
                color: "#6b7f78",
                marginBottom: 10,
              }}
            >
              {workflowStage.probability}%
              probability
            </div>

            {stageDeals.length ===
            0 ? (
              <div
                style={{
                  padding:
                    "18px 8px",
                  textAlign:
                    "center",
                  fontSize: 12,
                  color: "#7b8c86",
                }}
              >
                No students
              </div>
            ) : (
              stageDeals.map(
                (deal) => {
                  const lead =
                    getLead(
                      deal
                    );

                  const probability =
                    deal.probability ??
                    workflowStage.probability;

                  return (
                    <div
                      className="crm-deal"
                      key={
                        deal.id
                      }
                    >
                      <strong>
                        {lead?.name ||
                          deal.title}
                      </strong>

                      <small>
                        {lead?.ciu_number ||
                          "No CIU number"}
                      </small>

                      <small>
                        {lead?.product_service ||
                          "Programme not set"}
                      </small>

                      {lead?.phone && (
                        <small>
                          {lead.phone}
                        </small>
                      )}

                      <div className="crm-deal-value">
                        {formatCurrency(
                          Number(
                            deal.value ||
                              0
                          )
                        )}
                      </div>

                      <div className="crm-progress">
                        <div
                          style={{
                            width: `${Math.min(
                              Math.max(
                                Number(
                                  probability
                                ),
                                0
                              ),
                              100
                            )}%`,
                          }}
                        />
                      </div>

                      <select
                        value={
                          workflowStage.name
                        }
                        disabled={
                          saving ||
                          !workflowStage.databaseStage
                        }
                        onChange={(
                          event
                        ) =>
                          moveOpportunity(
                            deal.id,
                            event
                              .target
                              .value
                          )
                        }
                        style={{
                          width:
                            "100%",
                          marginTop:
                            12,
                          padding:
                            "8px 9px",
                          border:
                            "1px solid #d1d5db",
                          borderRadius:
                            7,
                          background:
                            "#fff",
                          fontSize: 12,
                        }}
                      >
                        {workflowStages.map(
                          (
                            option
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
                              {option.name}
                            </option>
                          )
                        )}
                      </select>

                      {workflowStage.name ===
                        "Enrolled" && (
                        <div
                          style={{
                            marginTop: 8,
                            padding:
                              "7px 9px",
                            borderRadius:
                              6,
                            background:
                              "#eaf5f2",
                            color:
                              "#00695c",
                            fontSize: 11,
                            fontWeight:
                              600,
                          }}
                        >
                          Enrolled →
                          Customer
                        </div>
                      )}
                    </div>
                  );
                }
              )
            )}
          </div>
        );
      }
    );
  }

  return (
    <div className="ciu-page">
      <div className="ciu-page-inner">
        <div className="ciu-hero">
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#8bc63f",
                textTransform:
                  "uppercase",
                letterSpacing:
                  "0.08em",
                marginBottom: 6,
              }}
            >
              Admissions Funnel
            </div>

            <h1>
              {isSalesperson
                ? "My Sales Pipeline"
                : "Sales Pipeline"}
            </h1>

            <p>
              Move prospective students from
              interest through application,
              admission, acceptance fee payment
              and enrollment.
            </p>
          </div>
        </div>

        {errorMessage && (
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
            {errorMessage}
          </div>
        )}

        <div className="ciu-kpis">
          <div className="ciu-kpi">
            <span className="ciu-kpi-label">
              Pipeline Value
            </span>

            <strong>
              {formatCurrency(
                pipelineValue
              )}
            </strong>

            <small>
              {openOpportunities.length}{" "}
              open opportunities
            </small>
          </div>

          <div className="ciu-kpi">
            <span className="ciu-kpi-label">
              Expected Revenue
            </span>

            <strong>
              {formatCurrency(
                expectedRevenue
              )}
            </strong>

            <small>
              Weighted pipeline
            </small>
          </div>

          <div className="ciu-kpi">
            <span className="ciu-kpi-label">
              Won This Month
            </span>

            <strong>
              {formatCurrency(
                wonThisMonth
              )}
            </strong>

            <small>
              {wonOpportunities.length}{" "}
              enrolled/won
            </small>
          </div>

          <div className="ciu-kpi">
            <span className="ciu-kpi-label">
              Conversion
            </span>

            <strong>
              {conversionRate.toFixed(
                1
              )}
              %
            </strong>

            <small>
              Current closed-deal rate
            </small>
          </div>
        </div>

        <div
          className="ciu-strip"
          style={{
            marginTop: 18,
          }}
        >
          <div>
            <strong>
              Student admission journey
            </strong>

            <span>
              Interested → Applied →
              Application Submitted →
              Admitted → Acceptance Fee Paid
              → Enrolled → Customers
            </span>
          </div>
        </div>

        {loading ? (
          <div
            className="ciu-card"
            style={{
              marginTop: 18,
              padding: 40,
              textAlign: "center",
              color: "#6b7f78",
            }}
          >
            Loading pipeline...
          </div>
        ) : (
          <div
            className="crm-pipeline"
            style={{
              marginTop: 18,
            }}
          >
            {renderStageCards()}
          </div>
        )}

        {!loading &&
          opportunities.length === 0 && (
            <div
              className="ciu-card"
              style={{
                marginTop: 18,
                padding: 30,
                textAlign: "center",
              }}
            >
              <strong>
                No opportunities yet
              </strong>

              <p
                style={{
                  margin:
                    "8px 0 0",
                  color:
                    "#6b7f78",
                  fontSize: 13,
                }}
              >
                {isSalesperson
                  ? "You currently have no opportunities assigned to you."
                  : "Qualified leads will appear here when they enter the admissions pipeline."}
              </p>
            </div>
          )}

        {!loading &&
          stages.length > 0 &&
          workflowStages.some(
            (stage) =>
              !stage.databaseStage
          ) && (
            <div
              style={{
                marginTop: 18,
                padding: 13,
                borderRadius: 9,
                background:
                  "#fff8e7",
                border:
                  "1px solid #f1d58a",
                color: "#755b13",
                fontSize: 12,
              }}
            >
              <strong>
                Pipeline setup notice:
              </strong>{" "}
              Some of the required admission
              stages are not yet configured in
              Supabase. Those stages will become
              available after the corresponding
              pipeline stage records are created.
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
              Your role has limited pipeline
              visibility.
            </div>
          )}
      </div>
    </div>
  );
}