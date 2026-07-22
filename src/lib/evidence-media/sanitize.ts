/**
 * ADR-028 ingest sanitizer: strip EXIF / GPS / metadata before durable retention.
 *
 * Evidence media must never carry the contributor's location or camera identity
 * into storage. This module removes metadata at the byte-container level with no
 * third-party codec dependency: JPEG APPn/COM segments (EXIF and GPS live in
 * APP1), PNG ancillary metadata chunks (including the `eXIf` chunk), and WebP
 * `EXIF`/`XMP ` RIFF chunks are dropped, and the WebP `VP8X` feature flags are
 * cleared to match. What remains is the pixel data and the structural chunks
 * needed to render it. The result is a normalized, metadata-free derivative.
 *
 * Size and type are enforced fail-closed: an unrecognized or mismatched
 * container, an empty result, or a result outside the byte bounds throws before
 * anything is written. The output hash is computed over the sanitized bytes, so
 * the persisted `content_sha256` can never describe pre-strip, metadata-bearing
 * bytes.
 *
 * This module is server-usable and dependency-free (only `node:crypto`); it is
 * deliberately importable by the contract test, so it must not import
 * `server-only`.
 */

import { createHash } from "node:crypto";

import {
  EVIDENCE_MEDIA_MAX_BYTES,
  EVIDENCE_MEDIA_MIN_BYTES,
  extForMime,
  isEvidenceMediaMime,
  type EvidenceMediaMime,
  type SanitizedEvidenceMedia,
} from "./types";

export class EvidenceMediaSanitizeError extends Error {
  constructor(
    message: string,
    readonly reason:
      | "unsupported_type"
      | "too_large"
      | "too_small"
      | "malformed"
      | "type_mismatch",
  ) {
    super(message);
    this.name = "EvidenceMediaSanitizeError";
  }
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// --- JPEG ------------------------------------------------------------------

function sniff(bytes: Uint8Array): EvidenceMediaMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

/** Strip APP1..APP15 and COM segments from a JPEG, keeping APP0 (JFIF) and the
 *  entropy-coded scan verbatim. EXIF and GPS live in APP1, so they are removed. */
function stripJpeg(bytes: Uint8Array): Uint8Array {
  const out: number[][] = [];
  const view = bytes;
  // SOI.
  out.push([0xff, 0xd8]);
  let pos = 2;
  while (pos + 1 < view.length) {
    if (view[pos] !== 0xff) {
      throw new EvidenceMediaSanitizeError("JPEG marker alignment lost", "malformed");
    }
    // Skip any fill 0xFF bytes.
    let markerPos = pos;
    while (markerPos < view.length && view[markerPos] === 0xff) markerPos += 1;
    if (markerPos >= view.length) {
      throw new EvidenceMediaSanitizeError("JPEG truncated at marker", "malformed");
    }
    const marker = view[markerPos];

    if (marker === 0xd9) {
      // EOI.
      out.push([0xff, 0xd9]);
      break;
    }
    if (marker === 0xda) {
      // Start of scan: copy this marker and everything after it verbatim.
      out.push(Array.from(view.subarray(pos)));
      pos = view.length;
      break;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      // Standalone marker, no length payload.
      out.push([0xff, marker]);
      pos = markerPos + 1;
      continue;
    }

    const lenHigh = view[markerPos + 1];
    const lenLow = view[markerPos + 2];
    if (lenHigh === undefined || lenLow === undefined) {
      throw new EvidenceMediaSanitizeError("JPEG truncated in segment length", "malformed");
    }
    const length = (lenHigh << 8) | lenLow;
    const segmentStart = markerPos - 1; // include the 0xFF
    const segmentEnd = markerPos + 1 + length;
    if (segmentEnd > view.length) {
      throw new EvidenceMediaSanitizeError("JPEG segment overruns buffer", "malformed");
    }
    const isApp = marker >= 0xe1 && marker <= 0xef; // APP1..APP15 (drop; keep APP0)
    const isComment = marker === 0xfe;
    if (!isApp && !isComment) {
      out.push(Array.from(view.subarray(segmentStart, segmentEnd)));
    }
    pos = segmentEnd;
  }

  const total = out.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of out) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// --- PNG -------------------------------------------------------------------

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// Structural and rendering chunks kept verbatim. Everything else (tEXt, zTXt,
// iTXt, tIME, eXIf, and any unknown ancillary chunk) is dropped.
const PNG_KEEP_CHUNKS = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "gAMA",
  "cHRM",
  "sRGB",
  "iCCP",
  "sBIT",
  "bKGD",
  "pHYs",
  "hIST",
]);

