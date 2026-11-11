# LUMERA — jewellery website

Next.js 15 (App Router) · TypeScript · Tailwind · Framer Motion · GSAP ScrollTrigger · Lenis · react-three-fiber.

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
```

## Editing content

Everything lives in typed files under `src/data/`:

| File | What it controls |
| --- | --- |
| `site.ts` | **Brand name**, contact details, WhatsApp number, GSTIN / IEC, certifications, HQ location for the map, GST % |
| `materials.ts` | Gold / Silver / Diamonds: taglines, purities, guide strips, images |
| `products.ts` | Catalogue. `price`, `weightGrams`, `makingChargePct`, `stoneValue`, certificate fields are `null` until confirmed |
| `categories.ts` | The six category tiles |
| `home.ts` | Hero copy per lens, homepage section order per lens, channels, craft steps, stats |
| `trade.ts` | Wholesale + Import & Export copy, MOQ table, documents, Incoterms |
| `markets.ts` | Export markets (map arcs + markets grid) |
| `testimonials.ts` | Carousel quotes |
| `navigation.ts` | Header and footer links |

Anything in `[BRACKETS]` is a placeholder to confirm. No statistics are invented — stats show `[XX]` until you set a value.

## How things work

- **Material lens** — floating pill bottom-left. Sets `data-material` on `<html>` which swaps the accent colours (`src/app/globals.css`), the hero copy and the homepage section order. Shareable: `/?material=gold`, `/?material=diamonds`.
- **Retail / Trade** — header toggle. Trade mode shows rate, making %, MOQ and lead time instead of prices, and “Add to bag” becomes “Add to quote”. Saved in localStorage.
- **Metal rates** — `src/app/api/rates/route.ts` is a mock that returns `null` (shown as `[RATE]`). Connect your rate provider there. Rates refresh every 60s. Once rates and product weights are filled in, price breakdowns calculate automatically (`src/lib/pricing.ts`).
- **Forms** — all forms post to `src/app/api/enquiry/route.ts`, which currently only logs. Connect email/CRM there. Trade-application file uploads send file names only until storage is connected.
- **Images** — `/public/images` holds free stock photos from Pexels (free for commercial use, no attribution required). The source of every photo is listed in `scripts/photos.json`; `npm run photos` re-downloads them. **Replace them with photography of your own pieces before launch** — they show other makers’ jewellery. Keep the same file names (or update paths in `src/data`); images are optimised automatically.
- **URLs** — `/gold`, `/silver`, `/diamonds` are rewrites of `/collections/[material]` (see `next.config.mjs`). Collection filters deep-link: `/gold?category=rings&variant=22K`.

## Not yet connected

Checkout, trade login/auth, live metal-rate feed, form delivery (email/CRM), document storage, map embed on Contact, 360° product spins.
