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
