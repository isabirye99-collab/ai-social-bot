"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const leadSources = [
  "Facebook",
  "TikTok",
  "Website",
  "WhatsApp",
  "Instagram",
  "Google",
  "Referral",
  "Other",
];

function formatCurrency(
  value: number,
  currency = "UGX"
) {
  try {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value || 0);
  } catch {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString();
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

  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;

  if (start && now < start) {
    return {
      label: "Scheduled",
      background: "#fef3c7",
      color: "#92400e",
      bar: "#f59e0b",
    };
  }

  if (end && now > end) {
    return {
      label: "Completed",
      background: "#e5e7eb",
      color: "#374151",
      bar: "#94a3b8",
    };
  }

  return {
    label: "Active",
    background: "#dcfce7",
    color: "#166534",
    bar: "#16a34a",
  };
}

function getLeadCaptureUrl(
  campaignId: string,
  source: string
) {
  if (typeof window === "undefined") {
    return "";
  }

  return `${window.location.origin}/lead-capture?campaign=${encodeURIComponent(
    campaignId
  )}&source=${encodeURIComponent(source)}`;
}

function isStatus(
  status: string | null,
  values: string[]
) {
  const normalized = (status || "").toLowerCase().trim();

  return values.some((value) =>
    normalized.includes(value.toLowerCase())
  );
}

function getPipelineStage(
  status: string | null
) {
  const normalized = (status || "").toLowerCase().trim();

  if (
    normalized.includes("paid acceptance") ||
    normalized.includes("acceptance paid") ||
    normalized.includes("enrolled")
  ) {
    return "Paid Acceptance Fee";
  }

  if (
    normalized.includes("paid application") ||
    normalized.includes("application paid")
  ) {
    return "Paid Application Fee";
  }

  if (
    normalized.includes("applied") ||
    normalized.includes("application") ||
    normalized.includes("submitted")
  ) {
    return "Applied";
  }

  return "Leads";
}

