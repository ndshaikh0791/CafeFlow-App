import { mkdirSync, writeFileSync } from "node:fs";
// Original, self-contained vector illustrations for the demo menu. No remote images.
mkdirSync("public/menu-art", { recursive: true });
const wrap = (art, bg = "#eadbc5") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 420"><defs><radialGradient id="bg"><stop stop-color="#f9f1e3"/><stop offset="1" stop-color="${bg}"/></radialGradient><radialGradient id="coffee"><stop stop-color="#805035"/><stop offset="1" stop-color="#3f241a"/></radialGradient><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#fff9e9" stop-opacity=".9"/><stop offset="1" stop-color="#b4865d" stop-opacity=".2"/></linearGradient><filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="5" dy="16" stdDeviation="12" flood-color="#624729" flood-opacity=".2"/></filter><pattern id="grain" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="8" cy="13" r="1" fill="#fff" opacity=".18"/><circle cx="30" cy="32" r=".7" fill="#7f603e" opacity=".09"/></pattern></defs><rect width="600" height="420" fill="url(#bg)"/><path d="M-40 300 600 35v120L0 420Z" fill="#fff" opacity=".18"/><rect width="600" height="420" fill="url(#grain)"/>${art}</svg>`;
const bean = (x, y, r) =>
  `<g transform="translate(${x} ${y}) rotate(${r})"><ellipse rx="9" ry="15" fill="#69452f"/><path d="M0-11Q-6 0 1 11" fill="none" stroke="#b38a63" stroke-width="2"/></g>`;
function cup(kind) {
  const foam = kind === "cappuccino" || kind === "latte";
  const espresso = kind === "espresso";
  return `<g filter="url(#shadow)" transform="translate(300 212) rotate(-22) scale(${espresso ? 0.82 : 1})"><ellipse rx="144" ry="135" fill="#d6cab4"/><ellipse rx="132" ry="124" fill="#f6f0e3"/><ellipse rx="110" ry="104" fill="#e7ddca"/><path d="M82-25h47c33 0 33 64 0 64H84" fill="none" stroke="#eee4d1" stroke-width="25"/><circle r="99" fill="#f9f4e9"/><circle r="84" fill="${foam ? "#d9ad78" : "url(#coffee)"}"/><circle r="78" fill="none" stroke="${foam ? "#ead2aa" : "#b8834e"}" stroke-width="4" opacity=".8"/>${foam ? `<g fill="#fff4dd" transform="rotate(22)"><path d="M0 54C-20 32-61 5-40-16-16-38 1-9 0 1 1-9 20-38 42-16 62 7 20 33 0 54Z"/><path d="M0 52Q-6 8 0-50" fill="none" stroke="#be8e59" stroke-width="5"/>${kind === "latte" ? '<path d="M0 29Q-69 11-41-10M0 17Q65-3 34-20M0-3Q-50-16-21-34" fill="none" stroke="#fff4dd" stroke-width="12" stroke-linecap="round"/>' : ""}</g>` : `<ellipse cx="-26" cy="-28" rx="27" ry="10" fill="#e0b579" opacity=".25" transform="rotate(-25)"/>`}<path d="M-70-55A85 85 0 0 1-15-84" stroke="#fff" stroke-width="5" fill="none" opacity=".7" stroke-linecap="round"/></g>${bean(120, 294, 30)}${bean(149, 320, -30)}${bean(470, 105, 70)}`;
}
const tea = (green) =>
  `<g filter="url(#shadow)"><ellipse cx="293" cy="255" rx="140" ry="95" fill="#e8dfc5"/><ellipse cx="293" cy="247" rx="131" ry="86" fill="#faf6e9"/><path d="M383 175h32c55 0 46 83 7 83h-35" fill="none" stroke="#efe6ce" stroke-width="19"/><path d="M192 168h203l-13 83c-8 67-170 67-179 0Z" fill="#f7f1df"/><ellipse cx="293" cy="170" rx="100" ry="56" fill="#fff9e9"/><ellipse cx="293" cy="172" rx="88" ry="45" fill="${green ? "#b8ac5e" : "#b17a44"}"/><ellipse cx="278" cy="159" rx="50" ry="17" fill="#e6ce92" opacity=".3"/></g><g fill="${green ? "#77916b" : "#917858"}" transform="translate(145 130) rotate(-30)"><path d="M0 0Q-45-57-50-13-24 3 0 0Z"/><path d="M0 0Q-1-71 22-43 24-17 0 0Z"/><path d="M-12-4 16 38" stroke="#74805b" stroke-width="3"/></g><path d="M275 95c-15-18 15-22 0-43m35 41c-13-16 15-22 0-42" stroke="#fff9e9" stroke-width="5" opacity=".6" fill="none" stroke-linecap="round"/>`;
