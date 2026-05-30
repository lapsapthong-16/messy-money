import { describe, expect, it } from "vitest";
import { periodRange, resolveDate } from "../src/dates";

const NOW = new Date("2026-05-30T04:00:00.000Z");

describe("date resolution", () => {
  it("defaults missing dates to today in Asia/Kuala_Lumpur", () => {
    expect(resolveDate(undefined, NOW)).toBe("2026-05-30");
  });

  it("resolves relative and backdated dates", () => {
    expect(resolveDate("yesterday", NOW)).toBe("2026-05-29");
    expect(resolveDate("2 days ago", NOW)).toBe("2026-05-28");
    expect(resolveDate("last monday", NOW)).toBe("2026-05-25");
    expect(resolveDate("23 may", NOW)).toBe("2026-05-23");
  });

  it("builds report periods", () => {
    expect(periodRange("week", NOW)).toMatchObject({ start: "2026-05-25", end: "2026-05-31" });
    expect(periodRange("month", NOW)).toMatchObject({ start: "2026-05-01", end: "2026-05-31" });
    expect(periodRange("lastmonth", NOW)).toMatchObject({ start: "2026-04-01", end: "2026-04-30" });
    expect(periodRange("all", NOW)).toMatchObject({ start: null, end: null });
  });
});
