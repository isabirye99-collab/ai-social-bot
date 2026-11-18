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
  assigned_to: string | null;
  created_at: string;
  organization_id?: string | null;
  contact_id?: string | null;
  school_id?: string | null;
  intake_year?: number | null;
  intake_month?: number | null;
  original_intake_year?: number | null;
  original_intake_month?: number | null;
};

type SchoolOption = { id: string; school_name: string; district: string | null };

type Activity = {
  id: string;
  lead_id: string | null;
  type: string;
  subject: string;
  description: string | null;
  activity_at: string;
  created_by: string | null;
};

const displayStatuses = [
  "Pending",
  "Called",
  "WhatsApped",
  "Email sent",
  "Interested",
  "Follow up later",
  "Not interested",
  "Financial issues",
  "Lost Leads",
  "Dropped",
  "Ineffective Data",
  "Unreachable",
  "No Answer",
  "Applied/Admitted",
];

const statusMap: Record<string, string> = {
  new: "Pending",
  pending: "Pending",
  contacted: "Called",
  called: "Called",
  whatsapped: "WhatsApped",
  email_sent: "Email sent",
  "email sent": "Email sent",
  qualified: "Interested",
  interested: "Interested",
  follow_up_later: "Follow up later",
  "follow up later": "Follow up later",
  unqualified: "Not interested",
  financial: "Financial issues",
  "financial issues": "Financial issues",
  lost: "Lost Leads",
  dropped: "Dropped",
  ineffective: "Ineffective Data",
  unreachable: "Unreachable",
  "no answer": "No Answer",
  converted: "Applied/Admitted",
};

function getDisplayStatus(status: string | null) {
  if (!status) return "Pending";

  return (
    statusMap[status.toLowerCase()] ||
    status ||
    "Pending"
  );
}

function formatDate(date: string | null) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: string | null) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusIsQualified(status: string | null) {
  return getDisplayStatus(status) === "Interested";
}

