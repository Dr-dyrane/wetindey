import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { resolve } from "node:path";

import {
  appendUnique,
  buildCandidateFingerprint,
  buildCaptureIdentity,
  buildRunKey,
  canRetainCapture,
  canStageCandidate,
  classifyParserOutcome,
  classifyPublicationRelationship,
  isPriceAnomaly,
  latestReview,
  validateCandidate,
  type CandidateDraft,
} from "../../src/db/ingestion/tooling";
import {
  candidateArtifactId,
  candidateFingerprint,
  NBS_CANDIDATES,
  NBS_ORIGIN_LABEL,
  NBS_PACKAGE_SHA256,
  NBS_PACKAGE_URL,
} from "./adapters/nbs-selected-food-price-watch";

const baseCandidate: CandidateDraft = {
  canonicalSourceIdentity: "National Bureau of Statistics",
  canonicalUrl: "https://microdata.nigerianstat.gov.ng/catalog/162/download/1427",
  upstreamPublicationIdentity: "Selected Food Price Watch May 2026",
  captureContentHash: "2d46ff90f87c7bfe75cc3df30ae35cc10a9641971543243e9d885aa7a97ca466",
  evidenceReference: "PDF page 3, Lagos State row",
  evidencePage: "3",
  rawItemName: "Tomato",
  normalizedItemId: "00000000-0000-4000-8000-000000000001",
  normalizedItemVariantId: "00000000-0000-4000-8000-000000000002",
  rawQuantity: "1kg",
  quantityValue: 1,
  rawUnit: "kg",
  normalizedUnitId: "00000000-0000-4000-8000-000000000003",
  rawPrice: "NGN 1,974.81",
  priceKobo: 197481,
  currency: "NGN",
  rawAvailability: null,
  availability: "unknown",
  rawPlaceName: "Lagos State",
  normalizedPlaceId: null,
  geographicPrecision: "lagos_state",
  sourceGeographicScope: "Lagos State",
  observedAt: null,
  surveyPeriodStart: "2026-05-01T00:00:00.000Z",
  surveyPeriodEnd: "2026-05-31T23:59:59.999Z",
  publishedAt: "2026-06-25T00:00:00.000Z",
  fetchedAt: "2026-07-18T12:30:00.000Z",
  parserVersion: "nbs-selected-food-v1",
};

test("idempotent reruns reuse a run key and append no repeated capture or candidate", () => {
  const runInput = {
    scheduledAt: "2026-07-18T12:30:00.000Z",
    planVersion: "lagos-food-v1",
    configurationVersion: "approved-sources-v1",
  };
  assert.equal(buildRunKey(runInput), buildRunKey({ ...runInput }));

  const capture = {
    sourceRegistryId: "nbs",
    canonicalUrl: baseCandidate.canonicalUrl,
    upstreamPublicationIdentity: baseCandidate.upstreamPublicationIdentity,
    contentHash: baseCandidate.captureContentHash,
  };
  const captureIdentity = buildCaptureIdentity(capture);
  const candidateFingerprint = buildCandidateFingerprint(baseCandidate);
  const rerun = appendUnique(
    [captureIdentity, candidateFingerprint],
    [captureIdentity, candidateFingerprint],
    (identity) => identity
  );
  assert.equal(rerun.appended, 0);
  assert.equal(rerun.duplicates, 2);
});

test("exact duplicate fingerprints are deterministically suppressed", () => {
  const fingerprint = buildCandidateFingerprint(baseCandidate);
  const exactCopy = buildCandidateFingerprint({ ...baseCandidate });
  assert.equal(exactCopy, fingerprint);
  const result = appendUnique([baseCandidate], [{ ...baseCandidate }], buildCandidateFingerprint);
  assert.equal(result.appended, 0);
  assert.equal(result.records.length, 1);
});

