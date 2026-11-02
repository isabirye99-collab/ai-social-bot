"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import MarketingSectionTabs from "@/components/MarketingSectionTabs";

const supabase = createClient();

type Approval = {
  id: string;
  entity_id: string;
  requested_by: string | null;
  requested_at: string;
  reviewer_comments: string | null;
};

type SocialPost = {
  id: string;
  title: string;
  body: string;
  platforms: string[];
  media_urls: string[];
  scheduled_at: string | null;
  created_at: string;
};

type QueueItem = { approval: Approval; post: SocialPost };

const labels: Record<string, string> = {
  wordpress: "WordPress",
  tiktok: "TikTok",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  linkedin: "LinkedIn",
};

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-UG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function SocialApprovalsPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data: approvals, error: approvalError } = await supabase
      .from("marketing_approvals")
      .select("id,entity_id,requested_by,requested_at,reviewer_comments")
      .eq("entity_type", "social_post")
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    if (approvalError) {
      setError(approvalError.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const rows = (approvals ?? []) as Approval[];
    if (!rows.length) {
      setItems([]);
      setLoading(false);
      return;
    }

    const ids = rows.map((row) => row.entity_id);
    const { data: posts, error: postError } = await supabase
      .from("social_posts")
      .select("id,title,body,platforms,media_urls,scheduled_at,created_at")
      .in("id", ids);

    if (postError) {
      setError(postError.message);
      setItems([]);
    } else {
      const byId = new Map(((posts ?? []) as SocialPost[]).map((post) => [post.id, post]));
      setItems(rows.flatMap((approval) => {
        const post = byId.get(approval.entity_id);
        return post ? [{ approval, post }] : [];
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function review(item: QueueItem, decision: "approved" | "rejected") {
    setWorkingId(item.approval.id);
    setError("");
    setNotice("");

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      setError("Your staff session has expired. Sign in again.");
      setWorkingId("");
      return;
    }

    const reviewerComment = comments[item.approval.id]?.trim() || null;
    const { error: approvalError } = await supabase
      .from("marketing_approvals")
      .update({
        status: decision,
        reviewed_by: auth.user.id,
        reviewed_at: new Date().toISOString(),
        reviewer_comments: reviewerComment,
      })
      .eq("id", item.approval.id)
      .eq("status", "pending");

    if (approvalError) {
      setError(approvalError.message);
      setWorkingId("");
      return;
    }

    const nextPostStatus = decision === "rejected"
      ? "rejected"
      : item.post.scheduled_at && new Date(item.post.scheduled_at).getTime() > Date.now()
        ? "scheduled"
        : "approved";

    const { error: postError } = await supabase
      .from("social_posts")
      .update({
        status: nextPostStatus,
        approved_by: decision === "approved" ? auth.user.id : null,
        approved_at: decision === "approved" ? new Date().toISOString() : null,
        error_message: decision === "rejected" ? reviewerComment : null,
      })
      .eq("id", item.post.id)
      .eq("status", "pending_approval");

    if (postError) {
      // Restore the request to pending if the post state transition did not succeed.
      await supabase
        .from("marketing_approvals")
        .update({
          status: "pending",
          reviewed_by: null,
          reviewed_at: null,
          reviewer_comments: null,
        })
        .eq("id", item.approval.id);
      setError("The review could not be applied to the post: " + postError.message);
      await loadQueue();
      setWorkingId("");
      return;
    }

    setNotice(decision === "approved"
      ? nextPostStatus === "scheduled"
        ? "Post approved and marked as scheduled. Publishing still requires a configured platform connection."
        : "Post approved. It is ready for the publishing service once platform connections are configured."
      : "Post rejected and returned to the marketing team.");
    setComments((current) => {
      const next = { ...current };
      delete next[item.approval.id];
      return next;
    });
    await loadQueue();
    setWorkingId("");
  }

  return (
    <main className="min-h-screen p-4 text-[#17211b] sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "var(--ciu-primary, #106053)" }}>Marketing workspace</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Social Media Approvals</h1>
          <p className="mt-1 text-sm text-slate-500">Review content submitted by the marketing team before it can be scheduled or published.</p>
        </header>
        <MarketingSectionTabs />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold">Manager review queue</p>
            <p className="text-xs text-slate-500">{items.length} request{items.length === 1 ? "" : "s"} awaiting a decision</p>
          </div>
          <button onClick={() => void loadQueue()} disabled={loading} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50">Refresh queue</button>
        </div>
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
        {loading ? (
          <div className="rounded-xl border bg-white p-8 text-center text-sm text-slate-500">Loading approval requests…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="font-bold">No pending approvals</h2>
            <p className="mt-1 text-sm text-slate-500">New requests from the Social Media Hub will appear here.</p>
            <Link href="/marketing/social" className="mt-4 inline-block text-sm font-semibold underline" style={{ color: "var(--ciu-primary, #106053)" }}>Open Social Media Hub</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(({ approval, post }) => (
              <article key={approval.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold">{post.title}</h2>
                    <p className="mt-1 text-xs text-slate-500">Requested {dateLabel(approval.requested_at)}</p>
                  </div>
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">Awaiting review</span>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.body || "No caption provided."}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(post.platforms ?? []).map((platform) => <span key={platform} className="rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "#eaf5f2", color: "var(--ciu-primary, #106053)" }}>{labels[platform] ?? platform}</span>)}
                </div>
                {post.scheduled_at && <p className="mt-3 text-xs font-medium text-slate-600">Requested schedule: {dateLabel(post.scheduled_at)}</p>}
                <p className="mt-1 text-xs text-slate-500">{post.media_urls?.length ?? 0} media file(s) attached</p>
                <label className="mt-5 block text-sm font-semibold" htmlFor={"review-" + approval.id}>Manager comments (optional)</label>
                <textarea id={"review-" + approval.id} rows={2} value={comments[approval.id] ?? ""} onChange={(event) => setComments((current) => ({ ...current, [approval.id]: event.target.value }))} placeholder="Add feedback for the marketing team…" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2" />
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button onClick={() => void review({ approval, post }, "rejected")} disabled={workingId === approval.id} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">{workingId === approval.id ? "Saving…" : "Reject and return"}</button>
                  <button onClick={() => void review({ approval, post }, "approved")} disabled={workingId === approval.id} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--ciu-primary, #106053)" }}>{workingId === approval.id ? "Saving…" : "Approve post"}</button>
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="text-xs leading-5 text-slate-500">Approval does not itself publish content. Direct publishing will be enabled only after the official platform accounts and server-side publishing services are configured.</p>
      </div>
    </main>
  );
}
