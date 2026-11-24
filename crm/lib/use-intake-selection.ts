"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "ciu-crm-selected-intake-v2";
const DEFAULT_INTAKE = "all";
const VALID_INTAKES = new Set([
  "all",
  "unassigned",
  "2026-11",
  "2027-2",
  "2027-4",
  "2027-8",
  "2027-11",
  "2028-2",
]);

export function useIntakeSelection() {
  const [selectedIntake, setSelectedIntake] = useState(DEFAULT_INTAKE);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && VALID_INTAKES.has(saved)) setSelectedIntake(saved);
    } catch {
      // Storage may be disabled; the page still works with the default intake.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, selectedIntake);
    } catch {
      // Storage may be disabled; keep the in-page selection.
    }
  }, [selectedIntake]);

  return [selectedIntake, setSelectedIntake] as const;
}