test("syndicated publications are not independent corroboration", () => {
  const first = {
    namedUpstreamPublisher: "National Bureau of Statistics",
    upstreamPublicationIdentity: "Selected Food Price Watch May 2026",
    surveyPeriodStart: "2026-05-01",
    surveyPeriodEnd: "2026-05-31",
    evidenceLineage: "NBS-SFPW-2026-05",
    contentHash: "a".repeat(64),
  };
  assert.equal(
    classifyPublicationRelationship(first, { ...first, contentHash: "b".repeat(64) }),
    "syndicated_copy"
  );
});

test("ambiguous local units are retained and invented kilogram conversions are rejected", () => {
  const ambiguous = {
    ...baseCandidate,
    rawQuantity: "1 derica (claimed as 1kg)",
    rawUnit: "derica",
  };
  assert.deepEqual(validateCandidate(ambiguous), {
    status: "rejected",
    errors: ["invented_local_unit_conversion"],
  });
  assert.equal(
    validateCandidate({ ...baseCandidate, rawUnit: "derica", normalizedUnitId: null }).status,
    "needs_unit_mapping"
  );
});

test("state evidence cannot become an exact place without a mapped place", () => {
  const result = validateCandidate({
    ...baseCandidate,
    geographicPrecision: "exact_place",
    rawPlaceName: "Lagos State",
    normalizedPlaceId: null,
  });
  assert.equal(result.status, "rejected");
  assert.ok(result.errors.includes("unsupported_place_precision"));
});

test("publication timestamp is kept distinct from observation timestamp", () => {
  assert.equal(validateCandidate(baseCandidate).status, "ready_for_review");
  const copiedDate = {
    ...baseCandidate,
    observedAt: baseCandidate.publishedAt,
  };
  assert.ok(validateCandidate(copiedDate).errors.includes("publication_copied_to_observation"));
});

test("price anomaly is a configurable greater-than threshold flag only", () => {
  assert.equal(isPriceAnomaly(14000, 10000), false);
  assert.equal(isPriceAnomaly(14001, 10000), true);
  assert.equal(isPriceAnomaly(12501, 10000, 0.25), true);
  assert.equal(validateCandidate(baseCandidate).status, "ready_for_review");
});

test("review decisions append and latest state derives without rewriting history", () => {
  const reviews = [
    {
      decision: "request_changes",
      reviewedAt: "2026-07-18T12:00:00.000Z",
      createdAt: "2026-07-18T12:00:01.000Z",
    },
  ] as const;
  const appended = appendUnique(
    reviews,
    [
      {
        decision: "approve",
        reviewedAt: "2026-07-18T13:00:00.000Z",
        createdAt: "2026-07-18T13:00:01.000Z",
      },
    ],
    (review) => review.createdAt
  );
  assert.equal(reviews.length, 1);
  assert.equal(appended.records.length, 2);
  assert.equal(latestReview(appended.records)?.decision, "approve");
});

test("missing source URLs and invented availability fail closed", () => {
  const noUrl = validateCandidate({ ...baseCandidate, canonicalUrl: "" });
  assert.ok(noUrl.errors.includes("missing_stable_source_url"));
  const inventedStock = validateCandidate({
    ...baseCandidate,
    rawAvailability: null,
    availability: "available",
  });
  assert.ok(inventedStock.errors.includes("invented_availability"));
  const emptyAvailability = validateCandidate({
    ...baseCandidate,
    rawAvailability: "",
    availability: "available",
  });
  assert.ok(emptyAvailability.errors.includes("invented_availability"));
});

test("a raw price cannot bypass parsing requirements into ready_for_review", () => {
  const result = validateCandidate({
    ...baseCandidate,
    priceKobo: null,
    currency: null,
  });
  assert.equal(result.status, "rejected");
  assert.ok(result.errors.includes("unparsed_price"));
});

