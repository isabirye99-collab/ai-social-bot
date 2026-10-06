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
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All Customers");

  const [showAddCustomer, setShowAddCustomer] =
    useState(false);

  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [showFollowUp, setShowFollowUp] =
    useState(false);

  const [followUpCustomer, setFollowUpCustomer] =
    useState<Customer | null>(null);

  const [form, setForm] = useState({
    ciu_number: "",
    full_names: "",
    telephone: "",
    email: "",
    program: "",
    stage: "Admitted",
    tuition_fee: "",
  });

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
        "id, ciu_number, full_names, telephone, email, program, stage, tuition_fee, tuition_paid, application_fee, application_paid, acceptance_fee, acceptance_paid, follow_up_date, last_contact, notes, created_at, updated_at"
      )
      .order("created_at", {
        ascending: false,
      });

    if (loadError) {
      console.error(loadError);
      setError(loadError.message);
      setCustomers([]);
    } else {
      setCustomers((data || []) as Customer[]);
    }

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

  function resetForm() {
    setForm({
      ciu_number: "",
      full_names: "",
      telephone: "",
      email: "",
      program: "",
      stage: "Admitted",
      tuition_fee: "",
    });
  }

  function openAddCustomer() {
    resetForm();
    setEditingCustomer(null);
    setError("");
    setShowAddCustomer(true);
  }

  function openEditCustomer(customer: Customer) {
    setForm({
      ciu_number: customer.ciu_number || "",
      full_names: customer.full_names || "",
      telephone: customer.telephone || "",
      email: customer.email || "",
      program: customer.program || "",
      stage: customer.stage || "Admitted",
      tuition_fee:
        customer.tuition_fee !== null
          ? String(customer.tuition_fee)
          : "",
    });

    setEditingCustomer(customer);
    setError("");
    setShowAddCustomer(true);
  }

  function closeModal() {
    if (saving) return;

    setShowAddCustomer(false);
    setEditingCustomer(null);
    resetForm();
    setError("");
  }

  async function handleSaveCustomer(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!form.full_names.trim()) {
      setError("Customer full name is required.");
      return;
    }

    if (!form.program.trim()) {
      setError("Program is required.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      ciu_number:
        form.ciu_number.trim() || null,

      full_names: form.full_names.trim(),

      telephone:
        form.telephone.trim() || null,

      email:
        form.email.trim() || null,

      program: form.program.trim(),

      stage: form.stage,

      tuition_fee: form.tuition_fee
        ? Number(form.tuition_fee)
        : 0,
    };

    if (editingCustomer) {
      const { error: updateError } =
        await supabase
          .from("admissions")
          .update(payload)
          .eq("id", editingCustomer.id);

      if (updateError) {
        console.error(updateError);
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } =
        await supabase
          .from("admissions")
          .insert(payload);

      if (insertError) {
        console.error(insertError);
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowAddCustomer(false);
    setEditingCustomer(null);
    resetForm();

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
      <div className="crm-page-heading">
        <div>
          <h1>Customers</h1>

          <p>
            Manage your customers, students and
            their relationships.
          </p>
        </div>

        <button
          type="button"
          className="crm-btn"
          onClick={openAddCustomer}
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
          + Add Customer
        </button>
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
                <th>Action</th>
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
                            onClick={() =>
                              openFollowUp(
                                customer
                              )
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent:
                                "center",
                              visibility: "visible",
                              opacity: 1,
                              color: "#ffffff",
                              background: "#16a34a",
                              border:
                                "1px solid #16a34a",
                              padding:
                                "7px 11px",
                              borderRadius: 7,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            Follow Up
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEditCustomer(
                                customer
                              )
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent:
                                "center",
                              visibility: "visible",
                              opacity: 1,
                              color: "#2563eb",
                              background: "#eff6ff",
                              border:
                                "1px solid #bfdbfe",
                              padding:
                                "7px 11px",
                              borderRadius: 7,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            Edit
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

      {showAddCustomer && (
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
              closeModal();
            }
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 650,
              maxHeight: "90vh",
              overflowY: "auto",
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
                justifyContent: "space-between",
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
                  {editingCustomer
                    ? "Edit Customer"
                    : "Add Customer"}
                </h2>

                <p
                  style={{
                    margin: "5px 0 0",
                    fontSize: 13,
                    opacity: 0.65,
                  }}
                >
                  {editingCustomer
                    ? "Update customer information."
                    : "Add a new customer to the CRM."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  visibility: "visible",
                  opacity: 1,
                  color: "#374151",
                  background: "#f3f4f6",
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
              onSubmit={handleSaveCustomer}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: 16,
                }}
              >
                <div>
                  <label>CIU Number</label>

                  <input
                    value={form.ciu_number}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        ciu_number:
                          event.target.value,
                      })
                    }
                    placeholder="e.g. CIU24567890"
                  />
                </div>

                <div>
                  <label>
                    Full Names *
                  </label>

                  <input
                    value={form.full_names}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        full_names:
                          event.target.value,
                      })
                    }
                    placeholder="Full customer name"
                    required
                  />
                </div>

                <div>
                  <label>
                    Telephone
                  </label>

                  <input
                    value={form.telephone}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        telephone:
                          event.target.value,
                      })
                    }
                    placeholder="07XXXXXXXX"
                  />
                </div>

                <div>
                  <label>Email</label>

                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        email:
                          event.target.value,
                      })
                    }
                    placeholder="customer@email.com"
                  />
                </div>

                <div
                  style={{
                    gridColumn: "1 / -1",
                  }}
                >
                  <label>
                    Program *
                  </label>

                  <input
                    value={form.program}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        program:
                          event.target.value,
                      })
                    }
                    placeholder="e.g. Bachelor of Nursing"
                    required
                  />
                </div>

                <div>
                  <label>Status</label>

                  <select
                    value={form.stage}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        stage:
                          event.target.value,
                      })
                    }
                  >
                    {STAGES.map(
                      (stage) => (
                        <option
                          key={stage}
                        >
                          {stage}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label>
                    Tuition Fee
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={form.tuition_fee}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        tuition_fee:
                          event.target.value,
                      })
                    }
                    placeholder="e.g. 1600000"
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
                  onClick={closeModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent:
                      "center",
                    visibility: "visible",
                    opacity: 1,
                    color: "#374151",
                    background: "#ffffff",
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
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent:
                      "center",
                    visibility: "visible",
                    opacity: 1,
                    color: "#ffffff",
                    background: "#2563eb",
                    border:
                      "1px solid #2563eb",
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
                    : editingCustomer
                    ? "Update Customer"
                    : "Create Customer"}
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