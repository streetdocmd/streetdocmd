# StreetdocMD — Landing Page (`apps/landing-page`)

Marketing site for streetdocmd.com. Next.js 14 (App Router), plain CSS, fully static.

## First run
```bash
# from the repo root
npm install
cd apps/landing-page
npm run fetch-assets   # pulls logos, photos and icons from Figma into public/images
cd ../..
npx turbo run dev --filter=landing-page   # http://localhost:3003
```
Commit the files in `public/images` after fetching — Figma asset links expire.

## Editing
- Page content: `app/page.tsx`
- Styles / design tokens: `app/globals.css`
- All outbound links (booking app, provider signup, legal, socials): `lib/links.ts`
