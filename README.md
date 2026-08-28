# Hunt Ideas

A visual inspiration platform for product and landing-page designers. Hunt Ideas displays the hero
sections of top featured Product Hunt launches in a visual gallery, organized month by month, so
designers can quickly scan real landing pages and open the ones that are relevant — either the
product's official website or its Product Hunt page.

This is a free, non-commercial inspiration tool. There are no accounts, no daily/weekly/yearly
leaderboards, and no data collection — just a monthly archive of real launches.

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS v4
- Lucide React icons
- A server-side API route (`/api/products`) that talks to the Product Hunt GraphQL API so the
  developer token never reaches the browser

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in PRODUCT_HUNT_TOKEN
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable             | Required | Description                                              |
| --------------------- | -------- | ---------------------------------------------------------- |
| `PRODUCT_HUNT_TOKEN`  | Yes      | A Product Hunt developer token, read only on the server. |

Get a token from your Product Hunt account at https://api.producthunt.com/v2/docs. It is never
exposed to client-side code — it's read only inside `src/lib/producthunt.ts`, which runs on the
server.

## How it works

- `GET /api/products?offset=0` fetches the featured, `RANKING`-ordered posts for one calendar
  month (`0` = current month, `-1` = previous month, … back to January of the current year),
  paginating up to 50 pages of 20 posts, deduplicating by post ID, and keeping the top 30 by
  upvotes.
- Product Hunt redirect URLs are resolved server-side (up to 4 concurrent requests) to find each
  product's real website.
- Landing-page screenshots are generated with `image.thum.io`; if a direct website can't be
  resolved, the first Product Hunt media image is used instead.
- Responses are cached for a day in the browser and up to a month at the CDN/shared-cache layer,
  since this is a monthly archive that only needs to refresh roughly once a month.

## Deploying

This is a standard Next.js app — deploy it anywhere that supports Next.js (Vercel, Netlify, etc.).
Set `PRODUCT_HUNT_TOKEN` as a server-side environment variable on whichever platform you use.

```bash
npm run build
npm start
```

## Credits

Built by [Hossein Moeinedin](https://www.linkedin.com/in/moeinhossein/). Product data from
[Product Hunt](https://www.producthunt.com/).
