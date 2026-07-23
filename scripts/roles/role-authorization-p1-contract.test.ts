/**
 * ADR-022 P1 role-authorization contract (app-layer half).
 *
 * Proves the vocabulary is exactly the ADR's (three seller templates, eight
 * claim states, the enumerated permission matrix with template ceilings),
 * that the resolver is deny-by-default (unknown role, permission, subject,
 * state, environment, and malformed input all deny; cross-business and
 * cross-place scope deny; suspended or revoked defeats a stale session claim
 * by construction), that the claim lifecycle admits exactly the ADR's edges
 * with separation-of-duties and one-bounded-appeal guards, and that the
 * compare-and-set primitive lets exactly one of two racing workers advance.
 *
 * Absence teeth for the P1 boundary: no roles file exists under
 * src/db/schema (the schema half is a separate controller-gated lane), none
 * of the ADR's later operator-family names appears as a template string in
 * src/lib/roles, and no live caller under src/app or src/design-system
 * imports the roles modules. All four lane files are ASCII-clean.
 *
 * Shared-DB rule: this harness generates no DB traffic of any kind.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  DENY_REASONS,
  authorize,
  authorizeDefeatingStaleClaim,
  type AuthorizationDecision,
} from "../../src/lib/roles/authorize";
import {
  APPEALABLE_STATES,
  APPEAL_DECIDER_AUTHORITY,
  CLAIM_TRANSITIONS,
  RoleAppealError,
  RoleClaimTransitionError,
  RoleSeparationOfDutiesError,
  appealClaim,
  assertAppealAllowed,
  assertAssignmentSeparation,
  assertIndependentReviewer,
  assertLegalClaimTransition,
  isLegalClaimTransition,
  transitionClaim,
  type RoleClaimCasStore,
  type RoleClaimPatch,
} from "../../src/lib/roles/lifecycle";
import {
  ASSIGNMENT_LIFECYCLE_STATES,
  CLAIM_STATES,
  KNOWN_ENVIRONMENTS,
  PERMISSIONS,
  ROLE_TEMPLATES,
  TEMPLATE_PERMISSION_CEILING,
  type ClaimState,
} from "../../src/lib/roles/types";

const root = path.resolve(import.meta.dirname, "../..");

/* ---------------------------------------------------------------------- */
/* 1. Vocabulary is exactly the ADR's                                     */
/* ---------------------------------------------------------------------- */

test("role templates are exactly the three seller templates, in order", () => {
  assert.deepEqual(ROLE_TEMPLATES, [
    "seller_owner",
    "seller_manager",
    "seller_staff",
  ]);
});

test("assignment lifecycle states are active/suspended/revoked/expired", () => {
  assert.deepEqual(ASSIGNMENT_LIFECYCLE_STATES, [
    "active",
    "suspended",
    "revoked",
    "expired",
  ]);
});

test("claim states are exactly the eight canonical states, in order", () => {
  assert.deepEqual(CLAIM_STATES, [
    "draft",
    "pending",
    "needs_info",
    "approved",
    "rejected",
    "suspended",
    "revoked",
    "expired",
  ]);
});

test("permission vocabulary is exactly the seven ADR-derived names", () => {
  assert.deepEqual(PERMISSIONS, [
    "manage_place_control_claim",
    "request_scoped_assignments",
    "maintain_place_facts",
    "maintain_seller_submissions",
    "manage_staff",
    "publish_contact_channel",
    "submit_attributed_claims",
  ]);
});

test("forbidden capabilities are NOT in the vocabulary", () => {
  // ADR-022 line 99: no control transfer without re-verification, no
  // fulfilment authority; lines 99-101: no verification, moderation,
  // appeal, accuracy, or badge decision permission for any seller template.
  for (const absent of [
    "transfer_control",
    "transfer_ownership",
    "approve_verification",
    "approve_own_verification",
    "decide_appeal",
    "moderate",
    "award_badge",
    "fulfilment",
  ]) {
    assert.ok(
      !(PERMISSIONS as readonly string[]).includes(absent),
      `permission vocabulary must not contain ${absent}`,
    );
  }
});

