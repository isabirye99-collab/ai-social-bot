"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

type NewStaff = {
  full_name: string;
  email: string;
  phone: string;
  role: string;
  temporary_password: string;
};

type Preferences = {
  email: boolean;
  followups: boolean;
  reports: boolean;
  marketing: boolean;
};

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "salesperson", label: "Salesperson" },
  { value: "marketing", label: "Marketing" },
  { value: "finance", label: "Finance" },
  { value: "viewer", label: "Viewer" },
];

const DEFAULT_PREFERENCES: Preferences = {
  email: true,
  followups: true,
  reports: true,
  marketing: true,
};

const LOGO_STORAGE_KEY = "ciu_crm_logo";
const LOGO_NAME_KEY = "ciu_crm_logo_name";
const PREFERENCES_KEY = "ciu_crm_preferences";

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 40,
  boxSizing: "border-box",
  padding: "9px 11px",
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  background: "#fff",
  color: "#17322c",
  fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#17322c",
  fontSize: 12,
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 8,
  padding: "11px 16px",
  background: "#00695c",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

function roleLabel(role: string | null | undefined) {
  return ROLES.find((item) => item.value === role)?.label ||
    role?.replaceAll("_", " ") ||
    "No role";
}

export default function Settings() {
  const supabase = createClient();

  const [activeSection, setActiveSection] = useState("general");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileSearch, setProfileSearch] = useState("");

  const [newStaff, setNewStaff] = useState<NewStaff>({
    full_name: "",
    email: "",
    phone: "",
    role: "salesperson",
    temporary_password: "",
  });

  const [logo, setLogo] = useState("");
  const [logoName, setLogoName] = useState("");
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);

  const isSuperAdmin = role === "super_admin";

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        setLoading(true);
        setError("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user) throw new Error("You are not signed in.");

        const [profileResult, settingsResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("crm_settings")
            .select("logo_data_url, logo_name, preferences")
            .eq("id", 1)
            .maybeSingle(),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (settingsResult.error) throw settingsResult.error;
        if (!mounted) return;

        setCurrentUserId(user.id);
        setEmail(user.email || "");

        const currentRole = profileResult.data?.role || "";
        setRole(currentRole);

        if (currentRole !== "super_admin") {
          setActiveSection("general");
        }

        if (settingsResult.data) {
          const settings = settingsResult.data;

          const savedLogo = settings.logo_data_url || "";
          const savedLogoName = settings.logo_name || "";
          const savedPreferences = {
            ...DEFAULT_PREFERENCES,
            ...(settings.preferences || {}),
          };

          setLogo(savedLogo);
          setLogoName(savedLogoName);
          setPreferences(savedPreferences);

          try {
            localStorage.setItem(LOGO_STORAGE_KEY, savedLogo);
            localStorage.setItem(LOGO_NAME_KEY, savedLogoName);
            localStorage.setItem(
              PREFERENCES_KEY,
              JSON.stringify(savedPreferences),
            );
          } catch {
            // Browser storage may be unavailable.
          }
        } else {
          try {
            setLogo(localStorage.getItem(LOGO_STORAGE_KEY) || "");
            setLogoName(localStorage.getItem(LOGO_NAME_KEY) || "");

            const localPreferences =
              localStorage.getItem(PREFERENCES_KEY);

            if (localPreferences) {
              setPreferences({
                ...DEFAULT_PREFERENCES,
                ...JSON.parse(localPreferences),
              });
            }
          } catch {
            // Continue with default settings.
          }
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load CRM settings.",
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadProfiles() {
    if (!isSuperAdmin) return;

    try {
      setProfilesLoading(true);
      setError("");

      const { data, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, role, is_active")
        .order("full_name", { ascending: true });

      if (profilesError) throw profilesError;

      setProfiles((data || []) as Profile[]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load users and staff.",
      );
    } finally {
      setProfilesLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin && activeSection === "users") {
      loadProfiles();
    }
  }, [isSuperAdmin, activeSection]);

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isSuperAdmin || creatingStaff) return;

    const full_name = newStaff.full_name.trim();
    const emailAddress = newStaff.email.trim().toLowerCase();
    const temporaryPassword = newStaff.temporary_password;

    if (!full_name || !emailAddress || !newStaff.role) {
      setError("Enter the staff member's name, email and role.");
      return;
    }

    if (temporaryPassword.length < 10) {
      setError("The temporary password must be at least 10 characters.");
      return;
    }

    try {
      setCreatingStaff(true);
      setError("");
      setSuccessMessage("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch("/api/staff", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          full_name,
          email: emailAddress,
          phone: newStaff.phone.trim(),
          role: newStaff.role,
          temporary_password: temporaryPassword,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to create the staff account.",
        );
      }

      setNewStaff({
        full_name: "",
        email: "",
        phone: "",
        role: "salesperson",
        temporary_password: "",
      });

      await loadProfiles();

      setSuccessMessage(
        result.message ||
          "Staff account created. The staff member must change the temporary password at first login.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create the staff account.",
      );
    } finally {
      setCreatingStaff(false);
    }
  }

  async function saveSettings() {
    if (!isSuperAdmin || saving) return;

    try {
      setSaving(true);
      setError("");
      setSuccessMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("You are not signed in.");

      const { error: saveError } = await supabase
        .from("crm_settings")
        .upsert(
          {
            id: 1,
            logo_data_url: logo || null,
            logo_name: logoName || null,
            preferences,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

      if (saveError) throw saveError;

      try {
        localStorage.setItem(LOGO_STORAGE_KEY, logo);
        localStorage.setItem(LOGO_NAME_KEY, logoName);
        localStorage.setItem(
          PREFERENCES_KEY,
          JSON.stringify(preferences),
        );
      } catch {
        // Database save has already completed.
      }

      window.dispatchEvent(
        new CustomEvent("ciu-crm-logo-updated", {
          detail: { logo, logoName },
        }),
      );

      setSuccessMessage("CRM settings saved successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save CRM settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    if (!isSuperAdmin) return;

    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccessMessage("");

    if (file.size > 1024 * 1024) {
      setError("Please choose a logo smaller than 1 MB.");
      event.target.value = "";
      return;
    }

    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError("Please choose a PNG, JPG, WEBP or SVG logo.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Unable to read the selected logo.");
        return;
      }

      setLogo(reader.result);
      setLogoName(file.name);
    };

    reader.onerror = () => {
      setError("Unable to read the selected logo.");
    };

    reader.readAsDataURL(file);
  }

  const filteredProfiles = profiles.filter((profile) => {
    const search = profileSearch.trim().toLowerCase();

    if (!search) return true;

    return [
      profile.full_name || "",
      profile.phone || "",
      profile.role || "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  const sections = [
    { id: "general", label: "General", description: "Account information" },
    { id: "branding", label: "Branding", description: "Logo and identity" },
    { id: "users", label: "Users & Staff", description: "Staff and roles" },
    {
      id: "notifications",
      label: "Notifications",
      description: "CRM preferences",
    },
    { id: "security", label: "Security", description: "Access information" },
  ];

  if (loading) {
    return (
      <div className="ciu-page">
        <div className="ciu-page-inner">
          <div className="crm-card">
            <div className="crm-card-body">Loading CRM settings...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !role) {
    return (
      <div className="ciu-page">
        <div className="ciu-page-inner">
          <div
            style={{
              marginTop: 24,
              padding: 16,
              borderRadius: 10,
              background: "#fef2f2",
              color: "#b91c1c",
            }}
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ciu-page">
      <div className="ciu-page-inner">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: "0 0 6px", color: "#17322c" }}>
            Settings
          </h1>
          <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
            Manage your account, branding, users and CRM preferences.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#b91c1c",
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              fontSize: 13,
            }}
          >
            {successMessage}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(190px, 250px) minmax(0, 1fr)",
            gap: 20,
            alignItems: "start",
          }}
        >
          <div className="crm-card">
            <div className="crm-card-body" style={{ padding: 10 }}>
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    if (section.id === "users" && !isSuperAdmin) {
                      setError("Only a Super Admin can manage users and staff.");
                      return;
                    }

                    setError("");
                    setSuccessMessage("");
                    setActiveSection(section.id);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "12px 10px",
                    marginBottom: 4,
                    border: 0,
                    borderRadius: 8,
                    textAlign: "left",
                    cursor: "pointer",
                    background:
                      activeSection === section.id ? "#e6f4ef" : "transparent",
                    color:
                      activeSection === section.id ? "#00695c" : "#17322c",
                  }}
                >
                  <strong style={{ display: "block", fontSize: 13 }}>
                    {section.label}
                  </strong>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      color: "#64748b",
                      fontSize: 11,
                    }}
                  >
                    {section.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
            {activeSection === "general" && (
              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>General Settings</h2>
                    <span>Your signed-in account information</span>
                  </div>
                </div>
                <div className="crm-card-body" style={{ display: "grid", gap: 16 }}>
                  <div>
                    <label style={labelStyle}>Email address</label>
                    <input value={email} readOnly style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Your CRM role</label>
                    <input value={roleLabel(role)} readOnly style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Account ID</label>
                    <input value={currentUserId} readOnly style={inputStyle} />
                  </div>
                  <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>
                    Your available CRM features depend on the role assigned to
                    your account.
                  </p>
                </div>
              </div>
            )}

            {activeSection === "branding" && (
              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>Branding</h2>
                    <span>Manage the CRM logo</span>
                  </div>
                </div>
                <div className="crm-card-body" style={{ display: "grid", gap: 16 }}>
                  {logo && (
                    <div
                      style={{
                        padding: 18,
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        background: "#f8fafc",
                      }}
                    >
                      <img
                        src={logo}
                        alt="CRM logo preview"
                        style={{
                          maxWidth: 220,
                          maxHeight: 100,
                          objectFit: "contain",
                        }}
                      />
                      {logoName && (
                        <p style={{ fontSize: 12, color: "#64748b" }}>
                          {logoName}
                        </p>
                      )}
                    </div>
                  )}

                  {isSuperAdmin ? (
                    <>
                      <label style={labelStyle}>
                        Choose a logo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleLogoChange}
                          style={inputStyle}
                        />
                      </label>
                      <p style={{ color: "#64748b", fontSize: 12 }}>
                        Accepted formats: PNG, JPG, WEBP or SVG. Maximum size:
                        1 MB.
                      </p>
                      <div>
                        <button
                          type="button"
                          onClick={saveSettings}
                          disabled={saving}
                          style={primaryButtonStyle}
                        >
                          {saving ? "Saving..." : "Save Branding"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: "#64748b", fontSize: 13 }}>
                      Only a Super Admin can change CRM branding.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeSection === "users" && isSuperAdmin && (
              <>
                <div className="crm-card">
                  <div className="crm-card-header">
                    <div>
                      <h2>Add Staff Member</h2>
                      <span>Create an account with a temporary password</span>
                    </div>
                  </div>

                  <div className="crm-card-body">
                    <form onSubmit={createStaff} style={{ display: "grid", gap: 14 }}>
                      <p style={{ margin: 0, color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>
                        The staff member must change the temporary password at
                        first login before using the CRM. Share the temporary
                        password securely.
                      </p>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                          gap: 14,
                        }}
                      >
                        <label style={labelStyle}>
                          Full name
                          <input
                            required
                            value={newStaff.full_name}
                            onChange={(event) =>
                              setNewStaff((current) => ({
                                ...current,
                                full_name: event.target.value,
                              }))
                            }
                            placeholder="Staff member's full name"
                            style={inputStyle}
                          />
                        </label>

                        <label style={labelStyle}>
                          Email address
                          <input
                            required
                            type="email"
                            value={newStaff.email}
                            onChange={(event) =>
                              setNewStaff((current) => ({
                                ...current,
                                email: event.target.value,
                              }))
                            }
                            placeholder="staff@ciu.ac.ug"
                            style={inputStyle}
                          />
                        </label>

                        <label style={labelStyle}>
                          Phone number
                          <input
                            value={newStaff.phone}
                            onChange={(event) =>
                              setNewStaff((current) => ({
                                ...current,
                                phone: event.target.value,
                              }))
                            }
                            placeholder="+256..."
                            style={inputStyle}
                          />
                        </label>

                        <label style={labelStyle}>
                          CRM role
                          <select
                            value={newStaff.role}
                            onChange={(event) =>
                              setNewStaff((current) => ({
                                ...current,
                                role: event.target.value,
                              }))
                            }
                            style={inputStyle}
                          >
                            {ROLES.filter(
                              (item) => item.value !== "super_admin",
                            ).map((item) => (
                              <option key={item.value} value={item.value}>
                                {item.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label style={labelStyle}>
                          Temporary password
                          <input
                            required
                            type="password"
                            autoComplete="new-password"
                            minLength={10}
                            value={newStaff.temporary_password}
                            onChange={(event) =>
                              setNewStaff((current) => ({
                                ...current,
                                temporary_password: event.target.value,
                              }))
                            }
                            placeholder="At least 10 characters"
                            style={inputStyle}
                          />
                          <span style={{ color: "#64748b", fontWeight: 400 }}>
                            Do not send the password by email.
                          </span>
                        </label>
                      </div>

                      <div>
                        <button
                          type="submit"
                          disabled={creatingStaff}
                          style={{
                            ...primaryButtonStyle,
                            opacity: creatingStaff ? 0.7 : 1,
                            cursor: creatingStaff ? "wait" : "pointer",
                          }}
                        >
                          {creatingStaff
                            ? "Creating staff account..."
                            : "Create Staff Account"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="crm-card">
                  <div className="crm-card-header">
                    <div>
                      <h2>Users & Staff</h2>
                      <span>Existing accounts and assigned roles</span>
                    </div>
                    <button
                      type="button"
                      onClick={loadProfiles}
                      disabled={profilesLoading}
                      style={{
                        ...primaryButtonStyle,
                        padding: "8px 12px",
                      }}
                    >
                      {profilesLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  <div className="crm-card-body">
                    <input
                      value={profileSearch}
                      onChange={(event) => setProfileSearch(event.target.value)}
                      placeholder="Search by name, phone or role..."
                      style={{ ...inputStyle, marginBottom: 16 }}
                    />

                    {profilesLoading ? (
                      <p>Loading staff accounts...</p>
                    ) : filteredProfiles.length === 0 ? (
                      <p style={{ color: "#64748b", fontSize: 13 }}>
                        No staff accounts found.
                      </p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: 12,
                            textAlign: "left",
                          }}
                        >
                          <thead>
                            <tr style={{ background: "#f8fafc" }}>
                              {["Full name", "Phone", "Role", "Status"].map(
                                (heading) => (
                                  <th
                                    key={heading}
                                    style={{
                                      padding: 12,
                                      borderBottom: "1px solid #e2e8f0",
                                    }}
                                  >
                                    {heading}
                                  </th>
                                ),
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredProfiles.map((profile) => (
                              <tr key={profile.id}>
                                <td
                                  style={{
                                    padding: 12,
                                    borderBottom: "1px solid #e2e8f0",
                                  }}
                                >
                                  {profile.full_name || "Unnamed user"}
                                </td>
                                <td
                                  style={{
                                    padding: 12,
                                    borderBottom: "1px solid #e2e8f0",
                                  }}
                                >
                                  {profile.phone || "—"}
                                </td>
                                <td
                                  style={{
                                    padding: 12,
                                    borderBottom: "1px solid #e2e8f0",
                                  }}
                                >
                                  {roleLabel(profile.role)}
                                </td>
                                <td
                                  style={{
                                    padding: 12,
                                    borderBottom: "1px solid #e2e8f0",
                                  }}
                                >
                                  <span
                                    style={{
                                      color:
                                        profile.is_active === false
                                          ? "#b91c1c"
                                          : "#047857",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {profile.is_active === false
                                      ? "Inactive"
                                      : "Active"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeSection === "notifications" && (
              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>Notification Preferences</h2>
                    <span>Choose the preferences saved for this CRM</span>
                  </div>
                </div>
                <div className="crm-card-body">
                  {(
                    [
                      ["email", "Email notifications"],
                      ["followups", "Lead follow-up reminders"],
                      ["reports", "Weekly performance reports"],
                      ["marketing", "Marketing alerts"],
                    ] as [keyof Preferences, string][]
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 0",
                        borderBottom: "1px solid #e2e8f0",
                        fontSize: 13,
                      }}
                    >
                      {label}
                      <input
                        type="checkbox"
                        checked={preferences[key]}
                        disabled={!isSuperAdmin}
                        onChange={() =>
                          setPreferences((current) => ({
                            ...current,
                            [key]: !current[key],
                          }))
                        }
                        style={{ width: 18, height: 18 }}
                      />
                    </label>
                  ))}

                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={saveSettings}
                      disabled={saving}
                      style={{ ...primaryButtonStyle, marginTop: 18 }}
                    >
                      {saving ? "Saving..." : "Save Preferences"}
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeSection === "security" && (
              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>Security & Access</h2>
                    <span>Information about your current account</span>
                  </div>
                </div>
                <div className="crm-card-body" style={{ display: "grid", gap: 14 }}>
                  <div>
                    <strong style={{ display: "block", fontSize: 12 }}>
                      Current role
                    </strong>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      {roleLabel(role)}
                    </span>
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: 12 }}>
                      Signed-in account
                    </strong>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      {email}
                    </span>
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: 12 }}>
                      Staff account creation
                    </strong>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      Super Admin only
                    </span>
                  </div>
                  <div>
                    <strong style={{ display: "block", fontSize: 12 }}>
                      First-login password change
                    </strong>
                    <span style={{ color: "#64748b", fontSize: 13 }}>
                      New staff accounts should change their temporary
                      password before accessing the CRM.
                    </span>
                  </div>
                  <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>
                    Sensitive credentials should be handled server-side.
                    Database policies and API authorization must enforce access
                    restrictions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}