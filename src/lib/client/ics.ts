/**
 * Calendar reminders as a standard iCalendar file, so check-ins land in
 * whatever calendar the person already uses. No push service or account needed.
 */

function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines longer than 75 octets, as RFC 5545 requires. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) parts.push((i ? " " : "") + line.slice(i, i + 74));
  return parts.join("\r\n");
}

export interface ReminderInput {
  uid: string;
  productName: string;
  firstCheckIn: Date;
  cadenceDays: number;
  count: number;
  url: string;
  place?: string;
}

export function checkInCalendar(input: ReminderInput, now = new Date()): string {
  const start = new Date(input.firstCheckIn);
  const end = new Date(start.getTime() + 15 * 60_000);
  const description = [
    `Weekly Verdict check-in for ${input.productName}.`,
    input.place ? `Same spot as your first photo: ${input.place}.` : "Same spot and light as your first photo.",
    "Bare skin, hair back, no glasses.",
    input.url,
  ].join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Verdict//Skincare trial//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.uid}@verdict`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `RRULE:FREQ=DAILY;INTERVAL=${input.cadenceDays};COUNT=${input.count}`,
    `SUMMARY:${escapeText(`Verdict check-in: ${input.productName}`)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${input.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT0M",
    `DESCRIPTION:${escapeText("Time for your Verdict check-in photo")}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
