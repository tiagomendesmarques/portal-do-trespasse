import Link from "next/link";

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="8" fill="#89d3cd" />
      <path d="M8 13h15l-4-4M26 21H11l4 4" fill="none" stroke="#0c1e3a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 whitespace-nowrap no-underline ${light ? "text-white" : "text-ink"}`} aria-label="Portal do Trespasse, início">
      <LogoMark />
      <span className="font-display text-lg font-extrabold leading-none tracking-tight">
        Portal do Trespasse
        <small className={`mt-0.5 block font-sans text-[11px] font-normal tracking-normal ${light ? "text-white/70" : "text-muted"}`}>Onde os negócios vão e vêm</small>
      </span>
    </Link>
  );
}
