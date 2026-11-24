// Arma _site/ con SOLO lo que se publica en GitHub Pages: las páginas y sus
// recursos. Quedan afuera los scripts de verificación, node_modules, la config de
// html-validate y el README. Lo usa el workflow de Actions después de que todas
// las verificaciones pasaron.

import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const PUBLICO = [
  "index.html",
  "catalogo.html",
  "producto.html",
  "carrito.html",
  "nosotros.html",
  "styles.css",
  "robots.txt",
  "sitemap.xml",
  "assets",
  "data",
  "js",
];

rmSync("_site", { recursive: true, force: true });
mkdirSync("_site");
for (const ruta of PUBLICO) cpSync(ruta, `_site/${ruta}`, { recursive: true });
// URL de la API (variable del repositorio CE_API_URL en Actions). Sin ella, la
// tienda publicada usa data/catalogo.json y el carrito en localStorage.
const API = (process.env.CE_API_URL ?? "").trim();
if (API) {
    if (!/^https:\/\/[^\s"'<>]+$/.test(API)) throw new Error("CE_API_URL debe ser una URL https sin comillas ni espacios");
    for (const pagina of PUBLICO.filter((r) => r.endsWith(".html"))) {
        const ruta = `_site/${pagina}`;
        const html = readFileSync(ruta, "utf8");
        if (!html.includes('<script src="js/api.js"></script>')) throw new Error(`${pagina}: no se encontró js/api.js para configurar la API`);
        writeFileSync(ruta, html.replace('<script src="js/api.js"></script>', `<script>window.CE_API_URL = ${JSON.stringify(API)};</script>\n  <script src="js/api.js"></script>`));
    }
    console.log(`✔ API configurada: ${API}`);
} else {
    console.log("• Sin CE_API_URL: la tienda publicada usa data/catalogo.json");
}
// Dirección de la administración (variable del repositorio CE_ADMIN_URL). Sin ella,
// el enlace del header apunta a https://macalderonr07.github.io/frontend-RDA2/.
const ADMIN = (process.env.CE_ADMIN_URL ?? "").trim();
if (ADMIN) {
    if (!/^https:\/\/[^\s"'<>]+$/.test(ADMIN)) throw new Error("CE_ADMIN_URL debe ser una URL https sin comillas ni espacios");
    for (const pagina of PUBLICO.filter((r) => r.endsWith(".html"))) {
        const ruta = `_site/${pagina}`;
        const html = readFileSync(ruta, "utf8");
        if (!html.includes('<script src="js/encabezado.js"></script>')) continue;
        writeFileSync(ruta, html.replace('<script src="js/encabezado.js"></script>', `<script>window.CE_ADMIN_URL = ${JSON.stringify(ADMIN)};</script>\n  <script src="js/encabezado.js"></script>`));
    }
    console.log(`✔ Administración: ${ADMIN}`);
}
console.log(`✔ _site/ listo con: ${PUBLICO.join(", ")}`);
