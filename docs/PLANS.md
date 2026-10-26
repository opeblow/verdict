# Plans

Research, product decisions and the plan to the submission deadline for the **YouCam API Skin AI and eCommerce VTO Hackathon** (Perfect Corp, on Devpost).

- Submission deadline: **2 November 2026, 11:45 ET (08:45 PT)**
- Judging: 3 to 20 November. Winners around 24 November.
- Track: **Skin AI**

## 1. Research

### What the brief asks for

> "People don't wonder about their skin in the abstract; they wonder right before a purchase, right after a bad breakout, or right when they're standing in front of a mirror deciding whether a product is working. Build something that meets that moment."

Most entrants will build a one-shot "analyse my selfie, recommend products" app. The brief names a different moment: **deciding whether a product is working.** That moment cannot be answered by one photo. It needs repeated, comparable measurements over weeks. That is what Verdict is.

### Judging criteria, equally weighted

| Criterion | What the judges ask | How Verdict answers |
|---|---|---|
| Technological implementation | Thorough, skilful YouCam integration; working, non-trivial code | Full file, upload, task, poll and delete cycle; HD and SD; region-level scores; masks; tier-aware concern planning; live error format handled; 100+ tests |
| Design | A complete, coherent product, not a proof of concept | Four-step onboarding, guided capture, dashboard, reminders, export, erase; a distinctive editorial design system; light and dark |
| Potential impact | A credible case for a real problem and audience, solved as demonstrated | Every skincare buyer faces "is it working?"; money saved on products that do nothing; irritation caught early |
| Quality of idea | Creative, non-obvious API use; real understanding of the problem | Uses the API as a measuring instrument across time, not a one-off score; noise floor, matched light, ingredient timelines, purge versus irritation |

Ties are broken on technological implementation first, so that criterion gets the most engineering depth.

### Round one winners (July to August 2026, 238 submissions)

| Place | Project | Pattern |
|---|---|---|
| 1st | Aloud: voice-first skincare for blind and low-vision shoppers | Inclusion; honest uncertainty; guardrails against medical claims; live demo, native shells, published tests |
| 2nd | ShadeSpan: each garment shown on six skin tones, with colour-fit scoring | Inclusion of under-represented skin tones |
| Finalist | CASTING: one product photo on eight measured skin tones | Retail tooling |
| Finalist | KeepMe: shopper chooses what the AI may change, unapproved edits flagged | Trust and consent |
| Finalist | ConfidFit: Shopify try-on labelled as preview, not a fit guarantee | Honesty about AI limits; shipped to a real store |

Perfect Corp's founder and CEO, Alice Chang, framed round two as finding "more ideas that make beauty and fashion shopping work for everyone".

**Lessons applied to Verdict**

1. Every winner made **honesty about AI output** part of the product. Verdict is built on it: raw scores, a measured noise floor, confidence intervals, and "too early" as a real answer.
2. Winners shipped **real, testable products** with public repositories, CI and live demos. Verdict ships the same.
3. Winners showed **domain understanding** beyond the API: accessibility law, colour science, consent. Verdict brings dermatology timelines, skin renewal cycles, purging and photographic measurement practice.
4. Inclusion matters to this sponsor. Verdict compares each person only with themselves, in their own light, which avoids population norms that may fit some skin tones poorly. It states the remaining model limits openly.

### Sponsor signals

- YouCam documents that `ui_score` is "adjusted to produce more favourable results" as a motivator. A product that understands this and uses `raw_score` for measurement shows genuine API understanding.
- Perfect Corp is pushing agentic and MCP integrations (the hair and beard API launch in June 2026 noted native MCP support). That is a stretch goal here, not the core.
- The brief asks for "real impact beyond a simple API call". Verdict's value comes from what happens across many calls.

## 2. Product

### One sentence

Verdict runs a fair, measured trial of one skincare product on your own face and tells you whether to keep buying it.

### Audience

Anyone who buys skincare, and especially people trying an active ingredient (retinoids, acids, niacinamide, vitamin C) who give up after two or three weeks, or keep paying for something that does nothing.

### Core loop

1. **Product**: search Open Beauty Facts, scan a barcode, or enter by hand. Actives are detected from the ingredient list.
2. **Goals**: targets suggested from the actives; each shows its fair-verdict week. Optional price for cost-per-week.
3. **Setup**: one spot and time of day; the plan shows what is measured and the unit budget.
4. **Baseline**: two photos a minute apart. Their difference is the noise floor.
5. **Weekly check-in**: first photo overlaid as a guide; light measured and compared with the first photo; optional second photo.
6. **Verdict**: keep, stop, wait (with date), likely purging, more data, or don't rebuy, with the evidence behind it.

### Decisions and their reasons

| Decision | Reason |
|---|---|
| `raw_score` for all maths | `ui_score` is adjusted upwards by design |
| Mode locked per trial | HD and SD are different models; their scores are not comparable |
| 3:4 portrait crop with 68%-wide face guide | API needs the face wider than 60% of the image; same framing on every device |
| Redness always measured | Irritation must be caught whatever the product claims |
| Fill to the billing tier edge | Units are billed per tier; extra concerns inside the tier are free information |
| Masks copied to the device immediately | Result URLs expire in about two hours |
| Task deleted after results are saved | Minimises how long a face photo exists off the device |
| No accounts, no database | Face photos are sensitive; the simplest safe store is the user's own device |
| One-sided "no meaningful benefit" test for "don't rebuy" | The purchase question is "does it deliver at least a meaningful benefit?" |
| Deterministic rules, no LLM in the decision | Decisions must be explainable, repeatable and testable |

## 3. Architecture

See the diagrams in [README.md](ARCHITECTURE.md). Summary:

