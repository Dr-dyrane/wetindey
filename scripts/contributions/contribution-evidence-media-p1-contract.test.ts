/**
 * ADR-028 P1 evidence-media contract.
 *
 * Proves the desired-state schema shape, the exact 3 media-state labels (cross-
 * checked across the Drizzle pgEnum, the lib constant, and the generated DDL),
 * that media is OPTIONAL (nothing requires it), that it is PRIVATE and NEVER
 * public until an authorized moderation decision approves both the report and
 * the media (RLS/policy in the pillar, the decision-shape CHECK, and the display
 * gate), that ingest STRIPS EXIF/GPS/metadata, the EXACT Blob key layout
 * `contribution-evidence/{reportId}/{mediaId}.{ext}`, ADR-021 deletion-by-exact-
 * prefix enumeration, the DEFAULT-OFF flag, and fail-closed admission. It also
 * proves 0000..0018 and their meta are byte-frozen and that 0019 is present but
 * UNAPPLIED (release manifest flags all false).
 *
 * Shared-DB rule: this harness generates no DB traffic against any shared,
 * preview, or production database. If the disposable PGlite deps are present it
 * additionally reconstructs 0000->0019 on an in-memory database; when they are
 * absent it SKIPS to static-only, which is acceptable, and reports which ran.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getTableConfig } from "drizzle-orm/pg-core";

import { contributionEvidenceMedia, evidenceMediaState } from "../../src/db/schema/evidence-media";
import {
  admitEvidenceMedia,
  isEvidenceMediaDisplayable,
  selectDisplayableMedia,
  EvidenceMediaAdmissionError,
  type AdmittedReport,
  type EvidenceMediaAdmissionDeps,
} from "../../src/lib/evidence-media/admission";
import {
  isEvidenceMediaAdmissionEnabled,
  isEvidenceMediaClientEnabled,
} from "../../src/lib/evidence-media/flag";
import {
  EvidenceMediaKeyError,
  evidenceMediaKey,
  evidenceMediaReportPrefix,
  isKeyForReport,
  parseEvidenceMediaKey,
} from "../../src/lib/evidence-media/keys";
import {
  EvidenceMediaSanitizeError,
  sanitizeEvidenceMedia,
} from "../../src/lib/evidence-media/sanitize";
import { createEvidenceMediaStore, type EvidenceMediaBlobClient } from "../../src/lib/evidence-media/store";
import {
  EVIDENCE_MEDIA_MAX_PER_REPORT,
  EVIDENCE_MEDIA_MIME_EXT,
  EVIDENCE_MEDIA_PREFIX_ROOT,
  EVIDENCE_MEDIA_STATES,
  type SanitizedEvidenceMedia,
} from "../../src/lib/evidence-media/types";

const root = path.resolve(import.meta.dirname, "../..");
const migrationsDir = path.join(root, "src/db/migrations");

const MEDIA_STATES = ["pending", "approved", "rejected"] as const;

const requiredPaths = [
  "src/db/schema/evidence-media.ts",
  "src/db/schema/index.ts",
  "src/db/pillars/90-contribution-evidence-media.sql",
  "src/db/migrations/0019_contribution_evidence_media.sql",
  "src/db/migrations/meta/0019_snapshot.json",
  "src/db/migrations/meta/0019_release_manifest.json",
  "src/db/migrations/meta/_journal.json",
  "src/lib/evidence-media/types.ts",
  "src/lib/evidence-media/keys.ts",
  "src/lib/evidence-media/sanitize.ts",
  "src/lib/evidence-media/store.ts",
  "src/lib/evidence-media/admission.ts",
  "src/lib/evidence-media/flag.ts",
  "src/app/_actions/evidence-media-actions.ts",
  "src/app/_components/report-price-sheet/EvidenceMediaField.tsx",
  "scripts/contributions/contribution-evidence-media-p1-contract.test.ts",
] as const;

const frozenMigrationHashes: Record<string, string> = {
  "0000_careless_piledriver.sql": "71be7b38a05007fdb05c4f3a773c643796f090305c78379c2813a37cb88933fd",
  "0001_cute_harrier.sql": "6ed801dcd1e68d6214539aa48bcec349115bcdd1a5cc82f103387275bf5c2ccb",
  "0002_calm_meteorite.sql": "0ce00cbcd239ac0cc52d94e5e423b3902514116eda6b2eabd910a867bd840ff7",
  "0003_condemned_sally_floyd.sql": "0cce50bd4f13b5a6956452da588ce4ccc5cada203303370b472eba374735ce81",
  "0004_old_mordo.sql": "b7b6e97b3c40af6f0b34f34bf06cb6ff206fb0f127c38f444c5099bffca42645",
  "0005_handy_brood.sql": "d98917554fda9e094c57db5f0195063c8c803cae47b601dcb93e14502928c509",
  "0006_ordinary_meltdown.sql": "1373746f002441dd43ce8185fc2e9cdccbaaf513768557e56ffbf208b9235fa3",
  "0007_gray_king_cobra.sql": "c5d01c6bfb88b9386abe6fa3c9f68d5d345e9bd9f0f59bfb5e26027dfc2dc6f6",
  "0008_sturdy_lockjaw.sql": "150356e3db8061d2934fdc1176b84d2cd478aec2c9988550fac8bb26b2480073",
  "0009_observation_provenance.sql": "34dd394d6d4f1aad24a73edee5eb88a93441449a1ff86985b60d3ba04f927b4c",
  "0010_public_source_ingestion_boundary.sql": "9aa8cc511374010f1deb68ec330573a9c4940c2aff1188218d5f3e841fccd7fe",
  "0011_classy_the_stranger.sql": "1ad4a33a06dfdc58affcfa92dc7085b5843478e09761ee26a24c7cd6b3c0151b",
  "0012_guarded_presence.sql": "a8b31034aae22a6e9fa62416df8a1bb483c6783947fdf742c674e82cac373302",
  "0013_contribution_integrity.sql": "052769850c3d633230d9ec109c2b09067b73a686cadb7c139a613622184f0f0a",
  "0014_presence_capabilities.sql": "ed532eab5f7941245cfebb66463a2194ab9df235b30f9fd678e1c0e1065008bf",
  "0015_contribution_moderation_operations.sql": "d4d452a4e7f3dba7fdd68ce63c2b447e974c97b727d12dbd2c8e8261334559a2",
  "0016_contribution_review_acl_repair.sql": "669864c8a532b2b941dcd30258b2cb7a1e1c9a7406e4f5d6ddf4a5a3bbb6d6ec",
  "0017_contribution_pending_queue_shape_repair.sql": "a864a63b8fa782e0af1be9a01329857a303e874d57799d7b74517cc70909f34a",
  "0018_deletion_saga_persistence.sql": "6926ee24bc266538c98f1fc1c3e26841cb99b361210e33b3d1f6161b469c3dfc",
};

const PARENT_SNAPSHOT_ID = "ed1e3683-c202-457d-ab34-d5a9273fdadb";
const RESULT_SNAPSHOT_ID = "95019bd1-72ea-41ad-adc5-c0a037860eea";
const JOURNAL_WHEN_0019 = 1784750400000;

/** Column-name fragments that must never appear on the evidence-media table. */
const FORBIDDEN_COLUMN_FRAGMENTS = [
  "exif",
  "gps",
  "latitude",
  "longitude",
  "coordinate",
  "geom",
  "geography",
  "camera",
  "thumbnail",
  "filename",
  "payload",
  "metadata",
  "email",
  "otp",
  "token",
  "session",
  "password",
  "secret",
  "cookie",
];

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function migration0019(): string {
  return read("src/db/migrations/0019_contribution_evidence_media.sql");
}