test("template ceilings match the ADR matrix exactly", () => {
  assert.deepEqual(TEMPLATE_PERMISSION_CEILING.seller_owner, [
    "manage_place_control_claim",
    "request_scoped_assignments",
    "maintain_place_facts",
    "publish_contact_channel",
  ]);
  assert.deepEqual(TEMPLATE_PERMISSION_CEILING.seller_manager, [
    "maintain_place_facts",
    "maintain_seller_submissions",
    "manage_staff",
    "publish_contact_channel",
  ]);
  assert.deepEqual(TEMPLATE_PERMISSION_CEILING.seller_staff, [
    "submit_attributed_claims",
  ]);
  // Every ceiling entry is inside the vocabulary.
  for (const template of ROLE_TEMPLATES) {
    for (const permission of TEMPLATE_PERMISSION_CEILING[template]) {
      assert.ok((PERMISSIONS as readonly string[]).includes(permission));
    }
  }
});

test("environments are the three known deployment environments", () => {
  assert.deepEqual(KNOWN_ENVIRONMENTS, ["development", "preview", "production"]);
});

/* ---------------------------------------------------------------------- */
/* 2. Deny-by-default resolver                                            */
/* ---------------------------------------------------------------------- */

const NOW = new Date("2026-07-23T12:00:00Z");

const baseAssignment = {
  subjectRef: "acct_subject_1",
  template: "seller_manager",
  scope: { businessRef: "biz_1", placeRef: "place_1" },
  permissions: ["maintain_place_facts"],
  state: "active",
  effectiveAt: new Date("2026-07-01T00:00:00Z"),
  expiresAt: null as Date | null,
  issuerRef: "acct_issuer_1",
  reviewerRef: "acct_reviewer_1",
};

const baseRequest = {
  subjectRef: "acct_subject_1",
  permission: "maintain_place_facts",
  scope: { businessRef: "biz_1", placeRef: "place_1" },
  environment: "development",
};

function expectDeny(decision: AuthorizationDecision, reason: string): void {
  assert.equal(decision.allow, false);
  assert.ok(!decision.allow);
  assert.equal(decision.reason, reason);
}

test("the exact in-scope active enumerated request allows", () => {
  assert.deepEqual(authorize(baseAssignment, baseRequest, NOW), {
    allow: true,
  });
});

test("owner and staff baseline allows for their own matrix rows", () => {
  const owner = {
    ...baseAssignment,
    subjectRef: "acct_owner_1",
    template: "seller_owner",
    permissions: ["publish_contact_channel"],
  };
  assert.deepEqual(
    authorize(
      owner,
      {
        ...baseRequest,
        subjectRef: "acct_owner_1",
        permission: "publish_contact_channel",
      },
      NOW,
    ),
    { allow: true },
  );
  const staff = {
    ...baseAssignment,
    subjectRef: "acct_staff_1",
    template: "seller_staff",
    permissions: ["submit_attributed_claims"],
  };
  assert.deepEqual(
    authorize(
      staff,
      {
        ...baseRequest,
        subjectRef: "acct_staff_1",
        permission: "submit_attributed_claims",
      },
      NOW,
    ),
    { allow: true },
  );
});

interface DenyCase {
  readonly name: string;
  readonly assignment: unknown;
  readonly request: unknown;
  readonly now?: Date;
  readonly reason: (typeof DENY_REASONS)[number];
}