const cold = `<g filter="url(#shadow)"><ellipse cx="300" cy="352" rx="96" ry="22" fill="#c7b496"/><path d="M225 75h150l-18 254q-57 31-114 0Z" fill="url(#glass)" stroke="#f7efdc" stroke-width="5"/><path d="M233 115h134l-15 208q-52 25-103 0Z" fill="#a16a42"/><path d="m249 180 113 1-10 142q-52 25-103 0Z" fill="#cd9b69"/><ellipse cx="300" cy="115" rx="67" ry="17" fill="#ead1aa"/><path d="m302 156 56-119" stroke="#624c37" stroke-width="11"/><g fill="#f3ddbb" opacity=".65" stroke="#fff3dc" stroke-width="2"><rect x="252" y="131" width="37" height="32" rx="5" transform="rotate(14 270 147)"/><rect x="308" y="151" width="34" height="34" rx="5" transform="rotate(-15 323 166)"/><rect x="274" y="185" width="32" height="32" rx="5"/></g><path d="m240 95 13 216" stroke="#fff" stroke-width="7" opacity=".35" stroke-linecap="round"/></g>${bean(153, 305, 40)}${bean(410, 329, -35)}`;
const plate = `<ellipse cx="300" cy="248" rx="198" ry="128" fill="#d3c7ad"/><ellipse cx="300" cy="237" rx="190" ry="126" fill="#faf6e7"/><ellipse cx="300" cy="236" rx="157" ry="99" fill="none" stroke="#e9e2cd" stroke-width="3"/>`;
const sandwich = `<g filter="url(#shadow)">${plate}<g transform="translate(295 218) rotate(-12)"><path d="m-124 40 117-139L138 54-1 112Z" fill="#b57b3b"/><path d="m-123 22 117-139L139 37-1 93Z" fill="#efc76f"/><path d="m-127 4 27-23 32 11 27-25 29 10 27-17 27 16 23-3 50 51L-1 77Z" fill="#789750"/><path d="m-119-5 113-108L129 31 0 68Z" fill="#b54e32"/><path d="m-129-22 122-111L143 17-1 64Z" fill="#ecd08c"/><path d="m-123-24 117-99L132 16-1 53Z" fill="#f6e3ac"/><path d="m-62-61 98 80m-64-105 98 80m-102-25 60 49" stroke="#cca362" stroke-width="9" stroke-linecap="round" opacity=".7"/><path d="m-4-122 4 175" fill="none" stroke="#ceaa6b" stroke-width="5"/></g></g>`;
const fries = `<g filter="url(#shadow)"><ellipse cx="301" cy="325" rx="115" ry="27" fill="#b88e62" opacity=".22"/>${Array.from({ length: 14 }, (_, i) => `<rect x="${200 + i * 13}" y="${92 + (i % 4) * 16}" width="19" height="165" rx="3" fill="${["#eac26a", "#f5d891", "#dba447"][i % 3]}" stroke="#dfb05a" stroke-width="2" transform="rotate(${(i - 7) * 3} ${200 + i * 13} 240)"/>`).join("")}<path d="m185 218 26 112q87 32 173-1l25-111q-111 33-224 0Z" fill="#b76847"/><path d="m199 225 24 94q75 23 148 0l23-94q-97 24-195 0Z" fill="#c8815a"/><circle cx="298" cy="278" r="24" fill="#e7c49a"/><path d="m287 279 7 8 15-18" stroke="#b57450" stroke-width="4" fill="none" stroke-linecap="round"/></g><g transform="translate(450 302)"><ellipse rx="42" ry="26" fill="#f8f0da"/><ellipse rx="33" ry="18" fill="#a14e35"/></g>`;
const pizza = `<g filter="url(#shadow)" transform="translate(300 212) rotate(-15)"><circle r="151" fill="#bda180"/><circle r="145" fill="#d7a454"/><circle r="130" fill="#b75434"/><circle r="121" fill="#e4b963"/>${[
  [-55, -61],
  [61, -52],
  [0, 5],
  [-60, 61],
  [67, 57],
]
  .map(
    ([x, y]) =>
      `<path d="m${x - 28} ${y - 16}q12-26 37-10t12 40q-22 17-43-1t-6-29" fill="#f3e4b2"/>`,
  )
  .join("")}<g fill="#658045">${[
  [-45, -60],
  [62, -30],
  [-10, 25],
  [70, 70],
  [-78, 57],
]
  .map(
    ([x, y]) =>
      `<path d="m${x} ${y}q-28-36-32-2 8 27 32 2Z"/><path d="m${x} ${y}q-3-44 18-22 5 22-18 22Z"/>`,
  )
  .join(
    "",
  )}</g><g fill="#c7763e">${Array.from({ length: 16 }, (_, i) => `<circle cx="${Math.cos(i * 2.4) * (50 + i * 4)}" cy="${Math.sin(i * 2.4) * (50 + i * 4)}" r="3"/>`).join("")}</g><path d="M0 0 0-133M0 0 119 60M0 0-119 60" stroke="#d09b50" stroke-width="3" opacity=".5"/></g>`;
