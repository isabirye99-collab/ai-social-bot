"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  ciu_number: string | null;
  full_names: string | null;
  telephone: string | null;
  email: string | null;
  program: string | null;
  stage: string | null;
  tuition_fee: number | null;
  tuition_paid: number | null;
  application_fee: number | null;
  application_paid: number | null;
  acceptance_fee: number | null;
  acceptance_paid: number | null;
  follow_up_date: string | null;
  last_contact: string | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  lead_id: string | null;
  lead?: {
    id: string;
    name: string | null;
    phone: string | null;
    email: string | null;
    ciu_number: string | null;
    product_service: string | null;
    status: string | null;
    feedback: string | null;
  } | null;
};

const ACTIVE_STAGES = [
  "Admitted",
  "Acceptance Paid",
  "Enrolled",
];

const STAGES = [
  "New",
  "Contacted",
  "Qualified",
  "Application Started",
  "Application Submitted",
  "Admitted",
  "Acceptance Paid",
  "Enrolled",
  "Lost/Dropped",
];

const FOLLOW_UP_REASONS = [
  "Admission confirmation",
  "Acceptance fee reminder",
  "Tuition payment reminder",
  "Missing documents",
  "Programme information",
  "Parent requested a call back",
  "Student requested a call back",
  "General follow-up",
  "Other",
];

function formatUGX(value: number | null | undefined) {
  const amount = Number(value || 0);

  return `UGX ${amount.toLocaleString("en-UG")}`;
}

