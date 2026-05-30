import { addDays, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek, subMonths } from "date-fns";
import type { ReportPeriod } from "./types";

export const DATE_FORMAT = "yyyy-MM-dd";

export function localToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

export function resolveDate(input: string | undefined | null, now = new Date()): string {
  const today = parseISO(localToday(now));
  const value = (input ?? "").trim().toLowerCase();
  if (!value || value === "today") return format(today, DATE_FORMAT);
  if (value === "yesterday") return format(addDays(today, -1), DATE_FORMAT);

  const daysAgo = value.match(/^(\d+)\s+days?\s+ago$/);
  if (daysAgo?.[1]) return format(addDays(today, -Number(daysAgo[1])), DATE_FORMAT);

  const lastWeekday = value.match(/^last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/);
  if (lastWeekday?.[1]) {
    const target = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].indexOf(lastWeekday[1]);
    let cursor = addDays(today, -1);
    while (cursor.getDay() !== target) cursor = addDays(cursor, -1);
    return format(cursor, DATE_FORMAT);
  }

  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return value;

  const dayMonth = value.match(/^(\d{1,2})\s+([a-z]{3,9})(?:\s+(\d{4}))?$/);
  if (dayMonth?.[1] && dayMonth[2]) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.findIndex((m) => dayMonth[2]!.startsWith(m));
    if (month >= 0) {
      const year = dayMonth[3] ? Number(dayMonth[3]) : today.getFullYear();
      return format(new Date(Date.UTC(year, month, Number(dayMonth[1]))), DATE_FORMAT);
    }
  }

  return format(today, DATE_FORMAT);
}

export function periodRange(period: ReportPeriod, now = new Date()): { start: string | null; end: string | null; label: string } {
  const today = parseISO(localToday(now));
  if (period === "all") return { start: null, end: null, label: "All Expenses" };
  if (period === "week") {
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });
    return { start: format(start, DATE_FORMAT), end: format(end, DATE_FORMAT), label: `Week of ${format(start, DATE_FORMAT)}` };
  }
  if (period === "lastmonth") {
    const month = subMonths(today, 1);
    return {
      start: format(startOfMonth(month), DATE_FORMAT),
      end: format(endOfMonth(month), DATE_FORMAT),
      label: format(month, "MMMM yyyy")
    };
  }
  return {
    start: format(startOfMonth(today), DATE_FORMAT),
    end: format(endOfMonth(today), DATE_FORMAT),
    label: format(today, "MMMM yyyy")
  };
}