type CsvRow = Record<string,string>;
function csvHeader(v:string){return v.trim().toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," ");}
function csvLine(line:string){const out:string[]=[];let value="";let quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(ch===","&&!quoted){out.push(value.trim());value="";}else value+=ch;}out.push(value.trim());return out;}
function parseMarketingCsv(text:string):CsvRow[]{const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];const headers=csvLine(lines[0]).map(csvHeader);return lines.slice(1).map(line=>{const vals=csvLine(line);const row:CsvRow={};headers.forEach((h,i)=>row[h]=vals[i]||"");return row;});}
function csvVal(row:CsvRow,aliases:string[]){for(const alias of aliases){const v=row[csvHeader(alias)];if(v?.trim())return v.trim();}return "";}
function mapMarketingRow(row:CsvRow){return{ciu_number:csvVal(row,["CIU Number","CIU No","Student Number","Student ID"]),name:csvVal(row,["Full Name","Name","Student Name","Full Names"]),phone:csvVal(row,["Telephone Number","Telephone","Phone Number","Phone","Mobile","Contact"]),email:csvVal(row,["Email","Email Address"]),product_service:csvVal(row,["Programme","Program","Course","Product","Product Service"]),feedback:csvVal(row,["Feedback","Comments","Notes"])};}

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignLeads, setCampaignLeads] = useState<CampaignLead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showCampaignModal, setShowCampaignModal] =
    useState(false);

  const [editingCampaign, setEditingCampaign] =
    useState<Campaign | null>(null);

  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] =
    useState("All");

  const [selectedCampaignId, setSelectedCampaignId] =
    useState<string | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importCampaignId, setImportCampaignId] = useState("");
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const csvInputRef = useRef<HTMLInputElement | null>(null);

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
        (campaignLeadsResult.data || []) as CampaignLead[]
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

    setEditingCampaign(null);
  };

  const openNewCampaign = () => {
    resetForm();
    setShowCampaignModal(true);
  };

  const openEditCampaign = (
    campaign: Campaign
  ) => {
    setEditingCampaign(campaign);

    setForm({
      name: campaign.name || "",
      channel: campaign.channel || "",
      start_date: campaign.start_date
        ? campaign.start_date.slice(0, 10)
        : "",
      end_date: campaign.end_date
        ? campaign.end_date.slice(0, 10)
        : "",
      budget:
        campaign.budget !== null &&
        campaign.budget !== undefined
          ? String(campaign.budget)
          : "",
      currency: campaign.currency || "UGX",
      notes: campaign.notes || "",
      created_by: campaign.created_by || "",
    });

    setShowCampaignModal(true);
  };

  const closeCampaignModal = () => {
    setShowCampaignModal(false);
    resetForm();
  };

  const handleSaveCampaign = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Campaign name is required.");
      return;
    }

    if (
      form.start_date &&
      form.end_date &&
      form.end_date < form.start_date
    ) {
      setError(
        "End date cannot be before the start date."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const budgetValue = form.budget
        ? Number(form.budget)
        : null;

      const payload = {
        name: form.name.trim(),
        channel: form.channel.trim() || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget: budgetValue,
        currency: form.currency.trim() || "UGX",
        notes: form.notes.trim() || null,
        created_by: form.created_by || null,
      };

      if (editingCampaign) {
        const { error: updateError } =
          await supabase
            .from("campaigns")
            .update(payload)
            .eq("id", editingCampaign.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      } else {
        const { error: insertError } =
          await supabase
            .from("campaigns")
            .insert(payload);

        if (insertError) {
          throw new Error(insertError.message);
        }
      }

      closeCampaignModal();

      await loadMarketing();
    } catch (err) {
      console.error(
        "Campaign save error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save campaign."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCampaign = async (
    campaign: Campaign
  ) => {
    const confirmed = window.confirm(
      `Delete the campaign "${campaign.name}"?\n\nThis will remove the campaign record.`
    );

    if (!confirmed) return;

    try {
      setError("");

      const { error: deleteError } =
        await supabase
          .from("campaigns")
          .delete()
          .eq("id", campaign.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (
        selectedCampaignId === campaign.id
      ) {
        setSelectedCampaignId(null);
      }

      await loadMarketing();
    } catch (err) {
      console.error(
        "Campaign delete error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete campaign."
      );
    }
  };

  const handleCopyLeadLink = async (
    campaignId: string,
    source: string
  ) => {
    const url = getLeadCaptureUrl(
      campaignId,
      source
    );

    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);

      window.alert(
        `${source} lead capture link copied.`
      );
    } catch (err) {
      console.error(
        "Copy link error:",
        err
      );

      window.prompt(
        "Copy this lead capture link:",
        url
      );
    }
  };

  const openImportModal=(campaignId?:string)=>{setImportCampaignId(campaignId||selectedCampaignId||campaigns[0]?.id||"");setCsvRows([]);setCsvFile(null);setImportMessage("");setError("");if(csvInputRef.current)csvInputRef.current.value="";setShowImportModal(true);};
  const handleMarketingCsv=async(file:File|null)=>{setCsvFile(file);setCsvRows([]);setImportMessage("");if(!file)return;if(!file.name.toLowerCase().endsWith(".csv")){setError("Please select a CSV file.");return;}try{const rows=parseMarketingCsv(await file.text());if(!rows.length)throw new Error("The CSV file contains no data rows.");if(rows.length>5000)throw new Error("A single CSV import is limited to 5,000 rows.");setCsvRows(rows);setImportMessage(`${rows.length.toLocaleString()} rows detected. Review the preview before importing.`);}catch(err){setError(err instanceof Error?err.message:"Unable to read CSV.");}};
  const importMarketingLeads=async()=>{if(!csvFile||!importCampaignId||!csvRows.length){setError("Select a campaign and CSV file first.");return;}try{setSaving(true);setError("");setImportMessage("Importing leads and assigning salespeople...");const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("You must be signed in.");const {data:batch,error:batchError}=await supabase.from("campaign_import_batches").insert({campaign_id:importCampaignId,file_name:csvFile.name,total_rows:csvRows.length,imported_by:user.id}).select("id").single();if(batchError)throw new Error(batchError.message);let imported=0,duplicates=0,failed=0;for(const raw of csvRows){const row=mapMarketingRow(raw);if(!row.name||!row.phone){failed++;continue;}let existing:{id:string}|null=null;if(row.ciu_number){const q=await supabase.from("leads").select("id").eq("ciu_number",row.ciu_number).maybeSingle();if(q.error)throw new Error(q.error.message);existing=q.data;}if(!existing&&row.phone){const q=await supabase.from("leads").select("id").eq("phone",row.phone).maybeSingle();if(q.error)throw new Error(q.error.message);existing=q.data;}if(!existing&&row.email){const q=await supabase.from("leads").select("id").eq("email",row.email).maybeSingle();if(q.error)throw new Error(q.error.message);existing=q.data;}let leadId=existing?.id;if(existing)duplicates++;else{const q=await supabase.from("leads").insert({ciu_number:row.ciu_number||null,name:row.name,phone:row.phone||null,email:row.email||null,product_service:row.product_service||null,feedback:row.feedback||null,status:"new"}).select("id").single();if(q.error){failed++;continue;}leadId=q.data.id;imported++;}if(!leadId)continue;const a=await supabase.from("campaign_leads").upsert({campaign_id:importCampaignId,lead_id:leadId},{onConflict:"campaign_id,lead_id"});if(a.error){failed++;continue;}const b=await supabase.from("campaign_lead_imports").upsert({campaign_id:importCampaignId,lead_id:leadId,import_batch_id:batch.id},{onConflict:"campaign_id,lead_id"});if(b.error)failed++;}const u=await supabase.from("campaign_import_batches").update({imported_rows:imported,duplicate_rows:duplicates,failed_rows:failed}).eq("id",batch.id);if(u.error)throw new Error(u.error.message);setImportMessage(`Import complete: ${imported} new leads, ${duplicates} existing leads linked, ${failed} failed rows.`);await loadMarketing();}catch(err){console.error(err);setError(err instanceof Error?err.message:"CSV import failed.");}finally{setSaving(false);}};
  const channels = useMemo(() => {
    const values = campaigns
      .map((campaign) =>
        campaign.channel?.trim()
      )
      .filter(
        (
          channel
        ): channel is string =>
          Boolean(channel)
      );

    return Array.from(new Set(values));
  }, [campaigns]);

  const campaignLeadCount =
    useMemo(() => {
      const counts = new Map<string, number>();

      campaignLeads.forEach((item) => {
        counts.set(
          item.campaign_id,
          (counts.get(item.campaign_id) || 0) + 1
        );
      });

      return counts;
    }, [campaignLeads]);

  const campaignLeadIdsMap =
    useMemo(() => {
      const map = new Map<
        string,
        Set<string>
      >();

      campaignLeads.forEach((item) => {
        if (!map.has(item.campaign_id)) {
          map.set(
            item.campaign_id,
            new Set<string>()
          );
        }

        map
          .get(item.campaign_id)!
          .add(item.lead_id);
      });

      return map;
    }, [campaignLeads]);

  const leadMap = useMemo(() => {
    const map = new Map<string, Lead>();

    leads.forEach((lead) => {
      map.set(lead.id, lead);
    });

    return map;
  }, [leads]);

  const filteredCampaigns =
    useMemo(() => {
      const query = search
        .trim()
        .toLowerCase();

      return campaigns.filter(
        (campaign) => {
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

          return (
            matchesSearch &&
            matchesChannel
          );
        }
      );
    }, [
      campaigns,
      search,
      channelFilter,
    ]);

  const activeCampaigns =
    useMemo(() => {
      return campaigns.filter(
        (campaign) =>
          getCampaignStatus(
            campaign.start_date,
            campaign.end_date
          ).label === "Active"
      ).length;
    }, [campaigns]);

  const totalCampaignLeads =
    campaignLeads.length;

  const campaignLeadSet =
    useMemo(
      () =>
        new Set(
          campaignLeads.map(
            (item) => item.lead_id
          )
        ),
      [campaignLeads]
    );

  const campaignLeadsList =
    useMemo(() => {
      return leads.filter((lead) =>
        campaignLeadSet.has(lead.id)
      );
    }, [leads, campaignLeadSet]);

  const convertedCampaignLeads =
    useMemo(() => {
      return campaignLeadsList.filter(
        (lead) =>
          isStatus(lead.status, [
            "converted",
            "paid",
            "enrolled",
            "acceptance",
          ])
      ).length;
    }, [campaignLeadsList]);

  const conversionRate =
    totalCampaignLeads > 0
      ? (convertedCampaignLeads /
          totalCampaignLeads) *
        100
      : 0;

  const totalBudget =
    campaigns.reduce(
      (total, campaign) =>
        total +
        Number(campaign.budget || 0),
      0
    );

  const profileMap = useMemo(() => {
    const map = new Map<
      string,
      string
    >();

    profiles.forEach((profile) => {
      map.set(
        profile.id,
        profile.full_name || "Unknown"
      );
    });

    return map;
  }, [profiles]);

  const selectedCampaign =
    useMemo(() => {
      if (!selectedCampaignId) {
        return null;
      }

      return (
        campaigns.find(
          (campaign) =>
            campaign.id ===
            selectedCampaignId
        ) || null
      );
    }, [
      campaigns,
      selectedCampaignId,
    ]);

  const selectedCampaignLeads =
    useMemo(() => {
      if (!selectedCampaign) {
        return [];
      }

      const ids =
        campaignLeadIdsMap.get(
          selectedCampaign.id
        );

      if (!ids) return [];

      return leads.filter((lead) =>
        ids.has(lead.id)
      );
    }, [
      selectedCampaign,
      campaignLeadIdsMap,
      leads,
    ]);

  const selectedPerformance =
    useMemo(() => {
      const total =
        selectedCampaignLeads.length;

      const applied =
        selectedCampaignLeads.filter(
          (lead) =>
            getPipelineStage(
              lead.status
            ) === "Applied" ||
            getPipelineStage(
              lead.status
            ) ===
              "Paid Application Fee" ||
            getPipelineStage(
              lead.status
            ) ===
              "Paid Acceptance Fee"
        ).length;

      const applicationPaid =
        selectedCampaignLeads.filter(
          (lead) =>
            getPipelineStage(
              lead.status
            ) ===
            "Paid Application Fee" ||
            getPipelineStage(
              lead.status
            ) ===
              "Paid Acceptance Fee"
        ).length;

      const acceptancePaid =
        selectedCampaignLeads.filter(
          (lead) =>
            getPipelineStage(
              lead.status
            ) ===
            "Paid Acceptance Fee"
        ).length;

      const budget = Number(
        selectedCampaign?.budget || 0
      );

      const costPerLead =
        total > 0
          ? budget / total
          : 0;

      return {
        total,
        applied,
        applicationPaid,
        acceptancePaid,
        costPerLead,
      };
    }, [
      selectedCampaign,
      selectedCampaignLeads,
    ]);

  const sourcePerformance =
    useMemo(() => {
      if (!selectedCampaign) {
        return [];
      }

      const sourceMap = new Map<
        string,
        {
          source: string;
          leads: number;
          applied: number;
          paidApplication: number;
          paidAcceptance: number;
        }
      >();

      campaignLeads
        .filter(
          (item) =>
            item.campaign_id ===
            selectedCampaign.id
        )
        .forEach((item) => {
          const source =
            "Campaign Link";

          const lead =
            leadMap.get(item.lead_id);

          if (!sourceMap.has(source)) {
            sourceMap.set(source, {
              source,
              leads: 0,
              applied: 0,
              paidApplication: 0,
              paidAcceptance: 0,
            });
          }

          const row =
            sourceMap.get(source)!;

          row.leads += 1;

          const stage =
            getPipelineStage(
              lead?.status || null
            );

          if (
            stage === "Applied" ||
            stage ===
              "Paid Application Fee" ||
            stage ===
              "Paid Acceptance Fee"
          ) {
            row.applied += 1;
          }

          if (
            stage ===
              "Paid Application Fee" ||
            stage ===
              "Paid Acceptance Fee"
          ) {
            row.paidApplication += 1;
          }

          if (
            stage ===
            "Paid Acceptance Fee"
          ) {
            row.paidAcceptance += 1;
          }
        });

      return Array.from(
        sourceMap.values()
      );
    }, [
      selectedCampaign,
      campaignLeads,
      leadMap,
    ]);

  const overallPipeline =
    useMemo(() => {
      const result = {
        leads: 0,
        applied: 0,
        applicationPaid: 0,
        acceptancePaid: 0,
      };

      campaignLeadsList.forEach(
        (lead) => {
          const stage =
            getPipelineStage(
              lead.status
            );

          if (stage === "Leads") {
            result.leads += 1;
          }

          if (stage === "Applied") {
            result.applied += 1;
          }

          if (
            stage ===
            "Paid Application Fee"
          ) {
            result.applicationPaid += 1;
          }

          if (
            stage ===
            "Paid Acceptance Fee"
          ) {
            result.acceptancePaid += 1;
          }
        }
      );

      return result;
    }, [campaignLeadsList]);

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
              border:
                "1px solid #e5e7eb",
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
        padding:
          "28px 32px 48px",
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
            justifyContent:
              "space-between",
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
                margin:
                  "6px 0 0",
                color: "#64748b",
                fontSize: 14,
              }}
            >
              Manage campaigns,
              measure lead generation
              and track recruitment
              performance.
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
                display:
                  "inline-flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                visibility:
                  "visible",
                opacity:
                  refreshing
                    ? 0.7
                    : 1,
                color: "#374151",
                background:
                  "#ffffff",
                border:
                  "1px solid #d1d5db",
                padding:
                  "10px 16px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor:
                  refreshing
                    ? "not-allowed"
                    : "pointer",
                minHeight: 40,
              }}
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>

            <button type="button" onClick={()=>openImportModal()} className="ciu-btn-light" style={{visibility:"visible",opacity:1}}>↑ Upload Leads CSV</button>
            <button
              type="button"
              onClick={openNewCampaign}
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
                color: "#ffffff",
                background:
                  "#2563eb",
                border:
                  "1px solid #2563eb",
                padding:
                  "10px 16px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor:
                  "pointer",
                minHeight: 40,
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
              padding:
                "14px 16px",
              borderRadius: 10,
              background:
                "#fef2f2",
              border:
                "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 14,
            }}
          >
            <strong>
              Marketing error:
            </strong>{" "}
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
              border:
                "1px solid #e5e7eb",
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
              border:
                "1px solid #e5e7eb",
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
              {formatNumber(
                totalCampaignLeads
              )}
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
              border:
                "1px solid #e5e7eb",
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
              Campaign Conversion
            </div>

            <div
              style={{
                fontSize: 30,
                fontWeight: 700,
              }}
            >
              {conversionRate.toFixed(
                1
              )}
              %
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
              border:
                "1px solid #e5e7eb",
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
              {formatCurrency(
                totalBudget
              )}
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

        {/* OVERALL PIPELINE */}
        <div
          style={{
            background: "#ffffff",
            border:
              "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "center",
              gap: 12,
              marginBottom: 18,
              flexWrap: "wrap",
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                }}
              >
                Campaign Pipeline
              </h2>

              <p
                style={{
                  margin:
                    "5px 0 0",
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                Recruitment progress
                from marketing leads.
              </p>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {[
              {
                label: "Leads",
                value:
                  overallPipeline.leads,
              },
              {
                label: "Applied",
                value:
                  overallPipeline.applied,
              },
              {
                label:
                  "Paid Application",
                value:
                  overallPipeline.applicationPaid,
              },
              {
                label:
                  "Paid Acceptance",
                value:
                  overallPipeline.acceptancePaid,
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  background:
                    "#f8fafc",
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    color:
                      "#64748b",
                    marginBottom: 8,
                  }}
                >
                  {item.label}
                </div>

                <div
                  style={{
                    fontSize: 25,
                    fontWeight: 700,
                  }}
                >
                  {formatNumber(
                    item.value
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FILTERS */}
        <div
          style={{
            background: "#ffffff",
            border:
              "1px solid #e5e7eb",
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
              setSearch(
                event.target.value
              )
            }
            placeholder="Search campaigns..."
            style={{
              flex:
                "1 1 280px",
              minWidth: 220,
              height: 40,
              border:
                "1px solid #d1d5db",
              borderRadius: 8,
              padding:
                "0 12px",
              fontSize: 14,
              outline: "none",
            }}
          />

          <select
            value={channelFilter}
            onChange={(event) =>
              setChannelFilter(
                event.target.value
              )
            }
            style={{
              minWidth: 180,
              height: 40,
              border:
                "1px solid #d1d5db",
              borderRadius: 8,
              padding:
                "0 12px",
              fontSize: 14,
              background:
                "#ffffff",
            }}
          >
            <option value="All">
              All Channels
            </option>

            {channels.map(
              (channel) => (
                <option
                  key={channel}
                  value={channel}
                >
                  {channel}
                </option>
              )
            )}
          </select>
        </div>

        {/* CAMPAIGNS */}
        {filteredCampaigns.length ===
        0 ? (
          <div
            style={{
              background:
                "#ffffff",
              border:
                "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 50,
              textAlign:
                "center",
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
              Create your first
              marketing campaign to
              start tracking lead
              generation.
            </div>

            <button
              type="button"
              onClick={openNewCampaign}
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
                color: "#ffffff",
                background:
                  "#2563eb",
                border:
                  "1px solid #2563eb",
                padding:
                  "10px 16px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor:
                  "pointer",
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
                "repeat(auto-fit, minmax(340px, 1fr))",
              gap: 18,
            }}
          >
            {filteredCampaigns.map(
              (campaign) => {
                const status =
                  getCampaignStatus(
                    campaign.start_date,
                    campaign.end_date
                  );

                const leadCount =
                  campaignLeadCount.get(
                    campaign.id
                  ) || 0;

                const campaignIds =
                  campaignLeadIdsMap.get(
                    campaign.id
                  ) ||
                  new Set<string>();

                const campaignLeadsForCard =
                  leads.filter((lead) =>
                    campaignIds.has(
                      lead.id
                    )
                  );

                const converted =
                  campaignLeadsForCard.filter(
                    (lead) =>
                      isStatus(
                        lead.status,
                        [
                          "converted",
                          "paid",
                          "enrolled",
                          "acceptance",
                        ]
                      )
                  ).length;

                const campaignConversion =
                  leadCount > 0
                    ? (converted /
                        leadCount) *
                      100
                    : 0;

                const costPerLead =
                  leadCount > 0
                    ? Number(
                        campaign.budget ||
                          0
                      ) / leadCount
                    : 0;

                return (
                  <div
                    key={campaign.id}
                    style={{
                      background:
                        "#ffffff",
                      border:
                        "1px solid #e5e7eb",
                      borderRadius: 12,
                      overflow:
                        "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: 5,
                        background:
                          status.bar,
                      }}
                    />

                    <div
                      style={{
                        padding: 20,
                      }}
                    >
                      {/* CARD HEADER */}
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          alignItems:
                            "flex-start",
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
                              status.background,
                            color:
                              status.color,
                          }}
                        >
                          {status.label}
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            color:
                              "#64748b",
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

                      {/* PERFORMANCE */}
                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "1fr 1fr",
                          gap: 10,
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
                              marginBottom:
                                5,
                            }}
                          >
                            Leads
                          </div>

                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 700,
                            }}
                          >
                            {formatNumber(
                              leadCount
                            )}
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
                              marginBottom:
                                5,
                            }}
                          >
                            Conversion
                          </div>

                          <div
                            style={{
                              fontSize: 22,
                              fontWeight: 700,
                            }}
                          >
                            {campaignConversion.toFixed(
                              1
                            )}
                            %
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
                              marginBottom:
                                5,
                            }}
                          >
                            Budget
                          </div>

                          <div
                            style={{
                              fontSize: 15,
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
                              marginBottom:
                                5,
                            }}
                          >
                            Cost / Lead
                          </div>

                          <div
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                            }}
                          >
                            {formatCurrency(
                              costPerLead,
                              campaign.currency ||
                                "UGX"
                            )}
                          </div>
                        </div>
                      </div>

                      {/* DATES / OWNER */}
                      <div
                        style={{
                          marginTop: 18,
                          paddingTop: 14,
                          borderTop:
                            "1px solid #f1f5f9",
                          display:
                            "flex",
                          justifyContent:
                            "space-between",
                          gap: 10,
                          fontSize: 11,
                          color:
                            "#64748b",
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

                      {/* ACTIONS */}
                      <div
                        style={{
                          display:
                            "flex",
                          gap: 8,
                          marginTop: 16,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCampaignId(
                              campaign.id
                            )
                          }
                          style={{
                            flex: 1,
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            color:
                              "#1d4ed8",
                            background:
                              "#eff6ff",
                            border:
                              "1px solid #bfdbfe",
                            padding:
                              "9px 10px",
                            borderRadius:
                              7,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor:
                              "pointer",
                          }}
                        >
                          View Performance
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            openEditCampaign(
                              campaign
                            )
                          }
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            color:
                              "#374151",
                            background:
                              "#ffffff",
                            border:
                              "1px solid #d1d5db",
                            padding:
                              "9px 12px",
                            borderRadius:
                              7,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor:
                              "pointer",
                          }}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteCampaign(
                              campaign
                            )
                          }
                          style={{
                            display:
                              "inline-flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            color:
                              "#b91c1c",
                            background:
                              "#fef2f2",
                            border:
                              "1px solid #fecaca",
                            padding:
                              "9px 12px",
                            borderRadius:
                              7,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor:
                              "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>

                      {/* LEAD CAPTURE LINKS */}
                      <div
                        style={{
                          marginTop: 18,
                          paddingTop: 16,
                          borderTop:
                            "1px solid #f1f5f9",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "space-between",
                            gap: 10,
                            marginBottom:
                              10,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            Lead Capture
                            Links
                          </div>

                          <span
                            style={{
                              fontSize: 11,
                              color:
                                "#64748b",
                            }}
                          >
                            Share to collect
                            leads
                          </span>
                        </div>

                        <div
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(130px, 1fr))",
                            gap: 8,
                          }}
                        >
                          {leadSources.map(
                            (source) => (
                              <button
                                key={
                                  source
                                }
                                type="button"
                                onClick={() =>
                                  handleCopyLeadLink(
                                    campaign.id,
                                    source
                                  )
                                }
                                style={{
                                  display:
                                    "inline-flex",
                                  alignItems:
                                    "center",
                                  justifyContent:
                                    "center",
                                  color:
                                    "#1d4ed8",
                                  background:
                                    "#eff6ff",
                                  border:
                                    "1px solid #bfdbfe",
                                  padding:
                                    "8px 10px",
                                  borderRadius:
                                    7,
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor:
                                    "pointer",
                                  minHeight:
                                    36,
                                }}
                              >
                                Copy{" "}
                                {source}
                              </button>
                            )
                          )}
                        </div>

                        <div
                          style={{
                            marginTop: 10,
                            padding:
                              "9px 10px",
                            background:
                              "#f8fafc",
                            border:
                              "1px solid #e5e7eb",
                            borderRadius:
                              7,
                            fontSize: 11,
                            color:
                              "#64748b",
                            lineHeight:
                              1.5,
                          }}
                        >
                          Each link identifies
                          this campaign and
                          selected source when
                          a prospect submits
                          the lead form.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* PERFORMANCE MODAL */}
        {selectedCampaign && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background:
                "rgba(15, 23, 42, 0.55)",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              padding: 20,
            }}
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setSelectedCampaignId(
                  null
                );
              }
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 850,
                maxHeight: "90vh",
                overflowY: "auto",
                background:
                  "#ffffff",
                borderRadius: 14,
                boxShadow:
                  "0 20px 50px rgba(0,0,0,0.2)",
              }}
            >
              <div
                style={{
                  padding:
                    "20px 22px",
                  borderBottom:
                    "1px solid #e5e7eb",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: 16,
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
                    {selectedCampaign.name}
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
                    Campaign performance
                    and recruitment
                    pipeline
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedCampaignId(
                      null
                    )
                  }
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border:
                      "1px solid #e5e7eb",
                    background:
                      "#ffffff",
                    color:
                      "#374151",
                    fontSize: 20,
                    cursor:
                      "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  padding: 22,
                }}
              >
                {/* PERFORMANCE KPIs */}
                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(150px, 1fr))",
                    gap: 12,
                    marginBottom: 22,
                  }}
                >
                  {[
                    {
                      label: "Leads",
                      value:
                        selectedPerformance.total,
                    },
                    {
                      label: "Applied",
                      value:
                        selectedPerformance.applied,
                    },
                    {
                      label:
                        "Paid Application",
                      value:
                        selectedPerformance.applicationPaid,
                    },
                    {
                      label:
                        "Paid Acceptance",
                      value:
                        selectedPerformance.acceptancePaid,
                    },
                    {
                      label:
                        "Cost / Lead",
                      value:
                        formatCurrency(
                          selectedPerformance.costPerLead,
                          selectedCampaign.currency ||
                            "UGX"
                        ),
                    },
                  ].map((item) => (
                    <div
                      key={
                        item.label
                      }
                      style={{
                        background:
                          "#f8fafc",
                        border:
                          "1px solid #e5e7eb",
                        borderRadius:
                          10,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          color:
                            "#64748b",
                          marginBottom:
                            7,
                        }}
                      >
                        {item.label}
                      </div>

                      <div
                        style={{
                          fontSize: 21,
                          fontWeight: 700,
                        }}
                      >
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* PIPELINE */}
                <div
                  style={{
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 10,
                    overflow:
                      "hidden",
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      padding:
                        "14px 16px",
                      background:
                        "#f8fafc",
                      borderBottom:
                        "1px solid #e5e7eb",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    Recruitment Pipeline
                  </div>

                  {[
                    {
                      label: "Leads",
                      value:
                        selectedPerformance.total,
                    },
                    {
                      label: "Applied",
                      value:
                        selectedPerformance.applied,
                    },
                    {
                      label:
                        "Paid Application Fee",
                      value:
                        selectedPerformance.applicationPaid,
                    },
                    {
                      label:
                        "Paid Acceptance Fee",
                      value:
                        selectedPerformance.acceptancePaid,
                    },
                  ].map((item) => {
                    const percentage =
                      selectedPerformance.total >
                      0
                        ? (Number(
                            item.value
                          ) /
                            selectedPerformance.total) *
                          100
                        : 0;

                    return (
                      <div
                        key={
                          item.label
                        }
                        style={{
                          padding:
                            "13px 16px",
                          borderBottom:
                            "1px solid #f1f5f9",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            marginBottom:
                              7,
                            fontSize: 12,
                          }}
                        >
                          <span>
                            {item.label}
                          </span>

                          <strong>
                            {formatNumber(
                              Number(
                                item.value
                              )
                            )}{" "}
                            (
                            {percentage.toFixed(
                              1
                            )}
                            %)
                          </strong>
                        </div>

                        <div
                          style={{
                            height: 7,
                            background:
                              "#e5e7eb",
                            borderRadius:
                              999,
                            overflow:
                              "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(
                                percentage,
                                100
                              )}%`,
                              height:
                                "100%",
                              background:
                                "#2563eb",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* SOURCE PERFORMANCE */}
                <div
                  style={{
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 10,
                    overflow:
                      "hidden",
                  }}
                >
                  <div
                    style={{
                      padding:
                        "14px 16px",
                      background:
                        "#f8fafc",
                      borderBottom:
                        "1px solid #e5e7eb",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    Source Performance
                  </div>

                  {sourcePerformance.length ===
                  0 ? (
                    <div
                      style={{
                        padding: 20,
                        color:
                          "#64748b",
                        fontSize: 13,
                      }}
                    >
                      No campaign leads
                      have been captured
                      yet.
                    </div>
                  ) : (
                    <div
                      style={{
                        overflowX:
                          "auto",
                      }}
                    >
                      <table
                        style={{
                          width:
                            "100%",
                          borderCollapse:
                            "collapse",
                          fontSize: 12,
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background:
                                "#ffffff",
                              borderBottom:
                                "1px solid #e5e7eb",
                            }}
                          >
                            <th
                              style={{
                                padding:
                                  "11px 14px",
                                textAlign:
                                  "left",
                              }}
                            >
                              Source
                            </th>
                            <th
                              style={{
                                padding:
                                  "11px 14px",
                                textAlign:
                                  "right",
                              }}
                            >
                              Leads
                            </th>
                            <th
                              style={{
                                padding:
                                  "11px 14px",
                                textAlign:
                                  "right",
                              }}
                            >
                              Applied
                            </th>
                            <th
                              style={{
                                padding:
                                  "11px 14px",
                                textAlign:
                                  "right",
                              }}
                            >
                              Paid App.
                            </th>
                            <th
                              style={{
                                padding:
                                  "11px 14px",
                                textAlign:
                                  "right",
                              }}
                            >
                              Paid Acc.
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {sourcePerformance.map(
                            (row) => (
                              <tr
                                key={
                                  row.source
                                }
                                style={{
                                  borderBottom:
                                    "1px solid #f1f5f9",
                                }}
                              >
                                <td
                                  style={{
                                    padding:
                                      "11px 14px",
                                    fontWeight:
                                      600,
                                  }}
                                >
                                  {row.source}
                                </td>

                                <td
                                  style={{
                                    padding:
                                      "11px 14px",
                                    textAlign:
                                      "right",
                                  }}
                                >
                                  {row.leads}
                                </td>

                                <td
                                  style={{
                                    padding:
                                      "11px 14px",
                                    textAlign:
                                      "right",
                                  }}
                                >
                                  {row.applied}
                                </td>

                                <td
                                  style={{
                                    padding:
                                      "11px 14px",
                                    textAlign:
                                      "right",
                                  }}
                                >
                                  {
                                    row.paidApplication
                                  }
                                </td>

                                <td
                                  style={{
                                    padding:
                                      "11px 14px",
                                    textAlign:
                                      "right",
                                  }}
                                >
                                  {
                                    row.paidAcceptance
                                  }
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showImportModal && (<div style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(15,23,42,.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}><div style={{width:"100%",maxWidth:760,maxHeight:"92vh",overflowY:"auto",background:"#fff",borderRadius:16,padding:24,boxShadow:"0 25px 70px rgba(15,23,42,.25)"}}><div style={{display:"flex",justifyContent:"space-between"}}><div><h2 style={{margin:0,fontSize:22}}>Upload Leads CSV</h2><p style={{margin:"6px 0 0",color:"#6b7f78",fontSize:13}}>Bulk imports are tracked through Marketing and linked to a campaign.</p></div><button type="button" onClick={()=>!saving&&setShowImportModal(false)} style={{width:36,height:36,borderRadius:8,border:"1px solid #dfe9e5",background:"#fff",fontSize:18}}>×</button></div><div style={{marginTop:20}}><label style={labelStyle}>Campaign *</label><select value={importCampaignId} onChange={e=>setImportCampaignId(e.target.value)} style={inputStyle} disabled={saving}><option value="">Select campaign</option>{campaigns.map(campaign=><option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></div><div style={{marginTop:15,padding:16,borderRadius:10,border:"1px dashed #9dbab1",background:"#f7fbf9"}}><input ref={csvInputRef} type="file" accept=".csv,text/csv" disabled={saving} onChange={e=>handleMarketingCsv(e.target.files?.[0]||null)}/><div style={{marginTop:8,fontSize:12,color:"#64756f"}}>Columns: CIU Number, Full Name, Telephone Number, Email, Programme, Feedback. Maximum 5,000 rows.</div></div>{csvRows.length>0&&<div style={{marginTop:18}}><strong>Preview — first 5 rows</strong><div style={{overflowX:"auto",marginTop:8}}><table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr>{["Name","Phone","Email","Programme","CIU Number"].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead><tbody>{csvRows.slice(0,5).map((raw,i)=>{const row=mapMarketingRow(raw);return <tr key={i}><td style={tdStyle}>{row.name||"—"}</td><td style={tdStyle}>{row.phone||"—"}</td><td style={tdStyle}>{row.email||"—"}</td><td style={tdStyle}>{row.product_service||"—"}</td><td style={tdStyle}>{row.ciu_number||"—"}</td></tr>;})}</tbody></table></div></div>}{importMessage&&<div style={{marginTop:15,padding:12,borderRadius:9,background:"#edf8f4",color:"#00695c",fontSize:12}}>{importMessage}</div>}<div style={{marginTop:15,padding:12,borderRadius:9,background:"#fff8e8",color:"#795500",fontSize:12}}>New leads are automatically assigned to the salesperson with the lightest workload. Existing leads are linked to the campaign instead of being duplicated.</div><div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:22}}><button type="button" className="ciu-btn-light" onClick={()=>setShowImportModal(false)} disabled={saving}>Cancel</button><button type="button" className="ciu-btn" onClick={importMarketingLeads} disabled={saving||!csvRows.length||!importCampaignId}>{saving?"Importing...":"Import Leads"}</button></div></div></div>)}
        {/* CAMPAIGN MODAL */}
        {showCampaignModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1000,
              background:
                "rgba(15, 23, 42, 0.55)",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "center",
              padding: 20,
            }}
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeCampaignModal();
              }
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 620,
                maxHeight: "90vh",
                overflowY: "auto",
                background:
                  "#ffffff",
                borderRadius: 14,
                boxShadow:
                  "0 20px 50px rgba(0,0,0,0.2)",
              }}
            >
              <div
                style={{
                  padding:
                    "20px 22px",
                  borderBottom:
                    "1px solid #e5e7eb",
                  display:
                    "flex",
                  alignItems:
                    "center",
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
                    {editingCampaign
                      ? "Edit Campaign"
                      : "New Campaign"}
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
                    {editingCampaign
                      ? "Update campaign information."
                      : "Create a marketing campaign."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    closeCampaignModal
                  }
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    border:
                      "1px solid #e5e7eb",
                    background:
                      "#ffffff",
                    color:
                      "#374151",
                    fontSize: 20,
                    cursor:
                      "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={
                  handleSaveCampaign
                }
                style={{
                  padding: 22,
                }}
              >
                <div
                  style={{
                    display:
                      "grid",
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
                        marginBottom:
                          7,
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
                      placeholder="e.g. November Intake Campaign"
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
                        marginBottom:
                          7,
                      }}
                    >
                      Channel
                    </label>

                    <input
                      type="text"
                      value={
                        form.channel
                      }
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
                        marginBottom:
                          7,
                      }}
                    >
                      Currency
                    </label>

                    <select
                      value={
                        form.currency
                      }
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
                        marginBottom:
                          7,
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
                        marginBottom:
                          7,
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
                        marginBottom:
                          7,
                      }}
                    >
                      Budget
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={
                        form.budget
                      }
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
                        marginBottom:
                          7,
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
                        marginBottom:
                          7,
                      }}
                    >
                      Notes
                    </label>

                    <textarea
                      value={
                        form.notes
                      }
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
                        resize:
                          "vertical",
                        boxSizing:
                          "border-box",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "flex-end",
                    gap: 10,
                    marginTop: 22,
                  }}
                >
                  <button
                    type="button"
                    onClick={
                      closeCampaignModal
                    }
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
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
                      cursor:
                        "pointer",
                      minHeight: 40,
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving
                    }
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
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
                      cursor:
                        saving
                          ? "not-allowed"
                          : "pointer",
                      opacity:
                        saving
                          ? 0.7
                          : 1,
                      minHeight: 40,
                    }}
                  >
                    {saving
                      ? "Saving..."
                      : editingCampaign
                        ? "Save Changes"
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