function formatDate(value: string | null) {
  if (!value) return "No activity";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No activity";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string | null) {
  if (!name) return "CU";

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

export default function Customers() {
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState("");

  const [editForm, setEditForm] = useState({
    ciu_number: "",
    full_names: "",
    telephone: "",
    email: "",
    program: "",
    stage: "New",
    tuition_fee: "",
    tuition_paid: "",
    application_fee: "",
    application_paid: "",
    acceptance_fee: "",
    acceptance_paid: "",
    notes: "",
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All Customers");


  const [showFollowUp, setShowFollowUp] =
    useState(false);

  const [followUpCustomer, setFollowUpCustomer] =
    useState<Customer | null>(null);

  const [followUpForm, setFollowUpForm] = useState({
    date: "",
    reason: "",
    notes: "",
  });

  async function loadCustomers() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("admissions")
      .select(
        "id, lead_id, ciu_number, full_names, telephone, email, program, stage, tuition_fee, tuition_paid, application_fee, application_paid, acceptance_fee, acceptance_paid, follow_up_date, last_contact, notes, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (loadError) {
      console.error(loadError);
      setError(loadError.message);
      setCustomers([]);
      setLoading(false);
      return;
    }

    const admissionRows = (data || []) as Customer[];
    const leadIds = Array.from(
      new Set(
        admissionRows
          .map((customer) => customer.lead_id)
          .filter((id): id is string => Boolean(id))
      )
    );

    if (leadIds.length === 0) {
      setCustomers(admissionRows);
      setLoading(false);
      return;
    }

    const { data: leadRows, error: leadError } = await supabase
      .from("leads")
      .select("id, name, phone, email, ciu_number, product_service, status, feedback")
      .in("id", leadIds);

    if (leadError) {
      console.error(leadError);
      setCustomers(admissionRows);
      setError("Customers loaded, but linked lead information could not be loaded.");
      setLoading(false);
      return;
    }

    const leadMap = new Map(
      (leadRows || []).map((lead) => [lead.id, lead])
    );

    setCustomers(
      admissionRows.map((customer) => ({
        ...customer,
        lead: customer.lead_id
          ? leadMap.get(customer.lead_id) || null
          : null,
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !term ||
        (customer.full_names || "")
          .toLowerCase()
          .includes(term) ||
        (customer.ciu_number || "")
          .toLowerCase()
          .includes(term) ||
        (customer.telephone || "")
          .toLowerCase()
          .includes(term) ||
        (customer.email || "")
          .toLowerCase()
          .includes(term) ||
        (customer.program || "")
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        statusFilter === "All Customers" ||
        customer.stage === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customers, search, statusFilter]);

  const totalCustomers = customers.length;

  const activeCustomers = customers.filter((customer) =>
    ACTIVE_STAGES.includes(customer.stage || "")
  ).length;

  const currentMonth = new Date();

  const newThisMonth = customers.filter((customer) => {
    if (!customer.created_at) return false;

    const created = new Date(customer.created_at);

    return (
      created.getMonth() === currentMonth.getMonth() &&
      created.getFullYear() ===
        currentMonth.getFullYear()
    );
  }).length;

  const customerValue = customers.reduce(
    (total, customer) =>
      total + Number(customer.tuition_fee || 0),
    0
  );

  function openEditCustomer(customer: Customer) {
    setEditingCustomer(customer);
    setEditForm({
      ciu_number: customer.ciu_number || "",
      full_names: customer.full_names || "",
      telephone: customer.telephone || "",
      email: customer.email || "",
      program: customer.program || "",
      stage: customer.stage || "New",
      tuition_fee: String(customer.tuition_fee ?? ""),
      tuition_paid: String(customer.tuition_paid ?? ""),
      application_fee: String(customer.application_fee ?? ""),
      application_paid: String(customer.application_paid ?? ""),
      acceptance_fee: String(customer.acceptance_fee ?? ""),
      acceptance_paid: String(customer.acceptance_paid ?? ""),
      notes: customer.notes || "",
    });
    setError("");
  }

  function closeEditCustomer() {
    if (saving) return;
    setEditingCustomer(null);
    setError("");
  }

  async function handleSaveCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCustomer) return;

    if (!editForm.full_names.trim()) {
      setError("Full names are required.");
      return;
    }

    if (!editForm.program.trim()) {
      setError("Program is required.");
      return;
    }

    setSaving(true);
    setError("");

    const { error: updateError } = await supabase
      .from("admissions")
      .update({
        ciu_number: editForm.ciu_number.trim() || null,
        full_names: editForm.full_names.trim(),
        telephone: editForm.telephone.trim() || null,
        email: editForm.email.trim() || null,
        program: editForm.program.trim(),
        stage: editForm.stage,
        tuition_fee: Number(editForm.tuition_fee || 0),
        tuition_paid: Number(editForm.tuition_paid || 0),
        application_fee: Number(editForm.application_fee || 0),
        application_paid: Number(editForm.application_paid || 0),
        acceptance_fee: Number(editForm.acceptance_fee || 0),
        acceptance_paid: Number(editForm.acceptance_paid || 0),
        notes: editForm.notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingCustomer.id);

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditingCustomer(null);
    await loadCustomers();
  }

  function openFollowUp(customer: Customer) {
    setFollowUpCustomer(customer);

    setFollowUpForm({
      date: customer.follow_up_date || "",
      reason: "",
      notes: "",
    });

    setError("");
    setShowFollowUp(true);
  }

  function closeFollowUp() {
    if (saving) return;

    setShowFollowUp(false);
    setFollowUpCustomer(null);

    setFollowUpForm({
      date: "",
      reason: "",
      notes: "",
    });

    setError("");
  }

  async function handleSaveFollowUp(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!followUpCustomer) return;

    if (!followUpForm.date) {
      setError(
        "Please select a follow-up date."
      );
      return;
    }

    if (!followUpForm.reason.trim()) {
      setError(
        "Please select a reason for the follow-up."
      );
      return;
    }

    setSaving(true);
    setError("");

    const followUpNote =
      `Follow-up Date: ${followUpForm.date}\n` +
      `Reason: ${followUpForm.reason.trim()}\n` +
      `Notes: ${followUpForm.notes.trim()}`;

    const { error: updateError } =
      await supabase
        .from("admissions")
        .update({
          follow_up_date: followUpForm.date,
          notes: followUpNote,
        })
        .eq("id", followUpCustomer.id);

    if (updateError) {
      console.error(updateError);
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);

    setShowFollowUp(false);
    setFollowUpCustomer(null);

    setFollowUpForm({
      date: "",
      reason: "",
      notes: "",
    });

    await loadCustomers();
  }

  return (
    <>
      <div
        className="crm-page-heading"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: "4px",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "6px" }}>Customers</h1>
          <p style={{ margin: 0 }}>
            View students and admissions from the same records used across the CRM.
          </p>
        </div>
      </div>

      <div className="crm-kpis">
        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Total Customers
          </span>

          <div className="crm-kpi-value">
            {totalCustomers}
          </div>

          <span className="crm-kpi-change">
            All records
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Active
          </span>

          <div className="crm-kpi-value">
            {activeCustomers}
          </div>

          <span className="crm-kpi-change">
            {totalCustomers
              ? `${Math.round(
                  (activeCustomers /
                    totalCustomers) *
                    100
                )}% of customers`
              : "0% of customers"}
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">
            New This Month
          </span>

          <div className="crm-kpi-value">
            {newThisMonth}
          </div>

          <span className="crm-kpi-change">
            New admissions
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Customer Value
          </span>

          <div className="crm-kpi-value">
            {formatUGX(customerValue)}
          </div>

          <span className="crm-kpi-change">
            Total tuition value
          </span>
        </div>
      </div>

      {error && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div className="crm-card">
        <div
          className="crm-filterbar"
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="🔍 Search customers..."
            style={{
              flex: 1,
              minWidth: 240,
            }}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option>All Customers</option>

            {STAGES.map((stage) => (
              <option key={stage}>
                {stage}
              </option>
            ))}
          </select>
        </div>

        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Program</th>
                <th>Status</th>
                <th>Value</th>
                <th>Follow-Up</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: 30,
                    }}
                  >
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      padding: 30,
                    }}
                  >
                    No customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(
                  (customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "#eff6ff",
                              color: "#2563eb",
                              fontWeight: 700,
                              fontSize: 13,
                              flexShrink: 0,
                            }}
                          >
                            {getInitials(
                              customer.full_names
                            )}
                          </div>

                          <div>
                            <strong>
                              {customer.full_names ||
                                "Unnamed Customer"}
                            </strong>

                            <div
                              style={{
                                fontSize: 12,
                                opacity: 0.65,
                                marginTop: 3,
                              }}
                            >
                              {customer.ciu_number ||
                                customer.telephone ||
                                customer.email ||
                                "No contact details"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        {customer.program ||
                          "Not specified"}
                      </td>

                      <td>
                        <span
                          className={`crm-badge ${
                            customer.stage ===
                            "Lost/Dropped"
                              ? "red"
                              : ""
                          }`}
                        >
                          {customer.stage || "New"}
                        </span>
                      </td>

                      <td>
                        {formatUGX(
                          customer.tuition_fee
                        )}
                      </td>

                      <td>
                        {customer.follow_up_date ? (
                          <div>
                            <strong
                              style={{
                                display: "block",
                                fontSize: 13,
                              }}
                            >
                              {formatDate(
                                customer.follow_up_date
                              )}
                            </strong>

                            <span
                              style={{
                                fontSize: 12,
                                opacity: 0.65,
                              }}
                            >
                              Scheduled
                            </span>
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: 13,
                              opacity: 0.55,
                            }}
                          >
                            Not scheduled
                          </span>
                        )}
                      </td>

                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => openEditCustomer(customer)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              visibility: "visible",
                              opacity: 1,
                              color: "#7c3aed",
                              background: "#f5f3ff",
                              border: "1px solid #ddd6fe",
                              padding: "7px 13px",
                              borderRadius: 7,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            Edit Customer
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingCustomer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setViewingCustomer(null);
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 700,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                  Student Details
                </h2>
                <p style={{ margin: "5px 0 0", fontSize: 13, opacity: 0.65 }}>
                  {viewingCustomer.full_names || "Student"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  visibility: "visible",
                  opacity: 1,
                  color: "#374151",
                  background: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  fontSize: 22,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              {[
                ["CIU Number", viewingCustomer.ciu_number || "Not provided"],
                ["Full Names", viewingCustomer.full_names || "Not provided"],
                ["Telephone", viewingCustomer.telephone || "Not provided"],
                ["Email", viewingCustomer.email || "Not provided"],
                ["Program", viewingCustomer.program || "Not provided"],
                ["Stage", viewingCustomer.stage || "New"],
                ["Application Paid", formatUGX(viewingCustomer.application_paid)],
                ["Acceptance Paid", formatUGX(viewingCustomer.acceptance_paid)],
                ["Tuition Paid", formatUGX(viewingCustomer.tuition_paid)],
                ["Tuition Value", formatUGX(viewingCustomer.tuition_fee)],
                ["Follow-Up", viewingCustomer.follow_up_date ? formatDate(viewingCustomer.follow_up_date) : "Not scheduled"],
                ["Last Contact", viewingCustomer.last_contact ? formatDate(viewingCustomer.last_contact) : "No activity"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    padding: 14,
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    background: "#f9fafb",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>
                    {label}
                  </div>
                  <strong style={{ fontSize: 14 }}>{value}</strong>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 16,
                border: "1px solid #dbeafe",
                borderRadius: 8,
                background: "#eff6ff",
              }}
            >
              <strong style={{ display: "block", marginBottom: 6 }}>
                Linked Lead
              </strong>

              {viewingCustomer.lead ? (
                <>
                  <div style={{ fontSize: 14 }}>
                    {viewingCustomer.lead.name || "Unnamed Lead"}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                    {viewingCustomer.lead.phone ||
                      viewingCustomer.lead.email ||
                      "No contact details"}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                    Lead status: {viewingCustomer.lead.status || "Not specified"}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, opacity: 0.7 }}>
                  This admission is not currently linked to a Lead.
                </div>
              )}
            </div>

            {viewingCustomer.notes && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                }}
              >
                <strong style={{ display: "block", marginBottom: 6 }}>
                  Notes
                </strong>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>
                  {viewingCustomer.notes}
                </div>
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 24,
                flexWrap: "wrap",
              }}
            >
              {viewingCustomer.telephone && (
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `tel:${viewingCustomer.telephone}`;
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    visibility: "visible",
                    opacity: 1,
                    color: "#374151",
                    background: "#ffffff",
                    border: "1px solid #d1d5db",
                    padding: "10px 16px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Call
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setViewingCustomer(null);
                  openFollowUp(viewingCustomer);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  visibility: "visible",
                  opacity: 1,
                  color: "#ffffff",
                  background: "#16a34a",
                  border: "1px solid #16a34a",
                  padding: "10px 16px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Follow Up
              </button>
            </div>
          </div>
        </div>
      )}

      {editingCustomer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1050,
            background: "rgba(15, 23, 42, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditCustomer();
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 760,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#ffffff",
              borderRadius: 12,
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                  Edit Student
                </h2>
                <p style={{ margin: "5px 0 0", fontSize: 13, opacity: 0.65 }}>
                  Update admission and payment information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditCustomer}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  visibility: "visible",
                  opacity: 1,
                  color: "#374151",
                  background: "#f3f4f6",
                  border: "1px solid #d1d5db",
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  fontSize: 22,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveCustomer}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                {[
                  ["CIU Number", "ciu_number", "text"],
                  ["Full Names *", "full_names", "text"],
                  ["Telephone", "telephone", "text"],
                  ["Email", "email", "email"],
                  ["Program *", "program", "text"],
                  ["Tuition Fee", "tuition_fee", "number"],
                  ["Tuition Paid", "tuition_paid", "number"],
                  ["Application Fee", "application_fee", "number"],
                  ["Application Paid", "application_paid", "number"],
                  ["Acceptance Fee", "acceptance_fee", "number"],
                  ["Acceptance Paid", "acceptance_paid", "number"],
                ].map(([label, field, type]) => (
                  <div key={field}>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {label}
                    </label>
                    <input
                      type={type}
                      value={editForm[field as keyof typeof editForm]}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          [field]: event.target.value,
                        })
                      }
                      required={field === "full_names" || field === "program"}
                      style={{ width: "100%" }}
                    />
                  </div>
                ))}

                <div>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 6,
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Stage
                  </label>
                  <select
                    value={editForm.stage}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        stage: event.target.value,
                      })
                    }
                    style={{ width: "100%" }}
                  >
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Notes
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      notes: event.target.value,
                    })
                  }
                  rows={4}
                  style={{ width: "100%", resize: "vertical" }}
                />
              </div>

              {error && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #fecaca",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 24,
                }}
              >
                <button
                  type="button"
                  onClick={closeEditCustomer}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    visibility: "visible",
                    opacity: 1,
                    color: "#374151",
                    background: "#ffffff",
                    border: "1px solid #d1d5db",
                    padding: "10px 16px",
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
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    visibility: "visible",
                    opacity: 1,
                    color: "#ffffff",
                    background: "#7c3aed",
                    border: "1px solid #7c3aed",
                    padding: "10px 16px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: saving ? "not-allowed" : "pointer",
                    minHeight: 40,
                  }}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFollowUp &&
        followUpCustomer && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1100,
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
                closeFollowUp();
              }
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 560,
                background: "#ffffff",
                borderRadius: 12,
                padding: 24,
                boxShadow:
                  "0 20px 50px rgba(0,0,0,0.2)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  marginBottom: 20,
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
                    Schedule Follow Up
                  </h2>

                  <p
                    style={{
                      margin:
                        "5px 0 0",
                      fontSize: 13,
                      opacity: 0.65,
                    }}
                  >
                    {followUpCustomer.full_names ||
                      "Customer"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeFollowUp}
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
                    color: "#374151",
                    background:
                      "#f3f4f6",
                    border:
                      "1px solid #d1d5db",
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    fontSize: 22,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={
                  handleSaveFollowUp
                }
              >
                <div
                  style={{
                    display: "grid",
                    gap: 16,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Follow-Up Date *
                    </label>

                    <input
                      type="date"
                      value={
                        followUpForm.date
                      }
                      onChange={(event) =>
                        setFollowUpForm({
                          ...followUpForm,
                          date:
                            event.target
                              .value,
                        })
                      }
                      required
                      style={{
                        width: "100%",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Reason for Follow-Up *
                    </label>

                    <select
                      value={
                        followUpForm.reason
                      }
                      onChange={(event) =>
                        setFollowUpForm({
                          ...followUpForm,
                          reason:
                            event.target
                              .value,
                        })
                      }
                      required
                      style={{
                        width: "100%",
                      }}
                    >
                      <option value="">
                        Select reason
                      </option>

                      {FOLLOW_UP_REASONS.map(
                        (reason) => (
                          <option
                            key={reason}
                            value={reason}
                          >
                            {reason}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label
                      style={{
                        display: "block",
                        marginBottom: 6,
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      Additional Notes
                    </label>

                    <textarea
                      value={
                        followUpForm.notes
                      }
                      onChange={(event) =>
                        setFollowUpForm({
                          ...followUpForm,
                          notes:
                            event.target
                              .value,
                        })
                      }
                      placeholder="Enter any additional information..."
                      rows={4}
                      style={{
                        width: "100%",
                        resize: "vertical",
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
                    marginTop: 24,
                  }}
                >
                  <button
                    type="button"
                    onClick={closeFollowUp}
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
                      opacity: 1,
                      color: "#ffffff",
                      background:
                        "#16a34a",
                      border:
                        "1px solid #16a34a",
                      padding:
                        "10px 16px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: saving
                        ? "not-allowed"
                        : "pointer",
                      minHeight: 40,
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    {saving
                      ? "Saving..."
                      : "Save Follow Up"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </>
  );
}