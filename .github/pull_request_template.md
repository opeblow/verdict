## What and why

<!-- The user-visible effect, and the reason for the change. -->

## How it was tested

- [ ] `npm run check` passes
- [ ] `npm run build` passes
- [ ] `npm run test:e2e` passes (needed for UI changes)
- [ ] New behaviour has a test
- [ ] UI changes: screenshots attached, checked in light and dark mode and at phone width

## Invariants

- [ ] Calculations still use `raw_score`, never `ui_score`
- [ ] No photo or score is stored or logged on the server
- [ ] User-facing copy stays cosmetic, with no medical claims
