/**
 * ADR-028 private Blob adapter for evidence-media.
 *
 * Evidence media is PRIVATE. This mirrors `src/lib/security/csp-report-store.ts`
 * exactly where it matters: `put`/`list`/`del` from `@vercel/blob` with an
 * explicit token read from `BLOB_READ_WRITE_TOKEN_PRIVATE`, `access: "private"`,
 * a paginated prefix listing that fails closed if a continuation cursor is
 * dropped, and batched deletes. It mirrors the avatars exact-prefix
 * enumerate-then-delete CONTRACT (a report's objects are found by listing the
 * per-report prefix and deleted by exact key) but NOT the avatars public access.
 *
 * The key layout is the single deterministic
 * `contribution-evidence/{reportId}/{mediaId}.{ext}` from `keys.ts`. Because a
 * report's media is enumerable page-by-page under
 * `contribution-evidence/{reportId}/`, the deletion saga (ADR-021) can drain a
 * report's evidence without ever consulting the database.
 */

import { del as deleteBlob, list as listBlobs, put as putBlob } from "@vercel/blob";

import { evidenceMediaKey, evidenceMediaReportPrefix, type EvidenceMediaKeyParts } from "./keys";
import type { SanitizedEvidenceMedia } from "./types";

const LIST_LIMIT = 1_000;
const DELETE_BATCH_SIZE = 100;

interface BlobMetadata {
  url: string;
  pathname: string;
  uploadedAt: Date;
}

interface BlobListResult {
  blobs: BlobMetadata[];
  cursor?: string;
  hasMore: boolean;
}

interface PrivatePutOptions {
  access: "private";
  token: string;
  contentType: string;
  addRandomSuffix: false;
  allowOverwrite: false;
}

export interface EvidenceMediaBlobClient {
  put(pathname: string, body: Buffer, options: PrivatePutOptions): Promise<{ pathname: string }>;
  list(options: {
    prefix: string;
    cursor?: string;
    limit: number;
    token: string;
  }): Promise<BlobListResult>;
  delete(pathnames: string[], token: string): Promise<void>;
}

const vercelBlobClient: EvidenceMediaBlobClient = {
  async put(pathname, body, options) {
    const result = await putBlob(pathname, body, options);
    return { pathname: result.pathname };
  },
  async list(options) {
    const result = await listBlobs(options);
    return {
      blobs: result.blobs.map((blob) => ({
        url: blob.url,
        pathname: blob.pathname,
        uploadedAt: blob.uploadedAt,
      })),
      ...(result.cursor ? { cursor: result.cursor } : {}),
      hasMore: result.hasMore,
    };
  },
  async delete(pathnames, token) {
    if (pathnames.length > 0) {
      await deleteBlob(pathnames, { token });
    }
  },
};

function requiredValue(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** The explicit private-Blob token. Absent → the store cannot be constructed. */
export function evidenceMediaBlobTokenFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): string | null {
  return requiredValue(environment.BLOB_READ_WRITE_TOKEN_PRIVATE);
}

async function listAll(
  client: EvidenceMediaBlobClient,
  token: string,
  prefix: string,
): Promise<BlobMetadata[]> {
  const blobs: BlobMetadata[] = [];
  let cursor: string | undefined;
  do {
    const result = await client.list({
      prefix,
      ...(cursor ? { cursor } : {}),
      limit: LIST_LIMIT,
      token,
    });
    blobs.push(...result.blobs);
    cursor = result.hasMore ? result.cursor : undefined;
    if (result.hasMore && !cursor) {
      throw new Error("Private Blob listing omitted its continuation cursor");
    }
  } while (cursor);
  return blobs;
}

async function deleteInBatches(
  client: EvidenceMediaBlobClient,
  token: string,
  pathnames: string[],
): Promise<void> {
  for (let index = 0; index < pathnames.length; index += DELETE_BATCH_SIZE) {
    await client.delete(pathnames.slice(index, index + DELETE_BATCH_SIZE), token);
  }
}

export interface EvidenceMediaStore {
  /** Persist one sanitized object privately at its exact deterministic key. */
  put(input: {
    reportId: string;
    mediaId: string;
    sanitized: SanitizedEvidenceMedia;
  }): Promise<{ key: string }>;
  /** Every object bound to a report, listed by the exact per-report prefix. */
  listReport(reportId: string): Promise<string[]>;
  /** Delete every object bound to a report (ADR-021 enumerate-then-delete). */
  deleteReport(reportId: string): Promise<{ deleted: number }>;
  /** Delete one object by its exact parts. */
  deleteObject(parts: EvidenceMediaKeyParts): Promise<void>;
}

export function createEvidenceMediaStore(options: {
  token: string;
  client?: EvidenceMediaBlobClient;
}): EvidenceMediaStore {
  const client = options.client ?? vercelBlobClient;
  const token = options.token;

  return {
    async put({ reportId, mediaId, sanitized }) {
      const key = evidenceMediaKey({ reportId, mediaId, ext: sanitized.ext });
      await client.put(key, Buffer.from(sanitized.bytes), {
        access: "private",
        token,
        contentType: sanitized.contentType,
        addRandomSuffix: false,
        allowOverwrite: false,
      });
      return { key };
    },

    async listReport(reportId) {
      const prefix = evidenceMediaReportPrefix(reportId);
      const blobs = await listAll(client, token, prefix);
      return blobs.map((blob) => blob.pathname);
    },

    async deleteReport(reportId) {
      const pathnames = await this.listReport(reportId);
      await deleteInBatches(client, token, pathnames);
      return { deleted: pathnames.length };
    },

    async deleteObject(parts) {
      const key = evidenceMediaKey(parts);
      await client.delete([key], token);
    },
  };
}
