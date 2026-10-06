"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  ciu_number: string | null;
  product_service: string | null;
  status: string | null;
  feedback: string | null;
};

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
  lead?: Lead | null;
};

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

const ACTIVE_STAGES = [
  "Admitted",
  "Acceptance Paid",
  "Enrolled",
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

const EMPTY_EDIT_FORM = {
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
};

const EMPTY_FOLLOW_UP_FORM = {
  date: "",
  reason: "",
  notes: "",
};

function formatUGX(value: number | null | undefined) {
  return `UGX ${Number(value || 0).toLocaleString("en-UG")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(name: string | null) {
  if (!name?.trim()) return "ST";

  const parts = name.trim().split(/\s+/);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function toNumber(value: string) {
  const number = Number(value);

  return Number.isFinite(number) ? number : 0;
}

export default function Customers() {
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All Customers");

  const [viewingCustomer, setViewingCustomer] =
    useState<Customer | null>(null);

  const [editingCustomer, setEditingCustomer] =
    useState<Customer | null>(null);

  const [showFollowUp, setShowFollowUp] =
    useState(false);

  const [followUpCustomer, setFollowUpCustomer] =
    useState<Customer | null>(null);

  const [editForm, setEditForm] =
    useState(EMPTY_EDIT_FORM);

  const [followUpForm, setFollowUpForm] =
    useState(EMPTY_FOLLOW_UP_FORM);

  async function loadCustomers() {
    setLoading(true);
    setError("");

    const { data, error: loadError } =
      await supabase
        .from("admissions")
        .select(
          `
          id,
          lead_id,
          ciu_number,
          full_names,
          telephone,
          email,
          program,
          stage,
          tuition_fee,
          tuition_paid,
          application_fee,
          application_paid,
          acceptance_fee,
          acceptance_paid,
          follow_up_date,
          last_contact,
          notes,
          created_at,
          updated_at
          `
        )
        .order("created_at", {
          ascending: false,
        });

    if (loadError) {
      console.error(loadError);

      setCustomers([]);
      setError(loadError.message);
      setLoading(false);

      return;
    }

    const admissionRows =
      (data || []) as Customer[];

    const leadIds = Array.from(
      new Set(
        admissionRows
          .map(
            (customer) => customer.lead_id
          )
          .filter(
            (id): id is string =>
              Boolean(id)
          )
      )
    );

    if (leadIds.length === 0) {
      setCustomers(admissionRows);
      setLoading(false);
      return;
    }

    const { data: leadRows, error: leadError } =
      await supabase
        .from("leads")
        .select(
          `
          id,
          name,
          phone,
          email,
          ciu_number,
          product_service,
          status,
          feedback
          `
        )
        .in("id", leadIds);

    if (leadError) {
      console.error(leadError);

      setCustomers(admissionRows);

      setError(
        "Customers loaded, but linked lead information could not be loaded."
      );

      setLoading(false);
      return;
    }

    const leadMap = new Map(
      (leadRows || []).map(
        (lead) => [
          lead.id,
          lead as Lead,
        ]
      )
    );

    setCustomers(
      admissionRows.map(
        (customer) => ({
          ...customer,
          lead: customer.lead_id
            ? leadMap.get(
                customer.lead_id
              ) || null
            : null,
        })
      )
    );

    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const term =
      search.trim().toLowerCase();

    return customers.filter(
      (customer) => {
        const searchable = [
          customer.full_names,
          customer.ciu_number,
          customer.telephone,
          customer.email,
          customer.program,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !term ||
          searchable.includes(term);

        const matchesStatus =
          statusFilter ===
            "All Customers" ||
          customer.stage ===
            statusFilter;

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );
  }, [
    customers,
    search,
    statusFilter,
  ]);

  const totalCustomers =
    customers.length;

  const activeStudents =
    customers.filter((customer) =>
      ACTIVE_STAGES.includes(
        customer.stage || ""
      )
    ).length;

  const newThisMonth =
    customers.filter((customer) => {
      if (!customer.created_at) {
        return false;
      }

      const date = new Date(
        customer.created_at
      );

      const now = new Date();

      return (
        date.getMonth() ===
          now.getMonth() &&
        date.getFullYear() ===
          now.getFullYear()
      );
    }).length;

  const totalTuitionValue =
    customers.reduce(
      (sum, customer) =>
        sum +
        Number(
          customer.tuition_fee || 0
        ),
      0
    );

  function openViewCustomer(
    customer: Customer
  ) {
    setError("");
    setViewingCustomer(customer);
  }

  function openEditCustomer(
    customer: Customer
  ) {
    setError("");

    setEditingCustomer(customer);

    setEditForm({
      ciu_number:
        customer.ciu_number || "",

      full_names:
        customer.full_names || "",

      telephone:
        customer.telephone || "",

      email:
        customer.email || "",

      program:
        customer.program || "",

      stage:
        customer.stage || "New",

      tuition_fee:
        String(
          customer.tuition_fee ?? ""
        ),

      tuition_paid:
        String(
          customer.tuition_paid ?? ""
        ),

      application_fee:
        String(
          customer.application_fee ?? ""
        ),

      application_paid:
        String(
          customer.application_paid ?? ""
        ),

      acceptance_fee:
        String(
          customer.acceptance_fee ?? ""
        ),

      acceptance_paid:
        String(
          customer.acceptance_paid ?? ""
        ),

      notes:
        customer.notes || "",
    });
  }

  function closeEditCustomer() {
    if (saving) return;

    setEditingCustomer(null);
    setError("");
  }

  function openFollowUp(
    customer: Customer
  ) {
    setError("");

    setFollowUpCustomer(customer);

    setFollowUpForm({
      date:
        customer.follow_up_date || "",

      reason: "",

      notes: "",
    });

    setShowFollowUp(true);
  }

  function closeFollowUp() {
    if (saving) return;

    setShowFollowUp(false);

    setFollowUpCustomer(null);

    setFollowUpForm(
      EMPTY_FOLLOW_UP_FORM
    );

    setError("");
  }

  async function handleSaveCustomer(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!editingCustomer) return;

    if (!editForm.full_names.trim()) {
      setError(
        "Full names are required."
      );

      return;
    }

    if (!editForm.program.trim()) {
      setError(
        "Program is required."
      );

      return;
    }

    setSaving(true);
    setError("");

    const { error: updateError } =
      await supabase
        .from("admissions")
        .update({
          ciu_number:
            editForm.ciu_number.trim() ||
            null,

          full_names:
            editForm.full_names.trim(),

          telephone:
            editForm.telephone.trim() ||
            null,

          email:
            editForm.email.trim() ||
            null,

          program:
            editForm.program.trim(),

          stage: editForm.stage,

          tuition_fee:
            toNumber(
              editForm.tuition_fee
            ),

          tuition_paid:
            toNumber(
              editForm.tuition_paid
            ),

          application_fee:
            toNumber(
              editForm.application_fee
            ),

          application_paid:
            toNumber(
              editForm.application_paid
            ),

          acceptance_fee:
            toNumber(
              editForm.acceptance_fee
            ),

          acceptance_paid:
            toNumber(
              editForm.acceptance_paid
            ),

          notes:
            editForm.notes.trim() ||
            null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          editingCustomer.id
        );

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

  async function handleSaveFollowUp(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!followUpCustomer) {
      return;
    }

    if (!followUpForm.date) {
      setError(
        "Please select a follow-up date."
      );

      return;
    }

    if (!followUpForm.reason) {
      setError(
        "Please select a reason for the follow-up."
      );

      return;
    }

    setSaving(true);
    setError("");

    const existingNotes =
      followUpCustomer.notes?.trim();

    const followUpNote = [
      existingNotes || "",
      `Follow-up Date: ${followUpForm.date}`,
      `Reason: ${followUpForm.reason}`,
      `Follow-up Notes: ${
        followUpForm.notes.trim() ||
        "None"
      }`,
    ]
      .filter(Boolean)
      .join("\n");

    const { error: updateError } =
      await supabase
        .from("admissions")
        .update({
          follow_up_date:
            followUpForm.date,

          notes:
            followUpNote || null,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          followUpCustomer.id
        );

    if (updateError) {
      console.error(updateError);

      setError(updateError.message);
      setSaving(false);

      return;
    }

    setSaving(false);

    closeFollowUp();

    await loadCustomers();
  }

  function callStudent(
    telephone: string | null
  ) {
    if (!telephone) return;

    window.location.href =
      `tel:${telephone}`;
  }

  return (
    <>
      <div
        className="crm-page-heading"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 4,
        }}
      >
        <h1
          style={{
            marginBottom: 6,
          }}
        >
          Customers
        </h1>

        <p
          style={{
            margin: 0,
          }}
        >
          Manage students, admissions,
          payments and follow-ups from
          one place.
        </p>
      </div>

      {/* KPI SECTION */}

      <div className="crm-kpis">
        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Total Customers
          </span>

          <div className="crm-kpi-value">
            {totalCustomers}
          </div>

          <span className="crm-kpi-change">
            All admission records
          </span>
        </div>

        <div className="crm-kpi">
          <span className="crm-kpi-label">
            Active Students
          </span>

          <div className="crm-kpi-value">
            {activeStudents}
          </div>

          <span className="crm-kpi-change">
            Admitted, paid or enrolled
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
            Total Tuition Value
          </span>

          <div
            className="crm-kpi-value"
            style={{
              fontSize: 22,
            }}
          >
            {formatUGX(
              totalTuitionValue
            )}
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
            border:
              "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* CUSTOMER TABLE */}

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
              setSearch(
                event.target.value
              )
            }
            placeholder="🔍 Search students..."
            style={{
              flex: 1,
              minWidth: 240,
            }}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option>
              All Customers
            </option>

            {STAGES.map((stage) => (
              <option
                key={stage}
                value={stage}
              >
                {stage}
              </option>
            ))}
          </select>
        </div>

        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>CIU Number</th>
                <th>Programme</th>
                <th>Stage</th>
                <th>Tuition</th>
                <th>Follow-Up</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign:
                        "center",
                      padding: 30,
                    }}
                  >
                    Loading customers...
                  </td>
                </tr>
              ) : filteredCustomers.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      textAlign:
                        "center",
                      padding: 30,
                    }}
                  >
                    No customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(
                  (customer) => (
                    <tr
                      key={
                        customer.id
                      }
                    >
                      <td>
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius:
                                "50%",
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              background:
                                "#eff6ff",
                              color:
                                "#2563eb",
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
                                "Unnamed Student"}
                            </strong>

                            <div
                              style={{
                                fontSize: 12,
                                opacity:
                                  0.65,
                                marginTop:
                                  3,
                              }}
                            >
                              {customer.telephone ||
                                customer.email ||
                                "No contact details"}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        {customer.ciu_number ||
                          "Not provided"}
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
                          {customer.stage ||
                            "New"}
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
                                display:
                                  "block",
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
                                opacity:
                                  0.65,
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

                      {/* ACTIONS */}

                      <td>
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: 7,
                            flexWrap:
                              "wrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openViewCustomer(
                                customer
                              )
                            }
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
                                "#2563eb",
                              background:
                                "#eff6ff",
                              border:
                                "1px solid #bfdbfe",
                              padding:
                                "7px 12px",
                              borderRadius:
                                7,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor:
                                "pointer",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openEditCustomer(
                                customer
                              )
                            }
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
                                "#7c3aed",
                              background:
                                "#f5f3ff",
                              border:
                                "1px solid #ddd6fe",
                              padding:
                                "7px 12px",
                              borderRadius:
                                7,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor:
                                "pointer",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openFollowUp(
                                customer
                              )
                            }
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
                                "#15803d",
                              background:
                                "#f0fdf4",
                              border:
                                "1px solid #bbf7d0",
                              padding:
                                "7px 12px",
                              borderRadius:
                                7,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor:
                                "pointer",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            Follow Up
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

      {/* VIEW STUDENT MODAL */}

      {viewingCustomer && (
        <div
          style={modalOverlayStyle(
            1000
          )}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setViewingCustomer(
                null
              );
            }
          }}
        >
          <div
            style={{
              ...modalStyle,
              maxWidth: 780,
            }}
          >
            <ModalHeader
              title="Student Details"
              subtitle={
                viewingCustomer.full_names ||
                "Student"
              }
              onClose={() =>
                setViewingCustomer(
                  null
                )
              }
            />

            {/* PERSONAL DETAILS */}

            <h3
              style={{
                fontSize: 15,
                margin:
                  "0 0 10px",
              }}
            >
              Personal & Admission
              Information
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              <DetailBox
                label="CIU Number"
                value={
                  viewingCustomer.ciu_number ||
                  "Not provided"
                }
              />

              <DetailBox
                label="Full Names"
                value={
                  viewingCustomer.full_names ||
                  "Not provided"
                }
              />

              <DetailBox
                label="Telephone"
                value={
                  viewingCustomer.telephone ||
                  "Not provided"
                }
              />

              <DetailBox
                label="Email"
                value={
                  viewingCustomer.email ||
                  "Not provided"
                }
              />

              <DetailBox
                label="Programme"
                value={
                  viewingCustomer.program ||
                  "Not provided"
                }
              />

              <DetailBox
                label="Admission Stage"
                value={
                  viewingCustomer.stage ||
                  "New"
                }
              />
            </div>

            {/* PAYMENT INFORMATION */}

            <h3
              style={{
                fontSize: 15,
                margin:
                  "22px 0 10px",
              }}
            >
              Payment Information
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: 14,
              }}
            >
              <DetailBox
                label="Application Fee"
                value={formatUGX(
                  viewingCustomer.application_fee
                )}
              />

              <DetailBox
                label="Application Paid"
                value={formatUGX(
                  viewingCustomer.application_paid
                )}
              />

              <DetailBox
                label="Acceptance Fee"
                value={formatUGX(
                  viewingCustomer.acceptance_fee
                )}
              />

              <DetailBox
                label="Acceptance Paid"
                value={formatUGX(
                  viewingCustomer.acceptance_paid
                )}
              />

              <DetailBox
                label="Tuition Fee"
                value={formatUGX(
                  viewingCustomer.tuition_fee
                )}
              />

              <DetailBox
                label="Tuition Paid"
                value={formatUGX(
                  viewingCustomer.tuition_paid
                )}
              />

              <DetailBox
                label="Outstanding Balance"
                value={formatUGX(
                  Number(
                    viewingCustomer.tuition_fee ||
                      0
                  ) -
                    Number(
                      viewingCustomer.tuition_paid ||
                        0
                    )
                )}
              />

              <DetailBox
                label="Follow-Up"
                value={
                  viewingCustomer.follow_up_date
                    ? formatDate(
                        viewingCustomer.follow_up_date
                      )
                    : "Not scheduled"
                }
              />
            </div>

            {/* LINKED LEAD */}

            <div
              style={{
                marginTop: 18,
                padding: 16,
                border:
                  "1px solid #dbeafe",
                borderRadius: 8,
                background:
                  "#eff6ff",
              }}
            >
              <strong
                style={{
                  display:
                    "block",
                  marginBottom: 7,
                }}
              >
                Linked Lead
              </strong>

              {viewingCustomer.lead ? (
                <>
                  <div
                    style={{
                      fontSize: 14,
                    }}
                  >
                    {viewingCustomer
                      .lead.name ||
                      "Unnamed Lead"}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.7,
                      marginTop: 4,
                    }}
                  >
                    {viewingCustomer
                      .lead.phone ||
                      viewingCustomer
                        .lead.email ||
                      "No contact details"}
                  </div>

                  <div
                    style={{
                      fontSize: 13,
                      opacity: 0.7,
                      marginTop: 4,
                    }}
                  >
                    Lead status:{" "}
                    {viewingCustomer
                      .lead.status ||
                      "Not specified"}
                  </div>

                  {viewingCustomer
                    .lead.feedback && (
                    <div
                      style={{
                        fontSize: 13,
                        marginTop: 8,
                      }}
                    >
                      Feedback:{" "}
                      {
                        viewingCustomer
                          .lead.feedback
                      }
                    </div>
                  )}
                </>
              ) : (
                <div
                  style={{
                    fontSize: 13,
                    opacity: 0.7,
                  }}
                >
                  This admission is
                  not currently linked
                  to a Lead.
                </div>
              )}
            </div>

            {/* NOTES */}

            <div
              style={{
                marginTop: 16,
                padding: 16,
                border:
                  "1px solid #e5e7eb",
                borderRadius: 8,
              }}
            >
              <strong
                style={{
                  display:
                    "block",
                  marginBottom: 7,
                }}
              >
                Notes
              </strong>

              <div
                style={{
                  whiteSpace:
                    "pre-wrap",
                  fontSize: 14,
                }}
              >
                {viewingCustomer.notes ||
                  "No notes recorded."}
              </div>
            </div>

            {/* ACTIONS */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "flex-end",
                gap: 10,
                marginTop: 24,
                flexWrap: "wrap",
              }}
            >
              {viewingCustomer.telephone && (
                <button
                  type="button"
                  onClick={() =>
                    callStudent(
                      viewingCustomer.telephone
                    )
                  }
                  style={
                    secondaryButtonStyle
                  }
                >
                  Call
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  const customer =
                    viewingCustomer;

                  setViewingCustomer(
                    null
                  );

                  openFollowUp(
                    customer
                  );
                }}
                style={
                  greenButtonStyle
                }
              >
                Follow Up
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MODAL */}

      {editingCustomer && (
        <div
          style={modalOverlayStyle(
            1050
          )}
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeEditCustomer();
            }
          }}
        >
          <div
            style={{
              ...modalStyle,
              maxWidth: 820,
            }}
          >
            <ModalHeader
              title="Edit Student"
              subtitle="Update admission and payment information."
              onClose={
                closeEditCustomer
              }
            />

            <form
              onSubmit={
                handleSaveCustomer
              }
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                <FormField
                  label="CIU Number"
                  value={
                    editForm.ciu_number
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      ciu_number:
                        value,
                    })
                  }
                />

                <FormField
                  label="Full Names *"
                  value={
                    editForm.full_names
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      full_names:
                        value,
                    })
                  }
                  required
                />

                <FormField
                  label="Telephone"
                  value={
                    editForm.telephone
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      telephone:
                        value,
                    })
                  }
                />

                <FormField
                  label="Email"
                  type="email"
                  value={
                    editForm.email
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      email: value,
                    })
                  }
                />

                <FormField
                  label="Programme *"
                  value={
                    editForm.program
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      program: value,
                    })
                  }
                  required
                />

                <div>
                  <label
                    style={
                      labelStyle
                    }
                  >
                    Admission Stage
                  </label>

                  <select
                    value={
                      editForm.stage
                    }
                    onChange={(
                      event
                    ) =>
                      setEditForm({
                        ...editForm,
                        stage:
                          event.target
                            .value,
                      })
                    }
                    style={{
                      width: "100%",
                    }}
                  >
                    {STAGES.map(
                      (stage) => (
                        <option
                          key={
                            stage
                          }
                          value={
                            stage
                          }
                        >
                          {stage}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <FormField
                  label="Tuition Fee"
                  type="number"
                  value={
                    editForm.tuition_fee
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      tuition_fee:
                        value,
                    })
                  }
                />

                <FormField
                  label="Tuition Paid"
                  type="number"
                  value={
                    editForm.tuition_paid
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      tuition_paid:
                        value,
                    })
                  }
                />

                <FormField
                  label="Application Fee"
                  type="number"
                  value={
                    editForm.application_fee
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      application_fee:
                        value,
                    })
                  }
                />

                <FormField
                  label="Application Paid"
                  type="number"
                  value={
                    editForm.application_paid
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      application_paid:
                        value,
                    })
                  }
                />

                <FormField
                  label="Acceptance Fee"
                  type="number"
                  value={
                    editForm.acceptance_fee
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      acceptance_fee:
                        value,
                    })
                  }
                />

                <FormField
                  label="Acceptance Paid"
                  type="number"
                  value={
                    editForm.acceptance_paid
                  }
                  onChange={(value) =>
                    setEditForm({
                      ...editForm,
                      acceptance_paid:
                        value,
                    })
                  }
                />
              </div>

              <div
                style={{
                  marginTop: 14,
                }}
              >
                <label
                  style={
                    labelStyle
                  }
                >
                  Notes
                </label>

                <textarea
                  value={
                    editForm.notes
                  }
                  onChange={(event) =>
                    setEditForm({
                      ...editForm,
                      notes:
                        event.target
                          .value,
                    })
                  }
                  rows={5}
                  style={{
                    width: "100%",
                    resize:
                      "vertical",
                  }}
                />
              </div>

              <ModalError
                message={error}
              />

              <ModalActions
                onCancel={
                  closeEditCustomer
                }
                saving={saving}
                submitText="Save Changes"
                submitStyle={
                  purpleButtonStyle
                }
              />
            </form>
          </div>
        </div>
      )}

      {/* FOLLOW UP MODAL */}

      {showFollowUp &&
        followUpCustomer && (
          <div
            style={modalOverlayStyle(
              1100
            )}
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
                ...modalStyle,
                maxWidth: 560,
              }}
            >
              <ModalHeader
                title="Schedule Follow Up"
                subtitle={
                  followUpCustomer.full_names ||
                  "Student"
                }
                onClose={
                  closeFollowUp
                }
              />

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
                      style={
                        labelStyle
                      }
                    >
                      Follow-Up Date *
                    </label>

                    <input
                      type="date"
                      value={
                        followUpForm.date
                      }
                      onChange={(
                        event
                      ) =>
                        setFollowUpForm(
                          {
                            ...followUpForm,
                            date:
                              event.target
                                .value,
                          }
                        )
                      }
                      required
                      style={{
                        width: "100%",
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={
                        labelStyle
                      }
                    >
                      Reason for
                      Follow-Up *
                    </label>

                    <select
                      value={
                        followUpForm.reason
                      }
                      onChange={(
                        event
                      ) =>
                        setFollowUpForm(
                          {
                            ...followUpForm,
                            reason:
                              event.target
                                .value,
                          }
                        )
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
                            key={
                              reason
                            }
                            value={
                              reason
                            }
                          >
                            {reason}
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
                      Additional
                      Notes
                    </label>

                    <textarea
                      value={
                        followUpForm.notes
                      }
                      onChange={(
                        event
                      ) =>
                        setFollowUpForm(
                          {
                            ...followUpForm,
                            notes:
                              event.target
                                .value,
                          }
                        )
                      }
                      placeholder="Enter any additional information..."
                      rows={4}
                      style={{
                        width: "100%",
                        resize:
                          "vertical",
                      }}
                    />
                  </div>
                </div>

                <ModalError
                  message={error}
                />

                <ModalActions
                  onCancel={
                    closeFollowUp
                  }
                  saving={saving}
                  submitText="Save Follow Up"
                  submitStyle={
                    greenButtonStyle
                  }
                />
              </form>
            </div>
          </div>
        )}
    </>
  );
}

function modalOverlayStyle(
  zIndex: number
): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    zIndex,
    background:
      "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  };
}

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  background: "#ffffff",
  borderRadius: 12,
  padding: 24,
  boxShadow:
    "0 20px 50px rgba(0,0,0,0.2)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontWeight: 600,
  fontSize: 14,
};

const secondaryButtonStyle: React.CSSProperties =
  {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    visibility: "visible",
    opacity: 1,
    color: "#374151",
    background: "#ffffff",
    border:
      "1px solid #d1d5db",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 40,
  };

const purpleButtonStyle: React.CSSProperties =
  {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    visibility: "visible",
    opacity: 1,
    color: "#ffffff",
    background: "#7c3aed",
    border:
      "1px solid #7c3aed",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 40,
  };

const greenButtonStyle: React.CSSProperties =
  {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    visibility: "visible",
    opacity: 1,
    color: "#ffffff",
    background: "#16a34a",
    border:
      "1px solid #16a34a",
    padding: "10px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    minHeight: 40,
  };

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
        alignItems: "center",
        justifyContent:
          "space-between",
        marginBottom: 20,
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
          {title}
        </h2>

        <p
          style={{
            margin:
              "5px 0 0",
            fontSize: 13,
            opacity: 0.65,
          }}
        >
          {subtitle}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        style={{
          ...secondaryButtonStyle,
          width: 36,
          height: 36,
          minHeight: 36,
          padding: 0,
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

function DetailBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: 14,
        border:
          "1px solid #e5e7eb",
        borderRadius: 8,
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          fontSize: 12,
          opacity: 0.6,
          marginBottom: 4,
        }}
      >
        {label}
      </div>

      <strong
        style={{
          fontSize: 14,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  type?: string;
  required?: boolean;
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
        required={required}
        style={{
          width: "100%",
        }}
      />
    </div>
  );
}

function ModalError({
  message,
}: {
  message: string;
}) {
  if (!message) return null;

  return (
    <div
      style={{
        marginTop: 14,
        padding:
          "10px 12px",
        borderRadius: 8,
        border:
          "1px solid #fecaca",
        background: "#fef2f2",
        color: "#b91c1c",
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}

function ModalActions({
  onCancel,
  saving,
  submitText,
  submitStyle,
}: {
  onCancel: () => void;
  saving: boolean;
  submitText: string;
  submitStyle: React.CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "flex-end",
        gap: 10,
        marginTop: 24,
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={onCancel}
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
          ...submitStyle,
          cursor: saving
            ? "not-allowed"
            : "pointer",
        }}
      >
        {saving
          ? "Saving..."
          : submitText}
      </button>
    </div>
  );
}