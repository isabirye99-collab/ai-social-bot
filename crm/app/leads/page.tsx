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
  created_at: string;
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

const leadStatusMap: Record<string, string> = {
  new: "Pending",
  contacted: "Called",
  qualified: "Interested",
  unqualified: "Not interested",
  converted: "Converted",
  lost: "Lost Leads",
};

const displayStatuses = [
  "Pending",
  "Called",
  "WhatsApped",
  "Email sent",
  "Interested",
  "Not interested",
  "Follow up later",
  "Converted",
  "Paid Fees",
  "Financial issues",
  "Lost Leads",
  "Dropped",
  "Ineffective Data",
  "Unreachable",
  "No Answer",
];

const outcomeOptions = [
  "Answered - Interested",
  "Answered - Follow up later",
  "Answered - Not interested",
  "Financial issues",
  "Application started",
  "Application submitted",
  "Admitted",
  "Acceptance paid",
  "Enrolled",
  "No Answer",
  "Unreachable",
  "Wrong Number",
  "Dropped",
  "Other",
];

function cleanPhone(phone: string) {
  return phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function formatDate(date: string | null) {
  if (!date) return "â€”";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "â€”";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: string | null) {
  if (!date) return "â€”";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "â€”";
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function outcomeToLeadStatus(outcome: string) {
  const value = outcome.toLowerCase();

  if (value.includes("not interested")) return "unqualified";
  if (value.includes("dropped")) return "lost";
  if (value.includes("wrong number")) return "unqualified";

  if (
    value.includes("interested") ||
    value.includes("application") ||
    value.includes("admitted") ||
    value.includes("financial")
  ) {
    return "qualified";
  }

  if (
    value.includes("converted") ||
    value.includes("enrolled") ||
    value.includes("acceptance paid")
  ) {
    return "converted";
  }

  if (
    value.includes("unreachable") ||
    value.includes("no answer") ||
    value.includes("follow up")
  ) {
    return "contacted";
  }

  return "contacted";
}

function outcomeToDisplayStatus(outcome: string) {
  const value = outcome.toLowerCase();

  if (value.includes("not interested")) return "Not interested";
  if (value.includes("interested")) return "Interested";
  if (value.includes("financial")) return "Financial issues";
  if (value.includes("acceptance paid")) return "Paid Fees";
  if (value.includes("enrolled")) return "Converted";
  if (value.includes("no answer")) return "No Answer";
  if (value.includes("unreachable")) return "Unreachable";
  if (value.includes("wrong number")) return "Ineffective Data";
  if (value.includes("dropped")) return "Dropped";
  if (value.includes("follow up")) return "Follow up later";

  return "Called";
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

  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityLead, setActivityLead] = useState<Lead | null>(null);
  const [activityType, setActivityType] = useState<
    "call" | "whatsapp" | "email"
  >("call");
  const [activityOutcome, setActivityOutcome] = useState("");
  const [activityFeedback, setActivityFeedback] = useState("");
  const [nextFollowUp, setNextFollowUp] = useState("");
  const [savingActivity, setSavingActivity] = useState(false);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [newLead, setNewLead] = useState({
    ciu_number: "",
    name: "",
    phone: "",
    email: "",
    product_service: "",
    status: "new",
    follow_up_status: "",
    next_follow_up_at: "",
  });

  async function loadLeads() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("leads")
        .select(
          `
          id,
          ciu_number,
          name,
          phone,
          email,
          product_service,
          status,
          follow_up_status,
          next_follow_up_at,
          created_at
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setLeads((data || []) as Lead[]);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const programs = useMemo(() => {
    const values = leads
      .map((lead) => lead.product_service)
      .filter(Boolean) as string[];

    return Array.from(new Set(values)).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const displayStatus =
        leadStatusMap[lead.status || ""] || lead.status || "Pending";

      const matchesSearch =
        !query ||
        [
          lead.ciu_number,
          lead.name,
          lead.phone,
          lead.email,
          lead.product_service,
          displayStatus,
          lead.follow_up_status,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "All" || displayStatus === statusFilter;

      const matchesProgram =
        programFilter === "All" ||
        (lead.product_service || "") === programFilter;

      return matchesSearch && matchesStatus && matchesProgram;
    });
  }, [leads, search, statusFilter, programFilter]);

  const totalLeads = leads.length;

  const interestedLeads = leads.filter((lead) => {
    const status = leadStatusMap[lead.status || ""] || lead.status;
    return status === "Interested";
  }).length;

  const convertedLeads = leads.filter(
    (lead) =>
      lead.status === "converted" ||
      leadStatusMap[lead.status || ""] === "Converted"
  ).length;

  const followUps = leads.filter(
    (lead) => !!lead.next_follow_up_at
  ).length;

  async function handleAddLead(event: React.FormEvent) {
    event.preventDefault();

    if (!newLead.name.trim() || !newLead.phone.trim()) {
      alert("Please enter the student's name and telephone number.");
      return;
    }

    try {
      setSaving(true);

      const { data: salespeople, error: salespersonError } =
        await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("role", "salesperson")
          .eq("is_active", true)
          .order("full_name", { ascending: true });

      if (salespersonError) {
        throw salespersonError;
      }

      if (!salespeople || salespeople.length === 0) {
        throw new Error(
          "No active salesperson is available to receive this lead."
        );
      }

      const salespersonIds = salespeople.map((person) => person.id);

      const { data: assignedLeads, error: assignedLeadsError } =
        await supabase
          .from("leads")
          .select("assigned_to")
          .in("assigned_to", salespersonIds);

      if (assignedLeadsError) {
        throw assignedLeadsError;
      }

      const leadCounts = new Map<string, number>();

      salespersonIds.forEach((id) => {
        leadCounts.set(id, 0);
      });

      (assignedLeads || []).forEach((lead) => {
        if (lead.assigned_to) {
          leadCounts.set(
            lead.assigned_to,
            (leadCounts.get(lead.assigned_to) || 0) + 1
          );
        }
      });

      const assignedSalesperson = salespeople.reduce(
        (current, person) => {
          const currentCount = leadCounts.get(current.id) || 0;
          const personCount = leadCounts.get(person.id) || 0;

          return personCount < currentCount ? person : current;
        },
        salespeople[0]
      );

      const { data: createdLead, error } = await supabase
        .from("leads")
        .insert({
          ciu_number: newLead.ciu_number.trim() || null,
          name: newLead.name.trim(),
          phone: newLead.phone.trim(),
          email: newLead.email.trim() || null,
          product_service: newLead.product_service.trim() || null,
          status: newLead.status,
          follow_up_status: newLead.follow_up_status.trim() || null,
          next_follow_up_at: newLead.next_follow_up_at
            ? new Date(newLead.next_follow_up_at).toISOString()
            : null,
          assigned_to: assignedSalesperson.id,
        })
        .select("id, name, assigned_to")
        .single();

      if (error) {
        throw error;
      }

      if (!createdLead?.id) {
        throw new Error(
          "Lead was created but its ID could not be retrieved."
        );
      }

      let profileId: string | null = null;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.id) {
          profileId = profile.id;
        }
      }

      const initialTaskPayload: Record<string, any> = {
        title: "Follow up: " + (createdLead.name || newLead.name.trim()),
        description: "Initial follow-up for newly created Lead.",
        task_type: "call",
        lead_id: createdLead.id,
        due_at: new Date().toISOString(),
        status: "pending",
        assigned_to: assignedSalesperson.id,
      };

      if (profileId) {
        initialTaskPayload.created_by = profileId;
      }

      const { error: initialTaskError } = await supabase
        .from("tasks")
        .insert(initialTaskPayload);

      if (initialTaskError) {
        throw initialTaskError;
      }

      setNewLead({
        ciu_number: "",
        name: "",
        phone: "",
        email: "",
        product_service: "",
        status: "new",
        follow_up_status: "",
        next_follow_up_at: "",
      });

      setShowAddLead(false);
      await loadLeads();

      alert("Lead added successfully and assigned for follow-up.");
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Failed to add lead.");
    } finally {
      setSaving(false);
    }
  }

  function openActivityWorkflow(
    lead: Lead,
    type: "call" | "whatsapp" | "email"
  ) {
    if (type === "call" && !lead.phone) {
      alert("This lead does not have a telephone number.");
      return;
    }

    if (type === "whatsapp" && !lead.phone) {
      alert("This lead does not have a telephone number.");
      return;
    }

    if (type === "email" && !lead.email) {
      alert("This lead does not have an email address.");
      return;
    }

    setActivityLead(lead);
    setActivityType(type);
    setActivityOutcome("");
    setActivityFeedback("");
    setNextFollowUp("");
    setShowActivityModal(true);

    if (type === "call" && lead.phone) {
      window.open("tel:" + lead.phone, "_self");
    }

    if (type === "whatsapp" && lead.phone) {
      const phone = cleanPhone(lead.phone);

      if (phone) {
        window.open("https://wa.me/" + phone, "_blank");
      }
    }

    if (type === "email" && lead.email) {
      window.location.href = "mailto:" + lead.email;
    }
  }

  async function handleSaveActivity() {
    if (!activityLead) return;

    if (!activityOutcome) {
      alert("Please select the outcome of the interaction.");
      return;
    }

    try {
      setSavingActivity(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let profileId: string | null = null;

      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.id) {
          profileId = profile.id;
        }
      }

      const channelLabel =
        activityType === "call"
          ? "Call"
          : activityType === "whatsapp"
          ? "WhatsApp"
          : "Email";

      const displayOutcome = outcomeToDisplayStatus(activityOutcome);
      const leadStatus = outcomeToLeadStatus(activityOutcome);

      const nextFollowUpISO = nextFollowUp
        ? new Date(nextFollowUp).toISOString()
        : null;

      const description = [
        `Outcome: ${activityOutcome}`,
        activityFeedback.trim()
          ? `Feedback: ${activityFeedback.trim()}`
          : null,
        nextFollowUpISO
          ? `Next Follow Up: ${formatDateTime(nextFollowUpISO)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

      /*
       * 1. SAVE COMMUNICATION HISTORY
       */
      const { error: activityError } = await supabase
        .from("activities")
        .insert({
          lead_id: activityLead.id,
          type: activityType,
          subject: `${channelLabel} - ${activityOutcome}`,
          description: description || null,
          activity_at: new Date().toISOString(),
          created_by: profileId,
        });

      if (activityError) {
        throw activityError;
      }

      /*
       * 2. UPDATE THE LEAD
       */
      const { error: leadError } = await supabase
        .from("leads")
        .update({
          status: leadStatus,
          follow_up_status: displayOutcome,
          next_follow_up_at: nextFollowUpISO,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activityLead.id);

      if (leadError) {
        throw leadError;
      }

      /*
       * 3. DETERMINE PIPELINE MOVEMENT
       */
      const pipelineOutcomeMap: Record<string, string> = {
        "Answered - Interested": "Leads",
        "Application started": "Applied",
        "Application submitted": "Applied",
        Admitted: "Applied",
        "Acceptance paid": "Paid Acceptance Fee",
      };

      const targetStageName = pipelineOutcomeMap[activityOutcome];

      /*
       * 4. MOVE QUALIFYING LEADS INTO PIPELINE
       */
      if (targetStageName) {
        const { data: leadRecord, error: leadRecordError } =
          await supabase
            .from("leads")
            .select(
              "id, organization_id, contact_id, name, product_service, assigned_to"
            )
            .eq("id", activityLead.id)
            .maybeSingle();

        if (leadRecordError) {
          throw leadRecordError;
        }

        if (!leadRecord) {
          throw new Error(
            "The Lead could not be found for Pipeline transfer."
          );
        }

        const { data: targetStage, error: stageError } =
          await supabase
            .from("pipeline_stages")
            .select("id, name, probability")
            .eq("name", targetStageName)
            .maybeSingle();

        if (stageError) {
          throw stageError;
        }

        if (!targetStage) {
          throw new Error(
            `Pipeline stage "${targetStageName}" could not be found.`
          );
        }

        const {
          data: existingOpportunity,
          error: opportunityLookupError,
        } = await supabase
          .from("opportunities")
          .select(
            "id, lead_id, organization_id, contact_id, title, value, stage_id, status"
          )
          .eq("lead_id", activityLead.id)
          .maybeSingle();

        if (opportunityLookupError) {
          throw opportunityLookupError;
        }

        if (existingOpportunity) {
          const { error: opportunityUpdateError } =
            await supabase
              .from("opportunities")
              .update({
                stage_id: targetStage.id,
                probability: Number(targetStage.probability ?? 0),
                status: "open",
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingOpportunity.id);

          if (opportunityUpdateError) {
            throw opportunityUpdateError;
          }
        } else {
          if (!leadRecord.organization_id) {
            console.warn(
              "Lead has no organization_id. Pipeline Opportunity was not created."
            );
          } else {
            const { error: opportunityCreateError } =
              await supabase.from("opportunities").insert({
                lead_id: leadRecord.id,
                organization_id: leadRecord.organization_id,
                contact_id: leadRecord.contact_id,
                title: leadRecord.name || "Unnamed Lead",
                value: 0,
                currency: "UGX",
                stage_id: targetStage.id,
                status: "open",
                probability: Number(targetStage.probability ?? 0),
                notes: `Automatically moved from Leads after follow-up outcome: ${activityOutcome}.`,
              });

            if (opportunityCreateError) {
              throw opportunityCreateError;
            }
          }
        }
      }

      /*
       * 5. AUTOMATIC NEXT TASK CONFIGURATION
       */
      type AutomaticTaskConfig = {
        title: string;
        description: string;
        taskType: string;
        defaultDays: number;
      };

      const automaticTaskMap: Record<string, AutomaticTaskConfig> = {
        "Answered - Follow up later": {
          title: `Follow up: ${activityLead.name || "Lead"}`,
          description:
            "Follow up with the Lead as requested after the previous interaction.",
          taskType: activityType,
          defaultDays: 3,
        },

        "No Answer": {
          title: `Retry call: ${activityLead.name || "Lead"}`,
          description:
            "The previous call was not answered. Retry contacting this Lead.",
          taskType: "call",
          defaultDays: 1,
        },

        Unreachable: {
          title: `Retry contact: ${activityLead.name || "Lead"}`,
          description:
            "The Lead was unreachable. Make another contact attempt.",
          taskType: "call",
          defaultDays: 1,
        },

        "Answered - Interested": {
          title: `Pipeline follow up: ${activityLead.name || "Lead"}`,
          description:
            "Follow up with this interested Lead and progress the Pipeline opportunity.",
          taskType: "call",
          defaultDays: 2,
        },

        "Application started": {
          title: `Application follow up: ${activityLead.name || "Lead"}`,
          description:
            "Follow up and support the Lead to complete the application process.",
          taskType: "call",
          defaultDays: 2,
        },

        "Application submitted": {
          title: `Admission follow up: ${activityLead.name || "Lead"}`,
          description:
            "Follow up on the submitted application and admission process.",
          taskType: "call",
          defaultDays: 2,
        },

        Admitted: {
          title: `Acceptance fee follow up: ${activityLead.name || "Lead"}`,
          description:
            "Follow up with the admitted student regarding acceptance fee payment.",
          taskType: "call",
          defaultDays: 2,
        },

        "Acceptance paid": {
          title: `Enrollment follow up: ${activityLead.name || "Lead"}`,
          description:
            "Follow up with the student to complete enrollment and registration.",
          taskType: "call",
          defaultDays: 2,
        },
      };

      const automaticTask = automaticTaskMap[activityOutcome];

      /*
       * 6. CREATE AUTOMATIC NEXT TASK
       */
      if (automaticTask) {
        let taskDueAt = nextFollowUpISO;

        if (!taskDueAt) {
          const automaticDueDate = new Date();

          automaticDueDate.setDate(
            automaticDueDate.getDate() + automaticTask.defaultDays
          );

          automaticDueDate.setHours(9, 0, 0, 0);

          taskDueAt = automaticDueDate.toISOString();
        }

        const taskPayload: Record<string, any> = {
          title: automaticTask.title,
          description:
            activityFeedback.trim() ||
            automaticTask.description,
          task_type: automaticTask.taskType,
          lead_id: activityLead.id,
          due_at: taskDueAt,
          status: "pending",
        };

        const { data: leadAssignment, error: leadAssignmentError } =
          await supabase
            .from("leads")
            .select("assigned_to")
            .eq("id", activityLead.id)
            .maybeSingle();

        if (leadAssignmentError) {
          throw leadAssignmentError;
        }

        if (leadAssignment?.assigned_to) {
          taskPayload.assigned_to = leadAssignment.assigned_to;
        } else if (profileId) {
          taskPayload.assigned_to = profileId;
        }

        if (profileId) {
          taskPayload.created_by = profileId;
        }

        const { error: taskError } = await supabase
          .from("tasks")
          .insert(taskPayload);

        if (taskError) {
          throw taskError;
        }
      }

      /*
       * 7. CLOSE MODAL AND REFRESH
       */
      setShowActivityModal(false);
      setActivityLead(null);
      setActivityOutcome("");
      setActivityFeedback("");
      setNextFollowUp("");

      await loadLeads();

      /*
       * 8. SUCCESS MESSAGE
       */
      alert(
        `${channelLabel} activity saved successfully.\n\n` +
          `Outcome: ${activityOutcome}\n` +
          `Status: ${displayOutcome}` +
          (targetStageName
            ? `\nPipeline: ${targetStageName}`
            : "") +
          (automaticTask
            ? `\nNext Task: ${automaticTask.title}`
            : "") +
          (nextFollowUpISO
            ? `\nNext Follow Up: ${formatDateTime(nextFollowUpISO)}`
            : "")
      );
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Failed to save the activity.");
    } finally {
      setSavingActivity(false);
    }
  }

  async function openHistory(lead: Lead) {
    setHistoryLead(lead);
    setActivities([]);
    setShowHistoryModal(true);
    setLoadingHistory(true);

    try {
      const { data, error } = await supabase
        .from("activities")
        .select(
          `
          id,
          lead_id,
          type,
          subject,
          description,
          activity_at,
          created_by
        `
        )
        .eq("lead_id", lead.id)
        .order("activity_at", { ascending: false });

      if (error) {
        throw error;
      }

      setActivities((data || []) as Activity[]);
    } catch (err: any) {
      console.error(err);
      alert(
        err?.message || "Failed to load communication history."
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleView(lead: Lead) {
    const status =
      leadStatusMap[lead.status || ""] ||
      lead.status ||
      "Pending";

    alert(
      `LEAD DETAILS\n\n` +
        `CIU Number: ${lead.ciu_number || "â€”"}\n` +
        `Name: ${lead.name || "â€”"}\n` +
        `Phone: ${lead.phone || "â€”"}\n` +
        `Email: ${lead.email || "â€”"}\n` +
        `Programme: ${lead.product_service || "â€”"}\n` +
        `Status: ${status}\n` +
        `Follow Up: ${lead.follow_up_status || "â€”"}\n` +
        `Next Follow Up: ${formatDateTime(lead.next_follow_up_at)}`
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f8fb",
        padding: "24px",
        color: "#172033",
      }}
    >
      <div
        style={{
          maxWidth: "1600px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "30px",
                fontWeight: 800,
              }}
            >
              Leads
            </h1>

            <p
              style={{
                margin: "6px 0 0",
                color: "#64748b",
                fontSize: "14px",
              }}
            >
              Manage, contact, record outcomes and follow up with
              prospective students.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddLead(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px 18px",
              borderRadius: "10px",
              border: "1px solid #2563eb",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
              visibility: "visible",
              opacity: 1,
            }}
          >
            + Add New Lead
          </button>
        </div>

        {/* KPI CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <KpiCard
            label="Total Leads"
            value={totalLeads}
          />

          <KpiCard
            label="Interested"
            value={interestedLeads}
          />

          <KpiCard
            label="Converted"
            value={convertedLeads}
          />

          <KpiCard
            label="Follow Ups"
            value={followUps}
          />
        </div>

        {/* FILTERS */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            padding: "16px",
            marginBottom: "18px",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search name, phone, email, CIU number..."
            style={{
              flex: "1 1 320px",
              minWidth: "240px",
              padding: "11px 13px",
              border: "1px solid #d1d5db",
              borderRadius: "9px",
              outline: "none",
              fontSize: "14px",
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            style={{
              padding: "11px 13px",
              border: "1px solid #d1d5db",
              borderRadius: "9px",
              background: "#ffffff",
              minWidth: "170px",
              fontSize: "14px",
            }}
          >
            <option value="All">All Statuses</option>

            {displayStatuses.map((status) => (
              <option
                key={status}
                value={status}
              >
                {status}
              </option>
            ))}
          </select>

          <select
            value={programFilter}
            onChange={(e) =>
              setProgramFilter(e.target.value)
            }
            style={{
              padding: "11px 13px",
              border: "1px solid #d1d5db",
              borderRadius: "9px",
              background: "#ffffff",
              minWidth: "190px",
              fontSize: "14px",
            }}
          >
            <option value="All">
              All Programmes
            </option>

            {programs.map((program) => (
              <option
                key={program}
                value={program}
              >
                {program}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={loadLeads}
            style={{
              padding: "11px 16px",
              border: "1px solid #cbd5e1",
              borderRadius: "9px",
              background: "#ffffff",
              color: "#334155",
              fontWeight: 600,
              cursor: "pointer",
              visibility: "visible",
              opacity: 1,
            }}
          >
            Refresh
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "18px",
            }}
          >
            {error}
          </div>
        )}

        {/* TABLE */}
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "14px",
            overflow: "visible",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderBottom:
                "1px solid #e5e7eb",
              fontWeight: 700,
            }}
          >
            Lead Records ({filteredLeads.length})
          </div>

          {loading ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              Loading leads...
            </div>
          ) : filteredLeads.length === 0 ? (
            <div
              style={{
                padding: "50px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              No leads found.
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
                overflowY: "visible",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse:
                    "collapse",
                  minWidth: "1150px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "#f8fafc",
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    <th style={thStyle}>
                      CIU NUMBER
                    </th>

                    <th style={thStyle}>
                      FULL NAMES
                    </th>

                    <th style={thStyle}>
                      TELEPHONE NUMBER
                    </th>

                    <th style={thStyle}>
                      EMAIL
                    </th>

                    <th style={thStyle}>
                      PROGRAM
                    </th>

                    <th style={thStyle}>
                      STATUS
                    </th>

                    <th style={thStyle}>
                      FOLLOW UP
                    </th>

                    <th
                      style={{
                        ...thStyle,
                        textAlign: "center",
                      }}
                    >
                      FOLLOW UP
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLeads.map(
                    (lead) => {
                      const displayStatus =
                        leadStatusMap[
                          lead.status || ""
                        ] ||
                        lead.status ||
                        "Pending";

                      return (
                        <tr
                          key={lead.id}
                          style={{
                            borderBottom:
                              "1px solid #eef2f7",
                          }}
                        >
                          <td
                            style={tdStyle}
                          >
                            {lead.ciu_number ||
                              "â€”"}
                          </td>

                          <td
                            style={{
                              ...tdStyle,
                              fontWeight: 700,
                            }}
                          >
                            {lead.name || "â€”"}
                          </td>

                          <td
                            style={tdStyle}
                          >
                            {lead.phone || "â€”"}
                          </td>

                          <td
                            style={tdStyle}
                          >
                            {lead.email || (
                              <span
                                style={{
                                  color:
                                    "#94a3b8",
                                  fontStyle:
                                    "italic",
                                }}
                              >
                                No email
                              </span>
                            )}
                          </td>

                          <td
                            style={tdStyle}
                          >
                            {lead.product_service ||
                              "â€”"}
                          </td>

                          <td
                            style={tdStyle}
                          >
                            <span
                              style={{
                                display:
                                  "inline-block",
                                padding:
                                  "5px 9px",
                                borderRadius:
                                  "999px",
                                background:
                                  displayStatus ===
                                  "Converted"
                                    ? "#dcfce7"
                                    : displayStatus ===
                                      "Interested"
                                    ? "#dbeafe"
                                    : "#f1f5f9",
                                color:
                                  displayStatus ===
                                  "Converted"
                                    ? "#166534"
                                    : displayStatus ===
                                      "Interested"
                                    ? "#1d4ed8"
                                    : "#475569",
                                fontSize:
                                  "12px",
                                fontWeight: 700,
                              }}
                            >
                              {
                                displayStatus
                              }
                            </span>
                          </td>

                          <td
                            style={tdStyle}
                          >
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                }}
                              >
                                {lead.follow_up_status ||
                                  "â€”"}
                              </div>

                              {lead.next_follow_up_at && (
                                <div
                                  style={{
                                    color:
                                      "#64748b",
                                    fontSize:
                                      "12px",
                                    marginTop:
                                      "3px",
                                  }}
                                >
                                  {formatDateTime(
                                    lead.next_follow_up_at
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          <td
                            style={{
                              ...tdStyle,
                              textAlign:
                                "center",
                              minWidth:
                                "130px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openActivityWorkflow(
                                  lead,
                                  "call"
                                )
                              }
                              style={{
                                display:
                                  "inline-flex",
                                alignItems:
                                  "center",
                                justifyContent:
                                  "center",
                                gap: "7px",
                                padding:
                                  "9px 16px",
                                borderRadius:
                                  "8px",
                                border:
                                  "1px solid #2563eb",
                                background:
                                  "#2563eb",
                                color:
                                  "#ffffff",
                                fontWeight: 700,
                                fontSize:
                                  "13px",
                                cursor:
                                  "pointer",
                                visibility:
                                  "visible",
                                opacity: 1,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              <span>â†ª</span>
                              <span>
                                Follow Up
                              </span>
                            </button>
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

        {/* ACTIVITY / OUTCOME MODAL */}
        {showActivityModal &&
          activityLead && (
            <ModalOverlay
              onClose={() => {
                if (!savingActivity) {
                  setShowActivityModal(
                    false
                  );
                }
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: "650px",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  background: "#ffffff",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow:
                    "0 25px 60px rgba(15, 23, 42, 0.25)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "flex-start",
                    gap: "16px",
                    marginBottom:
                      "20px",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: "22px",
                        fontWeight: 800,
                      }}
                    >
                      Record{" "}
                      {activityType ===
                      "call"
                        ? "Call"
                        : activityType ===
                          "whatsapp"
                        ? "WhatsApp"
                        : "Email"}
                    </h2>

                    <p
                      style={{
                        margin:
                          "6px 0 0",
                        color:
                          "#64748b",
                        fontSize:
                          "13px",
                      }}
                    >
                      {activityLead.name ||
                        "Lead"}{" "}
                      {activityLead.phone
                        ? `â€¢ ${activityLead.phone}`
                        : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (
                        !savingActivity
                      ) {
                        setShowActivityModal(
                          false
                        );
                      }
                    }}
                    style={
                      closeButtonStyle
                    }
                  >
                    Ã—
                  </button>
                </div>

                <div
                  style={{
                    background:
                      "#eff6ff",
                    border:
                      "1px solid #bfdbfe",
                    borderRadius:
                      "10px",
                    padding: "12px",
                    marginBottom:
                      "18px",
                    color:
                      "#1e40af",
                    fontSize:
                      "13px",
                  }}
                >
                  The interaction has
                  been opened. Record
                  what happened below so
                  the CRM keeps a complete
                  communication history.
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "17px",
                  }}
                >
                  <div>
                    <label
                      style={
                        labelStyle
                      }
                    >
                      Communication
                      Outcome *
                    </label>

                    <select
                      value={
                        activityOutcome
                      }
                      onChange={(e) =>
                        setActivityOutcome(
                          e.target.value
                        )
                      }
                      style={
                        inputStyle
                      }
                    >
                      <option value="">
                        Select outcome...
                      </option>

                      {outcomeOptions.map(
                        (outcome) => (
                          <option
                            key={
                              outcome
                            }
                            value={
                              outcome
                            }
                          >
                            {outcome}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label
                      style={
                        labelStyle
                      }
                    >
                      Feedback / Notes
                    </label>

                    <textarea
                      value={
                        activityFeedback
                      }
                      onChange={(e) =>
                        setActivityFeedback(
                          e.target
                            .value
                        )
                      }
                      placeholder="What did the student say? What are their concerns, interests or next steps?"
                      rows={5}
                      style={{
                        ...inputStyle,
                        resize:
                          "vertical",
                        minHeight:
                          "120px",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={
                        labelStyle
                      }
                    >
                      Next Follow Up
                    </label>

                    <input
                      type="datetime-local"
                      value={
                        nextFollowUp
                      }
                      onChange={(e) =>
                        setNextFollowUp(
                          e.target
                            .value
                        )
                      }
                      style={
                        inputStyle
                      }
                    />

                    <div
                      style={{
                        marginTop:
                          "6px",
                        color:
                          "#64748b",
                        fontSize:
                          "12px",
                      }}
                    >
                      Leave blank if no
                      follow-up is
                      required. For
                      automatic outcomes,
                      the CRM will create
                      the next task
                      automatically.
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "flex-end",
                    gap: "10px",
                    marginTop:
                      "24px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setShowActivityModal(
                        false
                      )
                    }
                    disabled={
                      savingActivity
                    }
                    style={
                      secondaryButtonStyle
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleSaveActivity
                    }
                    disabled={
                      savingActivity
                    }
                    style={{
                      ...primaryButtonStyle,
                      background:
                        savingActivity
                          ? "#93c5fd"
                          : "#2563eb",
                      cursor:
                        savingActivity
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {savingActivity
                      ? "Saving..."
                      : "Save Interaction"}
                  </button>
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
                  maxWidth: "800px",
                  maxHeight: "90vh",
                  overflowY: "auto",
                  background:
                    "#ffffff",
                  borderRadius:
                    "16px",
                  padding: "24px",
                  boxShadow:
                    "0 25px 60px rgba(15, 23, 42, 0.25)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "flex-start",
                    gap: "16px",
                    marginBottom:
                      "20px",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize:
                          "22px",
                        fontWeight:
                          800,
                      }}
                    >
                      Communication
                      History
                    </h2>

                    <p
                      style={{
                        margin:
                          "6px 0 0",
                        color:
                          "#64748b",
                        fontSize:
                          "13px",
                      }}
                    >
                      {historyLead.name ||
                        "Lead"}{" "}
                      {historyLead.phone
                        ? `â€¢ ${historyLead.phone}`
                        : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setShowHistoryModal(
                        false
                      )
                    }
                    style={
                      closeButtonStyle
                    }
                  >
                    Ã—
                  </button>
                </div>

                {loadingHistory ? (
                  <div
                    style={{
                      padding:
                        "45px",
                      textAlign:
                        "center",
                      color:
                        "#64748b",
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
                      padding:
                        "40px",
                      textAlign:
                        "center",
                      background:
                        "#f8fafc",
                      borderRadius:
                        "10px",
                      color:
                        "#64748b",
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
                      display:
                        "grid",
                      gap: "12px",
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
                              "1px solid #e2e8f0",
                            borderRadius:
                              "12px",
                            padding:
                              "15px",
                            background:
                              "#ffffff",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap:
                                "15px",
                              flexWrap:
                                "wrap",
                              marginBottom:
                                "8px",
                            }}
                          >
                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap:
                                  "9px",
                              }}
                            >
                              <span
                                style={{
                                  padding:
                                    "5px 9px",
                                  borderRadius:
                                    "999px",
                                  background:
                                    activity.type ===
                                    "call"
                                      ? "#dbeafe"
                                      : activity.type ===
                                        "whatsapp"
                                      ? "#dcfce7"
                                      : "#fef3c7",
                                  color:
                                    activity.type ===
                                    "call"
                                      ? "#1d4ed8"
                                      : activity.type ===
                                        "whatsapp"
                                      ? "#166534"
                                      : "#92400e",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    800,
                                  textTransform:
                                    "uppercase",
                                }}
                              >
                                {
                                  activity.type
                                }
                              </span>

                              <strong
                                style={{
                                  fontSize:
                                    "14px",
                                }}
                              >
                                {
                                  activity.subject
                                }
                              </strong>
                            </div>

                            <span
                              style={{
                                color:
                                  "#64748b",
                                fontSize:
                                  "12px",
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
                                  "#475569",
                                fontSize:
                                  "13px",
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
              onClick={(e) =>
                e.stopPropagation()
              }
              style={{
                width: "100%",
                maxWidth: "650px",
                maxHeight: "90vh",
                overflowY: "auto",
                background:
                  "#ffffff",
                borderRadius:
                  "16px",
                padding: "24px",
                boxShadow:
                  "0 25px 60px rgba(15, 23, 42, 0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  marginBottom:
                    "20px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize:
                        "22px",
                      fontWeight:
                        800,
                    }}
                  >
                    Add New Lead
                  </h2>

                  <p
                    style={{
                      margin:
                        "5px 0 0",
                      color:
                        "#64748b",
                      fontSize:
                        "13px",
                    }}
                  >
                    Add a new
                    prospective
                    student to the
                    CRM.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowAddLead(
                      false
                    )
                  }
                  style={
                    closeButtonStyle
                  }
                >
                  Ã—
                </button>
              </div>

              <form
                onSubmit={
                  handleAddLead
                }
              >
                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: "16px",
                  }}
                >
                  <FormField
                    label="CIU Number"
                    value={
                      newLead.ciu_number
                    }
                    onChange={(
                      value
                    ) =>
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
                    onChange={(
                      value
                    ) =>
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
                    onChange={(
                      value
                    ) =>
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
                    onChange={(
                      value
                    ) =>
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
                    onChange={(
                      value
                    ) =>
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
                      Status
                    </label>

                    <select
                      value={
                        newLead.status
                      }
                      onChange={(e) =>
                        setNewLead({
                          ...newLead,
                          status:
                            e.target
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

                      <option value="converted">
                        Converted
                      </option>

                      <option value="lost">
                        Lost Leads
                      </option>
                    </select>
                  </div>

                  <FormField
                    label="Follow Up Status"
                    value={
                      newLead.follow_up_status
                    }
                    onChange={(
                      value
                    ) =>
                      setNewLead({
                        ...newLead,
                        follow_up_status:
                          value,
                      })
                    }
                    placeholder="e.g. Call tomorrow"
                  />

                  <div>
                    <label
                      style={
                        labelStyle
                      }
                    >
                      Next Follow Up
                    </label>

                    <input
                      type="datetime-local"
                      value={
                        newLead.next_follow_up_at
                      }
                      onChange={(e) =>
                        setNewLead({
                          ...newLead,
                          next_follow_up_at:
                            e.target
                              .value,
                        })
                      }
                      style={
                        inputStyle
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "flex-end",
                    gap: "10px",
                    marginTop:
                      "24px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setShowAddLead(
                        false
                      )
                    }
                    style={
                      secondaryButtonStyle
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      ...primaryButtonStyle,
                      background:
                        saving
                          ? "#93c5fd"
                          : "#2563eb",
                      cursor:
                        saving
                          ? "not-allowed"
                          : "pointer",
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

function KpiCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        background:
          "#ffffff",
        border:
          "1px solid #e5e7eb",
        borderRadius:
          "14px",
        padding: "18px",
      }}
    >
      <div
        style={{
          color: "#64748b",
          fontSize: "13px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "28px",
          fontWeight: 800,
          marginTop: "5px",
        }}
      >
        {value}
      </div>
    </div>
  );
}

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
        alignItems:
          "center",
        justifyContent:
          "center",
        padding: "20px",
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) =>
          e.stopPropagation()
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

const thStyle: React.CSSProperties = {
  padding: "13px 14px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 800,
  color: "#64748b",
  letterSpacing: "0.04em",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px",
  fontSize: "13px",
  color: "#334155",
  verticalAlign: "middle",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  fontWeight: 700,
  color: "#334155",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  background: "#ffffff",
  color: "#172033",
  fontSize: "14px",
  outline: "none",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "11px 18px",
  border: "1px solid #2563eb",
  borderRadius: "9px",
  background: "#2563eb",
  color: "#ffffff",
  fontWeight: 700,
  cursor: "pointer",
  visibility: "visible",
  opacity: 1,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "11px 17px",
  border: "1px solid #cbd5e1",
  borderRadius: "9px",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 700,
  cursor: "pointer",
  visibility: "visible",
  opacity: 1,
};

const closeButtonStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  cursor: "pointer",
  fontSize: "18px",
  color: "#64748b",
};

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label style={labelStyle}>
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}
