"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Lead = {
  id: string;
  ciuNumber: string;
  fullNames: string;
  telephone: string;
  email: string;
  program: string;
  feedback: string;
  followUp: string;
  followUpDate: string;
  assignedStaff: string;
  amountPaid: number;
  isApplicant: boolean;
};

const FOLLOW_UP_STATUSES = [
  "Pending",
  "Called",
  "WhatsApped",
  "Email Sent",
  "Interested",
  "Not Interested",
  "Follow Up Later",
  "Converted",
  "Paid Fees",
  "Financial Issues",
  "Lost Lead",
  "Dropped",
  "Ineffective Data",
  "Unreachable",
  "No Answer",
];

const EMPTY_FORM = {
  ciuNumber: "",
  fullNames: "",
  telephone: "",
  email: "",
  program: "",
  feedback: "",
  followUp: "Pending",
  followUpDate: "",
  assignedStaff: "",
  amountPaid: "",
};

function getStatusClass(status: string) {
  if (status === "Paid Fees" || status === "Converted") {
    return "bg-emerald-100 text-emerald-700";
  }

  if (
    status === "Interested" ||
    status === "Called" ||
    status === "WhatsApped"
  ) {
    return "bg-blue-100 text-blue-700";
  }

  if (
    status === "Lost Lead" ||
    status === "Dropped" ||
    status === "Not Interested"
  ) {
    return "bg-red-100 text-red-700";
  }

  if (status === "Financial Issues") {
    return "bg-amber-100 text-amber-700";
  }

  if (
    status === "Unreachable" ||
    status === "No Answer" ||
    status === "Ineffective Data"
  ) {
    return "bg-slate-200 text-slate-700";
  }

  return "bg-purple-100 text-purple-700";
}

function getProgramCategory(program: string) {
  const value = program.toLowerCase();

  if (
    value.includes("postgraduate") ||
    value.includes("master") ||
    value.includes("mba") ||
    value.includes("pgd")
  ) {
    return "Postgraduate";
  }

  if (value.includes("diploma")) {
    return "Diploma";
  }

  if (
    value.includes("certificate") ||
    value.includes("hec")
  ) {
    return "HEC";
  }

  return "Bachelor";
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || null,
  };
}

