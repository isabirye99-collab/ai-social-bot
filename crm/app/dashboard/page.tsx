"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { CrmRole } from "@/lib/permissions";

type Lead = {
  id: string;
  assigned_to: string | null;
  status: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

type Opportunity = {
  id: string;
  assigned_to: string | null;
  value: number | null;
  status: string | null;
  probability: number | null;
  stage_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PipelineStage = {
  id: string;
  name: string;
  position: number;
  probability: number | null;
  is_won: boolean | null;
  is_lost: boolean | null;
};

type Task = {
  id: string;
  assigned_to: string | null;
  due_at: string | null;
  status: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: CrmRole | null;
};

function sameDay(
  dateValue: string | null | undefined,
  reference = new Date(),
) {
  if (!dateValue) return false;

  const date = new Date(dateValue);

  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

function isThisMonth(dateValue: string | null | undefined) {
  if (!dateValue) return false;

  const date = new Date(dateValue);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(value);
}

function percentage(value: number) {
  return `${Math.round(value)}%`;
}

function normalizeStageName(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function Icon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );

    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      );

    case "briefcase":
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="2" />
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M3 12h18" />
        </svg>
      );

    case "trend":
      return (
        <svg {...common}>
          <path d="M3 17l6-6 4 4 7-8" />
          <path d="M14 7h6v6" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h13" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8.1 8.1 0 0 0-14.8-4L3 10" />
          <path d="M3 4v6h6" />
          <path d="M4 13a8.1 8.1 0 0 0 14.8 4L21 14" />
          <path d="M21 20v-6h-6" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );

    case "student":
      return (
        <svg {...common}>
          <path d="m3 9 9-5 9 5-9 5-9-5Z" />
          <path d="M7 11v5c2.5 2 7.5 2 10 0v-5" />
          <path d="M21 9v6" />
        </svg>
      );

    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h17" />
          <path d="m7 15 4-4 3 2 5-6" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );

    case "bolt":
      return (
        <svg {...common}>
          <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />
        </svg>
      );

    case "alert":
      return (
        <svg {...common}>
          <path d="M10.3 3.8 2.5 17a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "layers":
      return (
        <svg {...common}>
          <path d="m12 3 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 16 9 5 9-5" />
        </svg>
      );

    default:
      return null;
  }
}

