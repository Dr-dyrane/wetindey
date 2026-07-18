import { createHash } from "node:crypto";

import {
  NBS_PACKAGE_BYTES,
  NBS_PACKAGE_SHA256,
  NBS_PACKAGE_URL,
} from "./adapters/nbs-selected-food-price-watch";

/**
 * Retrieves the approved NBS package into memory only. It never writes package bytes,
 * captures, candidates, database rows, or live Food projections.
 */
async function main(): Promise<void> {
  const recordedAtFlag = process.argv.indexOf("--recorded-at");
  const recordedAt = recordedAtFlag < 0 ? undefined : process.argv[recordedAtFlag + 1];
  if (!recordedAt) {
    throw new Error("--recorded-at requires the UTC instant recorded by the invoking scheduler");
  }
  if (Number.isNaN(Date.parse(recordedAt)) || !recordedAt.endsWith("Z")) {
    throw new Error("--recorded-at must be an ISO-8601 UTC timestamp");
  }
  const response = await fetch(NBS_PACKAGE_URL, {
    headers: { accept: "application/octet-stream,application/zip;q=0.9,*/*;q=0.1" },
  });
  if (!response.ok) throw new Error(`NBS package request failed with HTTP ${response.status}`);
  if (response.url !== NBS_PACKAGE_URL) {
    throw new Error(`NBS package final URL changed to ${response.url}; no artifact was written`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentHash = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== NBS_PACKAGE_BYTES || contentHash !== NBS_PACKAGE_SHA256) {
    throw new Error(
      `NBS package identity changed: bytes=${bytes.byteLength}, sha256=${contentHash}; no artifact was written`
    );
  }

  process.stdout.write(
    `${JSON.stringify({
      outcome: "unchanged",
      requestUrl: NBS_PACKAGE_URL,
      finalResolvedUrl: response.url,
      fetchedAt: recordedAt,
      byteLength: bytes.byteLength,
      hashingAlgorithm: "sha256",
      contentHash,
      rawBytesPersisted: false,
      writesPerformed: 0,
    })}\n`
  );
}

void main();
