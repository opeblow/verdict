# Contributing

Thanks for helping make Verdict better. This guide covers how to propose changes and what a good pull request looks like.

## Ground rules

- Be kind. This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
- Verdict handles face photos. Privacy and honesty are features, not extras. Read the invariants in [AGENTS.md](AGENTS.md#invariants-do-not-break-these) before changing measurement, storage or server code.
- Security problems go to [SECURITY.md](SECURITY.md), not public issues.

## Getting set up

Follow [SETUP.md](SETUP.md). You do not need a YouCam key to work on the UI, the statistics or the tests; the test suite uses fixtures.

## Workflow

1. Open an issue first for anything bigger than a small fix, so the approach can be agreed.
2. Branch from `main`: `fix/short-description` or `feat/short-description`.
3. Make the change with tests.
4. Run the gates:

   ```bash
   npm run check
   npm run build
   ```

5. Open a pull request using the template. Describe the user-visible effect and how you tested it. Add screenshots for UI changes.

## Commit messages

Use the imperative mood and say why:

```
Pool residual scatter into the noise estimate

A single near-identical baseline pair made "no change" impossible to reach,
so the app could never tell anyone to stop rebuying a product.
```

## What reviewers look for

- **Correctness.** Statistics and verdict rules have tests that pin the behaviour, including edge cases.
- **Honesty.** No claim of change without evidence above the noise floor. No medical language.
- **Privacy.** No new place where photos or scores leave the device or persist on a server.
- **Accessibility.** Keyboard reachable, labelled, readable contrast in light and dark modes.
- **Simplicity.** Fewer dependencies; pure functions where possible.

## Adding an active ingredient

Edit `ACTIVES` in [`src/lib/domain/ingredients.ts`](src/lib/domain/ingredients.ts):

- `match`: lowercase INCI or common-name fragments.
- `targets`: `fromWeek` (earliest visible change commonly reported) and `callWeek` (when a fair verdict is possible).
- `basis`: a named study if one anchors the range, otherwise a plain statement of the common range. Do not invent citations.
- Add a detection test in `tests/domain.test.ts`.

## Licence

By contributing you agree that your work is released under the [MIT License](LICENSE).
