
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ALL_CRM_MODULES,
  MODULE_LABELS,
  getRoleModules,
  isValidCrmRole,
  type CrmModule,
  type CrmRole,
} from "@/lib/permissions";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
  avatar_url: string | null;
  module_permissions: string[] | null;
};

type StaffForm = {
  full_name: string;
  phone: string;
  role: CrmRole;
  is_active: boolean;
  useRoleDefaults: boolean;
  modules: CrmModule[];
};

const ROLES: CrmRole[] = [
  "super_admin",
  "admin",
  "manager",
  "salesperson",
  "marketing",
  "finance",
  "viewer",
];

const initialForm: StaffForm = {
  full_name: "",
  phone: "",
  role: "salesperson",
  is_active: true,
  useRoleDefaults: true,
  modules: getRoleModules("salesperson"),
};

export default function Staff() {
  const supabase = createClient();

  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<StaffForm>(initialForm);
  const [currentRole, setCurrentRole] = useState<CrmRole | null>(null);
  const [authorised, setAuthorised] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("profiles")
      .select(
        "id,full_name,phone,role,is_active,avatar_url,module_permissions",
      )
      .order("full_name", { ascending: true });

    if (loadError) {
      setError(loadError.message);
    } else {
      setStaff((data ?? []) as Profile[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    async function initialise() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userError || !user) {
        setError("Please sign in to manage staff.");
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profileError || !profile || profile.role !== "super_admin") {
        setCurrentRole(
          isValidCrmRole(profile?.role) ? profile.role : null,
        );
        setError("Only Super Admin can manage staff and module permissions.");
        setLoading(false);
        return;
      }

      setCurrentRole("super_admin");
      setAuthorised(true);
    }

    void initialise();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (authorised) void load();
  }, [authorised, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return staff.filter((s) =>
      !q ||
      [s.full_name, s.phone, s.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [staff, search]);

  const active = staff.filter((s) => s.is_active !== false).length;

  function openEdit(s: Profile) {
    const role: CrmRole = isValidCrmRole(s.role) ? s.role : "viewer";
    const useRoleDefaults = s.module_permissions == null;

    setEditing(s);
    setForm({
      full_name: s.full_name ?? "",
      phone: s.phone ?? "",
      role,
      is_active: s.is_active !== false,
      useRoleDefaults,
      modules: useRoleDefaults
        ? getRoleModules(role)
        : (s.module_permissions ?? []).filter(
            (module): module is CrmModule =>
              ALL_CRM_MODULES.includes(module as CrmModule),
          ),
    });
    setError("");
  }

  function changeRole(role: CrmRole) {
    setForm((previous) => ({
      ...previous,
      role,
      modules: previous.useRoleDefaults
        ? getRoleModules(role)
        : previous.modules,
    }));
  }

  function toggleModule(module: CrmModule, checked: boolean) {
    setForm((previous) => ({
      ...previous,
      modules: checked
        ? [...new Set([...previous.modules, module])]
        : previous.modules.filter((item) => item !== module),
    }));
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing || !authorised || currentRole !== "super_admin") return;

    setSaving(true);
    setError("");

    const modulePermissions =
      form.role === "super_admin" || form.useRoleDefaults
        ? null
        : ALL_CRM_MODULES.filter((module) =>
            form.modules.includes(module),
          );

    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim() || null,
        phone: form.phone.trim() || null,
        role: form.role,
        is_active: form.is_active,
        module_permissions: modulePermissions,
      })
      .eq("id", editing.id);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setEditing(null);
    await load();
    setSaving(false);
  }

  return (
    <>
      <div className="crm-page-heading">
        <div>
          <h1>Staff &amp; Team</h1>
          <p>Manage staff profiles, roles and individual CRM access.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="crm-btn"
          disabled={loading || !authorised}
        >
          {loading ? "Refreshing..." : "Refresh Staff"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 8,
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      )}

      {authorised && (
        <>
          <div className="crm-kpis">
            <div className="crm-kpi">
              <span className="crm-kpi-label">Total Staff</span>
              <div className="crm-kpi-value">{staff.length}</div>
              <span className="crm-kpi-change">CRM profiles</span>
            </div>
            <div className="crm-kpi">
              <span className="crm-kpi-label">Active</span>
              <div className="crm-kpi-value">{active}</div>
              <span className="crm-kpi-change">Currently active</span>
            </div>
            <div className="crm-kpi">
              <span className="crm-kpi-label">Managers/Admins</span>
              <div className="crm-kpi-value">
                {
                  staff.filter((s) =>
                    ["super_admin", "admin", "manager"].includes(
                      s.role ?? "",
                    ),
                  ).length
                }
              </div>
              <span className="crm-kpi-change">Management roles</span>
            </div>
            <div className="crm-kpi">
              <span className="crm-kpi-label">Inactive</span>
              <div className="crm-kpi-value">{staff.length - active}</div>
              <span className="crm-kpi-change">Needs review</span>
            </div>
          </div>

          <div className="crm-card">
            <div
              className="crm-card-header"
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2>Team Directory</h2>
                <span>Edit existing authenticated profiles</span>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff..."
                style={{
                  padding: "9px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: 8,
                  minWidth: 220,
                }}
              />
            </div>

            <div className="crm-table-wrap">
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Module Access</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                        Loading staff...
                      </td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr key={s.id}>
                        <td><strong>{s.full_name || "Unnamed"}</strong></td>
                        <td>{s.phone || "—"}</td>
                        <td>
                          <span className="crm-badge">
                            {(s.role || "viewer").replaceAll("_", " ")}
                          </span>
                        </td>
                        <td>
                          {s.role === "super_admin"
                            ? "All modules"
                            : s.module_permissions == null
                              ? "Role defaults"
                              : `${s.module_permissions.length} assigned`}
                        </td>
                        <td>
                          <span className="crm-badge">
                            {s.is_active === false ? "Inactive" : "Active"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => openEdit(s)}
                            className="crm-btn"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", padding: 30 }}>
                        No staff found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {editing && authorised && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            overflowY: "auto",
          }}
        >
          <form
            onSubmit={save}
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight: "90vh",
              overflowY: "auto",
              background: "#fff",
              color: "#111827",
              borderRadius: 14,
              padding: 22,
              boxShadow: "0 20px 50px rgba(0,0,0,.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 18,
              }}
            >
              <div>
                <h2 style={{ margin: 0 }}>Edit Staff Profile</h2>
                <p style={{ margin: "5px 0 0", fontSize: 12, color: "#64748b" }}>
                  {editing.full_name || "Staff member"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                aria-label="Close"
                style={{
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "grid", gap: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Full Name
                <input
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    height: 42,
                    marginTop: 6,
                    padding: "0 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Phone
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  style={{
                    display: "block",
                    width: "100%",
                    height: 42,
                    marginTop: 6,
                    padding: "0 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    boxSizing: "border-box",
                  }}
                />
              </label>

              <label style={{ fontSize: 13, fontWeight: 600 }}>
                Role
                <select
                  value={form.role}
                  onChange={(e) => changeRole(e.target.value as CrmRole)}
                  style={{
                    display: "block",
                    width: "100%",
                    height: 42,
                    marginTop: 6,
                    padding: "0 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>

              <div
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>
                  Module Permissions
                </h3>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b" }}>
                  Choose the sections this staff member can access.
                </p>

                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    marginBottom: 14,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.useRoleDefaults}
                    disabled={form.role === "super_admin"}
                    onChange={(e) => {
                      const useDefaults = e.target.checked;
                      setForm((previous) => ({
                        ...previous,
                        useRoleDefaults: useDefaults,
                        modules: useDefaults
                          ? getRoleModules(previous.role)
                          : previous.modules,
                      }));
                    }}
                  />
                  Use role defaults
                </label>

                {form.role === "super_admin" && (
                  <p style={{ color: "#166534", fontSize: 12 }}>
                    Super Admin always has access to all modules.
                  </p>
                )}

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                  }}
                >
                  {ALL_CRM_MODULES.map((module) => (
                    <label
                      key={module}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        fontSize: 13,
                        padding: "8px 10px",
                        border: "1px solid #e5e7eb",
                        borderRadius: 8,
                        background: "#fff",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={
                          form.role === "super_admin" ||
                          form.modules.includes(module)
                        }
                        disabled={
                          form.role === "super_admin" ||
                          form.useRoleDefaults
                        }
                        onChange={(e) =>
                          toggleModule(module, e.target.checked)
                        }
                      />
                      {MODULE_LABELS[module]}
                    </label>
                  ))}
                </div>

                {!form.useRoleDefaults && form.role !== "super_admin" && (
                  <p style={{ margin: "12px 0 0", fontSize: 12, color: "#64748b" }}>
                    {form.modules.length} of {ALL_CRM_MODULES.length} modules selected.
                  </p>
                )}
              </div>

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                />
                Active staff member
              </label>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 22,
              }}
            >
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="crm-btn secondary"
              >
                Cancel
              </button>
              <button type="submit" disabled={saving} className="crm-btn">
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
