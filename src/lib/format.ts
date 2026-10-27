export function formatNumber(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

const UNIT: Record<string, string> = { total: "preço total", month: "por mês" };

export function formatPrice(price: number | null, priceType: string, unit: string | null): { amount: string; note: string | null } {
  if (priceType === "on_call" || price == null) return { amount: "Sob consulta", note: null };
  return { amount: `${formatNumber(price)} €`, note: unit ? UNIT[unit] ?? null : null };
}

const rtf = new Intl.RelativeTimeFormat("pt-PT", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]];

export function relativeTime(date: Date | null): string {
  if (!date) return "";
  const s = (Date.now() - date.getTime()) / 1000;
  for (const [unit, secs] of STEPS) if (s >= secs) return rtf.format(-Math.floor(s / secs), unit);
  return "agora mesmo";
}

export function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Lisbon" }) : "";
}
