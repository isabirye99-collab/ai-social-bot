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

type Opportunity = {
  id: string;
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
          "id, title, value, probability, stage_id, status, updated_at, created_at"
        )
        .order("created_at", { ascending: false });

    if (opportunityError) {
      console.error("Pipeline opportunities error:", opportunityError);
      setErrorMessage(opportunityError.message);
      setOpportunities([]);
    } else {
      setOpportunities((opportunityData as Opportunity[]) || []);
    }

    const loadedStages = (stageData as PipelineStage[]) || [];
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
    (sum, opportunity) => sum + Number(opportunity.value || 0),
    0
  );

  const expectedRevenue = openOpportunities.reduce((sum, opportunity) => {
    const stage = stages.find(
      (pipelineStage) => pipelineStage.id === opportunity.stage_id
    );

    const probability =
      opportunity.probability ??
      stage?.probability ??
      0;

    return sum + Number(opportunity.value || 0) * (Number(probability) / 100);
  }, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const wonThisMonth = wonOpportunities
    .filter((opportunity) => {
      const dateValue = opportunity.updated_at || opportunity.created_at;

      if (!dateValue) {
        return false;
      }

      return new Date(dateValue) >= startOfMonth;
    })
    .reduce(
      (sum, opportunity) => sum + Number(opportunity.value || 0),
      0
    );

  const totalClosedDeals =
    wonOpportunities.length + lostOpportunities.length;

  const conversionRate =
    totalClosedDeals > 0
      ? (wonOpportunities.length / totalClosedDeals) * 100
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

  return (
    <>
      <div className="crm-page-heading">
        <div>
          <h1>Sales Pipeline</h1>
          <p>Track opportunities from first contact to conversion.</p>
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
          <span className="crm-kpi-label">Pipeline Value</span>
          <div className="crm-kpi-value">
            {formatCurrency(pipelineValue)}
          </div>
          <span className="crm-kpi-change">
            {openOpportunities.length} open deals
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">Expected Revenue</span>
          <div className="crm-kpi-value">
            {formatCurrency(expectedRevenue)}
          </div>
          <span className="crm-kpi-change">
            Weighted pipeline
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">Won This Month</span>
          <div className="crm-kpi-value">
            {formatCurrency(wonThisMonth)}
          </div>
          <span className="crm-kpi-change">
            {wonOpportunities.length} won deals
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">Conversion</span>
          <div className="crm-kpi-value">
            {conversionRate.toFixed(1)}%
          </div>
          <span className="crm-kpi-change">
            Current rate
          </span>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 30, textAlign: "center" }}>
          Loading pipeline...
        </div>
      ) : (
        <div className="crm-pipeline">
          {stages
            .filter((stage) => !stage.is_lost)
            .map((stage) => {
              const stageDeals = openOpportunities.filter(
                (opportunity) => opportunity.stage_id === stage.id
              );

              return (
                <div className="crm-stage" key={stage.id}>
                  <div className="crm-stage-head">
                    <strong>{stage.name}</strong>
                    <span>{stageDeals.length} deals</span>
                  </div>

                  {stageDeals.length === 0 ? (
                    <div
                      style={{
                        padding: "14px 8px",
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

                      return (
                        <div
                          className="crm-deal"
                          key={deal.id}
                        >
                          <strong>{deal.title}</strong>

                          <small>
                            Business opportunity
                          </small>

                          <div className="crm-deal-value">
                            {formatCurrency(
                              Number(deal.value || 0)
                            )}
                          </div>

                          <div className="crm-progress">
                            <div
                              style={{
                                width: `${Math.min(
                                  Math.max(Number(probability), 0),
                                  100
                                )}%`,
                              }}
                            />
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
