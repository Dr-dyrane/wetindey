import {
  createCspReportStore,
  cronSecretFromEnvironment,
  isAuthorizedCronRequest,
  privateBlobTokenFromEnvironment,
} from "@/lib/security/csp-report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function emptyResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Length": "0",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const cronSecret = cronSecretFromEnvironment();
  const token = privateBlobTokenFromEnvironment();
  if (!cronSecret || !token) return emptyResponse(503);
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), cronSecret)) {
    return emptyResponse(401);
  }

  try {
    await createCspReportStore({ token }).cleanup();
    return emptyResponse(204);
  } catch {
    // Never expose private object metadata, provider errors, or credentials.
    return emptyResponse(503);
  }
}
