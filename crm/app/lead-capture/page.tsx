"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const sources = [
  "Facebook",
  "TikTok",
  "Website",
  "WhatsApp",
  "Instagram",
  "Google",
  "Referral",
  "Other",
];

const schools = [
  "School of Business and Applied Computer Technologies",
  "School of Nursing and Midwifery",
  "School of Public Health",
  "Institute of Allied Health Sciences",
];

const studyLevels = [
  "Certificate",
  "Diploma",
  "Bachelor's",
  "Postgraduate Diploma",
  "Master's",
  "PhD",
  "Other",
];

const intakes = [
  "February",
  "April",
  "August",
  "November",
];

const previousEducationLevels = [
  "S4 / O-Level",
  "S6 / A-Level",
  "Certificate",
  "Diploma",
  "Bachelor's Degree",
  "Master's Degree",
  "Other",
];

/*
 * CENTRAL PROGRAMME LIST
 *
 * We will update this section with the official current CIU
 * programme list once it is provided.
 *
 * The structure is:
 * School -> Study Level -> Programmes
 */
const programmes: Record<
  string,
  Record<string, string[]>
> = {
  "School of Business and Applied Computer Technologies": {
    Certificate: [
      "Certificate Programme - To Be Updated",
    ],
    Diploma: [
      "Diploma Programme - To Be Updated",
    ],
    "Bachelor's": [
      "Bachelor of Business Administration",
      "Bachelor of Accounting",
      "Bachelor of Finance",
      "Bachelor of Procurement and Logistics",
      "Bachelor of Information Technology",
      "Bachelor of Tourism, Hospitality and Events Management",
    ],
    "Postgraduate Diploma": [
      "Postgraduate Programme - To Be Updated",
    ],
    "Master's": [
      "Master of Business Administration",
    ],
    PhD: [
      "PhD Programme - To Be Updated",
    ],
    Other: [
      "Other",
    ],
  },

  "School of Nursing and Midwifery": {
    Certificate: [
      "Certificate Programme - To Be Updated",
    ],
    Diploma: [
      "Diploma Programme - To Be Updated",
    ],
    "Bachelor's": [
      "Bachelor of Nursing Science",
      "Bachelor of Midwifery Science",
    ],
    "Postgraduate Diploma": [
      "Postgraduate Diploma in Critical Care Nursing",
      "Postgraduate Diploma in Medical Education",
    ],
    "Master's": [
      "Master's Programme - To Be Updated",
    ],
    PhD: [
      "PhD Programme - To Be Updated",
    ],
    Other: [
      "Other",
    ],
  },

  "School of Public Health": {
    Certificate: [
      "Certificate Programme - To Be Updated",
    ],
    Diploma: [
      "Diploma Programme - To Be Updated",
    ],
    "Bachelor's": [
      "Bachelor of Public Health",
    ],
    "Postgraduate Diploma": [
      "Postgraduate Diploma in Medical Education",
      "Postgraduate Diploma Programme - To Be Updated",
    ],
    "Master's": [
      "Master of Public Health",
    ],
    PhD: [
      "PhD Programme - To Be Updated",
    ],
    Other: [
      "Other",
    ],
  },

  "Institute of Allied Health Sciences": {
    Certificate: [
      "Certificate Programme - To Be Updated",
    ],
    Diploma: [
      "Diploma in Clinical Medicine",
      "Diploma in Pharmacy",
      "Diploma in Medical Laboratory Science",
    ],
    "Bachelor's": [
      "Bachelor of Medical Laboratory Science",
    ],
    "Postgraduate Diploma": [
      "Postgraduate Programme - To Be Updated",
    ],
    "Master's": [
      "Master's Programme - To Be Updated",
    ],
    PhD: [
      "PhD Programme - To Be Updated",
    ],
    Other: [
      "Other",
    ],
  },
};

