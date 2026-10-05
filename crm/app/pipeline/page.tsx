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

  const [showNewDeal, setShowNewDeal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newDeal, setNewDeal] = useState({
    title: "",
    value: "",
    stage_id: "",
    probability: "",
  });

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

    if (loadedStages.length > 0 && !newDeal.stage_id) {
      const firstOpenStage =
        loadedStages.find((stage) => !stage.is_won && !stage.is_lost) ||
        loadedStages[0];

      setNewDeal((current) => ({
        ...current,
        stage_id: firstOpenStage.id,
        probability: String(firstOpenStage.probability ?? ""),
      }));
    }

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

  function handleStageChange(stageId: string) {
    const selectedStage = stages.find((stage) => stage.id === stageId);

    setNewDeal((current) => ({
      ...current,
      stage_id: stageId,
      probability: String(selectedStage?.probability ?? ""),
    }));
  }

  async function handleAddDeal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newDeal.title.trim()) {
      setErrorMessage("Please enter a deal title.");
      return;
    }

    if (!newDeal.value || Number(newDeal.value) <= 0) {
      setErrorMessage("Please enter a valid deal value.");
      return;
    }

    if (!newDeal.stage_id) {
      setErrorMessage("Please select a pipeline stage.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage("Your session has expired. Please log in again.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("opportunities").insert({
      title: newDeal.title.trim(),
      value: Number(newDeal.value),
      currency: "UGX",
      stage_id: newDeal.stage_id,
      probability: Number(newDeal.probability || 0),
      status: "open",
      assigned_to: user.id,
    });

    if (error) {
      console.error("New deal error:", error);
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setNewDeal({
      title: "",
      value: "",
      stage_id: stages.find((stage) => !stage.is_won && !stage.is_lost)?.id ||
        stages[0]?.id ||
        "",
      probability: String(
        stages.find((stage) => !stage.is_won && !stage.is_lost)?.probability ??
          stages[0]?.probability ??
          ""
      ),
    });

    setShowNewDeal(false);
    setSaving(false);

    await loadPipeline();
  }

  return (
    <>
      <div className="crm-page-heading">
        <div>
          <h1>Sales Pipeline</h1>
          <p>Track opportunities from first contact to conversion.</p>
        </div>

       <button
  className="crm-btn"
  onClick={() => setShowNewDeal(true)}
  style={{
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    visibility: "visible",
    opacity: 1,
    color: "#ffffff",
    background: "#2563eb",
    border: "1px solid #2563eb",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 40,
    whiteSpace: "nowrap",
  }}
>
  + New Deal
</button>
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

      {showNewDeal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Create New Deal</h2>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: 13,
                    opacity: 0.65,
                  }}
                >
                  Add a new opportunity to your sales pipeline.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowNewDeal(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  fontSize: 22,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddDeal}>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Deal Title
                </label>

                <input
                  type="text"
                  value={newDeal.title}
                  onChange={(event) =>
                    setNewDeal({
                      ...newDeal,
                      title: event.target.value,
                    })
                  }
                  placeholder="e.g. MBA Registration"
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    border: "1px solid #ddd",
                    borderRadius: 7,
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Deal Value (UGX)
                </label>

                <input
                  type="number"
                  min="0"
                  value={newDeal.value}
                  onChange={(event) =>
                    setNewDeal({
                      ...newDeal,
                      value: event.target.value,
                    })
                  }
                  placeholder="e.g. 4200000"
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    border: "1px solid #ddd",
                    borderRadius: 7,
                  }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Pipeline Stage
                </label>

                <select
                  value={newDeal.stage_id}
                  onChange={(event) =>
                    handleStageChange(event.target.value)
                  }
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    border: "1px solid #ddd",
                    borderRadius: 7,
                  }}
                >
                  {stages
                    .filter((stage) => !stage.is_lost)
                    .map((stage) => (
                      <option
                        key={stage.id}
                        value={stage.id}
                      >
                        {stage.name}
                      </option>
                    ))}
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Probability (%)
                </label>

                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newDeal.probability}
                  onChange={(event) =>
                    setNewDeal({
                      ...newDeal,
                      probability: event.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    border: "1px solid #ddd",
                    borderRadius: 7,
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowNewDeal(false)}
                  style={{
                    padding: "10px 16px",
                    border: "1px solid #ddd",
                    borderRadius: 7,
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>

               <button
  type="submit"
  disabled={saving}
  style={{
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    visibility: "visible",
    opacity: 1,
    color: "#ffffff",
    background: "#2563eb",
    border: "1px solid #2563eb",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: saving ? "not-allowed" : "pointer",
    minHeight: 40,
    whiteSpace: "nowrap",
  }}
>
  {saving ? "Saving..." : "Create Deal"}
</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}