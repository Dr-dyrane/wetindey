/**
 * ADR-021 P2 avatar Blob cleanup adapter (INERT).
 *
 * Deletes every avatar object an account ever wrote, by paginated EXACT-PREFIX
 * enumeration over `avatars/{userId}.` and never by the single stored URL.
 * `uploadMyAvatar` writes with `addRandomSuffix: true`, so historical keys look
 * like `avatars/{userId}.{ext}-{random}`; only a prefix walk finds them all, and
 * reusing `profile-actions.ts`'s `del(storedUrl)` would leak every superseded
 * upload. This adapter therefore owns its own list/del loop.
 *
 * It is inert by construction: it imports no `@vercel/blob` and no real store,
 * so it can only ever drive an INJECTED client (a disposable fixture in tests, a
 * scoped credential in a later live phase). With no client wired it throws
 * `DeletionNotWiredError` rather than reaching a real bucket.
 *
 * Two safety guards make deletion fail closed:
 *   - Every listed object's pathname MUST start with the exact prefix, or the
 *     adapter throws before deleting: a mis-scoped list can never delete a
 *     foreign object.
 *   - "Already absent" counts as success ONLY after a confirming enumeration
 *     observes zero matching objects. A store that silently failed to delete is
 *     caught, not reported as done.
 */

import { assertServerOnly } from "./guards";
import { DeletionNotWiredError, assertDeletionSubjectId } from "./cleanup";

/** The exact prefix that scopes an account's avatars. */
export function buildAvatarPrefix(subjectId: string): string {
  assertDeletionSubjectId(subjectId);
  return `avatars/${subjectId}.`;
}

export interface BlobObjectRef {
  readonly pathname: string;
  readonly url: string;
}

export interface BlobListPage {
  readonly blobs: readonly BlobObjectRef[];
  readonly cursor: string | null;
  readonly hasMore: boolean;
}

/** The minimal Blob-store surface this adapter drives (mirrors @vercel/blob). */
export interface BlobStoreClient {
  list(input: { prefix: string; cursor: string | null }): Promise<BlobListPage>;
  del(urls: readonly string[]): Promise<void>;
}

export class BlobPrefixViolationError extends Error {
  constructor(readonly prefix: string) {
    super(
      "blob enumeration returned an object outside the exact avatars prefix; refusing to delete",
    );
    this.name = "BlobPrefixViolationError";
  }
}

export class BlobResidueError extends Error {
  constructor() {
    super(
      "blob cleanup could not prove the avatars prefix is empty after deletion",
    );
    this.name = "BlobResidueError";
  }
}

export interface BlobCleanupResult {
  readonly prefix: string;
  readonly pagesScanned: number;
  readonly deletedCount: number;
  readonly verifiedEmpty: true;
}

/** Hard bound so a misbehaving cursor can never loop forever. */
const MAX_BLOB_PAGES = 10_000;

export class BlobCleanupAdapter {
  private readonly client: BlobStoreClient | null;

  constructor(config?: { client?: BlobStoreClient | null }) {
    this.client = config?.client ?? null;
  }

  isWired(): boolean {
    return this.client !== null;
  }

  async run(subjectId: string): Promise<BlobCleanupResult> {
    assertServerOnly();
    assertDeletionSubjectId(subjectId);
    const prefix = buildAvatarPrefix(subjectId);
    if (!this.client) {
      throw new DeletionNotWiredError("blob-cleanup");
    }

    // Enumerate to exhaustion FIRST, collecting matching urls, and delete only
    // after the walk. Deleting mid-pagination would shift an offset-based
    // cursor and skip objects; collect-then-delete is stable against that.
    const urls: string[] = [];
    let cursor: string | null = null;
    let pagesScanned = 0;

    do {
      const page: BlobListPage = await this.client.list({ prefix, cursor });
      pagesScanned += 1;

      for (const blob of page.blobs) {
        // Fail closed: a store that returns anything outside the exact prefix is
        // mis-scoped, and deleting a foreign object is unrecoverable.
        if (!blob.pathname.startsWith(prefix)) {
          throw new BlobPrefixViolationError(prefix);
        }
        urls.push(blob.url);
      }

      cursor = page.hasMore ? page.cursor : null;
      if (pagesScanned >= MAX_BLOB_PAGES) {
        break;
      }
    } while (cursor !== null);

    if (urls.length > 0) {
      await this.client.del(urls);
    }

    // Prove none remain. Already-absent is success ONLY because this confirming
    // pass observed zero matching objects; a residual match fails closed.
    const confirm = await this.client.list({ prefix, cursor: null });
    for (const blob of confirm.blobs) {
      if (blob.pathname.startsWith(prefix)) {
        throw new BlobResidueError();
      }
    }

    return { prefix, pagesScanned, deletedCount: urls.length, verifiedEmpty: true };
  }
}