test("candidate staging requires active fetch-and-stage policy in registry and capture", () => {
  const allowed = {
    registryLifecycleState: "active",
    registryIngestionMode: "fetch_and_stage",
    captureLifecycleState: "active",
    captureIngestionMode: "fetch_and_stage",
    captureStatus: "retained_external",
  } as const;
  assert.equal(canStageCandidate(allowed), true);
  assert.equal(canStageCandidate({ ...allowed, registryLifecycleState: "proposed" }), false);
  assert.equal(canStageCandidate({ ...allowed, registryIngestionMode: "discovery_only" }), false);
  assert.equal(canStageCandidate({ ...allowed, captureIngestionMode: "blocked" }), false);
});

test("retained captures require an approved source policy", () => {
  const allowed = {
    registryLifecycleState: "active",
    registryIngestionMode: "fetch_and_stage",
    registrySourceCategory: "government_official",
    captureStatus: "retained_external",
  } as const;
  assert.equal(canRetainCapture(allowed), true);
  assert.equal(canRetainCapture({ ...allowed, registryLifecycleState: "proposed" }), false);
  assert.equal(
    canRetainCapture({
      ...allowed,
      registrySourceCategory: "unknown_unsupported",
    }),
    false
  );
  assert.equal(
    canRetainCapture({
      ...allowed,
      registryLifecycleState: "proposed",
      captureStatus: "metadata_only",
    }),
    true
  );
});

test("a formerly productive parser cannot report a successful empty result", () => {
  assert.equal(
    classifyParserOutcome({ previousSuccessfulRecordCount: 2, currentRecordCount: 0 }),
    "format_changed"
  );
  assert.equal(
    classifyParserOutcome({
      previousSuccessfulRecordCount: 2,
      currentRecordCount: 0,
      emptyResultExplicitlyValid: true,
    }),
    "captured"
  );
});

test("NBS review artifacts preserve approved external-pointer-only source facts", async () => {
  const capture = JSON.parse(
    await readFile(
      resolve(
        process.cwd(),
        "data/ingestion/captures/nbs-selected-food-price-watch/2d46ff90f87c7bfe75cc3df30ae35cc10a9641971543243e9d885aa7a97ca466.capture.json"
      ),
      "utf8"
    )
  ) as {
    archiveMode: string;
    capture: Record<string, unknown>;
  };
  const fixture = JSON.parse(
    await readFile(
      resolve(
        process.cwd(),
        "data/development-fixtures/current-food-news/2026-07-18.provenance.json"
      ),
      "utf8"
    )
  ) as { items: Array<Record<string, unknown>>; effectFirewall: Record<string, unknown> };

  assert.equal(capture.archiveMode, "external_pointer");
  assert.equal(capture.capture.contentHash, NBS_PACKAGE_SHA256);
  assert.equal(capture.capture.rawContentPointer, NBS_PACKAGE_URL);
  assert.equal(capture.capture.rawContentStoredInRepository, false);
  assert.equal(capture.capture.rawContentStoredInDatabase, false);
  assert.equal(fixture.items.length, 1);
  assert.equal(fixture.items[0].originLabel, NBS_ORIGIN_LABEL);
  assert.equal(fixture.items[0].availability, "unknown");
  assert.equal(fixture.items[0].observedAt, null);
  assert.equal(JSON.stringify(fixture).includes("Sample"), false);
  assert.deepEqual(
    fixture.items[0].candidateArtifactIds,
    NBS_CANDIDATES.map((candidate) => candidate.candidateArtifactId)
  );
  assert.ok(Object.values(fixture.effectFirewall).every((value) => value === 0 || value === false));
});

test("NBS candidate artifact IDs are bound to frozen candidate fingerprints", () => {
  assert.deepEqual(
    NBS_CANDIDATES.map((candidate) => candidateArtifactId(candidate)),
    NBS_CANDIDATES.map((candidate) => candidate.candidateArtifactId)
  );
  assert.equal(new Set(NBS_CANDIDATES.map(candidateFingerprint)).size, NBS_CANDIDATES.length);
});

