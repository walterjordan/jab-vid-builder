"use client";
import { useRef, useState } from "react";

export default function Page(){
  const [status,setStatus] = useState<string>("");
  const [downloading,setDownloading] = useState(false);
  const [videoUrl,setVideoUrl] = useState<string>("");
  const [prompt,setPrompt] = useState<string>(`Watch a dull kitchen turn into a picture-perfect space in just one day with WOW 1 DAY PAINTING. This high-energy 45s before & after showcases expert cabinet painting, precision prep by our Emerald Shirt senior-pro team, and zero‑VOC finishes for healthier indoor air. Fast-motion transformation, clean lines, updated hardware and minimal disruption — no mess, no stress, just WOW.`);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>){
    e.preventDefault();
    setVideoUrl("");
    setStatus("Starting Veo 3.1 job… this can take a little while.");

    const form = new FormData(e.currentTarget);
    const aspectRatio = form.get("aspectRatio") as string;
    const resolution = form.get("resolution") as string;
    const seedStr = form.get("seed") as string;
    const seed = seedStr ? Number(seedStr) : undefined;

    setDownloading(true);
    try{
      const res = await fetch("/api/generate",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ aspectRatio, resolution, seed, prompt })
      });
      if(!res.ok) throw new Error(`Server error ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setStatus("Done. Preview below — you can right‑click → Save video as…");
      setTimeout(()=> videoRef.current?.play().catch(()=>{}), 300);
    }catch(err:any){
      setStatus(`Error: ${err.message}`);
    }finally{
      setDownloading(false);
    }
  }

  return (
    <div className="row">
      <section className="card">
        <h1 className="h1">WOW • AI Ad Creator</h1>
        <p className="lead">Generate a short, high‑energy kitchen transformation ad with synchronized audio. Edit the prompt below to test your own ad concept.</p>
        <form className="controls" onSubmit={handleGenerate}>
          <div className="prompt-block" style={{flexBasis: "100%", width: "100%"}}>
  <div className="label">Prompt</div>
  <textarea
    name="prompt"
    rows={6}
    value={prompt}
    onChange={e => setPrompt(e.target.value)}
    className="input prompt-textarea"
    style={{width: "100%", minWidth: "100%", resize: "vertical"}}
  />
</div>

          <div>
            <div className="label">Aspect Ratio</div>
            <select className="select" name="aspectRatio" defaultValue="16:9">
              <option value="16:9">16:9 (YouTube/X)</option>
              <option value="9:16">9:16 (Reels/TikTok — 720p)</option>
            </select>
          </div>
          <div>
            <div className="label">Resolution</div>
            <select className="select" name="resolution" defaultValue="720p">
              <option value="720p">720p (fastest)</option>
              <option value="1080p">1080p (16:9 only)</option>
            </select>
          </div>
          <div>
            <div className="label">Seed (optional)</div>
            <input className="input" type="number" name="seed" placeholder="e.g. 42" />
          </div>
          <button className="btn btn-primary" disabled={downloading}>
            {downloading ? "Generating…" : "Generate Video"}
          </button>
        </form>
        <p style={{marginTop:12, opacity:.9}}>{status}</p>
      </section>

      {videoUrl && (
        <section className="card">
          <video ref={videoRef} className="video" src={videoUrl} controls playsInline></video>
          <div className="footer">Need custom variants, captions, or a brand pack? Visit <a className="link" href="https://jordanborden.com" target="_blank" rel="noreferrer">Jordan & Borden</a>.</div>
        </section>
      )}
    </div>
  );
}
