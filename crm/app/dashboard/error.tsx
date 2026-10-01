"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Something went wrong
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          An unexpected error occurred.
        </p>

        <button
          onClick={() => reset()}
          className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}