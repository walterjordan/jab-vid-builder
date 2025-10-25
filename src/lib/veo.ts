import { GoogleGenAI } from "@google/genai";

export const getGenAI = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set. Add it to .env.local");
  return new GoogleGenAI({ apiKey: key });
};

export const FALL_PROMPT = `Watch a dull kitchen turn into a picture-perfect space in just one day with WOW 1 DAY PAINTING. This high-energy 45s before & after showcases expert cabinet painting, precision prep by our Emerald Shirt senior-pro team, and zero‑VOC finishes for healthier indoor air. Fast-motion transformation, clean lines, updated hardware and minimal disruption — no mess, no stress, just WOW.`;

export type VeoRequest = {
  aspectRatio?: "16:9" | "9:16";
  resolution?: "720p" | "1080p";
  seed?: number;
  prompt?: string;
};

export async function generateVeoVideo(opts: VeoRequest): Promise<{ uri: string }>{
  const { aspectRatio = "16:9", resolution = "720p", seed, prompt } = opts || {};
  const ai: any = getGenAI();

  // Start long‑running Veo 3 generation
  let operation: any = await ai.models.generateVideos({
    model: "veo-3.0-generate-001",
    prompt: prompt ?? FALL_PROMPT,
    config: {
      aspectRatio,
      resolution,
      ...(typeof seed === "number" ? { seed } : {}),
      personGeneration: "allow_all",
      negativePrompt: "cartoon, drawing, low quality, watermark, text overlay"
    }
  });

  // Poll until done
  while (!operation.done) {
    await new Promise((r) => setTimeout(r, 10_000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const uri: string | undefined = operation?.response?.generatedVideos?.[0]?.video?.uri;
  if (!uri) throw new Error("No video URI returned from Veo operation.");
  return { uri };
}