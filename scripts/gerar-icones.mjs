// Gera o favicon e os ícones do site a partir do desenho do logótipo (o mesmo de src/components/logo.tsx).
// Uso: node scripts/gerar-icones.mjs   (voltar a correr se o logótipo mudar)
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const TEAL = "#89d3cd";
const NAVY = "#0c1e3a";
const arrows = (stroke = 2.6) => `<path d="M8 13h15l-4-4M26 21H11l4 4" fill="none" stroke="${NAVY}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;

// Igual ao logótipo: quadrado de cantos arredondados, fundo transparente fora dos cantos.
const rounded = (stroke) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34"><rect width="34" height="34" rx="8" fill="${TEAL}"/>${arrows(stroke)}</svg>`;
// Para o iPhone e o Android ("ecrã principal"): fundo a toda a área (o sistema arredonda os cantos)
// (as setas já ficam dentro da zona segura dos ícones redondos do Android: raio de 40%).
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34"><rect width="34" height="34" fill="${TEAL}"/>${arrows()}</svg>`;
// Nos tamanhos pequenos (separador do browser) a linha fina fica esborratada: setas mais grossas.
const SMALL_STROKE = 3.6;

const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * Math.ceil(size / 34) }).resize(size, size).png().toBuffer();

/** .ico com imagens PNG lá dentro (aceite por todos os browsers atuais). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + 16 * images.length;
  for (const { size, data } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por píxel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

writeFileSync("src/app/icon.svg", rounded(SMALL_STROKE) + "\n");
writeFileSync("src/app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(rounded(SMALL_STROKE), size) })))));
writeFileSync("src/app/apple-icon.png", await png(fullBleed, 180));
// icon1/icon2: ícones do Android (manifest); o Next.js serve-os em /icon1.png e /icon2.png.
writeFileSync("src/app/icon1.png", await png(fullBleed, 192));
writeFileSync("src/app/icon2.png", await png(fullBleed, 512));
// Versão para uso fora do site (redes sociais, documentos).
mkdirSync("docs/marca", { recursive: true });
writeFileSync("docs/marca/portal-do-trespasse-icone-512.webp", await sharp(Buffer.from(rounded()), { density: 72 * 16 }).resize(512, 512).webp({ lossless: true }).toBuffer());
console.log("Ícones gerados.");