export default function LeadsPage() {
  const supabase = createClient();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    async function loadLeads() {
      setLoading(true);

      const [
        { data: leadData, error: leadError },
        { data: admissionData, error: admissionError },
      ] = await Promise.all([
        supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("admissions")
          .select("lead_id"),
      ]);

      if (leadError) {
        console.error(
          "SUPABASE LEADS ERROR:",
          leadError.message
        );
        setLoading(false);
        return;
      }

      if (admissionError) {
        console.error(
          "SUPABASE ADMISSIONS ERROR:",
          admissionError.message
        );
      }

      const applicantLeadIds = new Set(
        (admissionData ?? [])
          .map((item) => item.lead_id)
          .filter(Boolean)
      );

      setLeads(
        (leadData ?? []).map((lead) => ({
          id: lead.id,
          ciuNumber: lead.ciu_number ?? "",
          fullNames: lead.name ?? "",
          telephone: lead.phone ?? "",
          email: lead.email ?? "",
          program: lead.product_service ?? "",
          feedback: lead.feedback ?? "",
          followUp: lead.follow_up_status ?? "Pending",
          followUpDate: lead.next_follow_up_at
            ? String(lead.next_follow_up_at).slice(0, 10)
            : "",
          assignedStaff: lead.assigned_to ?? "",
          amountPaid: Number(lead.amount_paid ?? 0),
          isApplicant: applicantLeadIds.has(lead.id),
        }))
      );

      setLoading(false);
    }

    loadLeads();
  }, []);

  const filteredLeads = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return leads.filter((lead) => {
      const searchableText = [
        lead.ciuNumber,
        lead.fullNames,
        lead.telephone,
        lead.email,
        lead.program,
        lead.feedback,
        lead.assignedStaff,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        searchText === "" ||
        searchableText.includes(searchText);

      const matchesFilter =
        filter === "All" || lead.followUp === filter;

      return matchesSearch && matchesFilter;
    });
  }, [leads, search, filter]);

  const totalLeads = leads.length;

  const interested = leads.filter(
    (lead) => lead.followUp === "Interested"
  ).length;

  const converted = leads.filter(
    (lead) => lead.followUp === "Converted"
  ).length;

  const paidFees = leads.filter(
    (lead) => lead.followUp === "Paid Fees"
  ).length;

  const totalPaid = leads.reduce(
    (total, lead) => total + lead.amountPaid,
    0
  );

  function updateForm(field: string, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function openAddLeadForm() {
    setEditingLeadId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingLeadId(null);
    setForm(EMPTY_FORM);
  }

  function openEditLead(lead: Lead) {
    setEditingLeadId(lead.id);

    setForm({
      ciuNumber: lead.ciuNumber,
      fullNames: lead.fullNames,
      telephone: lead.telephone,
      email: lead.email,
      program: lead.program,
      feedback: lead.feedback,
      followUp: lead.followUp,
      followUpDate: lead.followUpDate,
      assignedStaff: lead.assignedStaff,
      amountPaid: String(lead.amountPaid || ""),
    });

    setShowForm(true);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      !form.ciuNumber ||
      !form.fullNames ||
      !form.telephone ||
      !form.program
    ) {
      alert(
        "Please complete CIU Number, Full Names, Telephone and Program."
      );
      return;
    }

    setSaving(true);

    const payload = {
      ciu_number: form.ciuNumber.trim(),
      name: form.fullNames.trim(),
      phone: form.telephone.trim(),
      email: form.email.trim() || null,
      product_service: form.program.trim(),
      feedback: form.feedback.trim() || null,
      follow_up_status: form.followUp || "Pending",
      next_follow_up_at: form.followUpDate || null,
      assigned_to: form.assignedStaff.trim() || null,
      amount_paid: Number(form.amountPaid) || 0,
    };

    if (editingLeadId) {
      const { data, error } = await supabase
        .from("leads")
        .update(payload)
        .eq("id", editingLeadId)
        .select()
        .single();

      if (error) {
        console.error("UPDATE LEAD ERROR:", error);
        alert(
          `Could not update lead: ${error.message}`
        );
        setSaving(false);
        return;
      }

      const existingLead = leads.find(
        (lead) => lead.id === editingLeadId
      );

      const updatedLead: Lead = {
        id: data.id,
        ciuNumber: data.ciu_number ?? "",
        fullNames: data.name ?? "",
        telephone: data.phone ?? "",
        email: data.email ?? "",
        program: data.product_service ?? "",
        feedback: data.feedback ?? "",
        followUp:
          data.follow_up_status ?? "Pending",
        followUpDate: data.next_follow_up_at
          ? String(data.next_follow_up_at).slice(0, 10)
          : "",
        assignedStaff: data.assigned_to ?? "",
        amountPaid: Number(data.amount_paid ?? 0),
        isApplicant:
          existingLead?.isApplicant ?? false,
      };

      setLeads((currentLeads) =>
        currentLeads.map((lead) =>
          lead.id === editingLeadId
            ? updatedLead
            : lead
        )
      );

      closeForm();
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("leads")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error("INSERT LEAD ERROR:", error);
      alert(
        `Could not save lead: ${error.message}`
      );
      setSaving(false);
      return;
    }

    const newLead: Lead = {
      id: data.id,
      ciuNumber: data.ciu_number ?? "",
      fullNames: data.name ?? "",
      telephone: data.phone ?? "",
      email: data.email ?? "",
      program: data.product_service ?? "",
      feedback: data.feedback ?? "",
      followUp:
        data.follow_up_status ?? "Pending",
      followUpDate: data.next_follow_up_at
        ? String(data.next_follow_up_at).slice(0, 10)
        : "",
      assignedStaff: data.assigned_to ?? "",
      amountPaid: Number(data.amount_paid ?? 0),
      isApplicant: false,
    };

    setLeads((currentLeads) => [
      newLead,
      ...currentLeads,
    ]);

    closeForm();
    setSaving(false);
  }

  async function handleConvertToApplicant(lead: Lead) {
    if (lead.isApplicant) {
      alert(
        "This lead has already been converted to an applicant."
      );
      return;
    }

    const confirmed = window.confirm(
      `Convert "${lead.fullNames}" to an Applicant?\n\n` +
        `CIU Number: ${lead.ciuNumber}\n` +
        `Programme: ${lead.program}\n\n` +
        `The Lead will remain in the CRM and will be linked to the new Applicant record.`
    );

    if (!confirmed) return;

    setConvertingId(lead.id);

    try {
      /*
       * 1. Get the original lead record.
       * We use the database record rather than the display
       * object so that contact_id, organization_id,
       * source_id and assigned_to are preserved.
       */
      const {
        data: leadRecord,
        error: leadError,
      } = await supabase
        .from("leads")
        .select(
          "id, organization_id, contact_id, name, company_name, phone, email, location, source_id, product_service, assigned_to, feedback, ciu_number"
        )
        .eq("id", lead.id)
        .single();

      if (leadError || !leadRecord) {
        throw new Error(
          leadError?.message ||
            "Lead record could not be found."
        );
      }

      /*
       * 2. Check whether this Lead is already linked
       * to an Applicant.
       */
      const {
        data: existingAdmission,
        error: existingAdmissionError,
      } = await supabase
        .from("admissions")
        .select("id")
        .eq("lead_id", leadRecord.id)
        .maybeSingle();

      if (existingAdmissionError) {
        throw new Error(
          existingAdmissionError.message
        );
      }

      if (existingAdmission) {
        setLeads((currentLeads) =>
          currentLeads.map((item) =>
            item.id === lead.id
              ? {
                  ...item,
                  isApplicant: true,
                  followUp: "Converted",
                }
              : item
          )
        );

        alert(
          "This lead is already linked to an Applicant."
        );

        setConvertingId(null);
        return;
      }

      /*
       * 3. Reuse the existing Contact if one exists.
       * If the Lead already has contact_id, we preserve it.
       */
      let contactId =
        leadRecord.contact_id ?? null;

      if (!contactId) {
        const phone =
          leadRecord.phone?.trim() || "";
        const email =
          leadRecord.email?.trim() || "";

        let existingContact = null;

        if (phone) {
          const { data } = await supabase
            .from("contacts")
            .select("id")
            .eq("phone", phone)
            .limit(1)
            .maybeSingle();

          existingContact = data;
        }

        if (!existingContact && email) {
          const { data } = await supabase
            .from("contacts")
            .select("id")
            .eq("email", email)
            .limit(1)
            .maybeSingle();

          existingContact = data;
        }

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          const {
            firstName,
            lastName,
          } = splitName(
            leadRecord.name || ""
          );

          const {
            data: newContact,
            error: contactError,
          } = await supabase
            .from("contacts")
            .insert({
              organization_id:
                leadRecord.organization_id ||
                null,
              first_name: firstName,
              last_name: lastName,
              phone: phone || null,
              email: email || null,
              address:
                leadRecord.location || null,
              assigned_to:
                leadRecord.assigned_to || null,
              notes:
                leadRecord.feedback || null,
            })
            .select("id")
            .single();

          if (contactError || !newContact) {
            throw new Error(
              contactError?.message ||
                "Could not create the Contact record."
            );
          }

          contactId = newContact.id;
        }
      }

      /*
       * 4. Create the Applicant record.
       * All important Lead information is carried across.
       */
      const {
        data: applicant,
        error: applicantError,
      } = await supabase
        .from("admissions")
                .insert({
          lead_id: leadRecord.id,
          contact_id: contactId,
          ciu_number:
            leadRecord.ciu_number ||
            lead.ciuNumber ||
            null,
          full_names:
            leadRecord.name ||
            lead.fullNames,
          telephone:
            leadRecord.phone ||
            lead.telephone ||
            null,
          email:
            leadRecord.email ||
            lead.email ||
            null,
          program:
            leadRecord.product_service ||
            lead.program,
          program_category:
            getProgramCategory(
              leadRecord.product_service ||
                lead.program
            ),
          stage: "Application Started",
          assigned_to:
            leadRecord.assigned_to || null,
          source:
            leadRecord.source_id || null,
          notes:
            leadRecord.feedback || null,
        })
        .select("id")
        .single();

      if (applicantError || !applicant) {
        throw new Error(
          applicantError?.message ||
            "Could not create the Applicant record."
        );
      }

      /*
       * 5. Link the Lead to the Contact and mark it
       * as converted.
       */
      const {
        error: updateLeadError,
      } = await supabase
        .from("leads")
        .update({
          contact_id: contactId,
          status: "converted",
          follow_up_status: "Converted",
          converted_at:
            new Date().toISOString(),
        })
        .eq("id", leadRecord.id);

      if (updateLeadError) {
        throw new Error(
          updateLeadError.message
        );
      }

      /*
       * 6. Update the local Leads table immediately.
       */
      setLeads((currentLeads) =>
        currentLeads.map((item) =>
          item.id === lead.id
            ? {
                ...item,
                isApplicant: true,
                followUp: "Converted",
              }
            : item
        )
      );

      alert(
        `Success!\n\n${lead.fullNames} is now an Applicant.\n\nThe Lead, Contact and Applicant records are linked.`
      );
    } catch (error) {
      console.error(
        "CONVERT LEAD ERROR:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "Unknown error";

      alert(
        `Could not convert lead to Applicant:\n\n${message}`
      );
    } finally {
      setConvertingId(null);
    }
  }

  async function handleDeleteLead(lead: Lead) {
    const confirmed = window.confirm(
      `Delete lead "${lead.fullNames}" (${lead.ciuNumber})? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(lead.id);

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", lead.id);

    if (error) {
      console.error(
        "DELETE LEAD ERROR:",
        error
      );
      alert(
        `Could not delete lead: ${error.message}`
      );
      setDeletingId(null);
      return;
    }

    setLeads((currentLeads) =>
      currentLeads.filter(
        (item) => item.id !== lead.id
      )
    );

    setDeletingId(null);
  }

  async function updateLeadStatus(
    lead: Lead,
    status: string
  ) {
    const { data, error } = await supabase
      .from("leads")
      .update({
        follow_up_status: status,
      })
      .eq("id", lead.id)
      .select()
      .single();

    if (error) {
      console.error(
        "STATUS UPDATE ERROR:",
        error
      );
      alert(
        `Could not update status: ${error.message}`
      );
      return;
    }

    setLeads((currentLeads) =>
      currentLeads.map((item) =>
        item.id === lead.id
          ? {
              ...item,
              followUp:
                data.follow_up_status ??
                status,
            }
          : item
      )
    );
  }

  function handleImportCSV(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
      const text = String(
        e.target?.result || ""
      );

      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setImportMessage(
          "CSV file is empty or has no contact records."
        );
        return;
      }

      const headers = lines[0]
        .split(",")
        .map((header) =>
          header.trim().toLowerCase()
        );

      const getValue = (
        values: string[],
        names: string[]
      ) => {
        for (const name of names) {
          const index = headers.indexOf(
            name.toLowerCase()
          );

          if (index >= 0) {
            return (
              values[index]?.trim() || ""
            );
          }
        }

        return "";
      };

      const rows = lines.slice(1);
      const recordsToInsert: Record<
        string,
        unknown
      >[] = [];

      let skipped = 0;

      rows.forEach((line) => {
        const values = line.split(",");

        const ciuNumber = getValue(values, [
          "CIU Number",
          "CIU NUMBER",
          "ciu_number",
        ]);

        const fullNames = getValue(values, [
          "Full Names",
          "FULL NAMES",
          "Name",
          "name",
        ]);

        const telephone = getValue(values, [
          "Telephone",
          "Telephone Number",
          "Phone",
          "phone",
        ]);

        if (
          !ciuNumber ||
          !fullNames ||
          !telephone
        ) {
          skipped++;
          return;
        }

        const duplicate = leads.some(
          (lead) =>
            lead.ciuNumber.toLowerCase() ===
            ciuNumber.toLowerCase()
        );

        if (duplicate) {
          skipped++;
          return;
        }

        recordsToInsert.push({
          ciu_number: ciuNumber,
          name: fullNames,
          phone: telephone,
          email:
            getValue(values, [
              "Email",
              "email",
            ]) || null,
          product_service:
            getValue(values, [
              "Program",
              "program",
            ]) || null,
          feedback:
            getValue(values, [
              "Feedback",
              "feedback",
            ]) || null,
          follow_up_status:
            getValue(values, [
              "Follow Up",
              "FOLLOW UP",
              "Status",
            ]) || "Pending",
          next_follow_up_at:
            getValue(values, [
              "Follow Up Date",
              "FOLLOW UP DATE",
            ]) || null,
          assigned_to:
            getValue(values, [
              "Assigned Staff",
              "ASSIGNED STAFF",
            ]) || null,
          amount_paid:
            Number(
              getValue(values, [
                "Amount Paid",
                "AMOUNT PAID",
              ]).replace(/[^0-9.]/g, "")
            ) || 0,
        });
      });

      if (
        recordsToInsert.length === 0
      ) {
        setImportMessage(
          `No new records were imported. ${skipped} record(s) skipped.`
        );
        return;
      }

      const { data, error } = await supabase
        .from("leads")
        .insert(recordsToInsert)
        .select();

      if (error) {
        console.error(
          "CSV IMPORT ERROR:",
          error
        );
        setImportMessage(
          `Import failed: ${error.message}`
        );
        return;
      }

      const importedLeads: Lead[] = (
        data ?? []
      ).map((lead) => ({
        id: lead.id,
        ciuNumber:
          lead.ciu_number ?? "",
        fullNames: lead.name ?? "",
        telephone: lead.phone ?? "",
        email: lead.email ?? "",
        program:
          lead.product_service ?? "",
        feedback:
          lead.feedback ?? "",
        followUp:
          lead.follow_up_status ??
          "Pending",
        followUpDate:
          lead.next_follow_up_at
            ? String(
                lead.next_follow_up_at
              ).slice(0, 10)
            : "",
        assignedStaff:
          lead.assigned_to ?? "",
        amountPaid: Number(
          lead.amount_paid ?? 0
        ),
        isApplicant: false,
      }));

      setLeads((currentLeads) => [
        ...importedLeads,
        ...currentLeads,
      ]);

      setImportMessage(
        `${importedLeads.length} contact(s) imported successfully. ${skipped} record(s) skipped.`
      );

      event.target.value = "";
    };

    reader.readAsText(file);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-[1700px]">

        {/* HEADER */}
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Leads
            </h1>

            <p className="mt-2 text-slate-600">
              Manage CIU prospects, follow-ups,
              conversions and fee payments.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openAddLeadForm}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              + Add Lead
            </button>

            <button
              type="button"
              onClick={() => {
                setImportMessage("");
                setShowImport(true);
              }}
              className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Import CSV
            </button>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Leads
            </p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {totalLeads}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Interested
            </p>
            <p className="mt-2 text-2xl font-bold text-blue-600">
              {interested}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Converted
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {converted}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Paid Fees
            </p>
            <p className="mt-2 text-2xl font-bold text-purple-600">
              {paidFees}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Fees Collected
            </p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              UGX {totalPaid.toLocaleString()}
            </p>
          </div>

        </div>

        {/* SEARCH */}
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search CIU number, name, phone, email, program or staff..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
          />

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value)
            }
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
          >
            <option value="All">
              All Follow Up Statuses
            </option>

            {FOLLOW_UP_STATUSES.map(
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

        {/* TABLE */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="overflow-x-auto">

            <table className="w-full min-w-[1750px] text-left text-sm">

              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>

                  <th className="px-5 py-4 font-semibold text-slate-600">
                    CIU Number
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-600">
                    Full Names
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-600">
                    Telephone
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-600">
                    Email
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-600">
                    Program
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-600">
                    Feedback
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-600">
                    Follow Up
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-600">
                    Follow Up Date
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-600">
                    Amount Paid
                  </th>

                  <th className="px-5 py-4 font-semibold text-slate-600">
                    Actions
                  </th>

                </tr>
              </thead>

              <tbody>

                {loading && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      Loading leads...
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredLeads.map(
                    (lead) => (
                      <tr
                        key={lead.id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >

                        <td className="px-5 py-4 font-semibold text-slate-900">
                          {lead.ciuNumber ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 font-medium text-slate-800">
                          {lead.fullNames ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {lead.telephone ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {lead.email || "—"}
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {lead.program || "—"}
                        </td>

                        <td className="max-w-xs px-5 py-4 text-slate-600">
                          <span
                            className="block max-w-xs truncate"
                            title={
                              lead.feedback
                            }
                          >
                            {lead.feedback ||
                              "—"}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <select
                            value={
                              lead.followUp
                            }
                            onChange={(
                              event
                            ) =>
                              updateLeadStatus(
                                lead,
                                event.target
                                  .value
                              )
                            }
                            className={`rounded-full border-0 px-3 py-1 text-xs font-semibold outline-none ${getStatusClass(
                              lead.followUp
                            )}`}
                          >
                            {FOLLOW_UP_STATUSES.map(
                              (status) => (
                                <option
                                  key={
                                    status
                                  }
                                  value={
                                    status
                                  }
                                >
                                  {status}
                                </option>
                              )
                            )}
                          </select>
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {lead.followUpDate ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 font-medium text-emerald-700">
                          UGX{" "}
                          {lead.amountPaid.toLocaleString()}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">

                            <button
                              type="button"
                              disabled={
                                lead.isApplicant ||
                                convertingId ===
                                  lead.id
                              }
                              onClick={() =>
                                handleConvertToApplicant(
                                  lead
                                )
                              }
                              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                                lead.isApplicant
                                  ? "cursor-not-allowed bg-emerald-100 text-emerald-700"
                                  : "bg-blue-600 text-white hover:bg-blue-700"
                              } disabled:opacity-70`}
                            >
                              {convertingId ===
                              lead.id
                                ? "Converting..."
                                : lead.isApplicant
                                ? "Applicant ✓"
                                : "Convert to Applicant"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openEditLead(
                                  lead
                                )
                              }
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              disabled={
                                deletingId ===
                                lead.id
                              }
                              onClick={() =>
                                handleDeleteLead(
                                  lead
                                )
                              }
                              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId ===
                              lead.id
                                ? "Deleting..."
                                : "Delete"}
                            </button>

                          </div>
                        </td>

                      </tr>
                    )
                  )}

                {!loading &&
                  filteredLeads.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        No leads match your
                        search or filter.
                      </td>
                    </tr>
                  )}

              </tbody>

            </table>

          </div>
        </div>

        {/* ADD / EDIT LEAD MODAL */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">

            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">

              <div className="mb-6 flex items-center justify-between">

                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {editingLeadId
                      ? "Edit Lead"
                      : "Add New Lead"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {editingLeadId
                      ? "Update the prospect's CRM information."
                      : "Enter the prospect's CIU and follow-up information."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg px-3 py-2 text-2xl text-slate-500 hover:bg-slate-100"
                >
                  ×
                </button>

              </div>

              <form
                onSubmit={handleSubmit}
                className="grid gap-4 md:grid-cols-2"
              >

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    CIU Number
                  </label>

                  <input
                    required
                    placeholder="CIU001"
                    value={
                      form.ciuNumber
                    }
                    onChange={(event) =>
                      updateForm(
                        "ciuNumber",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Full Names
                  </label>

                  <input
                    required
                    placeholder="Full name"
                    value={
                      form.fullNames
                    }
                    onChange={(event) =>
                      updateForm(
                        "fullNames",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Telephone Number
                  </label>

                  <input
                    required
                    placeholder="0700000000"
                    value={
                      form.telephone
                    }
                    onChange={(event) =>
                      updateForm(
                        "telephone",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={
                      form.email
                    }
                    onChange={(event) =>
                      updateForm(
                        "email",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Program
                  </label>

                  <input
                    required
                    placeholder="Bachelor of Nursing"
                    value={
                      form.program
                    }
                    onChange={(event) =>
                      updateForm(
                        "program",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Assigned Staff
                  </label>

                  <input
                    placeholder="Admissions / Marketing Team"
                    value={
                      form.assignedStaff
                    }
                    onChange={(event) =>
                      updateForm(
                        "assignedStaff",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Follow Up Status
                  </label>

                  <select
                    value={
                      form.followUp
                    }
                    onChange={(event) =>
                      updateForm(
                        "followUp",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none"
                  >
                    {FOLLOW_UP_STATUSES.map(
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
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Follow Up Date
                  </label>

                  <input
                    type="date"
                    value={
                      form.followUpDate
                    }
                    onChange={(event) =>
                      updateForm(
                        "followUpDate",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Amount Paid (UGX)
                  </label>

                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={
                      form.amountPaid
                    }
                    onChange={(event) =>
                      updateForm(
                        "amountPaid",
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Feedback
                  </label>

                  <textarea
                    placeholder="Enter call, WhatsApp, email or admissions feedback..."
                    value={
                      form.feedback
                    }
                    onChange={(event) =>
                      updateForm(
                        "feedback",
                        event.target
                          .value
                      )
                    }
                    className="min-h-28 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400"
                  />
                </div>

                <div className="flex justify-end gap-3 md:col-span-2">

                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : editingLeadId
                      ? "Update Lead"
                      : "Save Lead"}
                  </button>

                </div>

              </form>

            </div>

          </div>
        )}

        {/* CSV IMPORT MODAL */}
        {showImport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">

            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">

              <div className="mb-6 flex items-start justify-between">

                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Import Leads
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Upload a CSV file to add multiple leads.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowImport(false)
                  }
                  className="rounded-lg px-3 py-2 text-2xl text-slate-500 hover:bg-slate-100"
                >
                  ×
                </button>

              </div>

              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">

                <p className="mb-4 text-sm text-slate-600">
                  Recommended columns:
                </p>

                <p className="mb-5 text-xs text-slate-500">
                  CIU Number, Full Names,
                  Telephone, Email, Program,
                  Feedback, Follow Up, Follow Up
                  Date, Assigned Staff, Amount Paid
                </p>

                <label className="inline-block cursor-pointer rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">

                  Choose CSV File

                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={
                      handleImportCSV
                    }
                    className="hidden"
                  />

                </label>

              </div>

              {importMessage && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                  {importMessage}
                </div>
              )}

              <div className="mt-6 flex justify-end">

                <button
                  type="button"
                  onClick={() =>
                    setShowImport(false)
                  }
                  className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Close
                </button>

              </div>

            </div>

          </div>
        )}

      </div>
    </main>
  );
}

