# Manual listings — design

_Written 2026-08-12. Dart asked to sell a trailer on the site: a real listing with the
same detail page and the same enquiry flow, but it does not come from the VMG feed._

---

## The problem

`site_stock` is a mirror of the VMG feed. The sync in `src/lib/feed/sync.ts` reconciles it:
anything in the feed is upserted, and **any `available` row whose slug is no longer in the
feed is flipped to `sold`**. That soft-delete is what makes sold cars disappear, and it is
correct for feed cars.

Insert a trailer by hand and the next sync (every 6 hours) archives it. The page dies
silently within a day and nobody notices until the dealer asks why his trailer vanished.

## The approach

Make the row's **origin** explicit, and teach the sync to only reconcile what it owns.

A manual listing is an ordinary `site_stock` row with `source = 'manual'`. Everything
downstream of the table already works: the `/shop/[slug]` detail page, the gallery, the
"I'm interested" capture, the WhatsApp / Email / Call logging, the shop grid, the sitemap,
`generateStaticParams`. No parallel code path, no second table, no duplicated UI.

Three columns carry the difference:

| Column | Purpose |
| --- | --- |
| `source` (`feed` \| `manual`) | The sync only archives `source = 'feed'`. Manual rows are invisible to feed reconciliation and can never be silently killed by VMG. |
| `specs` (jsonb) | Ordered `[{label, value}]`. Cars build their spec grid from feed fields (mileage, transmission, colour). A trailer needs length, width, carry capacity. Rather than adding a column per possible attribute, a manual listing carries its own labelled spec list. |
| `show_finance` (boolean, default true) | Per-listing control of the "Apply for financing" CTA. Off for the trailer: vehicle finance on a trailer is a dead-end application that wastes the lead and the dealer's time. |

## Ownership and who writes what

The dealer already works in Dartbooks all day. A second admin surface on the website would
be a place they never look, so **manual listings are managed from Dartbooks**, on the same
Supabase project (`gqppfaicijzejjxgyhji`), which both apps already share.

This is a deliberate amendment to the rule in `WEBSITE-INTEGRATION-HANDOVER.md` that
Dartbooks only *reads* `site_*` tables. Dartbooks may now write, but **only manual rows**.
The migration still lives in this repo, because this repo owns the schema.

The boundary is enforced in the database, not in the UI:

```sql
create policy site_stock_manual_write on site_stock for all to authenticated
  using (source = 'manual') with check (source = 'manual');
```

`using` covers reads/updates/deletes, `with check` covers writes. A logged-in browser
session can therefore create, edit and delete manual listings and **cannot touch a single
feed car**, even by accident or by a crafted request. Feed rows stay service-role-only,
which is what `/api/sync` already uses.

## Images

Feed cars hotlink VMG's S3. Manual listings have no upstream host, so they need one:
a **public** `site-stock-images` bucket. Public read means the photos can be served through
a plain `<img>`, which matters because `next.config.ts` sets `images: { unoptimized: true }`
specifically so no photo ever touches Vercel's metered optimizer.

Photos are also already proxied: `cdnImg()` routes every remote image through the free
weserv CDN at display size, so the origin is hit on cache misses rather than per pageview.
Uploads are still resized client-side to 1600px before they are stored, because storing a
4MB phone photo to serve it at 640px is waste regardless of who pays for it.

### Deletion is real deletion

Storage that only ever grows is a slow leak. So:

- **Delete listing** removes the row *and* its storage objects in one action.
- **Removing a photo while editing** deletes that object immediately, so an edit cannot
  leave orphans behind.
- **Mark sold** stays as the softer option: off the grid, record kept, photos kept.
- **Leads are never deleted.** `site_leads.stock_slug` becomes an orphan reference and the
  Sales page still shows the enquiry. An enquiry outliving its listing is correct: it is a
  person who wanted something, not a property of the listing.

## Publishing

ISR revalidates hourly, which is too slow for "I just added it, where is it". The sync
already solves this by calling `revalidatePath("/", "layout")` after it writes.

Manual listings get the same treatment without putting a secret in a browser bundle: a
trigger on `site_stock` (manual rows only) fires `pg_net` at a new `/api/revalidate`,
guarded by the existing `SYNC_SECRET`. Same pattern as the AutoTrader `pg_cron` job.
Dealer saves in Dartbooks, page is live in seconds.

## Page differences

Four small edits in the website, all conditional on data rather than on a listing type:

1. **Spec grid** renders `specs` when present, otherwise the existing car logic. This is
   what stops a trailer showing "Mileage: n/a".
2. **Finance CTA** renders behind `show_finance`.
3. **JSON-LD** emits `Product` instead of `Car` for manual listings. A `Car` with no make,
   no mileage and no model is invalid structured data and Google will reject it.
4. **The card** shows the first spec value instead of mileage when a listing has specs.

## Consequences accepted

- The shop filter gains "Trailer" as a make option, and the counter reads "36 vehicles".
  Both read fine and neither is worth special-casing.
- Manual listings sort by price alongside cars, which is the correct behaviour.

## Not doing

- Managing feed cars from Dartbooks. VMG remains the single source of truth for stock.
- A separate listings table. The whole value here is inheriting the vehicle page.
- Image transformation at the Supabase edge. weserv already covers it, free.

## Scope note

This lands as a general capability, not a trailer hack. The same three columns and the same
Dartbooks page clone into Autocrat, Auto Emporium and Changan, all of which run the same
feed-mirrors-a-table architecture. The trailer is simply the first record.
