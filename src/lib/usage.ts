import { Firestore } from "@google-cloud/firestore";

// Initialize once per instance
const db = new Firestore();

// Collection: usage
// Doc path: usage/{userId}_{YYYY-MM-DD}
// Fields: { count: number, updatedAt: number }
export async function consumeDailyQuota(
  userId: string,
  limit = 3
): Promise<{ ok: true; remaining: number } | { ok: false; remaining: 0 }> {
  const day = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
  const docId = `${userId}_${day}`;
  const ref = db.collection("usage").doc(docId);

  // Atomic transaction to avoid race conditions if user clicks fast
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
}
