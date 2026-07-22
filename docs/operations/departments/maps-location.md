---
department_id: maps-location
department_name: Maps and Location
worklog_contract_version: 1
authority: durable-memory-only
---

# Maps and Location Department Worklog

## Scope and authority

This home preserves map provider, browsing context, device location, spatial semantics,
map/list/sheet agreement, and graceful-failure rationale. It does not authorize location
collection, provider access, UI edits, or rollout.

## Append-only entries

### 2026-07-19 - Conservative initialization

#### Transfer coordinates

- Base SHA: `2e76199e40b4e42a324420f49398e9f228099316`
- Candidate tree SHA-256: `829fcb2dd6130475e57c9af52cbb446c8a4752fb5dc970d1ae8a62fab075b3a8`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
AGENTS.md
docs/CONTRIBUTING.md
docs/operations/BRANCH-HANDOFF-TEMPLATE.md
docs/operations/DEPARTMENT-WORKLOG-PROTOCOL.md
docs/operations/WETINDEY-OPERATING-SYSTEM.md
docs/operations/departments/README.md
docs/operations/departments/catalog-stewardship.md
docs/operations/departments/client-reliability-offline.md
docs/operations/departments/community-growth.md
docs/operations/departments/contribution-integrity.md
docs/operations/departments/developer-experience.md
docs/operations/departments/executive-product.md
docs/operations/departments/human-interface.md
docs/operations/departments/legal-policy.md
docs/operations/departments/maps-location.md
docs/operations/departments/operations-field-data.md
docs/operations/departments/presence-safety.md
docs/operations/departments/program-release.md
docs/operations/departments/quality-release.md
docs/operations/departments/security-privacy.md
docs/operations/departments/seller-identity-access.md
docs/operations/departments/trust-data-governance.md
scripts/department-worklog-contract.test.ts
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Developer Relations & Engineering Enablement: department worklog protocol — active exact claim`
- Lane owner: `019f7995-5b7b-7ee1-81ef-2c3a3c57b836`
- Owned paths: Exactly the 23 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including LANES.md and all app, schema, migration, package, and ADR paths.
- Concurrent dependencies: Market, Community, Contribution, Maps, Catalog, and `LANES.md` work remain separately owned.

#### Decisions and rationale

[ADR-005](../../adr/005-mapbox-is-the-map-provider.md) accepts Mapbox with no geocoder.
[ADR-023](../../adr/023-browsing-context-and-device-location.md) separates browsing
context, device evidence, camera, and selected place but records architecture rather than
implementation authority. This entry preserves both boundaries.

#### Implementation

No map, location, or provider behavior changed. The file is documentation-only.

#### Evidence and refutations

- Evidence ID: `WD-DEVREL-WORKLOG-20260719-FWD1`
- Refuter ID: `independent-codex-refuter-forward-20260719-07`
- Review binding: Full Base SHA, canonical Candidate tree SHA-256, and sorted Candidate paths.
- Verdict location: External read-only refuter output keyed by Evidence ID and Refuter ID; not embedded because changing reviewed bytes invalidates it.
- Runtime and external evidence: Not claimed by this documentation-only bootstrap.

#### Known failures

`UNKNOWN` for map runtime behavior, device-location runtime behavior, browser permissions,
outside-coverage behavior, permission denial, and provider failure; this bootstrap drove
none of those surfaces.

- Unknown scope: `map runtime behavior; device-location runtime behavior; browser permissions; outside-coverage behavior; permission denial; provider failure`
- Unknown owner: Maps/Location chief and Quality/Release
- Unknown resolution action: Capture direct browser and provider evidence for unknown scope `map runtime behavior; device-location runtime behavior; browser permissions; outside-coverage behavior; permission denial; provider failure` on the exact map paths in the next lane-owned Maps entry.

#### External gates

- External gate owner: Maps/Location chief and Quality/Release
- Gate state: No gate is inferred closed by this bootstrap.

Location privacy, exact-origin egress, provider configuration, browser evidence, and
deployment each require separate authorization and direct proof.

#### Integration order

Any future correction must reconcile ADR-023, current Maps lanes, provider state, source
diff, and independent browser evidence before transfer.

#### Rollback or disable

Documentation cannot disable map or location behavior. Runtime containment remains a
separately owned and authorized change.

#### Exact next action

- Actor: Maps and Location chief
- Action: Resolve the current map incident into one evidence-backed lane proposal.
- Target: Exact adapter, canvas, location, provider, browser, and worklog paths required by proven cause.
- Completion: Program Management records confirmed non-overlapping paths and a separate browser refuter.

### 2026-07-21 - Theme-transition continuity

#### Transfer coordinates

- Evidence ID: `WD-MAPS-THEMEFADE-20260721-1`
- Base SHA: `82d1a7d6db5546fc5e44420d9d2ffccf41062c06`
- Candidate tree SHA-256: `fec015d88b526521c7e94fec93912d41e47884dc509f5f6002fc9848bb81dfab`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
docs/operations/departments/maps-location.md
src/design-system/components/MapboxCanvas.tsx
src/integrations/maps/MapboxAdapter.ts
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Maps theme-transition continuity — ACTIVE`
- Lane owner: Private Contractor, Maps Delivery `c9c17443-ef5e-4a7b-9b6e-c8f5381da30c`
- Owned paths: Exactly the 3 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including the queued Presence path set, every sharedUsers seam, POI hierarchy values, route semantics, `src/app/page.tsx`, `src/app/_components/`, schema, migrations, providers, and deployment state.
- Concurrent dependencies: Account deletion vertical (Private Contractor, Full-Stack Delivery) runs concurrently over disjoint paths; the lane owning `scripts/location-default-contract.test.ts` contributed the `FakeMap` guard inside `canPhotographCurrentFrame` and that contribution is disclosed below.

