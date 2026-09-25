// Downloads every image/icon used by the landing page from Figma into public/images.
// Run once from apps/landing-page:  npm run fetch-assets
// Figma asset links expire ~7 days after they were generated (around Oct 2, 2026 for both pages).
// If they have expired, re-pull the Figma frame for fresh links.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://www.figma.com/api/mcp/asset/";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "images");

const assets = {
  "logo.png": "ceba4d7a-e5a7-4b68-bb66-2b0dfd0e925c.png",
  "logo-white.png": "20d4f941-1950-4dd6-96a5-830327dcd39d.png",
  "hero.png": "a4b6f940-f39b-4698-97ab-7036b3fd01b0.png",
  "what-we-are.png": "02371c98-625d-4022-a70b-e89f76d11563.png",
  "icon-arrow.svg": "5e8bcc79-1c10-404a-9f8b-04b599b68c90.svg",
  "icon-badge.svg": "ac3af595-1101-4660-9a59-9e9f11a851dc.svg",
  "icon-shield.svg": "9c2ec5df-fe0c-4645-85a9-8a8a848ae70f.svg",
  "icon-alert.svg": "77bb72ae-bf4d-458f-85fa-a956ba4994a0.svg",
  "icon-request.svg": "cd3280fb-a3a5-4235-b01b-5acf87b45582.svg",
  "icon-visit.svg": "6f5945ea-c5b7-4da0-a382-b43d69fb8d4b.svg",
  "icon-follow.svg": "924fc606-adc6-4b79-b6ba-bfcf2eee4121.svg",
  "icon-pharmacy.svg": "d46d44e1-9351-4f05-86b2-66e71b5157b5.svg",
  "icon-labs.svg": "487e205f-6111-4913-928c-9131eb7fd1d5.svg",
  "icon-verified.svg": "68ac9a67-6cdf-417a-9a6d-51c74c8f9ed1.svg",
  "icon-hospital.svg": "ee73122e-75db-4299-bc1c-a126fbdc9ebb.svg",
  "icon-heart.svg": "adb39279-4063-48ce-bb26-403ebb083f23.svg",
  "grid-mask.svg": "c7f2b634-4449-403c-928b-e09aa1f4938b.svg",
  "icon-x.svg": "00413d4c-2462-4740-94d7-a1786261d862.svg",
  "icon-instagram.svg": "a87b327c-a0df-464d-86da-6b1c5db68b96.svg",
  "icon-tiktok.svg": "6cbceb28-5307-461e-bfbd-821bca99ae06.svg",

  // Features page (/features)
  "features-hero.png": "c5e6c89a-62c3-4252-9847-354aa805489e.png",
  "icon-eyebrow.svg": "f877a60b-46d0-4470-a0dd-47226054fa50.svg",
  "icon-step-request.svg": "e44d0e13-370f-4217-9c12-5e2a2f5df146.svg",
  "icon-dispatch.svg": "80afaff1-36ff-414c-a552-01947579b820.svg",
  "icon-receive.svg": "4a51d0ac-026d-464e-8275-2bc8fc9a6a19.svg",
  "icon-connected.svg": "b539f9db-259b-4944-a576-1ef040514329.svg",
  "icon-home.svg": "2e2fd28f-7523-4990-b857-cd712e6bb469.svg",
  "icon-pharmacy-med.svg": "905f2906-7999-44bc-856a-c8064f20bc21.svg",
  "icon-lab.svg": "986e63ba-be51-4806-8b7c-c652ad129efc.svg",
  "icon-hospital-ref.svg": "cab0165b-443f-4de1-96bf-9a579fe8d07f.svg",
  "icon-records.svg": "b456ea6c-d757-4d84-a4ad-4760a2af8f88.svg",
  "icon-payments.svg": "16e4a34c-04ca-408c-b089-d06a7ed9e56d.svg",
  "check-lab.svg": "afae051f-c8f8-4184-b086-a457051a6afa.svg",
  "check-dispatch.svg": "3ffbb972-60cc-4eb3-a822-af6284214f0c.svg",
  "check-home.svg": "4b6e87f3-02b8-4061-8cb5-027cd1d1c17d.svg",
  "check-pharmacy.svg": "e8b684cd-4794-42e1-9247-810ddd4ac435.svg",
  "check-hospital.svg": "ded28487-4ffa-48cd-991e-1a97705830ad.svg",
  "check-records.svg": "3e145ca6-3bd5-476a-a91f-40000a3d9c9c.svg",
  "check-payments.svg": "dbddc5dc-8736-404f-b0cd-e8d444ab4698.svg",
};

await mkdir(OUT, { recursive: true });
let failed = 0;
for (const [name, id] of Object.entries(assets)) {
  try {
    const res = await fetch(BASE + id);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(join(OUT, name), Buffer.from(await res.arrayBuffer()));
    console.log(`✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`✗ ${name} — ${err.message}`);
  }
}
console.log(failed ? `\n${failed} asset(s) failed.` : "\nAll assets saved to public/images.");
process.exitCode = failed ? 1 : 0;
