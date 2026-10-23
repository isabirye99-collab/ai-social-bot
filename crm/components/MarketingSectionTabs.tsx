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
      description: "Content, calendar and approvals",
      number: "02",
      active: socialActive,
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
          className="flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
          style={{
            borderColor: section.active
              ? "var(--ciu-primary, #00695c)"
              : "#dbe5e1",
            background: section.active
              ? "var(--ciu-primary, #00695c)"
              : "#ffffff",
            color: section.active ? "#ffffff" : "#23443b",
            boxShadow: section.active
              ? "0 4px 12px rgba(0, 105, 92, 0.12)"
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
                : "#edf5f1",
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
                  : "#64776f",
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
