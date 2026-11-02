"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ALL_CRM_MODULES, MODULE_LABELS, getRoleModules, type CrmModule } from "@/lib/permissions";

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
  module_permissions: string[] | null;
};

type EditProfile = {
  id: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
  module_permissions: string[] | null;
};

type CrmBrandingPreferences = {
  organizationName?: string;
  crmName?: string;
  tagline?: string;
  navigationOrientation?: "vertical" | "horizontal";
  primaryColor?: string;
  secondaryColor?: string;
};

type AllPreferences = Preferences & CrmBrandingPreferences;

type CrmSettings = {
  logo_data_url: string | null;
  logo_name: string | null;
  preferences: Partial<AllPreferences> | null;
  updated_at?: string | null;
};

const DEFAULT_PREFERENCES: Preferences = {
  email: true,
  followups: true,
  reports: true,
  marketing: true,
};

const DEFAULT_BRANDING: CrmBrandingPreferences = {
  organizationName: "Clarke International University",
  crmName: "CIU Business CRM",
  tagline: "Lead · Innovate · Transform",
  navigationOrientation: "vertical",
  primaryColor: "#00695c",
  secondaryColor: "#8bc63f",
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

  const [branding, setBranding] =
    useState<CrmBrandingPreferences>(DEFAULT_BRANDING);

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

  const [newStaff, setNewStaff] = useState({
  full_name: "",
  email: "",
  phone: "",
  role: "salesperson",
  temporary_password: "",
});
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null);

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
          const centralBranding: CrmBrandingPreferences = {
            ...DEFAULT_BRANDING,
            ...(settings.preferences || {}),
          };

          setBranding(centralBranding);
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
              const parsedPreferences = JSON.parse(localPreferences);
              setPreferences({
                ...DEFAULT_PREFERENCES,
                ...parsedPreferences,
              });
              setBranding({
                ...DEFAULT_BRANDING,
                ...parsedPreferences,
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
          "id, full_name, phone, role, is_active, module_permissions",
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
            preferences: {
              ...preferences,
              ...branding,
            },
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
      const verifiedBranding: CrmBrandingPreferences = {
        ...DEFAULT_BRANDING,
        ...((verifiedSettings.preferences || {}) as Partial<CrmBrandingPreferences>),
      };

      setBranding(verifiedBranding);
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
          JSON.stringify({
            ...verifiedPreferences,
            ...verifiedBranding,
          }),
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
              crmName: verifiedBranding.crmName,
              organizationName: verifiedBranding.organizationName,
              tagline: verifiedBranding.tagline,
              navigationOrientation: verifiedBranding.navigationOrientation,
              primaryColor: verifiedBranding.primaryColor,
              secondaryColor: verifiedBranding.secondaryColor,
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
      module_permissions:
        profile.role === "super_admin" ? null : profile.module_permissions ?? null,
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
          module_permissions:
            editProfile.role === "super_admin" ? null : editProfile.module_permissions,
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

  async function createStaff(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSuperAdmin || creatingStaff) return;

    const full_name = newStaff.full_name.trim();
    const emailAddress = newStaff.email.trim().toLowerCase();
    if (!full_name || !emailAddress || !newStaff.role) {
      setError("Enter the staff member’s name, email and role.");
      return;
    }

    if (newStaff.temporary_password.length < 10) {
      setError("The temporary password must be at least 10 characters.");
      return;
    }

    try {
      setCreatingStaff(true);
      setError("");
      setSuccessMessage("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");

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
          temporary_password: newStaff.temporary_password,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to create staff account.");

      setNewStaff({
        full_name: "",
        email: "",
        phone: "",
        role: "salesperson",
        temporary_password: "",
      });
      await loadProfiles();
      setSuccessMessage(result.message || "Staff account created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create staff account.");
    } finally {
      setCreatingStaff(false);
    }
  }

  async function deleteStaff(profile: Profile) {
    if (!isSuperAdmin || deletingStaffId) return;
    if (profile.id === currentUserId) {
      setError("You cannot delete your own Super Admin account.");
      return;
    }
    if (profile.role === "super_admin") {
      setError("For safety, Super Admin accounts cannot be deleted from this screen.");
      return;
    }
    const confirmed = window.confirm(
      `Permanently delete ${profile.full_name || "this staff account"}? They will lose CRM access. Existing leads, customers and other CRM records will not be intentionally deleted. This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      setDeletingStaffId(profile.id);
      setError("");
      setSuccessMessage("");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Your session has expired. Please sign in again.");
      const response = await fetch(`/api/staff/${encodeURIComponent(profile.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to delete this staff account.");
      await loadProfiles();
      setSuccessMessage(result.message || "Staff account deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete this staff account.");
    } finally {
      setDeletingStaffId(null);
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

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
                <div style={{ padding: "8px 12px", borderRadius: 999, background: "#eaf5f2", color: "#00695c", fontSize: 11, fontWeight: 800, whiteSpace: "nowrap" }}>
                  Super Admin Access
                </div>
                <button type="button" onClick={saveChanges} disabled={saving} className="crm-btn" style={{ minHeight: 40, minWidth: 140, padding: "0 18px", background: saving ? "#94a3b8" : "#00695c", color: "#fff", border: "1px solid #004d40", borderRadius: 9, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
                </button>
              </div>
              {lastSavedAt && <span style={{ color: "#94a3b8", fontSize: 10 }}>Last saved: {new Date(lastSavedAt).toLocaleString()}</span>}
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
                  <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#17322c" }}>
                    Organization name
                    <input value={branding.organizationName || ""} onChange={(event) => { setBranding((current) => ({ ...current, organizationName: event.target.value })); setSaved(false); }} placeholder="Organization name" style={{ width: "100%", minHeight: 42, padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#17322c" }} />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#17322c" }}>
                    CRM name
                    <input value={branding.crmName || ""} onChange={(event) => { setBranding((current) => ({ ...current, crmName: event.target.value })); setSaved(false); }} placeholder="CRM name" style={{ width: "100%", minHeight: 42, padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#17322c" }} />
                  </label>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#17322c" }}>
                    Tagline
                    <input value={branding.tagline || ""} onChange={(event) => { setBranding((current) => ({ ...current, tagline: event.target.value })); setSaved(false); }} placeholder="CRM tagline" style={{ width: "100%", minHeight: 42, padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#17322c" }} />
                  </label>
                  <div className="crm-stat-box"><span>Currency</span><strong>UGX — Ugandan Shilling</strong></div>
                  <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#17322c" }}>
                    Navigation orientation
                    <select value={branding.navigationOrientation || "vertical"} onChange={(event) => { setBranding((current) => ({ ...current, navigationOrientation: event.target.value as "vertical" | "horizontal" })); setSaved(false); }} style={{ width: "100%", minHeight: 42, padding: "9px 12px", border: "1px solid #cbd5e1", borderRadius: 8, background: "#fff", color: "#17322c" }}>
                      <option value="vertical">Vertical sidebar</option>
                      <option value="horizontal">Horizontal navigation</option>
                    </select>
                  </label>
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
              <div className="crm-card-body" style={{ borderTop: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 12px", color: "#17322c", fontSize: 14 }}>Brand colors</h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
                  <label style={{ display: "grid", gap: 8, fontSize: 12, fontWeight: 700, color: "#17322c" }}>Primary color
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="color" value={branding.primaryColor || "#00695c"} onChange={(event) => { setBranding((current) => ({ ...current, primaryColor: event.target.value })); setSaved(false); }} style={{ width: 54, height: 40, border: 0, background: "transparent" }} /><input value={branding.primaryColor || "#00695c"} onChange={(event) => { setBranding((current) => ({ ...current, primaryColor: event.target.value })); setSaved(false); }} style={{ flex: 1, minHeight: 40, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8 }} /></div>
                  </label>
                  <label style={{ display: "grid", gap: 8, fontSize: 12, fontWeight: 700, color: "#17322c" }}>Secondary color
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="color" value={branding.secondaryColor || "#8bc63f"} onChange={(event) => { setBranding((current) => ({ ...current, secondaryColor: event.target.value })); setSaved(false); }} style={{ width: 54, height: 40, border: 0, background: "transparent" }} /><input value={branding.secondaryColor || "#8bc63f"} onChange={(event) => { setBranding((current) => ({ ...current, secondaryColor: event.target.value })); setSaved(false); }} style={{ flex: 1, minHeight: 40, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 8 }} /></div>
                  </label>
                </div>
                <p style={{ marginTop: 12, color: "#64748b", fontSize: 11 }}>These colors are saved centrally. The shared CRM layout must read them before they affect every module.</p>
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
                <form onSubmit={createStaff} style={{ display: "grid", gap: 12, padding: 16, marginBottom: 22, border: "1px solid #cfe5de", borderRadius: 12, background: "#f8fbf9" }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", color: "#17322c", fontSize: 15 }}>Add Staff Member</h3>
                    <p style={{ margin: 0, color: "#64748b", fontSize: 12 }}>Creates a staff account with a temporary password and sends an email verification code. Share the temporary password securely; the staff member must verify their email and change the password before using the CRM.</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#17322c" }}>Full name<input required value={newStaff.full_name} onChange={(event) => setNewStaff((current) => ({ ...current, full_name: event.target.value }))} placeholder="Staff full name" style={{ minHeight: 38, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7 }} /></label>
                    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#17322c" }}>Email address<input required type="email" value={newStaff.email} onChange={(event) => setNewStaff((current) => ({ ...current, email: event.target.value }))} placeholder="staff@ciu.ac.ug" style={{ minHeight: 38, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7 }} /></label>
                    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#17322c" }}>Phone (optional)<input value={newStaff.phone} onChange={(event) => setNewStaff((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number" style={{ minHeight: 38, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7 }} /></label>
                    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#17322c" }}>Temporary password<input required type="password" autoComplete="new-password" minLength={10} value={newStaff.temporary_password} onChange={(event) => setNewStaff((current) => ({ ...current, temporary_password: event.target.value }))} placeholder="At least 10 characters" style={{ minHeight: 38, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7 }} /><span style={{ color: "#64748b", fontSize: 11, fontWeight: 400 }}>Share this password securely with the staff member. Do not email it.</span></label>
                    <label style={{ display: "grid", gap: 6, fontSize: 12, fontWeight: 700, color: "#17322c" }}>CRM role<select value={newStaff.role} onChange={(event) => setNewStaff((current) => ({ ...current, role: event.target.value }))} style={{ minHeight: 38, padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 7, background: "#fff" }}>{ROLES.filter((item) => item.value !== "super_admin").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
                  </div>
                  <div><button type="submit" disabled={creatingStaff} style={{ border: 0, borderRadius: 8, padding: "10px 15px", background: creatingStaff ? "#94a3b8" : "#00695c", color: "#fff", fontWeight: 800, cursor: creatingStaff ? "wait" : "pointer" }}>{creatingStaff ? "Creating staff account..." : "Create Staff Account"}</button></div>
                </form>
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
                                  <button
                                    type="button"
                                    disabled={profile.id === currentUserId || profile.role === "super_admin" || deletingStaffId === profile.id}
                                    onClick={() => void deleteStaff(profile)}
                                    style={{ marginLeft: 6, border: "1px solid #fecaca", background: "#fff", borderRadius: 7, padding: "6px 10px", cursor: profile.id === currentUserId || profile.role === "super_admin" || deletingStaffId === profile.id ? "not-allowed" : "pointer", fontWeight: 700, color: "#b91c1c", opacity: profile.id === currentUserId || profile.role === "super_admin" ? 0.45 : 1 }}
                                  >
                                    {deletingStaffId === profile.id ? "Deleting..." : "Delete"}
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

              <div style={{ padding: 14, borderRadius: 9, border: "1px solid #dfe9e5", background: "#fff", display: "grid", gap: 12 }}>
                <div>
                  <strong style={{ display: "block", color: "#17322c", fontSize: 13 }}>Module Access</strong>
                  <span style={{ display: "block", marginTop: 4, color: "#64748b", fontSize: 11 }}>Choose which CRM sections this user can access.</span>
                </div>
                {editProfile.role === "super_admin" ? (
                  <div style={{ padding: 10, borderRadius: 8, background: "#eaf5f2", color: "#00695c", fontSize: 12, fontWeight: 700 }}>
                    Super Admin automatically has access to every module.
                  </div>
                ) : (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 12, fontWeight: 700, color: "#17322c" }}>
                      <input type="checkbox" checked={editProfile.module_permissions === null}
                        onChange={(event) => setEditProfile({ ...editProfile, module_permissions: event.target.checked ? null : getRoleModules(editProfile.role) })} />
                      Use role defaults
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 10 }}>
                      {ALL_CRM_MODULES.filter((module) => module !== "staff").map((module: CrmModule) => {
                        const selected = editProfile.module_permissions === null
                          ? getRoleModules(editProfile.role).includes(module)
                          : editProfile.module_permissions.includes(module);
                        return (
                          <label key={module} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", border: "1px solid #dfe9e5", borderRadius: 8, background: selected ? "#f0f8f5" : "#fff", color: "#17322c", fontSize: 12, cursor: "pointer" }}>
                            <input type="checkbox" checked={selected}
                              onChange={(event) => {
                                const current = editProfile.module_permissions === null ? getRoleModules(editProfile.role) : editProfile.module_permissions;
                                const next = event.target.checked ? [...current, module] : current.filter((item) => item !== module);
                                setEditProfile({ ...editProfile, module_permissions: [...new Set(next)] });
                              }} />
                            {MODULE_LABELS[module]}
                          </label>
                        );
                      })}
                    </div>
                    <span style={{ color: "#64748b", fontSize: 10 }}>Untick “Use role defaults” to customize access for this user.</span>
                  </>
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
      <style jsx global>{`
        .ciu-page {
          color: #17322c;
        }

        .ciu-page .ciu-hero {
          background: #ffffff !important;
          color: #17322c !important;
          border: 1px solid #dfe9e5 !important;
          border-left: 5px solid #00695c !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 14px rgba(23, 50, 44, 0.045) !important;
        }

        .ciu-page .ciu-hero h1,
        .ciu-page .ciu-hero p {
          color: #17322c !important;
        }

        .ciu-page .crm-card {
          background: #ffffff !important;
          border: 1px solid #dfe9e5 !important;
          border-left: 4px solid #00695c !important;
          border-radius: 12px !important;
          box-shadow: 0 4px 14px rgba(23, 50, 44, 0.045);
        }

        .ciu-page .crm-card-header {
          background: #ffffff;
          border-bottom: 1px solid #edf2f0;
        }

        .ciu-page .crm-stat-box {
          background: #ffffff;
          border: 1px solid #e2ebe7;
          border-left: 3px solid #78a99b;
          border-radius: 9px;
        }

        .ciu-page input:not([type="checkbox"]):not([type="file"]),
        .ciu-page select {
          color: #17322c;
          background-color: #ffffff;
          border-color: #d5e2dc !important;
          border-radius: 8px;
        }

        .ciu-page input:not([type="checkbox"]):not([type="file"]):focus,
        .ciu-page select:focus {
          outline: 2px solid rgba(0, 105, 92, 0.14);
          border-color: #00695c !important;
        }

        .ciu-page .ciu-report-table thead th {
          background: #f5f8f7;
          color: #35574f;
        }

        .ciu-page .ciu-report-table tbody tr:hover {
          background: #f8fbf9;
        }

        @media (max-width: 900px) {
          .ciu-page-inner > div[style*="repeat(5"] {
            grid-template-columns: repeat(2, minmax(145px, 1fr)) !important;
          }
        }

        @media (max-width: 560px) {
          .ciu-page .ciu-hero {
            padding: 18px !important;
          }

          .ciu-page .crm-card-body {
            padding: 16px !important;
          }
        }
      `}</style>
    </>
  );
}