export default function DashboardPage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pipelineStages, setPipelineStages] = useState<
    PipelineStage[]
  >([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [admissions, setAdmissions] = useState<
    { id: string; assigned_to: string | null; stage: string | null; enrolled_at: string | null }[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired. Please sign in again.",
        );
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id,full_name,role")
        .eq("id", user.id)
        .maybeSingle();

      const currentProfile = profileData as Profile | null;

      setProfile(currentProfile);

      const salesperson =
        currentProfile?.role === "salesperson";

      const assignedFilter = (query: any) => {
        if (salesperson) {
          return query.eq("assigned_to", user.id);
        }

        return query;
      };

      const leadsQuery = assignedFilter(
        supabase
          .from("leads")
          .select(
            "id,assigned_to,status,next_follow_up_at,created_at",
          ),
      );

      const opportunitiesQuery = assignedFilter(
        supabase
          .from("opportunities")
          .select(
            "id,assigned_to,value,status,probability,stage_id,created_at,updated_at",
          ),
      );

      const pipelineStagesQuery = supabase
        .from("pipeline_stages")
        .select(
          "id,name,position,probability,is_won,is_lost",
        )
        .order("position", {
          ascending: true,
        });

      const tasksQuery = assignedFilter(
        supabase
          .from("tasks")
          .select("id,assigned_to,due_at,status"),
      );

      const admissionsQuery = assignedFilter(
        supabase
          .from("admissions")
          .select("id,assigned_to,stage,enrolled_at"),
      );

      const [
        leadsResult,
        opportunitiesResult,
        pipelineStagesResult,
        tasksResult,
        admissionsResult,
      ] = await Promise.all([
        leadsQuery,
        opportunitiesQuery,
        pipelineStagesQuery,
        tasksQuery,
        admissionsQuery,
      ]);

      if (leadsResult.error) {
        throw leadsResult.error;
      }

      if (opportunitiesResult.error) {
        throw opportunitiesResult.error;
      }

      if (pipelineStagesResult.error) {
        throw pipelineStagesResult.error;
      }

      if (admissionsResult.error) {
        throw admissionsResult.error;
      }

      if (tasksResult.error) {
        throw tasksResult.error;
      }

      setLeads((leadsResult.data || []) as Lead[]);

      setOpportunities(
        (opportunitiesResult.data || []) as Opportunity[],
      );

      setPipelineStages(
        (pipelineStagesResult.data || []) as PipelineStage[],
      );

      setTasks((tasksResult.data || []) as Task[]);
      setAdmissions(admissionsResult.data || []);
    } catch (err: any) {
      console.error("Dashboard loading error:", err);

      setError(
        err?.message || "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  function getStageName(stageId: string | null) {
    if (!stageId) return "";

    const stage = pipelineStages.find(
      (item) => item.id === stageId,
    );

    return normalizeStageName(stage?.name);
  }

  function opportunityIsInStage(
    opportunity: Opportunity,
    stageName: string,
  ) {
    const actual = getStageName(opportunity.stage_id);
    const expected = normalizeStageName(stageName);

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

    return aliases[expected]?.includes(actual) ?? false;
  }

  const stats = useMemo(() => {
    const openDeals = opportunities.filter(
      (item) =>
        item.status !== "closed" &&
        item.status !== "lost",
    );

    const applied = opportunities.filter((item) =>
      opportunityIsInStage(item, "Applied"),
    );

    const applicationFeePaid = opportunities.filter((item) =>
      opportunityIsInStage(
        item,
        "Paid Application Fee",
      ),
    );

    const acceptanceFeePaid = opportunities.filter((item) =>
      opportunityIsInStage(
        item,
        "Paid Acceptance Fee",
      ),
    );

    const enrolledOpportunities = opportunities.filter(
      (item) =>
        opportunityIsInStage(item, "Enrolled") &&
        (item.status === "won" ||
          item.status === "open"),
    );

    const weightedForecast = openDeals.reduce(
      (total, item) => {
        const value = Number(item.value) || 0;
        const probability =
          Number(item.probability) || 0;

        return (
          total +
          value * (probability / 100)
        );
      },
      0,
    );

    const followUpsDue = leads.filter((lead) => {
      if (!lead.next_follow_up_at) {
        return false;
      }

      return (
        new Date(lead.next_follow_up_at) <=
        new Date()
      );
    }).length;

    const tasksToday = tasks.filter(
      (task) =>
        sameDay(task.due_at) &&
        task.status !== "completed" &&
        task.status !== "done",
    ).length;

    const interested = leads.filter(
      (lead) =>
        lead.status === "qualified" ||
        lead.status === "interested",
    ).length;

    const enrolled = enrolledOpportunities.length;

    const completedTasks = tasks.filter(
      (task) =>
        task.status === "completed" ||
        task.status === "done",
    ).length;

    const newLeads = leads.filter((lead) =>
      isThisMonth(lead.created_at),
    ).length;

    const monthlyEnrolled = admissions.filter(
      (admission) =>
        (admission.stage || "").toLowerCase() === "enrolled" &&
        isThisMonth(admission.enrolled_at),
    ).length;

    const conversionRate =
      newLeads > 0
        ? (monthlyEnrolled / newLeads) * 100
        : 0;

    const pipelineValue = openDeals.reduce(
      (sum, item) =>
        sum + (Number(item.value) || 0),
      0,
    );

    const averageDeal =
      openDeals.length > 0
        ? pipelineValue / openDeals.length
        : 0;

    return {
      openDeals: openDeals.length,
      applied: applied.length,
      applicationFeePaid:
        applicationFeePaid.length,
      acceptanceFeePaid:
        acceptanceFeePaid.length,
      weightedForecast,
      followUpsDue,
      tasksToday,
      interested,
      enrolled,
      completedTasks,
      newLeads,
      conversionRate,
      pipelineValue,
      averageDeal,
      monthlyEnrolled,
    };
  }, [
    leads,
    opportunities,
    pipelineStages,
    tasks,
  ]);

  const funnel = useMemo(() => {
    const stages = [
      {
        label: "Leads",
        value: leads.length,
        color: "#075442",
      },
      {
        label: "Applied / Admitted",
        value: stats.applied,
        color: "#28765f",
      },
      {
        label: "Application Fee Paid",
        value: stats.applicationFeePaid,
        color: "#65a82f",
      },
      {
        label: "Acceptance Fee Paid",
        value: stats.acceptanceFeePaid,
        color: "#83bd42",
      },
      {
        label: "Enrolled",
        value: stats.enrolled,
        color: "#9ad447",
      },
    ];

    const first = Math.max(
      stages[0].value,
      1,
    );

    return stages.map((stage) => ({
      ...stage,
      ratio: Math.min(
        100,
        (stage.value / first) * 100,
      ),
      conversion:
        stage.value > 0
          ? Math.round(
              (stage.value / first) * 100,
            )
          : 0,
    }));
  }, [
    leads.length,
    stats.applied,
    stats.applicationFeePaid,
    stats.acceptanceFeePaid,
    stats.enrolled,
  ]);

  const pipelineOverview = useMemo(() => {
    const stages = [
      {
        label: "Early pipeline",
        description: "Open opportunities",
        count: stats.openDeals,
        value: stats.pipelineValue,
      },
      {
        label: "Weighted forecast",
        description: "Probability adjusted",
        count: stats.openDeals,
        value: stats.weightedForecast,
      },
      {
        label: "Enrolled",
        description: "Successful admissions",
        count: stats.enrolled,
        value: 0,
      },
    ];

    const max = Math.max(
      stats.pipelineValue,
      stats.weightedForecast,
      1,
    );

    return stages.map((stage) => ({
      ...stage,
      width:
        stage.value > 0
          ? Math.max(
              8,
              (stage.value / max) * 100,
            )
          : stage.count > 0
            ? 12
            : 4,
    }));
  }, [
    stats.openDeals,
    stats.pipelineValue,
    stats.weightedForecast,
    stats.enrolled,
  ]);

  const performance = useMemo(() => {
    const monthLeads = leads.filter((lead) =>
      isThisMonth(lead.created_at),
    ).length;

    const monthInterested = leads.filter(
      (lead) =>
        isThisMonth(lead.created_at) &&
        (lead.status === "qualified" ||
          lead.status === "interested"),
    ).length;

    const monthEnrolled = admissions.filter(
      (admission) =>
        (admission.stage || "").toLowerCase() === "enrolled" &&
        isThisMonth(admission.enrolled_at),
    ).length;

    return {
      leads: monthLeads,
      interested: monthInterested,
      enrolled: monthEnrolled,
    };
  }, [
    leads,
    admissions,
    opportunities,
    pipelineStages,
  ]);

  const focusItems = [
    {
      label: "Follow-ups due",
      description:
        "Leads requiring immediate attention",
      value: stats.followUpsDue,
      href: "/leads",
      icon: "clock",
      tone: "amber",
    },
    {
      label: "Tasks today",
      description:
        "Outstanding work scheduled today",
      value: stats.tasksToday,
      href: "/tasks",
      icon: "calendar",
      tone: "green",
    },
    {
      label: "Interested leads",
      description:
        "Prospects ready for conversion",
      value: stats.interested,
      href: "/leads",
      icon: "target",
      tone: "lime",
    },
    {
      label: "Enrolled students",
      description:
        "Successful admissions",
      value: stats.enrolled,
      href: "/customers",
      icon: "student",
      tone: "dark",
    },
  ];

  const today = new Date();

  const currentHour = today.getHours();

  const greeting =
    currentHour < 12
      ? "Good morning"
      : currentHour < 17
        ? "Good afternoon"
        : "Good evening";

  const formattedDate =
    today.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const firstName = profile?.full_name
    ? profile.full_name.split(" ")[0]
    : "there";

  if (loading) {
    return (
      <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-20 rounded-2xl bg-white" />

          <div className="grid gap-px overflow-hidden rounded-2xl border bg-[#e7ece9] sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map(
              (_, index) => (
                <div
                  key={index}
                  className="h-28 bg-white"
                />
              ),
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.65fr_.85fr]">
            <div className="h-[410px] rounded-2xl bg-white" />
            <div className="h-[410px] rounded-2xl bg-white" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-80 rounded-2xl bg-white" />
            <div className="h-80 rounded-2xl bg-white" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1540px] px-4 py-5 sm:px-6 lg:px-8">
      {/* =====================================================
          DASHBOARD HEADER
      ===================================================== */}

      <header className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#8bc53f]" />

            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#718179]">
              CIU Admissions Dashboard
            </span>
          </div>

          <h1 className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#17211b] sm:text-[28px]">
            {greeting}, {firstName}
          </h1>

          <p className="mt-1 text-xs text-[#7d8b84]">
            Admissions, recruitment and business
            performance at a glance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl border border-[#e3e9e5] bg-white px-3 py-2.5 sm:flex">
            <Icon
              name="calendar"
              size={15}
            />

            <span className="text-[11px] font-semibold text-[#68776f]">
              {formattedDate}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              loadDashboard(true)
            }
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dce6e0] bg-white px-3.5 text-[11px] font-bold text-[#075442] shadow-sm transition hover:border-[#9ad447] hover:bg-[#f7fbf3] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            >
              <Icon
                name="refresh"
                size={14}
              />
            </span>

            {refreshing
              ? "Refreshing"
              : "Refresh"}
          </button>
        </div>
      </header>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#f0ccc7] bg-[#fff8f7] px-4 py-3.5 text-[#9d3127]">
          <Icon
            name="alert"
            size={18}
          />

          <div>
            <p className="text-xs font-bold">
              Dashboard data could not be loaded
            </p>

            <p className="mt-1 text-[11px]">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* =====================================================
          KPI STRIP
      ===================================================== */}

      <section className="mb-4 grid gap-px overflow-hidden rounded-2xl border border-[#e2e9e5] bg-[#e2e9e5] shadow-[0_4px_18px_rgba(20,50,40,.035)] sm:grid-cols-2 xl:grid-cols-5">
        {/* Total Leads */}

        <Link
          href="/leads"
          className="group bg-white p-4 transition hover:bg-[#fbfdfb]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#819087]">
              Total leads
            </span>

            <span className="text-[#075442]">
              <Icon
                name="users"
                size={17}
              />
            </span>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <span className="text-[27px] font-black tracking-[-0.04em] text-[#17211b]">
              {leads.length}
            </span>

            <span className="text-[10px] font-bold text-[#6d887a]">
              +{stats.newLeads} this month
            </span>
          </div>
        </Link>

        {/* Applied / Admitted */}

        <Link
          href="/pipeline"
          className="group bg-white p-4 transition hover:bg-[#fbfdfb]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#819087]">
              Applied / Admitted
            </span>

            <span className="text-[#28765f]">
              <Icon
                name="briefcase"
                size={17}
              />
            </span>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <span className="text-[27px] font-black tracking-[-0.04em] text-[#17211b]">
              {stats.applied}
            </span>

            <span className="text-[10px] font-semibold text-[#7b8982]">
              Applications
            </span>
          </div>
        </Link>

        {/* Application Fee Paid */}

        <Link
          href="/pipeline"
          className="group bg-white p-4 transition hover:bg-[#fbfdfb]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#819087]">
              Application Fee Paid
            </span>

            <span className="text-[#65a82f]">
              <Icon
                name="check"
                size={17}
              />
            </span>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <span className="text-[27px] font-black tracking-[-0.04em] text-[#17211b]">
              {stats.applicationFeePaid}
            </span>

            <span className="text-[10px] font-bold text-[#5f8e2b]">
              Fee paid
            </span>
          </div>
        </Link>

        {/* Acceptance Fee Paid */}

        <Link
          href="/pipeline"
          className="group bg-white p-4 transition hover:bg-[#fbfdfb]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#819087]">
              Acceptance Fee Paid
            </span>

            <span className="text-[#83bd42]">
              <Icon
                name="check"
                size={17}
              />
            </span>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <span className="text-[27px] font-black tracking-[-0.04em] text-[#17211b]">
              {stats.acceptanceFeePaid}
            </span>

            <span className="text-[10px] font-bold text-[#5f8e2b]">
              Fee paid
            </span>
          </div>
        </Link>

        {/* Enrolled */}

        <Link
          href="/customers"
          className="bg-[#075442] p-4 transition hover:bg-[#064b3b]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-[#b9d4c8]">
              Enrolled
            </span>

            <span className="text-[#a9d66b]">
              <Icon
                name="student"
                size={17}
              />
            </span>
          </div>

          <div className="mt-3 flex items-end justify-between">
            <span className="text-[27px] font-black tracking-[-0.04em] text-white">
              {stats.enrolled}
            </span>

            <span className="text-[10px] font-bold text-[#b9d4c8]">
              {stats.monthlyEnrolled} this month
            </span>
          </div>
        </Link>
      </section>

      {/* =====================================================
          MAIN WORKSPACE
      ===================================================== */}

      <section className="grid gap-4 lg:grid-cols-[1.65fr_.85fr]">
        {/* Admissions funnel */}

        <div className="rounded-2xl border border-[#e2e9e5] bg-white shadow-[0_4px_18px_rgba(20,50,40,.035)]">
          <div className="flex items-center justify-between border-b border-[#edf1ef] px-5 py-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#819087]">
                Student journey
              </p>

              <h2 className="mt-1 text-base font-black tracking-[-0.02em] text-[#17211b]">
                Admissions Funnel
              </h2>
            </div>

            <Link
              href="/pipeline"
              className="inline-flex items-center gap-1 text-[10px] font-bold text-[#075442] hover:text-[#5f8e2b]"
            >
              View pipeline

              <Icon
                name="arrow"
                size={12}
              />
            </Link>
          </div>

          <div className="p-5">
            <div className="grid gap-3 md:grid-cols-5">
              {funnel.map(
                (stage, index) => (
                  <div
                    key={stage.label}
                    className="relative"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold leading-tight text-[#68776f]">
                        {stage.label}
                      </span>

                      <span className="shrink-0 text-[9px] font-semibold text-[#9aa59f]">
                        {stage.conversion}%
                      </span>
                    </div>

                    <div className="relative h-[185px] overflow-hidden rounded-xl bg-[#f4f7f5]">
                      <div
                        className="absolute bottom-0 left-0 right-0 transition-all duration-500"
                        style={{
                          height: `${Math.max(
                            stage.ratio,
                            stage.value > 0
                              ? 18
                              : 5,
                          )}%`,
                          background:
                            stage.color,
                          opacity: 0.92,
                        }}
                      />

                      <div className="absolute inset-x-0 bottom-0 p-3">
                        <p className="text-2xl font-black tracking-[-0.04em] text-white drop-shadow-sm">
                          {stage.value}
                        </p>

                        <p className="text-[9px] font-semibold text-white/80">
                          students / records
                        </p>
                      </div>
                    </div>

                    {index <
                      funnel.length -
                        1 && (
                      <div className="absolute -right-2 top-[105px] z-10 hidden text-[#a5b2ab] md:block">
                        <Icon
                          name="arrow"
                          size={13}
                        />
                      </div>
                    )}
                  </div>
                ),
              )}
            </div>

            <div className="mt-5 grid grid-cols-3 border-t border-[#edf1ef] pt-4">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#8b9892]">
                  New this month
                </p>

                <p className="mt-1 text-lg font-black text-[#17211b]">
                  {stats.newLeads}
                </p>
              </div>

              <div className="border-l border-[#edf1ef] pl-4">
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#8b9892]">
                  Monthly enrolled
                </p>

                <p className="mt-1 text-lg font-black text-[#17211b]">
                  {stats.monthlyEnrolled}
                </p>
              </div>

              <div className="border-l border-[#edf1ef] pl-4">
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#8b9892]">
                  Conversion
                </p>

                <p className="mt-1 text-lg font-black text-[#075442]">
                  {percentage(
                    stats.conversionRate,
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Today's focus */}

        <div className="rounded-2xl border border-[#e2e9e5] bg-white shadow-[0_4px_18px_rgba(20,50,40,.035)]">
          <div className="flex items-center justify-between border-b border-[#edf1ef] px-5 py-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#819087]">
                Daily operations
              </p>

              <h2 className="mt-1 text-base font-black tracking-[-0.02em] text-[#17211b]">
                Today&apos;s Focus
              </h2>
            </div>

            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f0f7e7] text-[#5f8e2b]">
              <Icon
                name="bolt"
                size={15}
              />
            </span>
          </div>

          <div className="divide-y divide-[#edf1ef]">
            {focusItems.map(
              (item) => {
                const tone =
                  item.tone === "amber"
                    ? "bg-[#fff5e7] text-[#b87918]"
                    : item.tone ===
                        "lime"
                      ? "bg-[#f0f7e7] text-[#5f8e2b]"
                      : item.tone ===
                          "dark"
                        ? "bg-[#e8f5ef] text-[#075442]"
                        : "bg-[#eaf4f1] text-[#28765f]";

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center justify-between px-5 py-4 transition hover:bg-[#fbfdfb]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tone}`}
                      >
                        <Icon
                          name={item.icon}
                          size={16}
                        />
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-[#34433b]">
                          {item.label}
                        </p>

                        <p className="mt-0.5 truncate text-[9px] text-[#929e98]">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="ml-3 flex items-center gap-2">
                      <span className="text-lg font-black text-[#17211b]">
                        {item.value}
                      </span>

                      <Icon
                        name="chevron"
                        size={13}
                      />
                    </div>
                  </Link>
                );
              },
            )}
          </div>

          <div className="m-4 rounded-xl bg-[#075442] px-4 py-3">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#b8d4c8]">
              Immediate workload
            </p>

            <div className="mt-1 flex items-end justify-between">
              <p className="text-xl font-black text-white">
                {stats.followUpsDue +
                  stats.tasksToday}
              </p>

              <span className="text-[9px] font-semibold text-[#b8d4c8]">
                actions requiring attention
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          ANALYTICS ROW
      ===================================================== */}

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        {/* Pipeline overview */}

        <div className="rounded-2xl border border-[#e2e9e5] bg-white shadow-[0_4px_18px_rgba(20,50,40,.035)]">
          <div className="flex items-center justify-between border-b border-[#edf1ef] px-5 py-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#819087]">
                Revenue & admissions
              </p>

              <h2 className="mt-1 text-base font-black tracking-[-0.02em] text-[#17211b]">
                Pipeline Overview
              </h2>
            </div>

            <Link
              href="/reports"
              className="text-[10px] font-bold text-[#075442]"
            >
              Reports
            </Link>
          </div>

          <div className="p-5">
            <div className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f6f9f7] px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#84938b]">
                  Open value
                </p>

                <p className="mt-1 truncate text-lg font-black text-[#17211b]">
                  {money(
                    stats.pipelineValue,
                  )}
                </p>
              </div>

              <div className="rounded-xl bg-[#f6f9f7] px-4 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#84938b]">
                  Weighted forecast
                </p>

                <p className="mt-1 truncate text-lg font-black text-[#075442]">
                  {money(
                    stats.weightedForecast,
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {pipelineOverview.map(
                (stage, index) => (
                  <div key={stage.label}>
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-bold text-[#34433b]">
                          {stage.label}
                        </p>

                        <p className="mt-0.5 text-[9px] text-[#929e98]">
                          {stage.description}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-[11px] font-black text-[#17211b]">
                          {stage.value
                            ? money(
                                stage.value,
                              )
                            : stage.count}
                        </p>

                        <p className="text-[9px] text-[#929e98]">
                          {stage.count}{" "}
                          records
                        </p>
                      </div>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[#edf1ef]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${stage.width}%`,
                          background:
                            index === 0
                              ? "#075442"
                              : index ===
                                  1
                                ? "#65a82f"
                                : "#9ad447",
                        }}
                      />
                    </div>
                  </div>
                ),
              )}
            </div>

            <div className="mt-5 border-t border-[#edf1ef] pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-[#7f8e86]">
                  Average opportunity
                </span>

                <span className="text-[11px] font-black text-[#17211b]">
                  {money(
                    stats.averageDeal,
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance */}

        <div className="rounded-2xl border border-[#e2e9e5] bg-white shadow-[0_4px_18px_rgba(20,50,40,.035)]">
          <div className="flex items-center justify-between border-b border-[#edf1ef] px-5 py-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#819087]">
                Current month
              </p>

              <h2 className="mt-1 text-base font-black tracking-[-0.02em] text-[#17211b]">
                Recruitment Performance
              </h2>
            </div>

            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#e8f5ef] text-[#075442]">
              <Icon
                name="chart"
                size={16}
              />
            </span>
          </div>

          <div className="p-5">
            <div className="mb-6 flex items-end justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#87948e]">
                  Lead to enrolment
                </p>

                <p className="mt-1 text-3xl font-black tracking-[-0.05em] text-[#075442]">
                  {percentage(
                    stats.conversionRate,
                  )}
                </p>
              </div>

              <div className="text-right">
                <p className="text-[9px] font-semibold text-[#8c9993]">
                  {performance.leads}{" "}
                  leads
                </p>

                <p className="mt-1 text-[9px] font-semibold text-[#8c9993]">
                  {performance.enrolled}{" "}
                  enrolled
                </p>
              </div>
            </div>

            <div className="flex h-[145px] items-end gap-4 border-b border-l border-[#edf1ef] px-3 pb-0">
              {[
                {
                  label: "Leads",
                  value:
                    performance.leads,
                  color: "#075442",
                },
                {
                  label: "Interested",
                  value:
                    performance.interested,
                  color: "#65a82f",
                },
                {
                  label: "Enrolled",
                  value:
                    performance.enrolled,
                  color: "#9ad447",
                },
              ].map((bar) => {
                const max = Math.max(
                  performance.leads,
                  performance.interested,
                  performance.enrolled,
                  1,
                );

                const height =
                  bar.value > 0
                    ? Math.max(
                        12,
                        (bar.value /
                          max) *
                          100,
                      )
                    : 4;

                return (
                  <div
                    key={bar.label}
                    className="flex h-full flex-1 flex-col justify-end"
                  >
                    <div className="mb-1 text-center text-[9px] font-black text-[#55645c]">
                      {bar.value}
                    </div>

                    <div
                      className="mx-auto w-full max-w-[70px] rounded-t-lg transition-all duration-500"
                      style={{
                        height: `${height}%`,
                        background:
                          bar.color,
                      }}
                    />

                    <div className="mt-2 text-center text-[9px] font-bold text-[#7e8b85]">
                      {bar.label}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#e8eeea] px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#8a9791]">
                  Interested rate
                </p>

                <p className="mt-1 text-lg font-black text-[#5f8e2b]">
                  {performance.leads
                    ? percentage(
                        (performance.interested /
                          performance.leads) *
                          100,
                      )
                    : "0%"}
                </p>
              </div>

              <div className="rounded-xl border border-[#e8eeea] px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-[#8a9791]">
                  Enrolment rate
                </p>

                <p className="mt-1 text-lg font-black text-[#075442]">
                  {performance.leads
                    ? percentage(
                        (performance.enrolled /
                          performance.leads) *
                          100,
                      )
                    : "0%"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          LOWER WORKSPACE
      ===================================================== */}

      <section className="mt-4 grid gap-4 md:grid-cols-3">
        <Link
          href="/leads"
          className="group flex items-center justify-between rounded-xl border border-[#e2e9e5] bg-white px-4 py-3.5 shadow-[0_3px_14px_rgba(20,50,40,.025)] transition hover:border-[#b9d9a1] hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f5ef] text-[#075442]">
              <Icon
                name="users"
                size={16}
              />
            </span>

            <div>
              <p className="text-[11px] font-bold text-[#34433b]">
                Manage leads
              </p>

              <p className="mt-0.5 text-[9px] text-[#929e98]">
                Review prospects and
                follow-ups
              </p>
            </div>
          </div>

          <Icon
            name="chevron"
            size={13}
          />
        </Link>

        <Link
          href="/pipeline"
          className="group flex items-center justify-between rounded-xl border border-[#e2e9e5] bg-white px-4 py-3.5 shadow-[0_3px_14px_rgba(20,50,40,.025)] transition hover:border-[#b9d9a1] hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f0f7e7] text-[#5f8e2b]">
              <Icon
                name="layers"
                size={16}
              />
            </span>

            <div>
              <p className="text-[11px] font-bold text-[#34433b]">
                Manage pipeline
              </p>

              <p className="mt-0.5 text-[9px] text-[#929e98]">
                Move applications through
                stages
              </p>
            </div>
          </div>

          <Icon
            name="chevron"
            size={13}
          />
        </Link>

        <Link
          href="/reports"
          className="group flex items-center justify-between rounded-xl border border-[#e2e9e5] bg-white px-4 py-3.5 shadow-[0_3px_14px_rgba(20,50,40,.025)] transition hover:border-[#b9d9a1] hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eaf4f1] text-[#28765f]">
              <Icon
                name="chart"
                size={16}
              />
            </span>

            <div>
              <p className="text-[11px] font-bold text-[#34433b]">
                View reports
              </p>

              <p className="mt-0.5 text-[9px] text-[#929e98]">
                Analyse admissions
                performance
              </p>
            </div>
          </div>

          <Icon
            name="chevron"
            size={13}
          />
        </Link>
      </section>

      {/* =====================================================
          FOOTER
      ===================================================== */}

      <footer className="flex flex-col items-center justify-between gap-2 px-1 py-5 sm:flex-row">
        <p className="text-[9px] font-medium text-[#a0aaa5]">
          CIU Admissions & Business Management
          System
        </p>

        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7fbe3b]" />

          <span className="text-[9px] font-semibold text-[#89958f]">
            System connected
          </span>

          <span className="text-[#c4cbc7]">
            â€¢
          </span>

          <span className="text-[9px] text-[#89958f]">
            {stats.completedTasks} tasks
            completed
          </span>
        </div>
      </footer>
    </div>
  );
}






