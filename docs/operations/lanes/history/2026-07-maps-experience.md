# Historical Lane Archive: maps experience

Historical evidence only. This file grants no current path ownership, release permission, provider access, migration authority, or deployment authority. For active locks and gates, read root [LANES.md](../../../../LANES.md).

- Source: record authored at release (candidate commit `370cf07`), not extracted from a prior root snapshot
- Integrity: the block SHA-256 is listed in [this archive index](README.md)

## Records

<a id="2026-07-maps-experience-01"></a>

##### Maps theme-transition continuity — COMPLETE / PATHS RELEASED

Owner: released (was Private Contractor, Maps Delivery `c9c17443-ef5e-4a7b-9b6e-c8f5381da30c`).
Exclusive paths (all released):

- `docs/operations/departments/maps-location.md`
- `src/design-system/components/MapboxCanvas.tsx`
- `src/integrations/maps/MapboxAdapter.ts`

Removed the 3-4 second blank basemap during theme switch: streets-v12/dark-v11 cannot
style-diff ("Unimplemented: setSprite"), so setTheme now photographs the outgoing frame
(gl.readPixels during a render tick, near-black reads rejected), holds it under the DOM
markers through the rebuild, and cross-fades on ready or first idle; failure removes it
instantly; 8-second ceiling; hidden documents skip. The loading lifecycle event carries an
optional continuity flag and MapboxCanvas suppresses its opaque skeleton only for bridged
swaps. Candidate commit `370cf07` on Base `82d1a7d`; evidence `WD-MAPS-THEMEFADE-20260721-1`,
candidate tree `fec015d88b526521c7e94fec93912d41e47884dc509f5f6002fc9848bb81dfab`; driven in
Playwright chromium both directions (loading|captured|overlay=true|skeleton=false, cross-fade
observed, zero residual overlays); independent default-to-REFUTED refuter
`independent-claude-refuter-mapdrive-20260721-01` returned NOT_REFUTED on initial and delta
review; location-default-contract 20/20; tsc and eslint clean. Bounded residuals and the
three-scope hardware-GPU follow-up are recorded in the maps-location worklog entry.
The release-critical Maps Adapter lane is closed; the queued Presence integration
serialization over page/Canvas/Adapter is no longer blocked by a Maps lock.

