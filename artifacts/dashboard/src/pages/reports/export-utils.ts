export interface ExportRow {
  [key: string]: string | number;
}

/** Download a CSV file. Pass excelMode=true to add BOM for Excel Arabic support. */
export function downloadCSV(rows: ExportRow[], filename: string, excelMode = false): void {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.map(escape).join(","),
    ...rows.map(r => headers.map(h => escape(r[h] ?? "")).join(",")),
  ];
  const bom   = excelMode ? "\uFEFF" : "";
  const blob  = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url   = URL.createObjectURL(blob);
  const link  = document.createElement("a");
  link.href   = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printSection(id: string): void {
  window.print();
}
