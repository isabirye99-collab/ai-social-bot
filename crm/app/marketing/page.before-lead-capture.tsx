"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Campaign = {
  id: string;
  name: string;
  channel: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  currency: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
};

type CampaignLead = {
  campaign_id: string;
  lead_id: string;
  created_at: string;
};

type Lead = {
  id: string;
  name: string | null;
  status: string | null;
  product_service: string | null;
  created_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
};

const supabase = createClient();

function formatCurrency(
  value: number,
  currency = "UGX"
) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-UG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getCampaignStatus(
  startDate: string | null,
  endDate: string | null
) {
  const now = new Date();

  const start = startDate
    ? new Date(startDate)
    : null;

  const end = endDate
    ? new Date(endDate)
    : null;

  if (start && now < start) {
    return {
      label: "Scheduled",
      background: "#fef3c7",
      color: "#92400e",
    };
  }

  if (end && now > end) {
    return {
      label: "Completed",
      background: "#e5e7eb",
      color: "#374151",
    };
  }

  return {
    label: "Active",
    background: "#dcfce7",
    color: "#166534",
  };
}

function getLeadStatusStyle(status: string | null) {
  const value = (status || "").toLowerCase();

  if (
    value.includes("converted") ||
    value.includes("paid") ||
    value.includes("enrolled")
  ) {
    return {
      background: "#dcfce7",
      color: "#166534",
    };
  }

  if (
    value.includes("lost") ||
    value.includes("dropped") ||
    value.includes("unqualified")
  ) {
    return {
      background: "#fee2e2",
      color: "#991b1b",
    };
  }

  if (
    value.includes("qualified") ||
    value.includes("interested")
  ) {
    return {
      background: "#dbeafe",
      color: "#1d4ed8",
    };
  }

  return {
    background: "#f3f4f6",
    color: "#374151",
  };
}

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(
    []
  );
  const [campaignLeads, setCampaignLeads] = useState<
    CampaignLead[]
  >([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [showAddCampaign, setShowAddCampaign] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] =
    useState("All");

  const [form, setForm] = useState({
    name: "",
    channel: "",
    start_date: "",
    end_date: "",
    budget: "",
    currency: "UGX",
    notes: "",
    created_by: "",
  });

  const loadMarketing = async () => {
    try {
      setError("");

      const [
        campaignsResult,
        campaignLeadsResult,
        leadsResult,
        profilesResult,
      ] = await Promise.all([
        supabase
          .from("campaigns")
          .select(
            `
              id,
              name,
              channel,
              start_date,
              end_date,
              budget,
              currency,
              notes,
              created_by,
              created_at
            `
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("campaign_leads")
          .select(
            `
              campaign_id,
              lead_id,
              created_at
            `
          ),

        supabase
          .from("leads")
          .select(
            `
              id,
              name,
              status,
              product_service,
              created_at
            `
          ),

        supabase
          .from("profiles")
          .select(
            `
              id,
              full_name
            `
          )
          .eq("is_active", true)
          .order("full_name", {
            ascending: true,
          }),
      ]);

      if (campaignsResult.error) {
        throw new Error(
          `Campaigns: ${campaignsResult.error.message}`
        );
      }

      if (campaignLeadsResult.error) {
        throw new Error(
          `Campaign leads: ${campaignLeadsResult.error.message}`
        );
      }

      if (leadsResult.error) {
        throw new Error(
          `Leads: ${leadsResult.error.message}`
        );
      }

      if (profilesResult.error) {
        throw new Error(
          `Profiles: ${profilesResult.error.message}`
        );
      }

      setCampaigns(
        (campaignsResult.data || []) as Campaign[]
      );

      setCampaignLeads(
        (campaignLeadsResult.data ||
          []) as CampaignLead[]
      );

      setLeads(
        (leadsResult.data || []) as Lead[]
      );

      setProfiles(
        (profilesResult.data || []) as Profile[]
      );
    } catch (err) {
      console.error(
        "Marketing loading error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load marketing data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMarketing();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMarketing();
  };

  const resetForm = () => {
    setForm({
      name: "",
      channel: "",
      start_date: "",
      end_date: "",
      budget: "",
      currency: "UGX",
      notes: "",
      created_by: "",
    });
  };

  const handleAddCampaign = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Campaign name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const budgetValue = form.budget
        ? Number(form.budget)
        : null;

      const { error: insertError } =
        await supabase.from("campaigns").insert({
          name: form.name.trim(),
          channel:
            form.channel.trim() || null,
          start_date:
            form.start_date || null,
          end_date:
            form.end_date || null,
          budget: budgetValue,
          currency:
            form.currency.trim() || "UGX",
          notes:
            form.notes.trim() || null,
          created_by:
            form.created_by || null,
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setShowAddCampaign(false);
      resetForm();

      await loadMarketing();
    } catch (err) {
      console.error(
        "Campaign creation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create campaign."
      );
    } finally {
      setSaving(false);
    }
  };

  const channels = useMemo(() => {
    const values = campaigns
      .map((campaign) =>
        campaign.channel?.trim()
      )
      .filter(
        (channel): channel is string =>
          Boolean(channel)
      );

    return Array.from(new Set(values));
  }, [campaigns]);

  const campaignLeadCount = useMemo(() => {
    const counts = new Map<string, number>();

    campaignLeads.forEach((item) => {
      counts.set(
        item.campaign_id,
        (counts.get(item.campaign_id) || 0) + 1
      );
    });

    return counts;
  }, [campaignLeads]);

  const filteredCampaigns = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return campaigns.filter((campaign) => {
      const matchesSearch =
        !query ||
        campaign.name
          .toLowerCase()
          .includes(query) ||
        (campaign.channel || "")
          .toLowerCase()
          .includes(query) ||
        (campaign.notes || "")
          .toLowerCase()
          .includes(query);

      const matchesChannel =
        channelFilter === "All" ||
        (campaign.channel || "") ===
          channelFilter;

      return matchesSearch && matchesChannel;
    });
  }, [
    campaigns,
    search,
    channelFilter,
  ]);

  const activeCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      return (
        getCampaignStatus(
          campaign.start_date,
          campaign.end_date
        ).label === "Active"
      );
    }).length;
  }, [campaigns]);

  const totalCampaignLeads =
    campaignLeads.length;

  const convertedCampaignLeads =
    useMemo(() => {
      const campaignLeadIds = new Set(
        campaignLeads.map(
          (item) => item.lead_id
        )
      );

      return leads.filter((lead) => {
        const status =
          (lead.status || "").toLowerCase();

        return (
          campaignLeadIds.has(lead.id) &&
          (status.includes("converted") ||
            status.includes("paid") ||
            status.includes("enrolled"))
        );
      }).length;
    }, [campaignLeads, leads]);

  const conversionRate =
    totalCampaignLeads > 0
      ? (convertedCampaignLeads /
          totalCampaignLeads) *
        100
      : 0;

  const totalBudget = campaigns.reduce(
    (total, campaign) =>
      total + Number(campaign.budget || 0),
    0
  );

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();

    profiles.forEach((profile) => {
      map.set(
        profile.id,
        profile.full_name || "Unknown"
      );
    });

    return map;
  }, [profiles]);

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          padding: 32,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 32,
              textAlign: "center",
              color: "#64748b",
            }}
          >
            Loading marketing...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "28px 32px 48px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              Marketing
            </h1>

            <p
              style={{
                margin: "6px 0 0",
                color: "#64748b",
                fontSize: 14,
              }}
            >
              Monitor campaigns, channels and lead
              generation.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                visibility: "visible",
                opacity: refreshing ? 0.7 : 1,
                color: "#374151",
                background: "#ffffff",
                border: "1px solid #d1d5db",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: refreshing
                  ? "not-allowed"
                  : "pointer",
                minHeight: 40,
                whiteSpace: "nowrap",
              }}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button
              type="button"
              onClick={() =>
                setShowAddCampaign(true)
              }
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
              + New Campaign
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: "14px 16px",
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 14,
            }}
          >
            <strong>Marketing error:</strong>{" "}
            {error}
          </div>
        )}

        {/* KPI CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                marginBottom: 10,
              }}
            >
              Active Campaigns
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {activeCampaigns}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#64748b",
              }}
            >
              Across {channels.length}{" "}
              {channels.length === 1
                ? "channel"
                : "channels"}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                marginBottom: 10,
              }}
            >
              Leads Generated
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {totalCampaignLeads.toLocaleString()}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#64748b",
              }}
            >
              Linked to campaigns
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                marginBottom: 10,
              }}
            >
              Conversion Rate
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {conversionRate.toFixed(1)}%
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#64748b",
              }}
            >
              {convertedCampaignLeads} converted
              leads
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 13,
                color: "#64748b",
                marginBottom: 10,
              }}
            >
              Campaign Budget
            </div>

            <div
              style={{
                fontSize: 25,
                fontWeight: 700,
              }}
            >
              {formatCurrency(totalBudget)}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "#64748b",
              }}
            >
              Total campaign budgets
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search campaigns..."
            style={{
              flex: "1 1 280px",
              minWidth: 220,
              height: 40,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "0 12px",
              fontSize: 14,
              outline: "none",
            }}
          />

          <select
            value={channelFilter}
            onChange={(event) =>
              setChannelFilter(event.target.value)
            }
            style={{
              minWidth: 180,
              height: 40,
              border: "1px solid #d1d5db",
              borderRadius: 8,
              padding: "0 12px",
              fontSize: 14,
              background: "#ffffff",
            }}
          >
            <option value="All">
              All Channels
            </option>

            {channels.map((channel) => (
              <option
                key={channel}
                value={channel}
              >
                {channel}
              </option>
            ))}
          </select>
        </div>

        {/* CAMPAIGNS */}
        {filteredCampaigns.length === 0 ? (
          <div
            style={{
              background: "#ffffff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 50,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              No campaigns found
            </div>

            <div
              style={{
                color: "#64748b",
                fontSize: 14,
                marginBottom: 20,
              }}
            >
              Create your first marketing campaign
              to start tracking lead generation.
            </div>

            <button
              type="button"
              onClick={() =>
                setShowAddCampaign(true)
              }
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
              }}
            >
              + New Campaign
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(290px, 1fr))",
              gap: 18,
            }}
          >
            {filteredCampaigns.map(
              (campaign) => {
                const campaignStatus =
                  getCampaignStatus(
                    campaign.start_date,
                    campaign.end_date
                  );

                const leadCount =
                  campaignLeadCount.get(
                    campaign.id
                  ) || 0;

                return (
                  <div
                    key={campaign.id}
                    style={{
                      background: "#ffffff",
                      border:
                        "1px solid #e5e7eb",
                      borderRadius: 12,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: 5,
                        background:
                          campaignStatus.label ===
                          "Active"
                            ? "#16a34a"
                            : campaignStatus.label ===
                                "Scheduled"
                              ? "#f59e0b"
                              : "#94a3b8",
                      }}
                    />

                    <div
                      style={{
                        padding: 20,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent:
                            "space-between",
                          alignItems: "flex-start",
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            padding:
                              "5px 9px",
                            borderRadius:
                              999,
                            fontSize: 11,
                            fontWeight: 700,
                            background:
                              campaignStatus.background,
                            color:
                              campaignStatus.color,
                          }}
                        >
                          {
                            campaignStatus.label
                          }
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                          }}
                        >
                          {campaign.channel ||
                            "No channel"}
                        </span>
                      </div>

                      <h3
                        style={{
                          margin:
                            "16px 0 6px",
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#111827",
                        }}
                      >
                        {campaign.name}
                      </h3>

                      {campaign.notes && (
                        <p
                          style={{
                            margin:
                              "0 0 14px",
                            color:
                              "#64748b",
                            fontSize: 12,
                            lineHeight:
                              1.5,
                          }}
                        >
                          {campaign.notes}
                        </p>
                      )}

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "1fr 1fr",
                          gap: 12,
                          marginTop: 16,
                        }}
                      >
                        <div
                          style={{
                            background:
                              "#f8fafc",
                            borderRadius:
                              8,
                            padding: 12,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              color:
                                "#64748b",
                              marginBottom: 5,
                            }}
                          >
                            Leads Generated
                          </div>

                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 700,
                            }}
                          >
                            {leadCount}
                          </div>
                        </div>

                        <div
                          style={{
                            background:
                              "#f8fafc",
                            borderRadius:
                              8,
                            padding: 12,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              color:
                                "#64748b",
                              marginBottom: 5,
                            }}
                          >
                            Budget
                          </div>

                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                            }}
                          >
                            {formatCurrency(
                              Number(
                                campaign.budget ||
                                  0
                              ),
                              campaign.currency ||
                                "UGX"
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 18,
                          paddingTop: 14,
                          borderTop:
                            "1px solid #f1f5f9",
                          display: "flex",
                          justifyContent:
                            "space-between",
                          gap: 10,
                          fontSize: 11,
                          color: "#64748b",
                        }}
                      >
                        <span>
                          {formatDate(
                            campaign.start_date
                          )}{" "}
                          —{" "}
                          {formatDate(
                            campaign.end_date
                          )}
                        </span>

                        {campaign.created_by && (
                          <span>
                            {profileMap.get(
                              campaign.created_by
                            ) ||
                              "Staff"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* ADD CAMPAIGN MODAL */}
        {showAddCampaign && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background:
                "rgba(15, 23, 42, 0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowAddCampaign(false);
              }
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 620,
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: 14,
                boxShadow:
                  "0 20px 50px rgba(0,0,0,0.2)",
              }}
            >
              <div
                style={{
                  padding: "20px 22px",
                  borderBottom:
                    "1px solid #e5e7eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 20,
                      fontWeight: 700,
                    }}
                  >
                    New Campaign
                  </h2>

                  <p
                    style={{
                      margin:
                        "5px 0 0",
                      fontSize: 12,
                      color:
                        "#64748b",
                    }}
                  >
                    Create a marketing
                    campaign.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAddCampaign(false)
                  }
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border:
                      "1px solid #e5e7eb",
                    background:
                      "#ffffff",
                    color: "#374151",
                    fontSize: 20,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={handleAddCampaign}
                style={{
                  padding: 22,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      gridColumn:
                        "1 / -1",
                    }}
                  >
                    <label
                      style={{
                        display:
                          "block",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 7,
                      }}
                    >
                      Campaign Name *
                    </label>

                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          name:
                            event.target
                              .value,
                        })
                      }
                      placeholder="e.g. August Intake Campaign"
                      style={{
                        width: "100%",
                        height: 42,
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        padding:
                          "0 12px",
                        fontSize: 14,
                        boxSizing:
                          "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display:
                          "block",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 7,
                      }}
                    >
                      Channel
                    </label>

                    <input
                      type="text"
                      value={form.channel}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          channel:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Facebook, TikTok, WhatsApp..."
                      style={{
                        width: "100%",
                        height: 42,
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        padding:
                          "0 12px",
                        fontSize: 14,
                        boxSizing:
                          "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display:
                          "block",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 7,
                      }}
                    >
                      Currency
                    </label>

                    <select
                      value={form.currency}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          currency:
                            event.target
                              .value,
                        })
                      }
                      style={{
                        width: "100%",
                        height: 42,
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        padding:
                          "0 12px",
                        fontSize: 14,
                        background:
                          "#ffffff",
                        boxSizing:
                          "border-box",
                      }}
                    >
                      <option value="UGX">
                        UGX
                      </option>
                      <option value="USD">
                        USD
                      </option>
                      <option value="KES">
                        KES
                      </option>
                      <option value="TZS">
                        TZS
                      </option>
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display:
                          "block",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 7,
                      }}
                    >
                      Start Date
                    </label>

                    <input
                      type="date"
                      value={
                        form.start_date
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          start_date:
                            event.target
                              .value,
                        })
                      }
                      style={{
                        width: "100%",
                        height: 42,
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        padding:
                          "0 12px",
                        fontSize: 14,
                        boxSizing:
                          "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display:
                          "block",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 7,
                      }}
                    >
                      End Date
                    </label>

                    <input
                      type="date"
                      value={
                        form.end_date
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          end_date:
                            event.target
                              .value,
                        })
                      }
                      style={{
                        width: "100%",
                        height: 42,
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        padding:
                          "0 12px",
                        fontSize: 14,
                        boxSizing:
                          "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display:
                          "block",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 7,
                      }}
                    >
                      Budget
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={form.budget}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          budget:
                            event.target
                              .value,
                        })
                      }
                      placeholder="0"
                      style={{
                        width: "100%",
                        height: 42,
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        padding:
                          "0 12px",
                        fontSize: 14,
                        boxSizing:
                          "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display:
                          "block",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 7,
                      }}
                    >
                      Campaign Owner
                    </label>

                    <select
                      value={
                        form.created_by
                      }
                      onChange={(event) =>
                        setForm({
                          ...form,
                          created_by:
                            event.target
                              .value,
                        })
                      }
                      style={{
                        width: "100%",
                        height: 42,
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        padding:
                          "0 12px",
                        fontSize: 14,
                        background:
                          "#ffffff",
                        boxSizing:
                          "border-box",
                      }}
                    >
                      <option value="">
                        Select owner
                      </option>

                      {profiles.map(
                        (profile) => (
                          <option
                            key={
                              profile.id
                            }
                            value={
                              profile.id
                            }
                          >
                            {profile.full_name ||
                              "Unnamed"}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div
                    style={{
                      gridColumn:
                        "1 / -1",
                    }}
                  >
                    <label
                      style={{
                        display:
                          "block",
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 7,
                      }}
                    >
                      Notes
                    </label>

                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          notes:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Campaign objectives, target audience, notes..."
                      rows={4}
                      style={{
                        width: "100%",
                        border:
                          "1px solid #d1d5db",
                        borderRadius: 8,
                        padding: 12,
                        fontSize: 14,
                        resize: "vertical",
                        boxSizing:
                          "border-box",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "flex-end",
                    gap: 10,
                    marginTop: 22,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddCampaign(
                        false
                      );
                      resetForm();
                    }}
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      visibility:
                        "visible",
                      opacity: 1,
                      color:
                        "#374151",
                      background:
                        "#ffffff",
                      border:
                        "1px solid #d1d5db",
                      padding:
                        "10px 16px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      minHeight: 40,
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      visibility:
                        "visible",
                      opacity: saving
                        ? 0.7
                        : 1,
                      color:
                        "#ffffff",
                      background:
                        "#2563eb",
                      border:
                        "1px solid #2563eb",
                      padding:
                        "10px 18px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: saving
                        ? "not-allowed"
                        : "pointer",
                      minHeight: 40,
                    }}
                  >
                    {saving
                      ? "Creating..."
                      : "Create Campaign"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}