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
  phone: string | null;
  role: string | null;
  is_active: boolean | null;
};

type EditProfile = {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
};

type CrmSettings = {
  logo_data_url: string | null;
  logo_name: string | null;
  preferences: Partial<Preferences> | null;
  updated_at?: string | null;
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
    description:
      "Full system access, administration and security control.",
  },
  {
    value: "admin",
    label: "Admin",
    description:
      "Manage CRM operations and organization-wide records.",
  },
  {
    value: "manager",
    label: "Manager",
    description:
      "Manage teams, leads, tasks and performance.",
  },
  {
    value: "salesperson",
    label: "Salesperson",
    description:
      "Manage assigned leads, opportunities and follow-ups.",
  },
  {
    value: "marketing",
    label: "Marketing",
    description:
      "Manage campaigns and marketing activities.",
  },
  {
    value: "finance",
    label: "Finance",
    description:
      "Manage financial and payment information.",
  },
  {
    value: "viewer",
    label: "Viewer",
    description:
      "View CRM information without management access.",
  },
];

function roleLabel(value: string | null | undefined) {
  const found = ROLES.find((item) => item.value === value);

  if (found) return found.label;

  return value
    ? value
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "No role";
}

export default function Settings() {
  const supabase = createClient();

  const [activeSection, setActiveSection] =
    useState("general");

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [currentUserId, setCurrentUserId] =
    useState("");

  const [logo, setLogo] = useState("");
  const [logoName, setLogoName] = useState("");

  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);

  const [profiles, setProfiles] =
    useState<Profile[]>([]);

  const [profilesLoading, setProfilesLoading] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [editProfile, setEditProfile] =
    useState<EditProfile | null>(null);

  const [editSaving, setEditSaving] =
    useState(false);

  const [profileSearch, setProfileSearch] =
    useState("");

  const [lastSavedAt, setLastSavedAt] =
    useState<string | null>(null);

  const isSuperAdmin =
    role === "super_admin";

  useEffect(() => {
    let mounted = true;

    async function loadSettings() {
      try {
        setLoading(true);
        setError("");
        setSuccessMessage("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error(
            "You are not signed in.",
          );
        }

        if (!mounted) return;

        setCurrentUserId(user.id);
        setEmail(user.email || "");

        const [
          profileResult,
          settingsResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle(),

          supabase
            .from("crm_settings")
            .select(
              "logo_data_url, logo_name, preferences, updated_at",
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

        const currentRole =
          profileResult.data?.role || "";

        setRole(currentRole);

        if (settingsResult.data) {
          const settings =
            settingsResult.data as CrmSettings;

          const centralLogo =
            settings.logo_data_url || "";

          const centralLogoName =
            settings.logo_name || "";

          const centralPreferences: Preferences = {
            ...DEFAULT_PREFERENCES,
            ...(settings.preferences || {}),
          };

          setLogo(centralLogo);
          setLogoName(centralLogoName);
          setPreferences(
            centralPreferences,
          );

          setLastSavedAt(
            settings.updated_at || null,
          );

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
              JSON.stringify(
                centralPreferences,
              ),
            );
          } catch {}
        } else {
          try {
            const localLogo =
              localStorage.getItem(
                LOGO_STORAGE_KEY,
              ) || "";

            const localLogoName =
              localStorage.getItem(
                LOGO_NAME_KEY,
              ) || "";

            const localPreferences =
              localStorage.getItem(
                PREFERENCES_KEY,
              );

            setLogo(localLogo);
            setLogoName(localLogoName);

            if (localPreferences) {
              setPreferences({
                ...DEFAULT_PREFERENCES,
                ...JSON.parse(
                  localPreferences,
                ),
              });
            }
          } catch {}
        }

        if (currentRole !== "super_admin") {
          setActiveSection("general");
        }
      } catch (err) {
        console.error(
          "Settings loading error:",
          err,
        );

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
    if (!isSuperAdmin) return;

    try {
      setProfilesLoading(true);
      setError("");
      setSuccessMessage("");

      const {
        data,
        error: profilesError,
      } = await supabase
        .from("profiles")
        .select(
          "id, full_name, phone, role, is_active",
        )
        .order("full_name", {
          ascending: true,
        });

      if (profilesError) {
        throw profilesError;
      }

      setProfiles(
        (data || []) as Profile[],
      );
    } catch (err) {
      console.error(
        "Profiles loading error:",
        err,
      );

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
      isSuperAdmin &&
      activeSection === "users"
    ) {
      loadProfiles();
    }
  }, [
    activeSection,
    isSuperAdmin,
  ]);

  function handleLogoChange(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    if (!isSuperAdmin) return;

    const file =
      event.target.files?.[0];

    if (!file) return;

    setError("");
    setSuccessMessage("");
    setSaved(false);

    if (file.size > 1024 * 1024) {
      setError(
        "Please choose a logo smaller than 1 MB.",
      );

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

    const reader =
      new FileReader();

    reader.onload = () => {
      const result =
        reader.result;

      if (
        typeof result !== "string" ||
        !result
      ) {
        setError(
          "Unable to read the selected logo.",
        );
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
      setError(
        "Unable to read the selected logo.",
      );
    };

    reader.readAsDataURL(file);
  }

  function togglePreference(
    key: keyof Preferences,
  ) {
    if (!isSuperAdmin) return;

    setPreferences((current) => ({
      ...current,
      [key]: !current[key],
    }));

    setSaved(false);
    setSuccessMessage("");
  }

  async function saveChanges() {
    if (
      saving ||
      !isSuperAdmin
    ) {
      return;
    }

    try {
      setSaving(true);
      setSaved(false);
      setError("");
      setSuccessMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error(
          "You are not signed in.",
        );
      }

      const {
        error: saveError,
      } = await supabase
        .from("crm_settings")
        .upsert(
          {
            id: 1,
            logo_data_url:
              logo || null,
            logo_name:
              logoName || null,
            preferences,
            updated_by: user.id,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict: "id",
          },
        );

      if (saveError) {
        throw saveError;
      }

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
        verifiedSettings.logo_data_url ||
        "";

      const verifiedLogoName =
        verifiedSettings.logo_name ||
        "";

      const verifiedPreferences: Preferences =
        {
          ...DEFAULT_PREFERENCES,
          ...((verifiedSettings.preferences ||
            {}) as Partial<Preferences>),
        };

      setLogo(verifiedLogo);
      setLogoName(
        verifiedLogoName,
      );

      setPreferences(
        verifiedPreferences,
      );

      setLastSavedAt(
        verifiedSettings.updated_at ||
          null,
      );

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
          JSON.stringify(
            verifiedPreferences,
          ),
        );
      } catch {}

      window.dispatchEvent(
        new CustomEvent(
          "ciu-crm-logo-updated",
          {
            detail: {
              logo: verifiedLogo,
              logoName:
                verifiedLogoName,
            },
          },
        ),
      );

      setSaved(true);

      setSuccessMessage(
        "CRM settings saved successfully.",
      );
    } catch (err) {
      console.error(
        "Settings save error:",
        err,
      );

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

  function openEditProfile(
    profile: Profile,
  ) {
    if (!isSuperAdmin) return;

    setError("");
    setSuccessMessage("");

    setEditProfile({
      id: profile.id,
      full_name:
        profile.full_name || "",
      phone:
        profile.phone || "",
      role:
        profile.role ||
        "salesperson",
      is_active:
        profile.is_active !== false,
    });
  }

  function closeEditProfile() {
    if (editSaving) return;

    setEditProfile(null);
  }

  async function saveProfile() {
    if (
      !editProfile ||
      editSaving ||
      !isSuperAdmin
    ) {
      return;
    }

    if (
      !editProfile.full_name.trim()
    ) {
      setError(
        "Staff name is required.",
      );
      return;
    }

    if (!editProfile.role) {
      setError(
        "Please select a role.",
      );
      return;
    }

    if (
      editProfile.id ===
        currentUserId &&
      (
        !editProfile.is_active ||
        editProfile.role !==
          "super_admin"
      )
    ) {
      setError(
        "You cannot deactivate yourself or remove your own Super Admin role.",
      );
      return;
    }

    try {
      setEditSaving(true);
      setError("");
      setSuccessMessage("");

      const {
        error: updateError,
      } = await supabase
        .from("profiles")
        .update({
          full_name:
            editProfile.full_name.trim(),
          phone:
            editProfile.phone.trim() ||
            null,
          role:
            editProfile.role,
          is_active:
            editProfile.is_active,
        })
        .eq(
          "id",
          editProfile.id,
        );

      if (updateError) {
        throw updateError;
      }

      await loadProfiles();

      setEditProfile(null);

      setSuccessMessage(
        "User profile updated successfully.",
      );
    } catch (err) {
      console.error(
        "Profile update error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update this user.",
      );
    } finally {
      setEditSaving(false);
    }
  }

  const filteredProfiles =
    profiles.filter(
      (profile) => {
        const search =
          profileSearch
            .trim()
            .toLowerCase();

        if (!search) return true;

        return [
          profile.full_name || "",
          profile.phone || "",
          profile.role || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      },
    );

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
      icon: "G",
      description:
        "CRM and organization information",
    },
    {
      id: "branding",
      label: "Branding",
      icon: "B",
      description:
        "Logo and visual identity",
    },
    {
      id: "users",
      label: "Users & Staff",
      icon: "U",
      description:
        "Users, staff, roles and access",
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: "N",
      description:
        "CRM alerts and preferences",
    },
    {
      id: "security",
      label: "Security",
      icon: "X",
      description:
        "Access and security controls",
    },
  ];

  if (loading) {
    return (
      <div className="ciu-page">
        <div
          className="ciu-page-inner"
          style={{
            minHeight: "60vh",
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            className="crm-card"
            style={{
              width: "100%",
              maxWidth: 520,
              textAlign: "center",
            }}
          >
            <div className="crm-card-body">
              <strong
                style={{
                  display: "block",
                  color: "#17322c",
                  fontSize: 16,
                }}
              >
                Loading Settings
              </strong>

              <span
                style={{
                  display: "block",
                  marginTop: 6,
                  color: "#6b7f78",
                  fontSize: 13,
                }}
              >
                Checking your CRM access...
              </span>
            </div>
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
              marginTop: 30,
              padding: 18,
              borderRadius: 12,
              background: "#fef2f2",
              color: "#b91c1c",
              border:
                "1px solid #fecaca",
            }}
          >
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="ciu-page">
        <div className="ciu-page-inner">
          <div
            className="crm-card"
            style={{
              maxWidth: 720,
              margin: "40px auto",
              border:
                "1px solid #fecaca",
            }}
          >
            <div
              className="crm-card-body"
              style={{
                padding: 30,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: "50%",
                  background: "#fef2f2",
                  color: "#b91c1c",
                  display: "grid",
                  placeItems: "center",
                  margin:
                    "0 auto 16px",
                  fontSize: 22,
                  fontWeight: 900,
                }}
              >
                !
              </div>

              <h2
                style={{
                  margin: "0 0 8px",
                  color: "#17322c",
                }}
              >
                Access Restricted
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "#6b7f78",
                  lineHeight: 1.7,
                  fontSize: 13,
                }}
              >
                Settings and system
                administration are
                restricted to active
                Super Admin accounts.
              </p>

              <div
                style={{
                  marginTop: 18,
                  padding: 12,
                  borderRadius: 9,
                  background: "#f5f8f7",
                  color: "#17322c",
                  fontSize: 12,
                }}
              >
                Your current access
                level:{" "}
                <strong>
                  {roleLabel(role)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="ciu-page">
        <div className="ciu-page-inner">
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
                  textTransform:
                    "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                Super Admin
              </div>

              <h1>Settings</h1>

              <p>
                Manage CRM configuration,
                branding, users, staff,
                roles and system
                preferences.
              </p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding:
                  "8px 12px",
                borderRadius: 999,
                background:
                  "#eaf5f2",
                color: "#00695c",
                fontSize: 11,
                fontWeight: 800,
                whiteSpace:
                  "nowrap",
              }}
            >
              Super Admin Access
            </div>
          </div>

          {successMessage && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                background:
                  "#eaf5f2",
                color: "#00695c",
                border:
                  "1px solid #cfe5de",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {successMessage}
            </div>
          )}

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                background:
                  "#fef2f2",
                color: "#b91c1c",
                border:
                  "1px solid #fecaca",
              }}
            >
              {error}
            </div>
          )}

          <div
            className="crm-card"
            style={{
              marginBottom: 18,
              border:
                "1px solid #cfe5de",
            }}
          >
            <div
              className="crm-card-body"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                gap: 16,
                flexWrap: "wrap",
                padding:
                  "15px 20px",
                background:
                  "#f7fbf9",
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
                  Save branding and
                  CRM preferences
                  centrally.
                </span>

                {lastSavedAt && (
                  <span
                    style={{
                      display: "block",
                      fontSize: 10,
                      color: "#94a3b8",
                      marginTop: 3,
                    }}
                  >
                    Last saved:{" "}
                    {new Date(
                      lastSavedAt,
                    ).toLocaleString()}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={saveChanges}
                disabled={saving}
                className="crm-btn"
                style={{
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  minHeight: 42,
                  minWidth: 150,
                  padding:
                    "0 20px",
                  background: saving
                    ? "#94a3b8"
                    : "#00695c",
                  color: "#ffffff",
                  border:
                    "1px solid #004d40",
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
                    ? "Saved"
                    : "Save Changes"}
              </button>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(5,minmax(145px,1fr))",
              gap: 10,
              marginBottom: 20,
              overflowX: "auto",
            }}
          >
            {sectionItems.map(
              (item) => {
                const active =
                  activeSection ===
                  item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setActiveSection(
                        item.id,
                      )
                    }
                    style={{
                      textAlign:
                        "left",
                      border: active
                        ? "1px solid #00695c"
                        : "1px solid #dfe9e5",
                      background: active
                        ? "#eaf5f2"
                        : "#ffffff",
                      borderRadius: 12,
                      padding:
                        "13px 14px",
                      cursor:
                        "pointer",
                      minWidth: 145,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        display:
                          "grid",
                        placeItems:
                          "center",
                        marginBottom: 7,
                        background:
                          active
                            ? "#00695c"
                            : "#eef7df",
                        color: active
                          ? "#ffffff"
                          : "#00695c",
                        fontSize: 12,
                        fontWeight: 900,
                      }}
                    >
                      {item.icon}
                    </div>

                    <strong
                      style={{
                        display:
                          "block",
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
                        display:
                          "block",
                        marginTop: 3,
                        color:
                          "#6b7f78",
                        fontSize: 10,
                        lineHeight: 1.4,
                      }}
                    >
                      {item.description}
                    </span>
                  </button>
                );
              },
            )}
          </div>

          {activeSection ===
            "general" && (
            <div className="crm-grid crm-grid-2">
              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>
                      Organization
                    </h2>

                    <span>
                      Current CRM
                      organization
                      profile
                    </span>
                  </div>
                </div>

                <div
                  className="crm-card-body"
                  style={{
                    display:
                      "grid",
                    gap: 14,
                  }}
                >
                  <div className="crm-stat-box">
                    <span>
                      Organization
                    </span>

                    <strong>
                      Clarke
                      International
                      University
                    </strong>
                  </div>

                  <div className="crm-stat-box">
                    <span>
                      CRM
                    </span>

                    <strong>
                      CIU Business
                      CRM
                    </strong>
                  </div>

                  <div className="crm-stat-box">
                    <span>
                      Currency
                    </span>

                    <strong>
                      UGX — Ugandan
                      Shilling
                    </strong>
                  </div>
                </div>
              </div>

              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>
                      My Account
                    </h2>

                    <span>
                      Current signed-in
                      account
                    </span>
                  </div>
                </div>

                <div
                  className="crm-card-body"
                  style={{
                    display:
                      "grid",
                    gap: 14,
                  }}
                >
                  <div className="crm-stat-box">
                    <span>
                      Email
                    </span>

                    <strong>
                      {email ||
                        "Loading..."}
                    </strong>
                  </div>

                  <div className="crm-stat-box">
                    <span>
                      Access Level
                    </span>

                    <strong>
                      {roleLabel(
                        role,
                      )}
                    </strong>
                  </div>

                  <div className="crm-stat-box">
                    <span>
                      Account Status
                    </span>

                    <strong
                      style={{
                        color:
                          "#00695c",
                      }}
                    >
                      Active
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection ===
            "branding" && (
            <div
              className="crm-card"
              style={{
                border:
                  "1px solid #cfe5de",
              }}
            >
              <div className="crm-card-header">
                <div>
                  <h2>
                    CRM Branding
                  </h2>

                  <span>
                    Manage the logo
                    displayed
                    throughout the
                    CRM.
                  </span>
                </div>
              </div>

              <div className="crm-card-body">
                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 24,
                    flexWrap:
                      "wrap",
                  }}
                >
                  <div
                    style={{
                      width: 260,
                      height: 130,
                      borderRadius: 14,
                      background:
                        "#ffffff",
                      border:
                        "1px solid #cfe5de",
                      display:
                        "grid",
                      placeItems:
                        "center",
                      padding: 12,
                      overflow:
                        "hidden",
                    }}
                  >
                    {logo ? (
                      <img
                        key={logo}
                        src={logo}
                        alt="CRM logo preview"
                        style={{
                          width:
                            "100%",
                          height:
                            "100%",
                          objectFit:
                            "contain",
                        }}
                      />
                    ) : (
                      <strong
                        style={{
                          fontSize: 32,
                          color:
                            "#00695c",
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
                      onChange={
                        handleLogoChange
                      }
                    />

                    <div
                      style={{
                        fontSize: 11,
                        color:
                          "#64748b",
                        marginTop: 8,
                      }}
                    >
                      {logoName ||
                        "PNG, JPG, WEBP or SVG — maximum 1 MB"}
                    </div>

                    {logo && (
                      <div
                        style={{
                          marginTop: 7,
                          fontSize: 12,
                          fontWeight: 700,
                          color:
                            "#00695c",
                        }}
                      >
                        Logo loaded
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection ===
            "users" && (
            <div className="crm-card">
              <div
                className="crm-card-header"
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "space-between",
                  gap: 15,
                  alignItems:
                    "center",
                  flexWrap:
                    "wrap",
                }}
              >
                <div>
                  <h2>
                    Users & Staff
                  </h2>

                  <span>
                    Manage CRM users,
                    staff, roles,
                    account status and
                    access levels.
                  </span>
                </div>

                <div
                  style={{
                    padding:
                      "9px 12px",
                    borderRadius: 8,
                    background:
                      "#f5f8f7",
                    border:
                      "1px solid #dfe9e5",
                    color:
                      "#6b7f78",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  Super Admin only
                </div>
              </div>

              <div className="crm-card-body">
                <div
                  style={{
                    display:
                      "grid",
                    gap: 10,
                    marginBottom:
                      20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color:
                        "#17322c",
                    }}
                  >
                    Available Roles
                  </div>

                  <div
                    style={{
                      display:
                        "grid",
                      gridTemplateColumns:
                        "repeat(3,minmax(0,1fr))",
                      gap: 10,
                    }}
                  >
                    {ROLES.map(
                      (item) => (
                        <div
                          key={
                            item.value
                          }
                          className="crm-stat-box"
                        >
                          <strong
                            style={{
                              display:
                                "block",
                              color:
                                "#00695c",
                            }}
                          >
                            {
                              item.label
                            }
                          </strong>

                          <span
                            style={{
                              display:
                                "block",
                              marginTop: 4,
                            }}
                          >
                            {
                              item.description
                            }
                          </span>
                        </div>
                      ),
                    )}
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
                      display:
                        "flex",
                      justifyContent:
                        "space-between",
                      alignItems:
                        "center",
                      gap: 12,
                      marginBottom:
                        12,
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <strong>
                        Users & Staff
                      </strong>

                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 11,
                          color:
                            "#64748b",
                        }}
                      >
                        All CRM
                        accounts and
                        staff profiles
                        are managed
                        from this
                        section.
                      </div>
                    </div>

                    <div
                      style={{
                        display:
                          "flex",
                        gap: 8,
                        alignItems:
                          "center",
                      }}
                    >
                      <input
                        type="text"
                        value={
                          profileSearch
                        }
                        onChange={(
                          event,
                        ) =>
                          setProfileSearch(
                            event
                              .target
                              .value,
                          )
                        }
                        placeholder="Search users or staff..."
                        style={{
                          border:
                            "1px solid #dfe9e5",
                          borderRadius: 7,
                          padding:
                            "8px 10px",
                          minWidth:
                            240,
                          outline:
                            "none",
                        }}
                      />

                      <button
                        type="button"
                        onClick={
                          loadProfiles
                        }
                        style={{
                          border:
                            "1px solid #dfe9e5",
                          background:
                            "#ffffff",
                          borderRadius: 7,
                          padding:
                            "8px 11px",
                          cursor:
                            "pointer",
                          fontWeight:
                            700,
                        }}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>

                  {profilesLoading ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign:
                          "center",
                        color:
                          "#6b7f78",
                      }}
                    >
                      Loading users
                      and staff...
                    </div>
                  ) : filteredProfiles.length ===
                    0 ? (
                    <div
                      style={{
                        padding: 20,
                        textAlign:
                          "center",
                        color:
                          "#6b7f78",
                      }}
                    >
                      No users or staff
                      records found.
                    </div>
                  ) : (
                    <div
                      style={{
                        overflowX:
                          "auto",
                      }}
                    >
                      <table
                        className="ciu-report-table"
                        style={{
                          width:
                            "100%",
                        }}
                      >
                        <thead>
                          <tr>
                            <th>
                              Name
                            </th>

                            <th>
                              Phone
                            </th>

                            <th>
                              Role
                            </th>

                            <th>
                              Status
                            </th>

                            <th>
                              Action
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredProfiles.map(
                            (
                              profile,
                            ) => (
                              <tr
                                key={
                                  profile.id
                                }
                              >
                                <td>
                                  <strong>
                                    {profile.full_name ||
                                      "Unnamed User"}
                                  </strong>

                                  {profile.id ===
                                    currentUserId && (
                                    <span
                                      style={{
                                        marginLeft: 7,
                                        padding:
                                          "3px 6px",
                                        borderRadius:
                                          999,
                                        background:
                                          "#eef7df",
                                        color:
                                          "#00695c",
                                        fontSize:
                                          9,
                                        fontWeight:
                                          800,
                                      }}
                                    >
                                      YOU
                                    </span>
                                  )}
                                </td>

                                <td>
                                  {profile.phone ||
                                    "—"}
                                </td>

                                <td>
                                  {roleLabel(
                                    profile.role,
                                  )}
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
                                      openEditProfile(
                                        profile,
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

          {activeSection ===
            "notifications" && (
            <div className="crm-card">
              <div className="crm-card-header">
                <div>
                  <h2>
                    Notifications
                  </h2>

                  <span>
                    Control CRM
                    notification
                    preferences.
                  </span>
                </div>
              </div>

              <div
                className="crm-card-body"
                style={{
                  display:
                    "grid",
                  gap: 2,
                }}
              >
                {preferenceItems.map(
                  ([
                    key,
                    label,
                    help,
                  ]) => (
                    <label
                      key={key}
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        gap: 16,
                        padding:
                          "16px 0",
                        borderBottom:
                          "1px solid var(--border)",
                        cursor:
                          "pointer",
                      }}
                    >
                      <div>
                        <strong>
                          {label}
                        </strong>

                        <div
                          style={{
                            fontSize: 11,
                            color:
                              "#64748b",
                            marginTop: 4,
                          }}
                        >
                          {help}
                        </div>
                      </div>

                      <input
                        type="checkbox"
                        checked={
                          preferences[
                            key
                          ]
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

          {activeSection ===
            "security" && (
            <div className="crm-grid crm-grid-2">
              <div className="crm-card">
                <div className="crm-card-header">
                  <div>
                    <h2>
                      Access Control
                    </h2>

                    <span>
                      CRM access is
                      controlled through
                      authenticated
                      accounts.
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
                      Your current
                      role
                    </span>

                    <strong>
                      {roleLabel(
                        role,
                      )}
                    </strong>
                  </div>

                  <div className="crm-stat-box">
                    <span>
                      Signed-in
                      account
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
                    <h2>
                      Security Model
                    </h2>

                    <span>
                      Administrative
                      controls
                    </span>
                  </div>
                </div>

                <div className="crm-card-body">
                  <div
                    style={{
                      display:
                        "grid",
                      gap: 10,
                    }}
                  >
                    <div className="crm-stat-box">
                      <span>
                        Settings
                        management
                      </span>

                      <strong>
                        Super Admin
                        only
                      </strong>
                    </div>

                    <div className="crm-stat-box">
                      <span>
                        User role
                        changes
                      </span>

                      <strong>
                        Super Admin
                        only
                      </strong>
                    </div>

                    <div className="crm-stat-box">
                      <span>
                        Account
                        activation
                      </span>

                      <strong>
                        Super Admin
                        only
                      </strong>
                    </div>

                    <p
                      style={{
                        margin:
                          "4px 0 0",
                        color:
                          "#6b7f78",
                        lineHeight:
                          1.7,
                        fontSize: 12,
                      }}
                    >
                      Sensitive service
                      credentials are
                      never exposed in
                      the browser.
                      Database-level
                      policies provide
                      the final
                      authorization
                      layer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {editProfile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit user"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background:
              "rgba(15, 23, 42, .48)",
            display: "grid",
            placeItems: "center",
            padding: 20,
          }}
          onMouseDown={(
            event,
          ) => {
            if (
              event.target ===
                event.currentTarget &&
              !editSaving
            ) {
              closeEditProfile();
            }
          }}
        >
          <div
            className="crm-card"
            style={{
              width: "100%",
              maxWidth: 560,
              maxHeight: "90vh",
              overflowY:
                "auto",
              boxShadow:
                "0 25px 70px rgba(15,23,42,.20)",
            }}
          >
            <div
              className="crm-card-header"
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: 15,
              }}
            >
              <div>
                <h2>
                  Edit User / Staff
                </h2>

                <span>
                  Update profile
                  information and CRM
                  access.
                </span>
              </div>

              <button
                type="button"
                onClick={
                  closeEditProfile
                }
                disabled={
                  editSaving
                }
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  border:
                    "1px solid #dfe9e5",
                  background:
                    "#ffffff",
                  cursor:
                    editSaving
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: 800,
                  color:
                    "#64748b",
                }}
              >
                X
              </button>
            </div>

            <div
              className="crm-card-body"
              style={{
                display:
                  "grid",
                gap: 16,
              }}
            >
              <div>
                <label
                  style={{
                    display:
                      "block",
                    marginBottom: 6,
                    fontSize: 12,
                    fontWeight: 800,
                    color:
                      "#17322c",
                  }}
                >
                  Full Name
                </label>

                <input
                  type="text"
                  value={
                    editProfile.full_name
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditProfile(
                      {
                        ...editProfile,
                        full_name:
                          event
                            .target
                            .value,
                      },
                    )
                  }
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #dfe9e5",
                    borderRadius: 8,
                    padding:
                      "10px 12px",
                    outline:
                      "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display:
                      "block",
                    marginBottom: 6,
                    fontSize: 12,
                    fontWeight: 800,
                    color:
                      "#17322c",
                  }}
                >
                  Phone
                </label>

                <input
                  type="text"
                  value={
                    editProfile.phone
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditProfile(
                      {
                        ...editProfile,
                        phone:
                          event
                            .target
                            .value,
                      },
                    )
                  }
                  placeholder="+256..."
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #dfe9e5",
                    borderRadius: 8,
                    padding:
                      "10px 12px",
                    outline:
                      "none",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display:
                      "block",
                    marginBottom: 6,
                    fontSize: 12,
                    fontWeight: 800,
                    color:
                      "#17322c",
                  }}
                >
                  CRM Role
                </label>

                <select
                  value={
                    editProfile.role
                  }
                  onChange={(
                    event,
                  ) =>
                    setEditProfile(
                      {
                        ...editProfile,
                        role:
                          event
                            .target
                            .value,
                      },
                    )
                  }
                  disabled={
                    editProfile.id ===
                    currentUserId
                  }
                  style={{
                    width:
                      "100%",
                    boxSizing:
                      "border-box",
                    border:
                      "1px solid #dfe9e5",
                    borderRadius: 8,
                    padding:
                      "10px 12px",
                    background:
                      editProfile.id ===
                      currentUserId
                        ? "#f5f8f7"
                        : "#ffffff",
                    outline:
                      "none",
                  }}
                >
                  {ROLES.map(
                    (item) => (
                      <option
                        key={
                          item.value
                        }
                        value={
                          item.value
                        }
                      >
                        {item.label}
                      </option>
                    ),
                  )}
                </select>

                {editProfile.id ===
                  currentUserId && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      color:
                        "#64748b",
                    }}
                  >
                    Your own Super
                    Admin role cannot
                    be changed from
                    this screen.
                  </div>
                )}
              </div>

              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: 16,
                  padding: 14,
                  borderRadius: 9,
                  background:
                    "#f7fbf9",
                  border:
                    "1px solid #dfe9e5",
                }}
              >
                <div>
                  <strong
                    style={{
                      display:
                        "block",
                      fontSize: 13,
                      color:
                        "#17322c",
                    }}
                  >
                    Account Status
                  </strong>

                  <span
                    style={{
                      display:
                        "block",
                      marginTop: 4,
                      fontSize: 11,
                      color:
                        "#64748b",
                    }}
                  >
                    Inactive users
                    should not be
                    given CRM access.
                  </span>
                </div>

                <label
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    gap: 8,
                    cursor:
                      editProfile.id ===
                      currentUserId
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      editProfile.is_active
                    }
                    disabled={
                      editProfile.id ===
                      currentUserId
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditProfile(
                        {
                          ...editProfile,
                          is_active:
                            event
                              .target
                              .checked,
                        },
                      )
                    }
                    style={{
                      width: 18,
                      height: 18,
                    }}
                  />

                  <strong
                    style={{
                      fontSize: 12,
                      color:
                        editProfile.is_active
                          ? "#00695c"
                          : "#64748b",
                    }}
                  >
                    {editProfile.is_active
                      ? "Active"
                      : "Inactive"}
                  </strong>
                </label>
              </div>

              <div
                style={{
                  display:
                    "flex",
                  justifyContent:
                    "flex-end",
                  gap: 10,
                  paddingTop: 4,
                }}
              >
                <button
                  type="button"
                  onClick={
                    closeEditProfile
                  }
                  disabled={
                    editSaving
                  }
                  style={{
                    border:
                      "1px solid #dfe9e5",
                    background:
                      "#ffffff",
                    color:
                      "#17322c",
                    borderRadius: 8,
                    padding:
                      "10px 16px",
                    fontWeight: 700,
                    cursor:
                      editSaving
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={
                    saveProfile
                  }
                  disabled={
                    editSaving
                  }
                  style={{
                    border:
                      "1px solid #004d40",
                    background:
                      editSaving
                        ? "#94a3b8"
                        : "#00695c",
                    color:
                      "#ffffff",
                    borderRadius: 8,
                    padding:
                      "10px 18px",
                    fontWeight: 700,
                    cursor:
                      editSaving
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {editSaving
                    ? "Saving..."
                    : "Save User"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}