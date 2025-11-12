// src/app/api/auth/session/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const raw = cookies().get("jb_session")?.value;
  if (!raw) return NextResponse.json(null);
  try {
    const u = JSON.parse(raw);
    // only return safe fields
    return NextResponse.json({ name: u.name, email: u.email, picture: u.picture });
  } catch {
    return NextResponse.json(null);
  }
}
