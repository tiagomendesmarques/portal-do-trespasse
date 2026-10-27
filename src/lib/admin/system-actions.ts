"use server";

import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/admin/guard";
import { runDailyJobs } from "@/lib/jobs/daily";

/** Correr as tarefas diárias à mão (normalmente corre sozinho, via Cloud Scheduler). */
export async function runDailyJobsAction() {
  const admin = await requireAdmin();
  await getDb().insert(schema.auditLog).values({ actorId: admin.id, action: "cron.manual", entity: "system", entityId: "daily" });
  await runDailyJobs();
  revalidatePath("/admin/", "layout");
}
