"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Enrolled students are managed in the Pipeline module.
 * Keep this legacy URL as a safe redirect so bookmarks and older links continue to work.
 */
export default function CustomersPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/pipeline");
  }, [router]);

  return (
    <main style={{ minHeight: "40vh", display: "grid", placeItems: "center", padding: 24, color: "#075442" }}>
      <p>Enrolled students are now managed in Pipeline. Redirecting…</p>
    </main>
  );
}
