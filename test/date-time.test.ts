import { describe, it, expect } from "vitest";
import { formatDate, formatDateTime, parseDateTime } from "@/form/dateTime.js";

describe("xsd:dateTime lexical forms", () => {
  it.each([
    ["2026-09-30T14:30:00", { date: "2026-09-30", time: "14:30:00", zone: "" }],
    ["2026-09-30T14:30:00Z", { date: "2026-09-30", time: "14:30:00", zone: "Z" }],
    ["2026-03-14T18:30:00+02:00", { date: "2026-03-14", time: "18:30:00", zone: "+02:00" }],
    ["2026-03-14T18:30:00.125-05:00", { date: "2026-03-14", time: "18:30:00.125", zone: "-05:00" }],
  ])("round-trips %s", (lexical, parts) => {
    expect(parseDateTime(lexical)).toEqual(parts);
    expect(formatDateTime(parts)).toBe(lexical);
  });

  it("completes what a control gives to a valid dateTime", () => {
    expect(formatDateTime({ date: "2026-09-30", time: "14:30", zone: "" })).toBe("2026-09-30T14:30:00");
    expect(formatDateTime({ date: "2026-09-30", time: "", zone: "" })).toBe("2026-09-30T00:00:00");
    expect(formatDateTime({ date: "2026-09-30", time: "", zone: "Z" })).toBe("2026-09-30T00:00:00Z");
  });

  it("reads a date alone, with or without the zone XSD allows on it", () => {
    expect(parseDateTime("2026-09-30")).toEqual({ date: "2026-09-30", time: "", zone: "" });
    expect(parseDateTime("2026-09-30Z")).toEqual({ date: "2026-09-30", time: "", zone: "Z" });
    expect(formatDate(parseDateTime("2026-03-14+02:00")!)).toBe("2026-03-14+02:00");
  });

  it("reads the truncated value an earlier control wrote, so it can be corrected", () => {
    expect(formatDateTime(parseDateTime("2026-09-30T14:30")!)).toBe("2026-09-30T14:30:00");
  });

  it.each(["", "garbage", "30/09/2026", "2026-09-30T", "2026-09-30T25", "2026-9-30"])("is null for %j", (lexical) => {
    expect(parseDateTime(lexical)).toBeNull();
  });
});
