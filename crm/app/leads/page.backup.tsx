"use client";

import { useMemo, useState } from "react";

type Lead = {
  id: number;
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

const INITIAL_LEADS: Lead[] = [
  {
    id: 1,
    ciuNumber: "CIU001",
    fullNames: "Sarah Nakato",
    telephone: "0700123456",
    email: "sarah@example.com",
    program: "Bachelor of Nursing",
    feedback: "Very interested and requested fees information.",
    followUp: "Interested",
    followUpDate: "2026-09-07",
    assignedStaff: "Marketing Team",
    amountPaid: 0,
  },
  {
    id: 2,
    ciuNumber: "CIU002",
    fullNames: "David Ochieng",
    telephone: "0701234567",
    email: "david@example.com",
    program: "Bachelor of Business Administration",
    feedback: "Asked about tuition and payment plan.",
    followUp: "Financial Issues",
    followUpDate: "2026-09-08",
    assignedStaff: "Admissions",
    amountPaid: 0,
  },
  {
    id: 3,
    ciuNumber: "CIU003",
    fullNames: "Amina Hassan",
    telephone: "0702345678",
    email: "amina@example.com",
    program: "Master of Public Health",
    feedback: "Interested but has not yet responded.",
    followUp: "No Answer",
    followUpDate: "2026-09-06",
    assignedStaff: "Marketing Team",
    amountPaid: 0,
  },
];

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

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
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
  });

  const filteredLeads = useMemo(() => {
    const searchText = search.toLowerCase();

    return leads.filter((lead) => {
      const searchableText = [
        lead.ciuNumber,
        lead.fullNames,
        lead.telephone,
        lead.email,
        lead.program,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(searchText);
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
    setShowForm(true);
  }

  function closeAddLeadForm() {
    setShowForm(false);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newLead: Lead = {
      id: Date.now(),
      ciuNumber: form.ciuNumber,
      fullNames: form.fullNames,
      telephone: form.telephone,
      email: form.email,
      program: form.program,
      feedback: form.feedback,
      followUp: form.followUp,
      followUpDate: form.followUpDate,
      assignedStaff: form.assignedStaff,
      amountPaid: Number(form.amountPaid) || 0,
    };

    setLeads((currentLeads) => [newLead, ...currentLeads]);

    setForm({
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
    });

    setShowForm(false);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Leads
            </h1>
            <p className="mt-2 text-slate-600">
              Manage CIU prospects, follow-ups, conversions and fee payments.
            </p>
          </div>

          <button
            type="button"
            onClick={openAddLeadForm}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            + Add New Lead
          </button>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Leads</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {totalLeads}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Interested</p>
            <p className="mt-2 text-2xl font-bold text-blue-600">
              {interested}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Converted</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {converted}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Paid Fees</p>
            <p className="mt-2 text-2xl font-bold text-purple-600">
              {paidFees}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Fees Collected</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              UGX {totalPaid.toLocaleString()}
            </p>
          </div>

        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by CIU number, name, phone, email or program..."
            className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none"
          >
            <option value="All">All Follow Up Statuses</option>

            {FOLLOW_UP_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">

            <table className="w-full min-w-[1200px] text-left text-sm">

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
                </tr>
              </thead>

              <tbody>

                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                  >

                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {lead.ciuNumber}
                    </td>

                    <td className="px-5 py-4 font-medium text-slate-800">
                      {lead.fullNames}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {lead.telephone}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {lead.email || "—"}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {lead.program}
                    </td>

                    <td className="max-w-xs px-5 py-4 text-slate-600">
                      {lead.feedback || "—"}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                          lead.followUp
                        )}`}
                      >
                        {lead.followUp}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {lead.followUpDate || "—"}
                    </td>

                  </tr>
                ))}

                {filteredLeads.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-slate-500"
                    >
                      No leads match your search or filter.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">

            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">

              <div className="mb-6 flex items-center justify-between">

                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Add New Lead
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Enter the prospect's CIU and follow-up information.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeAddLeadForm}
                  className="rounded-lg px-3 py-2 text-xl text-slate-500 hover:bg-slate-100"
                >
                  ×
                </button>

              </div>

              <form
                onSubmit={handleSubmit}
                className="grid gap-4 md:grid-cols-2"
              >

                <input
                  required
                  placeholder="CIU Number"
                  value={form.ciuNumber}
                  onChange={(event) =>
                    updateForm("ciuNumber", event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />

                <input
                  required
                  placeholder="Full Names"
                  value={form.fullNames}
                  onChange={(event) =>
                    updateForm("fullNames", event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />

                <input
                  required
                  placeholder="Telephone Number"
                  value={form.telephone}
                  onChange={(event) =>
                    updateForm("telephone", event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />

                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(event) =>
                    updateForm("email", event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />

                <input
                  required
                  placeholder="Program"
                  value={form.program}
                  onChange={(event) =>
                    updateForm("program", event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />

                <input
                  placeholder="Assigned Staff"
                  value={form.assignedStaff}
                  onChange={(event) =>
                    updateForm("assignedStaff", event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />

                <select
                  value={form.followUp}
                  onChange={(event) =>
                    updateForm("followUp", event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                >
                  {FOLLOW_UP_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  value={form.followUpDate}
                  onChange={(event) =>
                    updateForm("followUpDate", event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Amount Paid (UGX)"
                  value={form.amountPaid}
                  onChange={(event) =>
                    updateForm("amountPaid", event.target.value)
                  }
                  className="rounded-xl border border-slate-200 px-4 py-3"
                />

                <textarea
                  placeholder="Feedback"
                  value={form.feedback}
                  onChange={(event) =>
                    updateForm("feedback", event.target.value)
                  }
                  className="min-h-24 rounded-xl border border-slate-200 px-4 py-3 md:col-span-2"
                />

                <div className="flex justify-end gap-3 md:col-span-2">

                  <button
                    type="button"
                    onClick={closeAddLeadForm}
                    className="rounded-xl border border-slate-200 px-5 py-3 font-semibold text-slate-600"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800"
                  >
                    Save Lead
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