# WetinDey Data-Layer and Backend Handoff Rulebook

Status: operational rulebook  
Owner: Platform and Database Engineering  
Applies to: database, data access, server actions, provider adapters, background jobs,
environment controls, and backend handoffs

This rulebook turns a backend problem into a bounded, reproducible fix that another
engineer or AI agent can continue without guessing. It complements
`docs/database/MIGRATION-RULEBOOK.md`, which remains authoritative for migration
construction and shared-database application.

## 1. Outcome

A data-layer handoff is complete only when the receiver can answer:

1. What is wrong?
2. Which layer owns the defect?
3. What exact target and lineage were observed?
4. What changed, or what remains to change?
5. What evidence proves the claim?
6. What operation is safe to perform next?
7. What operation is explicitly forbidden?
8. Is the remaining gate a decision, credential, identity, provider, runtime, or evidence
   gate?

Never hand off "blocked on database," "needs approval," or "migration pending." Name the
physical missing thing and the exact next safe action.

## 2. Precedence

Use this order when sources disagree:

1. Accepted ADRs.
2. `docs/architecture/SERVICE-ARCHITECTURE.md`.
3. Current database migration ledger and exact target identity.
4. Live code and its call graph.
5. Current `LANES.md`.
6. Release manifests and operational evidence.
7. Worklogs and historical notes.

Code is the product truth. The shared migration ledger is the database history truth.
Neither grants permission to change the other.

## 3. Non-negotiable rules

1. Never print, log, commit, paste, or hand off a connection string, password, token, OTP,
   cookie, or private endpoint credential.
2. Never use a pooled runtime URL for DDL or migration execution.
3. Never infer a target from a hostname alone. Verify project, branch ID, database, role,
   endpoint, PostgreSQL version, and direct/non-pooled transport.
4. Never edit an applied migration. Repair forward.
5. Never run a baseline against an existing database.
6. Never rewrite the remote migration ledger.
7. Never use seed scripts as recurring ingestion or as a Production repair shortcut.
8. Never use a migration owner to imitate a runtime, moderator, worker, or control role.
9. Never combine schema application with feature activation.
10. Never treat a successful build or static contract as runtime proof.
11. Never claim a blocker without a blocker packet.
12. Never ask the Founder to repeat an approval already recorded in `LANES.md`, an accepted
    ADR, or a standing authorization.

## 4. Classify the defect before touching code

Choose exactly one primary class.

| Class | Typical evidence | Smallest correct fix |
|---|---|---|
| Query defect | Wrong rows, filters, ordering, joins, or projection | Repair the live read/write query and its focused contract |
| Schema defect | Missing or incorrect table, column, type, index, constraint | Desired-state schema plus a forward numbered migration |
| Data defect | Schema is correct but rows are missing, stale, or invalid | Reviewed idempotent forward data migration |
| Ledger defect | Repository and shared migration hashes/order disagree | Stop; reconcile exact immutable lineage before any apply |
| Ownership/ACL defect | Wrong owner, grants, RLS, policy, or role capability | Forward security migration with before/after privilege proof |
| RPC defect | Function shape, ACL, result, or authorization is wrong | Forward function/ACL migration; preserve caller contract |
| Provider defect | Neon, Blob, Mapbox, email, AI, or another boundary fails | Fix the bounded adapter/configuration; preserve fail-closed behavior |
| Environment defect | Correct code but missing/wrong target-specific variable | Correct the exact environment only; do not change code to mask it |
| Activation defect | Schema exists but control flags/actors are not ready | Use the approved least-privilege operator after lifecycle proof |
| Presentation defect | Backend answer is correct but UI misstates it | Fix the presentation layer; do not mutate data to satisfy UI |

If two classes are involved, split them into sequential lanes. For example, apply a schema
repair first, then activate the feature through a separate control lane.

## 5. Map the live data path

Before proposing a fix, trace:

```text
User intent
  -> UI event or route
  -> server action / route handler
  -> domain guard
  -> query / RPC / provider adapter
  -> database role and policy
  -> persisted or returned result
  -> trust/provenance presentation
```

Record every live caller. Do not build a replacement abstraction without wiring it to a
real call site in the same change.

For every value, record:

| Question | Required answer |
|---|---|
| Who creates it? | Exact action, job, migration, or provider |
| Who reads it? | Exact query, RPC, route, or component |
| Who may change it? | Exact role and policy |
| What makes it trustworthy? | Provenance, freshness, corroboration, or authority |
| What happens when absent? | Honest empty, unknown, disabled, or retry state |
| What leaves WetinDey? | Exact provider, fields, consent, and retention |

## 6. Claim an exact lane

Before the first edit:

1. Read `LANES.md`.
2. Run `git status --short`.
3. Name every writable path.
4. Name every frozen path.
5. Name every external operation separately.
6. Assign an independent refuter.

A useful claim says:

