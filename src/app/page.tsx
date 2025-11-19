// src/app/page.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import type { CSSProperties } from "react";
import GoogleSignIn from "../components/GoogleSignIn";
import UserMenu from "../components/UserMenu";

/* --- helper: poll operation until done or timeout --- */
async function pollOperation(
  opName: string,
  opts?: { intervalMs?: number; timeoutMs?: number }
) {
  const intervalMs = opts?.intervalMs ?? 4000;
  const timeoutMs = opts?.timeoutMs ?? 240000; // 4 min cap
  const start = Date.now();

  while (true) {
    const r = await fetch(`/api/generate?name=${encodeURIComponent(opName)}`);
    const j = await r.json();

    // expected shape:
    // { name, done: boolean, response: { generateVideoResponse: { generatedSamples: [ { video: { uri } } ] } } }
    if (j?.done) {
      const uri =
        j?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
      return { done: true, uri, raw: j };
    }

    if (Date.now() - start > timeoutMs) {
      return { done: false, uri: undefined, raw: j, timeout: true };
    }

    await new Promise((res) => setTimeout(res, intervalMs));
  }
}

type ModelOption = {
  value: string;
  label: string;
  note: string;
};

const MODELS: ModelOption[] = [
  { value: "veo-3.1-fast-generate-preview", label: "Veo 3.1 • Fast (preview)", note: "Cheaper per second than 3.1 standard; preview limits may apply." },
  { value: "veo-3.1-generate-preview", label: "Veo 3.1 • Standard (preview)", note: "Higher quality with audio; preview limits may apply." },
  { value: "veo-3.0-fast-generate-001", label: "Veo 3 • Fast", note: "Lower cost per second; good for quick concepting." },
  { value: "veo-3.0-generate-001", label: "Veo 3 • Standard", note: "Stable standard model with audio." },
  { value: "veo-2.0-generate-001", label: "Veo 2", note: "Older but sometimes less rate-limited." },
];

const BG = "#010e63";
const JAB_GREEN = "#7FFF41";
const CARD = "#0f0f14";
const CARD_BORDER = "rgba(255,255,255,0.07)";
const TEXT_MAIN = "#ffffff";
const TEXT_DIM = "rgba(255,255,255,0.8)";
const INPUT_BG = "#0c0c12";
const INPUT_BORDER = "rgba(255,255,255,0.12)";
const ACCENT = "#630183";

type Result = { uri: string; name: string };

export default function Home() {
  const [prompt, setPrompt] = useState(
    "A futuristic workspace glowing with neon accents. Diverse creators brainstorm around holographic screens and sleek laptops. One of them is tall with an athletic build with expressive eyes and an easy, confident smile. Her skin is a warm brown and her demeanor strikes a balance between soft and sharp intelligence. She turns and says Don't chase. Attract what's meant for you and let your energy be contagious."
  );
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState("720p");
  const [duration, setDuration] = useState(6);
  // Default model -> Veo 3.0 Fast (cheap/permissive)
  const [model, setModel] = useState("veo-3.0-fast-generate-001");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
   // Track user login session
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        if (r.ok) {
          const u = await r.json();
          setUser(u);
        }
      } catch (err) {
        console.error("Failed to check session", err);
      }
    })();
  }, []);

  const modelNote = useMemo(
    () => MODELS.find((m) => m.value === model)?.note ?? "",
    [model]
  );

  async function handleGenerate() {
    setBusy(true);
    setError("");
    setResult(null);

    try {
      // Rule: 1080p typically requires 8s
      if (resolution === "1080p" && duration < 8) {
        setError("1080p requires 8s. Increase duration to 8s or switch to 720p.");
        return;
      }

      // ⬇️ Build FormData so we can send prompt + options + attached files
const fd = new FormData();
fd.append("prompt", prompt ?? "");
fd.append("aspectRatio", aspectRatio ?? "");
fd.append("resolution", resolution ?? "");
fd.append("durationSeconds", String(duration ?? ""));
fd.append("model", model ?? "");

// 👇 assumes you have an array of File objects called `files`
// (e.g. from <input type="file" multiple onChange={e => setFiles([...e.target.files])}>)
if (Array.isArray(files)) {
  for (const file of files) {
    fd.append("files", file);
  }
}

const res = await fetch("/api/generate", {
  method: "POST",
  // ❌ remove JSON headers – the browser will set multipart boundaries for us
  body: fd,
});

const data = await res.json();
if (!res.ok) {
  throw new Error(data?.error || "Server error while starting generation.");
}

      const opName: string | undefined =
        data?.operationName || data?.name || data?.operation?.name;
      if (!opName) {
        throw new Error("No operation name returned by API.");
      }

      const polled = await pollOperation(opName, { intervalMs: 3000, timeoutMs: 240000 });
      if (!polled.done) throw new Error("Generation timed out. Try again or lower resolution/duration.");
      if (!polled.uri) throw new Error("Operation finished but no video URI was returned.");

      // Friendly filename like: veo_YYYYMMDD_HHMMSS.mp4
      const ts = new Date();
      const stamp =
        ts.getFullYear().toString() +
        String(ts.getMonth() + 1).padStart(2, "0") +
        String(ts.getDate()).padStart(2, "0") +
        "_" +
        String(ts.getHours()).padStart(2, "0") +
        String(ts.getMinutes()).padStart(2, "0") +
        String(ts.getSeconds()).padStart(2, "0");

      const fileName = `veo_${stamp}.mp4`;
      setResult({ uri: polled.uri, name: fileName });

      // ⭐ Save to local history for /history page
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem("veoHistory");
          const prev = raw ? JSON.parse(raw) : [];
          const entry = {
            uri: polled.uri,
            name: fileName,
            prompt,
            model,
            createdAt: ts.toISOString(),
          };
          const next = [entry, ...prev].slice(0, 50); // keep last 50
          window.localStorage.setItem("veoHistory", JSON.stringify(next));
        } catch (err) {
          console.error("Failed to save history", err);
        }
      }
    } catch (e: any) {
      setError(
        e?.message?.includes("429")
          ? "Rate limit / quota hit for this model. Try a different Veo model or wait."
          : e?.message || "Failed to generate video."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: BG, color: TEXT_MAIN }}>

      {/* Card */}
      <div style={{ maxWidth: 1120, margin: "22px auto", padding: "0 20px" }}>
        <div style={{ background: CARD, border: `1px solid ${CARD_BORDER}`, borderRadius: 16, boxShadow: "0 12px 32px rgba(0,0,0,0.35)", overflow: "hidden" }}>
          <div style={{ padding: "22px 22px 0", borderBottom: `2px solid ${ACCENT}` }}>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 16,
      flexWrap: "wrap",
    }}
  >
    <div>
      <h1 style={{ margin: 0, fontSize: 36, fontWeight: 800 }}>AI Video Builder</h1>
      <p style={{ marginTop: 8, color: TEXT_DIM }}>
        Generate short, high-quality video with synchronized audio. Edit the prompt below to test your own video concept.
      </p>
    </div>

    {/* Sign in with Google button <GoogleSignIn />
    <UserMenu /> */}
    
  </div>
