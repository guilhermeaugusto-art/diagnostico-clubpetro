export function escHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (matches RFC-4122 v4 shape)
  const tpl = "10000000-1000-4000-8000-100000000000";
  return tpl.replace(/[018]/g, (c: string) => {
    const n = Number(c);
    const r = crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (n / 4));
    return (n ^ r).toString(16);
  });
}

export function maskPhone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
  if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
  return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
}

export function phoneDigitsOnly(v: string): string {
  return (v || "").replace(/\D/g, "");
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
