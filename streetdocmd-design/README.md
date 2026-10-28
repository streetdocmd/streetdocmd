# StreetdocMD design

The visual reference for all four StreetdocMD surfaces. Open any `index.html` in a browser. Each file is standalone, so it needs no other files apart from the Inter font, which loads from Google Fonts when online.

## Folder map

| Path | What it is | Use it for |
|---|---|---|
| `index.html` | streetdocmd.com landing page | Marketing site |
| `patient/index.html` | Patient app (app.streetdocmd.com) | Splash, onboarding, search, booking, tracking, visit record, care, profile |
| `provider/index.html` | Provider app (provider.streetdocmd.com) | Six provider types, each with its own dashboard, verification, calendar, wallet, lab price list |
| `admin/index.html` | Admin back office (admin.streetdocmd.com) | Verification, providers, bookings, support, safeguarding, payouts, roles, audit, flags |
| `streetdocmd.css` | Shared design tokens and base components | Colours, type, spacing, radius, shadows, buttons, pills, cards |
| `_source/` | Editable sources and build scripts | Only needed if you want to change the design and rebuild the apps |

## How to read the design

- Each app has a sidebar or index to jump between screens. Use it to review every state.
- Patient and provider screens are shown in a phone frame at 390px wide. The admin is a desktop layout.
- The `NOTES` object inside each app's script explains the intent behind every screen. Read it before changing a screen.

## Design rules

- Light theme only for now.
- Font: Inter. Brand blue `#1E6FD9`, navy `#0D2B5E`, teal for providers `#007F73`.
- Status is always shown with text and an icon, never colour alone.
- Patient and provider apps are mobile first. The admin is desktop first.
- All names, prices, patients and medical details are sample data.

## Rebuilding after a change

Edit the source in `_source/`, then run one of these from the design folder:

```
python3 _source/provider/build.py
python3 _source/admin/build.py
```

The patient app and landing page are edited directly in their `index.html` files.
