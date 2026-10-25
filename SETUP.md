# Setup

Everything needed to run Verdict locally, test it, and deploy it.

## Requirements

| Tool | Version |
|---|---|
| Node.js | 20.9 or newer (CI uses 22) |
| npm | 10 or newer |
| A YouCam API key | Free account at [yce.perfectcorp.com/ai-api](https://yce.perfectcorp.com/ai-api) |

## 1. Get a YouCam API key

1. Sign up at [yce.perfectcorp.com/ai-api](https://yce.perfectcorp.com/ai-api) and verify your email.
2. If you have a hackathon redeem code: **Account > Redeem Code**. 1,000 units are added at once.
3. Create a key under **Account > API Key**.

**Unit budget.** A Verdict analysis measures 4 to 8 concerns. That is 12 or 16 units in HD, or 9 or 12 in SD (YouCam's published tiers). A full eight-week trial (two baseline photos plus eight weekly check-ins) is about 160 HD units. 1,000 units is enough for about six complete trials, or around 60 single analyses for demos.

## 2. Install and configure

```bash
git clone https://github.com/opeblow/verdict.git
cd verdict
npm install
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `YOUCAM_API_KEY` | yes | | Bearer key for the YouCam API. Server only. |
| `YOUCAM_API_BASE` | no | `https://yce-api-01.makeupar.com` | API host |
| `YOUCAM_SKIN_VERSION` | no | `v2.0` | `v2.0` or `v2.1` skin analysis engine |
| `ACCESS_CODE` | no | | If set, visitors must enter this code before an analysis runs |
| `RATE_LIMIT_PER_HOUR` | no | `20` | Analyses per visitor per hour |
| `DAILY_ANALYSIS_CAP` | no | `150` | Analyses per server instance per day |

## 3. Check the key works

With a front-facing photo of a face that fills most of the frame:

```bash
npm run smoke:youcam -- ./selfie.jpg sd
```

This runs one real analysis (9 units in SD), prints the scores, and deletes the task from YouCam. If it fails, the message names the step: registration, upload, task or poll.

## 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The camera works on `localhost`. To test on a phone, use an HTTPS deployment or a tunnel, because browsers only allow the camera on secure origins.

## 5. Quality gates

```bash
npm run check     # lint + typecheck + 100+ unit tests, as CI runs them
npm run build     # production build
```

## 6. Deploy

Verdict is a standard Next.js app with no database. Any Node host works.

**Vercel (recommended)**

1. Import the repository in Vercel.
2. Add `YOUCAM_API_KEY`, and for a public demo an `ACCESS_CODE`.
3. Deploy. The default build and output settings are correct.

**Any Node server**

```bash
npm ci
npm run build
YOUCAM_API_KEY=... npm start   # port 3000, or set PORT
```

Serve it behind HTTPS.

### Public demo checklist

- Set `ACCESS_CODE` and put it in the submission's testing instructions, so strangers cannot spend your units.
- Lower `DAILY_ANALYSIS_CAP` to match your remaining units.
- Run `npm run smoke:youcam` against the deployed key once before judging starts.

## 7. Regenerate README screenshots

```bash
npm run build
npm run screenshots
```

Uses Playwright with a fake camera and sample data in a throwaway browser profile. No YouCam call is made. First run needs `npx playwright install chromium`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "This server has no YouCam API key" | `YOUCAM_API_KEY` missing from `.env.local`, or the server was not restarted |
| "Move closer" after analysis | The face must be wider than 60% of the photo. Fill the oval. |
| "It's too dark" | Face a window or lamp. YouCam rejects dark photos. |
| Camera does not open | Grant camera permission, and use `localhost` or HTTPS |
| "The server's YouCam API key was rejected" | Key revoked or mistyped |
| "This server has run out of YouCam API units" | Redeem a code or buy units in the YouCam console |
| Trials missing on another device | Data lives in the browser. Use **Your data > Export**, then import on the new device |
