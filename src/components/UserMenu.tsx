// src/components/UserMenu.tsx
"use client";

import { useEffect, useState, useMemo } from "react";

type User = { name?: string; email?: string; picture?: string } | null;

export default function UserMenu() {
  const [user, setUser] = useState<User>(null);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        if (!ignore && r.ok) setUser(await r.json());
      } catch {}
    })();
    return () => { ignore = true; };
  }, []);

  const initials = useMemo(() => {
    const source = user?.name || user?.email || "";
    const parts = source.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1 && parts[0]) return parts[0][0]!.toUpperCase();
    return "?";
  }, [user]);

  if (!user) return null;

  const avatarSize = 28;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Avatar: try image; fall back to initials bubble */}
      {user.picture && imgOk ? (
        <img
          src={user.picture}
          alt=""
          width={avatarSize}
          height={avatarSize}
          style={{ borderRadius: 999, display: "block" }}
          referrerPolicy="no-referrer"       // ← fix for Google-hosted images
          onError={() => setImgOk(false)}     // ← switch to fallback on error
        />
      ) : (
        <div
          aria-hidden
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            fontWeight: 700,
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          {initials}
        </div>
      )}

      <span style={{ fontSize: 14 }}>{user.name ?? user.email}</span>

      <button
        onClick={logout}
        style={{ border: "1px solid #ccc", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}
      >
        Logout
      </button>
    </div>
  );
}