const DENY_TABLE: readonly DenyCase[] = [
  {
    name: "null assignment",
    assignment: null,
    request: baseRequest,
    reason: "malformed_input",
  },
  {
    name: "request missing permission",
    assignment: baseAssignment,
    request: { ...baseRequest, permission: undefined },
    reason: "malformed_input",
  },
  {
    name: "wildcard business scope in request",
    assignment: baseAssignment,
    request: { ...baseRequest, scope: { businessRef: "*", placeRef: "place_1" } },
    reason: "malformed_input",
  },
  {
    name: "wildcard place scope on assignment",
    assignment: {
      ...baseAssignment,
      scope: { businessRef: "biz_1", placeRef: "*" },
    },
    request: baseRequest,
    reason: "malformed_input",
  },
  {
    name: "empty subject reference",
    assignment: baseAssignment,
    request: { ...baseRequest, subjectRef: "  " },
    reason: "malformed_input",
  },
  {
    name: "invalid clock",
    assignment: baseAssignment,
    request: baseRequest,
    now: new Date("not a date"),
    reason: "malformed_input",
  },
  {
    name: "unknown environment",
    assignment: baseAssignment,
    request: { ...baseRequest, environment: "staging" },
    reason: "unknown_environment",
  },
  {
    name: "transfer of control is not a permission",
    assignment: baseAssignment,
    request: { ...baseRequest, permission: "transfer_control" },
    reason: "unknown_permission",
  },
  {
    name: "verification approval is not a permission",
    assignment: baseAssignment,
    request: { ...baseRequest, permission: "approve_verification" },
    reason: "unknown_permission",
  },
  {
    name: "unknown role template denies (a moderation template does not exist here)",
    assignment: { ...baseAssignment, template: "moderator" },
    request: baseRequest,
    reason: "unknown_role_template",
  },
  {
    name: "unknown lifecycle state",
    assignment: { ...baseAssignment, state: "paused" },
    request: baseRequest,
    reason: "unknown_lifecycle_state",
  },
  {
    name: "assignment carrying an unknown grant is fail-closed in full",
    assignment: {
      ...baseAssignment,
      permissions: ["maintain_place_facts", "fulfilment"],
    },
    request: baseRequest,
    reason: "unknown_permission",
  },
  {
    name: "subject mismatch",
    assignment: baseAssignment,
    request: { ...baseRequest, subjectRef: "acct_subject_2" },
    reason: "subject_mismatch",
  },
  {
    name: "suspended assignment denies",
    assignment: { ...baseAssignment, state: "suspended" },
    request: baseRequest,
    reason: "assignment_not_active",
  },
  {
    name: "revoked assignment denies",
    assignment: { ...baseAssignment, state: "revoked" },
    request: baseRequest,
    reason: "assignment_not_active",
  },
  {
    name: "expired assignment state denies",
    assignment: { ...baseAssignment, state: "expired" },
    request: baseRequest,
    reason: "assignment_not_active",
  },
  {
    name: "not yet effective",
    assignment: {
      ...baseAssignment,
      effectiveAt: new Date("2026-08-01T00:00:00Z"),
    },
    request: baseRequest,
    reason: "outside_effective_window",
  },
  {
    name: "expired by time",
    assignment: {
      ...baseAssignment,
      expiresAt: new Date("2026-07-20T00:00:00Z"),
    },
    request: baseRequest,
    reason: "outside_effective_window",
  },
  {
    name: "expiry boundary instant is already outside the window",
    assignment: { ...baseAssignment, expiresAt: NOW },
    request: baseRequest,
    reason: "outside_effective_window",
  },
  {
    name: "cross-business scope denies",
    assignment: baseAssignment,
    request: {
      ...baseRequest,
      scope: { businessRef: "biz_2", placeRef: "place_1" },
    },
    reason: "cross_business_scope",
  },
  {
    name: "cross-place scope denies",
    assignment: baseAssignment,
    request: {
      ...baseRequest,
      scope: { businessRef: "biz_1", placeRef: "place_2" },
    },
    reason: "cross_place_scope",
  },
  {
    name: "valid permission not enumerated on the assignment denies",
    assignment: baseAssignment,
    request: { ...baseRequest, permission: "maintain_seller_submissions" },
    reason: "permission_not_enumerated",
  },
  {
    name: "enumerated grant outside the template ceiling denies",
    assignment: {
      ...baseAssignment,
      template: "seller_staff",
      permissions: ["maintain_place_facts"],
    },
    request: baseRequest,
    reason: "permission_outside_template",
  },
  {
    name: "staff cannot hold contact publication even if enumerated",
    assignment: {
      ...baseAssignment,
      template: "seller_staff",
      permissions: ["publish_contact_channel"],
    },
    request: { ...baseRequest, permission: "publish_contact_channel" },
    reason: "permission_outside_template",
  },
];

test("deny-by-default table", () => {
  for (const denyCase of DENY_TABLE) {
    const decision = authorize(
      denyCase.assignment,
      denyCase.request,
      denyCase.now ?? NOW,
    );
    expectDeny(decision, denyCase.reason);
    assert.ok(
      (DENY_REASONS as readonly string[]).includes(denyCase.reason),
      `${denyCase.name}: reason must come from the finite vocabulary`,
    );
  }
});

/* ---------------------------------------------------------------------- */
/* 3. Stale-session defeat                                                */
/* ---------------------------------------------------------------------- */

test("a stale approved session claim cannot outlive suspension or revocation", () => {
  const staleClaim = {
    allow: true,
    state: "approved",
    template: "seller_manager",
    cachedAt: new Date("2026-07-22T00:00:00Z"),
  };
  for (const state of ["suspended", "revoked"] as const) {
    const current = { ...baseAssignment, state };
    const decision = authorizeDefeatingStaleClaim(
      staleClaim,
      current,
      baseRequest,
      NOW,
    );
    expectDeny(decision, "assignment_not_active");
    // The cached claim is discarded unread: the decision is identical to
    // resolving the current assignment directly.
    assert.deepEqual(decision, authorize(current, baseRequest, NOW));
  }
});