function LeadCaptureForm() {
  const searchParams = useSearchParams();

  const campaignId = searchParams.get("campaign") || "";
  const sourceParam = searchParams.get("source") || "";

  const [campaignName, setCampaignName] = useState("");
  const [loadingCampaign, setLoadingCampaign] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    school: "",
    level: "",
    program: "",
    intake: "",
    previousEducation: "",
    location: "",
    source: "",
    heardAboutUs: "",
    message: "",
  });

  const availablePrograms = useMemo(() => {
    if (!form.school || !form.level) {
      return [];
    }

    return (
      programmes[form.school]?.[form.level] || []
    );
  }, [form.school, form.level]);

  useEffect(() => {
    const loadCampaign = async () => {
      if (!campaignId) {
        setLoadingCampaign(false);
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/campaigns?id=eq.${campaignId}&select=id,name`,
          {
            headers: {
              apikey:
                process.env
                  .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
              Authorization: `Bearer ${
                process.env
                  .NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ""
              }`,
            },
          }
        );

        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          setCampaignName(data[0].name || "");
        }
      } catch (err) {
        console.error(
          "Campaign loading error:",
          err
        );
      } finally {
        setLoadingCampaign(false);
      }
    };

    loadCampaign();
  }, [campaignId]);

  useEffect(() => {
    const matchedSource = sources.find(
      (source) =>
        source.toLowerCase() ===
        sourceParam.toLowerCase()
    );

    if (matchedSource) {
      setForm((current) => ({
        ...current,
        source: matchedSource,
      }));
    }
  }, [sourceParam]);

  const updateForm = (
    field: keyof typeof form,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSchoolChange = (
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      school: value,
      level: "",
      program: "",
    }));
  };

  const handleLevelChange = (
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      level: value,
      program: "",
    }));
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!form.phone.trim()) {
      setError(
        "Please enter your telephone number."
      );
      return;
    }

    if (!form.school) {
      setError(
        "Please select the school or faculty."
      );
      return;
    }

    if (!form.level) {
      setError(
        "Please select your level of study."
      );
      return;
    }

    if (!form.program) {
      setError(
        "Please select the programme you are interested in."
      );
      return;
    }

    if (!form.intake) {
      setError(
        "Please select your preferred intake."
      );
      return;
    }

    if (!campaignId) {
      setError(
        "This lead collection link is missing a campaign."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/public-lead-capture`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            campaignId,
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            program: form.program.trim(),
            location: form.location.trim(),
            source: form.source,
            school: form.school,
            level: form.level,
            intake: form.intake,
            previousEducation:
              form.previousEducation,
            heardAboutUs: form.heardAboutUs,
            message: form.message.trim(),
            website: "",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Unable to submit your information."
        );
      }

      setSubmitted(true);

      setForm({
        name: "",
        phone: "",
        email: "",
        school: "",
        level: "",
        program: "",
        intake: "",
        previousEducation: "",
        location: "",
        source: form.source,
        heardAboutUs: "",
        message: "",
      });
    } catch (err) {
      console.error(
        "Lead capture error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to submit your information."
      );
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 36,
            textAlign: "center",
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.06)",
          }}
        >
          <div
            style={{
              width: 60,
              height: 60,
              margin: "0 auto 18px",
              borderRadius: "50%",
              background: "#dcfce7",
              color: "#166534",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            ✓
          </div>

          <h1
            style={{
              margin: "0 0 10px",
              fontSize: 26,
              fontWeight: 700,
              color: "#111827",
            }}
          >
            Thank You!
          </h1>

          <p
            style={{
              margin: 0,
              color: "#64748b",
              lineHeight: 1.6,
              fontSize: 15,
            }}
          >
            Your information has been received.
            Our admissions team will contact you
            shortly.
          </p>

          <p
            style={{
              margin: "18px 0 0",
              color: "#475569",
              lineHeight: 1.6,
              fontSize: 14,
            }}
          >
            Please keep your telephone or
            WhatsApp available so that our team
            can reach you.
          </p>
        </div>
      </main>
    );
  }

  const inputStyle = {
    width: "100%",
    height: 44,
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 14,
    boxSizing: "border-box" as const,
    background: "#ffffff",
  };

  const labelStyle = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 7,
    color: "#111827",
  };

  const fieldContainerStyle = {
    minWidth: 0,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "40px 20px",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: 700,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: 30,
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              textAlign: "center",
              marginBottom: 28,
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 700,
                color: "#111827",
              }}
            >
              Get More Information
            </h1>

            <p
              style={{
                margin: "8px 0 0",
                color: "#64748b",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              Tell us a little about yourself and
              the programme you are interested in.
              Our admissions team will get in touch
              with you.
            </p>

            {loadingCampaign ? (
              <p
                style={{
                  marginTop: 14,
                  color: "#64748b",
                  fontSize: 13,
                }}
              >
                Loading campaign...
              </p>
            ) : campaignName ? (
              <div
                style={{
                  display: "inline-block",
                  marginTop: 14,
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Campaign: {campaignName}
              </div>
            ) : null}
          </div>

          {error && (
            <div
              style={{
                marginBottom: 18,
                padding: "12px 14px",
                borderRadius: 8,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
                gap: 16,
              }}
            >
              {/* FULL NAME */}
              <div
                style={{
                  ...fieldContainerStyle,
                  gridColumn: "1 / -1",
                }}
              >
                <label style={labelStyle}>
                  Full Name *
                </label>

                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) =>
                    updateForm(
                      "name",
                      event.target.value
                    )
                  }
                  placeholder="Enter your full name"
                  style={inputStyle}
                />
              </div>

              {/* PHONE */}
              <div style={fieldContainerStyle}>
                <label style={labelStyle}>
                  Telephone / WhatsApp Number *
                </label>

                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(event) =>
                    updateForm(
                      "phone",
                      event.target.value
                    )
                  }
                  placeholder="+256..."
                  style={inputStyle}
                />
              </div>

              {/* EMAIL */}
              <div style={fieldContainerStyle}>
                <label style={labelStyle}>
                  Email Address
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    updateForm(
                      "email",
                      event.target.value
                    )
                  }
                  placeholder="example@email.com"
                  style={inputStyle}
                />
              </div>

              {/* SCHOOL */}
              <div style={fieldContainerStyle}>
                <label style={labelStyle}>
                  School / Faculty *
                </label>

                <select
                  required
                  value={form.school}
                  onChange={(event) =>
                    handleSchoolChange(
                      event.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">
                    Select school / faculty
                  </option>

                  {schools.map((school) => (
                    <option
                      key={school}
                      value={school}
                    >
                      {school}
                    </option>
                  ))}
                </select>
              </div>

              {/* LEVEL */}
              <div style={fieldContainerStyle}>
                <label style={labelStyle}>
                  Level of Study *
                </label>

                <select
                  required
                  value={form.level}
                  onChange={(event) =>
                    handleLevelChange(
                      event.target.value
                    )
                  }
                  disabled={!form.school}
                  style={{
                    ...inputStyle,
                    background: !form.school
                      ? "#f3f4f6"
                      : "#ffffff",
                    cursor: !form.school
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  <option value="">
                    {form.school
                      ? "Select level"
                      : "Select school first"}
                  </option>

                  {studyLevels.map((level) => (
                    <option
                      key={level}
                      value={level}
                    >
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              {/* PROGRAMME */}
              <div
                style={{
                  ...fieldContainerStyle,
                  gridColumn: "1 / -1",
                }}
              >
                <label style={labelStyle}>
                  Programme / Course *
                </label>

                <select
                  required
                  value={form.program}
                  onChange={(event) =>
                    updateForm(
                      "program",
                      event.target.value
                    )
                  }
                  disabled={
                    !form.school || !form.level
                  }
                  style={{
                    ...inputStyle,
                    background:
                      !form.school || !form.level
                        ? "#f3f4f6"
                        : "#ffffff",
                    cursor:
                      !form.school || !form.level
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  <option value="">
                    {!form.school
                      ? "Select school first"
                      : !form.level
                      ? "Select level first"
                      : "Select programme"}
                  </option>

                  {availablePrograms.map(
                    (program) => (
                      <option
                        key={program}
                        value={program}
                      >
                        {program}
                      </option>
                    )
                  )}
                </select>

                {form.school &&
                  form.level &&
                  availablePrograms.length === 0 && (
                    <p
                      style={{
                        margin:
                          "7px 0 0",
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      Programme list for this
                      level will be updated.
                    </p>
                  )}
              </div>

              {/* INTAKE */}
              <div style={fieldContainerStyle}>
                <label style={labelStyle}>
                  Preferred Intake *
                </label>

                <select
                  required
                  value={form.intake}
                  onChange={(event) =>
                    updateForm(
                      "intake",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">
                    Select intake
                  </option>

                  {intakes.map((intake) => (
                    <option
                      key={intake}
                      value={intake}
                    >
                      {intake} Intake
                    </option>
                  ))}
                </select>
              </div>

              {/* PREVIOUS EDUCATION */}
              <div style={fieldContainerStyle}>
                <label style={labelStyle}>
                  Previous Education Level
                </label>

                <select
                  value={
                    form.previousEducation
                  }
                  onChange={(event) =>
                    updateForm(
                      "previousEducation",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">
                    Select education level
                  </option>

                  {previousEducationLevels.map(
                    (level) => (
                      <option
                        key={level}
                        value={level}
                      >
                        {level}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* LOCATION */}
              <div style={fieldContainerStyle}>
                <label style={labelStyle}>
                  Location
                </label>

                <input
                  type="text"
                  value={form.location}
                  onChange={(event) =>
                    updateForm(
                      "location",
                      event.target.value
                    )
                  }
                  placeholder="e.g. Kampala"
                  style={inputStyle}
                />
              </div>

              {/* HOW HEARD */}
              <div style={fieldContainerStyle}>
                <label style={labelStyle}>
                  How did you hear about CIU?
                </label>

                <select
                  value={form.heardAboutUs}
                  onChange={(event) =>
                    updateForm(
                      "heardAboutUs",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">
                    Select an option
                  </option>
                  <option value="Facebook">
                    Facebook
                  </option>
                  <option value="TikTok">
                    TikTok
                  </option>
                  <option value="Instagram">
                    Instagram
                  </option>
                  <option value="Google">
                    Google
                  </option>
                  <option value="Website">
                    CIU Website
                  </option>
                  <option value="WhatsApp">
                    WhatsApp
                  </option>
                  <option value="Friend or Family">
                    Friend or Family
                  </option>
                  <option value="School">
                    School
                  </option>
                  <option value="Agent">
                    Education Agent
                  </option>
                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

              {/* ADDITIONAL MESSAGE */}
              <div
                style={{
                  ...fieldContainerStyle,
                  gridColumn: "1 / -1",
                }}
              >
                <label style={labelStyle}>
                  Additional Message / Enquiry
                </label>

                <textarea
                  value={form.message}
                  onChange={(event) =>
                    updateForm(
                      "message",
                      event.target.value
                    )
                  }
                  placeholder="Tell us anything else you would like to know about the programme or admission process..."
                  rows={5}
                  style={{
                    width: "100%",
                    border:
                      "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "12px",
                    fontSize: 14,
                    boxSizing:
                      "border-box",
                    resize: "vertical",
                    fontFamily:
                      "inherit",
                    lineHeight: 1.5,
                  }}
                />
              </div>

              {/* SOURCE */}
              <div
                style={{
                  ...fieldContainerStyle,
                  gridColumn: "1 / -1",
                }}
              >
                <label style={labelStyle}>
                  Lead Source
                </label>

                <select
                  value={form.source}
                  onChange={(event) =>
                    updateForm(
                      "source",
                      event.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">
                    Select source
                  </option>

                  {sources.map((source) => (
                    <option
                      key={source}
                      value={source}
                    >
                      {source}
                    </option>
                  ))}
                </select>

                <p
                  style={{
                    margin:
                      "7px 0 0",
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  This is normally captured
                  automatically from the campaign
                  link.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                marginTop: 24,
                height: 48,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                visibility: "visible",
                opacity: saving ? 0.7 : 1,
                color: "#ffffff",
                background: "#2563eb",
                border:
                  "1px solid #2563eb",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
              }}
            >
              {saving
                ? "Submitting..."
                : "Submit Information"}
            </button>

            <p
              style={{
                margin:
                  "14px 0 0",
                textAlign: "center",
                color: "#64748b",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              By submitting this form, you
              agree that the CIU admissions team
              may contact you regarding your
              enquiry.
            </p>
          </form>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 640px) {
          main {
            padding: 20px 12px !important;
          }

          form > div {
            grid-template-columns: 1fr !important;
          }

          form > div > div {
            grid-column: 1 / -1 !important;
          }
        }
      `}</style>
    </main>
  );
}

export default function LeadCapturePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily:
              "Arial, sans-serif",
            color: "#374151",
          }}
        >
          Loading lead form...
        </div>
      }
    >
      <LeadCaptureForm />
    </Suspense>
  );
}