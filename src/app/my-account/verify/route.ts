import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { createSession } from "@/lib/auth/session";
import { consumeUserToken } from "@/lib/auth/tokens";
import { sendTemplate } from "@/lib/email/send";
import { absoluteUrl, ROUTES } from "@/lib/site";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const userId = await consumeUserToken(token, "verify_email");
  if (!userId) return NextResponse.redirect(absoluteUrl(`${ROUTES.account}?verify=invalid`));

  const [user] = await getDb()
    .update(schema.users)
    .set({ emailVerifiedAt: sql`coalesce(${schema.users.emailVerifiedAt}, now())`, updatedAt: new Date() })
    .where(eq(schema.users.id, userId))
    .returning();
  await sendTemplate("welcome", user.email, { name: user.displayName, post_url: absoluteUrl(ROUTES.post) });
  await createSession(user.id, false);
  return NextResponse.redirect(absoluteUrl(`${ROUTES.account}?verified=1`));
}
