# Method

How Verdict turns YouCam AI Skin Analysis scores into a keep, stop or wait decision. The same rules are shown in the app at `/method`, and implemented in [`src/lib/domain`](../src/lib/domain).

## Principle

A score from one photo says little. A change between photos means something only if it is larger than the change between two photos of the same, unchanged skin. Verdict measures that second quantity for each person, then judges every change against it.

## 1. Measurement

- **Instrument:** YouCam AI Skin Analysis, `POST /s2s/v2.0/task/skin-analysis`, `format: "json"`.
- **Score used:** `raw_score` (1 to 100, higher is healthier looking). YouCam documents `ui_score` as adjusted to produce more favourable results, so it is shown nowhere in the maths.
- **Mode:** HD if the cropped photo's short side is at least 1080 px, otherwise SD. Fixed for the whole trial, because HD and SD are different models.
- **Concerns:** the product's targets, plus redness as an irritation monitor, plus fill-ins up to the edge of the billing tier ([`planConcerns`](../src/lib/domain/concerns.ts)).
- **Framing:** centred 3:4 portrait crop; face guide 68% of the width, satisfying the API's 60% minimum.

## 2. Matched conditions

Computed on a 150 px wide sample inside the face guide, about six times a second ([`quality.ts`](../src/lib/capture/quality.ts)):

| Measure | Definition | Block | Warn |
|---|---|---|---|
| Brightness | Mean Rec. 709 luma | below 70 | below 95, or above 220 |
| Side light | (left mean minus right mean) divided by mean | beyond 0.28 | beyond 0.15 |
| Glare | Share of pixels at luma 250 or more | | above 6% |
| Blur | Variance of the 4-neighbour Laplacian | | below 12 |
| Brightness vs first photo | Relative difference | beyond 35% | beyond 18% |
| Colour temperature vs first photo | Difference in red over blue ratio | | beyond 0.15 |
| Side light vs first photo | Difference in balance | | beyond 0.15 |

Each saved check-in keeps its conditions, and the photo log shows how closely each one matched the first photo.

## 3. Noise floor

For a replicate pair (a, b) of the same skin, Var(a - b) = 2 sigma squared. With k pairs and a prior sigma0 = 2.5 points weighted as 3 pseudo-pairs:

```
sigma^2 = (3 * sigma0^2 + sum((a - b)^2 / 2)) / (3 + k)
```

Floor: 1 point. Every sitting with two photos adds a pair.

## 4. Change estimate

Ordinary least squares of `raw_score` against days since the first photo, over every photo. The change is slope times the span of days. The error variance pools the replicate estimate and the residuals:

```
s^2 = (df_noise * sigma^2 + SSR) / (df_noise + n - 2)
SE(change) = span * sqrt(s^2 / Sxx)
95% interval = change +/- t(df_noise + n - 2) * SE
```

## 5. Classification

With a minimum meaningful change m = 3 points:

| Reading | Rule |
|---|---|
| Improved | low > 0 and change >= m |
| Worse | high < 0 and change <= -m |
| No change | high < m (a meaningful benefit is ruled out) |
| Unclear | otherwise |

Then the domain rules, in order ([`evaluateConcern`](../src/lib/domain/verdict.ts)):

1. Redness worse: **irritation**, at any week.
2. Improved: reported immediately.
3. Not a target: **steady**, or **no reaction** for the redness monitor, unless worse.
4. Blemishes worse within 6 weeks of a retinoid or exfoliating acid: **purging**.
5. Before the concern's fair-verdict week: **too early**.
6. Otherwise the classification stands.

## 6. Trial decision

| Decision | When |
|---|---|
| Baseline set | No follow-up photo yet |
| Stop | Any irritation, or a target worse after its fair-verdict week |
| Keep | At least one target improved and none worse |
| Wait | Purging, or a target still before its fair-verdict week |
| More data | Past the deadline but unclear |
| Don't rebuy | Every target past its deadline with a meaningful benefit ruled out |

## 7. Timelines

Each active has `fromWeek` (earliest visible change commonly reported) and `callWeek` (fair verdict). With several actives, the slowest sets the deadline. Texture, tone and lines are never called before week 4, about one renewal cycle of the epidermis. The full table, with the study behind each range where one exists, is in [`ingredients.ts`](../src/lib/domain/ingredients.ts) and on the `/method` page.

## Limits

- Not a medical device; readings describe appearance in photos.
- A trial of one cannot exclude other causes. The app asks users to change one thing at a time.
- Model reliability can vary with skin tone and lighting. Comparing each person only with themselves in matched light reduces, but does not remove, this.
- The prior, thresholds and timelines are conservative engineering choices, stated so they can be challenged.
