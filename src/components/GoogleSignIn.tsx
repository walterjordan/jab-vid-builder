"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window { google?: any }
}

export default function GoogleSignIn() {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = "google-gis";
    if (!document.getElementById(id)) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.defer = true; s.id = id;
      s.onload = init;
      document.head.appendChild(s);
    } else {
      init();
    }

    function init() {
      if (!window.google || !divRef.current) return;
      window.google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(divRef.current, {
        theme: "outline", size: "large", shape: "pill", text: "signin_with",
      });
      // Optional One Tap:
      // window.google.accounts.id.prompt();
    }

    async function handleCredentialResponse(resp: { credential: string }) {
      const r = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: resp.credential }),
      });
      if (r.ok) window.location.href = "/";
      else console.error("Google sign-in failed");
    }
  }, []);

  return <div ref={divRef} />;
}