```text
Owner:
Objective:
Writable paths:
Frozen paths:
Database targets:
Allowed operations:
Forbidden operations:
Exit evidence:
Independent refuter:
```

Do not claim directories when exact files are known. A lane grants coordination ownership,
not authority to bypass ADRs, target guards, or release controls.

## 7. Build the evidence packet

### 7.1 Repository packet

Record:

- branch and exact base commit;
- current head or candidate tree;
- dirty paths that belong to other lanes;
- migration SQL hashes;
- snapshot IDs and parent IDs;
- journal prefix and release tag;
- desired-state schema or pillar hashes;
- focused contract names and results.

### 7.2 Target packet

Record safe identifiers only:

```text
environment
provider project ID
branch name
branch ID
database name
migration role name
endpoint hostname SHA-256
PostgreSQL version
direct/non-pooled confirmation
current ledger count
current final ledger hash
```

Never include the raw endpoint URL if it contains credentials.

### 7.3 Gate packet

Classify every remaining gate:

| Gate | Meaning | Example next action |
|---|---|---|
| Decision | Product/legal/security direction is genuinely absent | Present one bounded recommendation |
| Credential | Exact secret or login is physically unavailable | Name credential owner and safe recovery path |
| Identity | Required actor, role, or target identity is unknown | Produce or approve the identity packet |
| Provider | External capability or terms are unproved | Run a non-destructive provider proof |
| Runtime | Code/data exist but lifecycle is not driven | Run exact signed-in Preview scenario |
| Evidence | Operation happened but proof is incomplete | Run read-only postflight/refutation |
| Dependency | A prior migration or feature is not complete | Name exact parent release and completion proof |

If the Founder has already approved the direction, do not label a credential, identity, or
evidence gap as "waiting for Founder."

## 8. Fix workflow

### Step 1: Reproduce without mutation

Use the smallest read-only query or focused call that proves the defect. Capture safe
outputs, not secrets or personal data.

### Step 2: Prove the exact target

Compare the configured target with server-side identity. Stop on any mismatch.

### Step 3: Reconcile lineage

Hash repository migrations in order and compare them with the ordered shared ledger. Stop
if any applied hash differs, any parent is absent, or an unexpected later migration would
be included.

### Step 4: Choose the smallest forward repair

- Query issue: change the live query.
- Schema issue: desired-state change plus one forward migration.
- Data issue: idempotent forward data migration with provenance.
- ACL/RLS issue: forward privilege migration.
- Provider issue: bounded adapter/configuration change.
- Environment issue: exact environment update.
- Activation issue: separate control operation.

### Step 5: Prove locally or disposably

Run the focused unit/static contract and, for database changes, a disposable PostgreSQL
reconstruction or upgrade proof. A skipped runtime engine must be reported as skipped.

### Step 6: Apply to Preview

Use a bounded migration bundle that ends at the authorized release. Acquire an advisory
lock, recheck the parent ledger inside the execution window, apply once, and release the
lock.

### Step 7: Preview postflight

Prove:

- exact ordered ledger and hashes;
- object existence and shape;
- owner, ACL, RLS, and policies;
- no temporary membership or schema privileges;
- no unexpected runtime grants;
- empty/default-off state where required;
- idempotent second migration invocation;
- failure rollback where the migration contract requires it.

### Step 8: Independent refutation

The author does not review their own work. The refuter defaults to REFUTED and receives the
exact path set, target packet, expected invariants, and forbidden operations.

### Step 9: Apply to Production

Repeat exact-target proof. Use a bounded bundle so a later concurrent migration cannot ride
along. Recheck the Production parent ledger, apply once, and run the same postflight.

### Step 10: Freeze release evidence

After first shared application:

- set the release manifest to shared-applied immutable;
- record exact Preview and Production evidence;
- forbid duplicate execution;
- preserve runtime activation as false unless separately proved;
- archive historical self-hashing contracts when required;
- update `LANES.md` so old blocker language does not survive.

### Step 11: Activate separately

Only the dedicated least-privilege control principal may activate runtime behavior. Require
approved actors, exact environment flags, signed-in lifecycle proof, rollback proof, and
independent refutation. Migration success does not make a feature live.

## 9. Repair recipes

### 9.1 Wrong query result

1. Identify the live caller.
2. Capture the wrong and expected result shape.
3. Repair only projection, predicate, join, grouping, or ordering.
4. Preserve authorization and trust derivation.
5. Add a focused regression contract.
6. Drive the real call path.

### 9.2 Missing catalog row

1. Prove the schema already supports the row.
2. Identify authoritative provenance.
3. Write an idempotent forward data migration.
4. Use stable natural keys or explicit IDs.
5. Refuse to overwrite observations or infer availability.
6. Prove existing rows remain byte-equivalent unless explicitly changed.
7. Add rollback or compensating SQL.
8. Apply Preview, refute, then Production.

Do not rerun `src/db/seed.ts` against a shared environment.

### 9.3 Ownership or RLS failure

