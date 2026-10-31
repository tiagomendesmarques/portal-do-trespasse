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
    // min-w-0 + truncate: em ecrãs estreitos o nome encolhe em vez de empurrar os botões para fora do ecrã.
    <Link href="/" className={`flex min-w-0 items-center gap-2 whitespace-nowrap no-underline sm:gap-2.5 ${light ? "text-white" : "text-ink"}`} aria-label="Portal do Trespasse, início">
      <span className="shrink-0"><LogoMark /></span>
      <span className="min-w-0 truncate font-display text-base font-extrabold leading-none tracking-tight sm:text-lg">
        Portal do Trespasse
        <small className={`mt-0.5 hidden truncate font-sans text-[11px] font-normal tracking-normal min-[400px]:block ${light ? "text-white/70" : "text-muted"}`}>Onde os negócios vão e vêm</small>
      </span>
    </Link>
  );
}
