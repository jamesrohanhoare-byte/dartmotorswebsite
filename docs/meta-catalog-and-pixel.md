# Meta catalog feed + pixel — operator notes

What is live, what it needs, and how to check it.

## The IDs

| Thing | Value |
|---|---|
| Commerce Manager catalog | `1685644072506010` ("Dart Stock", type **Vehicles**) |
| Events Manager dataset (pixel) | `1632925278409882` ("Dart Motors") |
| Feed URL | `https://dartmotors.net/api/feed/meta` (append `?key=…` if `META_FEED_KEY` is set) |

## Environment variables

Both are set in Vercel on project `dart-motors-web` (Production).

| Var | Required? | Notes |
|---|---|---|
| `NEXT_PUBLIC_META_PIXEL_ID` | for the pixel | ⚠️ **Baked in at BUILD time.** Setting it in Vercel does nothing until a fresh build runs. With it unset, `MetaPixel` renders `null` and the site behaves exactly as before — no errors, no events. If the pixel is not firing, confirm a build ran AFTER the variable was set before debugging anything else. |
| `META_FEED_KEY` | optional | Shared key guarding `/api/feed/meta`. **Only enforced when set**, deliberately: a missing variable can never take the feed offline and silently empty the catalog, which would pull every catalog ad down with it. If set, the Commerce Manager feed URL must carry `?key=<value>`. |

## How the pieces fit

```
VMG XML → sync → Supabase site_stock → /api/feed/meta (CSV) → Meta pulls hourly → catalog ads
                        │
                        └→ vehicle page → pixel ViewContent / Lead ──┘ (joined by vehicle_id)
```

**The ID contract is the whole thing.** `src/lib/meta/vehicleId.ts` is imported by both the feed and the pixel. Meta joins a pixel event to a catalog item by exact string equality on that value. If the two ever diverge, retargeting silently stops working and nothing errors. Never inline that function.

## What is deliberately excluded from the feed

- **Manual listings** (`source = 'manual'`). A trailer has no make, model, year or mileage and fails vehicle-catalog validation. Same reasoning as the Product-vs-Car split in `shop/[slug]/page.tsx`.
- **POA cars** (no price) and **cars with no images**. Both are required catalog fields. Currently this excludes zero cars.
- **`licenceNumber`.** VMG publishes it. It is a registration number, which is personal data, and it must never reach a public feed. It is not captured and not published.
- **Cars sold more than 90 days ago.** Recently sold cars stay in the feed marked `availability: not_available`, so a past `ViewContent` still resolves for attribution while the car is never served. Advertising a sold car is the worst failure mode in dealer ads.

## Privacy: the /financing carve-out

`MetaPixel` calls `fbq('set', 'autoConfig', false, …)` on `/financing`.

That page collects `idNumber`, `dob`, `accountNumber`, `grossIncome`, `netSalary`, `address` and a full expense breakdown. Meta's automatic advanced matching reads form fields, and while Meta states it excludes sensitive financial and government-ID data, **a South African ID number is a 13-digit string whose first six digits are the date of birth.** We do not bet a client's POPIA position on Meta's classifier recognising that. Pageviews still track; field scraping does not happen on that route.

In Events Manager, advanced matching is also restricted to **email, name and phone only**. Date of birth, gender, location and external ID are switched off.

## Verifying it

```bash
# pure logic + live endpoint (start `npm run dev` first for the endpoint half)
node scripts/test-meta-feed.mjs

# what VMG actually publishes, and how many cars would be excluded
node --env-file=.env.local scripts/inspect-vmg-fields.mjs

# production
curl -s "https://dartmotors.net/api/feed/meta" | head -2
curl -s https://dartmotors.net/ | grep -c fbevents   # 0 means the env var was set AFTER the build
```

⚠️ **Verifying the pixel with a headless browser gives a false negative.** A HeadlessChrome user agent makes `fbevents.js` load its config and then send nothing. It looks completely broken and is not. Use `Projects/ClientWork/_tools/pixelcheck.mjs` (real Chrome over CDP) or Meta's Test Events tab in a normal browser.

## Known gaps / next

1. **Conversions API not built.** The pixel alone loses events to ad blockers and iOS. `/api/lead` already has every lead server-side, so CAPI is a port of `impactvolunteers/lib/capi.ts`. **It must share an `event_id` with the browser event or Meta double-counts every conversion.**
2. **VIN and mm_code not yet captured.** VMG publishes both (confirmed 2026-08-17). The feed already emits a `vin` column that reads empty until migration `00051` adds the columns and the sync starts writing them.
3. **Branded thumbnails not built.** The feed carries raw VMG images. A render step (same headless-Chrome pattern as the BlitzBooks PDF engine) would give every car a designed thumbnail at zero design hours.
4. **Model names still shout** in the title (`2012 Mitsubishi PAJERO 3.2 Di - Dc GLX A/T`). `make` is title-cased; the model lives inside VMG's `variant` string, which is left alone on purpose because casing it turns `KB 250 D-TEQ` into `Kb 250 D-teq` and `BMW` into `Bmw`. Fixing it properly needs a model lookup table, not a regex.
5. **Feed carries 33 available cars.** The About copy claims Dart runs "80+ vehicles". Worth confirming whether VMG is publishing a subset.
