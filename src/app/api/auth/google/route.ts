import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client, TokenPayload } from "google-auth-library";

const client = new OAuth2Client(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);

export async function POST(req: NextRequest) {
  try {
    const { credential } = await req.json();
    if (!credential) return NextResponse.json({ error: "Missing credential" }, { status: 400 });

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() as TokenPayload | undefined;
    if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

    const { sub, email, name, picture } = payload;

    // TODO: upsert user in DB here if you’re storing users

    const res = NextResponse.json({ ok: true });
    res.cookies.set("jb_session", JSON.stringify({ sub, email, name, picture }), {
      httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
  }
}
