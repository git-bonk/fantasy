"use client";

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { WEEK_COOKIE, YEAR_COOKIE } from "./config";

interface SeasonContextValue {
  year: number | null;
  week: number | null;
  /** Build a href with current year/week params preserved */
  withParams: (href: string) => string;
  /** Navigate to a new year (resets week to max for that year) */
  setYear: (year: number, maxWeek: number) => void;
  /** Navigate to a new week */
  setWeek: (week: number) => void;
}

const SeasonContext = createContext<SeasonContextValue>({
  year: null,
  week: null,
  withParams: (href) => href,
  setYear: () => {},
  setWeek: () => {},
});

export function useSeason() {
  return useContext(SeasonContext);
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value};path=/;max-age=31536000;SameSite=Lax`;
}

export function SeasonProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const yearParam = searchParams.get("year");
  const weekParam = searchParams.get("week");
  const year = yearParam ? Number(yearParam) : null;
  const week = weekParam ? Number(weekParam) : null;

  // Sync URL params → cookies on every navigation
  useEffect(() => {
    if (yearParam) setCookie(YEAR_COOKIE, yearParam);
    if (weekParam) setCookie(WEEK_COOKIE, weekParam);
  }, [yearParam, weekParam]);

  const withParams = useCallback(
    (href: string) => {
      const params = new URLSearchParams();
      if (yearParam) params.set("year", yearParam);
      if (weekParam) params.set("week", weekParam);
      const qs = params.toString();
      return qs ? `${href}?${qs}` : href;
    },
    [yearParam, weekParam]
  );

  const setYear = useCallback(
    async (newYear: number, maxWeek: number) => {
      setCookie(YEAR_COOKIE, String(newYear));
      setCookie(WEEK_COOKIE, String(maxWeek));
      await router.replace(`${pathname}?year=${newYear}&week=${maxWeek}`, { scroll: false });
    },
    [pathname, router]
  );

  const setWeek = useCallback(
    async (newWeek: number) => {
      setCookie(WEEK_COOKIE, String(newWeek));
      const params = new URLSearchParams(window.location.search);
      params.set("week", String(newWeek));
      if (yearParam) params.set("year", yearParam);
      await router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, yearParam]
  );

  return (
    <SeasonContext.Provider value={{ year, week, withParams, setYear, setWeek }}>
      {children}
    </SeasonContext.Provider>
  );
}
