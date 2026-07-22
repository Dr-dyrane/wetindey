"use server";

import { randomUUID } from "node:crypto";

import { and, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { observations, sources } from "@/db/schema";
import { contributionEvidenceMedia } from "@/db/schema/evidence-media";
import { auth } from "@/lib/auth";
import {
  admitEvidenceMedia,
  isEvidenceMediaDisplayable,
  type AdmittedReport,
  type EvidenceMediaAdmissionDeps,
} from "@/lib/evidence-media/admission";
import { isEvidenceMediaAdmissionEnabled } from "@/lib/evidence-media/flag";
import { sanitizeEvidenceMedia } from "@/lib/evidence-media/sanitize";
import {
  createEvidenceMediaStore,
  evidenceMediaBlobTokenFromEnvironment,
} from "@/lib/evidence-media/store";
import {
  isEvidenceMediaExt,
  type EvidenceMediaRow,
} from "@/lib/evidence-media/types";

export type AttachEvidenceMediaResult =
  | { ok: true; mediaId: string; state: "pending" }
  | { ok: false; reason: "disabled" | "unauthenticated" | "invalid_media" | "rejected" };

export interface ApprovedEvidenceMedia {
  mediaId: string;
  ext: string;
  contentType: string;
}

/**
 * The DEFAULT-OFF gate for every action here. Both the admission flag and the
 * private-Blob token must be present; either absent means no upload path is
 * reachable and the feature is inert.
 */
function resolveGate(): { token: string } | null {
  if (!isEvidenceMediaAdmissionEnabled()) return null;
  const token = evidenceMediaBlobTokenFromEnvironment();
  if (!token) return null;
  return { token };
}

async function readActorId(): Promise<string | null> {
  const { data: session } = await auth.getSession();
  return session?.user?.id ?? null;
}

/** Read the report inside the ADR-019 pending boundary, resolving its owner. */
async function readReport(observationId: string): Promise<AdmittedReport | null> {
  const [row] = await db
    .select({
      observationId: observations.id,
      moderationStatus: observations.moderationStatus,
      ownerAccountId: sources.userId,
    })
    .from(observations)
    .innerJoin(sources, eq(observations.sourceId, sources.id))
    .where(eq(observations.id, observationId))
    .limit(1);
  if (!row) return null;
  return {
    observationId: row.observationId,
    moderationStatus: row.moderationStatus,
    ownerAccountId: row.ownerAccountId ?? null,
  };
}

/**
 * Attach one OPTIONAL photo to an already-admitted pending report. Media is
 * sanitized (EXIF/GPS stripped), stored PRIVATELY, and persisted `pending`. It
 * is never public and never displayable until an authorized moderation decision
 * approves both the report and the media. Fail-closed at every step.
 */
export async function attachEvidenceMedia(
  formData: FormData,
): Promise<AttachEvidenceMediaResult> {
  const gate = resolveGate();
  if (!gate) return { ok: false, reason: "disabled" };

  const actorAccountId = await readActorId();

  const observationId = formData.get("observationId");
  const file = formData.get("media");
  if (typeof observationId !== "string" || !(file instanceof File) || file.size === 0) {
    return { ok: false, reason: "invalid_media" };
  }

  let sanitized;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    sanitized = sanitizeEvidenceMedia(bytes, file.type);
  } catch {
    return { ok: false, reason: "invalid_media" };
  }

  const store = createEvidenceMediaStore({ token: gate.token });
  const deps: EvidenceMediaAdmissionDeps = {
    isEnabled: isEvidenceMediaAdmissionEnabled,
    readReport,
    async countExisting(id) {
      const [row] = await db
        .select({ value: count() })
        .from(contributionEvidenceMedia)
        .where(eq(contributionEvidenceMedia.observationId, id));
      return row?.value ?? 0;
    },
    newMediaId: () => randomUUID(),
    storePut: (input) => store.put(input),
    async persistRow(input): Promise<EvidenceMediaRow> {
      const [inserted] = await db
        .insert(contributionEvidenceMedia)
        .values({
          observationId: input.observationId,
          mediaId: input.mediaId,
          ext: input.sanitized.ext,
          contentType: input.sanitized.contentType,
          byteSize: input.sanitized.byteSize,
          contentSha256: input.sanitized.contentSha256,
          state: "pending",
          sanitizedAt: new Date(),
        })
        .returning();
      return {
        id: inserted.id,
        observationId: inserted.observationId,
        mediaId: inserted.mediaId,
        ext: input.sanitized.ext,
        contentType: input.sanitized.contentType,
        byteSize: inserted.byteSize,
        contentSha256: inserted.contentSha256,
        state: "pending",
        decisionId: inserted.decisionId ?? null,
        sanitizedAt: inserted.sanitizedAt,
        createdAt: inserted.createdAt,
        expiresAt: inserted.expiresAt ?? null,
      };
    },
  };

  try {
    const row = await admitEvidenceMedia(deps, {
      observationId,
      actorAccountId,
      sanitized,
    });
    return { ok: true, mediaId: row.mediaId, state: "pending" };
  } catch {
    return { ok: false, reason: "rejected" };
  }
}

/**
 * Remove one still-PENDING media object the actor owns: delete the private Blob
 * object by its exact key and the redacted row. A resolved (approved/rejected)
 * object is immutable evidence and is not removable here.
 */
export async function removeEvidenceMedia(input: {
  observationId: string;
  mediaId: string;
}): Promise<{ ok: boolean }> {
  const gate = resolveGate();
  if (!gate) return { ok: false };

  const actorAccountId = await readActorId();
  const report = await readReport(input.observationId);
  if (!report || report.ownerAccountId !== actorAccountId) return { ok: false };

  const [row] = await db
    .select({
      id: contributionEvidenceMedia.id,
      ext: contributionEvidenceMedia.ext,
      state: contributionEvidenceMedia.state,
    })
    .from(contributionEvidenceMedia)
    .where(
      and(
        eq(contributionEvidenceMedia.observationId, input.observationId),
        eq(contributionEvidenceMedia.mediaId, input.mediaId),
      ),
    )
    .limit(1);
  if (!row || row.state !== "pending" || !isEvidenceMediaExt(row.ext)) {
    return { ok: false };
  }

  const store = createEvidenceMediaStore({ token: gate.token });
  await store.deleteObject({
    reportId: input.observationId,
    mediaId: input.mediaId,
    ext: row.ext,
  });
  await db
    .delete(contributionEvidenceMedia)
    .where(eq(contributionEvidenceMedia.id, row.id));
  return { ok: true };
}

/**
 * Display-gated read: return media ONLY for an approved report and only the
 * approved media objects on it. Any other state yields an empty list. The
 * deterministic private key is derivable from `{observationId, mediaId, ext}`;
 * no public URL is emitted by this lane.
 */
export async function getApprovedEvidenceMedia(
  observationId: string,
): Promise<ApprovedEvidenceMedia[]> {
  const report = await readReport(observationId);
  if (!report || report.moderationStatus !== "approved") return [];

  const rows = await db
    .select({
      mediaId: contributionEvidenceMedia.mediaId,
      ext: contributionEvidenceMedia.ext,
      contentType: contributionEvidenceMedia.contentType,
      state: contributionEvidenceMedia.state,
    })
    .from(contributionEvidenceMedia)
    .where(eq(contributionEvidenceMedia.observationId, observationId));

  return rows
    .filter((row) =>
      isEvidenceMediaDisplayable({
        reportModerationStatus: report.moderationStatus,
        mediaState: row.state,
      }),
    )
    .map((row) => ({ mediaId: row.mediaId, ext: row.ext, contentType: row.contentType }));
}