#### Decisions and rationale

Theme switching between `streets-v12` and `dark-v11` cannot style-diff: Mapbox logs "Unable to perform style diff: Unimplemented: setSprite.. Rebuilding the style from scratch" and `setStyle` tears down every source while the canvas shows bare background paint for 3-4 seconds in both toggle directions (2026-07-21 runtime evidence, localhost drive). Decision: photograph the outgoing frame during a `render` event using `gl.readPixels` (the same buffer authority `inspectFrameEvidence` uses, because canvas-level `toDataURL` reads an already-presented cleared buffer on ANGLE/SwiftShader and returns black), reject near-black photographs (max channel below 8 over an 8x8 grid), hold the photograph as a DOM overlay inside Mapbox's canvas container below the DOM markers, and remove it on the lifecycle seam: faded 300ms on ready or first idle, instantly on failed so the failure surface is never masked, unconditionally at an 8-second ceiling, and on destroy. Hidden documents skip capture entirely (no animation frames arrive, and nobody is watching). The loading lifecycle event gained an optional `continuity` flag so `MapboxCanvas` suppresses its opaque loading skeleton only for adapter-bridged swaps; first loads, retries without a photograph, context loss, and failures keep the skeleton or failure card. Rejected alternative: a shared sprite or single-style paint theming (the two styles differ by far more than the sprite); rejected `preserveDrawingBuffer` (permanent performance cost for a per-toggle need).

#### Implementation

`src/integrations/maps/MapboxAdapter.ts` reaches its live call site through the existing `setTheme` path (MapboxCanvas theme effect). `src/design-system/components/MapboxCanvas.tsx` changes `mapCanvasOverlay` and the style-state reducer, both already live. Documentation change is this entry. Nothing new is exported without a caller. The `FakeMap` guard in `canPhotographCurrentFrame` was contributed by the lane owning `scripts/location-default-contract.test.ts` to keep its committed suite on the direct-swap path; it is disclosed here rather than silently absorbed.

#### Evidence and refutations

