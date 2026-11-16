import { getArchive } from "@/lib/archive";

// Past analyzed games (offseason): static snapshots, no upstream calls.
export function GET() {
  return Response.json(getArchive());
}