</div>


          <div style={{ padding: 22 }}>
            {/* Prompt */}
            <label style={{ display: "block", marginBottom: 8, opacity: 0.9 }}>Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={7}
              style={{
                width: "100%",
                background: INPUT_BG,
                color: TEXT_MAIN,
                border: `1px solid ${INPUT_BORDER}`,
                borderRadius: 10,
                padding: 14,
                outline: "none",
              }}
            />

            {/* Row 1: Aspect, Resolution, Seed */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 18 }}>
              <div>
                <label style={{ display: "block", marginBottom: 8, opacity: 0.9 }}>Aspect Ratio</label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} style={selectStyle()}>
                  <option value="16:9">16:9 (YouTube/X)</option>
                  <option value="9:16">9:16 (Reels/Shorts)</option>
                  <option value="1:1">1:1 (Square)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, opacity: 0.9 }}>Resolution</label>
                <select value={resolution} onChange={(e) => setResolution(e.target.value)} style={selectStyle()}>
                  <option value="720p">720p (fastest)</option>
                  <option value="1080p">1080p (best)</option>
                </select>
                <small style={{ color: TEXT_DIM }}>720p works for any 4–8s. 1080p often needs 8s.</small>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, opacity: 0.9 }}>Seed (currently ignored)</label>
                <input
                  disabled
                  placeholder="N/A — ignored by Veo API"
                  style={{ ...inputStyle(), opacity: 0.5, cursor: "not-allowed" }}
                />
                <small style={{ color: TEXT_DIM }}>Note: Veo video generation currently ignores the seed parameter.</small>
              </div>
            </div>

            {/* Row 2: Model + Duration */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, marginTop: 18 }}>
              <div>
                <label style={{ display: "block", marginBottom: 8, opacity: 0.9 }}>Model</label>
                <select value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle()}>
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <small style={{ color: TEXT_DIM }}>{modelNote}</small>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, opacity: 0.9 }}>Duration: {duration}s (drag 4–8s)</label>
                <input
                  type="range"
                  min={4}
                  max={8}
                  step={1}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  style={{ width: "100%" }}
                />
              </div>
            </div>
 {/* Reference media upload */}
            <div style={{ marginTop: 18 }}>
              <label
                style={{ display: "block", marginBottom: 8, opacity: 0.9 }}
              >
                Reference images / base video (optional)
              </label>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) =>
                  setFiles(Array.from(e.target.files ?? []))
                }
                style={{
                  width: "100%",
                  color: TEXT_MAIN,
                }}
              />
              <small style={{ color: TEXT_DIM }}>
                Attach up to 3 images or one short video to guide Veo 3.1.
              </small>
            </div>
            {/* Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
              <button
  disabled={busy || !user}
  onClick={user ? handleGenerate : undefined}
  style={{
    background: user ? JAB_GREEN : "gray",
    color: "#0b0b0b",
    fontWeight: 700,
    border: "none",
    borderRadius: 8,
    padding: "12px 18px",
    cursor: busy || !user ? "not-allowed" : "pointer",
    opacity: user ? 1 : 0.6,
  }}
  title={!user ? "Sign in to generate videos" : ""}
>
  {!user ? "Sign in to Generate" : busy ? "Generating…" : "Generate Video"}
</button>


              {result?.uri && (
                <a
                  href={`/api/download?uri=${encodeURIComponent(result.uri)}&name=${encodeURIComponent(result.name)}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: TEXT_MAIN, textDecoration: "underline", opacity: 0.9 }}
                >
                  Open / Download result
                </a>
              )}
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  background: "rgba(255,0,0,0.08)",
                  border: "1px solid rgba(255,0,0,0.25)",
                  borderRadius: 8,
                  color: TEXT_MAIN,
                }}
              >
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function inputStyle(): CSSProperties {
  return {
    width: "100%",
    background: INPUT_BG,
    color: TEXT_MAIN,
    border: `1px solid ${INPUT_BORDER}`,
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
  };
}

function selectStyle(): CSSProperties {
  return {
    width: "100%",
    background: INPUT_BG,
    color: TEXT_MAIN,
    border: `1px solid ${INPUT_BORDER}`,
    borderRadius: 10,
    padding: "10px 12px",
    outline: "none",
    appearance: "none",
  };
}