1. Capture owner, ACL, membership, schema privileges, and policies before the fix.
2. Use transaction-scoped temporary membership only when required.
3. Transfer ownership before switching to the owner role.
4. Grant only the temporary capability needed.
5. Revoke the temporary capability and exact grant before commit.
6. Prove forced RLS, exact policies, and zero residual privilege.

### 9.4 Cross-owner foreign key

1. Prove which owner needs `REFERENCES`.
2. Grant a transaction-scoped exact-table `REFERENCES` bridge.
3. Create the foreign key under the correct owner.
4. Revoke the bridge before commit.
5. Prove no residual direct or inherited capability.

### 9.5 Ledger mismatch

Stop all writes. Produce:

- ordered repository hashes;
- ordered shared ledger hashes;
- first divergent index;
- expected parent release;
- exact target packet;
- whether the mismatch is missing, extra, or different bytes.

Never edit SQL or the ledger to make the lists look equal.

### 9.6 Environment mismatch

1. Name the exact variable.
2. Name Preview and Production values by state, never by secret.
3. Prove which deployment consumes each value.
4. Update only the intended environment.
5. Redeploy only if required.
6. Drive the live boundary.

Do not add code fallbacks that silently select another database.

### 9.7 Provider boundary failure

1. Fail closed.
2. Verify provider project/resource identity.
3. Verify terms, capability, and required permission.
4. Use a non-destructive probe.
5. Record timeout, retry, idempotency, and fallback behavior.
6. Keep the core read path available when the optional provider fails.

## 10. Blocker packet

Every blocker report must use this template:

```text
BLOCKER CLASS:
OWNER:
EXACT MISSING ARTIFACT:
WHY IT IS REQUIRED:
TARGET / ENVIRONMENT:
SAFE WORK ALREADY COMPLETED:
EXACT NEXT ACTION:
COMMAND OR UI PATH:
FORBIDDEN SUBSTITUTE:
ROLLBACK:
EXPIRY OR RECHECK CONDITION:
DEPENDENT LANES:
```

Bad:

```text
Blocked on database approval.
```

Good:

```text
BLOCKER CLASS: Credential
OWNER: Platform maintainer
EXACT MISSING ARTIFACT: Direct Preview migration-owner credential for branch ID ...
WHY IT IS REQUIRED: Runtime principals cannot read or update the migration ledger.
EXACT NEXT ACTION: Recover the existing encrypted credential; do not rotate it.
FORBIDDEN SUBSTITUTE: Production URL, pooled URL, runtime principal, fabricated branch.
```

## 11. Handoff packet

Use this exact structure:

```text
OBJECTIVE:
CURRENT STATUS:
BASE COMMIT:
CANDIDATE COMMIT OR TREE:
EXACT CHANGED PATHS:
EXACT FROZEN PATHS:
MIGRATION LINEAGE:
PREVIEW TARGET PACKET:
PRODUCTION TARGET PACKET:
SHARED APPLICATION STATE:
RUNTIME ACTIVATION STATE:
FOCUSED CONTRACTS:
INDEPENDENT VERDICT:
DATA / ACCOUNT / PROVIDER MUTATIONS PERFORMED:
ROLLBACK:
OPEN BLOCKERS:
NEXT SAFE ACTION:
FORBIDDEN ACTIONS:
```

The receiver must acknowledge the exact packet before editing. A worklog, branch, commit,
or message does not claim paths; only current `LANES.md` does.

## 12. Release checklist

Before commit:

- exact lane paths only;
- no unrelated dirty paths staged;
- no secrets in diff or output;
- JSON/SQL/TypeScript syntax valid;
- focused contracts pass;
- skipped runtime proof disclosed;
- manifests match actual application state;
- old blocker text reconciled;
- independent refuter returns no P1/P2/P3.

Before Production:

- exact direct target proved;
- exact parent ledger proved;
- bounded bundle excludes later releases;
- advisory lock acquired;
- Preview proof passed;
- rollback path known;
- feature controls remain default-off.

After Production:

- exact ordered ledger and hashes proved;
- schema/owner/ACL/RLS/policy state proved;
- residual temporary privileges absent;
- expected tables empty or data migration counts exact;
- release manifests frozen;
- runtime controls checked separately;
- credentials removed from temporary local files;
- path-scoped commit pushed;
- handoff packet updated.

## 13. Definition of done

A data-layer fix is done when:

1. The live defect is corrected at its owning layer.
2. The exact target and lineage are proven.
3. Shared mutations are reproducible and bounded.
4. Applied migration bytes are frozen.
5. Preview and Production evidence are truthful.
6. Runtime activation state is explicit.
7. No temporary privilege or secret remains.
8. An independent refuter cannot find a P1, P2, or P3.
9. `LANES.md`, manifests, and handoff text agree.
10. The next engineer can continue without asking the Founder to rediscover context.

When any item is missing, report the exact gate packet. Do not invent a ghost blocker and
do not silently wait.