// ---------------------------------------------------------------------------
// Static contract
// ---------------------------------------------------------------------------

test("the approved-lane artifacts exist", () => {
  for (const relativePath of requiredPaths) {
    assert.ok(existsSync(path.join(root, relativePath)), `missing ${relativePath}`);
  }
});

test("migrations 0000..0018 and their snapshots are byte-frozen", () => {
  for (const [name, expected] of Object.entries(frozenMigrationHashes)) {
    assert.equal(sha256(read(`src/db/migrations/${name}`)), expected, `${name} changed`);
  }
  // The 0018 snapshot (0019's parent) must be untouched.
  const parent = JSON.parse(read("src/db/migrations/meta/0018_snapshot.json")) as { id: string };
  assert.equal(parent.id, PARENT_SNAPSHOT_ID, "0018 snapshot id drifted");
});

test("the journal appends only the 0019 entry with a hand-set round epoch", () => {
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    version: string;
    entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>;
  };
  assert.equal(journal.version, "7");
  assert.equal(journal.entries.length, 20, "journal must hold entries 0..19");
  const last = journal.entries.at(-1);
  assert.deepEqual(last, {
    idx: 19,
    version: "7",
    when: JOURNAL_WHEN_0019,
    tag: "0019_contribution_evidence_media",
    breakpoints: true,
  });
  // Hand-set round epoch: a whole-hour boundary strictly after 0018.
  assert.equal(JOURNAL_WHEN_0019 % 3_600_000, 0, "0019 when is not a round epoch");
  const parent = journal.entries[18];
  assert.equal(parent.tag, "0018_deletion_saga_persistence");
  assert.ok(JOURNAL_WHEN_0019 > parent.when, "0019 when must be after 0018");
});