test("pilot preserves demo sources byte-for-byte and asserts the publication firewall", async () => {
  const seedPaths = [
    resolve(process.cwd(), "src/db/seed.ts"),
    resolve(process.cwd(), "src/db/seedContent.ts"),
  ];
  const before = await Promise.all(seedPaths.map((path) => readFile(path)));
  const beforeHashes = before.map((bytes) => createHash("sha256").update(bytes).digest("hex"));

  const artifact = JSON.parse(
    await readFile(
      resolve(process.cwd(), "data/ingestion/nbs-selected-food-may-2026.review.json"),
      "utf8"
    )
  ) as {
    capture: {
      requestUrl: string;
      finalResolvedUrl: string;
      title: string;
      publisher: string;
      upstreamPublicationIdentity: string;
      attributionText: string;
      captureStatus: string;
      fetchResult: string;
      outcome: string;
      databaseStagingStatus: string;
      rawPublishedDate: string;
      publicationPrecision: string;
      publicationNormalizationNote: string;
      fetchedAt: string;
      byteLength: number;
      mediaType: string;
      contentFormat: string;
      parserVersion: string;
      hashingAlgorithm: string;
    };
    candidates: Array<{
      rawItemName: string;
      rawPrice: string;
      rawPlaceName: string;
      rawSurveyPeriod: string;
      rawPublishedDate: string;
      publicationPrecision: string;
      observedAt: null;
      availability: string;
      geographicPrecision: string;
    }>;
    publicationFirewall: Record<string, number | boolean>;
  };

  assert.equal(artifact.candidates.length, 2);
  assert.deepEqual(
    artifact.candidates.map((candidate) => candidate.rawItemName),
    ["Tomatoes, fresh", "Semovita, Prepacked (1kg)"]
  );
  assert.deepEqual(
    artifact.candidates.map((candidate) => candidate.rawPrice),
    ["₦1,974.81", "₦1,777.15"]
  );
  assert.equal(artifact.capture.publisher, "National Bureau of Statistics");
  assert.equal(artifact.capture.upstreamPublicationIdentity, "Selected Food Price Watch, May 2026");
  assert.equal(artifact.capture.captureStatus, "retained_external");
  assert.equal(artifact.capture.fetchResult, "success");
  assert.equal(artifact.capture.outcome, "captured");
  assert.equal(artifact.capture.databaseStagingStatus, "ineligible_source_permission_unresolved");
  assert.equal(artifact.capture.rawPublishedDate, "2026-06-25");
  assert.equal(artifact.capture.publicationPrecision, "date");
  assert.match(artifact.capture.publicationNormalizationNote, /convention/);
  for (const candidate of artifact.candidates) {
    assert.equal(candidate.rawPlaceName, "Lagos");
    assert.equal(candidate.rawSurveyPeriod, "May 2026");
    assert.equal(candidate.rawPublishedDate, "2026-06-25");
    assert.equal(candidate.publicationPrecision, "date");
    assert.equal(candidate.observedAt, null);
    assert.equal(candidate.availability, "unknown");
    assert.equal(candidate.geographicPrecision, "lagos_state");
  }
  assert.deepEqual(artifact.publicationFirewall, {
    databaseWrites: 0,
    liveObservationsPromoted: 0,
    demoRecordsModified: 0,
    demoRecordsDeleted: 0,
    destructiveSeedExecuted: false,
    productionTablesTruncated: false,
  });

  const after = await Promise.all(seedPaths.map((path) => readFile(path)));
  const afterHashes = after.map((bytes) => createHash("sha256").update(bytes).digest("hex"));
  assert.deepEqual(afterHashes, beforeHashes);
});

