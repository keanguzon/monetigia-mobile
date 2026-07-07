export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);
}

export function toLocalISOWithOffset(d: Date): string {
  const offset = -d.getTimezoneOffset();
  const absOffset = Math.abs(offset);
  const sign = offset >= 0 ? '+' : '-';
  const pad = (num: number) => String(Math.floor(num)).padStart(2, '0');

  const hoursOffset = pad(Math.floor(absOffset / 60));
  const minsOffset = pad(absOffset % 60);
  const tzString = `${sign}${hoursOffset}:${minsOffset}`;

  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const dayVal = pad(d.getDate());
  const h = pad(d.getHours());
  const min = pad(d.getMinutes());
  const s = pad(d.getSeconds());

  return `${y}-${m}-${dayVal}T${h}:${min}:${s}${tzString}`;
}

export function getInitials(name: string): string {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);
}

export function parseNonNegativeAmount(value: string | number): number | null {
  const parsed = typeof value === "string" ? parseFloat(value.replace(/,/g, "")) : Number(value);
  if (isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) return null;
  return Number(parsed.toFixed(2));
}

export function sanitizeColor(color: string): string {
  if (!color || typeof color !== "string") return "#10b981";
  const hexPattern = /^#[0-9A-Fa-f]{6}$/;
  if (hexPattern.test(color)) return color.toLowerCase();
  return "#10b981";
}
