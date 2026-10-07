"use client";

import {
  CSSProperties,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

type Customer = {
  id: string;
  lead_id: string | null;
  assigned_to: string | null;
  ciu_number: string | null;
  full_names: string;
  telephone: string | null;
  email: string | null;
  program: string;
  stage: string;
  tuition_fee: number | null;
  tuition_paid: number | null;
  application_fee: number | null;
  application_paid: number | null;
  acceptance_fee: number | null;
  acceptance_paid: number | null;
  follow_up_date: string | null;
  last_contact: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Lead = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  feedback: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
  role: string | null;
};

const ACTIVE_STAGE = "Enrolled";

function formatCurrency(value: number | null | undefined) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getPaymentPercentage(
  paid: number | null | undefined,
  total: number | null | undefined,
) {
  const paidAmount = Number(paid || 0);
  const totalAmount = Number(total || 0);

  if (totalAmount <= 0) return 0;

  return Math.min(100, Math.round((paidAmount / totalAmount) * 100));
}

function isFollowUpDue(date: string | null) {
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const followUp = new Date(`${date}T00:00:00`);
  followUp.setHours(0, 0, 0, 0);

  return followUp <= today;
}

export default function CustomersPage() {
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Record<string, Lead>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All Enrolled Students");

  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);

  const [editForm, setEditForm] = useState({
    full_names: "",
    telephone: "",
    email: "",
    program: "",
    tuition_fee: "",
    tuition_paid: "",
    application_fee: "",
    application_paid: "",
    acceptance_fee: "",
    acceptance_paid: "",
    notes: "",
  });

  const [followUpForm, setFollowUpForm] = useState({
    follow_up_date: "",
    notes: "",
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You are not logged in.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const role = profile?.role || null;
      setCurrentUserRole(role);

      let admissionsQuery = supabase
        .from("admissions")
        .select(
          `
          id,
          lead_id,
          assigned_to,
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
          `,
        )
        .eq("stage", ACTIVE_STAGE)
        .order("created_at", {
          ascending: false,
        });

      if (role === "salesperson") {
        admissionsQuery = admissionsQuery.eq("assigned_to", user.id);
      }

      const { data: admissions, error: admissionsError } =
        await admissionsQuery;

      if (admissionsError) {
        throw admissionsError;
      }

      const customerRows = (admissions || []) as Customer[];

      setCustomers(customerRows);

      /* -----------------------------
         LOAD LINKED LEADS
      ------------------------------ */

      const leadIds = customerRows
        .map((customer) => customer.lead_id)
        .filter((id): id is string => Boolean(id));

      if (leadIds.length > 0) {
        const { data: leadData, error: leadsError } = await supabase
          .from("leads")
          .select("id, name, phone, email, feedback")
          .in("id", leadIds);

        if (leadsError) {
          throw leadsError;
        }

        const leadMap: Record<string, Lead> = {};

        (leadData || []).forEach((lead: Lead) => {
          leadMap[lead.id] = lead;
        });

        setLeads(leadMap);
      } else {
        setLeads({});
      }

      /* -----------------------------
         LOAD ASSIGNED STAFF
      ------------------------------ */

      const assignedIds = customerRows
        .map((customer) => customer.assigned_to)
        .filter((id): id is string => Boolean(id));

      if (assignedIds.length > 0) {
        const { data: profileData, error: profilesError } =
          await supabase
            .from("profiles")
            .select("id, full_name, role")
            .in("id", assignedIds);

        if (!profilesError) {
          const profileMap: Record<string, Profile> = {};

          (profileData || []).forEach((profileRow: Profile) => {
            profileMap[profileRow.id] = profileRow;
          });

          setProfiles(profileMap);
        }
      } else {
        setProfiles({});
      }
    } catch (err) {
      console.error("Failed to load customers:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load enrolled students.",
      );
    } finally {
      setLoading(false);
    }
  }

  /* -----------------------------
     FILTERED CUSTOMERS
  ------------------------------ */

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const lead = customer.lead_id
        ? leads[customer.lead_id]
        : null;

      const searchableText = [
        customer.full_names,
        customer.ciu_number,
        customer.telephone,
        customer.email,
        customer.program,
        lead?.name,
        lead?.phone,
        lead?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        normalizedSearch.length === 0 ||
        searchableText.includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "All Enrolled Students" ||
        customer.stage === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [customers, leads, search, statusFilter]);

  /* -----------------------------
     KPI CALCULATIONS
  ------------------------------ */

  const totalCustomers = customers.length;

  const activeStudents = customers.filter(
    (customer) => customer.stage === "Enrolled",
  ).length;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const newThisMonth = customers.filter((customer) => {
    const created = new Date(customer.created_at);

    return created >= startOfMonth;
  }).length;

  const totalTuitionValue = customers.reduce(
    (sum, customer) =>
      sum + Number(customer.tuition_fee || 0),
    0,
  );

  const totalTuitionPaid = customers.reduce(
    (sum, customer) =>
      sum + Number(customer.tuition_paid || 0),
    0,
  );

  const outstandingTuition = Math.max(
    0,
    totalTuitionValue - totalTuitionPaid,
  );

  const dueFollowUps = customers.filter((customer) =>
    isFollowUpDue(customer.follow_up_date),
  ).length;

  const averagePayment =
    totalTuitionValue > 0
      ? Math.round(
          (totalTuitionPaid / totalTuitionValue) * 100,
        )
      : 0;

  /* -----------------------------
     MODAL ACTIONS
  ------------------------------ */

  function openCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    setShowOpenModal(true);
  }

  function openViewModal(customer: Customer) {
    setSelectedCustomer(customer);
    setShowOpenModal(false);
    setShowViewModal(true);
  }

  function openEditModal(customer: Customer) {
    setSelectedCustomer(customer);

    setEditForm({
      full_names: customer.full_names || "",
      telephone: customer.telephone || "",
      email: customer.email || "",
      program: customer.program || "",
      tuition_fee: String(customer.tuition_fee ?? ""),
      tuition_paid: String(customer.tuition_paid ?? ""),
      application_fee: String(
        customer.application_fee ?? "",
      ),
      application_paid: String(
        customer.application_paid ?? "",
      ),
      acceptance_fee: String(
        customer.acceptance_fee ?? "",
      ),
      acceptance_paid: String(
        customer.acceptance_paid ?? "",
      ),
      notes: customer.notes || "",
    });

    setShowOpenModal(false);
    setShowEditModal(true);
  }

  function openFollowUpModal(customer: Customer) {
    setSelectedCustomer(customer);

    setFollowUpForm({
      follow_up_date: customer.follow_up_date || "",
      notes: customer.notes || "",
    });

    setShowOpenModal(false);
    setShowFollowUpModal(true);
  }

  function closeModals() {
    setShowOpenModal(false);
    setShowViewModal(false);
    setShowEditModal(false);
    setShowFollowUpModal(false);
    setSelectedCustomer(null);
  }

  /* -----------------------------
     UPDATE CUSTOMER
  ------------------------------ */

  async function handleEditCustomer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedCustomer) return;

    setSaving(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("admissions")
        .update({
          full_names: editForm.full_names.trim(),
          telephone:
            editForm.telephone.trim() || null,
          email: editForm.email.trim() || null,
          program: editForm.program.trim(),
          tuition_fee: Number(
            editForm.tuition_fee || 0,
          ),
          tuition_paid: Number(
            editForm.tuition_paid || 0,
          ),
          application_fee: Number(
            editForm.application_fee || 0,
          ),
          application_paid: Number(
            editForm.application_paid || 0,
          ),
          acceptance_fee: Number(
            editForm.acceptance_fee || 0,
          ),
          acceptance_paid: Number(
            editForm.acceptance_paid || 0,
          ),
          notes: editForm.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCustomer.id);

      if (updateError) {
        throw updateError;
      }

      closeModals();
      await loadCustomers();
    } catch (err) {
      console.error(
        "Failed to update student:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update enrolled student.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* -----------------------------
     FOLLOW-UP UPDATE
  ------------------------------ */

  async function handleFollowUp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedCustomer) return;

    setSaving(true);
    setError("");

    try {
      const { error: updateError } = await supabase
        .from("admissions")
        .update({
          follow_up_date:
            followUpForm.follow_up_date || null,
          notes:
            followUpForm.notes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedCustomer.id);

      if (updateError) {
        throw updateError;
      }

      closeModals();
      await loadCustomers();
    } catch (err) {
      console.error(
        "Failed to update follow-up:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update follow-up.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* -----------------------------
     COMMUNICATION ACTIONS
  ------------------------------ */

  function callStudent(phone: string | null) {
    if (!phone) return;

    window.location.href = `tel:${phone}`;
  }

  function whatsappStudent(phone: string | null) {
    if (!phone) return;

    const cleanedPhone = phone.replace(
      /[^\d+]/g,
      "",
    );

    window.open(
      `https://wa.me/${cleanedPhone.replace(
        "+",
        "",
      )}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
        color: "#0f172a",
      }}
    >
      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          padding: "22px 28px",
        }}
      >
        <div
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "28px",
                fontWeight: 850,
                color: "#0f172a",
                letterSpacing: "-0.5px",
              }}
            >
              Customers
            </h1>

            <div
              style={{
                marginTop: "5px",
                fontSize: "13px",
                color: "#64748b",
              }}
            >
              Manage enrolled students, payments and
              follow-ups
            </div>
          </div>

          <button
            type="button"
            onClick={loadCustomers}
            style={{
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0d2b52",
              borderRadius: "9px",
              padding: "10px 16px",
              fontSize: "13px",
              fontWeight: 750,
              cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* =====================================================
          MAIN CONTENT
      ====================================================== */}

      <div
        style={{
          maxWidth: "1600px",
          margin: "0 auto",
          padding: "28px",
        }}
      >
        {/* ERROR */}

        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: "12px",
              padding: "14px 16px",
              marginBottom: "20px",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        {/* ===================================================
            KPI CARDS
        ==================================================== */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "18px",
          }}
        >
          <KpiCard
            label="Enrolled Students"
            value={totalCustomers}
            description="Students currently in Customers"
            accent="#0d2b52"
          />

          <KpiCard
            label="Currently Enrolled"
            value={activeStudents}
            description="Confirmed enrolled students"
            accent="#16803a"
          />

          <KpiCard
            label="New This Month"
            value={newThisMonth}
            description="Recently enrolled students"
            accent="#8a6714"
          />

          <KpiCard
            label="Tuition Value"
            value={formatCurrency(
              totalTuitionValue,
            )}
            description={`${formatCurrency(
              outstandingTuition,
            )} outstanding`}
            accent="#7c3aed"
          />
        </div>

        {/* ===================================================
            SUMMARY CARDS
        ==================================================== */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "22px",
          }}
        >
          <SummaryCard
            label="Tuition Collected"
            value={formatCurrency(
              totalTuitionPaid,
            )}
          />

          <SummaryCard
            label="Outstanding Tuition"
            value={formatCurrency(
              outstandingTuition,
            )}
          />

          <SummaryCard
            label="Follow-Ups Due"
            value={dueFollowUps}
          />

          <SummaryCard
            label="Average Payment"
            value={`${averagePayment}%`}
          />
        </div>

        {/* ===================================================
            SEARCH AND FILTER
        ==================================================== */}

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dce3ec",
            borderRadius: "16px",
            padding: "18px",
            marginBottom: "20px",
            boxShadow:
              "0 4px 15px rgba(15,23,42,0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: "1 1 320px",
                minWidth: "240px",
              }}
            >
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search by student, CIU number, phone, email or programme..."
                style={inputStyle}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              style={{
                ...inputStyle,
                width: "auto",
                minWidth: "210px",
              }}
            >
              <option>
                All Enrolled Students
              </option>

              <option>Enrolled</option>
            </select>

            <div
              style={{
                marginLeft: "auto",
                color: "#64748b",
                fontSize: "13px",
                fontWeight: 700,
                whiteSpace: "nowrap",
              }}
            >
              {filteredCustomers.length} student
              {filteredCustomers.length === 1
                ? ""
                : "s"}
            </div>
          </div>
        </div>

        {/* ===================================================
            CUSTOMER TABLE
        ==================================================== */}

        <div
          style={{
            background: "#ffffff",
            border: "1px solid #dce3ec",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow:
              "0 6px 20px rgba(15,23,42,0.05)",
          }}
        >
          {loading ? (
            <div
              style={{
                padding: "70px 20px",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "#0d2b52",
                }}
              >
                Loading enrolled students...
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "13px",
                }}
              >
                Please wait while the customer
                workspace loads.
              </div>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div
              style={{
                padding: "70px 20px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "58px",
                  height: "58px",
                  margin: "0 auto 14px",
                  borderRadius: "16px",
                  background: "#eef5ff",
                  color: "#0d2b52",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "27px",
                }}
              >
                🎓
              </div>

              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: "18px",
                  fontWeight: 850,
                  color: "#0d2b52",
                }}
              >
                No enrolled students found
              </h3>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  fontSize: "14px",
                }}
              >
                Students will appear here after
                their admission is moved to the
                Enrolled stage.
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX: "auto",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: "1150px",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background:
                        "linear-gradient(90deg, #071a35, #0d2b52)",
                      borderBottom:
                        "3px solid #0d2b52",
                    }}
                  >
                    <Th color="#ffffff">
                      Student
                    </Th>

                    <Th color="#ffffff">
                      CIU Number
                    </Th>

                    <Th color="#ffffff">
                      Programme
                    </Th>

                    <Th color="#ffffff">
                      Stage
                    </Th>

                    <Th color="#ffffff">
                      Tuition
                    </Th>

                    <Th color="#ffffff">
                      Follow-Up
                    </Th>

                    <Th color="#ffffff">
                      Actions
                    </Th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map(
                    (customer) => {
                      const lead = customer.lead_id
                        ? leads[
                            customer.lead_id
                          ]
                        : null;

                      const paymentPercentage =
                        getPaymentPercentage(
                          customer.tuition_paid,
                          customer.tuition_fee,
                        );

                      const assignedProfile =
                        customer.assigned_to
                          ? profiles[
                              customer.assigned_to
                            ]
                          : null;

                      const followUpDue =
                        isFollowUpDue(
                          customer.follow_up_date,
                        );

                      return (
                        <tr
                          key={customer.id}
                          style={{
                            borderBottom:
                              "1px solid #edf1f5",
                          }}
                        >
                          {/* STUDENT */}

                          <td
                            style={{
                              padding: "16px",
                              verticalAlign: "top",
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: "14px",
                                color: "#0d2b52",
                              }}
                            >
                              {customer.full_names}
                            </div>

                            <div
                              style={{
                                marginTop: "5px",
                                fontSize: "12px",
                                color: "#64748b",
                              }}
                            >
                              {customer.telephone ||
                                lead?.phone ||
                                "No phone"}
                            </div>

                            <div
                              style={{
                                marginTop: "3px",
                                fontSize: "12px",
                                color: "#64748b",
                              }}
                            >
                              {customer.email ||
                                lead?.email ||
                                "No email"}
                            </div>

                            {assignedProfile?.full_name && (
                              <div
                                style={{
                                  marginTop: "7px",
                                  fontSize: "11px",
                                  color: "#475569",
                                }}
                              >
                                Assigned:{" "}
                                {
                                  assignedProfile.full_name
                                }
                              </div>
                            )}
                          </td>

                          {/* IDENTIFIER */}

                          <td
                            style={{
                              padding: "16px",
                              verticalAlign: "top",
                              fontSize: "13px",
                              fontWeight: 750,
                            }}
                          >
                            {customer.ciu_number ||
                              "—"}
                          </td>

                          {/* PROGRAMME */}

                          <td
                            style={{
                              padding: "16px",
                              verticalAlign: "top",
                              fontSize: "13px",
                              color: "#334155",
                              maxWidth: "220px",
                            }}
                          >
                            {customer.program}
                          </td>

                          {/* STAGE */}

                          <td
                            style={{
                              padding: "16px",
                              verticalAlign: "top",
                            }}
                          >
                            <span
                              style={{
                                display:
                                  "inline-flex",
                                alignItems:
                                  "center",
                                gap: "6px",
                                borderRadius:
                                  "999px",
                                padding:
                                  "7px 11px",
                                background:
                                  "#e8f7ee",
                                color:
                                  "#166534",
                                border:
                                  "1px solid #b7e4c7",
                                fontSize:
                                  "12px",
                                fontWeight: 800,
                              }}
                            >
                              <span>●</span>
                              Enrolled
                            </span>
                          </td>

                          {/* TUITION */}

                          <td
                            style={{
                              padding: "16px",
                              verticalAlign:
                                "top",
                              minWidth: "190px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: 800,
                                color: "#0f172a",
                              }}
                            >
                              {formatCurrency(
                                customer.tuition_paid,
                              )}{" "}
                              /{" "}
                              {formatCurrency(
                                customer.tuition_fee,
                              )}
                            </div>

                            <div
                              style={{
                                marginTop: "8px",
                                height: "7px",
                                borderRadius:
                                  "999px",
                                background:
                                  "#e2e8f0",
                                overflow:
                                  "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${paymentPercentage}%`,
                                  height: "100%",
                                  background:
                                    paymentPercentage >=
                                    100
                                      ? "#16a34a"
                                      : "#0d2b52",
                                  borderRadius:
                                    "999px",
                                }}
                              />
                            </div>

                            <div
                              style={{
                                marginTop: "5px",
                                fontSize: "11px",
                                color: "#64748b",
                              }}
                            >
                              {
                                paymentPercentage
                              }
                              % paid
                            </div>
                          </td>

                          {/* FOLLOW-UP */}

                          <td
                            style={{
                              padding: "16px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            {customer.follow_up_date ? (
                              <div>
                                <div
                                  style={{
                                    fontSize:
                                      "13px",
                                    fontWeight:
                                      700,
                                    color:
                                      followUpDue
                                        ? "#b91c1c"
                                        : "#334155",
                                  }}
                                >
                                  {formatDate(
                                    customer.follow_up_date,
                                  )}
                                </div>

                                <div
                                  style={{
                                    marginTop:
                                      "4px",
                                    fontSize:
                                      "11px",
                                    color:
                                      followUpDue
                                        ? "#b91c1c"
                                        : "#64748b",
                                    fontWeight:
                                      700,
                                  }}
                                >
                                  {followUpDue
                                    ? "Due"
                                    : "Scheduled"}
                                </div>
                              </div>
                            ) : (
                              <span
                                style={{
                                  fontSize:
                                    "12px",
                                  color:
                                    "#94a3b8",
                                }}
                              >
                                Not scheduled
                              </span>
                            )}
                          </td>

                          {/* ACTION */}

                          <td
                            style={{
                              padding: "16px",
                              verticalAlign:
                                "top",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() =>
                                openCustomer(
                                  customer,
                                )
                              }
                              style={{
                                border:
                                  "1px solid #0d2b52",
                                background:
                                  "#0d2b52",
                                color:
                                  "#ffffff",
                                borderRadius:
                                  "9px",
                                padding:
                                  "9px 15px",
                                fontSize:
                                  "12px",
                                fontWeight:
                                  800,
                                cursor:
                                  "pointer",
                                minWidth:
                                  "82px",
                              }}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================
          OPEN CUSTOMER WORKSPACE
      ====================================================== */}

      {showOpenModal && selectedCustomer && (
        <Modal
          title="Customer Workspace"
          onClose={closeModals}
          wide
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "15px",
              padding: "16px",
              borderRadius: "14px",
              background:
                "linear-gradient(135deg, #071a35, #0d2b52)",
              color: "#ffffff",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "#e2e8f0",
                color: "#0d2b52",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: "18px",
              }}
            >
              {selectedCustomer.full_names
                .split(" ")
                .map((name) => name[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>

            <div>
              <div
                style={{
                  fontSize: "19px",
                  fontWeight: 850,
                }}
              >
                {selectedCustomer.full_names}
              </div>

              <div
                style={{
                  marginTop: "4px",
                  color: "#cbd5e1",
                  fontSize: "13px",
                }}
              >
                {selectedCustomer.ciu_number ||
                  "No student number"}{" "}
                • {selectedCustomer.program}
              </div>
            </div>

            <div
              style={{
                marginLeft: "auto",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  borderRadius: "999px",
                  padding: "7px 11px",
                  background: "#dcfce7",
                  color: "#166534",
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                Enrolled
              </span>
            </div>
          </div>

          {/* QUICK ACTIONS */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: "12px",
              marginBottom: "22px",
            }}
          >
            <QuickAction
              label="Update"
              description="Update student details"
              onClick={() =>
                openEditModal(
                  selectedCustomer,
                )
              }
              primary
            />

            <QuickAction
              label="Follow Up"
              description="Schedule follow-up"
              onClick={() =>
                openFollowUpModal(
                  selectedCustomer,
                )
              }
            />

            <QuickAction
              label="View"
              description="View full record"
              onClick={() =>
                openViewModal(
                  selectedCustomer,
                )
              }
            />

            <QuickAction
              label="Call"
              description="Call student"
              onClick={() =>
                callStudent(
                  selectedCustomer.telephone,
                )
              }
              disabled={
                !selectedCustomer.telephone
              }
            />

            <QuickAction
              label="WhatsApp"
              description="Message student"
              onClick={() =>
                whatsappStudent(
                  selectedCustomer.telephone,
                )
              }
              disabled={
                !selectedCustomer.telephone
              }
            />
          </div>

          {/* CUSTOMER SUMMARY */}

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "14px",
            }}
          >
            <InfoBox
              label="Telephone"
              value={
                selectedCustomer.telephone ||
                "No phone"
              }
            />

            <InfoBox
              label="Email"
              value={
                selectedCustomer.email ||
                "No email"
              }
            />

            <InfoBox
              label="Tuition Fee"
              value={formatCurrency(
                selectedCustomer.tuition_fee,
              )}
            />

            <InfoBox
              label="Tuition Paid"
              value={formatCurrency(
                selectedCustomer.tuition_paid,
              )}
            />

            <InfoBox
              label="Follow-Up"
              value={formatDate(
                selectedCustomer.follow_up_date,
              )}
            />

            <InfoBox
              label="Last Contact"
              value={formatDate(
                selectedCustomer.last_contact,
              )}
            />
          </div>

          <ModalFooter
            onClose={closeModals}
          />
        </Modal>
      )}

      {/* =====================================================
          VIEW MODAL
      ====================================================== */}

      {showViewModal && selectedCustomer && (
        <Modal
          title="Student Details"
          onClose={closeModals}
          wide
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2, minmax(0, 1fr))",
              gap: "16px",
            }}
          >
            <DetailItem
              label="Full Names"
              value={
                selectedCustomer.full_names
              }
            />

            <DetailItem
              label="CIU Number"
              value={
                selectedCustomer.ciu_number ||
                "—"
              }
            />

            <DetailItem
              label="Telephone"
              value={
                selectedCustomer.telephone ||
                "—"
              }
            />

            <DetailItem
              label="Email"
              value={
                selectedCustomer.email ||
                "—"
              }
            />

            <DetailItem
              label="Programme"
              value={
                selectedCustomer.program
              }
            />

            <DetailItem
              label="Stage"
              value={
                selectedCustomer.stage
              }
            />

            <DetailItem
              label="Application Fee"
              value={formatCurrency(
                selectedCustomer.application_fee,
              )}
            />

            <DetailItem
              label="Application Paid"
              value={formatCurrency(
                selectedCustomer.application_paid,
              )}
            />

            <DetailItem
              label="Acceptance Fee"
              value={formatCurrency(
                selectedCustomer.acceptance_fee,
              )}
            />

            <DetailItem
              label="Acceptance Paid"
              value={formatCurrency(
                selectedCustomer.acceptance_paid,
              )}
            />

            <DetailItem
              label="Tuition Fee"
              value={formatCurrency(
                selectedCustomer.tuition_fee,
              )}
            />

            <DetailItem
              label="Tuition Paid"
              value={formatCurrency(
                selectedCustomer.tuition_paid,
              )}
            />

            <DetailItem
              label="Follow-Up Date"
              value={formatDate(
                selectedCustomer.follow_up_date,
              )}
            />

            <DetailItem
              label="Last Contact"
              value={formatDate(
                selectedCustomer.last_contact,
              )}
            />
          </div>

          <div
            style={{
              marginTop: "20px",
              padding: "14px",
              background: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
                color: "#475569",
                marginBottom: "6px",
              }}
            >
              Notes
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "#334155",
                whiteSpace: "pre-wrap",
              }}
            >
              {selectedCustomer.notes ||
                "No notes recorded."}
            </div>
          </div>

          <ModalFooter
            onClose={closeModals}
          />
        </Modal>
      )}

      {/* =====================================================
          EDIT MODAL
      ====================================================== */}

      {showEditModal && selectedCustomer && (
        <Modal
          title="Update Enrolled Student"
          onClose={closeModals}
          wide
        >
          <form
            onSubmit={handleEditCustomer}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              <FormField
                label="Full Names"
                value={
                  editForm.full_names
                }
                onChange={(value) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      full_names: value,
                    }),
                  )
                }
                required
              />

              <FormField
                label="Telephone"
                value={
                  editForm.telephone
                }
                onChange={(value) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      telephone: value,
                    }),
                  )
                }
              />

              <FormField
                label="Email"
                type="email"
                value={editForm.email}
                onChange={(value) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      email: value,
                    }),
                  )
                }
              />

              <FormField
                label="Programme"
                value={
                  editForm.program
                }
                onChange={(value) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      program: value,
                    }),
                  )
                }
                required
              />

              <FormField
                label="Tuition Fee"
                type="number"
                value={
                  editForm.tuition_fee
                }
                onChange={(value) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      tuition_fee: value,
                    }),
                  )
                }
              />

              <FormField
                label="Tuition Paid"
                type="number"
                value={
                  editForm.tuition_paid
                }
                onChange={(value) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      tuition_paid: value,
                    }),
                  )
                }
              />

              <FormField
                label="Application Fee"
                type="number"
                value={
                  editForm.application_fee
                }
                onChange={(value) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      application_fee: value,
                    }),
                  )
                }
              />

              <FormField
                label="Application Paid"
                type="number"
                value={
                  editForm.application_paid
                }
                onChange={(value) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      application_paid:
                        value,
                    }),
                  )
                }
              />

              <FormField
                label="Acceptance Fee"
                type="number"
                value={
                  editForm.acceptance_fee
                }
                onChange={(value) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      acceptance_fee: value,
                    }),
                  )
                }
              />

              <FormField
                label="Acceptance Paid"
                type="number"
                value={
                  editForm.acceptance_paid
                }
                onChange={(value) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      acceptance_paid:
                        value,
                    }),
                  )
                }
              />
            </div>

            <div
              style={{
                marginTop: "16px",
              }}
            >
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#334155",
                  marginBottom: "7px",
                }}
              >
                Notes
              </label>

              <textarea
                value={editForm.notes}
                onChange={(event) =>
                  setEditForm(
                    (current) => ({
                      ...current,
                      notes:
                        event.target.value,
                    }),
                  )
                }
                rows={5}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={closeModals}
                style={
                  secondaryButtonStyle
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                style={
                  primaryButtonStyle
                }
              >
                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* =====================================================
          FOLLOW-UP MODAL
      ====================================================== */}

      {showFollowUpModal &&
        selectedCustomer && (
          <Modal
            title="Schedule Follow-Up"
            onClose={closeModals}
          >
            <form
              onSubmit={handleFollowUp}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#334155",
                    marginBottom: "7px",
                  }}
                >
                  Follow-Up Date
                </label>

                <input
                  type="date"
                  value={
                    followUpForm.follow_up_date
                  }
                  onChange={(event) =>
                    setFollowUpForm(
                      (current) => ({
                        ...current,
                        follow_up_date:
                          event.target
                            .value,
                      }),
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  marginTop: "16px",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#334155",
                    marginBottom: "7px",
                  }}
                >
                  Notes
                </label>

                <textarea
                  value={
                    followUpForm.notes
                  }
                  onChange={(event) =>
                    setFollowUpForm(
                      (current) => ({
                        ...current,
                        notes:
                          event.target
                            .value,
                      }),
                    )
                  }
                  rows={5}
                  placeholder="Add follow-up notes..."
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "flex-end",
                  gap: "10px",
                  marginTop: "20px",
                }}
              >
                <button
                  type="button"
                  onClick={closeModals}
                  style={
                    secondaryButtonStyle
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  style={
                    primaryButtonStyle
                  }
                >
                  {saving
                    ? "Saving..."
                    : "Save Follow-Up"}
                </button>
              </div>
            </form>
          </Modal>
        )}
    </div>
  );
}

