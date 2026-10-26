"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import MarketingSectionTabs from "@/components/MarketingSectionTabs";

const supabase = createClient();
const STORAGE_BUCKET = "social-media";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

const PLATFORMS = [
  "wordpress",
  "tiktok",
  "facebook",
  "instagram",
  "x",
  "linkedin",
] as const;

type Platform = (typeof PLATFORMS)[number];

type SocialPost = {
  id: string;
  title: string;
  body: string;
  platforms: string[];
  media_urls: string[];
  status: string;
  scheduled_at: string | null;
  created_at: string;
  error_message: string | null;
};

type SelectedMedia = {
  file: File;
  previewUrl: string;
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  approved: "Approved",
  scheduled: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  rejected: "Rejected",
};

const PLATFORM_LABELS: Record<Platform, string> = {
  wordpress: "WordPress",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
};

function formatDate(value: string | null) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString();
}

function toLocalDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isVideo(file: File) {
  return file.type.startsWith("video/");
}

export default function SocialMediaPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("social_posts")
      .select(
        "id,title,body,platforms,media_urls,status,scheduled_at,created_at,error_message",
      )
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setPosts([]);
    } else {
      setPosts((data ?? []) as SocialPost[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    return () => {
      selectedMedia.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
    // Preview URLs are owned by this page and cleaned up when the page closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const calendarCells = useMemo(() => {
    const firstWeekday = calendarMonth.getDay();
    const daysInMonth = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [calendarMonth]);

  function togglePlatform(platform: Platform) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  }

  function chooseCalendarDay(day: number) {
    const picked = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      day,
      10,
      0,
    );
    setScheduledAt(toLocalDateTimeValue(picked));
    setScheduleEnabled(true);
  }

  function handleMediaSelection(event: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setNotice("");
    const incoming = Array.from(event.target.files ?? []);
    if (!incoming.length) return;

    const remainingSlots = Math.max(0, 10 - selectedMedia.length);
    if (incoming.length > remainingSlots) {
      setError("You can attach up to 10 files to one post.");
    }

    const accepted: SelectedMedia[] = [];
    for (const file of incoming.slice(0, remainingSlots)) {
      if (!(ALLOWED_TYPES as readonly string[]).includes(file.type)) {
        setError(
          `${file.name} is not a supported image or video. Use JPG, PNG, WebP, GIF, MP4, MOV, or WebM.`,
        );
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} is larger than the 50 MB per-file limit.`);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }

    setSelectedMedia((current) => [...current, ...accepted]);
    event.target.value = "";
  }

  function removeMedia(index: number) {
    setSelectedMedia((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function uploadSelectedMedia() {
    if (!selectedMedia.length) return [] as string[];

    setUploading(true);
    const paths: string[] = [];
    try {
      for (const item of selectedMedia) {
        const safeName = item.file.name
          .normalize("NFKD")
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .replace(/-+/g, "-");
        const path = `${Date.now()}-${crypto.randomUUID()}/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, item.file, {
            cacheControl: "3600",
            contentType: item.file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;
        paths.push(path);
      }
      return paths;
    } catch (uploadError) {
      // Do not leave newly uploaded orphan files when a later upload fails.
      if (paths.length) {
        await supabase.storage.from(STORAGE_BUCKET).remove(paths);
      }
      throw uploadError;
    } finally {
      setUploading(false);
    }
  }

  async function createDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!title.trim()) {
      setError("Enter a title for your post.");
      return;
    }
    if (platforms.length === 0) {
      setError("Select at least one social media platform.");
      return;
    }
    if (scheduleEnabled) {
      if (!scheduledAt) {
        setError("Choose a date and time in the scheduling calendar.");
        return;
      }
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        setError("Choose a future date and time for scheduling.");
        return;
      }
    }

    setSaving(true);
    let uploadedPaths: string[] = [];
    try {
      uploadedPaths = await uploadSelectedMedia();

      const { error: insertError } = await supabase.from("social_posts").insert({
        title: title.trim(),
        body: body.trim(),
        platforms,
        media_urls: uploadedPaths,
        scheduled_at: scheduleEnabled ? new Date(scheduledAt).toISOString() : null,
        // Scheduling takes effect only after manager approval and platform APIs
        // are configured; a newly created post remains a draft.
        status: "draft",
      });

      if (insertError) {
        if (uploadedPaths.length) {
          await supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
        }
        throw insertError;
      }

      selectedMedia.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setTitle("");
      setBody("");
      setPlatforms([]);
      setSelectedMedia([]);
      setScheduledAt("");
      setScheduleEnabled(false);
      setNotice(
        scheduleEnabled
          ? "Draft saved with its requested schedule. Submit it for manager approval before publishing."
          : "Draft saved successfully.",
      );
      await loadPosts();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The draft could not be saved. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function submitForApproval(post: SocialPost) {
    setError("");
    setNotice("");

    if (post.status !== "draft" && post.status !== "rejected") {
      setError("Only draft or rejected posts can be submitted.");
      return;
    }

    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      setError("Please sign in before submitting a post.");
      return;
    }

    const { error: approvalError } = await supabase.from("marketing_approvals").insert({
      entity_type: "social_post",
      entity_id: post.id,
      requested_by: userResult.user.id,
      status: "pending",
    });

    if (approvalError) {
      setError(approvalError.message);
      return;
    }

    const { error: postError } = await supabase
      .from("social_posts")
      .update({ status: "pending_approval" })
      .eq("id", post.id)
      .in("status", ["draft", "rejected"]);

    if (postError) {
      setError(
        "The approval request was created, but the post status could not be updated: " +
          postError.message,
      );
      await loadPosts();
      return;
    }

    setNotice("Post submitted for manager approval.");
    await loadPosts();
  }

  async function getSignedMediaUrl(path: string) {
    const { data, error: signedUrlError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(path, 60 * 30);
    if (signedUrlError) throw signedUrlError;
    return data.signedUrl;
  }

  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const paths = Array.from(new Set(posts.flatMap((post) => post.media_urls ?? [])));
    const missing = paths.filter((path) => !signedUrls[path]);
    if (!missing.length) return;

    void (async () => {
      const results = await Promise.all(
        missing.map(async (path) => {
          try {
            return [path, await getSignedMediaUrl(path)] as const;
          } catch {
            return [path, ""] as const;
          }
        }),
      );
      if (!cancelled) {
        setSignedUrls((current) => {
          const next = { ...current };
          for (const [path, url] of results) next[path] = url;
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // getSignedMediaUrl is stable for this page's Supabase client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, signedUrls]);

  return (
    <main
      className="min-h-screen p-4 text-slate-900 sm:p-6 lg:p-8"
      style={{ background: "transparent", "--ciu-primary": "var(--ciu-primary, #00695c)", "--ciu-lime": "var(--ciu-secondary, #8bc63f)" } as React.CSSProperties}
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <MarketingSectionTabs />
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: "var(--ciu-primary, #00695c)" }}>Social Media Hub</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Prepare content for your channels, attach media, schedule a preferred publishing time,
              and submit posts for manager approval.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPosts()}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh posts"}
          </button>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "All posts", value: posts.length },
            { label: "Drafts", value: posts.filter((post) => post.status === "draft").length },
            { label: "Awaiting approval", value: posts.filter((post) => post.status === "pending_approval").length },
            { label: "Published", value: posts.filter((post) => post.status === "published").length },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" style={{ borderLeft: "4px solid var(--ciu-primary, #00695c)" }}>
              <p className="text-sm text-slate-500">{item.label}</p>
              <p className="mt-2 text-2xl font-bold" style={{ color: "var(--ciu-primary, #00695c)" }}>{item.value}</p>
            </div>
          ))}
        </section>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {notice}
          </div>
        )}

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" style={{ borderLeft: "4px solid var(--ciu-primary, #00695c)" }}>
          <h2 className="text-xl font-bold" style={{ color: "var(--ciu-primary, #00695c)" }}>Create a social media draft</h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose your channels, add media, and optionally choose a date and time. Scheduling is saved with the draft.
          </p>

          <form onSubmit={createDraft} className="mt-5 space-y-6">
            <div>
              <label htmlFor="social-title" className="mb-2 block text-sm font-semibold">Post title</label>
              <input
                id="social-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                required
                placeholder="e.g. CIU admissions announcement"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2"
                style={{ "--tw-ring-color": "#d7eee9" } as React.CSSProperties}
              />
            </div>

            <div>
              <label htmlFor="social-body" className="mb-2 block text-sm font-semibold">Post content / caption</label>
              <textarea
                id="social-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                placeholder="Write your caption or announcement..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:ring-2"
              />
              <p className="mt-1 text-right text-xs text-slate-500">{body.length} characters</p>
            </div>

            <fieldset>
              <legend className="mb-3 text-sm font-semibold">Select publishing channels</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PLATFORMS.map((platform) => (
                  <label
                    key={platform}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-medium"
                    style={{
                      borderColor: platforms.includes(platform) ? "var(--ciu-primary, #00695c)" : "#e2e8f0",
                      background: platforms.includes(platform) ? "#eaf5f2" : "#fff",
                      color: platforms.includes(platform) ? "var(--ciu-primary, #00574c)" : "#334155",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={platforms.includes(platform)}
                      onChange={() => togglePlatform(platform)}
                      className="h-4 w-4"
                      style={{ accentColor: "var(--ciu-primary, #00695c)" }}
                    />
                    {PLATFORM_LABELS[platform]}
                  </label>
                ))}
              </div>
            </fieldset>

            <section className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold">Pictures and videos</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Up to 10 files, maximum 50 MB each. Uploads are kept in the private social-media bucket.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={selectedMedia.length >= 10 || saving}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--ciu-primary, #00695c)" }}
                >
                  Add pictures / videos
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ALLOWED_TYPES.join(",")}
                  multiple
                  onChange={handleMediaSelection}
                  className="hidden"
                />
              </div>

              {selectedMedia.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {selectedMedia.map((item, index) => (
                    <div key={`${item.file.name}-${item.file.lastModified}-${index}`} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {isVideo(item.file) ? (
                        <video src={item.previewUrl} controls className="h-32 w-full bg-black object-contain" />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.previewUrl} alt={item.file.name} className="h-32 w-full object-cover" />
                      )}
                      <div className="p-2">
                        <p className="truncate text-xs font-medium" title={item.file.name}>{item.file.name}</p>
                        <p className="text-xs text-slate-500">{(item.file.size / (1024 * 1024)).toFixed(1)} MB</p>
                        <button type="button" onClick={() => removeMedia(index)} className="mt-2 text-xs font-semibold text-red-700">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  No media attached. Add an image or video to preview it here.
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">Scheduling calendar</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Pick a date on the calendar, then set the exact time. The post still requires manager approval.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={scheduleEnabled}
                    onChange={(event) => setScheduleEnabled(event.target.checked)}
                    style={{ accentColor: "var(--ciu-primary, #00695c)" }}
                  />
                  Set preferred schedule
                </label>
              </div>

              {scheduleEnabled && (
                <div className="mt-4 grid gap-5 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <button
                        type="button"
                        aria-label="Previous month"
                        onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        â€¹
                      </button>
                      <p className="font-semibold">
                        {calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
                      </p>
                      <button
                        type="button"
                        aria-label="Next month"
                        onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                      >
                        â€º
                      </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <div key={day} className="py-2 font-semibold">{day}</div>
                      ))}
                      {calendarCells.map((day, index) => {
                        const selected = day !== null && scheduledAt &&
                          new Date(scheduledAt).getFullYear() === calendarMonth.getFullYear() &&
                          new Date(scheduledAt).getMonth() === calendarMonth.getMonth() &&
                          new Date(scheduledAt).getDate() === day;
                        const date = day === null ? null : new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                        const past = date ? date.setHours(23, 59, 59, 999) < Date.now() : false;
                        return (
                          <button
                            key={`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}-${index}`}
                            type="button"
                            disabled={day === null || past}
                            onClick={() => day !== null && chooseCalendarDay(day)}
                            className="min-h-9 rounded-md text-sm disabled:cursor-not-allowed disabled:opacity-25"
                            style={selected ? { background: "var(--ciu-primary, #00695c)", color: "#fff", fontWeight: 700 } : { background: day === null ? "transparent" : "#f8fafc" }}
                          >
                            {day ?? ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="social-schedule" className="mb-2 block text-sm font-semibold">Scheduled date and time</label>
                    <input
                      id="social-schedule"
                      type="datetime-local"
                      value={scheduledAt}
                      min={toLocalDateTimeValue(new Date(Date.now() + 60_000))}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      required={scheduleEnabled}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Time is based on your computerâ€™s local time zone. Choosing a date saves the requested schedule, but it does not publish automatically yet.
                    </p>
                    {scheduledAt && (
                      <p className="mt-3 rounded-lg p-3 text-sm font-medium" style={{ background: "#eaf5f2", color: "var(--ciu-primary, #00574c)" }}>
                        Selected: {new Date(scheduledAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </section>

            <button
              type="submit"
              disabled={saving || uploading}
              className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--ciu-primary, #00695c)" }}
            >
              {uploading ? "Uploading media..." : saving ? "Saving draft..." : "Save draft"}
            </button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" style={{ borderLeft: "4px solid var(--ciu-primary, #00695c)" }}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Social media posts</h2>
              <p className="mt-1 text-sm text-slate-500">Review your content and request manager approval.</p>
            </div>
            <span className="text-sm text-slate-500">{posts.length} posts</span>
          </div>

          {loading ? (
            <p className="py-8 text-sm text-slate-500">Loading posts...</p>
          ) : posts.length === 0 ? (
            <div className="py-10 text-center">
              <p className="font-semibold">No social media posts yet</p>
              <p className="mt-1 text-sm text-slate-500">Create your first draft using the form above.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {posts.map((post) => (
                <article key={post.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-bold">{post.title}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{post.body || "No caption added."}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(post.platforms ?? []).map((platform) => (
                          <span key={platform} className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: "#eaf5f2", color: "var(--ciu-primary, #00574c)" }}>
                            {PLATFORM_LABELS[platform as Platform] ?? platform}
                          </span>
                        ))}
                      </div>

                      {(post.media_urls ?? []).length > 0 && (
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                          {post.media_urls.map((path) => {
                            const url = signedUrls[path];
                            const video = /\.(mp4|mov|webm)(\?|$)/i.test(path);
                            return (
                              <div key={path} className="overflow-hidden rounded-lg border border-slate-200">
                                {url ? (
                                  video ? (
                                    <video src={url} controls className="h-32 w-full bg-black object-contain" />
                                  ) : (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={url} alt="Social post media" className="h-32 w-full object-cover" />
                                  )
                                ) : (
                                  <div className="flex h-32 items-center justify-center p-2 text-center text-xs text-slate-500">
                                    Loading private media previewâ€¦
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <p className="mt-3 text-xs text-slate-500">Created {formatDate(post.created_at)}</p>
                      {post.scheduled_at && <p className="mt-1 text-xs font-medium" style={{ color: "var(--ciu-primary, #00695c)" }}>Preferred schedule: {formatDate(post.scheduled_at)}</p>}
                      {post.error_message && <p className="mt-2 text-sm text-red-700">{post.error_message}</p>}
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">
                        {STATUS_LABELS[post.status] ?? post.status}
                      </span>
                      {(post.status === "draft" || post.status === "rejected") && (
                        <button
                          type="button"
                          onClick={() => void submitForApproval(post)}
                          className="rounded-lg px-3 py-2 text-sm font-semibold text-white"
                          style={{ background: "var(--ciu-primary, #00695c)" }}
                        >
                          Submit for approval
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs leading-5 text-slate-500">
          Note: media uploads and schedule selection are enabled. Actual publishing and automatic scheduled posting require the official platform integrations and trusted server-side scheduling service to be configured.
        </p>
      </div>
    </main>
  );
}