const brownie = `<g filter="url(#shadow)">${plate}<g transform="translate(300 217) rotate(-15)"><path d="m-102-59 155-12 53 104-157 23Z" fill="#603a26"/><path d="m-102-59 7 96 52 62-8-43Z" fill="#48271e"/><path d="m-51 56 157-23-6 47-143 19Z" fill="#70432b"/><path d="m-89-52 135-11 47 90-140 22Z" fill="#593322"/><g fill="#aa7950"><path d="m-63-39 20-8 8 15-22 7Z"/><path d="m15-40 23 5-4 21-22-4Z"/><path d="m-28 9 23-11 13 18-20 13Z"/><path d="m47 5 22 8-7 21-21-8Z"/></g><g stroke="#cbb395" stroke-width="2" opacity=".7">${Array.from({ length: 22 }, (_, i) => `<path d="m${-76 + ((i * 31) % 149)} ${-43 + ((i * 17) % 83)} 3 2"/>`).join("")}</g></g></g><path d="M437 195q33-26 12-43-22 13-12 43Z" fill="#799055"/>`;
const art = {
  espresso: cup("espresso"),
  americano: cup("americano"),
  cappuccino: cup("cappuccino"),
  latte: cup("latte"),
  "cold-coffee": cold,
  "masala-tea": tea(false),
  "green-tea": tea(true),
  sandwich,
  fries,
  pizza,
  brownie,
};
for (const [name, drawing] of Object.entries(art))
  writeFileSync(
    `public/menu-art/${name}.svg`,
    wrap(
      drawing,
      name === "green-tea"
        ? "#d8dfc5"
        : name === "brownie"
          ? "#e4d4c5"
          : "#eadbc5",
    ),
  );
console.log("Created 11 original menu illustrations.");