function stripPng(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [PNG_SIGNATURE];
  let pos = PNG_SIGNATURE.length;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sawIend = false;
  while (pos + 8 <= bytes.length) {
    const length = dv.getUint32(pos);
    const typeStart = pos + 4;
    const type = String.fromCharCode(
      bytes[typeStart],
      bytes[typeStart + 1],
      bytes[typeStart + 2],
      bytes[typeStart + 3],
    );
    const chunkEnd = typeStart + 4 + length + 4; // type + data + CRC
    if (chunkEnd > bytes.length) {
      throw new EvidenceMediaSanitizeError("PNG chunk overruns buffer", "malformed");
    }
    if (PNG_KEEP_CHUNKS.has(type)) {
      kept.push(bytes.subarray(pos, chunkEnd));
    }
    pos = chunkEnd;
    if (type === "IEND") {
      sawIend = true;
      break;
    }
  }
  if (!sawIend) {
    throw new EvidenceMediaSanitizeError("PNG has no IEND chunk", "malformed");
  }
  const total = kept.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of kept) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

// --- WebP ------------------------------------------------------------------

function fourCc(bytes: Uint8Array, at: number): string {
  return String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
}

function stripWebp(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 12) {
    throw new EvidenceMediaSanitizeError("WebP too short", "malformed");
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [];
  let pos = 12; // after RIFF + size + WEBP
  let vp8xOffsetInOutput = -1;
  let runningOutputBody = 0; // bytes after the 12-byte header
  while (pos + 8 <= bytes.length) {
    const cc = fourCc(bytes, pos);
    const size = dv.getUint32(pos + 4, true);
    const padded = size + (size % 2); // chunks are padded to even length
    const chunkEnd = pos + 8 + padded;
    if (chunkEnd > bytes.length) {
      throw new EvidenceMediaSanitizeError("WebP chunk overruns buffer", "malformed");
    }
    const drop = cc === "EXIF" || cc === "XMP ";
    if (!drop) {
      const chunk = bytes.subarray(pos, chunkEnd);
      if (cc === "VP8X") vp8xOffsetInOutput = 12 + runningOutputBody;
      kept.push(chunk);
      runningOutputBody += chunk.length;
    }
    pos = chunkEnd;
  }

  const bodyLength = kept.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(12 + bodyLength);
  result.set(bytes.subarray(0, 12), 0);
  let offset = 12;
  for (const chunk of kept) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  // Rewrite RIFF chunk size (file size minus the 8-byte RIFF header).
  const outDv = new DataView(result.buffer, result.byteOffset, result.byteLength);
  outDv.setUint32(4, result.length - 8, true);
  // Clear the VP8X EXIF (bit 3) and XMP (bit 2) feature flags so the header no
  // longer advertises metadata that has been removed.
  if (vp8xOffsetInOutput >= 0) {
    const flagsAt = vp8xOffsetInOutput + 8; // FourCC(4) + size(4)
    result[flagsAt] = result[flagsAt] & ~0b0000_1100;
  }
  return result;
}

/**
 * Sanitize a raw upload: validate type against the declared MIME, strip all
 * metadata, enforce size bounds on the sanitized output, and hash it. Fails
 * closed on anything it does not fully understand.
 */
export function sanitizeEvidenceMedia(
  bytes: Uint8Array,
  declaredType: string,
): SanitizedEvidenceMedia {
  if (!isEvidenceMediaMime(declaredType)) {
    throw new EvidenceMediaSanitizeError(
      `unsupported media type ${declaredType}`,
      "unsupported_type",
    );
  }
  if (bytes.length < EVIDENCE_MEDIA_MIN_BYTES) {
    throw new EvidenceMediaSanitizeError("media is empty", "too_small");
  }
  if (bytes.length > EVIDENCE_MEDIA_MAX_BYTES) {
    throw new EvidenceMediaSanitizeError("media exceeds the size limit", "too_large");
  }

  const sniffed = sniff(bytes);
  if (sniffed === null) {
    throw new EvidenceMediaSanitizeError("unrecognized image container", "malformed");
  }
  if (sniffed !== declaredType) {
    throw new EvidenceMediaSanitizeError(
      `declared ${declaredType} but bytes are ${sniffed}`,
      "type_mismatch",
    );
  }

  let sanitized: Uint8Array;
  switch (sniffed) {
    case "image/jpeg":
      sanitized = stripJpeg(bytes);
      break;
    case "image/png":
      sanitized = stripPng(bytes);
      break;
    case "image/webp":
      sanitized = stripWebp(bytes);
      break;
  }

  if (sanitized.length < EVIDENCE_MEDIA_MIN_BYTES) {
    throw new EvidenceMediaSanitizeError("sanitized media is empty", "malformed");
  }
  if (sanitized.length > EVIDENCE_MEDIA_MAX_BYTES) {
    throw new EvidenceMediaSanitizeError("sanitized media exceeds the size limit", "too_large");
  }

  return {
    bytes: sanitized,
    contentType: sniffed,
    ext: extForMime(sniffed),
    byteSize: sanitized.length,
    contentSha256: sha256Hex(sanitized),
  };
}
