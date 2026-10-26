# 0010. Spoken guidance runs on the device

Status: Accepted

## Context

Taking a matched photo means reading a live readout ("Too dark", "Light is coming from your left") while holding a phone at arm's length or facing a laptop camera. That is hard for people with low vision, and awkward for anyone. Reading the verdict also assumes a screen that can be seen.

Cloud speech services sound natural, but they would add a third party, a key, network calls and a privacy notice to an app whose promise is that nothing personal leaves the device except the photo sent to YouCam.

## Decision

- An opt-in **Speak guidance** toggle on the photo step reads out the same messages the screen shows: the light checks once they settle, the countdown, whether a photo is good or must be retaken, analysis progress, errors and "Results saved."
- A **Read the verdict aloud** button on the dashboard speaks the decision, the reason, each target's status and change in words, and the next dates.
- Speech uses the browser's built-in `speechSynthesis`, which runs on the device. No text is sent anywhere. The toggle is hidden where speech is not available.
- The setting is remembered on the device. Live messages are spoken only after they hold steady for under a second, so a flickering readout is not read on every frame.
- Spoken text is built from the same labels as the page, with written notation such as "+6.2" rewritten as words.

## Consequences

- People can line up, take and check a photo without reading the screen, and hear their verdict.
- No new network destination, key or data flow. The Content Security Policy is unchanged.
- Voice quality depends on the device. Every mainstream browser ships at least one voice.

## Enforced by

- [`src/lib/client/speech.ts`](../../src/lib/client/speech.ts): `speak`, `useSpokenGuidance` and `useSpeakWhenSettled`.
- [`src/components/verdict/spoken.ts`](../../src/components/verdict/spoken.ts): `spokenVerdict` and `forSpeech`.
- [`tests/unit/spoken.test.ts`](../../tests/unit/spoken.test.ts): the spoken verdict's content and wording.
- [`tests/e2e/spoken-guidance.spec.ts`](../../tests/e2e/spoken-guidance.spec.ts): what is said during a real capture and on the dashboard, that nothing is said until guidance is turned on, and that the setting is remembered.
- [`tests/e2e/a11y.spec.ts`](../../tests/e2e/a11y.spec.ts): the photo step and a dashboard with data pass axe in both themes.
