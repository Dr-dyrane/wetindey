import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

const repairPath = "src/db/migrations/0016_contribution_review_acl_repair.sql";
const repair = read(repairPath);
const pillar = read("src/db/pillars/90-contribution-security.sql");
const immutable0015 = {
  migration: "src/db/migrations/0015_contribution_moderation_operations.sql",
  migrationSha256: "d4d452a4e7f3dba7fdd68ce63c2b447e974c97b727d12dbd2c8e8261334559a2",
  snapshot: "src/db/migrations/meta/0015_snapshot.json",
  snapshotSha256: "4d788004eb6ce55fd1266d4bc9925a836d73aaa605658fdec5ebb89079c90349",
  manifest: "src/db/migrations/meta/0015_release_manifest.json",
  manifestSha256: "8a5d4a12a420d2e3be9de6f380942c0b005a5ef94fbf8c2196e507388b3ba917",
} as const;
const snapshot = JSON.parse(read("src/db/migrations/meta/0016_snapshot.json")) as {
  id: string;
  prevId: string;
  version: string;
  dialect: string;
};
const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
  entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>;
};
const manifest = JSON.parse(read("src/db/migrations/meta/0016_release_manifest.json")) as {
  kind: string;
  release: string;
  status: string;
  shared_database_applied: boolean;
  first_shared_application_frozen: boolean;
  parent_release: string;
  parent_snapshot_id: string;
  result_snapshot_id: string;
  artifacts: Record<string, { path: string; sha256: string; entry_index?: number; entry_when?: string }>;
  source_sha256: Record<string, string>;
};

test("0016 preserves the immutable 0015 release and advances detached metadata", () => {
  assert.equal(sha256(read(immutable0015.migration)), immutable0015.migrationSha256);
  assert.equal(sha256(read(immutable0015.snapshot)), immutable0015.snapshotSha256);
  assert.equal(sha256(read(immutable0015.manifest)), immutable0015.manifestSha256);

  assert.equal(snapshot.prevId, "463a649f-a760-529a-b1c9-b62eb0221749");
  assert.match(snapshot.id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(snapshot.version, "7");
  assert.equal(snapshot.dialect, "postgresql");
  assert.deepEqual(journal.entries.slice(-2), [
    {
      idx: 15,
      version: "7",
      when: 1784653200000,
      tag: "0015_contribution_moderation_operations",
      breakpoints: true,
    },
    {
      idx: 16,
      version: "7",
      when: 1784739600000,
      tag: "0016_contribution_review_acl_repair",
      breakpoints: true,
    },
  ]);

  assert.equal(manifest.kind, "release_manifest");
  assert.equal(manifest.release, "0016_contribution_review_acl_repair");
  assert.equal(manifest.status, "candidate_unapplied");
  assert.equal(manifest.shared_database_applied, false);
  assert.equal(manifest.first_shared_application_frozen, false);
  assert.equal(manifest.parent_release, "0015_contribution_moderation_operations");
  assert.equal(manifest.parent_snapshot_id, snapshot.prevId);
  assert.equal(manifest.result_snapshot_id, snapshot.id);
  for (const artifact of Object.values(manifest.artifacts)) {
    assert.equal(sha256(read(artifact.path)), artifact.sha256, `${artifact.path} manifest hash mismatch`);
  }
  for (const [sourcePath, sourceHash] of Object.entries(manifest.source_sha256)) {
    assert.equal(sha256(read(sourcePath)), sourceHash, `${sourcePath} source hash mismatch`);
  }
});

test("0016 converges only the review-detail ACL while the owner role is active", () => {
  const ownerRoleStart = repair.indexOf("SET LOCAL ROLE wetindey_contribution_owner;");
  const revokePublic = repair.indexOf("REVOKE ALL ON FUNCTION public.contribution_review_detail(uuid, uuid) FROM PUBLIC;");
  const grantExecute = repair.indexOf(
    "GRANT EXECUTE ON FUNCTION public.contribution_review_detail(uuid, uuid)\n  TO wetindey_contribution_owner, wetindey_contribution_moderator;",
  );
  const resetRole = repair.indexOf("RESET ROLE;");

  assert.match(repair, /GRANT wetindey_contribution_owner TO SESSION_USER WITH INHERIT FALSE;/);
  assert.match(repair, /GRANT wetindey_contribution_owner TO SESSION_USER WITH SET TRUE;/);
  assert.match(repair, /GRANT CREATE ON SCHEMA public TO wetindey_contribution_owner;/);
  assert.ok(ownerRoleStart >= 0 && ownerRoleStart < revokePublic && revokePublic < grantExecute && grantExecute < resetRole);
  assert.match(repair, /REVOKE CREATE ON SCHEMA public FROM wetindey_contribution_owner;/);
  assert.match(repair, /REVOKE wetindey_contribution_owner FROM SESSION_USER GRANTED BY SESSION_USER;/);
  assert.match(repair, /pg_catalog\.aclexplode\(/);
  assert.match(repair, /privilege\.grantee NOT IN \([\s\S]*procedure\.proowner,[\s\S]*'wetindey_contribution_moderator'::regrole/);
  assert.match(repair, /pg_has_role\(session_user, 'wetindey_contribution_owner', 'SET'\)/);
  assert.match(repair, /has_schema_privilege\([\s\S]*'wetindey_contribution_owner',[\s\S]*'public',[\s\S]*'CREATE'/);
  assert.doesNotMatch(repair, /CREATE(?: OR REPLACE)? FUNCTION|ALTER FUNCTION|CREATE TABLE|ALTER TABLE|CREATE POLICY|GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON TABLE/i);
  assert.doesNotMatch(repair, /contribution_review_detail\([\s\S]*?RETURNS TABLE/i);
  assert.match(pillar, /GRANT EXECUTE ON FUNCTION public\.contribution_review_detail\(uuid, uuid\)\s+TO wetindey_contribution_owner, wetindey_contribution_moderator;/);
});

test("0016 remains a transactional, idempotent ACL repair rather than a service rewrite", () => {
  const topLevelSql = repair.replace(/DO \$\$[\s\S]*?\$\$;/g, "");
  assert.doesNotMatch(topLevelSql, /\b(?:BEGIN|COMMIT|ROLLBACK)\b/);
  assert.match(repair, /REVOKE ALL ON FUNCTION public\.contribution_review_detail\(uuid, uuid\) FROM PUBLIC;/);
  assert.match(repair, /GRANT EXECUTE ON FUNCTION public\.contribution_review_detail\(uuid, uuid\)\s+TO wetindey_contribution_owner, wetindey_contribution_moderator;/);
  assert.match(repair, /review-detail execute escaped owner and moderator roles/);
});