- **Next.js 16 App Router, React 19, TypeScript strict.**
- **Domain core** (`src/lib/domain`): pure functions for concerns, ingredients, statistics and verdict rules. No I/O, fully unit-tested.
- **Server** (`src/app/api`, `src/lib/server`): stateless proxy to YouCam and Open Beauty Facts with validation, rate limits, an access code option and an SSRF allow-list.
- **Client** (`src/lib/client`, `src/components`): capture with live light checks, IndexedDB storage, export and import, calendar export.

## 4. Status

| Area | State |
|---|---|
| YouCam client: register, upload, task, poll, delete | Done, tested against documented and live-observed shapes |
| Statistics and verdict engine | Done, tested |
| Capture flow with light matching and alignment overlay | Done |
| Product search, barcode scan, manual entry | Done |
| Dashboard, charts, compare slider, masks, cost, log | Done |
| Calendar reminders, export, import, erase | Done |
| CI, CodeQL, Dependabot, docs | Done |
| Live end-to-end run with a real key | **To do: needs the YouCam key** |
| Deployment and access code | **To do** |
| Demo video | **To do** |

## 5. Plan to the deadline

| Date | Work |
|---|---|
| Sun 25 Oct | Build complete. Push to GitHub. Add `YOUCAM_API_KEY`. Run `npm run smoke:youcam` with a real selfie. |
| Mon 26 Oct | Full live trial on yourself: baseline pair plus one check-in. Fix anything the live API reveals. Commit a redacted live fixture (scores only, no URLs). Deploy to Vercel with `ACCESS_CODE`. |
| Tue 27 Oct | Test on a real phone (iOS Safari, Android Chrome): camera, framing, HD versus SD, export and import. |
| Wed 28 Oct | Ask two or three friends to start a real trial on their phones. Note every confusing moment and fix it. |
| Thu 29 Oct | Replace README screenshots with real captures where you are comfortable showing a face, or keep the illustrated sample data. Record the demo video (script below). |
| Fri 30 Oct | Edit the video to under 3 minutes, upload to YouTube as public. Write the Devpost description from [docs/SUBMISSION.md](SUBMISSION.md). |
| Sat 31 Oct | Submit a complete draft on Devpost. Post the demo publicly tagging @YouCam API with the disclosure "Received API credits for sharing", and claim the bonus units. |
| Sun 1 Nov | Final pass: links, testing instructions, access code, units remaining. |
| Mon 2 Nov | Deadline 08:45 PT. Do not change the live deployment during judging. |

### Keep alive through judging (3 to 20 November)

- Keep at least 300 units on the account. Redeem codes are valid 90 days from redemption.
- Keep the deployment, access code and YouTube video public and unchanged.
- Check `/api/health` every few days.

## 6. Demo video script (2 min 50 s)

| Time | Shot | Narration |
|---|---|---|
| 0:00 | Bathroom shelf of half-used bottles | "Everyone has this shelf. Products we gave up on after two weeks, and products we keep buying without knowing if they work." |
| 0:12 | Landing page | "Verdict answers one question, the one you ask in front of the mirror: is this product working?" |
| 0:20 | Product search, actives detected, targets with fair-verdict weeks | "Pick the product. Verdict reads the ingredients. Niacinamide takes about eight weeks to judge fairly on pores, four on oil." |
| 0:40 | Baseline capture on a phone, light readout, two photos | "Two photos a minute apart. YouCam AI Skin Analysis measures both. The difference is my noise floor: how much scores move when nothing has changed." |
| 1:05 | Network panel or code: file, task, poll, delete | "Under the hood: YouCam's file API, a presigned upload, an HD skin analysis task across eight concerns, polling, then the photo is deleted from YouCam once results are on my phone." |
| 1:25 | Check-in with first photo overlay and a light mismatch warning | "A week later, my first photo guides the framing, and Verdict refuses a photo in different light, because a brighter bathroom looks like better skin." |
| 1:45 | Dashboard: Keep verdict, chart, noise band, range | "After eight weeks: pores up 6.7 points, with a 95% range of 3.9 to 9.5, clear of my 2.2-point noise. Keep buying it." |
| 2:05 | Retinol trial showing Purging | "Different product, different answer. More blemishes in week three of a retinol is purging, not failure. Verdict says wait, and keeps watching redness." |
| 2:20 | Method page, raw_score note | "It uses YouCam's raw scores, not the display scores that are tuned to be encouraging, and the whole method is published." |
| 2:35 | Privacy and export | "No account. Photos stay on the phone." |
| 2:45 | Logo | "Verdict. Stop guessing, start measuring." |

Record on the phone the app is built for, with real API calls. No copyrighted music.

## 7. Stretch goals, if time allows

1. **YouCam Skin Tone Analysis as a light calibration check**, adding a second, independent measure of whether conditions match the baseline.
2. **MCP or agent workflow**: expose "start trial", "check in" and "get verdict" as tools so an assistant can run a trial conversationally.
3. **Split-face mode**: apply the product to one side only and compare left and right halves using the detection masks, the method used in Bissett 2005.
4. **Installable app**: service worker for offline viewing of past trials.
5. **Retailer view**: anonymised, opt-in aggregate "how often does this product earn a Keep" for a product page.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Live API differs from documentation | Defensive normaliser; smoke script; capture a live fixture on day one |
| Units run out during judging | Access code, per-visitor and daily caps, unit budget shown in the app |
| Judges do not run the app | Video and README carry the whole story; screenshots on every page |
| Judges cannot wait eight weeks | Video shows a completed trial; landing page shows a computed example; method page shows the rules |
| Phone camera below HD resolution | Automatic SD fallback at baseline, locked for the trial |
