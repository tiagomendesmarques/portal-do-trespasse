import "server-only";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth/session";

/** Administradores e editores. Quem não é da equipa vê um 404 (não revela que o back-office existe). */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/my-account/?next=/admin/");
  if (user.role !== "admin" && user.role !== "editor") notFound();
  return user;
}

/** Só administradores: utilizadores, definições, emails, campos, categorias, redirects, auditoria. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireStaff();
  if (user.role !== "admin") notFound();
  return user;
}

export const isAdmin = (u: { role: string }) => u.role === "admin";