- Refuter ID: `independent-claude-refuter-mapdrive-20260721-01`
- Review binding: Full Base SHA, canonical Candidate tree SHA-256, and sorted Candidate paths.
- Verdict location: External read-only refuter output keyed by Evidence ID and Refuter ID; not embedded because changing reviewed bytes invalidates it.
- Runtime and external evidence: Playwright chromium (SwiftShader WebGL) against the local dev server. Both toggle directions: `data-map-theme-snapshot="captured"`, overlay present through the loading window, loading skeleton suppressed only while bridged (`loading|captured|ov=true|skel=false`), fade observed mid-transition (computed opacity 0.425), overlay collected, lifecycle ends ready, zero snapshot overlays remain. `npx tsx scripts/location-default-contract.test.ts` passes 20 of 20 against the candidate; `npx tsc --noEmit` and eslint on both source paths are clean.
- Checks not run: real-device capture behavior on hardware GPUs and Safari or iOS; hidden-document skip runtime behavior (code-read only, the embedded pane could not initialize the map while hidden); failed-swap runtime behavior (a genuine style failure could not be forced because the pre-existing read-error policy still reaches ready with provider hosts blocked).
- Delta refutation nuances, accepted as bounded: a bridged swap whose style load outlives the 8-second overlay ceiling shows bare rebuild paint (the old defect, never a masked failure) for at most 2 seconds until ready or the exhausted-attempts failure card; a context restore during a bridged swap keeps the skeleton suppressed while the physically present overlay still bridges, which matches the continuity predicate.

#### Known failures

The candidate is proven in one rendering environment only. `UNKNOWN` remains for real-device capture behavior on hardware GPUs and Safari or iOS. `UNKNOWN` remains for hidden-document skip runtime behavior because the skip branch was verified by reading, not driven. `UNKNOWN` remains for failed-swap runtime behavior because no genuine style failure could be forced during a bridged swap. Also disclosed: `scripts/department-worklog-contract.test.ts` fails on committed main before this candidate (its hard-wired lane heading was archived out of root `LANES.md` by the governance split); that gate failure is owned outside this lane and was flagged to the controller.

- Unknown scope: `real-device capture behavior; hidden-document skip runtime behavior; failed-swap runtime behavior`
- Unknown owner: Maps/Location chief and Quality/Release
- Unknown resolution action: Capture direct evidence from one hardware-GPU browser session (Safari or iOS included) capturing real-device capture behavior, one backgrounded-tab toggle capturing hidden-document skip runtime behavior, and one forced provider outage capturing failed-swap runtime behavior, recording `data-map-theme-snapshot` and overlay state for each in the next lane-owned Maps entry.

#### External gates

- External gate owner: Maps/Location chief and Quality/Release
- Gate state: No gate is inferred closed by this entry. Push, deployment, and release-controller authority remain separate; a local commit is not promotion.

#### Integration order

Commit the two source paths and this worklog entry as one path-scoped candidate after the delta refutation verdict; release the `LANES.md` claim in an immediately following path-scoped commit once the file is not mid-edit by another lane; the release-critical Maps Adapter closure unblocks the queued Presence integration serialization.

#### Rollback or disable

Reverting the two source paths restores the prior direct-swap behavior with the opaque skeleton; no data, schema, provider, or deployment state is touched, so a local revert is complete containment. Forward-repair owner: Maps/Location chief.

#### Exact next action

- Actor: Maps and Location chief
- Action: Capture the three-scope runtime evidence named in Unknown resolution action on a hardware-GPU device.
- Target: Exact path layout and snapshot evidence on `src/integrations/maps/MapboxAdapter.ts` and `src/design-system/components/MapboxCanvas.tsx` during theme swaps.
- Completion: The next lane-owned Maps entry records the three scopes with direct evidence and closes or narrows this entry's Unknown scope.

### 2026-07-21 - Three-scope transition evidence

#### Transfer coordinates

