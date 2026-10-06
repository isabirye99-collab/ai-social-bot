"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

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
    program: "",
    location: "",
    source: "",
  });

  useEffect(() => {
    const loadCampaign = async () => {
      if (!campaignId) {
        setLoadingCampaign(false);
        return;
      }

      const { data, error: campaignError } = await supabase
        .from("campaigns")
        .select("id,name")
        .eq("id", campaignId)
        .maybeSingle();

      if (campaignError) {
        console.error("Campaign loading error:", campaignError);
      }

      if (data) {
        setCampaignName(data.name || "");
      }

      setLoadingCampaign(false);
    };

    loadCampaign();
  }, [campaignId]);

  useEffect(() => {
    const matchedSource = sources.find(
      (source) =>
        source.toLowerCase() === sourceParam.toLowerCase()
    );

    if (matchedSource) {
      setForm((current) => ({
        ...current,
        source: matchedSource,
      }));
    }
  }, [sourceParam]);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Please enter your telephone number.");
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

      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          product_service: form.program.trim() || null,
          location: form.location.trim() || null,
          status: "new",
        })
        .select("id")
        .single();

      if (leadError) {
        throw new Error(
          `Lead creation failed: ${leadError.message}`
        );
      }

      if (!lead) {
        throw new Error("Lead was not created.");
      }

      const { error: campaignLeadError } = await supabase
        .from("campaign_leads")
        .insert({
          campaign_id: campaignId,
          lead_id: lead.id,
        });

      if (campaignLeadError) {
        throw new Error(
          `Campaign linking failed: ${campaignLeadError.message}`
        );
      }

      setSubmitted(true);

      setForm({
        name: "",
        phone: "",
        email: "",
        program: "",
        location: "",
        source: form.source,
      });
    } catch (err) {
      console.error("Lead capture error:", err);

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
        </div>
      </main>
    );
  }

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
          maxWidth: 620,
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
              Complete the form below and our team
              will get in touch with you.
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
              <div
                style={{
                  gridColumn: "1 / -1",
                }}
              >
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 7,
                  }}
                >
                  Full Name *
                </label>

                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      name: event.target.value,
                    })
                  }
                  placeholder="Enter your full name"
                  style={{
                    width: "100%",
                    height: 44,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "0 12px",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 7,
                  }}
                >
                  Telephone Number *
                </label>

                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      phone: event.target.value,
                    })
                  }
                  placeholder="+256..."
                  style={{
                    width: "100%",
                    height: 44,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "0 12px",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 7,
                  }}
                >
                  Email Address
                </label>

                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      email: event.target.value,
                    })
                  }
                  placeholder="example@email.com"
                  style={{
                    width: "100%",
                    height: 44,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "0 12px",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 7,
                  }}
                >
                  Program / Course
                </label>

                <input
                  type="text"
                  value={form.program}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      program: event.target.value,
                    })
                  }
                  placeholder="e.g. Bachelor of Nursing"
                  style={{
                    width: "100%",
                    height: 44,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "0 12px",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 7,
                  }}
                >
                  Location
                </label>

                <input
                  type="text"
                  value={form.location}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      location: event.target.value,
                    })
                  }
                  placeholder="e.g. Kampala"
                  style={{
                    width: "100%",
                    height: 44,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "0 12px",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 7,
                  }}
                >
                  Lead Source
                </label>

                <select
                  value={form.source}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      source: event.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    height: 44,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "0 12px",
                    fontSize: 14,
                    background: "#ffffff",
                    boxSizing: "border-box",
                  }}
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
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{
                width: "100%",
                marginTop: 24,
                height: 46,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                visibility: "visible",
                opacity: saving ? 0.7 : 1,
                color: "#ffffff",
                background: "#2563eb",
                border: "1px solid #2563eb",
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
          </form>
        </div>
      </div>
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
            fontFamily: "Arial, sans-serif",
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