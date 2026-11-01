import type { SeoReport } from "@/lib/blog/seo";

/** Pontuação SEO de um artigo, com o que falta corrigir. */
export function SeoPanel({ report }: { report: SeoReport }) {
  const tone = report.errors.length ? "text-danger" : report.score >= 80 ? "text-ok" : report.score >= 60 ? "text-warn" : "text-danger";
  return (
    <section className="panel flex flex-col gap-2 text-sm" aria-label="SEO">
      <div className="flex items-baseline justify-between">
        <h2 className="font-sans text-base font-bold">SEO</h2>
        <span className={`font-display text-2xl font-extrabold tabular-nums ${tone}`} data-testid="seo-score">{report.score}<span className="text-sm text-muted">/100</span></span>
      </div>
      <p className="text-muted">{report.stats.words} palavras · {report.stats.h2} intertítulos · {report.stats.internalLinks} ligações internas · {report.stats.externalLinks} externas · {report.stats.faq} perguntas</p>
      {report.errors.length > 0 && <ul className="list-disc pl-5 text-danger">{report.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {report.warnings.length > 0 && <ul className="list-disc pl-5 text-muted">{report.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      {!report.errors.length && !report.warnings.length && <p className="text-ok">Tudo certo.</p>}
    </section>
  );
}
