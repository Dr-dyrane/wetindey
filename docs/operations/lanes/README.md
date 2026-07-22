# Work Lanes System & Historical Archive

This directory stores historical lane archives and coordination logs for the WetinDey platform.

## Overview
* **Active Lane Registry**: [LANES.md](../../../LANES.md) — The required authoritative human coordination claim/index for current edits. Always consult and claim it before editing; it is advisory rather than a technically enforced lock.
* **Current-cycle history**: [history/README.md](history/README.md) — Exact source-snapshot records for completed lanes. It grants no authority.
* **Legacy historical archive**: [LANES-HISTORICAL-ARCHIVE.md](LANES-HISTORICAL-ARCHIVE.md) — Prior completed, superseded, and archived lane records.

## Guidance for Parallel Agents
1. **Check Locks**: Inspect `LANES.md` at root to verify that no active lane owns your target paths.
2. **Claim Lane**: Append your active lane block to `LANES.md` listing your exact exclusive paths.
3. **Release Lock**: Upon completing and verifying work, remove its active lock from root `LANES.md`, preserve its exact released record in the current-cycle history archive, and commit both atomically.
