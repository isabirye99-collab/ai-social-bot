
"use client";

import { useEffect, useState } from "react";
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
  organization_id: string | null;
  ciu_number: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  product_service: string | null;
  contact_id: string | null;
};

type Opportunity = {
  id: string;
  lead_id: string | null;
  title: string;
  value: number | null;
  probability: number | null;
  stage_id: string;
  status: string;
  updated_at: string | null;
  created_at: string | null;
};

export default function Pipeline() {
  const supabase = createClient();

  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadPipeline() {
    setLoading(true);
    setErrorMessage("");

    const { data: stageData, error: stageError } = await supabase
      .from("pipeline_stages")
      .select("id, name, position, probability, is_won, is_lost")
      .order("position", { ascending: true });

    if (stageError) {
      console.error("Pipeline stages error:", stageError);
      setErrorMessage(stageError.message);
      setStages([]);
      setLoading(false);
      return;
    }

    const { data: opportunityData, error: opportunityError } =
      await supabase
        .from("opportunities")
        .select(
          "id, lead_id, title, value, probability, stage_id, status, updated_at, created_at"
        )
        .order("created_at", { ascending: false });

    if (opportunityError) {
      console.error(
        "Pipeline opportunities error:",
        opportunityError
      );

      setErrorMessage(opportunityError.message);
      setOpportunities([]);
    } else {
      setOpportunities(
        (opportunityData as Opportunity[]) || []
      );
    }

    const { data: leadData, error: leadError } = await supabase
      .from("leads")
      .select(
        "id, organization_id, ciu_number, name, phone, email, product_service, contact_id"
      )
      .order("name", { ascending: true });

    if (leadError) {
      console.error("Pipeline leads error:", leadError);
      setErrorMessage(leadError.message);
      setLeads([]);
    } else {
      setLeads((leadData as Lead[]) || []);
    }

    const loadedStages =
      (stageData as PipelineStage[]) || [];

    setStages(loadedStages);
    setLoading(false);
  }

  useEffect(() => {
    loadPipeline();
  }, []);

  const openOpportunities = opportunities.filter(
    (opportunity) => opportunity.status === "open"
  );

  const wonOpportunities = opportunities.filter(
    (opportunity) => opportunity.status === "won"
  );

  const lostOpportunities = opportunities.filter(
    (opportunity) => opportunity.status === "lost"
  );

  const pipelineValue = openOpportunities.reduce(
    (sum, opportunity) =>
      sum + Number(opportunity.value || 0),
    0
  );

  const expectedRevenue = openOpportunities.reduce(
    (sum, opportunity) => {
      const stage = stages.find(
        (pipelineStage) =>
          pipelineStage.id === opportunity.stage_id
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
  startOfMonth.setHours(0, 0, 0, 0);

  const wonThisMonth = wonOpportunities
    .filter((opportunity) => {
      const dateValue =
        opportunity.updated_at ||
        opportunity.created_at;

      if (!dateValue) {
        return false;
      }

      return new Date(dateValue) >= startOfMonth;
    })
    .reduce(
      (sum, opportunity) =>
        sum + Number(opportunity.value || 0),
      0
    );

  const totalClosedDeals =
    wonOpportunities.length +
    lostOpportunities.length;

  const conversionRate =
    totalClosedDeals > 0
      ? (wonOpportunities.length /
          totalClosedDeals) *
        100
      : 0;

  function formatCurrency(value: number) {
    if (value >= 1000000) {
      return `UGX ${(value / 1000000).toFixed(1)}M`;
    }

    if (value >= 1000) {
      return `UGX ${(value / 1000).toFixed(0)}K`;
    }

    return `UGX ${value.toLocaleString()}`;
  }

  async function transferOpportunity(
    opportunityId: string,
    stageId: string
  ) {
    const selectedStage = stages.find(
      (stage) => stage.id === stageId
    );

    if (!selectedStage) {
      setErrorMessage(
        "The selected pipeline stage could not be found."
      );
      return;
    }

    const opportunity = opportunities.find(
      (item) => item.id === opportunityId
    );

    if (!opportunity) {
      setErrorMessage(
        "The selected opportunity could not be found."
      );
      return;
    }

    const isEnrolledStage =
      selectedStage.name.trim().toLowerCase() ===
      "enrolled";

    const previousStageId =
      opportunity.stage_id;

    const previousStatus =
      opportunity.status;

    const previousProbability =
      opportunity.probability;

    setSaving(true);
    setErrorMessage("");

    const now =
      new Date().toISOString();

    /*
     * ENROLLED WORKFLOW
     *
     * When an opportunity reaches Enrolled:
     * 1. The opportunity becomes Won.
     * 2. The linked admission is changed to Enrolled.
     * 3. Customers page picks it up because Customers
     *    now displays admissions where stage = Enrolled.
     */
    if (isEnrolledStage) {
      if (!opportunity.lead_id) {
        setErrorMessage(
          "This opportunity has no linked lead, so it cannot be moved to Enrolled."
        );

        setSaving(false);
        return;
      }

      const { data: admission, error: admissionLookupError } =
        await supabase
          .from("admissions")
          .select("id, lead_id, stage")
          .eq("lead_id", opportunity.lead_id)
          .maybeSingle();

      if (admissionLookupError) {
        console.error(
          "Admission lookup error:",
          admissionLookupError
        );

        setErrorMessage(
          "The linked admission could not be found."
        );

        setSaving(false);
        return;
      }

      let admissionId: string | null = admission?.id ?? null;

      // Create the admission record from the linked lead when one does not yet exist.
      if (!admission) {
        const linkedLead = leads.find((lead) => lead.id === opportunity.lead_id);

        if (!linkedLead) {
          setErrorMessage(
            "The linked lead could not be found. The student cannot be moved to Enrolled."
          );
          setSaving(false);
          return;
        }

        const { data: createdAdmission, error: admissionCreateError } =
          await supabase
            .from("admissions")
            .insert({
              lead_id: linkedLead.id,
              contact_id: linkedLead.contact_id,
              ciu_number: linkedLead.ciu_number,
              full_names: linkedLead.name,
              telephone: linkedLead.phone,
              email: linkedLead.email,
              program: linkedLead.product_service,
              stage: "Enrolled",
              application_fee: 0,
              application_paid: 0,
              acceptance_fee: 0,
              acceptance_paid: 0,
              tuition_fee: Number(opportunity.value || 0),
              tuition_paid: 0,
              last_contact: now,
              notes: "Admission record created automatically when the student was moved to Enrolled from the Pipeline.",
              created_at: now,
              updated_at: now,
            })
            .select("id")
            .single();

        if (admissionCreateError || !createdAdmission) {
          console.error("Admission creation error:", admissionCreateError);
          setErrorMessage(
            admissionCreateError?.message ||
              "The admission record could not be created."
          );
          setSaving(false);
          return;
        }

        admissionId = createdAdmission.id;
      }

      const { error: opportunityError } =
        await supabase
          .from("opportunities")
          .update({
            stage_id: stageId,
            probability: Number(
              selectedStage.probability ?? 100
            ),
            status: "won",
            updated_at: now,
          })
          .eq("id", opportunityId);

      if (opportunityError) {
        console.error(
          "Pipeline stage transfer error:",
          opportunityError
        );

        setErrorMessage(
          opportunityError.message
        );

        setSaving(false);
        return;
      }

      const { error: admissionUpdateError } =
        await supabase
          .from("admissions")
          .update({
            stage: "Enrolled",
            updated_at: now,
          })
          .eq("id", admissionId);

      if (admissionUpdateError) {
        console.error(
          "Admission enrollment update error:",
          admissionUpdateError
        );

        /*
         * Roll back the opportunity if the admission
         * could not be updated.
         */
        await supabase
          .from("opportunities")
          .update({
            stage_id: previousStageId,
            probability: previousProbability,
            status: previousStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", opportunityId);

        setErrorMessage(
          "The student could not be moved to Enrolled. The Pipeline change was rolled back."
        );

        setSaving(false);
        return;
      }

      setOpportunities((current) =>
        current.map((item) =>
          item.id === opportunityId
            ? {
                ...item,
                stage_id: stageId,
                probability: Number(
                  selectedStage.probability ?? 100
                ),
                status: "won",
                updated_at: now,
              }
            : item
        )
      );

      setSaving(false);

      return;
    }

    /*
     * NORMAL PIPELINE STAGE CHANGE
     *
     * If the opportunity was previously Enrolled/Won
     * and is moved back to another active stage,
     * return it to open status.
     */
    const nextStatus =
      selectedStage.is_lost
        ? "lost"
        : "open";

    const { error } = await supabase
      .from("opportunities")
      .update({
        stage_id: stageId,
        probability: Number(
          selectedStage.probability ?? 0
        ),
        status: nextStatus,
        updated_at: now,
      })
      .eq("id", opportunityId);

    if (error) {
      console.error(
        "Pipeline stage transfer error:",
        error
      );

      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    /*
     * If the opportunity is being moved away from
     * Enrolled, return the linked admission to the
     * previous active admission stage rather than
     * leaving the student incorrectly marked Enrolled.
     */
    const previousStage = stages.find(
      (stage) =>
        stage.id === previousStageId
    );

    const wasPreviouslyEnrolled =
      previousStage?.name
        ?.trim()
        .toLowerCase() ===
      "enrolled";

    if (
      wasPreviouslyEnrolled &&
      opportunity.lead_id
    ) {
      const { error: admissionResetError } =
        await supabase
          .from("admissions")
          .update({
            stage: "Acceptance Paid",
            updated_at: now,
          })
          .eq(
            "lead_id",
            opportunity.lead_id
          );

      if (admissionResetError) {
        console.error(
          "Admission stage reset error:",
          admissionResetError
        );

        setErrorMessage(
          "The Pipeline stage changed, but the admission stage could not be updated."
        );
      }
    }

    setOpportunities((current) =>
      current.map((item) =>
        item.id === opportunityId
          ? {
              ...item,
              stage_id: stageId,
              probability: Number(
                selectedStage.probability ?? 0
              ),
              status: nextStatus,
              updated_at: now,
            }
          : item
      )
    );

    setSaving(false);
  }

  return (
    <>
      <div className="crm-page-heading">
        <div>
          <h1>Sales Pipeline</h1>

          <p>
            Track opportunities from first contact to
            conversion.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background: "#fff1f2",
            border: "1px solid #fecdd3",
            color: "#be123c",
            fontSize: 13,
          }}
        >
          {errorMessage}
        </div>
      )}

      <div className="crm-kpis">
        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Pipeline Value
          </span>

          <div className="crm-kpi-value">
            {formatCurrency(pipelineValue)}
          </div>

          <span className="crm-kpi-change">
            {openOpportunities.length} open deals
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Expected Revenue
          </span>

          <div className="crm-kpi-value">
            {formatCurrency(expectedRevenue)}
          </div>

          <span className="crm-kpi-change">
            Weighted pipeline
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Won This Month
          </span>

          <div className="crm-kpi-value">
            {formatCurrency(wonThisMonth)}
          </div>

          <span className="crm-kpi-change">
            {wonOpportunities.length} won deals
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Conversion
          </span>

          <div className="crm-kpi-value">
            {conversionRate.toFixed(1)}%
          </div>

          <span className="crm-kpi-change">
            Current rate
          </span>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            padding: 30,
            textAlign: "center",
          }}
        >
          Loading pipeline...
        </div>
      ) : (
        <div className="crm-pipeline">
          {stages
            .filter(
              (stage) => !stage.is_lost
            )
            .map((stage) => {
              const stageDeals = opportunities.filter(
                (opportunity) =>
                  opportunity.stage_id === stage.id &&
                  (
                    opportunity.status === "open" ||
                    (
                      stage.name.trim().toLowerCase() === "enrolled" &&
                      opportunity.status === "won"
                    )
                  )
              );

              return (
                <div
                  className="crm-stage"
                  key={stage.id}
                >
                  <div className="crm-stage-head">
                    <strong>
                      {stage.name}
                    </strong>

                    <span>
                      {stageDeals.length} deals
                    </span>
                  </div>

                  {stageDeals.length === 0 ? (
                    <div
                      style={{
                        padding:
                          "14px 8px",
                        fontSize: 12,
                        opacity: 0.6,
                      }}
                    >
                      No deals
                    </div>
                  ) : (
                    stageDeals.map((deal) => {
                      const probability =
                        deal.probability ??
                        stage.probability ??
                        0;

                      const linkedLead =
                        leads.find(
                          (lead) =>
                            lead.id ===
                            deal.lead_id
                        );

                      return (
                        <div
                          className="crm-deal"
                          key={deal.id}
                        >
                          <strong>
                            {linkedLead?.name ||
                              deal.title}
                          </strong>

                          <small>
                            {linkedLead?.ciu_number ||
                              "No CIU number"}{" "}
                            -{" "}
                            {linkedLead?.product_service ||
                              "Programme not set"}
                          </small>

                          {linkedLead?.phone && (
                            <small>
                              {linkedLead.phone}
                            </small>
                          )}

                          <div className="crm-deal-value">
                            {formatCurrency(
                              Number(
                                deal.value || 0
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

                          <div
                            style={{
                              marginTop: 12,
                            }}
                          >
                            <select
                              value={
                                deal.stage_id
                              }
                              disabled={
                                saving
                              }
                              onChange={(
                                event
                              ) =>
                                transferOpportunity(
                                  deal.id,
                                  event.target.value
                                )
                              }
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding:
                                  "8px 9px",
                                border:
                                  "1px solid #d1d5db",
                                borderRadius: 7,
                                background:
                                  "#ffffff",
                                fontSize: 12,
                                cursor:
                                  saving
                                    ? "not-allowed"
                                    : "pointer",
                              }}
                            >
                              {stages
                                .filter(
                                  (stageOption) =>
                                    !stageOption.is_lost
                                )
                                .map(
                                  (
                                    stageOption
                                  ) => (
                                    <option
                                      key={
                                        stageOption.id
                                      }
                                      value={
                                        stageOption.id
                                      }
                                    >
                                      {
                                        stageOption.name
                                      }
                                    </option>
                                  )
                                )}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}