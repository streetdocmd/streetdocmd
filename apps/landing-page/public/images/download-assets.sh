#!/usr/bin/env bash
# Run this from your Next.js project root (the folder that contains /public).
# The Figma asset links expire 7 days after they were generated, so run it soon.
set -e

mkdir -p public/images
cd public/images

dl() {
  echo "Downloading $2"
  curl -fSL "$1" -o "$2"
}

# Photos and logos
dl "https://www.figma.com/api/mcp/asset/db70187b-8f9a-4064-a116-e63108b2d627.png" care-team.png
dl "https://www.figma.com/api/mcp/asset/2c37da2d-bd97-4c28-b7c9-62877d6d01df.png" home-care.png
dl "https://www.figma.com/api/mcp/asset/9700f195-6d98-4405-a89f-22d580836921.png" doctor-care.png
dl "https://www.figma.com/api/mcp/asset/6cd1d5cd-7be1-401d-9c20-bbff67ce227a.png" medical-team.png
dl "https://www.figma.com/api/mcp/asset/f8153804-305d-4fe0-853a-fd1f1f9436f7.png" logo-nav.png
dl "https://www.figma.com/api/mcp/asset/7850f97a-fda5-434e-81f4-968d5978daef.png" logo-footer.png

# Role card icons
dl "https://www.figma.com/api/mcp/asset/66b034a9-8d2e-46dc-8d47-c86571fab41d.svg" icon-people.svg
dl "https://www.figma.com/api/mcp/asset/ad138d8f-78ae-4458-97dc-bd7d49586049.svg" icon-doctor.svg
dl "https://www.figma.com/api/mcp/asset/01bd3822-d0e9-408e-a44f-7ceac3d72760.svg" icon-nurse.svg
dl "https://www.figma.com/api/mcp/asset/353dcc7b-02d5-4d29-8ed4-8232ee618c80.svg" icon-physio.svg
dl "https://www.figma.com/api/mcp/asset/c745eb29-cf8e-450c-8746-81502af5f4ac.svg" icon-lab.svg
dl "https://www.figma.com/api/mcp/asset/a0ceb9b1-5eb5-4135-b4eb-af049c94f0c5.svg" icon-pharmacy.svg
dl "https://www.figma.com/api/mcp/asset/291a192f-18bb-4f83-b5ce-3ce67cc06a4b.svg" icon-hospital.svg

# CTA, button arrow, and social icons
dl "https://www.figma.com/api/mcp/asset/2735490e-daa1-43e3-8d14-4c77ac6095ed.svg" cta-pulse.svg
dl "https://www.figma.com/api/mcp/asset/ec8d997b-63e2-4912-b780-366ee8b915db.svg" arrow-forward.svg
dl "https://www.figma.com/api/mcp/asset/b529137d-5794-40b8-bb01-54ee436e0b2f.svg" x-logo.svg
dl "https://www.figma.com/api/mcp/asset/ffb9c012-31f1-4f0a-a9d9-b474e55fee30.svg" instagram-logo.svg
dl "https://www.figma.com/api/mcp/asset/edce9068-ddef-445c-b97f-080d1f0fc7e9.svg" tiktok.svg

echo "Done. 18 assets saved to public/images"
