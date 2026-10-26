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

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #d6e3de",
  borderRadius: "10px",
  padding: "11px 13px",
  fontSize: "14px",
  color: "#17322c",
  background: "#ffffff",
  outline: "none",
};

const primaryButtonStyle: CSSProperties = {
  border: "0",
  background: "#00695c",
  color: "#ffffff",
  borderRadius: "10px",
  padding: "10px 16px",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid #d6e3de",
  background: "#ffffff",
  color: "#36564e",
  borderRadius: "10px",
  padding: "10px 16px",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
};

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

  if (Number.isNaN(date.getTime())) return value;

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("All Enrolled Students");

  const [selectedCustomer, setSelectedCustomer] =
    useState<Customer | null>(null);

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

      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, full_name, role")
          .eq("id", user.id)
          .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      const role = profile?.role || null;

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
        admissionsQuery = admissionsQuery.eq(
          "assigned_to",
          user.id,
        );
      }

      const {
        data: admissions,
        error: admissionsError,
      } = await admissionsQuery;

      if (admissionsError) {
        throw admissionsError;
      }

      const customerRows =
        (admissions || []) as Customer[];

      setCustomers(customerRows);

      const leadIds = customerRows
        .map((customer) => customer.lead_id)
        .filter(
          (id): id is string => Boolean(id),
        );

      if (leadIds.length > 0) {
        const {
          data: leadData,
          error: leadsError,
        } = await supabase
          .from("leads")
          .select(
            "id, name, phone, email, feedback",
          )
          .in("id", leadIds);

        if (leadsError) {
          throw leadsError;
        }

        const leadMap: Record<string, Lead> = {};

        (leadData || []).forEach(
          (lead: Lead) => {
            leadMap[lead.id] = lead;
          },
        );

        setLeads(leadMap);
      } else {
        setLeads({});
      }

      const assignedIds = customerRows
        .map(
          (customer) =>
            customer.assigned_to,
        )
        .filter(
          (id): id is string => Boolean(id),
        );

      if (assignedIds.length > 0) {
        const {
          data: profileData,
          error: profilesError,
        } = await supabase
          .from("profiles")
          .select(
            "id, full_name, role",
          )
          .in("id", assignedIds);

        if (!profilesError) {
          const profileMap: Record<
            string,
            Profile
          > = {};

          (profileData || []).forEach(
            (profileRow: Profile) => {
              profileMap[profileRow.id] =
                profileRow;
            },
          );

          setProfiles(profileMap);
        }
      } else {
        setProfiles({});
      }
    } catch (err) {
      console.error(
        "Failed to load customers:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load enrolled students.",
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

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
        searchableText.includes(
          normalizedSearch,
        );

      const matchesStatus =
        statusFilter ===
          "All Enrolled Students" ||
        customer.stage === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    customers,
    leads,
    search,
    statusFilter,
  ]);

  const totalCustomers =
    customers.length;

  const activeStudents =
    customers.filter(
      (customer) =>
        customer.stage === "Enrolled",
    ).length;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const newThisMonth =
    customers.filter((customer) => {
      const created = new Date(
        customer.created_at,
      );

      return created >= startOfMonth;
    }).length;

  const totalTuitionValue =
    customers.reduce(
      (sum, customer) =>
        sum +
        Number(customer.tuition_fee || 0),
      0,
    );

  const totalTuitionPaid =
    customers.reduce(
      (sum, customer) =>
        sum +
        Number(customer.tuition_paid || 0),
      0,
    );

  const outstandingTuition = Math.max(
    0,
    totalTuitionValue -
      totalTuitionPaid,
  );

  const dueFollowUps =
    customers.filter((customer) =>
      isFollowUpDue(
        customer.follow_up_date,
      ),
    ).length;

  const averagePayment =
    totalTuitionValue > 0
      ? Math.round(
          (totalTuitionPaid /
            totalTuitionValue) *
            100,
        )
      : 0;

  function openViewModal(
    customer: Customer,
  ) {
    setSelectedCustomer(customer);
    setShowViewModal(true);
  }

  function openEditModal(
    customer: Customer,
  ) {
    setSelectedCustomer(customer);

    setEditForm({
      full_names:
        customer.full_names || "",
      telephone:
        customer.telephone || "",
      email: customer.email || "",
      program: customer.program || "",
      tuition_fee: String(
        customer.tuition_fee ?? "",
      ),
      tuition_paid: String(
        customer.tuition_paid ?? "",
      ),
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

    setShowViewModal(false);
    setShowEditModal(true);
  }

  function openFollowUpModal(
    customer: Customer,
  ) {
    setSelectedCustomer(customer);

    setFollowUpForm({
      follow_up_date:
        customer.follow_up_date || "",
      notes: customer.notes || "",
    });

    setShowViewModal(false);
    setShowFollowUpModal(true);
  }

  function closeModals() {
    setShowViewModal(false);
    setShowEditModal(false);
    setShowFollowUpModal(false);
    setSelectedCustomer(null);
  }

  async function handleEditCustomer(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedCustomer) return;

    setSaving(true);
    setError("");

    try {
      const { error: updateError } =
        await supabase
          .from("admissions")
          .update({
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
              editForm.application_paid ||
                0,
            ),
            acceptance_fee: Number(
              editForm.acceptance_fee || 0,
            ),
            acceptance_paid: Number(
              editForm.acceptance_paid ||
                0,
            ),
            notes:
              editForm.notes.trim() ||
              null,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            selectedCustomer.id,
          );

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

  async function handleFollowUp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedCustomer) return;

    setSaving(true);
    setError("");

    try {
      const { error: updateError } =
        await supabase
          .from("admissions")
          .update({
            follow_up_date:
              followUpForm.follow_up_date ||
              null,
            notes:
              followUpForm.notes.trim() ||
              null,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            selectedCustomer.id,
          );

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

  function callStudent(
    phone: string | null,
  ) {
    if (!phone) return;

    window.location.href = `tel:${phone}`;
  }

  function whatsappStudent(
    phone: string | null,
  ) {
    if (!phone) return;

    const cleanedPhone =
      phone.replace(/[^\d+]/g, "");

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
    <div className="ciu-page">
      <div className="ciu-page-inner">
        {/* HEADER */}

        <div className="ciu-hero">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 20,
              flexWrap: "wrap",
              width: "100%",
              position: "relative",
              zIndex: 2,
            }}
          >
            <div>
              <h1>Customers</h1>

              <p>
                Manage enrolled students,
                monitor payments and keep
                track of follow-ups from one
                workspace.
              </p>
            </div>

            <button
              type="button"
              onClick={loadCustomers}
              className="ciu-btn-light"
              style={{
                position: "relative",
                zIndex: 10,
                pointerEvents: "auto",
                minHeight: 42,
                flexShrink: 0,
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div
            style={{
              marginTop: 18,
              padding: "13px 16px",
              borderRadius: 12,
              border:
                "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {/* KPI CARDS */}

        <div
          className="ciu-customer-kpis"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, minmax(0, 1fr))",
            gap: 16,
            marginTop: 20,
          }}
        >
          <KpiCard
            label="Enrolled Students"
            value={totalCustomers}
            description="Students currently in Customers"
            accent="#00695c"
          />

          <KpiCard
            label="New This Month"
            value={newThisMonth}
            description="Recently enrolled students"
            accent="#2e7d32"
          />

          <KpiCard
            label="Tuition Value"
            value={formatCurrency(
              totalTuitionValue,
            )}
            description={`${formatCurrency(
              outstandingTuition,
            )} outstanding`}
            accent="#558b2f"
          />

          <KpiCard
            label="Follow-Ups Due"
            value={dueFollowUps}
            description="Students requiring attention"
            accent="#c77700"
          />
        </div>

        {/* SUMMARY */}

        <div
          className="ciu-customer-summary"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: 16,
            marginTop: 16,
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
            label="Average Payment"
            value={`${averagePayment}%`}
          />
        </div>

        {/* WORKSPACE */}

        <div
          className="ciu-card"
          style={{
            marginTop: 20,
          }}
        >
          <div className="ciu-card-head">
            <div>
              <strong>
                Enrolled Students
              </strong>

              <span>
                View and manage all students
                who have reached the Enrolled
                stage.
              </span>
            </div>

            <span
              style={{
                marginTop: 0,
                padding: "6px 10px",
                borderRadius: 999,
                background: "#e8f5f1",
                color: "#00695c",
                fontWeight: 800,
              }}
            >
              {filteredCustomers.length}{" "}
              student
              {filteredCustomers.length ===
              1
                ? ""
                : "s"}
            </span>
          </div>

          {/* FILTERS */}

          <div
            style={{
              padding: 18,
              borderBottom:
                "1px solid #edf2ef",
              background: "#fbfdfc",
            }}
          >
            <div
              className="ciu-customer-filters"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "minmax(280px, 1fr) 220px auto",
                gap: 12,
                alignItems: "center",
              }}
            >
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search students, CIU number, phone, email or programme..."
                style={inputStyle}
              />

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value,
                  )
                }
                style={inputStyle}
              >
                <option>
                  All Enrolled Students
                </option>
                <option>Enrolled</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter(
                    "All Enrolled Students",
                  );
                }}
                className="ciu-btn-light"
                style={{
                  minHeight: 42,
                  whiteSpace:
                    "nowrap",
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* TABLE */}

          {loading ? (
            <LoadingState />
          ) : filteredCustomers.length ===
            0 ? (
            <EmptyState
              hasSearch={
                search.trim().length > 0 ||
                statusFilter !==
                  "All Enrolled Students"
              }
            />
          ) : (
            <div
              className="ciu-table-scroll"
              style={{
                maxHeight:
                  "calc(100vh - 365px)",
                minHeight: 320,
                overflowX: "auto",
                overflowY: "auto",
              }}
            >
              <table
                className="ciu-report-table"
                style={{
                  minWidth: 1180,
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
                    <th>Student</th>
                    <th>CIU Number</th>
                    <th>Programme</th>
                    <th>Stage</th>
                    <th>Tuition</th>
                    <th>Follow-Up</th>
                    <th>Assigned To</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map(
                    (customer) => {
                      const lead =
                        customer.lead_id
                          ? leads[
                              customer
                                .lead_id
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
                              customer
                                .assigned_to
                            ]
                          : null;

                      const followUpDue =
                        isFollowUpDue(
                          customer.follow_up_date,
                        );

                      return (
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
                                gap: 11,
                              }}
                            >
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  flex:
                                    "0 0 38px",
                                  borderRadius:
                                    12,
                                  background:
                                    "#e8f5f1",
                                  color:
                                    "#00695c",
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  justifyContent:
                                    "center",
                                  fontSize: 12,
                                  fontWeight:
                                    900,
                                }}
                              >
                                {getInitials(
                                  customer.full_names,
                                )}
                              </div>

                              <div>
                                <div
                                  style={{
                                    fontWeight:
                                      800,
                                    color:
                                      "#17322c",
                                  }}
                                >
                                  {
                                    customer.full_names
                                  }
                                </div>

                                <div
                                  style={{
                                    marginTop:
                                      4,
                                    fontSize:
                                      12,
                                    color:
                                      "#71817b",
                                  }}
                                >
                                  {customer.telephone ||
                                    lead?.phone ||
                                    "No phone"}
                                </div>

                                <div
                                  style={{
                                    marginTop:
                                      2,
                                    fontSize:
                                      12,
                                    color:
                                      "#71817b",
                                  }}
                                >
                                  {customer.email ||
                                    lead?.email ||
                                    "No email"}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td>
                            <span
                              style={{
                                color:
                                  "#00695c",
                                fontWeight:
                                  800,
                              }}
                            >
                              {customer.ciu_number ||
                                "—"}
                            </span>
                          </td>

                          <td>
                            <div
                              style={{
                                maxWidth: 230,
                                color:
                                  "#36564e",
                                fontWeight:
                                  650,
                              }}
                            >
                              {
                                customer.program
                              }
                            </div>
                          </td>

                          <td>
                            <StatusBadge />
                          </td>

                          <td
                            style={{
                              minWidth: 200,
                            }}
                          >
                            <div
                              style={{
                                fontWeight:
                                  800,
                                color:
                                  "#17322c",
                              }}
                            >
                              {formatCurrency(
                                customer.tuition_paid,
                              )}{" "}
                              <span
                                style={{
                                  color:
                                    "#8a9993",
                                  fontWeight:
                                    600,
                                }}
                              >
                                /
                              </span>{" "}
                              {formatCurrency(
                                customer.tuition_fee,
                              )}
                            </div>

                            <div
                              style={{
                                marginTop:
                                  8,
                                height: 7,
                                borderRadius:
                                  999,
                                background:
                                  "#e7eeeb",
                                overflow:
                                  "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${paymentPercentage}%`,
                                  height:
                                    "100%",
                                  background:
                                    paymentPercentage >=
                                    100
                                      ? "#2e7d32"
                                      : "#00695c",
                                  borderRadius:
                                    999,
                                }}
                              />
                            </div>

                            <div
                              style={{
                                marginTop:
                                  4,
                                fontSize:
                                  11,
                                color:
                                  "#71817b",
                                fontWeight:
                                  700,
                              }}
                            >
                              {
                                paymentPercentage
                              }
                              % paid
                            </div>
                          </td>

                          <td>
                            {customer.follow_up_date ? (
                              <div>
                                <div
                                  style={{
                                    fontWeight:
                                      750,
                                    color:
                                      followUpDue
                                        ? "#b42318"
                                        : "#36564e",
                                  }}
                                >
                                  {formatDate(
                                    customer.follow_up_date,
                                  )}
                                </div>

                                <div
                                  style={{
                                    marginTop:
                                      4,
                                    fontSize:
                                      11,
                                    color:
                                      followUpDue
                                        ? "#b42318"
                                        : "#71817b",
                                    fontWeight:
                                      750,
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
                                    12,
                                  color:
                                    "#9aa8a2",
                                }}
                              >
                                Not scheduled
                              </span>
                            )}
                          </td>

                          <td>
                            <span
                              style={{
                                color:
                                  "#536861",
                                fontSize:
                                  12,
                                fontWeight:
                                  700,
                              }}
                            >
                              {assignedProfile?.full_name ||
                                "Unassigned"}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              onClick={() =>
                                openViewModal(
                                  customer,
                                )
                              }
                              className="ciu-btn"
                              style={{
                                minHeight: 38,
                                padding:
                                  "8px 15px",
                              }}
                            >
                              View
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

      {/* VIEW MODAL */}

      {showViewModal &&
        selectedCustomer && (
          <Modal
            title="Student Details"
            onClose={closeModals}
            wide
          >
            <div
              style={{
                padding: 20,
                borderRadius: 16,
                background:
                  "linear-gradient(135deg, #f1faf7 0%, #f8fcfa 100%)",
                border:
                  "1px solid #d7e9e2",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  gap: 14,
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 16,
                    background:
                      "#00695c",
                    color: "#ffffff",
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    fontSize: 17,
                    fontWeight: 900,
                  }}
                >
                  {getInitials(
                    selectedCustomer.full_names,
                  )}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 850,
                      color:
                        "#17322c",
                    }}
                  >
                    {
                      selectedCustomer.full_names
                    }
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      color:
                        "#667872",
                      fontSize: 13,
                    }}
                  >
                    {selectedCustomer.ciu_number ||
                      "No CIU number"}{" "}
                    •{" "}
                    {
                      selectedCustomer.program
                    }
                  </div>
                </div>

                <div
                  style={{
                    marginLeft:
                      "auto",
                  }}
                >
                  <StatusBadge />
                </div>
              </div>
            </div>

            {/* ACTIONS */}

            <div
              style={{
                marginBottom: 22,
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
                Student Actions
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(4, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                <ActionButton
                  label="Update Student"
                  description="Edit record"
                  onClick={() =>
                    openEditModal(
                      selectedCustomer,
                    )
                  }
                  primary
                />

                <ActionButton
                  label="Follow Up"
                  description="Schedule contact"
                  onClick={() =>
                    openFollowUpModal(
                      selectedCustomer,
                    )
                  }
                />

                <ActionButton
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

                <ActionButton
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
            </div>

            {/* DETAILS */}

            <div
              className="ciu-detail-grid"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: 12,
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
                marginTop: 14,
                padding: 15,
                borderRadius: 12,
                background:
                  "#f7faf8",
                border:
                  "1px solid #e1ebe7",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 850,
                  color: "#687a73",
                  textTransform:
                    "uppercase",
                  letterSpacing:
                    "0.05em",
                }}
              >
                Notes
              </div>

              <div
                style={{
                  marginTop: 7,
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "#36564e",
                  whiteSpace:
                    "pre-wrap",
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

      {/* EDIT MODAL */}

      {showEditModal &&
        selectedCustomer && (
          <Modal
            title="Update Enrolled Student"
            onClose={closeModals}
            wide
          >
            <form
              onSubmit={
                handleEditCustomer
              }
            >
              <div
                className="ciu-form-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(2, minmax(0, 1fr))",
                  gap: 16,
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
                        full_names:
                          value,
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
                        telephone:
                          value,
                      }),
                    )
                  }
                />

                <FormField
                  label="Email"
                  type="email"
                  value={
                    editForm.email
                  }
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
                        tuition_fee:
                          value,
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
                        tuition_paid:
                          value,
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
                        application_fee:
                          value,
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
                        acceptance_fee:
                          value,
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
                  marginTop: 16,
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#36564e",
                    marginBottom: 7,
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
                  gap: 10,
                  marginTop: 20,
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

      {/* FOLLOW-UP MODAL */}

      {showFollowUpModal &&
        selectedCustomer && (
          <Modal
            title="Schedule Follow-Up"
            onClose={closeModals}
          >
            <form
              onSubmit={handleFollowUp}
            >
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#36564e",
                  marginBottom: 7,
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
                        event.target.value,
                    }),
                  )
                }
                style={inputStyle}
              />

              <div
                style={{
                  marginTop: 16,
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#36564e",
                    marginBottom: 7,
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
                          event.target.value,
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
                  gap: 10,
                  marginTop: 20,
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
   HELPERS / COMPONENTS
============================================================ */

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function StatusBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding: "6px 10px",
        background: "#e8f5f1",
        color: "#00695c",
        border:
          "1px solid #b8ddd2",
        fontSize: 11,
        fontWeight: 850,
      }}
    >
      <span>●</span>
      Enrolled
    </span>
  );
}

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
      className="ciu-card"
      style={{
        position: "relative",
        padding: 20,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: accent,
        }}
      />

      <div
        style={{
          color: "#71817b",
          fontSize: 11,
          fontWeight: 850,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 9,
          color: "#17322c",
          fontSize: 26,
          lineHeight: 1.15,
          fontWeight: 850,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 7,
          color: "#87958f",
          fontSize: 12,
        }}
      >
        {description}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      className="ciu-strip"
      style={{
        background:
          "linear-gradient(135deg, #ffffff 0%, #f8fcfa 100%)",
      }}
    >
      <span
        style={{
          display: "block",
          fontSize: 11,
          fontWeight: 850,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </span>

      <strong
        style={{
          display: "block",
          marginTop: 6,
          fontSize: 19,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function ActionButton({
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
          ? "1px solid #00695c"
          : "1px solid #d6e3de",
        background: primary
          ? "#00695c"
          : "#ffffff",
        color: primary
          ? "#ffffff"
          : "#36564e",
        borderRadius: 11,
        padding: "13px 14px",
        cursor: disabled
          ? "not-allowed"
          : "pointer",
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 850,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 11,
          color: primary
            ? "#d8eee8"
            : "#71817b",
        }}
      >
        {description}
      </div>
    </button>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: 13,
        borderRadius: 11,
        border:
          "1px solid #e1ebe7",
        background: "#f8fbf9",
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#71817b",
          fontWeight: 850,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 14,
          color: "#17322c",
          fontWeight: 700,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
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
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 700,
          color: "#36564e",
          marginBottom: 7,
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

function LoadingState() {
  return (
    <div
      style={{
        padding: "70px 20px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          margin: "0 auto 14px",
          borderRadius: 14,
          background: "#e8f5f1",
          color: "#00695c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 21,
        }}
      >
        …
      </div>

      <div
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: "#17322c",
        }}
      >
        Loading enrolled students...
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 13,
          color: "#71817b",
        }}
      >
        Please wait while the customer
        workspace loads.
      </div>
    </div>
  );
}

