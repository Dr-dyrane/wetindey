import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const repairPath = "src/db/migrations/0017_contribution_pending_queue_shape_repair.sql";
const repair = read(repairPath);
const pillar = read("src/db/pillars/80-contribution-services.sql");
const immutableLineage = [
  { idx: 0, tag: "0000_careless_piledriver", sqlSha256: "71be7b38a05007fdb05c4f3a773c643796f090305c78379c2813a37cb88933fd", snapshotId: "3fd2d0fa-7db3-495d-b3f1-eacb57e8ae3b", snapshotPrevId: "00000000-0000-0000-0000-000000000000" },
  { idx: 1, tag: "0001_cute_harrier", sqlSha256: "6ed801dcd1e68d6214539aa48bcec349115bcdd1a5cc82f103387275bf5c2ccb", snapshotId: "47e94a9b-30ca-462a-b1af-8b283c7df9f8", snapshotPrevId: "3fd2d0fa-7db3-495d-b3f1-eacb57e8ae3b" },
  { idx: 2, tag: "0002_calm_meteorite", sqlSha256: "0ce00cbcd239ac0cc52d94e5e423b3902514116eda6b2eabd910a867bd840ff7", snapshotId: "f8468361-8eb3-4a5c-8eee-f6fabbf3d055", snapshotPrevId: "47e94a9b-30ca-462a-b1af-8b283c7df9f8" },
  { idx: 3, tag: "0003_condemned_sally_floyd", sqlSha256: "0cce50bd4f13b5a6956452da588ce4ccc5cada203303370b472eba374735ce81", snapshotId: "6a5e6e0b-be90-45a7-b60e-ca9b30e26d71", snapshotPrevId: "f8468361-8eb3-4a5c-8eee-f6fabbf3d055" },
  { idx: 4, tag: "0004_old_mordo", sqlSha256: "b7b6e97b3c40af6f0b34f34bf06cb6ff206fb0f127c38f444c5099bffca42645", snapshotId: "441af0d2-6cde-464f-b391-dc9f2fd2b0a8", snapshotPrevId: "6a5e6e0b-be90-45a7-b60e-ca9b30e26d71" },
  { idx: 5, tag: "0005_handy_brood", sqlSha256: "d98917554fda9e094c57db5f0195063c8c803cae47b601dcb93e14502928c509", snapshotId: "be5945ba-065b-49c5-9623-6297981d9527", snapshotPrevId: "441af0d2-6cde-464f-b391-dc9f2fd2b0a8" },
  { idx: 6, tag: "0006_ordinary_meltdown", sqlSha256: "1373746f002441dd43ce8185fc2e9cdccbaaf513768557e56ffbf208b9235fa3", snapshotId: "edb675b7-d214-4ac8-a31e-2775bb15c245", snapshotPrevId: "be5945ba-065b-49c5-9623-6297981d9527" },
  { idx: 7, tag: "0007_gray_king_cobra", sqlSha256: "c5d01c6bfb88b9386abe6fa3c9f68d5d345e9bd9f0f59bfb5e26027dfc2dc6f6", snapshotId: "f598521d-3002-410b-9643-2e6d49942fce", snapshotPrevId: "edb675b7-d214-4ac8-a31e-2775bb15c245" },
  { idx: 8, tag: "0008_sturdy_lockjaw", sqlSha256: "150356e3db8061d2934fdc1176b84d2cd478aec2c9988550fac8bb26b2480073", snapshotId: "d225be22-07d6-4680-904a-a17811fed386", snapshotPrevId: "f598521d-3002-410b-9643-2e6d49942fce" },
  { idx: 9, tag: "0009_observation_provenance", sqlSha256: "34dd394d6d4f1aad24a73edee5eb88a93441449a1ff86985b60d3ba04f927b4c", snapshotId: "df811920-661e-4c4d-9de1-c25dac9dc3fb", snapshotPrevId: "d225be22-07d6-4680-904a-a17811fed386" },
  { idx: 10, tag: "0010_public_source_ingestion_boundary", sqlSha256: "9aa8cc511374010f1deb68ec330573a9c4940c2aff1188218d5f3e841fccd7fe", snapshotId: "f44b44d4-5bc4-496d-b17b-c400d9838b92", snapshotPrevId: "df811920-661e-4c4d-9de1-c25dac9dc3fb" },
  { idx: 11, tag: "0011_classy_the_stranger", sqlSha256: "1ad4a33a06dfdc58affcfa92dc7085b5843478e09761ee26a24c7cd6b3c0151b", snapshotId: "13e8dce7-506e-45c4-a5fe-630eb03fff1e", snapshotPrevId: "f44b44d4-5bc4-496d-b17b-c400d9838b92" },
  { idx: 12, tag: "0012_guarded_presence", sqlSha256: "a8b31034aae22a6e9fa62416df8a1bb483c6783947fdf742c674e82cac373302", snapshotId: "3f304405-9ec4-490f-bef4-591126fcdbb8", snapshotPrevId: "13e8dce7-506e-45c4-a5fe-630eb03fff1e" },
  { idx: 13, tag: "0013_contribution_integrity", sqlSha256: "052769850c3d633230d9ec109c2b09067b73a686cadb7c139a613622184f0f0a", snapshotId: "9ab87346-01b0-4a36-a3f1-bc3708d079a1", snapshotPrevId: "3f304405-9ec4-490f-bef4-591126fcdbb8" },
  { idx: 14, tag: "0014_presence_capabilities", sqlSha256: "ed532eab5f7941245cfebb66463a2194ab9df235b30f9fd678e1c0e1065008bf", snapshotId: "667de345-b0c2-43f5-9e37-a7c00e30ea50", snapshotPrevId: "9ab87346-01b0-4a36-a3f1-bc3708d079a1" },
  { idx: 15, tag: "0015_contribution_moderation_operations", sqlSha256: "d4d452a4e7f3dba7fdd68ce63c2b447e974c97b727d12dbd2c8e8261334559a2", snapshotId: "463a649f-a760-529a-b1c9-b62eb0221749", snapshotPrevId: "667de345-b0c2-43f5-9e37-a7c00e30ea50" },
  { idx: 16, tag: "0016_contribution_review_acl_repair", sqlSha256: "669864c8a532b2b941dcd30258b2cb7a1e1c9a7406e4f5d6ddf4a5a3bbb6d6ec", snapshotId: "c85fd31e-0793-5ded-8c66-9fbcf12d1f4c", snapshotPrevId: "463a649f-a760-529a-b1c9-b62eb0221749" },
] as const;
const immutable0016Manifest = {
  path: "src/db/migrations/meta/0016_release_manifest.json",
  sha256: "48829525ef879034cc2ebd74b2480e609f0af5099001f9db62b0bc75728be5dd",
} as const;
const immutablePillarOutsideQueue = {
  base: "4b937260b21ddd7ad94663454626b33441de1976",
  sha256: "e7b35a3ced3c2f1131a9a2515075b9c5fcb376f3e69604132720e8620c6f8d6f",
} as const;
const snapshot0016 = JSON.parse(read("src/db/migrations/meta/0016_snapshot.json")) as Record<string, unknown>;
const snapshot = JSON.parse(read("src/db/migrations/meta/0017_snapshot.json")) as Record<string, unknown> & {
  id: string;
  prevId: string;
  version: string;
  dialect: string;
};
const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
  entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>;
};
const manifest = JSON.parse(read("src/db/migrations/meta/0017_release_manifest.json")) as {
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

function queueFunction(source: string) {
  const match = source.match(
    /CREATE OR REPLACE FUNCTION public\.contribution_pending_queue\([\s\S]*?\n\$\$;/,
  );
  assert.ok(match, "contribution_pending_queue definition must exist");
  return match[0];
}

function normalizePillarOutsideQueue(source: string) {
  const definition = queueFunction(source);
  assert.equal(source.split(definition).length - 1, 1, "pillar must contain one queue definition");
  return source.replace(definition, "<CONTRIBUTION_PENDING_QUEUE_FUNCTION>");
}

function snapshotWithoutLinkage(source: Record<string, unknown>) {
  const normalized = structuredClone(source);
  delete normalized.id;
  delete normalized.prevId;
  return normalized;
}

function replaceExactlyOnce(source: string, bare: string, repaired: string) {
  assert.equal(source.split(bare).length - 1, 1, `${bare.trim()} must occur exactly once in 0013`);
  return source.replace(bare, repaired);
}

const predecessorQueue = queueFunction(read("src/db/migrations/0013_contribution_integrity.sql"));
const expectedRepair = replaceExactlyOnce(
  replaceExactlyOnce(
    predecessorQueue,
    "    observation.availability_state,",
    "    observation.availability_state::text,",
  ),
  "    observation.collection_method,",
  "    observation.collection_method::text,",
);

test("0017 freezes the exact ordered 0000-0016 SQL, journal, and snapshot lineage", () => {
  assert.equal(immutableLineage.length, 17);
  assert.deepEqual(
    journal.entries.slice(0, 17).map(({ idx, tag }) => ({ idx, tag })),
    immutableLineage.map(({ idx, tag }) => ({ idx, tag })),
  );
  for (const release of immutableLineage) {
    assert.equal(
      sha256(read(`src/db/migrations/${release.tag}.sql`)),
      release.sqlSha256,
      `${release.tag} SQL changed`,
    );
    const predecessorSnapshot = JSON.parse(
      read(`src/db/migrations/meta/${String(release.idx).padStart(4, "0")}_snapshot.json`),
    ) as { id: string; prevId: string };
    assert.equal(predecessorSnapshot.id, release.snapshotId, `${release.tag} snapshot id changed`);
    assert.equal(
      predecessorSnapshot.prevId,
      release.snapshotPrevId,
      `${release.tag} snapshot prevId changed`,
    );
    if (release.idx > 0) {
      assert.equal(
        release.snapshotPrevId,
        immutableLineage[release.idx - 1].snapshotId,
        `${release.tag} snapshot chain is detached from its predecessor`,
      );
    }
  }
  assert.equal(sha256(read(immutable0016Manifest.path)), immutable0016Manifest.sha256);
});

test("0017 advances detached metadata without claiming runtime application", () => {
  assert.equal(journal.entries.length, 18);

  assert.equal(snapshot.id, "6f49b946-260e-5ed7-b740-189bad171017");
  assert.equal(snapshot.prevId, "c85fd31e-0793-5ded-8c66-9fbcf12d1f4c");
  assert.equal(snapshot.version, "7");
  assert.equal(snapshot.dialect, "postgresql");
  assert.deepEqual(journal.entries.slice(-2), [
    {
      idx: 16,
      version: "7",
      when: 1784739600000,
      tag: "0016_contribution_review_acl_repair",
      breakpoints: true,
    },
    {
      idx: 17,
      version: "7",
      when: 1784743200000,
      tag: "0017_contribution_pending_queue_shape_repair",
      breakpoints: true,
    },
  ]);

  assert.equal(manifest.kind, "release_manifest");
  assert.equal(manifest.release, "0017_contribution_pending_queue_shape_repair");
  assert.equal(manifest.status, "candidate_unapplied");
  assert.equal(manifest.shared_database_applied, false);
  assert.equal(manifest.first_shared_application_frozen, false);
  assert.equal(manifest.parent_release, "0016_contribution_review_acl_repair");
  assert.equal(manifest.parent_snapshot_id, snapshot.prevId);
  assert.equal(manifest.result_snapshot_id, snapshot.id);
  assert.deepEqual(
    snapshotWithoutLinkage(snapshot),
    snapshotWithoutLinkage(snapshot0016),
    "0017 snapshot may differ from immutable 0016 only by id and prevId",
  );
  for (const artifact of Object.values(manifest.artifacts)) {
    assert.equal(sha256(read(artifact.path)), artifact.sha256, `${artifact.path} manifest hash mismatch`);
  }
  for (const [sourcePath, sourceHash] of Object.entries(manifest.source_sha256)) {
    assert.equal(sha256(read(sourcePath)), sourceHash, `${sourcePath} source hash mismatch`);
  }
});

test("0017 changes only the two pending-queue result expressions", () => {
  const canonical = queueFunction(pillar);
  const migrated = queueFunction(repair);
  assert.equal(canonical, expectedRepair, "pillar must be exactly the two-cast repair of immutable 0013");
  assert.equal(migrated, expectedRepair, "migration must be exactly the two-cast repair of immutable 0013");
  assert.equal(
    sha256(normalizePillarOutsideQueue(pillar)),
    immutablePillarOutsideQueue.sha256,
    `pillar content outside the queue function changed from ${immutablePillarOutsideQueue.base}`,
  );
  assert.notEqual(expectedRepair, predecessorQueue);
  assert.doesNotMatch(predecessorQueue, /observation\.(?:availability_state|collection_method)::text/);
  assert.equal((canonical.match(/observation\.availability_state::text/g) ?? []).length, 1);
  assert.equal((canonical.match(/observation\.collection_method::text/g) ?? []).length, 1);
  assert.doesNotMatch(canonical, /observation\.availability_state,/);
  assert.doesNotMatch(canonical, /observation\.collection_method,/);
  assert.match(canonical, /RETURNS TABLE \([\s\S]*availability_state text,[\s\S]*collection_method text,/);
  assert.match(canonical, /PERFORM public\.contribution_assert_moderator\(p_actor\);/);
  assert.match(canonical, /p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100/);
  assert.match(canonical, /WHERE observation\.admission_id IS NOT NULL[\s\S]*public\.contribution_effective_decision_id\(observation\.id\) IS NULL/);
  assert.match(canonical, /ORDER BY observation\.submitted_at, observation\.id[\s\S]*LIMIT p_limit;/);
  assert.doesNotMatch(repair, /CREATE TABLE|ALTER TABLE|CREATE TYPE|ALTER TYPE|CREATE POLICY|ALTER POLICY|GRANT (?:SELECT|INSERT|UPDATE|DELETE) ON TABLE/i);
});

test("0017 preserves owner and moderator-only execution while cleaning temporary privilege", () => {
  const membershipBaseline = repair.indexOf("CREATE TEMP TABLE pg_temp.wetindey_0017_owner_membership_baseline");
  const stateBaseline = repair.indexOf("CREATE TEMP TABLE pg_temp.wetindey_0017_owner_state_baseline");
  const firstGrant = repair.indexOf("GRANT wetindey_contribution_owner TO SESSION_USER WITH INHERIT FALSE;");
  const setOwner = repair.indexOf("SET LOCAL ROLE wetindey_contribution_owner;");
  const replaceQueue = repair.indexOf("CREATE OR REPLACE FUNCTION public.contribution_pending_queue(");
  const resetOwner = repair.indexOf("RESET ROLE;");
  assert.ok(membershipBaseline >= 0 && membershipBaseline < stateBaseline && stateBaseline < firstGrant);
  assert.match(repair, /pg_has_role\(session_user, 'wetindey_contribution_owner', 'MEMBER'\) AS member_state/);
  assert.match(repair, /pg_has_role\(session_user, 'wetindey_contribution_owner', 'USAGE'\) AS usage_state/);
  assert.match(repair, /pg_has_role\(session_user, 'wetindey_contribution_owner', 'SET'\) AS set_state/);
  assert.match(repair, /baseline\.usage_state[\s\S]*OR baseline\.set_state[\s\S]*OR baseline\.owner_schema_create/);
  assert.match(repair, /GRANT wetindey_contribution_owner TO SESSION_USER WITH INHERIT FALSE;/);
  assert.match(repair, /GRANT wetindey_contribution_owner TO SESSION_USER WITH SET TRUE;/);
  assert.match(repair, /GRANT CREATE ON SCHEMA public TO wetindey_contribution_owner;/);
  assert.ok(setOwner >= 0 && setOwner < replaceQueue && replaceQueue < resetOwner);
  assert.match(repair, /REVOKE CREATE ON SCHEMA public FROM wetindey_contribution_owner;/);
  assert.match(repair, /REVOKE wetindey_contribution_owner FROM SESSION_USER GRANTED BY SESSION_USER;/);
  assert.match(repair, /procedure\.proowner[\s\S]*IS DISTINCT FROM 'wetindey_contribution_owner'::regrole/);
  assert.match(repair, /has_function_privilege\([\s\S]*'wetindey_contribution_owner',[\s\S]*'public\.contribution_pending_queue\(uuid, integer\)',[\s\S]*'EXECUTE'/);
  assert.match(repair, /has_function_privilege\([\s\S]*'wetindey_contribution_moderator',[\s\S]*'public\.contribution_pending_queue\(uuid, integer\)',[\s\S]*'EXECUTE'/);
  assert.match(repair, /pg_catalog\.aclexplode\(/);
  assert.match(repair, /privilege\.grantee NOT IN \([\s\S]*procedure\.proowner,[\s\S]*'wetindey_contribution_moderator'::regrole/);
  assert.doesNotMatch(repair, /GRANT EXECUTE ON FUNCTION public\.contribution_pending_queue|REVOKE ALL ON FUNCTION public\.contribution_pending_queue/i);
  assert.match(repair, /membership\.admin_option/);
  assert.match(repair, /membership\.set_option/);
  assert.match(repair, /membership\.inherit_option/);
  assert.match(repair, /WITH current_membership AS \(/);
  assert.equal((repair.match(/\bEXCEPT\b/g) ?? []).length, 2);
  assert.match(repair, /FROM pg_temp\.wetindey_0017_owner_membership_baseline[\s\S]*EXCEPT[\s\S]*FROM current_membership/);
  assert.match(repair, /FROM current_membership[\s\S]*EXCEPT[\s\S]*FROM pg_temp\.wetindey_0017_owner_membership_baseline/);
  assert.match(repair, /baseline\.member_state IS DISTINCT FROM[\s\S]*'MEMBER'/);
  assert.match(repair, /baseline\.usage_state IS DISTINCT FROM[\s\S]*'USAGE'/);
  assert.match(repair, /baseline\.set_state IS DISTINCT FROM[\s\S]*'SET'/);
  assert.match(repair, /baseline\.owner_schema_create IS DISTINCT FROM[\s\S]*has_schema_privilege/);
  assert.match(repair, /did not restore the exact direct owner membership baseline/);
  assert.match(repair, /did not restore the exact owner capability baseline/);
  assert.doesNotMatch(repair, /WITH RECURSIVE membership_path/);
});

test("0017 leaves transaction ownership to Drizzle and is structurally repeatable", () => {
  const topLevelSql = repair.replace(/DO \$\$[\s\S]*?\$\$;/g, "").replace(queueFunction(repair), "");
  assert.doesNotMatch(topLevelSql, /^\s*(?:BEGIN|COMMIT|ROLLBACK)\b/gm);
  assert.doesNotMatch(repair, /EXCEPTION WHEN|EXCEPTION;/);
  assert.match(repair, /CREATE OR REPLACE FUNCTION public\.contribution_pending_queue\(/);
  assert.match(repair, /pending-queue execute escaped owner and moderator roles/);
});
