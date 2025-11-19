"use client";

import { useEffect, useState } from "react";

type HistoryItem = {
  uri: string;
  name: string;
  prompt: string;
  model: string;
  createdAt: string; // ISO string
};

const BG = "#010e63";
const CARD = "#0f0f14";
const CARD_BORDER = "rgba(255,255,255,0.07)";
const TEXT_MAIN = "#ffffff";
const TEXT_DIM = "rgba(255,255,255,0.8)";
const ACCENT = "#630183";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("veoHistory");
      if (!raw) return;
      const parsed = JSON.parse(raw) as HistoryItem[];
      setItems(parsed);
    } catch (err) {
      console.error("Failed to load history", err);
    }
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT_MAIN,
        padding: "24px 16px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            marginBottom: 24,
            borderBottom: `2px solid ${ACCENT}`,
            paddingBottom: 12,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800 }}>
            Video History
          </h1>
          <p style={{ marginTop: 8, color: TEXT_DIM }}>
            These are Veo videos saved from this browser. New generations will
            show up here automatically.
          </p>
          <p style={{ marginTop: 4, color: TEXT_DIM, fontSize: 12 }}>
            Past videos not in this list can still be recovered using operation
            IDs and the <code>/api/fetch-video</code> endpoint.
          </p>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              background: CARD,
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 12,
              padding: 16,
            }}
          >
            <p style={{ margin: 0, color: TEXT_DIM }}>
              No history yet. Generate a video on the main page and it will be
              saved here.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {items.map((item, idx) => (
              <div
                key={`${item.uri}-${idx}`}
                style={{
                  background: CARD,
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {/* Video preview */}
                <video
                  src={item.uri}
                  controls
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    maxHeight: 260,
                    objectFit: "cover",
                  }}
                />

                {/* Meta */}
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <strong
                      style={{
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </strong>
                    <span
                      style={{
                        fontSize: 11,
                        color: TEXT_DIM,
                        border: `1px solid ${ACCENT}`,
                        borderRadius: 999,
                        padding: "2px 8px",
                      }}
                    >
                      {item.model || "Veo"}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: 11, color: TEXT_DIM, marginBottom: 4 }}
                  >
                    {new Date(item.createdAt).toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: TEXT_DIM,
                      maxHeight: 64,
                      overflow: "hidden",
                    }}
                  >
                    {item.prompt}
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    marginTop: "auto",
                  }}
                >
                  <a
                    href={item.uri}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      flex: 1,
                      textAlign: "center",
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: "none",
                      background: ACCENT,
                      color: "#ffffff",
                      borderRadius: 999,
                      padding: "6px 10px",
                    }}
                  >
                    Open / Download
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        typeof navigator !== "undefined" &&
                        navigator.clipboard
                      ) {
                        navigator.clipboard
                          .writeText(item.uri)
                          .catch(() => {});
                      }
                    }}
                    style={{
                      fontSize: 12,
                      background: "transparent",
                      borderRadius: 999,
                      border: `1px solid ${CARD_BORDER}`,
                      color: TEXT_DIM,
                      padding: "6px 10px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Copy link
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
