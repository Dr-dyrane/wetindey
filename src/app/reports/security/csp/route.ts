import { handleCspReportPost } from "@/lib/security/csp-report";
import {
  createCspReportStore,
  privateBlobTokenFromEnvironment,
} from "@/lib/security/csp-report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleCspReportPost(request, async (reports) => {
    const token = privateBlobTokenFromEnvironment();
    if (!token) {
      throw new Error("Private CSP report storage is unavailable");
    }
    await createCspReportStore({ token }).persist(reports);
  });
}
