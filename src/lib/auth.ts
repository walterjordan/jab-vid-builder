import { cookies } from "next/headers";

export type SessionUser = { sub: string; email?: string; name?: string } | null;

export function getUserFromCookie(): SessionUser {
  const raw = cookies().get("jb_session")?.value;
  if (!raw) return null;
  try {
    const u = JSON.parse(raw);
    if (!u?.sub) return null;
    return { sub: String(u.sub), email: u.email, name: u.name };
  } catch {
    return null;
  }
}