test("the cache-defeat wrapper changes nothing on the allow path either", () => {
  assert.deepEqual(
    authorizeDefeatingStaleClaim(
      { anything: "at all" },
      baseAssignment,
      baseRequest,
      NOW,
    ),
    { allow: true },
  );
});

/* ---------------------------------------------------------------------- */
/* 4. Claim lifecycle legality                                            */
/* ---------------------------------------------------------------------- */

// Redeclared expected edges (not read from the implementation) so a drifted
// transition table cannot vouch for itself.
const EXPECTED_EDGES: Readonly<Record<ClaimState, readonly ClaimState[]>> = {
  draft: ["pending"],
  pending: ["needs_info", "approved", "rejected"],
  needs_info: ["pending"],
  approved: ["suspended", "revoked", "expired"],
  rejected: [],
  suspended: [],
  revoked: [],
  expired: [],
};

test("every legal edge is accepted and every illegal pair rejected (all 64)", () => {
  for (const from of CLAIM_STATES) {
    for (const to of CLAIM_STATES) {
      const expected = EXPECTED_EDGES[from].includes(to);
      assert.equal(
        isLegalClaimTransition(from, to),
        expected,
        `${from} -> ${to} should be ${expected ? "legal" : "illegal"}`,
      );
      if (expected) {
        assert.doesNotThrow(() => assertLegalClaimTransition(from, to));
      } else {
        assert.throws(
          () => assertLegalClaimTransition(from, to),
          RoleClaimTransitionError,
        );
      }
    }
  }
  assert.deepEqual(CLAIM_TRANSITIONS, EXPECTED_EDGES);
});

test("reinstatement states are reachable only through the appeal path", () => {
  // No ordinary outgoing edge exists from rejected/suspended/revoked, and
  // expired is fully terminal (re-verification is a NEW claim).
  for (const state of ["rejected", "suspended", "revoked", "expired"] as const) {
    assert.deepEqual(CLAIM_TRANSITIONS[state], []);
  }
  assert.deepEqual(APPEALABLE_STATES, ["rejected", "suspended", "revoked"]);
});

/* ---------------------------------------------------------------------- */
/* 5. Separation of duties                                                */
/* ---------------------------------------------------------------------- */

test("self-approval and non-independent issuance are refused", () => {
  assert.throws(
    () => assertIndependentReviewer({ claimantRef: "a", reviewerRef: "a" }),
    RoleSeparationOfDutiesError,
  );
  assert.doesNotThrow(() =>
    assertIndependentReviewer({ claimantRef: "a", reviewerRef: "b" }),
  );

  const violations = [
    { subjectRef: "a", issuerRef: "a", reviewerRef: "b" },
    { subjectRef: "a", issuerRef: "b", reviewerRef: "a" },
    { subjectRef: "a", issuerRef: "b", reviewerRef: "b" },
  ];
  for (const violation of violations) {
    assert.throws(
      () => assertAssignmentSeparation(violation),
      RoleSeparationOfDutiesError,
    );
  }
  assert.doesNotThrow(() =>
    assertAssignmentSeparation({
      subjectRef: "a",
      issuerRef: "b",
      reviewerRef: "c",
    }),
  );
});

/* ---------------------------------------------------------------------- */
/* 6. One bounded appeal                                                  */
/* ---------------------------------------------------------------------- */

const baseAppeal = {
  fromState: "rejected" as ClaimState,
  appealAlreadyUsed: false,
  deciderRef: "acct_decider_1",
  originalDeciderRef: "acct_original_1",
  claimantRef: "acct_claimant_1",
  deciderAuthority: APPEAL_DECIDER_AUTHORITY as string,
};

test("a valid independent appeal is allowed from each appealable state", () => {
  for (const fromState of APPEALABLE_STATES) {
    assert.doesNotThrow(() =>
      assertAppealAllowed({ ...baseAppeal, fromState }),
    );
  }
});