function EmptyState({
  hasSearch,
}: {
  hasSearch: boolean;
}) {
  return (
    <div
      style={{
        padding: "70px 20px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 58,
          height: 58,
          margin: "0 auto 14px",
          borderRadius: 16,
          background: "#e8f5f1",
          color: "#00695c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 27,
        }}
      >
        🎓
      </div>

      <h3
        style={{
          margin: "0 0 8px",
          fontSize: 18,
          fontWeight: 850,
          color: "#17322c",
        }}
      >
        {hasSearch
          ? "No students match your search"
          : "No enrolled students found"}
      </h3>

      <p
        style={{
          margin: 0,
          color: "#71817b",
          fontSize: 14,
        }}
      >
        {hasSearch
          ? "Try changing your search or filter."
          : "Students will appear here after their admission is moved to the Enrolled stage."}
      </p>
    </div>
  );
}

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
          "rgba(10, 35, 30, 0.62)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: wide
            ? 920
            : 700,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#ffffff",
          borderRadius: 18,
          boxShadow:
            "0 30px 80px rgba(10,35,30,0.25)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: 16,
            padding: "17px 20px",
            background:
              "linear-gradient(135deg, #00574d, #00695c)",
            color: "#ffffff",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
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
                "1px solid rgba(255,255,255,0.25)",
              background:
                "rgba(255,255,255,0.10)",
              color: "#ffffff",
              width: 34,
              height: 34,
              borderRadius: 9,
              cursor: "pointer",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            padding: 20,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "flex-end",
        marginTop: 20,
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