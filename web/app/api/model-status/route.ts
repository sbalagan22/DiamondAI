import { INFERENCE_URL } from "@/lib/mlbConfig";

// Server-side proxy for the inference server's /health, so the client badge can
// tell whether predictions are the real model or the sim.ts fallback.
export async function GET() {
  try {
    const res = await fetch(`${INFERENCE_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`health ${res.status}`);
    const data = (await res.json()) as { ok?: boolean; step?: number | null };
    return Response.json({ online: !!data.ok, step: data.step ?? null });
  } catch {
    return Response.json({ online: false, step: null });
  }
}
