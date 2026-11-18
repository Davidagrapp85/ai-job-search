// Códec CSV RFC 4180 mínimo: UTF-8, fin de línea \n, comillas solo cuando hacen falta.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function quote(f: string): string {
  return /[",\n\r]/.test(f) ? `"${f.replace(/"/g, '""')}"` : f;
}

export function stringifyCsv(rows: string[][]): string {
  return rows.map((r) => r.map(quote).join(",")).join("\n") + "\n";
}
