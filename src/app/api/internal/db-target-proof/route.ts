import { list as listBlobs, put as putBlob } from "@vercel/blob";
import {
  createDbTargetProofHandler,
  DB_TARGET_PROOF_TOKEN_ENV,
} from "@/lib/security/db-target-proof";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 5;

const CLAIM_NAMESPACE = "internal-db-target-proof/v1/claims/";
const CLAIM_BODY = "claimed\n";
const CLAIM_LIST_LIMIT = 1_000;

async function claimExists(pathname: string, token: string): Promise<boolean> {
  let cursor: string | undefined;
  do {
    const page = await listBlobs({
      prefix: pathname,
      limit: CLAIM_LIST_LIMIT,
      ...(cursor ? { cursor } : {}),
      token,
    });
    if (page.blobs.some((blob) => blob.pathname === pathname)) return true;
    cursor = page.cursor;
  } while (cursor);
  return false;
}

const handleRequest = createDbTargetProofHandler({
  async claimToken(tokenKey) {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN_PRIVATE?.trim();
    if (!blobToken) throw new Error();
    const pathname = `${CLAIM_NAMESPACE}${tokenKey}`;
    try {
      await putBlob(pathname, CLAIM_BODY, {
        access: "private",
        token: blobToken,
        contentType: "application/octet-stream",
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      return true;
    } catch {
      if (await claimExists(pathname, blobToken)) return false;
      throw new Error();
    }
  },
});

export async function POST(request: Request): Promise<Response> {
  return handleRequest(request, {
    vercelEnvironment: process.env.VERCEL_ENV,
    databaseUrl: process.env.DATABASE_URL,
    bearerToken: process.env[DB_TARGET_PROOF_TOKEN_ENV],
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
    deploymentUrl: process.env.VERCEL_URL,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  });
}
