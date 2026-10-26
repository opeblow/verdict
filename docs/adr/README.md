# Architecture decision records

Short records of the decisions that shape Verdict, why they were made, and what they cost. Each one names the code and tests that enforce it, so a reviewer can check the claim.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-device-only-data-stateless-server.md) | Personal data lives only on the device; the server is a stateless proxy | Accepted |
| [0002](0002-raw-score-not-ui-score.md) | Every calculation uses `raw_score`, never `ui_score` | Accepted |
| [0003](0003-one-analysis-mode-per-trial.md) | A trial is locked to HD or SD by its first photo | Accepted |
| [0004](0004-change-must-clear-measured-noise.md) | Change is reported only when it clears each person's measured noise | Accepted |
| [0005](0005-pure-domain-layer.md) | Measurement and verdict rules are pure functions with no I/O | Accepted |
| [0006](0006-delete-from-youcam-after-local-save.md) | Photos are deleted from YouCam only after results are saved on the device | Accepted |
| [0007](0007-concern-sets-fill-the-billing-tier.md) | Concern sets are filled to the edge of YouCam's billing tier | Accepted |
| [0008](0008-browser-tests-mock-youcam.md) | Browser tests mock YouCam and never spend API units | Accepted |
| [0009](0009-light-checks-judge-the-room-not-the-skin.md) | Light checks judge the room, not the skin, so every skin tone gets the same answer | Accepted |
| [0010](0010-spoken-guidance-on-device.md) | Spoken guidance and a read-aloud verdict, using on-device speech only | Accepted |
| [0011](0011-mcp-tools-for-assistants.md) | The engine is available to AI assistants as stateless, read-only MCP tools | Accepted |

## Format

Each record has the same sections: **Context** (the forces at play), **Decision**, **Consequences** (good and bad), and **Enforced by** (the code and tests that hold it in place). A superseded record stays, with a link to its replacement.
