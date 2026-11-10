import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fontsDir = path.join(root, "apps/web/public/fonts");

function lockupSvg({ dark = false } = {}) {
  const ink = dark ? "#FFFFFF" : "#0A0D0D";
  const muted = dark ? "#9CABB8" : "#566774";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180">
  <path d="M28 86 V28 H86" fill="none" stroke="#0CA4DD" stroke-width="10" stroke-linecap="square"/>
  <path d="M612 94 V152 H554" fill="none" stroke="#BF7351" stroke-width="10" stroke-linecap="square"/>
  <text x="72" y="108" font-family="Montserrat" font-weight="700" font-size="78" fill="${ink}">iktva</text>
  <text x="292" y="78" font-family="Montserrat" font-weight="600" font-size="30" fill="#0CA4DD">2027</text>
  <text x="292" y="118" font-family="Montserrat" font-weight="500" font-size="22" letter-spacing="3" fill="${muted}">FORUM</text>
</svg>`;
}

function markSvg({ dark = false } = {}) {
  const ink = dark ? "#FFFFFF" : "#0A0D0D";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <path d="M36 118 V36 H118" fill="none" stroke="#0CA4DD" stroke-width="14" stroke-linecap="square"/>
  <path d="M220 138 V220 H138" fill="none" stroke="#BF7351" stroke-width="14" stroke-linecap="square"/>
  <text x="128" y="152" text-anchor="middle" font-family="Montserrat" font-weight="700" font-size="110" fill="${ink}">i</text>
</svg>`;
}

function render(svg) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "original" },
    font: {
      fontFiles: [
        path.join(fontsDir, "Montserrat-Bold.ttf"),
        path.join(fontsDir, "Montserrat-SemiBold.ttf"),
        path.join(fontsDir, "Montserrat-Medium.ttf"),
        path.join(fontsDir, "Montserrat-Regular.ttf"),
      ],
      loadSystemFonts: false,
      defaultFontFamily: "Montserrat",
    },
    background: "rgba(0,0,0,0)",
  });
  return resvg.render().asPng();
}

function write(file, svg) {
  const buf = render(svg);
  fs.writeFileSync(file, buf);
  console.log("wrote", file, buf.length);
}

const publicSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180" role="img" aria-label="iktva Forum 2027">
  <path d="M28 86 V28 H86" fill="none" stroke="#0CA4DD" stroke-width="10" stroke-linecap="square"/>
  <path d="M612 94 V152 H554" fill="none" stroke="#BF7351" stroke-width="10" stroke-linecap="square"/>
  <text x="72" y="108" font-family="Montserrat, sans-serif" font-weight="700" font-size="78" fill="currentColor">iktva</text>
  <text x="292" y="78" font-family="Montserrat, sans-serif" font-weight="600" font-size="30" fill="#0CA4DD">2027</text>
  <text x="292" y="118" font-family="Montserrat, sans-serif" font-weight="500" font-size="22" letter-spacing="3" fill="#566774">FORUM</text>
</svg>`;

write(path.join(root, "apps/web/public/logo.png"), lockupSvg());
write(path.join(root, "apps/web/public/logo-dark.png"), lockupSvg({ dark: true }));
write(path.join(root, "apps/web/public/logo-mark.png"), markSvg());
write(path.join(root, "apps/web/public/logo-mark-dark.png"), markSvg({ dark: true }));
write(path.join(root, "apps/web/app/icon.png"), markSvg());
write(path.join(root, "apps/api/assets/iktva-logo.png"), lockupSvg());
write(path.join(root, "apps/api/assets/s7-logo.png"), lockupSvg());
fs.writeFileSync(path.join(root, "apps/web/public/logo.svg"), publicSvg);
console.log("done");
