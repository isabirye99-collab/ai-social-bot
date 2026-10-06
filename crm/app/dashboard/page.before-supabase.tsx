"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Lead = {
  id: string;
  ciu_number: string | null;
  name: string | null;
  product_service: string | null;
  status: string | null;
  follow_up_status: string | null;
  created_at: string | null;
};
type PipelineStage = {
  id: string;
  name: string;
  position: number;
  probability: number | null;
  total_value: number;
  opportunity_count: number;
};

export default function Dashboard() {
  const supabase = createClient();

  const [leads, setLeads] = useState<Lead[]>([]);
const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
const [loading, setLoading] = useState(true);

    useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);

      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, ciu_number, name, product_service, status, follow_up_status, created_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Dashboard leads error:", error);
        setLeads([]);
      } else {
        setLeads((data as Lead[]) || []);
      }

      const { data: stages, error: stagesError } = await supabase
        .from("pipeline_stages")
        .select("id, name, position, probability")
        .order("position", { ascending: true });

      if (stagesError) {
        console.error("Pipeline stages error:", stagesError);
        setPipelineStages([]);
      } else {
        const { data: opportunities, error: opportunitiesError } =
          await supabase
            .from("opportunities")
            .select("stage_id, value")
            .eq("status", "open");

        if (opportunitiesError) {
          console.error(
            "Pipeline opportunities error:",
            opportunitiesError
          );

          setPipelineStages(
            ((stages || []) as PipelineStage[]).map((stage) => ({
              ...stage,
              probability: Number(stage.probability ?? 0),
              total_value: 0,
              opportunity_count: 0,
            }))
          );
        } else {
          const calculatedStages = (
            (stages || []) as PipelineStage[]
          ).map((stage) => {
            const stageOpportunities = (opportunities || []).filter(
              (opportunity) => opportunity.stage_id === stage.id
            );

            return {
              ...stage,
              probability: Number(stage.probability ?? 0),
              total_value: stageOpportunities.reduce(
                (sum, opportunity) =>
                  sum + Number(opportunity.value || 0),
                0
              ),
              opportunity_count: stageOpportunities.length,
            };
          });

          setPipelineStages(calculatedStages);
        }
      }

      setLoading(false);
    }

    loadDashboardData();
  }, []);
  const totalLeads = leads.length;

  const interestedLeads = leads.filter(
    (lead) =>
      (lead.follow_up_status || lead.status || "").toLowerCase() ===
      "interested"
  ).length;

  const followUps = leads.filter((lead) => {
    const status = (lead.follow_up_status || lead.status || "").toLowerCase();

    return (
      status === "follow up later" ||
      status === "follow-up" ||
      status === "follow up"
    );
  }).length;

  const convertedLeads = leads.filter((lead) => {
    const status = (lead.follow_up_status || lead.status || "").toLowerCase();

    return status === "converted" || status === "paid fees";
  }).length;

  const recentLeads = leads.slice(0, 5);

  return (
    <>
      <div className="crm-page-heading">
        <div>
          <h1>Good afternoon, Nicholas 👋</h1>
          <p>Here's what's happening across your business today.</p>
        </div>

        <div className="crm-actions">
          <Link className="crm-btn secondary" href="/reports">
            View Reports
          </Link>

          <Link className="crm-btn" href="/leads">
            + Add Lead
          </Link>
        </div>
      </div>

      <div className="crm-kpis">
        <div className="crm-kpi">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">Total Leads</span>
            <span className="crm-kpi-icon">👥</span>
          </div>

          <div className="crm-kpi-value">
            {loading ? "..." : totalLeads}
          </div>

          <span className="crm-kpi-change">
            Live from your Leads database
          </span>
        </div>

        <div className="crm-kpi">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">Interested</span>
            <span className="crm-kpi-icon">🎯</span>
          </div>

          <div className="crm-kpi-value">
            {loading ? "..." : interestedLeads}
          </div>

          <span className="crm-kpi-change">
            Current interested leads
          </span>
        </div>

        <div className="crm-kpi">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">Follow-ups</span>
            <span className="crm-kpi-icon">📞</span>
          </div>

          <div className="crm-kpi-value">
            {loading ? "..." : followUps}
          </div>

          <span className="crm-kpi-change">
            Leads requiring follow-up
          </span>
        </div>

        <div className="crm-kpi">
          <div className="crm-kpi-top">
            <span className="crm-kpi-label">Converted</span>
            <span className="crm-kpi-icon">✅</span>
          </div>

          <div className="crm-kpi-value">
            {loading ? "..." : convertedLeads}
          </div>

          <span className="crm-kpi-change">
            Converted or paid leads
          </span>
        </div>
      </div>

      <div className="crm-grid crm-grid-2">
        <div className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>Lead Activity</h2>
              <span>New leads received this month</span>
            </div>

            <span>Last 7 months</span>
          </div>

          <div className="crm-card-body">
            <div className="crm-chart">
              {[35, 48, 42, 65, 55, 78, 92].map((height, i) => (
                <div
                  key={i}
                  className="crm-bar"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>

            <div className="crm-chart-labels">
              {["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"].map((x) => (
                <span key={x}>{x}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>Pipeline Overview</h2>
              <span>Current opportunities</span>
            </div>

            <Link
              href="/pipeline"
              style={{ fontSize: 11, color: "var(--brand)" }}
            >
              View all →
            </Link>
          </div>

          <div
            className="crm-card-body"
            style={{ display: "grid", gap: 12 }}
          >
            {[
              ["New", "UGX 8.2M", 25],
              ["Contacted", "UGX 11.5M", 42],
              ["Qualified", "UGX 15.8M", 61],
              ["Proposal", "UGX 13.1M", 78],
              ["Won", "UGX 9.4M", 91],
            ].map(([name, value, p]) => (
              <div key={String(name)}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                  }}
                >
                  <strong>{name}</strong>
                  <span>{value}</span>
                </div>

                <div className="crm-progress">
                  <div style={{ width: `${p}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: 18 }} />

      <div className="crm-grid crm-grid-2">
        <div className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>Recent Leads</h2>
              <span>Your latest prospects</span>
            </div>

            <Link
              href="/leads"
              style={{ fontSize: 11, color: "var(--brand)" }}
            >
              View all →
            </Link>
          </div>

          <div className="crm-list">
            {loading ? (
              <div style={{ padding: 20, fontSize: 12 }}>
                Loading recent leads...
              </div>
            ) : recentLeads.length === 0 ? (
              <div style={{ padding: 20, fontSize: 12 }}>
                No leads found.
              </div>
            ) : (
              recentLeads.map((lead) => {
                const name = lead.name || "Unnamed Lead";
                const initials = name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part.charAt(0).toUpperCase())
                  .join("");

                const status =
                  lead.follow_up_status || lead.status || "Pending";

                return (
                  <div className="crm-list-item" key={lead.id}>
                    <div className="crm-list-avatar">
                      {initials || "L"}
                    </div>

                    <div className="crm-list-main">
                      <strong>{name}</strong>
                      <small>
                        {lead.product_service || "Program not specified"}
                      </small>
                    </div>

                    <span
                      className={`crm-badge ${
                        status.toLowerCase() === "follow up later"
                          ? "yellow"
                          : ""
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="crm-card">
          <div className="crm-card-header">
            <div>
              <h2>Today's Follow-ups</h2>
              <span>Priority activities</span>
            </div>

            <Link
              href="/tasks"
              style={{ fontSize: 11, color: "var(--brand)" }}
            >
              View tasks →
            </Link>
          </div>

          <div className="crm-card-body">
            {[
              ["Call John Kato", "Discuss Nursing admission", "10:00 AM"],
              ["WhatsApp Amina", "Send MPH fee structure", "11:30 AM"],
              ["Follow up Sarah", "BBA application", "2:00 PM"],
              ["Contact Daniel", "Complete BIT registration", "4:00 PM"],
            ].map(([title, detail, time]) => (
              <div className="crm-task" key={title}>
                <div className="crm-check" />

                <div style={{ flex: 1 }}>
                  <strong>{title}</strong>
                  <small>{detail}</small>
                </div>

                <span className="crm-badge yellow">{time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}