test("migration enforces immutable evidence, staging policy, and composite lineage", async () => {
  const migration = await readFile(
    resolve(process.cwd(), "src/db/migrations/0010_public_source_ingestion_boundary.sql"),
    "utf8"
  );

  for (const table of [
    "public_source_captures",
    "public_food_candidates",
    "public_candidate_reviews",
  ]) {
    assert.match(migration, new RegExp(`${table}_reject_update_delete`));
    assert.match(migration, new RegExp(`${table}_reject_truncate`));
  }
  assert.match(migration, /public_food_candidates_enforce_staging_policy/);
  const stagingPolicyFunctionMatch = migration.match(
    /CREATE FUNCTION "enforce_public_candidate_staging_policy"\(\)[\s\S]*?\$\$;/
  );
  assert.ok(stagingPolicyFunctionMatch, "candidate staging policy function must exist");
  const stagingPolicyFunction = stagingPolicyFunctionMatch[0];
  assert.match(stagingPolicyFunction, /\bcapture_status_value\b/);
  assert.match(stagingPolicyFunction, /capture_row\."capture_status"/);
  assert.doesNotMatch(
    stagingPolicyFunction,
    /(?:SELECT|,)\s*"(?:lifecycle_state|permitted_ingestion_mode|source_registry_id|effective_lifecycle_state|effective_ingestion_mode|effective_source_category|capture_status)"\s*(?:,|INTO)/,
    "candidate staging policy SELECT columns must be table-alias qualified"
  );
  assert.match(migration, /public_source_captures_enforce_policy_snapshot/);
  assert.match(migration, /effective_policy_version" IS DISTINCT FROM registry_policy_version/);
  assert.match(migration, /registry_lifecycle IS DISTINCT FROM 'active'/);
  assert.match(migration, /capture_lifecycle IS DISTINCT FROM 'active'/);
  assert.match(migration, /public_food_candidates_capture_source_fk/);
  assert.match(migration, /public_ingestion_fetches_capture_source_fk/);
  assert.match(migration, /public_candidate_reviews_candidate_fingerprint_fk/);
  const migrationStatements = migration.split("--> statement-breakpoint");
  const statementPosition = (
    label: string,
    predicate: (statement: string) => boolean
  ): number => {
    const position = migrationStatements.findIndex(predicate);
    assert.notEqual(position, -1, `${label} statement must exist`);
    return position;
  };
  const captureIdentityIndex = statementPosition(
    "capture identity unique index",
    (statement) =>
      statement.includes("CREATE UNIQUE INDEX") &&
      statement.includes('ON "public_source_captures"') &&
      /\(\s*"id"\s*,\s*"source_registry_id"\s*\)/.test(statement)
  );
  for (const foreignKey of [
    "public_ingestion_fetches_capture_source_fk",
    "public_food_candidates_capture_source_fk",
  ]) {
    const foreignKeyPosition = statementPosition(foreignKey, (statement) =>
      statement.includes(`ADD CONSTRAINT "${foreignKey}"`)
    );
    assert.ok(
      captureIdentityIndex < foreignKeyPosition,
      `capture identity unique index must precede ${foreignKey}`
    );
  }
  const candidateFingerprintIndex = statementPosition(
    "candidate fingerprint unique index",
    (statement) =>
      statement.includes("CREATE UNIQUE INDEX") &&
      statement.includes('ON "public_food_candidates"') &&
      /\(\s*"id"\s*,\s*"candidate_fingerprint"\s*\)/.test(statement)
  );
  const candidateFingerprintForeignKey = statementPosition(
    "public_candidate_reviews_candidate_fingerprint_fk",
    (statement) =>
      statement.includes(
        'ADD CONSTRAINT "public_candidate_reviews_candidate_fingerprint_fk"'
      )
  );
  assert.ok(
    candidateFingerprintIndex < candidateFingerprintForeignKey,
    "candidate fingerprint unique index must precede its composite foreign key"
  );
  assert.match(
    migration,
    /"raw_price" is null or \("public_food_candidates"\."price_kobo" > 0 and "public_food_candidates"\."currency" = 'NGN'\)/
  );
});