/* ============================================================
   KPI CARD
============================================================ */

function KpiCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: string | number;
  description: string;
  accent: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
        border: "1px solid #dce3ec",
        borderRadius: "16px",
        padding: "20px",
        boxShadow:
          "0 5px 18px rgba(15,23,42,0.045)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "5px",
          height: "100%",
          background: accent,
        }}
      />

      <div
        style={{
          fontSize: "11px",
          color: "#64748b",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.6px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "10px",
          fontSize: "27px",
          lineHeight: 1.1,
          fontWeight: 850,
          color: "#0d2b52",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: "7px",
          fontSize: "12px",
          color: "#94a3b8",
        }}
      >
        {description}
      </div>
    </div>
  );
}

/* ============================================================
   SUMMARY CARD
============================================================ */

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: "1px solid #dce3ec",
        borderRadius: "14px",
        padding: "16px 18px",
        boxShadow:
          "0 3px 12px rgba(15,23,42,0.035)",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          color: "#64748b",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.4px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "7px",
          fontSize: "20px",
          fontWeight: 850,
          color: "#0d2b52",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ============================================================
   QUICK ACTION
============================================================ */

function QuickAction({
  label,
  description,
  onClick,
  primary = false,
  disabled = false,
}: {
  label: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        textAlign: "left",
        border: primary
          ? "1px solid #0d2b52"
          : "1px solid #dce3ec",
        background: primary
          ? "#0d2b52"
          : "#ffffff",
        color: primary
          ? "#ffffff"
          : "#0d2b52",
        borderRadius: "12px",
        padding: "14px",
        cursor: disabled
          ? "not-allowed"
          : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div
        style={{
          fontSize: "14px",
          fontWeight: 850,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "4px",
          fontSize: "11px",
          color: primary
            ? "#cbd5e1"
            : "#64748b",
        }}
      >
        {description}
      </div>
    </button>
  );
}