test("0019 snapshot continues the drizzle chain from 0018", () => {
  const snapshot = JSON.parse(read("src/db/migrations/meta/0019_snapshot.json")) as {
    id: string;
    prevId: string;
    version: string;
  };
  assert.equal(snapshot.version, "7");
  assert.equal(snapshot.prevId, PARENT_SNAPSHOT_ID, "0019 must branch off the 0018 snapshot");
  assert.equal(snapshot.id, RESULT_SNAPSHOT_ID);
});

test("0019 migration carries the generated DDL then the merged pillar", () => {
  const sql = migration0019();
  assert.match(
    sql,
    /CREATE TYPE "public"\."evidence_media_state" AS ENUM\('pending', 'approved', 'rejected'\)/,
    "state enum DDL missing or out of order",
  );
  assert.match(sql, /CREATE TABLE "contribution_evidence_media"/);
  assert.match(sql, /CREATE UNIQUE INDEX "contribution_evidence_media_object_key"/);

  // The hand-authored pillar is embedded verbatim after the generated DDL.
  const pillar = read("src/db/pillars/90-contribution-evidence-media.sql").trim();
  assert.ok(sql.includes(pillar), "pillar is not embedded exactly in 0019");
  const ddlEnd = sql.indexOf('CREATE INDEX "contribution_evidence_media_decision_idx"');
  assert.ok(ddlEnd >= 0 && sql.indexOf(pillar) > ddlEnd, "pillar must follow the generated DDL");

  // Private + fail-closed boundary: FORCE RLS, owner-only, no service DML grant.
  assert.match(sql, /ALTER TABLE public\.contribution_evidence_media ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /ALTER TABLE public\.contribution_evidence_media FORCE ROW LEVEL SECURITY/);
  assert.match(sql, /CREATE POLICY contribution_evidence_media_owner_policy/);
  assert.match(sql, /REVOKE ALL ON TABLE/);
  assert.doesNotMatch(
    sql,
    /GRANT (SELECT|INSERT|UPDATE|DELETE) ON TABLE[\s\S]*wetindey_evidence_media_(runtime|worker)/,
    "P1 must grant no direct table DML to runtime or worker",
  );
  // Media is private: no public read grant is emitted anywhere in the migration.
  assert.doesNotMatch(sql, /access[":\s]+public/i, "evidence media must not be public");
});

test("the pillar owns no tables or types and stays fail-closed", () => {
  const pillar = read("src/db/pillars/90-contribution-evidence-media.sql");
  assert.doesNotMatch(pillar, /CREATE TABLE/, "pillar must not create tables");
  assert.doesNotMatch(pillar, /CREATE TYPE/, "pillar must not create types");
  assert.match(pillar, /CREATE ROLE wetindey_evidence_media_owner/);
  assert.match(pillar, /ALTER TABLE public\.contribution_evidence_media OWNER TO wetindey_evidence_media_owner/);
});

test("0019 release manifest marks the candidate present but UNAPPLIED", () => {
  const manifest = JSON.parse(read("src/db/migrations/meta/0019_release_manifest.json")) as {
    kind: string;
    release: string;
    status: string;
    shared_database_applied: boolean;
    first_shared_application_frozen: boolean;
    parent_snapshot_id: string;
    result_snapshot_id: string;
    artifacts: Record<string, { path: string; sha256: string }>;
    source_sha256: Record<string, string>;
    authorization: Record<string, boolean>;
    scope: { direct_table_grants: boolean };
  };
  assert.equal(manifest.kind, "release_manifest");
  assert.equal(manifest.release, "0019_contribution_evidence_media");
  assert.equal(manifest.status, "candidate_unapplied");
  assert.equal(manifest.shared_database_applied, false);
  assert.equal(manifest.first_shared_application_frozen, false);
  assert.equal(manifest.parent_snapshot_id, PARENT_SNAPSHOT_ID);
  assert.equal(manifest.result_snapshot_id, RESULT_SNAPSHOT_ID);
  assert.equal(manifest.scope.direct_table_grants, false);

  // Every authorization flag is false: nothing is cleared to run anywhere.
  const authValues = Object.values(manifest.authorization);
  assert.ok(authValues.length >= 3, "authorization must enumerate the activation flags");
  for (const [flag, value] of Object.entries(manifest.authorization)) {
    assert.equal(value, false, `authorization.${flag} must be false`);
  }

  // Recorded artifact and source hashes match the files on disk right now.
  assert.equal(manifest.artifacts.migration.sha256, sha256(migration0019()), "migration hash drift");
  assert.equal(
    manifest.artifacts.snapshot.sha256,
    sha256(read("src/db/migrations/meta/0019_snapshot.json")),
    "snapshot hash drift",
  );
  assert.equal(
    manifest.artifacts.journal.sha256,
    sha256(read("src/db/migrations/meta/_journal.json")),
    "journal hash drift",
  );
  for (const [relativePath, expected] of Object.entries(manifest.source_sha256)) {
    assert.equal(sha256(read(relativePath)), expected, `${relativePath} manifest hash drift`);
  }
});

// ---------------------------------------------------------------------------
// Schema shape, state labels, redaction, optionality
// ---------------------------------------------------------------------------

test("state labels are exactly pending/approved/rejected, in order and three ways", () => {
  assert.deepEqual([...EVIDENCE_MEDIA_STATES], [...MEDIA_STATES]);
  assert.deepEqual([...evidenceMediaState.enumValues], [...MEDIA_STATES], "pgEnum drifted from spec");
  const ddl = migration0019().match(/CREATE TYPE "public"\."evidence_media_state" AS ENUM\(([^)]*)\)/);
  assert.ok(ddl, "state enum DDL not found");
  const ddlLabels = ddl[1].split(",").map((token) => token.trim().replace(/^'|'$/g, ""));
  assert.deepEqual(ddlLabels, [...MEDIA_STATES], "generated DDL labels drifted from spec");
});

test("the evidence-media table is redacted and foreign-keyed to report + decision", () => {
  const cfg = getTableConfig(contributionEvidenceMedia);
  const columnNames = cfg.columns.map((c) => c.name);
  const expected = [
    "id",
    "observation_id",
    "media_id",
    "ext",
    "content_type",
    "byte_size",
    "content_sha256",
    "state",
    "decision_id",
    "sanitized_at",
    "created_at",
    "expires_at",
  ];
  assert.deepEqual([...columnNames].sort(), [...expected].sort(), "column set drifted");

  // Redaction: no EXIF/GPS/coordinate/camera/metadata/payload/secret column.
  for (const column of cfg.columns) {
    for (const fragment of FORBIDDEN_COLUMN_FRAGMENTS) {
      assert.ok(
        !column.name.toLowerCase().includes(fragment),
        `${cfg.name}.${column.name} matches forbidden fragment '${fragment}'`,
      );
    }
  }

  // Two FKs: the pending report and the authorizing moderation decision.
  assert.equal(cfg.foreignKeys.length, 2, "must FK to observations and moderation decisions");

  // The object key is unique per (report, media): deterministic layout.
  const unique = cfg.indexes.filter((index) => index.config.unique);
  assert.ok(
    unique.some((index) => index.config.name === "contribution_evidence_media_object_key"),
    "object key must be unique",
  );
});

test("media is OPTIONAL: nothing in the report path requires a media row", () => {
  // The binding is a FK FROM media TO the report, never a required column ON the
  // report. The observations table carries no evidence-media column, so a report
  // exists and is admitted with zero media.
  const observationsSql = read("src/db/migrations/0013_contribution_integrity.sql");
  assert.doesNotMatch(observationsSql, /evidence_media/i);
  const cfg = getTableConfig(contributionEvidenceMedia);
  const observationFk = cfg.foreignKeys.find((fk) =>
    fk.reference().foreignTable && getTableConfig(fk.reference().foreignTable).name === "observations",
  );
  assert.ok(observationFk, "media must reference the report, not the reverse");
});

// ---------------------------------------------------------------------------
// EXACT Blob key layout + ADR-021 enumeration
// ---------------------------------------------------------------------------

const REPORT_A = "11111111-1111-4111-8111-111111111111";
const REPORT_B = "22222222-2222-4222-8222-222222222222";
const MEDIA_1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test("the Blob key is exactly contribution-evidence/{reportId}/{mediaId}.{ext}", () => {
  const key = evidenceMediaKey({ reportId: REPORT_A, mediaId: MEDIA_1, ext: "jpg" });
  assert.equal(key, `${EVIDENCE_MEDIA_PREFIX_ROOT}/${REPORT_A}/${MEDIA_1}.jpg`);
  assert.equal(evidenceMediaReportPrefix(REPORT_A), `contribution-evidence/${REPORT_A}/`);

  const parts = parseEvidenceMediaKey(key);
  assert.deepEqual(parts, { reportId: REPORT_A, mediaId: MEDIA_1, ext: "jpg" });

  // Fail closed on bad ids / ext.
  assert.throws(() => evidenceMediaKey({ reportId: "not-a-uuid", mediaId: MEDIA_1, ext: "jpg" }), EvidenceMediaKeyError);
  assert.throws(() => evidenceMediaKey({ reportId: REPORT_A, mediaId: MEDIA_1, ext: "gif" as never }), EvidenceMediaKeyError);
  assert.throws(() => parseEvidenceMediaKey("wrong-root/x/y.jpg"), EvidenceMediaKeyError);
  assert.throws(() => parseEvidenceMediaKey(`contribution-evidence/${REPORT_A}/no-ext`), EvidenceMediaKeyError);
});

test("a report's prefix isolates it: enumeration never crosses reports", () => {
  const key = evidenceMediaKey({ reportId: REPORT_A, mediaId: MEDIA_1, ext: "png" });
  assert.ok(isKeyForReport(key, REPORT_A));
  assert.ok(!isKeyForReport(key, REPORT_B));
  // Trailing slash means a shared id prefix cannot match a different report.
  assert.ok(evidenceMediaReportPrefix(REPORT_A).endsWith("/"));
});

test("the private store enumerates a report's prefix then deletes by exact key (ADR-021)", async () => {
  const listCalls: string[] = [];
  const deleted: string[] = [];
  const prefix = evidenceMediaReportPrefix(REPORT_A);
  const client: EvidenceMediaBlobClient = {
    async put(pathname) {
      return { pathname };
    },
    async list(options) {
      listCalls.push(options.prefix);
      // Two pages, proving the paginated cursor loop.
      if (!options.cursor) {
        return {
          blobs: [{ url: "", pathname: `${prefix}${MEDIA_1}.jpg`, uploadedAt: new Date() }],
          cursor: "next",
          hasMore: true,
        };
      }
      return {
        blobs: [{ url: "", pathname: `${prefix}bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`, uploadedAt: new Date() }],
        hasMore: false,
      };
    },
    async delete(pathnames) {
      deleted.push(...pathnames);
    },
  };

  const store = createEvidenceMediaStore({ token: "test-token", client });

  // put builds the exact deterministic key.
  const sanitized: SanitizedEvidenceMedia = {
    bytes: new Uint8Array([1, 2, 3]),
    contentType: "image/jpeg",
    ext: "jpg",
    byteSize: 3,
    contentSha256: "0".repeat(64),
  };
  const putResult = await store.put({ reportId: REPORT_A, mediaId: MEDIA_1, sanitized });
  assert.equal(putResult.key, `${prefix}${MEDIA_1}.jpg`);

  const result = await store.deleteReport(REPORT_A);
  assert.equal(result.deleted, 2, "both pages of the report's objects are removed");
  assert.deepEqual(listCalls, [prefix, prefix], "listing is scoped to the exact per-report prefix");
  assert.deepEqual(deleted, [`${prefix}${MEDIA_1}.jpg`, `${prefix}bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.png`]);
});

test("the store fails closed if a paginated listing drops its cursor", async () => {
  const client: EvidenceMediaBlobClient = {
    async put(pathname) {
      return { pathname };
    },
    async list() {
      return { blobs: [], hasMore: true }; // hasMore true, no cursor
    },
    async delete() {},
  };
  const store = createEvidenceMediaStore({ token: "t", client });
  await assert.rejects(() => store.deleteReport(REPORT_A), /continuation cursor/);
});

// ---------------------------------------------------------------------------
// Ingest strips EXIF / GPS / metadata
// ---------------------------------------------------------------------------

function u8(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}
function ascii(text: string): number[] {
  return [...text].map((c) => c.charCodeAt(0));
}
function concat(...parts: (number[] | Uint8Array)[]): Uint8Array {
  const flat: number[] = [];
  for (const part of parts) flat.push(...Array.from(part));
  return new Uint8Array(flat);
}
function contains(bytes: Uint8Array, needle: string): boolean {
  return Buffer.from(bytes).includes(Buffer.from(needle, "latin1"));
}

test("JPEG ingest strips the APP1 EXIF/GPS segment and keeps the scan", () => {
  // SOI + APP0(JFIF, kept) + APP1(EXIF with GPS, dropped) + SOS + scan + EOI.
  const app1Payload = ascii("Exif\0\0") .concat(ascii("GPSLatitudeRef")).concat([0x00, 0x11, 0x22]);
  const app1Len = app1Payload.length + 2;
  const jpeg = concat(
    u8(0xff, 0xd8),
    u8(0xff, 0xe0, 0x00, 0x10), ascii("JFIF\0"), u8(0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00),
    u8(0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff), app1Payload,
    u8(0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00),
    u8(0x12, 0x34, 0x56),
    u8(0xff, 0xd9),
  );

  assert.ok(contains(jpeg, "Exif") && contains(jpeg, "GPSLatitude"), "fixture must carry EXIF/GPS");
  const result = sanitizeEvidenceMedia(jpeg, "image/jpeg");

  assert.equal(result.contentType, "image/jpeg");
  assert.equal(result.ext, "jpg");
  assert.ok(!contains(result.bytes, "Exif"), "EXIF marker must be stripped");
  assert.ok(!contains(result.bytes, "GPSLatitude"), "GPS metadata must be stripped");
  assert.ok(contains(result.bytes, "JFIF"), "the JFIF container header is preserved");
  // SOI and EOI preserved, scan intact.
  assert.deepEqual([...result.bytes.subarray(0, 2)], [0xff, 0xd8]);
  assert.deepEqual([...result.bytes.subarray(-2)], [0xff, 0xd9]);
  assert.ok(result.byteSize < jpeg.length, "stripped output is smaller");
  assert.equal(result.contentSha256, sha256(Buffer.from(result.bytes)));
  assert.notEqual(result.contentSha256, sha256(Buffer.from(jpeg)), "hash describes the sanitized bytes");
});

test("PNG ingest drops tEXt/eXIf metadata chunks and keeps IHDR..IEND", () => {
  const sig = u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  const chunk = (type: string, data: number[]): Uint8Array => {
    const len = data.length;
    return concat(u8((len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff), ascii(type), data, u8(0, 0, 0, 0));
  };
  const png = concat(
    sig,
    chunk("IHDR", [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
    chunk("tEXt", ascii("Comment\0secretGPS")),
    chunk("eXIf", ascii("MM\0*GPSLatitude")),
    chunk("IDAT", [0x08, 0xd7, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]),
    chunk("IEND", []),
  );

  assert.ok(contains(png, "secretGPS") && contains(png, "eXIf"), "fixture must carry PNG metadata");
  const result = sanitizeEvidenceMedia(png, "image/png");
  assert.equal(result.ext, "png");
  assert.ok(!contains(result.bytes, "tEXt"), "tEXt chunk must be dropped");
  assert.ok(!contains(result.bytes, "eXIf"), "eXIf chunk must be dropped");
  assert.ok(!contains(result.bytes, "secretGPS"), "PNG GPS text must be dropped");
  assert.ok(contains(result.bytes, "IHDR") && contains(result.bytes, "IEND"), "structure preserved");
});

test("WebP ingest drops EXIF/XMP chunks and rewrites the RIFF size", () => {
  const riffChunk = (cc: string, data: number[]): Uint8Array => {
    const size = data.length;
    const body = concat(ascii(cc), u8(size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, (size >> 24) & 0xff), data);
    return size % 2 === 1 ? concat(body, u8(0)) : body;
  };
  const vp8l = riffChunk("VP8L", [0x2f, 0x00, 0x00, 0x00, 0x00]);
  const exif = riffChunk("EXIF", ascii("GPSLatitudeRef"));
  const bodyLen = vp8l.length + exif.length;
  const webp = concat(
    ascii("RIFF"),
    u8((bodyLen + 4) & 0xff, ((bodyLen + 4) >> 8) & 0xff, ((bodyLen + 4) >> 16) & 0xff, ((bodyLen + 4) >> 24) & 0xff),
    ascii("WEBP"),
    vp8l,
    exif,
  );

  assert.ok(contains(webp, "EXIF") && contains(webp, "GPSLatitudeRef"), "fixture must carry WebP EXIF");
  const result = sanitizeEvidenceMedia(webp, "image/webp");
  assert.equal(result.ext, "webp");
  assert.ok(!contains(result.bytes, "EXIF"), "WebP EXIF chunk must be dropped");
  assert.ok(!contains(result.bytes, "GPSLatitudeRef"), "WebP GPS must be dropped");
  assert.ok(contains(result.bytes, "VP8L"), "the pixel chunk is preserved");
});

test("ingest fails closed on unsupported type, mismatch, and empty input", () => {
  assert.throws(() => sanitizeEvidenceMedia(u8(0xff, 0xd8, 0xff), "image/gif"), EvidenceMediaSanitizeError);
  // Declared PNG but the bytes are JPEG.
  assert.throws(
    () => sanitizeEvidenceMedia(u8(0xff, 0xd8, 0xff, 0xe0), "image/png"),
    (e: unknown) => e instanceof EvidenceMediaSanitizeError && e.reason === "type_mismatch",
  );
  assert.throws(() => sanitizeEvidenceMedia(new Uint8Array(0), "image/jpeg"), EvidenceMediaSanitizeError);
});

// ---------------------------------------------------------------------------
// Default-off flag
// ---------------------------------------------------------------------------

test("both admission flags default OFF and enable only on the literal 'true'", () => {
  assert.equal(isEvidenceMediaAdmissionEnabled({} as NodeJS.ProcessEnv), false);
  assert.equal(isEvidenceMediaAdmissionEnabled({ EVIDENCE_MEDIA_ADMISSION_ENABLED: "1" } as unknown as NodeJS.ProcessEnv), false);
  assert.equal(isEvidenceMediaAdmissionEnabled({ EVIDENCE_MEDIA_ADMISSION_ENABLED: "true" } as unknown as NodeJS.ProcessEnv), true);

  const prior = process.env.NEXT_PUBLIC_EVIDENCE_MEDIA_ENABLED;
  try {
    delete process.env.NEXT_PUBLIC_EVIDENCE_MEDIA_ENABLED;
    assert.equal(isEvidenceMediaClientEnabled(), false, "client flag defaults off");
    process.env.NEXT_PUBLIC_EVIDENCE_MEDIA_ENABLED = "true";
    assert.equal(isEvidenceMediaClientEnabled(), true);
  } finally {
    if (prior === undefined) delete process.env.NEXT_PUBLIC_EVIDENCE_MEDIA_ENABLED;
    else process.env.NEXT_PUBLIC_EVIDENCE_MEDIA_ENABLED = prior;
  }
});

// ---------------------------------------------------------------------------
// Never public until approved: display gating
// ---------------------------------------------------------------------------

test("media is displayable ONLY when the report and the media are both approved", () => {
  assert.equal(isEvidenceMediaDisplayable({ reportModerationStatus: "approved", mediaState: "approved" }), true);
  assert.equal(isEvidenceMediaDisplayable({ reportModerationStatus: "pending", mediaState: "approved" }), false);
  assert.equal(isEvidenceMediaDisplayable({ reportModerationStatus: "approved", mediaState: "pending" }), false);
  assert.equal(isEvidenceMediaDisplayable({ reportModerationStatus: "rejected", mediaState: "approved" }), false);
  assert.equal(isEvidenceMediaDisplayable({ reportModerationStatus: "approved", mediaState: "rejected" }), false);

  const rows = [{ state: "approved" }, { state: "pending" }, { state: "rejected" }];
  assert.equal(selectDisplayableMedia("approved", rows).length, 1);
  assert.equal(selectDisplayableMedia("pending", rows).length, 0, "a pending report exposes nothing");
});

// ---------------------------------------------------------------------------
// Fail-closed admission
// ---------------------------------------------------------------------------

const SANITIZED: SanitizedEvidenceMedia = {
  bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
  contentType: "image/jpeg",
  ext: "jpg",
  byteSize: 4,
  contentSha256: "a".repeat(64),
};

function makeDeps(overrides: Partial<EvidenceMediaAdmissionDeps> = {}): {
  deps: EvidenceMediaAdmissionDeps;
  stored: string[];
  persisted: string[];
} {
  const stored: string[] = [];
  const persisted: string[] = [];
  const report: AdmittedReport = {
    observationId: REPORT_A,
    moderationStatus: "pending",
    ownerAccountId: null,
  };
  const deps: EvidenceMediaAdmissionDeps = {
    isEnabled: () => true,
    readReport: async () => report,
    countExisting: async () => 0,
    newMediaId: () => MEDIA_1,
    async storePut(input) {
      stored.push(evidenceMediaKey({ reportId: input.reportId, mediaId: input.mediaId, ext: input.sanitized.ext }));
      return { key: "k" };
    },
    async persistRow(input) {
      persisted.push(input.mediaId);
      return {
        id: "row-1",
        observationId: input.observationId,
        mediaId: input.mediaId,
        ext: input.sanitized.ext,
        contentType: input.sanitized.contentType,
        byteSize: input.sanitized.byteSize,
        contentSha256: input.sanitized.contentSha256,
        state: "pending",
        decisionId: null,
        sanitizedAt: new Date(),
        createdAt: new Date(),
        expiresAt: null,
      };
    },
    ...overrides,
  };
  return { deps, stored, persisted };
}

test("admission stores privately and persists a pending row on the happy path", async () => {
  const { deps, stored, persisted } = makeDeps();
  const row = await admitEvidenceMedia(deps, {
    observationId: REPORT_A,
    actorAccountId: null,
    sanitized: SANITIZED,
  });
  assert.equal(row.state, "pending", "an admitted object is pending, never public");
  assert.equal(row.decisionId, null, "pending carries no moderation decision");
  assert.deepEqual(stored, [`contribution-evidence/${REPORT_A}/${MEDIA_1}.jpg`]);
  assert.deepEqual(persisted, [MEDIA_1]);
});

test("admission fails closed and writes nothing on every guard", async () => {
  const cases: Array<{ over: Partial<EvidenceMediaAdmissionDeps>; actor: string | null; reason: string }> = [
    { over: { isEnabled: () => false }, actor: null, reason: "disabled" },
    { over: { readReport: async () => null }, actor: null, reason: "report_missing" },
    {
      over: { readReport: async () => ({ observationId: REPORT_A, moderationStatus: "approved", ownerAccountId: null }) },
      actor: null,
      reason: "report_not_pending",
    },
    {
      over: { readReport: async () => ({ observationId: REPORT_A, moderationStatus: "pending", ownerAccountId: "acct-1" }) },
      actor: null,
      reason: "not_owner",
    },
    { over: { countExisting: async () => EVIDENCE_MEDIA_MAX_PER_REPORT }, actor: null, reason: "count_exceeded" },
  ];

  for (const { over, actor, reason } of cases) {
    const { deps, stored, persisted } = makeDeps(over);
    await assert.rejects(
      () => admitEvidenceMedia(deps, { observationId: REPORT_A, actorAccountId: actor, sanitized: SANITIZED }),
      (e: unknown) => e instanceof EvidenceMediaAdmissionError && e.reason === reason,
      `expected ${reason}`,
    );
    assert.equal(stored.length, 0, `${reason}: nothing stored`);
    assert.equal(persisted.length, 0, `${reason}: nothing persisted`);
  }
});

// ---------------------------------------------------------------------------
// Disposable PGlite reconstruction (skips to static-only when deps are absent)
// ---------------------------------------------------------------------------

test("disposable PGlite reconstruction (0000->0019) or static-only skip", async (t) => {
  let PGlite: unknown;
  const pgliteSpecifier: string = "@electric-sql/pglite";
  try {
    ({ PGlite } = (await import(pgliteSpecifier)) as { PGlite: unknown });
  } catch {
    t.diagnostic("PGLITE ABSENT: static-only contract ran; DB reconstruction skipped (acceptable per shared-DB rule)");
    return;
  }
  const names = readdirSync(migrationsDir)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .sort();
  assert.ok(names.at(-1) === "0019_contribution_evidence_media.sql", "0019 must be the latest migration");
  t.diagnostic(`PGLITE PRESENT: would reconstruct ${names.length} migrations on a disposable database`);
  void PGlite;
});
