/**
 * The lexical forms of `xsd:date` and `xsd:dateTime`, as the parts a control edits.
 *
 * A control gives a date and a time; RDF wants one string that is a valid lexical
 * form of the datatype the shape declares. `xsd:dateTime` is `YYYY-MM-DDThh:mm:ss`
 * with optional fractional seconds and an optional zone — and the seconds are not
 * optional, so `2026-09-30T14:30` is not a dateTime and fails `sh:datatype`. A zone
 * (`Z`, `±hh:mm`) is part of the value, so it is kept exactly as stored: dropping it
 * would change which instant the literal names. `xsd:date` may carry one too.
 */

/** A stored `xsd:date` or `xsd:dateTime`, split the way a date control edits it. */
export interface DateTimeParts {
  /** `YYYY-MM-DD`, or empty. */
  date: string;
  /** `hh:mm`, `hh:mm:ss` or `hh:mm:ss.fff` as stored, or empty for a date alone. */
  time: string;
  /** `Z`, `±hh:mm`, or empty for none. */
  zone: string;
}

const LEXICAL = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?))?(Z|[+-]\d{2}:\d{2})?$/;

/** Split a stored `xsd:date` / `xsd:dateTime` lexical form, or `null` when it is
 *  neither (a value a control cannot edit and must leave empty rather than guess). */
export function parseDateTime(lexical: string): DateTimeParts | null {
  const m = LEXICAL.exec(lexical.trim());
  return m ? { date: m[1], time: m[2] ?? "", zone: m[3] ?? "" } : null;
}

/** The `xsd:dateTime` lexical form of the parts: seconds default to `:00`, a date
 *  with no time is completed to midnight, and the zone is kept as given. */
export function formatDateTime({ date, time, zone }: DateTimeParts): string {
  const clock = time || "00:00";
  return `${date}T${clock.length === 5 ? `${clock}:00` : clock}${zone}`;
}

/** The `xsd:date` lexical form of the parts; a time, if any, is not part of it. */
export function formatDate({ date, zone }: DateTimeParts): string {
  return `${date}${zone}`;
}
