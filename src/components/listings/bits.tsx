import { formatPrice } from "@/lib/format";

/** Cores de fundo por categoria, para cartões sem fotografia (mesmas do protótipo). */
export const CATEGORY_HUE: Record<string, string> = {
  agricultura: "#b9dc9a", "construcao-civil": "#f2c58a", educacao: "#b8c8f5", energia: "#f6e08a", "financas-e-seguros": "#a9dcc0",
  imobiliario: "#d7c0ec", "industria-alimentar": "#f5b8a3", logistica: "#c5d2d8", media: "#f4b7cf", restauracao: "#f6c8a0",
  saude: "#a6dbe6", "servicos-setores-diversos": "#89d3cd", "turismo-e-hotelaria": "#9fd1f4",
};

export function initials(name: string) {
  const w = name.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "PT";
}

export function Price({ price, priceType, priceUnit, size = "md" }: { price: number | null; priceType: string; priceUnit: string | null; size?: "md" | "lg" }) {
  const p = formatPrice(price, priceType, priceUnit);
  return (
    <span className="whitespace-nowrap">
      <span data-price={price ?? ""} className={`font-display font-extrabold tabular-nums tracking-tight ${size === "lg" ? "text-3xl" : "text-xl"}`}>{p.amount}</span>
      {p.note && <span className="ml-1.5 text-xs font-medium text-muted">{p.note}</span>}
    </span>
  );
}

export function Chip({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "warn" | "ok"; children: React.ReactNode }) {
  const cls = { neutral: "bg-surface-2 text-muted", accent: "bg-wash text-accent", warn: "bg-warn-wash text-warn", ok: "bg-ok-wash text-ok" }[tone];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{children}</span>;
}