- Evidence ID: `WD-MAPS-THEMEFADE-20260721-2`
- Base SHA: `8b1d7ca4bfe67215f4cbaa963ed1a093849f7182`
- Candidate tree SHA-256: `21b35ad55c26aebf725e1fc30cdb16fcb4e8eeb513469874ebbfae92e4c4ec4c`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
docs/operations/departments/maps-location.md
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Maps three-scope evidence entry — ACTIVE`
- Lane owner: Private Contractor, Maps Delivery `c9c17443-ef5e-4a7b-9b6e-c8f5381da30c`
- Owned paths: Exactly the 1 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including both map source paths, which this entry cites but does not touch.
- Concurrent dependencies: Root UI Component Decluttering and Public review privacy containment run concurrently over disjoint paths.

#### Decisions and rationale

This entry records evidence only; no decision changes. It resolves the three-scope
Unknown left by `WD-MAPS-THEMEFADE-20260721-1` using the diagnostics that entry
installed (`data-map-theme-snapshot`, overlay presence, lifecycle attributes).

#### Implementation

Documentation-only. No source path changed; the cited behavior shipped at `370cf07`.

#### Evidence and refutations

- Refuter ID: independent-claude-refuter-evidence-20260721-02
- Review binding: Full Base SHA, canonical Candidate tree SHA-256, and sorted Candidate paths.
- Verdict location: External read-only refuter output keyed by Evidence ID and Refuter ID; not embedded because changing reviewed bytes invalidates it.
- Runtime and external evidence: (1) real-device capture behavior CLOSED: Playwright chromium on ANGLE Metal (`Apple M2 Pro`, hardware renderer confirmed via WEBGL_debug_renderer_info): toggle produced `data-map-theme-snapshot="captured"`, overlay bridged and was collected by t+318ms, zero skeleton frames. (2) hidden-document skip runtime behavior CLOSED: the embedded browser pane with `document.visibilityState === "hidden"` and lifecycle ready produced `data-map-theme-snapshot="skipped-hidden"`, no overlay, direct swap to loading. (3) failed-swap runtime behavior NARROWED: with every `mapbox.com` host aborted and HTTP cache disabled mid-session, the adapter still reached ready (the pre-existing read-error-is-diagnostic-only policy; refuter Finding B, outside this lane), so a failed lifecycle remains unforceable in this environment; the user-facing risk is disproven directly because the overlay was collected at t+505ms via the first-idle fallback with the provider severed, never sticking.
- Checks not run: Safari and iOS device runs; a genuine renderer failure during a bridged swap.

#### Known failures

`UNKNOWN` remains for Safari and iOS capture behavior (no Safari or iOS run exists yet) and for renderer-failure bridging behavior (a genuine renderer failure during a bridged swap was not produced; only provider outage was driven).

- Unknown scope: `Safari and iOS capture behavior; renderer-failure bridging behavior`
- Unknown owner: Maps/Location chief and Quality/Release
- Unknown resolution action: Capture direct evidence for `Safari and iOS capture behavior` with one Safari or iOS Simulator drive and for `renderer-failure bridging behavior` with one forced context-loss during a bridged swap, recording `data-map-theme-snapshot` and overlay state in the next lane-owned Maps entry.

#### External gates

- External gate owner: Maps/Location chief and Quality/Release
- Gate state: No gate is inferred closed by this entry.

#### Integration order

Append after the in-flight edits by other lanes to `LANES.md` and this log commit; claim first; release the lane in the immediately following LANES.md commit.

#### Rollback or disable

Documentation-only; reverting this entry removes evidence, not behavior.

#### Exact next action

- Actor: Maps and Location chief
- Action: Capture the Safari or iOS Simulator drive evidence and the forced context-loss drive evidence named in Unknown resolution action.
- Target: `data-map-theme-snapshot` diagnostic evidence and snapshot-overlay lifecycle evidence during theme swaps in Safari or the iOS Simulator and under a forced WebGL context loss.
- Completion: The next lane-owned Maps entry records both scopes with direct evidence and closes or narrows this entry's Unknown scope.

### 2026-07-22 - Renderer-failure bridging evidence

#### Transfer coordinates

- Evidence ID: `WD-MAPS-THEMEFADE-20260722-3`
- Base SHA: `b0f78cd25c35c74732d20eb89a7566bcc7193fef`
- Candidate tree SHA-256: `02f1ca61a685585263b192936b9fff2b9b2c1a283b9b2542aa4bc8769e26ef67`
- Candidate hash algorithm: `wetindey-candidate-tree-v1`
- Candidate paths (sorted):

```text
docs/operations/departments/maps-location.md
```

- Final commit SHA: Reported by the worker/controller after commit; not embedded in these bytes.

#### Lane and path boundaries

- Lane heading: `#### Maps renderer-failure evidence entry — ACTIVE`
- Lane owner: Private Contractor, Maps Delivery `c9c17443-ef5e-4a7b-9b6e-c8f5381da30c`
- Owned paths: Exactly the 1 paths in the preceding Candidate paths (sorted) block; no other path.
- Excluded paths: Every repository path not listed in Candidate paths (sorted), including both map source paths this entry cites but does not touch.
- Concurrent dependencies: Contribution moderation service and ACL repair lanes run concurrently over disjoint paths.