/* ============================================================
   INFO BOX
============================================================ */

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: "14px",
        borderRadius: "11px",
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          color: "#64748b",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: "6px",
          fontSize: "14px",
          fontWeight: 700,
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ============================================================
   TABLE HEADER
============================================================ */

function Th({
  children,
  color = "#64748b",
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "13px 16px",
        fontSize: "10px",
        color,
        fontWeight: 850,
        textTransform: "uppercase",
        letterSpacing: "0.7px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

/* ============================================================
   DETAIL ITEM
============================================================ */

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: "11px",
          color: "#64748b",
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.4px",
          marginBottom: "5px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontSize: "14px",
          color: "#0f172a",
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ============================================================
   FORM FIELD
============================================================ */

function FormField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: "13px",
          fontWeight: 700,
          color: "#334155",
          marginBottom: "7px",
        }}
      >
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        required={required}
        style={inputStyle}
      />
    </div>
  );
}

/* ============================================================
   MODAL
============================================================ */

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background:
          "rgba(7, 26, 53, 0.68)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: wide
            ? "900px"
            : "700px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: "18px",
          boxShadow:
            "0 30px 80px rgba(7,26,53,0.30)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: "16px",
            padding: "18px 20px",
            background:
              "linear-gradient(90deg, #071a35, #0d2b52)",
            color: "#ffffff",
            borderBottom:
              "3px solid #0d2b52",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "19px",
              fontWeight: 850,
            }}
          >
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              border:
                "1px solid rgba(255,255,255,0.2)",
              background:
                "rgba(255,255,255,0.10)",
              color: "#ffffff",
              width: "34px",
              height: "34px",
              borderRadius: "9px",
              cursor: "pointer",
              fontSize: "18px",
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: "20px",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MODAL FOOTER
============================================================ */

function ModalFooter({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        marginTop: "20px",
      }}
    >
      <button
        type="button"
        onClick={onClose}
        style={secondaryButtonStyle}
      >
        Close
      </button>
    </div>
  );
}

/* ============================================================
   SHARED STYLES
============================================================ */

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "11px 13px",
  fontSize: "14px",
  color: "#0f172a",
  background: "#ffffff",
  outline: "none",
};

const primaryButtonStyle: CSSProperties = {
  border: "none",
  background: "#0d2b52",
  color: "#ffffff",
  borderRadius: "9px",
  padding: "10px 16px",
  fontSize: "14px",
  fontWeight: 750,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  borderRadius: "9px",
  padding: "10px 16px",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
};