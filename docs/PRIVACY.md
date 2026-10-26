# Privacy

Verdict is built so that the people who run it cannot see your photos or results. This notice describes the software in this repository. If you run your own deployment, you are its operator.

## Summary

- No accounts, no analytics, no advertising, no tracking cookies.
- Photos, scores and trial details are stored **in your browser only**.
- Each photo is sent once to YouCam AI Skin Analysis for measurement, then deleted from YouCam as soon as the results are saved on your device.
- You can export or erase everything at any time from **Your data**.

## What is stored, and where

| Data | Stored | How long |
|---|---|---|
| Photos you take or upload | Your browser (IndexedDB) | Until you delete them |
| Skin scores and detection overlays | Your browser | Until you delete them |
| Product names, ingredients, prices you enter | Your browser | Until you delete them |
| Demo access code, if any | Your browser (localStorage) | Until you clear it |
| Anything at all | The Verdict server | Nothing is stored |

## What leaves your device

**For an analysis**, the photo is sent over HTTPS to the Verdict server, which forwards it to **YouCam AI Skin Analysis** by Perfect Corp. The server passes back the scores and the detection overlays, which your browser saves. The Verdict server does not write the photo or results to disk, a database or logs.

Once your browser has saved the results, Verdict asks YouCam to delete the task, removing the photo and results from YouCam's servers. If that request fails, YouCam's standard retention applies: uploaded files and results are kept for up to 24 hours. YouCam processes photos under its [API privacy policy](https://www.makeupar.com/perfectbeauty/youcam/privacy-policy-api) and [API terms of service](https://www.makeupar.com/perfectbeauty/youcam/terms-of-service-api).

**For product search**, your search text or barcode is sent to **Open Beauty Facts** through the Verdict server. No photo or personal data is sent with it.

**Hosting.** The hosting provider of a deployment may keep standard request logs (IP address, time, path) for security and operations. These logs never include photos or scores, because those travel in request bodies, which are not logged.

## What Verdict never does

- Infer, store or display ethnicity, gender, identity or any protected characteristic.
- Sell, share or rent data.
- Use your photos to train models.
- Show advertising.

## Your control

- **See** everything in the app.
- **Export** a complete copy from **Your data > Export everything**. The file contains your photos, so keep it private.
- **Erase** a single photo from a trial's photo log, a whole trial from its page, or everything from **Your data > Erase everything**.
- Clearing this site's data in your browser settings also erases everything.

## Children

Verdict is not intended for people under the age of majority where they live.

## Changes

Changes to this notice are made in this file and are visible in the repository history.

## Questions

Open an issue on the repository, or for anything sensitive use the private reporting route in [SECURITY.md](../SECURITY.md).