#### Decisions and rationale

Evidence only; no decision changes. This entry resolves the renderer-failure half of the Unknown scope left by `WD-MAPS-THEMEFADE-20260721-2` using the diagnostics installed at `370cf07` and the forced-loss extension WEBGL_lose_context, the sanctioned browser mechanism for inducing a genuine context loss.

#### Implementation

Documentation-only. No source path changed; the cited behavior ships at `370cf07` and `03adfad`.

#### Evidence and refutations

- Refuter ID: `independent-claude-refuter-evidence-20260722-03`
- Review binding: Full Base SHA, canonical Candidate tree SHA-256, and sorted Candidate paths.
- Verdict location: External read-only refuter output keyed by Evidence ID and Refuter ID; not embedded because changing reviewed bytes invalidates it.
- Runtime and external evidence: renderer-failure bridging behavior CLOSED. Playwright chromium on ANGLE Metal against the local dev server: a bridged theme swap was started (overlay installed, frame evidence context-lost after the yank at swap+150ms), then WEBGL_lose_context.loseContext() forced a genuine loss. Observed sequence: t+1ms loading with overlay still present; t+201ms overlay REMOVED and the loading skeleton returned (the context-loss lifecycle emit carries continuity false, so the canvas owner honestly covers); t+5244ms ready with frame evidence visible, no overlay, no skeleton; final state after restoreContext remained ready and clean. The photograph can not become wallpaper under a genuine renderer loss.
- Checks not run: Safari and iOS capture behavior. Attempted this cycle and blocked on host tooling: `xcrun simctl list devices available` returns zero iPhone or iPad devices (no iOS Simulator runtime installed on this machine) and `safaridriver` is not enabled; installing the iOS platform or enabling safaridriver requires owner action.

#### Known failures

`UNKNOWN` remains for Safari and iOS capture behavior; the drive is blocked on host tooling only the owner can install, as recorded above.

- Unknown scope: `Safari and iOS capture behavior`
- Unknown owner: Maps/Location chief and the Founder for host tooling
- Unknown resolution action: Capture direct evidence for `Safari and iOS capture behavior` with one Safari or iOS Simulator theme-toggle drive recording `data-map-theme-snapshot` and overlay state in the next lane-owned Maps entry, once the owner installs an iOS Simulator runtime or enables safaridriver on this machine.

#### External gates

- External gate owner: Maps/Location chief and Quality/Release
- Gate state: No gate is inferred closed by this entry. Host tooling installation is an owner decision, not a lane action.

#### Integration order

Append after concurrent LANES.md bursts; release the lane in the immediately following LANES.md commit; diff the replacement span before committing the release burst.

#### Rollback or disable

Documentation-only; reverting this entry removes evidence, not behavior.

#### Exact next action

- Actor: Founder, then Maps and Location chief
- Action: Run the Safari or iOS theme-toggle capture drive named in Unknown resolution action, once an iOS Simulator runtime is installed or safaridriver is enabled.
- Target: `data-map-theme-snapshot` diagnostic evidence and snapshot-overlay lifecycle evidence during theme swaps in Safari or the iOS Simulator.
- Completion: The next lane-owned Maps entry records the scope with direct evidence and closes this entry's Unknown scope.
