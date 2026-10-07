"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Preferences = {
  email: boolean;
  followups: boolean;
  reports: boolean;
  marketing: boolean;
};

type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

const DEFAULT_PREFERENCES: Preferences = {
  email: true,
  followups: true,
  reports: true,
  marketing: true,
};

const LOGO_STORAGE_KEY = "ciu_crm_logo";
const LOGO_NAME_KEY = "ciu_crm_logo_name";
const PREFERENCES_KEY = "ciu_crm_preferences";

const ROLES = [
  {
    value: "super_admin",
    label: "Super Admin",
    description: "Full system access and administration.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Manage CRM operations, users and records.",
  },
  {
    value: "manager",
    label: "Manager",
    description: "Manage teams, leads, tasks and performance.",
  },
  {
    value: "salesperson",
    label: "Salesperson",
    description: "Manage leads, follow-ups and opportunities.",
  },
  {
    value: "marketing",
    label: "Marketing",
    description: "Manage campaigns and marketing activities.",
  },
  {
    value: "finance",
    label: "Finance",
    description: "Manage financial and payment information.",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "View CRM information without management access.",
  },
];

export default function Settings() {
  const supabase = createClient();

  const [activeSection, setActiveSection] = useState("general");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  const [logo, setLogo] = useState("");
  const [logoName, setLogoName] = useState("");

  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

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

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error("You are not signed in.");
        }

        if (!mounted) return;

        setEmail(user.email || "");

        const [profileResult, settingsResult] =
          await Promise.all([
            supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle(),

            supabase
              .from("crm_settings")
              .select(
                "logo_data_url, logo_name, preferences",
              )
              .eq("id", 1)
              .maybeSingle(),
          ]);

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (settingsResult.error) {
          throw settingsResult.error;
        }

        if (!mounted) return;

        setRole(profileResult.data?.role || "");

        if (settingsResult.data) {
          const centralLogo =
            settingsResult.data.logo_data_url || "";

          const centralLogoName =
            settingsResult.data.logo_name || "";

          const centralPreferences: Preferences = {
            ...DEFAULT_PREFERENCES,
            ...((settingsResult.data.preferences ||
              {}) as Partial<Preferences>),
          };

          setLogo(centralLogo);
          setLogoName(centralLogoName);
          setPreferences(centralPreferences);

          try {
            localStorage.setItem(
              LOGO_STORAGE_KEY,
              centralLogo,
            );

            localStorage.setItem(
              LOGO_NAME_KEY,
              centralLogoName,
            );

            localStorage.setItem(
              PREFERENCES_KEY,
              JSON.stringify(centralPreferences),
            );
          } catch {}
        } else {
          try {
            const localLogo =
              localStorage.getItem(LOGO_STORAGE_KEY) || "";

            const localLogoName =
              localStorage.getItem(LOGO_NAME_KEY) || "";

            const localPreferences =
              localStorage.getItem(PREFERENCES_KEY);

            setLogo(localLogo);
            setLogoName(localLogoName);

            if (localPreferences) {
              setPreferences({
                ...DEFAULT_PREFERENCES,
                ...JSON.parse(localPreferences),
              });
            }
          } catch {}
        }
      } catch (err) {
        console.error("Settings loading error:", err);

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load CRM settings.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      mounted = false;
    };
  }, []);

  async function loadProfiles() {
    try {
      setProfilesLoading(true);
      setError("");

      const { data, error: profilesError } =
        await supabase
          .from("profiles")
          .select(
            "id, full_name, email, phone, role, is_active",
          )
          .order("full_name", {
            ascending: true,
          });

      if (profilesError) {
        throw profilesError;
      }

      setProfiles((data || []) as Profile[]);
    } catch (err) {
      console.error("Profiles loading error:", err);

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
    if (
      activeSection === "users" ||
      activeSection === "staff"
    ) {
      loadProfiles();
    }
  }, [activeSection]);

  function handleLogoChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setSaved(false);

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
      setError(
        "Please choose a PNG, JPG, WEBP or SVG logo.",
      );
      event.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== "string" || !result) {
        setError("Unable to read the selected logo.");
        return;
      }

      setLogo(result);
      setLogoName(file.name);

      try {
        localStorage.setItem(
          LOGO_STORAGE_KEY,
          result,
        );

        localStorage.setItem(
          LOGO_NAME_KEY,
          file.name,
        );
      } catch {}
    };

    reader.onerror = () => {
      setError("Unable to read the selected logo.");
    };

    reader.readAsDataURL(file);
  }

  function togglePreference(
    key: keyof Preferences,
  ) {
    setPreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));

    setSaved(false);
  }

  async function saveChanges() {
    if (saving) return;

    try {
      setSaving(true);
      setSaved(false);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        throw new Error("You are not signed in.");
      }

      const { error: saveError } =
        await supabase
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
            {
              onConflict: "id",
            },
          );

      if (saveError) throw saveError;

      const {
        data: verifiedSettings,
        error: verificationError,
      } = await supabase
        .from("crm_settings")
        .select(
          "logo_data_url, logo_name, preferences, updated_at",
        )
        .eq("id", 1)
        .maybeSingle();

      if (verificationError) {
        throw verificationError;
      }

      if (!verifiedSettings) {
        throw new Error(
          "The CRM settings could not be verified after saving.",
        );
      }

      const verifiedLogo =
        verifiedSettings.logo_data_url || "";

      const verifiedLogoName =
        verifiedSettings.logo_name || "";

      const verifiedPreferences: Preferences = {
        ...DEFAULT_PREFERENCES,
        ...((verifiedSettings.preferences ||
          {}) as Partial<Preferences>),
      };

      setLogo(verifiedLogo);
      setLogoName(verifiedLogoName);
      setPreferences(verifiedPreferences);

      try {
        localStorage.setItem(
          LOGO_STORAGE_KEY,
          verifiedLogo,
        );

        localStorage.setItem(
          LOGO_NAME_KEY,
          verifiedLogoName,
        );

        localStorage.setItem(
          PREFERENCES_KEY,
          JSON.stringify(verifiedPreferences),
        );
      } catch {}

      window.dispatchEvent(
        new CustomEvent("ciu-crm-logo-updated", {
          detail: {
            logo: verifiedLogo,
            logoName: verifiedLogoName,
          },
        }),
      );

      setSaved(true);
    } catch (err) {
      console.error("Settings save error:", err);

      setSaved(false);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save CRM settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  const preferenceItems: [
    keyof Preferences,
    string,
    string,
  ][] = [
    [
      "email",
      "Email notifications",
      "Keep email notification preferences enabled.",
    ],
    [
      "followups",
      "Lead follow-up reminders",
      "Highlight due and overdue follow-ups.",
    ],
    [
      "reports",
      "Weekly performance reports",
      "Keep reporting preferences enabled.",
    ],
    [
      "marketing",
      "Marketing alerts",
      "Keep campaign and lead-capture alerts enabled.",
    ],
  ];

  const sectionItems = [
    {
      id: "general",
      label: "General",
      icon: "⚙",
      description: "CRM and organization information",
    },
    {
      id: "branding",
      label: "Branding",
      icon: "◈",
      description: "Logo and visual identity",
    },
    {
      id: "users",
      label: "Users & Roles",
      icon: "♟",
      description: "Accounts, roles and access",
    },
    {
      id: "staff",
      label: "Staff",
      icon: "◉",
      description: "Staff records and management",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: "◌",
      description: "CRM alerts and preferences",
    },
    {
      id: "security",
      label: "Security",
      icon: "◇",
      description: "Access and security controls",
    },
  ];

  return (
    <>
      <div className="ciu-page">
        <div className="ciu-page-inner">

          {/* HEADER */}
          <div
            className="ciu-hero"
            style={{
              marginBottom: 18,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: "#00695c",
                  marginBottom: 5,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                Administration
              </div>

              <h1>Settings</h1>

              <p>
                Manage your CRM configuration, users,
                roles, staff and preferences.
              </p>
            </div>
          </div>

          {/* SAVE BAR */}
          <div
            className="crm-card"
            style={{
              marginBottom: 18,
              border: "1px solid #cfe5de",
            }}
          >
            <div
              className="crm-card-body"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                padding: "15px 20px",
                background: "#f7fbf9",
              }}
            >
              <div>
                <strong
                  style={{
                    display: "block",
                    fontSize: 14,
                    color: "#17322c",
                  }}
                >
                  Settings changes
                </strong>

                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    color: "#64748b",
                    marginTop: 4,
                  }}
                >
                  Save branding and CRM preferences centrally.
                </span>
              </div>

              <button
                type="button"
                onClick={saveChanges}
                disabled={saving || loading}
                className="crm-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: 42,
                  minWidth: 150,
                  padding: "0 20px",
                  background: saving
                    ? "#94a3b8"
                    : "#00695c",
                  color: "#ffffff",
                  border: "1px solid #004d40",
                  borderRadius: 9,
                  fontWeight: 700,
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                  opacity: 1,
                }}
              >
                {saving
                  ? "Saving..."
                  : saved
                    ? "Saved ✓"
                    : "Save Changes"}
              </button>
            </div>
          </div>

          {/* ERROR */}
          {error && (
            <div
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

          {/* SETTINGS NAVIGATION */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(6,minmax(145px,1fr))",
              gap: 10,
              marginBottom: 20,
              overflowX: "auto",
            }}
          >
            {sectionItems.map((item) => {
              const active =
                activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setActiveSection(item.id)
                  }
                  style={{
                    textAlign: "left",
                    border: active
                      ? "1px solid #00695c"
                      : "1px solid #dfe9e5",
                    background: active
                      ? "#eaf5f2"
                      : "#ffffff",
                    borderRadius: 12,
                    padding: "13px 14px",
                    cursor: "pointer",
                    minWidth: 145,
                  }}
                >
                  <div
                    style={{
                      fontSize: 18,
                      marginBottom: 5,
                    }}
                  >
                    {item.icon}
                  </div>

                  <strong
                    style={{
                      display: "block",
                      color: active
                        ? "#00695c"
                        : "#17322c",
                      fontSize: 13,
                    }}
                  >
                    {item.label}
                  </strong>

                  <span
                    style={{
                      display: "block",
                      marginTop: 3,
                      color: "#6b7f78",
                      fontSize: 10,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>

          {/* GENERAL */}
          {activeSection === "general" && (
            <div className="crm-grid crm-grid-2">

              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>Organization</h2>
                    <span>
                      Current CRM organization profile
                    </span>
                  </div>
                </div>

                <div
                  className="crm-card-body"
                  style={{
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div className="crm-stat-box">
                    <span>Organization</span>
                    <strong>
                      Clarke International University
                    </strong>
                  </div>

                  <div className="crm-stat-box">
                    <span>CRM</span>
                    <strong>
                      CIU Business CRM
                    </strong>
                  </div>

                  <div className="crm-stat-box">
                    <span>Currency</span>
                    <strong>
                      UGX — Ugandan Shilling
                    </strong>
                  </div>
                </div>
              </div>

              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>My Account</h2>
                    <span>
                      Current signed-in account
                    </span>
                  </div>
                </div>

                <div
                  className="crm-card-body"
                  style={{
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <div className="crm-stat-box">
                    <span>Email</span>
                    <strong>
                      {email || "Loading..."}
                    </strong>
                  </div>

                  <div className="crm-stat-box">
                    <span>Access Level</span>
                    <strong
                      style={{
                        textTransform: "capitalize",
                      }}
                    >
                      {role
                        ? role.replaceAll(
                            "_",
                            " ",
                          )
                        : "Loading..."}
                    </strong>
                  </div>

                  <div className="crm-stat-box">
                    <span>Account Status</span>
                    <strong
                      style={{
                        color: "#00695c",
                      }}
                    >
                      Active
                    </strong>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* BRANDING */}
          {activeSection === "branding" && (
            <div
              className="crm-card"
              style={{
                border: "1px solid #cfe5de",
              }}
            >
              <div className="crm-card-header">
                <div>
                  <h2>CRM Branding</h2>
                  <span>
                    Manage the logo displayed throughout
                    the CRM.
                  </span>
                </div>
              </div>

              <div className="crm-card-body">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      width: 260,
                      height: 130,
                      borderRadius: 14,
                      background: "#ffffff",
                      border: "1px solid #cfe5de",
                      display: "grid",
                      placeItems: "center",
                      padding: 12,
                      overflow: "hidden",
                    }}
                  >
                    {logo ? (
                      <img
                        key={logo}
                        src={logo}
                        alt="CRM logo preview"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "contain",
                        }}
                      />
                    ) : (
                      <strong
                        style={{
                          fontSize: 32,
                          color: "#00695c",
                        }}
                      >
                        CIU
                      </strong>
                    )}
                  </div>

                  <div>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoChange}
                    />

                    <div
                      style={{
                        fontSize: 11,
                        color: "#64748b",
                        marginTop: 8,
                      }}
                    >
                      {logoName ||
                        "PNG, JPG, WEBP or SVG · maximum 1 MB"}
                    </div>

                    {logo && (
                      <div
                        style={{
                          marginTop: 7,
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#00695c",
                        }}
                      >
                        Logo loaded ✓
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS & ROLES */}
          {activeSection === "users" && (
            <div className="crm-card">
              <div
                className="crm-card-header"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 15,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2>Users & Roles</h2>
                  <span>
                    Manage CRM accounts, access levels and
                    permissions.
                  </span>
                </div>

                <button
                  type="button"
                  className="crm-btn"
                  style={{
                    background: "#00695c",
                    color: "#ffffff",
                    border: "1px solid #004d40",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    alert(
                      "User creation will be connected to secure Supabase Auth next.",
                    )
                  }
                >
                  + Add User
                </button>
              </div>

              <div className="crm-card-body">
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    marginBottom: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#17322c",
                    }}
                  >
                    Available Roles
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(3,minmax(0,1fr))",
                      gap: 10,
                    }}
                  >
                    {ROLES.map((item) => (
                      <div
                        key={item.value}
                        className="crm-stat-box"
                      >
                        <strong
                          style={{
                            display: "block",
                            color: "#00695c",
                          }}
                        >
                          {item.label}
                        </strong>

                        <span
                          style={{
                            display: "block",
                            marginTop: 4,
                          }}
                        >
                          {item.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    borderTop:
                      "1px solid #dfe9e5",
                    paddingTop: 18,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <strong>
                      CRM Users
                    </strong>

                    <button
                      type="button"
                      onClick={loadProfiles}
                      style={{
                        border:
                          "1px solid #dfe9e5",
                        background: "#ffffff",
                        borderRadius: 7,
                        padding:
                          "7px 11px",
                        cursor: "pointer",
                        fontWeight: 700,
                      }}
                    >
                      Refresh
                    </button>
                  </div>

                  {profilesLoading ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign: "center",
                        color: "#6b7f78",
                      }}
                    >
                      Loading users...
                    </div>
                  ) : profiles.length === 0 ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign: "center",
                        color: "#6b7f78",
                      }}
                    >
                      No CRM users found.
                    </div>
                  ) : (
                    <div
                      style={{
                        overflowX: "auto",
                      }}
                    >
                      <table
                        className="ciu-report-table"
                        style={{
                          width: "100%",
                        }}
                      >
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>

                        <tbody>
                          {profiles.map(
                            (profile) => (
                              <tr
                                key={profile.id}
                              >
                                <td>
                                  <strong>
                                    {profile.full_name ||
                                      "Unnamed User"}
                                  </strong>
                                </td>

                                <td>
                                  {profile.email ||
                                    "—"}
                                </td>

                                <td>
                                  {profile.phone ||
                                    "—"}
                                </td>

                                <td
                                  style={{
                                    textTransform:
                                      "capitalize",
                                  }}
                                >
                                  {profile.role
                                    ? profile.role.replaceAll(
                                        "_",
                                        " ",
                                      )
                                    : "—"}
                                </td>

                                <td>
                                  <span
                                    style={{
                                      display:
                                        "inline-block",
                                      padding:
                                        "4px 8px",
                                      borderRadius:
                                        999,
                                      background:
                                        profile.is_active
                                          ? "#eaf5f2"
                                          : "#f1f5f9",
                                      color:
                                        profile.is_active
                                          ? "#00695c"
                                          : "#64748b",
                                      fontSize:
                                        11,
                                      fontWeight:
                                        800,
                                    }}
                                  >
                                    {profile.is_active
                                      ? "Active"
                                      : "Inactive"}
                                  </span>
                                </td>

                                <td>
                                  <button
                                    type="button"
                                    style={{
                                      border:
                                        "1px solid #cfe5de",
                                      background:
                                        "#ffffff",
                                      borderRadius:
                                        7,
                                      padding:
                                        "6px 10px",
                                      cursor:
                                        "pointer",
                                      fontWeight:
                                        700,
                                      color:
                                        "#00695c",
                                    }}
                                    onClick={() =>
                                      alert(
                                        "User editing will be connected next.",
                                      )
                                    }
                                  >
                                    Edit
                                  </button>
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STAFF */}
          {activeSection === "staff" && (
            <div className="crm-card">
              <div
                className="crm-card-header"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 15,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <h2>Staff Management</h2>
                  <span>
                    Manage staff records and CRM responsibilities.
                  </span>
                </div>

                <button
                  type="button"
                  className="crm-btn"
                  style={{
                    background: "#00695c",
                    color: "#ffffff",
                    border: "1px solid #004d40",
                    borderRadius: 8,
                    padding: "10px 16px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    alert(
                      "Staff creation will be connected to the user management system.",
                    )
                  }
                >
                  + Add Staff
                </button>
              </div>

              <div className="crm-card-body">
                {profilesLoading ? (
                  <div
                    style={{
                      padding: 20,
                      textAlign: "center",
                    }}
                  >
                    Loading staff...
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(3,minmax(0,1fr))",
                      gap: 14,
                    }}
                  >
                    {profiles.map((profile) => (
                      <div
                        key={profile.id}
                        className="crm-stat-box"
                        style={{
                          padding: 16,
                        }}
                      >
                        <strong
                          style={{
                            display: "block",
                            color: "#17322c",
                            fontSize: 14,
                          }}
                        >
                          {profile.full_name ||
                            "Unnamed Staff"}
                        </strong>

                        <span
                          style={{
                            display: "block",
                            marginTop: 5,
                          }}
                        >
                          {profile.email || "No email"}
                        </span>

                        <span
                          style={{
                            display: "block",
                            marginTop: 4,
                          }}
                        >
                          {profile.phone ||
                            "No phone"}
                        </span>

                        <div
                          style={{
                            marginTop: 12,
                            display: "flex",
                            justifyContent:
                              "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              textTransform:
                                "capitalize",
                              fontSize: 11,
                              fontWeight: 800,
                              color: "#00695c",
                            }}
                          >
                            {profile.role
                              ? profile.role.replaceAll(
                                  "_",
                                  " ",
                                )
                              : "No role"}
                          </span>

                          <span
                            style={{
                              fontSize: 10,
                              color:
                                profile.is_active
                                  ? "#00695c"
                                  : "#94a3b8",
                              fontWeight: 800,
                            }}
                          >
                            {profile.is_active
                              ? "ACTIVE"
                              : "INACTIVE"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeSection === "notifications" && (
            <div className="crm-card">
              <div className="crm-card-header">
                <div>
                  <h2>Notifications</h2>
                  <span>
                    Control CRM notification preferences.
                  </span>
                </div>
              </div>

              <div
                className="crm-card-body"
                style={{
                  display: "grid",
                  gap: 2,
                }}
              >
                {preferenceItems.map(
                  ([key, label, help]) => (
                    <label
                      key={key}
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        gap: 16,
                        padding: "16px 0",
                        borderBottom:
                          "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <strong>
                          {label}
                        </strong>

                        <div
                          style={{
                            fontSize: 11,
                            color: "#64748b",
                            marginTop: 4,
                          }}
                        >
                          {help}
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={
                          preferences[key]
                        }
                        onChange={() =>
                          togglePreference(
                            key,
                          )
                        }
                        style={{
                          width: 18,
                          height: 18,
                        }}
                      />
                    </label>
                  ),
                )}
              </div>
            </div>
          )}

          {/* SECURITY */}
          {activeSection === "security" && (
            <div className="crm-grid crm-grid-2">

              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>Access Control</h2>
                    <span>
                      CRM access is controlled through
                      authenticated accounts.
                    </span>
                  </div>
                </div>

                <div className="crm-card-body">
                  <div
                    className="crm-stat-box"
                    style={{
                      marginBottom: 12,
                    }}
                  >
                    <span>
                      Your current role
                    </span>

                    <strong
                      style={{
                        textTransform:
                          "capitalize",
                      }}
                    >
                      {role
                        ? role.replaceAll(
                            "_",
                            " ",
                          )
                        : "Loading..."}
                    </strong>
                  </div>

                  <div className="crm-stat-box">
                    <span>
                      Signed-in account
                    </span>

                    <strong>
                      {email ||
                        "Loading..."}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>Security Notice</h2>
                    <span>
                      Administrative controls
                    </span>
                  </div>
                </div>

                <div className="crm-card-body">
                  <p
                    style={{
                      margin: 0,
                      color: "#6b7f78",
                      lineHeight: 1.7,
                      fontSize: 13,
                    }}
                  >
                    User creation, role changes and
                    account activation will be handled
                    through secure Supabase authentication
                    controls. Sensitive service credentials
                    will never be exposed in the browser.
                  </p>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </>
  );
}