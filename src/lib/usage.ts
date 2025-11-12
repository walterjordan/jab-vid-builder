import fs from "node:fs";
import path from "node:path";
import { Firestore } from "@google-cloud/firestore";

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const creds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

// Use Firestore only when credentials + project ID are available
const useFirestore = !!(projectId && creds);

let db: Firestore | null = null;
if (useFirestore) {
  try {
    db = new Firestore({ projectId });
    console.log("✅ Firestore initialized for project:", projectId);
  } catch (err) {
    console.warn("⚠️ Firestore init failed, falling back to local mode:", err);
  }
} else {
  console.warn("⚠️ Firestore not configured, using local usage tracker.");
}

// Local fallback directory for dev
const LOCAL_DIR = path.join(process.cwd(), ".local-quota");
if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Tracks daily quota per user.
 * @param userId - Unique user ID
 * @param limit - Max allowed actions per day
 */
export async function consumeDailyQuota(
  userId: string,
  limit = 3
): Promise<{ ok: true; remaining: number } | { ok: false; remaining: 0 }> {
  const day = todayKey();
  const docId = `${userId}_${day}`;

  // --- Firestore path ---
  if (useFirestore && db) {
    const ref = db.collection("usage").doc(docId);
    try {
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const curr = (snap.exists ? (snap.data()?.count as number) : 0) || 0;

        if (curr >= limit) {
          return { ok: false as const, remaining: 0 as const };
        }

        const next = curr + 1;
        tx.set(ref, { count: next, updatedAt: Date.now() }, { merge: true });
        return { ok: true as const, remaining: (limit - next) as number };
      });
      return result;
    } catch (err) {
      console.error("⚠️ Firestore quota update failed, switching to local mode:", err);
    }
  }

  // --- Local fallback path ---
  const file = path.join(LOCAL_DIR, `${userId}_${day}.json`);
  let used = 0;
  if (fs.existsSync(file)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      used = data.count ?? 0;
    } catch (e) {
      console.warn("Failed to read local quota file:", e);
    }
  }

  if (used >= limit) {
    return { ok: false, remaining: 0 };
  }

  const next = used + 1;
  fs.writeFileSync(file, JSON.stringify({ count: next, updatedAt: Date.now() }));
  return { ok: true, remaining: limit - next };
}