test("appeal guard refuses each violation with its own reason", () => {
  const cases: readonly { patch: Partial<typeof baseAppeal>; reason: string }[] =
    [
      { patch: { fromState: "pending" }, reason: "state_not_appealable" },
      { patch: { fromState: "approved" }, reason: "state_not_appealable" },
      { patch: { fromState: "expired" }, reason: "state_not_appealable" },
      { patch: { appealAlreadyUsed: true }, reason: "appeal_already_used" },
      {
        patch: { deciderRef: "acct_original_1" },
        reason: "decider_is_original_decision_maker",
      },
      {
        patch: { deciderRef: "acct_claimant_1" },
        reason: "decider_is_claimant",
      },
      {
        patch: { deciderAuthority: "helpdesk" },
        reason: "decider_authority_not_independent",
      },
      {
        patch: { deciderAuthority: "seller_owner" },
        reason: "decider_authority_not_independent",
      },
    ];
  for (const appealCase of cases) {
    assert.throws(
      () => assertAppealAllowed({ ...baseAppeal, ...appealCase.patch }),
      (error: unknown) =>
        error instanceof RoleAppealError && error.reason === appealCase.reason,
      `expected ${appealCase.reason}`,
    );
  }
});

/* ---------------------------------------------------------------------- */
/* 7. Compare-and-set primitive                                           */
/* ---------------------------------------------------------------------- */

class FakeCasStore implements RoleClaimCasStore {
  readonly calls: {
    claimRef: string;
    expectedVersion: number;
    patch: RoleClaimPatch;
  }[] = [];

  private readonly versions = new Map<string, number>();

  seed(claimRef: string, version: number): void {
    this.versions.set(claimRef, version);
  }

  compareAndSwap(input: {
    claimRef: string;
    expectedVersion: number;
    patch: RoleClaimPatch;
  }): Promise<boolean> {
    this.calls.push(input);
    const current = this.versions.get(input.claimRef);
    if (current !== input.expectedVersion) return Promise.resolve(false);
    this.versions.set(input.claimRef, current + 1);
    return Promise.resolve(true);
  }
}

test("exactly one of two racing workers advances the claim", async () => {
  const store = new FakeCasStore();
  store.seed("claim_1", 1);
  const first = await transitionClaim(store, {
    claimRef: "claim_1",
    expectedVersion: 1,
    from: "pending",
    to: "approved",
  });
  const second = await transitionClaim(store, {
    claimRef: "claim_1",
    expectedVersion: 1,
    from: "pending",
    to: "approved",
  });
  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.equal(first.patch.state, "approved");
  assert.equal(store.calls.length, 2);
});

test("an illegal edge throws before the store is ever asked", async () => {
  const store = new FakeCasStore();
  store.seed("claim_2", 1);
  await assert.rejects(
    transitionClaim(store, {
      claimRef: "claim_2",
      expectedVersion: 1,
      from: "draft",
      to: "approved",
    }),
    RoleClaimTransitionError,
  );
  assert.equal(store.calls.length, 0);
});

test("a guarded appeal compare-and-sets to approved and consumes the appeal", async () => {
  const store = new FakeCasStore();
  store.seed("claim_3", 4);
  const result = await appealClaim(store, {
    claimRef: "claim_3",
    expectedVersion: 4,
    fromState: "suspended",
    appealAlreadyUsed: false,
    deciderRef: "acct_decider_1",
    originalDeciderRef: "acct_original_1",
    claimantRef: "acct_claimant_1",
    deciderAuthority: APPEAL_DECIDER_AUTHORITY,
  });
  assert.equal(result.applied, true);
  assert.deepEqual(result.patch, { state: "approved", appealUsed: true });

  const refused = appealClaim(store, {
    claimRef: "claim_3",
    expectedVersion: 5,
    fromState: "suspended",
    appealAlreadyUsed: true,
    deciderRef: "acct_decider_2",
    originalDeciderRef: "acct_original_1",
    claimantRef: "acct_claimant_1",
    deciderAuthority: APPEAL_DECIDER_AUTHORITY,
  });
  await assert.rejects(
    refused,
    (error: unknown) =>
      error instanceof RoleAppealError && error.reason === "appeal_already_used",
  );
});

/* ---------------------------------------------------------------------- */
/* 8. P1 boundary absence assertions and hygiene                          */
/* ---------------------------------------------------------------------- */

const LANE_FILES = [
  "src/lib/roles/types.ts",
  "src/lib/roles/authorize.ts",
  "src/lib/roles/lifecycle.ts",
  "scripts/roles/role-authorization-p1-contract.test.ts",
];

test("no roles file exists under src/db/schema (the schema half is gated)", () => {
  const entries = readdirSync(path.join(root, "src/db/schema"));
  for (const entry of entries) {
    assert.ok(
      !/^roles/i.test(entry),
      `src/db/schema/${entry} must not exist before the controller assigns the schema lane`,
    );
  }
});

