# Devpost submission draft

Copy into the Devpost form. Replace the bracketed items before submitting.

**Project name:** Verdict

**Tagline:** Is your skincare working, or are you just hoping? A measured trial of one, built on YouCam AI Skin Analysis.

**Track:** Skin AI

**Links**

- Code: https://github.com/opeblow/verdict
- Live app: [https://your-deployment]
- Demo video: [https://youtu.be/...]
- Testing access code: `[ACCESS_CODE]`

---

## Inspiration

The brief names the moment exactly: someone in front of the mirror, deciding whether a product is working. That question can't be answered by one photo, and it's usually asked at the wrong time. Retinol, vitamin C and peptides took 8 to 12 weeks to show in their best-known trials, while most people decide within two or three. Meanwhile a brighter bathroom can make skin look better without anything changing. So people abandon products that would have worked, keep paying for ones that don't, and mistake an early purge for failure or a reaction for a purge.

## What it does

Verdict runs a fair experiment on your own face and ends with a decision.

1. **Pick the product.** Search Open Beauty Facts, scan the barcode, or type it in. Verdict reads the ingredient list, finds the actives, and gives each target a fair-verdict week. The slowest active sets the deadline.
2. **Two baseline photos, a minute apart.** YouCam AI Skin Analysis measures both. Their difference is your personal noise floor: how much scores move when your skin hasn't changed.
3. **Weekly check-ins.** Your first photo is overlaid on the camera so you line up the same way. Brightness, side light, colour temperature, glare and blur are measured live and compared with the first photo. Photos in very different light are refused.
4. **A verdict, with the evidence.** Keep, stop, wait until a named date, likely purging, more data, or don't rebuy. A change is only reported when its 95% range clears your noise floor. Redness is measured every time as an irritation monitor, whatever the product claims.

It also shows cost per week and per year, exports calendar reminders, and stores everything on the device with export, import and erase.

## How we built it: the YouCam integration

- **AI Skin Analysis v2**, end to end on the server: `POST /s2s/v2.0/file/skin-analysis`, presigned `PUT`, `POST /s2s/v2.0/task/skin-analysis` with `format: "json"`, polling `GET /s2s/v2.0/task/skin-analysis/{task_id}`, then `POST /s2s/v2.0/task/delete` once results are on the device.
- **HD and SD**, chosen from the device's camera at baseline and locked for the trial, because the two models' scores aren't comparable.
- **Up to 8 concerns per call**, including regional scores (pores by nose, cheek, forehead; lines by area). Concern sets are padded to the edge of YouCam's billing tier so no paid capacity is wasted.
- **`raw_score`, not `ui_score`.** YouCam documents the UI score as adjusted upwards to be encouraging. That's right for a one-off result and wrong for measuring change.
- **Detection masks** copied to the device immediately (result links expire in about two hours) and shown as overlays on a before-and-after slider.
- **Framing for the model.** Every photo is cropped to 3:4 with a face guide sized to the API's "face wider than 60%" rule, so laptops and phones frame identically.
- **Live error handling.** The live API returns engine errors as `"('message', 'error_code')"`; each is parsed and turned into a plain instruction such as "Move closer" or "Face the window".

Stack: Next.js 16, React 19, TypeScript strict, IndexedDB, Zod. The statistics and verdict rules are pure TypeScript with over 100 unit tests, including a copy guard that fails CI on medical claims.

## Challenges

- **Making "don't rebuy" reachable honestly.** An early version could never say a product failed: with few photos, the interval was always too wide to prove "no change". Pooling replicate noise with the scatter around the trend, and asking the one-sided question that matters for a purchase ("is a meaningful benefit ruled out?"), fixed it without loosening the bar for "it's working".
- **Light.** Scores move with light. Measuring brightness, side light and colour temperature on every frame, and comparing them with the first photo, became a core feature rather than a tip.
- **Purge versus reaction.** Telling them apart needed domain rules: which actives speed up cell turnover, how long purging lasts, and why redness overrides everything.

## Accomplishments

- A decision people can act on, with the reason and the numbers behind it.
- No accounts and no server-side storage of faces. Photos are deleted from YouCam as soon as results are saved locally.
- The whole method is published in the app, including its limits.

## What we learned

The API is most valuable as a measuring instrument used over time. One score is a curiosity. A series, with known noise, is evidence.

## What's next

- Split-face trials (product on one side only), using the detection masks.
- YouCam Skin Tone Analysis as an independent light-matching check.
- An MCP tool interface so an assistant can run check-ins conversationally.
- Opt-in, anonymised "how often does this product earn a Keep" for retailers' product pages.

## Testing instructions for judges

1. Open [live app] on a phone or laptop with a camera, in good front light.
2. If asked, enter the access code `[ACCESS_CODE]` (also under **Your data**).
3. **Start a trial**, choose **Enter by hand**, paste `Aqua, Niacinamide, Zinc PCA, Glycerin` as ingredients, accept the suggested targets, and continue.
4. Take the two baseline photos. Each takes 10 to 40 seconds to analyse.
5. Open the trial and choose **Check in now** to see the alignment overlay and light matching against your first photo.
6. A finished eight-week trial cannot be produced in one sitting. The landing page shows the engine's output on an example trial, the demo video shows completed trials, and `npm test` runs every verdict rule.

Repository setup: [SETUP.md](SETUP.md).

## Built with

nextjs, react, typescript, youcam-api, perfect-corp, indexeddb, zod, vitest, open-beauty-facts

---

## Social post for the bonus units

Post the demo video publicly from an account created before 29 September 2026, keep it public for 30 days, and include:

> Verdict tells you if your skincare is actually working. It runs a measured trial on your own face with @YouCam API AI Skin Analysis: two baseline photos to learn your noise floor, matched-light weekly check-ins, and a keep, stop or wait verdict with the evidence. Received API credits for sharing. [video link]

Then submit the form at https://forms.gle/JwMFYMpaExckupEk7 before the deadline.