function statusIsClosed(status: string | null) {
  return [
    "Not interested",
    "Financial issues",
    "Lost Leads",
    "Dropped",
    "Ineffective Data",
    "Unreachable",
    "No Answer",
  ].includes(getDisplayStatus(status));
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
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [csvSummary, setCsvSummary] = useState("");

  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedLead, setSelectedLead] =
    useState<Lead | null>(null);
  const [intakeDraftYear, setIntakeDraftYear] = useState("2027");
  const [intakeDraftMonth, setIntakeDraftMonth] = useState("2");
  const [intakeChangeReason, setIntakeChangeReason] = useState("");
  const [savingIntake, setSavingIntake] = useState(false);

  const [showHistoryModal, setShowHistoryModal] =
    useState(false);
  const [historyLead, setHistoryLead] =
    useState<Lead | null>(null);

  const [activities, setActivities] =
    useState<Activity[]>([]);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [qualifyingLeadId, setQualifyingLeadId] =
    useState<string | null>(null);

  const [schools, setSchools] = useState<SchoolOption[]>([]);

  const [newLead, setNewLead] = useState({
    school_id: "",
    ciu_number: "",
    name: "",
    phone: "",
    email: "",
    product_service: "",
    intake_year: "",
    intake_month: "",
    status: "new",
  });

  const [currentUserId, setCurrentUserId] =
    useState("");

  const [currentRole, setCurrentRole] =
    useState("");
  const [selectedIntake, setSelectedIntake] = useState("2026-11");

  useEffect(() => {
    if (selectedLead) {
      setIntakeDraftYear(String(selectedLead.intake_year || 2027));
      setIntakeDraftMonth(String(selectedLead.intake_month || 2));
    }
  }, [selectedLead]);

  async function loadLeads() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be signed in to view leads."
        );
      }

      setCurrentUserId(user.id);

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const role = profile?.role || "";

      setCurrentRole(role);

      let query = supabase
        .from("leads")
        .select(`
          id,
          ciu_number,
          name,
          phone,
          email,
          product_service,
          status,
          follow_up_status,
          next_follow_up_at,
          assigned_to,
          created_at,
          organization_id,
          contact_id,
          school_id,
          intake_year,
          intake_month,
          original_intake_year,
          original_intake_month
        `)
        .order("created_at", {
          ascending: false,
        });

      if (role === "salesperson") {
        query = query.eq(
          "assigned_to",
          user.id
        );
      }

      const {
        data,
        error,
      } = await query;

      if (error) {
        throw error;
      }

      setLeads(
        (data || []) as Lead[]
      );

      // School linking is optional; a school-list failure must not block lead management.
      const { data: schoolData } = await supabase
        .from("schools")
        .select("id, school_name, district")
        .order("school_name", { ascending: true });
      setSchools((schoolData || []) as SchoolOption[]);
    } catch (err) {
      console.error(
        "Leads loading error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load leads."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const programs = useMemo(() => {
    const values = leads
      .map(
        (lead) =>
          lead.product_service
      )
      .filter(Boolean) as string[];

    return Array.from(
      new Set(values)
    ).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    const [intakeYear, intakeMonth] = selectedIntake.split("-").map(Number);
    return leads.filter((lead) => {
      if (lead.intake_year !== intakeYear || lead.intake_month !== intakeMonth) return false;
      const displayStatus =
        getDisplayStatus(
          lead.status
        );

      const matchesSearch =
        !query ||
        [
          lead.ciu_number,
          lead.name,
          lead.phone,
          lead.email,
          lead.product_service,
          schools.find((school) => school.id === lead.school_id)?.school_name,
          displayStatus,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          );

      const matchesStatus =
        statusFilter === "All" ||
        displayStatus === statusFilter;

      const matchesProgram =
        programFilter === "All" ||
        (lead.product_service || "") ===
          programFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesProgram
      );
    });
  }, [
    leads,
    search,
    statusFilter,
    programFilter,
    schools,
  ]);

  const activeLeads = leads.filter(
    (lead) =>
      !statusIsClosed(
        lead.status
      )
  ).length;

  const interestedLeads =
    leads.filter((lead) =>
      statusIsQualified(
        lead.status
      )
    ).length;

  const closedLeads =
    leads.filter((lead) =>
      statusIsClosed(
        lead.status
      )
    ).length;

  async function handleAddLead(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (
      !newLead.name.trim() ||
      !newLead.phone.trim()
    ) {
      alert(
        "Please enter the student's name and telephone number."
      );
      return;
    }

    try {
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You must be signed in to add a lead."
        );
      }

      let assignedSalespersonId =
        user.id;

      if (
        currentRole !==
        "salesperson"
      ) {
        const {
          data: salespeople,
          error:
            salespersonError,
        } = await supabase
          .from("profiles")
          .select(
            "id, full_name"
          )
          .eq(
            "role",
            "salesperson"
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "full_name",
            {
              ascending: true,
            }
          );

        if (salespersonError) {
          throw salespersonError;
        }

        if (
          !salespeople ||
          salespeople.length === 0
        ) {
          throw new Error(
            "No active salesperson is available to receive this lead."
          );
        }

        const ids =
          salespeople.map(
            (person) =>
              person.id
          );

        const {
          data: assignedLeads,
          error:
            assignedLeadsError,
        } = await supabase
          .from("leads")
          .select(
            "assigned_to"
          )
          .in(
            "assigned_to",
            ids
          );

        if (assignedLeadsError) {
          throw assignedLeadsError;
        }

        const counts =
          new Map<
            string,
            number
          >();

        ids.forEach((id) =>
          counts.set(id, 0)
        );

        (
          assignedLeads || []
        ).forEach((lead) => {
          if (
            lead.assigned_to
          ) {
            counts.set(
              lead.assigned_to,
              (counts.get(
                lead.assigned_to
              ) || 0) + 1
            );
          }
        });

        const selected =
          salespeople.reduce(
            (
              current,
              person
            ) => {
              const currentCount =
                counts.get(
                  current.id
                ) || 0;

              const personCount =
                counts.get(
                  person.id
                ) || 0;

              return personCount <
                currentCount
                ? person
                : current;
            },
            salespeople[0]
          );

        assignedSalespersonId =
          selected.id;
      }

      const {
        error,
      } = await supabase
        .from("leads")
        .insert({
          ciu_number:
            newLead.ciu_number.trim() ||
            null,

          name:
            newLead.name.trim(),

          phone:
            newLead.phone.trim(),

          email:
            newLead.email.trim() ||
            null,

          product_service:
            newLead.product_service.trim() ||
            null,

          intake_year: newLead.intake_year ? Number(newLead.intake_year) : null,
          intake_month: newLead.intake_month ? Number(newLead.intake_month) : null,
          original_intake_year: newLead.intake_year ? Number(newLead.intake_year) : null,
          original_intake_month: newLead.intake_month ? Number(newLead.intake_month) : null,

          school_id: newLead.school_id || null,

          status:
            newLead.status,

          follow_up_status:
            "Pending",

          next_follow_up_at:
            null,

          assigned_to:
            assignedSalespersonId,
        });

      if (error) {
        throw error;
      }

      setNewLead({
        school_id: "",
        ciu_number: "",
        name: "",
        phone: "",
        email: "",
        product_service: "",
        intake_year: "",
        intake_month: "",
        status: "new",
      });

      setShowAddLead(false);

      await loadLeads();

      alert(
        currentRole ===
          "salesperson"
          ? "Lead added successfully and assigned to you."
          : "Lead added successfully and assigned to a salesperson."
      );
    } catch (err) {
      console.error(
        "Add lead error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Failed to add lead."
      );
    } finally {
      setSaving(false);
    }
  }

  function parseLeadCsv(text: string): string[][] {
    const rows: string[][] = []; let row: string[] = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) { const ch = text[i];
      if (ch === '"' && quoted && text[i + 1] === '"' ) { cell += '"' ; i++; }
      else if (ch === '"' ) quoted = !quoted;
      else if (ch === "," && !quoted) { row.push(cell.trim()); cell = ""; }
      else if ((ch === "\n" || ch === "\r") && !quoted) { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell.trim()); if (row.some((v) => v !== "")) rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    row.push(cell.trim()); if (row.some((v) => v !== "")) rows.push(row); return rows;
  }

  async function handleLeadCsvUpload(file?: File) {
    if (!file) return; setUploadingCsv(true); setCsvSummary(""); setError("");
    try {
      if (!file.name.toLowerCase().endsWith(".csv")) throw new Error("Please choose a .csv file.");
      if (file.size > 10 * 1024 * 1024) throw new Error("CSV must be 10 MB or smaller.");
      const parsed = parseLeadCsv(await file.text()); if (parsed.length < 2) throw new Error("The CSV has no data rows.");
      const headers = parsed[0].map((h) => h.replace(/^\uFEFF/, "").toLowerCase().replace(/[ _-]+/g, "").trim());
      const findColumn = (...names: string[]) => headers.findIndex((h) => names.includes(h));
      const ni = findColumn("name", "fullname", "studentname", "leadname"), pi = findColumn("phone", "telephone", "phonenumber", "mobile", "contact"), ei = findColumn("email", "emailaddress"), ci = findColumn("ciunumber", "studentnumber", "studentno", "registrationnumber"), gi = findColumn("program", "programme", "productservice", "course"), si = findColumn("status", "leadstatus"), iyi = findColumn("intakeyear", "recruitmentyear"), imi = findColumn("intakemonth", "recruitmentmonth");
      if (ni < 0 || pi < 0) throw new Error("CSV needs Name and Phone columns. Optional: Email, CIU Number, Programme, Status.");
      const csvLeadStatusMap: Record<string, string> = { new: "new", pending: "new", contacted: "contacted", called: "contacted", whatsapped: "contacted", whatsapp: "contacted", email_sent: "contacted", "no_answer": "contacted", unreachable: "contacted", financial: "contacted", interested: "qualified", qualified: "qualified", unqualified: "unqualified", "not_interested": "unqualified", lost: "lost", dropped: "lost", ineffective: "unqualified" };
      const candidates: any[] = []; let invalid = 0;
      parsed.slice(1).forEach((cells) => { const v = (n: number) => n < 0 ? "" : String(cells[n] || "").trim(); const name = v(ni), phone = v(pi), email = v(ei); if (!name || !phone) { invalid++; return; } const raw = v(si).toLowerCase().replace(/[ -]+/g, "_"); const programme = v(gi) || null; const normalizedProgramme = (programme || "").trim().toUpperCase(); const isNovember = normalizedProgramme === "PGDME" || normalizedProgramme === "MPH" || normalizedProgramme.startsWith("HEC") || normalizedProgramme.includes("ALLIED HEALTH"); const explicitYear = Number(v(iyi)), explicitMonthRaw = v(imi).toLowerCase(); const monthNames: Record<string, number> = { february: 2, feb: 2, april: 4, apr: 4, august: 8, aug: 8, november: 11, nov: 11 }; const explicitMonth = Number(explicitMonthRaw) || monthNames[explicitMonthRaw] || 0; const defaultYear = isNovember ? 2026 : 2027; const defaultMonth = isNovember ? 11 : 2; const intakeYear = explicitYear >= 2020 && explicitYear <= 2100 ? explicitYear : programme ? defaultYear : null; const intakeMonth = [2,4,8,11].includes(explicitMonth) ? explicitMonth : programme ? defaultMonth : null; candidates.push({ name, phone, email: email || null, ciu_number: v(ci) || null, product_service: programme, intake_year: intakeYear, intake_month: intakeMonth, original_intake_year: intakeYear, original_intake_month: intakeMonth, status: csvLeadStatusMap[raw] || "new", follow_up_status: raw ? raw.replace(/_/g, " ") : "Pending", next_follow_up_at: null, assigned_to: currentUserId || null }); });
      if (!candidates.length) throw new Error("No valid leads found. Name and Phone are required.");
      const existingPhones = new Set(leads.map((l) => (l.phone || "").replace(/\D/g, "")).filter(Boolean)); const existingEmails = new Set(leads.map((l) => (l.email || "").trim().toLowerCase()).filter(Boolean)); const seen = new Set<string>();
      const fresh = candidates.filter((lead) => { const p = lead.phone.replace(/\D/g, ""), e = (lead.email || "").trim().toLowerCase(); const keys = [p ? "p:" + p : "", e ? "e:" + e : ""].filter(Boolean); if (keys.some((k) => seen.has(k) || (k.startsWith("p:") ? existingPhones.has(k.slice(2)) : existingEmails.has(k.slice(2))))) return false; keys.forEach((k) => seen.add(k)); return true; });
      if (!fresh.length) { setCsvSummary("No new leads imported. All valid rows matched existing or repeated phone/email details; " + invalid + " invalid row(s)."); return; }
      for (let i = 0; i < fresh.length; i += 100) { const result = await supabase.from("leads").insert(fresh.slice(i, i + 100)); if (result.error) throw result.error; }
      await loadLeads(); setCsvSummary("Imported " + fresh.length + " lead(s). Skipped " + (candidates.length - fresh.length) + " duplicate/repeated row(s) and " + invalid + " invalid row(s). Leads are assigned to your account; reassign them after import if needed.");
    } catch (err) { setError(err instanceof Error ? err.message : "CSV import failed."); } finally { setUploadingCsv(false); }
  }

  function handleView(
    lead: Lead
  ) {
    setSelectedLead(lead);
    setShowViewModal(true);
  }

  async function openHistory(
    lead: Lead
  ) {
    if (
      currentRole ===
        "salesperson" &&
      lead.assigned_to !==
        currentUserId
    ) {
      alert(
        "You can only view history for leads assigned to you."
      );
      return;
    }

    setHistoryLead(lead);
    setActivities([]);
    setShowHistoryModal(true);
    setLoadingHistory(true);

    try {
      const {
        data,
        error,
      } = await supabase
        .from("activities")
        .select(`
          id,
          lead_id,
          type,
          subject,
          description,
          activity_at,
          created_by
        `)
        .eq(
          "lead_id",
          lead.id
        )
        .order(
          "activity_at",
          {
            ascending: false,
          }
        );

      if (error) {
        throw error;
      }

      setActivities(
        (data || []) as Activity[]
      );
    } catch (err) {
      console.error(
        "History error:",
        err
      );

      alert(
        err instanceof Error
          ? err.message
          : "Failed to load communication history."
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  async function qualifyLead(
    lead: Lead
  ) {
    if (
      currentRole ===
        "salesperson" &&
      lead.assigned_to !==
        currentUserId
    ) {
      alert(
        "You can only qualify leads assigned to you."
      );
      return;
    }

    if (
      !lead.organization_id
    ) {
      alert(
        "This lead does not have an organization ID. The Pipeline opportunity cannot be created yet."
      );
      return;
    }

    setQualifyingLeadId(
      lead.id
    );

    setError("");

    try {
      const {
        data: stages,
        error:
          stageError,
      } = await supabase
        .from("pipeline_stages")
        .select(
          "id, name, probability"
        )
        .order(
          "position",
          {
            ascending: true,
          }
        );

      if (stageError) {
        throw stageError;
      }

      const interestedStage =
        (stages || []).find(
          (stage) =>
            stage.name
              .trim()
              .toLowerCase() ===
            "interested"
        );

      if (
        !interestedStage
      ) {
        throw new Error(
          'The "Interested" Pipeline stage could not be found.'
        );
      }

      const {
        data:
          existingOpportunity,
        error:
          opportunityLookupError,
      } = await supabase
        .from("opportunities")
        .select(
          "id, stage_id, status"
        )
        .eq(
          "lead_id",
          lead.id
        )
        .maybeSingle();

      if (
        opportunityLookupError
      ) {
        throw opportunityLookupError;
      }

      if (
        existingOpportunity
      ) {
        const {
          error:
            opportunityUpdateError,
        } = await supabase
          .from("opportunities")
          .update({
            stage_id:
              interestedStage.id,

            probability:
              Number(
                interestedStage.probability ||
                  0
              ),

            status:
              "open",

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            existingOpportunity.id
          );

        if (
          opportunityUpdateError
        ) {
          throw opportunityUpdateError;
        }
      } else {
        const {
          error:
            opportunityCreateError,
        } = await supabase
          .from("opportunities")
          .insert({
            lead_id:
              lead.id,

            organization_id:
              lead.organization_id,

            contact_id:
              lead.contact_id ||
              null,

            title:
              lead.name ||
              "Unnamed Lead",

            value: 0,

            currency:
              "UGX",

            stage_id:
              interestedStage.id,

            status:
              "open",

            probability:
              Number(
                interestedStage.probability ||
                  0
              ),

            assigned_to:
              lead.assigned_to,

            notes:
              "Qualified from Leads and moved into the Pipeline at Interested stage.",
          });

        if (
          opportunityCreateError
        ) {
          throw opportunityCreateError;
        }
      }

      const {
        error:
          leadUpdateError,
      } = await supabase
        .from("leads")
        .update({
          status:
            "qualified",

          follow_up_status:
            "Moved to Pipeline",

          next_follow_up_at:
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          lead.id
        );

      if (leadUpdateError) {
        throw leadUpdateError;
      }

      await loadLeads();

      alert(
        `${lead.name || "Lead"} has been qualified and moved to the Interested stage in Pipeline.`
      );
    } catch (err) {
      console.error(
        "Qualify lead error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "The lead could not be moved to Pipeline."
      );
    } finally {
      setQualifyingLeadId(
        null
      );
    }
  }

  return (
    <div className="ciu-page">
      <div className="ciu-page-inner">

        {/* HEADER */}
        <div
          className="ciu-hero"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "#8bc63f",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Prospecting
            </div>

            <h1>
              {currentRole ===
              "salesperson"
                ? "My Leads"
                : "Leads"}
            </h1>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
              <label className="ciu-btn-light" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: uploadingCsv ? "wait" : "pointer", opacity: uploadingCsv ? 0.65 : 1 }}>
                {uploadingCsv ? "Uploading CSV…" : "↑ Upload CSV"}
                <input type="file" accept=".csv,text/csv" disabled={uploadingCsv} style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; void handleLeadCsvUpload(file); event.currentTarget.value = ""; }} />
              </label>
              <a className="ciu-btn-light" href="data:text/csv;charset=utf-8,Name%2CPhone%2CEmail%2CCIU%20Number%2CProgramme%2CStatus%2CIntake%20Year%2CIntake%20Month%0AExample%20Student%2C256700000000%2Cstudent%40example.com%2CCIU12345%2CBachelor%20of%20Business%2Cnew%2C2027%2C2" download="ciu-leads-template.csv" style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Download CSV template</a>
              
            </div>
            {csvSummary && <p role="status" style={{ marginTop: 10, color: "#166534", fontSize: 13 }}>{csvSummary}</p>}
            <p>
              Manage new prospects,
              identify interest and
              qualify students for the
              admissions Pipeline.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setShowAddLead(true)
            }
            className="ciu-btn"
            style={{
              visibility: "visible",
              opacity: 1,
              minWidth: 150,
              height: 44,
              fontSize: 14,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            + Add New Lead
          </button>
        </div>

        <section style={{ marginTop: 16, padding: 14, border: "1px solid #dce8df", borderRadius: 12, background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><strong style={{ color: "#075442", fontSize: 14 }}>Recruitment intake</strong><p style={{ margin: "3px 0 0", color: "#68776f", fontSize: 12 }}>Showing leads assigned to the selected intake. Open a lead to view details or schedule a follow-up in Tasks.</p></div>
          <select value={selectedIntake} onChange={(event) => setSelectedIntake(event.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 190 }}>
            <option value="2026-11">November 2026</option><option value="2027-2">February 2027</option><option value="2027-4">April 2027</option><option value="2027-8">August 2027</option><option value="2027-11">November 2027</option><option value="2028-2">February 2028</option>
          </select>
        </section>

        {/* ERROR */}
        {error && (
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
            {error}
          </div>
        )}

        {/* KPI SECTION */}
        <div
          className="ciu-kpi-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginTop: 20,
          }}
        >
          <KpiCard
            label={
              currentRole ===
              "salesperson"
                ? "My Leads"
                : "Total Leads"
            }
            value={leads.length}
            description="Current CRM records"
            type="total"
          />

          <KpiCard
            label="Active Prospects"
            value={activeLeads}
            description="Current CRM records"
            type="active"
          />

          <KpiCard
            label="Interested"
            value={interestedLeads}
            description="Current CRM records"
            type="interested"
          />

          <KpiCard
            label="Closed / Unqualified"
            value={closedLeads}
            description="Current CRM records"
            type="closed"
          />
        </div>

        {/* WORKFLOW STRIP */}
        <div
          className="ciu-strip"
          style={{
            marginTop: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 15,
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong>
                Lead workflow
              </strong>

              <div
                style={{
                  marginTop: 4,
                }}
              >
                <span>
                  Prospect → Contact →
                  Interested → Pipeline
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {[
                "Pending",
                "Called",
                "Interested",
                "Pipeline",
              ].map(
                (step, index) => (
                  <div
                    key={step}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        padding:
                          "6px 10px",
                        borderRadius:
                          999,
                        background:
                          "#ffffff",
                        border:
                          "1px solid #d7e6df",
                        color:
                          "#36564e",
                        fontSize: 11,
                        fontWeight: 750,
                      }}
                    >
                      {step}
                    </span>

                    {index <
                      3 && (
                      <span
                        style={{
                          color:
                            "#9aaca5",
                          fontSize: 12,
                        }}
                      >
                        →
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* FILTERS */}
        <div
          className="ciu-card"
          style={{
            marginTop: 18,
          }}
        >
          <div className="ciu-card-head">
            <div>
              <strong>
                Lead Records
              </strong>

              <span>
                Search, filter and manage
                your prospect records.
              </span>
            </div>

            <button
              type="button"
              onClick={loadLeads}
              className="ciu-btn-light"
              disabled={loading}
            >
              {loading
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          <div
            style={{
              padding: 18,
              display: "grid",
              gridTemplateColumns:
                "minmax(240px, 2fr) minmax(180px, 1fr) minmax(180px, 1fr)",
              gap: 12,
            }}
            className="ciu-lead-filters"
          >
            <div>
              <label
                style={labelStyle}
              >
                Search Leads
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search name, CIU number, phone, email..."
                style={inputStyle}
              />
            </div>

            <div>
              <label
                style={labelStyle}
              >
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                style={inputStyle}
              >
                <option value="All">
                  All statuses
                </option>

                {displayStatuses.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label
                style={labelStyle}
              >
                Programme
              </label>

              <select
                value={programFilter}
                onChange={(event) =>
                  setProgramFilter(
                    event.target.value
                  )
                }
                style={inputStyle}
              >
                <option value="All">
                  All programmes
                </option>

                {programs.map(
                  (program) => (
                    <option
                      key={program}
                      value={program}
                    >
                      {program}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>
        </div>

        {/* LEADS TABLE */}
        <div
          className="ciu-card"
          style={{
            marginTop: 18,
          }}
        >
          <div className="ciu-card-head">
            <div>
              <strong>
                Leads
              </strong>

              <span>
                Showing{" "}
                {filteredLeads.length}{" "}
                of {leads.length}{" "}
                records
              </span>
            </div>
          </div>

          {loading ? (
            <div
              style={{
                padding: 60,
                textAlign: "center",
                color: "#6b7f78",
              }}
            >
              Loading leads...
            </div>
          ) : filteredLeads.length ===
            0 ? (
            <div
              style={{
                padding: 60,
                textAlign: "center",
                color: "#6b7f78",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: "#36564e",
                  marginBottom: 6,
                }}
              >
                No leads found
              </div>

              <div
                style={{
                  fontSize: 13,
                }}
              >
                Try changing your search
                or filters.
              </div>
            </div>
          ) : (
            <div
              className="ciu-table-scroll"
              style={{
                maxHeight:
                  "calc(100vh - 330px)",
                minHeight: 320,
                overflowY: "auto",
                overflowX: "auto",
              }}
            >
              <table
                className="ciu-report-table"
                style={{
                  minWidth: 1250,
                }}
              >
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 5,
                  }}
                >
                  <tr>
                    <th>
                      CIU NUMBER
                    </th>

                    <th>
                      FULL NAMES
                    </th>

                    <th>
                      TELEPHONE NUMBER
                    </th>

                    <th>
                      EMAIL
                    </th>

                    <th>
                      PROGRAMME
                    </th>

                    <th>
                      SCHOOL
                    </th>

                    <th>
                      STATUS
                    </th>

                    <th>
                      CREATED
                    </th>

                    <th>
                      ACTIONS
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredLeads.map(
                    (lead) => {
                      const displayStatus =
                        getDisplayStatus(
                          lead.status
                        );

                      return (
                        <tr
                          key={
                            lead.id
                          }
                        >
                          <td>
                            {lead.ciu_number ||
                              "—"}
                          </td>

                          <td>
                            <div
                              style={{
                                fontWeight:
                                  750,
                                color:
                                  "#17322c",
                              }}
                            >
                              {lead.name ||
                                "Unnamed Lead"}
                            </div>
                          </td>

                          <td>
                            {lead.phone ||
                              "—"}
                          </td>

                          <td>
                            {lead.email ||
                              "—"}
                          </td>

                          <td>
                            {lead.product_service ||
                              "—"}
                          </td>

                          <td>
                            {schools.find((school) => school.id === lead.school_id)?.school_name || "—"}
                          </td>

                          <td>
                            <StatusBadge
                              status={
                                displayStatus
                              }
                            />
                          </td>

                          <td>
                            {formatDate(
                              lead.created_at
                            )}
                          </td>

                          {/* ACTIONS — VIEW ONLY */}
                          <td>
                            <div
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 8,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleView(
                                    lead
                                  )
                                }
                                className="ciu-btn-light"
                                style={{
                                  padding:
                                    "8px 14px",
                                  fontSize: 12,
                                  fontWeight:
                                    800,
                                }}
                              >
                                View
                              </button>
                            </div>
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

        {/* VIEW LEAD MODAL */}
        {showViewModal &&
          selectedLead && (
            <ModalOverlay
              onClose={() =>
                setShowViewModal(
                  false
                )
              }
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 620,
                  maxHeight: "90vh",
                  overflowY: "auto",
                  background: "#ffffff",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow:
                    "0 25px 60px rgba(15, 23, 42, 0.25)",
                }}
              >
                <ModalHeader
                  title="Lead Details"
                  subtitle="Prospect information"
                  onClose={() =>
                    setShowViewModal(
                      false
                    )
                  }
                />

                {/* LEAD ACTIONS */}
                <div
                  style={{
                    marginTop: 24,
                    paddingTop: 20,
                    borderTop:
                      "1px solid #e5eeea",
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 850,
                      color: "#6b7f78",
                      textTransform:
                        "uppercase",
                      letterSpacing:
                        "0.05em",
                      marginBottom: 10,
                    }}
                  >
                    Lead Actions
                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      gap: 10,
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowViewModal(
                          false
                        );

                        openHistory(
                          selectedLead
                        );
                      }}
                      className="ciu-btn-light"
                      style={{
                        minHeight: 42,
                        padding:
                          "10px 16px",
                      }}
                    >
                      View History
                    </button>

                    {statusIsQualified(
                      selectedLead.status
                    ) &&
                      !statusIsClosed(
                        selectedLead.status
                      ) && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowViewModal(
                              false
                            );

                            qualifyLead(
                              selectedLead
                            );
                          }}
                          disabled={
                            qualifyingLeadId ===
                            selectedLead.id
                          }
                          className="ciu-btn"
                          style={{
                            minHeight: 42,
                            padding:
                              "10px 16px",
                            visibility:
                              "visible",
                            opacity: 1,
                          }}
                        >
                          {qualifyingLeadId ===
                          selectedLead.id
                            ? "Moving..."
                            : "Move to Pipeline"}
                        </button>
                      )}
                  </div>
                </div>

                {/* LEAD DETAILS */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: 14,
                    marginTop: 22,
                  }}
                  className="ciu-detail-grid"
                >
                  <DetailItem
                    label="CIU Number"
                    value={
                      selectedLead.ciu_number
                    }
                  />

                  <DetailItem
                    label="Full Name"
                    value={
                      selectedLead.name
                    }
                  />

                  <DetailItem
                    label="Telephone"
                    value={
                      selectedLead.phone
                    }
                  />

                  <DetailItem
                    label="Email"
                    value={
                      selectedLead.email
                    }
                  />

                  <DetailItem
                    label="Programme"
                    value={
                      selectedLead.product_service
                    }
                  />
                  <DetailItem
                    label="Original intake"
                    value={selectedLead.original_intake_month && selectedLead.original_intake_year ? `${({2:"February",4:"April",8:"August",11:"November"} as Record<number,string>)[selectedLead.original_intake_month]} ${selectedLead.original_intake_year}` : "Not recorded"}
                  />
                  <DetailItem
                    label="Current intake"
                    value={selectedLead.intake_month && selectedLead.intake_year ? `${({2:"February",4:"April",8:"August",11:"November"} as Record<number,string>)[selectedLead.intake_month]} ${selectedLead.intake_year}` : "Needs intake assignment"}
                  />

                  <DetailItem
                    label="Status"
                    value={getDisplayStatus(
                      selectedLead.status
                    )}
                  />

                  <DetailItem
                    label="Created"
                    value={formatDateTime(
                      selectedLead.created_at
                    )}
                  />

                  <DetailItem
                    label="Follow-up"
                    value="Managed from Tasks"
                  />
                </div>

                <div style={{ marginTop: 18, padding: 14, border: "1px solid #dce9e0", borderRadius: 10, background: "#fbfdfb" }}>
                  <h3 style={{ margin: "0 0 10px", color: "#173b2b", fontSize: 14, fontWeight: 800 }}>Move lead to another intake</h3>
                  <div className="ciu-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={labelStyle}>New intake</label>
                      <select value={`${intakeDraftYear}-${intakeDraftMonth}`} onChange={(event) => { const [year, month] = event.target.value.split("-"); setIntakeDraftYear(year); setIntakeDraftMonth(month); }} style={inputStyle}>
                        <option value="2026-11">November 2026</option>
                        <option value="2027-2">February 2027</option>
                        <option value="2027-4">April 2027</option>
                        <option value="2027-8">August 2027</option>
                        <option value="2027-11">November 2027</option>
                        <option value="2028-2">February 2028</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Reason for transfer</label>
                      <input value={intakeChangeReason} onChange={(event) => setIntakeChangeReason(event.target.value)} placeholder="e.g. student deferred" style={inputStyle} />
                    </div>
                  </div>
                  <button type="button" disabled={savingIntake || !selectedLead} onClick={async () => {
                    if (!selectedLead) return;
                    const nextYear = Number(intakeDraftYear), nextMonth = Number(intakeDraftMonth);
                    if (selectedLead.intake_year === nextYear && selectedLead.intake_month === nextMonth) { alert("This lead is already assigned to that intake."); return; }
                    setSavingIntake(true);
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) throw new Error("Please sign in again.");
                      const { error: transferError } = await supabase.rpc("move_lead_to_intake", { p_lead_id: selectedLead.id, p_new_intake_year: nextYear, p_new_intake_month: nextMonth, p_reason: intakeChangeReason.trim() || null });
                      if (transferError) throw transferError;
                      const updatedLead = { ...selectedLead, intake_year: nextYear, intake_month: nextMonth, original_intake_year: selectedLead.original_intake_year ?? selectedLead.intake_year ?? nextYear, original_intake_month: selectedLead.original_intake_month ?? selectedLead.intake_month ?? nextMonth };
                      setSelectedLead(updatedLead);
                      setLeads((current) => current.map((lead) => lead.id === updatedLead.id ? updatedLead : lead));
                      setIntakeChangeReason("");
                      alert("Lead intake updated and transfer history recorded.");
                    } catch (e) {
                      alert(e instanceof Error ? e.message : "Could not update intake.");
                    } finally { setSavingIntake(false); }
                  }} style={{ marginTop: 12, border: 0, borderRadius: 8, background: "#00695c", color: "#fff", padding: "10px 14px", fontWeight: 800, cursor: "pointer", opacity: savingIntake ? .6 : 1 }}>
                    {savingIntake ? "Saving…" : "Save intake transfer"}
                  </button>
                </div>

                <div
                  style={{
                    marginTop: 22,
                    padding: 13,
                    borderRadius: 9,
                    background:
                      "#eaf5f2",
                    color: "#00695c",
                    fontSize: 13,
                  }}
                >
                  <strong>
                    CRM workflow:
                  </strong>{" "}
                  Lead prospecting is
                  handled here. Actual
                  calls, WhatsApp,
                  email follow-ups and
                  scheduled work are
                  managed from Tasks.
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
                  maxWidth: 800,
                  maxHeight: "90vh",
                  overflowY: "auto",
                  background: "#ffffff",
                  borderRadius: 16,
                  padding: 24,
                  boxShadow:
                    "0 25px 60px rgba(15, 23, 42, 0.25)",
                }}
              >
                <ModalHeader
                  title="Communication History"
                  subtitle={
                    historyLead.name ||
                    "Lead"
                  }
                  onClose={() =>
                    setShowHistoryModal(
                      false
                    )
                  }
                />

                {loadingHistory ? (
                  <div
                    style={{
                      padding: 45,
                      textAlign:
                        "center",
                      color:
                        "#6b7f78",
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
                      marginTop: 20,
                      padding: 40,
                      textAlign:
                        "center",
                      background:
                        "#f5f8f7",
                      borderRadius: 10,
                      color:
                        "#6b7f78",
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
                      gap: 12,
                      marginTop: 20,
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
                              "1px solid #dfe9e5",
                            borderRadius:
                              12,
                            padding: 15,
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: 15,
                              flexWrap:
                                "wrap",
                              marginBottom:
                                8,
                            }}
                          >
                            <strong
                              style={{
                                color:
                                  "#17322c",
                              }}
                            >
                              {
                                activity.subject
                              }
                            </strong>

                            <span
                              style={{
                                color:
                                  "#6b7f78",
                                fontSize:
                                  12,
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
                                  "#53665f",
                                fontSize:
                                  13,
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
              onClick={(event) =>
                event.stopPropagation()
              }
              style={{
                width: "100%",
                maxWidth: 650,
                maxHeight: "90vh",
                overflowY: "auto",
                background: "#ffffff",
                borderRadius: 16,
                padding: 24,
                boxShadow:
                  "0 25px 60px rgba(15, 23, 42, 0.25)",
              }}
            >
              <ModalHeader
                title="Add New Lead"
                subtitle="Add a new prospective student to the CRM."
                onClose={() =>
                  setShowAddLead(
                    false
                  )
                }
              />

              <form
                onSubmit={
                  handleAddLead
                }
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: 16,
                    marginTop: 22,
                  }}
                  className="ciu-form-grid"
                >
                  <FormField
                    label="CIU Number"
                    value={
                      newLead.ciu_number
                    }
                    onChange={(value) =>
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
                    onChange={(value) =>
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
                    onChange={(value) =>
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
                    onChange={(value) =>
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
                    value={newLead.product_service}
                    onChange={(value) => {
                      const normalized = value.trim().toUpperCase();
                      const isNovember = normalized === "PGDME" || normalized === "MPH" || normalized.startsWith("HEC") || normalized.includes("ALLIED HEALTH");
                      setNewLead({
                        ...newLead,
                        product_service: value,
                        intake_year: isNovember ? "2026" : (value.trim() ? "2027" : ""),
                        intake_month: isNovember ? "11" : (value.trim() ? "2" : ""),
                      });
                    }}
                    placeholder="Programme / course"
                  />
                  <div>
                    <label style={labelStyle}>Recruitment intake *</label>
                    <select required value={newLead.intake_year && newLead.intake_month ? `${newLead.intake_year}-${newLead.intake_month}` : ""} onChange={(event) => {
                      const [year, month] = event.target.value ? event.target.value.split("-") : ["", ""];
                      setNewLead({ ...newLead, intake_year: year, intake_month: month });
                    }} style={inputStyle}>
                      <option value="">Select intake</option>
                      <option value="2026-11">November 2026</option>
                      <option value="2027-2">February 2027</option>
                      <option value="2027-4">April 2027</option>
                      <option value="2027-8">August 2027</option>
                      <option value="2027-11">November 2027</option>
                      <option value="2028-2">February 2028</option>
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>School (optional)</label>
                    <select
                      value={newLead.school_id}
                      onChange={(event) => setNewLead({ ...newLead, school_id: event.target.value })}
                      style={inputStyle}
                    >
                      <option value="">Not linked to a school</option>
                      {schools.map((school) => (
                        <option key={school.id} value={school.id}>
                          {school.school_name}{school.district ? ` — ${school.district}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      style={
                        labelStyle
                      }
                    >
                      Initial Status
                    </label>

                    <select
                      value={
                        newLead.status
                      }
                      onChange={(
                        event
                      ) =>
                        setNewLead({
                          ...newLead,
                          status:
                            event
                              .target
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
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 15,
                    padding: 12,
                    borderRadius: 9,
                    background:
                      "#f5f8f7",
                    color:
                      "#53665f",
                    fontSize: 12,
                  }}
                >
                  Follow-up scheduling
                  is handled in the
                  Tasks module, so
                  Leads are not assigned
                  duplicate follow-up
                  work here.
                </div>

                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "flex-end",
                    gap: 10,
                    marginTop: 24,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setShowAddLead(
                        false
                      )
                    }
                    disabled={
                      saving
                    }
                    className="ciu-btn-light"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      saving
                    }
                    className="ciu-btn"
                    style={{
                      visibility:
                        "visible",
                      opacity: 1,
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

        {/* RESPONSIVE STYLES */}
        <style jsx>{`
          @media (max-width: 1000px) {
            .ciu-kpi-grid {
              grid-template-columns: repeat(
                2,
                minmax(0, 1fr)
              ) !important;
            }

            .ciu-lead-filters {
              grid-template-columns: 1fr 1fr !important;
            }
          }

          @media (max-width: 700px) {
            .ciu-lead-filters {
              grid-template-columns: 1fr !important;
            }

            .ciu-detail-grid {
              grid-template-columns: 1fr !important;
            }

            .ciu-form-grid {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 600px) {
            .ciu-kpi-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

/* =========================
   KPI CARD
========================= */

function KpiCard({
  label,
  value,
  description,
  type,
}: {
  label: string;
  value: number;
  description: string;
  type:
    | "total"
    | "active"
    | "interested"
    | "closed";
}) {
  const styles = {
    total: {
      border: "#dbe8e4",
      background: "#ffffff",
      accent: "#00695c",
    },

    active: {
      border: "#dcebd4",
      background: "#fbfdf9",
      accent: "#5d8f1f",
    },

    interested: {
      border: "#cfe7df",
      background: "#f8fcfa",
      accent: "#00866f",
    },

    closed: {
      border: "#eadbdd",
      background: "#fffafa",
      accent: "#b45363",
    },
  };

  const selected =
    styles[type];

  return (
    <div
      style={{
        position: "relative",
        minWidth: 0,
        minHeight: 116,
        padding:
          "16px 17px 15px",
        border:
          `1px solid ${selected.border}`,
        borderRadius: 14,
        background:
          selected.background,
        boxShadow:
          "0 5px 18px rgba(23, 50, 44, 0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background:
            selected.accent,
        }}
      />

      <div
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          color: "#6b7f78",
          textTransform:
            "uppercase",
          letterSpacing:
            "0.04em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 29,
          lineHeight: 1.05,
          fontWeight: 900,
          color: "#17322c",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          lineHeight: 1.45,
          color: "#6b7f78",
        }}
      >
        {description}
      </div>
    </div>
  );
}

/* =========================
   STATUS BADGE
========================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const positive =
    status === "Interested";

  const closed = [
    "Not interested",
    "Financial issues",
    "Lost Leads",
    "Dropped",
    "Ineffective Data",
    "Unreachable",
    "No Answer",
  ].includes(status);

  return (
    <span
      style={{
        display:
          "inline-block",
        padding: "5px 9px",
        borderRadius: 999,
        background: positive
          ? "#eaf5f2"
          : closed
          ? "#fff1f2"
          : "#f1f5f3",
        color: positive
          ? "#00695c"
          : closed
          ? "#be123c"
          : "#53665f",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace:
          "nowrap",
      }}
    >
      {status}
    </span>
  );
}

/* =========================
   MODAL HEADER
========================= */

function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        alignItems:
          "flex-start",
        gap: 15,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: "#17322c",
          }}
        >
          {title}
        </h2>

        <p
          style={{
            margin:
              "6px 0 0",
            color:
              "#6b7f78",
            fontSize: 13,
          }}
        >
          {subtitle}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        style={
          closeButtonStyle
        }
      >
        ×
      </button>
    </div>
  );
}

/* =========================
   DETAIL ITEM
========================= */

function DetailItem({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | null
    | undefined;
}) {
  return (
    <div
      style={{
        padding: 13,
        border:
          "1px solid #dfe9e5",
        borderRadius: 9,
        background: "#f8fbfa",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "#6b7f78",
          textTransform:
            "uppercase",
          marginBottom: 5,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: "#17322c",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

/* =========================
   MODAL OVERLAY
========================= */

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
        alignItems: "center",
        justifyContent:
          "center",
        padding: 20,
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        onClick={(event) =>
          event.stopPropagation()
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

/* =========================
   FORM FIELD
========================= */

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label
        style={labelStyle}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        placeholder={
          placeholder
        }
        style={inputStyle}
      />
    </div>
  );
}

/* =========================
   STYLES
========================= */

const labelStyle: React.CSSProperties =
  {
    display: "block",
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 700,
    color: "#334155",
  };

const inputStyle: React.CSSProperties =
  {
    width: "100%",
    boxSizing:
      "border-box",
    padding:
      "11px 12px",
    border:
      "1px solid #d1d5db",
    borderRadius: 8,
    background:
      "#ffffff",
    color: "#172033",
    fontSize: 14,
    outline: "none",
  };

const closeButtonStyle: React.CSSProperties =
  {
    width: 36,
    height: 36,
    borderRadius: 8,
    border:
      "1px solid #dfe9e5",
    background:
      "#ffffff",
    cursor: "pointer",
    fontSize: 18,
    color: "#6b7f78",
  };
