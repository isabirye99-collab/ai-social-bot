"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function MarketingSectionTabs() {
  const pathname = usePathname();
  const socialActive = pathname?.startsWith("/marketing/social") ?? false;

  const sections = [
    {
      href: "/marketing",
      label: "Campaigns",
      description: "Campaigns, budgets and lead performance",
      number: "01",
      active: !socialActive,
    },
    {
      href: "/marketing/social",
      label: "Social Media Hub",
      description: "Content creation and publishing calendar",
      number: "02",
      active: pathname === "/marketing/social",
    },
    {
      href: "/marketing/social/approvals",
      label: "Approvals",
      description: "Manager review before publication",
      number: "03",
      active: pathname === "/marketing/social/approvals",
    },
  ];

  return (
    <nav
      aria-label="Marketing sections"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {sections.map((section) => (
        <Link
          key={section.href}
          href={section.href}
          aria-current={section.active ? "page" : undefined}
          className="flex items-center gap-3 rounded-2xl border px-4 py-4 transition-all"
          style={{
            borderColor: section.active
              ? "var(--ciu-primary, #106053)"
              : "#e2eae4",
            background: section.active
              ? "var(--ciu-primary, #106053)"
              : "#ffffff",
            color: section.active ? "#ffffff" : "#17211b",
            boxShadow: section.active
              ? "0 8px 24px rgba(16, 96, 83, 0.16)"
              : "none",
            textDecoration: "none",
          }}
        >
          <span
            aria-hidden="true"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-bold"
            style={{
              background: section.active
                ? "rgba(255,255,255,0.14)"
                : "#f1f6f1",
              color: section.active
                ? "#ffffff"
                : "var(--ciu-primary, #00695c)",
            }}
          >
            {section.number}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold">
              {section.label}
            </span>
            <span
              className="mt-0.5 block text-xs"
              style={{
                color: section.active
                  ? "rgba(255,255,255,0.82)"
                  : "#68776f",
              }}
            >
              {section.description}
            </span>
          </span>

          <span aria-hidden="true" className="text-xs font-semibold">
            {section.active ? "ACTIVE" : "OPEN"}
          </span>
        </Link>
      ))}
    </nav>
  );
}
