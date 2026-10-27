import { timingSafeEqual } from "node:crypto";
import { runDailyJobs } from "@/lib/jobs/daily";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("x-cron-secret") ?? "";
  if (!secret || secret.length < 16) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Chamado uma vez por dia pelo Cloud Scheduler (POST com o cabeçalho X-Cron-Secret). */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ ok: false }, { status: 401 });
  const report = await runDailyJobs();
  return Response.json({ ok: report.errors.length === 0, ...report }, { status: report.errors.length ? 500 : 200 });
}