test("no later operator-family name appears as a template string in src/lib/roles", () => {
  const forbidden = /["'](moderator|field_operator|support|community)["']/;
  for (const entry of readdirSync(path.join(root, "src/lib/roles"))) {
    const source = readFileSync(
      path.join(root, "src/lib/roles", entry),
      "utf8",
    );
    assert.ok(
      !forbidden.test(source),
      `src/lib/roles/${entry} must not declare any later operator-family string`,
    );
  }
});

function walkSources(dir: string, matches: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkSources(full, matches);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    const source = readFileSync(full, "utf8");
    if (/lib\/roles/.test(source)) matches.push(full);
  }
}

test("no live caller imports src/lib/roles (P1 has no live caller)", () => {
  const matches: string[] = [];
  for (const surface of ["src/app", "src/design-system"]) {
    const dir = path.join(root, surface);
    if (existsSync(dir)) walkSources(dir, matches);
  }
  assert.deepEqual(
    matches,
    [],
    `no file under src/app or src/design-system may reference lib/roles: ${matches.join(", ")}`,
  );
});

test("all four lane files are ASCII-clean with no em or en dash", () => {
  for (const relative of LANE_FILES) {
    const source = readFileSync(path.join(root, relative), "utf8");
    for (let index = 0; index < source.length; index += 1) {
      const code = source.charCodeAt(index);
      const ascii =
        code === 0x09 || code === 0x0a || code === 0x0d ||
        (code >= 0x20 && code <= 0x7e);
      assert.ok(
        ascii,
        `${relative} has a non-ASCII character (code ${code}) at index ${index}`,
      );
    }
  }
});

test("types.ts is pure: no import statements, only const tuples and types", () => {
  const source = readFileSync(
    path.join(root, "src/lib/roles/types.ts"),
    "utf8",
  );
  assert.ok(
    !/^\s*import[\s{]/m.test(source),
    "src/lib/roles/types.ts must import nothing",
  );
});

test("a post-appeal ordinary transition never re-arms the one bounded appeal", async () => {
  // A stateful store that records the merged row the way a database would:
  // ordinary patches must not carry appealUsed at all.
  const row: { state: string; appealUsed: boolean; version: number } = {
    state: "rejected",
    appealUsed: false,
    version: 1,
  };
  const store: RoleClaimCasStore = {
    compareAndSwap(input) {
      if (input.expectedVersion !== row.version) return Promise.resolve(false);
      row.state = input.patch.state;
      if ("appealUsed" in input.patch && input.patch.appealUsed !== undefined) {
        row.appealUsed = input.patch.appealUsed;
      }
      row.version += 1;
      return Promise.resolve(true);
    },
  };
  const first = await appealClaim(store, {
    claimRef: "claim_appeal",
    expectedVersion: 1,
    fromState: "rejected",
    claimantRef: "acct_subject_1",
    originalDeciderRef: "acct_reviewer_1",
    deciderRef: "acct_reviewer_2",
    deciderAuthority: "independent_reviewer",
    appealAlreadyUsed: row.appealUsed,
  });
  assert.equal(first.applied, true);
  assert.equal(row.appealUsed, true);
  const suspend = await transitionClaim(store, {
    claimRef: "claim_appeal",
    expectedVersion: 2,
    from: "approved",
    to: "suspended",
  });
  assert.equal(suspend.applied, true);
  assert.equal(row.appealUsed, true, "ordinary patch must preserve the consumed appeal");
  assert.throws(
    () =>
      assertAppealAllowed({
        fromState: "suspended",
        appealAlreadyUsed: row.appealUsed,
        claimantRef: "acct_subject_1",
        originalDeciderRef: "acct_reviewer_1",
        deciderRef: "acct_reviewer_3",
        deciderAuthority: "independent_reviewer",
      }),
    /appeal/i,
    "the one bounded appeal is consumed forever",
  );
});

test("a mutating scope getter cannot split validation from comparison", () => {
  let reads = 0;
  const trickScope = {
    get businessRef() {
      reads += 1;
      return reads <= 1 ? "biz_1" : "biz_EVIL";
    },
    placeRef: "place_1",
  };
  const verdict = authorize(
    baseAssignment,
    { ...baseRequest, scope: trickScope },
    NOW,
  );
  // Parse copies the two strings, so validation and comparison see the same
  // value; whichever single value was read decides the verdict coherently.
  if (verdict.allow) {
    assert.equal(reads, 1, "an allow is only coherent if one stable value was read");
  } else {
    assert.ok(verdict.reason.length > 0);
  }
});
