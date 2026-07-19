# Work Lanes System & Historical Archive

This directory stores historical lane archives and coordination logs for the WetinDey platform.

## Overview
* **Active Lane Registry**: [LANES.md](../../../LANES.md) — The lean, primary coordination contract at the root of the workspace. Always check `LANES.md` before claiming exclusive path locks.
* **Historical Archive**: [LANES-HISTORICAL-ARCHIVE.md](LANES-HISTORICAL-ARCHIVE.md) — Contains completed, superseded, and archived work lanes from prior development cycles.

## Guidance for Parallel Agents
1. **Check Locks**: Inspect `LANES.md` at root to verify that no active lane owns your target paths.
2. **Claim Lane**: Append your active lane block to `LANES.md` listing your exact exclusive paths.
3. **Release Lock**: Upon completing and verifying your work, update your lane in `LANES.md` to `RELEASED / PATHLESS` and commit.
