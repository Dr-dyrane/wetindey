import { handlePresenceRetentionCleanupRequest } from "@/lib/presence-retention-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handlePresenceRetentionCleanupRequest(request);
}
