/**
 * Minimal RFC4180 CSV writer for the Meta catalog feed.
 *
 * Meta rejects a whole row on a malformed field, and VMG descriptions routinely
 * contain commas, quotes and newlines (the sample car's description has five
 * line breaks), so the escaping here is doing real work rather than being
 * defensive decoration.
 */

/** Quote a single field only when it actually needs it. */
function escapeField(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Serialise rows to CSV against a fixed column order.
 * A key missing from a row renders as an empty field, never "undefined".
 */
export function toCsv(columns: string[], rows: Record<string, string>[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeField(row[col] ?? "")).join(","));
  }
  return lines.join("\n");
}
