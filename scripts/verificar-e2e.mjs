// Pruebas de extremo a extremo en un navegador real (Chromium con Playwright).
// Las corre GitHub Actions antes de publicar; a mano: npm run verificar:e2e
//
// Levanta su propio servidor estático y comprueba, en escritorio y en celulares
// emulados, y en modo claro y oscuro, las 5 páginas:
//   - Sin errores de JavaScript ni en consola.
//   - Sin scroll horizontal (la página cabe en la pantalla).
//   - Accesibilidad WCAG 2.2 AA con axe-core: 0 violaciones.
// Y las funciones clave: filtros del catálogo (URL, texto, sessionStorage), ficha
// de producto, carrito en localStorage, checkout (validación, nombres de empresa,
// teléfonos con espacios o +593, confirmación antes de vaciar, historial en IndexedDB,
// "Volver a pedir", cookie, datos guardados solo con permiso y "Olvidar mis datos").
//
// Los valores esperados se calculan desde data/catalogo.json (no están fijos en
// el código), así la prueba sigue sirviendo si se agregan productos.
// Nota: Tailwind se carga desde su CDN, así que las pruebas necesitan internet.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { createRequire } from "node:module";
import { chromium, devices } from "playwright";

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const CATALOGO = JSON.parse(readFileSync("data/catalogo.json", "utf8"));
const RAIZ = process.cwd();

// ------------------------------------------------------------ servidor estático
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
};
const servidor = createServer(async (req, res) => {
  const ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  const archivo = normalize(join(RAIZ, ruta.endsWith("/") ? `${ruta}index.html` : ruta));
  if (!archivo.startsWith(RAIZ)) return res.writeHead(403).end();
  try {
    const cuerpo = await readFile(archivo);
    res.writeHead(200, { "Content-Type": TIPOS[extname(archivo)] ?? "application/octet-stream" }).end(cuerpo);
  } catch {
    res.writeHead(404).end("No encontrado");
  }
});
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const BASE = `http://localhost:${servidor.address().port}/`;

// ------------------------------------------------------------ mini framework
const fallos = [];
let pruebas = 0;
async function prueba(nombre, fn) {
  pruebas += 1;
  try {
    await fn();
    console.log(`  ✔ ${nombre}`);
  } catch (error) {
    fallos.push(`${nombre}: ${error.message}`);
    console.log(`  ✘ ${nombre}\n      ${error.message}`);
  }
}
function esperar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

function vigilar(pagina) {
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(`JS: ${e.message}`));
  pagina.on("console", (m) => m.type() === "error" && errores.push(`consola: ${m.text()}`));
  return errores;
}

// Cada página indica qué esperar para considerarse "cargada" (su JS ya pintó).
const LISTA = {
  "index.html": "main",
  "catalogo.html": "#rejillaProductos:not([aria-busy]) li",
  [`producto.html?id=${CATALOGO.productos[0].id}`]: "#fichaProducto:not([hidden])",
  "carrito.html": "#totalCarrito",
  "nosotros.html": "main",
};

async function revisarPagina(pagina, ruta, errores) {
  // Se juntan TODOS los problemas de la página antes de fallar, para que el
  // reporte de Actions los muestre de una vez.
  const problemas = [];
  await pagina.goto(BASE + ruta);
  await pagina.waitForLoadState("networkidle");
  await pagina.waitForSelector(LISTA[ruta], { state: "attached" });
  await pagina.waitForTimeout(300); // Tailwind CDN genera estilos de lo recién pintado
  const { ancho, pantalla } = await pagina.evaluate(() => ({
    ancho: document.documentElement.scrollWidth,
    pantalla: document.documentElement.clientWidth,
  }));
  if (ancho > pantalla) problemas.push(`hay scroll horizontal (${ancho}px de contenido en ${pantalla}px de pantalla)`);
  await pagina.addScriptTag({ content: AXE });
  const { violations } = await pagina.evaluate(() =>
    window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } })
  );
  if (violations.length) {
    problemas.push(
      `axe encontró ${violations.length} violación(es): ` +
        violations.map((v) => `${v.id} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`).join("; ")
    );
  }
  problemas.push(...errores);
  esperar(problemas.length === 0, problemas.join("\n      "));
}

// ------------------------------------------------------------ pruebas
const navegador = await chromium.launch();
const DISPOSITIVOS = {
  "escritorio 1366px": { viewport: { width: 1366, height: 900 } },
  "iPhone SE": devices["iPhone SE"],
  "Pixel 5": devices["Pixel 5"],
  "iPad Mini": devices["iPad Mini"],
  // Auditoría IHC, H1: el contraste del modo oscuro también se mide (antes axe solo
  // corría en modo claro y el botón de la ficha con 2,29:1 pasaba sin aviso).
  "escritorio oscuro": { viewport: { width: 1366, height: 900 }, colorScheme: "dark" },
  "iPhone SE oscuro": { ...devices["iPhone SE"], colorScheme: "dark" },
};

// Estas pruebas verifican el sitio estático contra data/catalogo.json: se apaga la
// API del servidor (js/api.js) para que el resultado no dependa de si hay un
// backend corriendo en la máquina.
const sinApi = () => {
  window.CE_API_URL = "";
};

try {
  console.log("\n▶ Páginas: errores, scroll horizontal y accesibilidad (axe, WCAG 2.2 AA)");
  for (const [nombre, opciones] of Object.entries(DISPOSITIVOS)) {
    const contexto = await navegador.newContext(opciones);
    await contexto.addInitScript(sinApi);
    for (const ruta of Object.keys(LISTA)) {
      await prueba(`${nombre} · ${ruta}`, async () => {
        const pagina = await contexto.newPage();
        const errores = vigilar(pagina);
        await revisarPagina(pagina, ruta, errores);
        await pagina.close();
      });
    }
    await contexto.close();
  }

  console.log("\n▶ Funciones");
  const contexto = await navegador.newContext({ viewport: { width: 1366, height: 900 } });
  await contexto.addInitScript(sinApi);
  const pagina = await contexto.newPage();
  const errores = vigilar(pagina);
  // El checkout abre WhatsApp en otra pestaña: se intercepta para no salir a internet.
  await contexto.addInitScript(() => {
    window.open = (url) => {
      window.__abierto = url;
      return null;
    };
  });
  const tarjetasVisibles = () => pagina.locator("#rejillaProductos > li:not([hidden])").count();

  await prueba("Header: acceso a la administración en todas las páginas (local -> :8090)", async () => {
    for (const ruta of Object.keys(LISTA)) {
      await pagina.goto(BASE + ruta);
      const enlace = pagina.getByRole("link", { name: "Administración" });
      esperar((await enlace.count()) === 1, `${ruta}: no hay un enlace "Administración" en el header`);
      const destino = await enlace.getAttribute("href");
      esperar(destino === "http://localhost:8090/", `${ruta}: en local apunta a ${destino}`);
      esperar(await enlace.evaluate((a) => a.closest("header nav") !== null), `${ruta}: el enlace no está en la navegación del header`);
    }
  });

  await prueba("Catálogo: muestra todos los productos del JSON", async () => {
    await pagina.goto(BASE + "catalogo.html");
    await pagina.waitForSelector("#rejillaProductos:not([aria-busy]) li", { state: "attached" });
    const total = await tarjetasVisibles();
    esperar(total === CATALOGO.productos.length, `hay ${total} tarjetas, se esperaban ${CATALOGO.productos.length}`);
  });

  await prueba("Catálogo: precio y botón alineados entre tarjetas de una misma fila", async () => {
    // Las tarjetas de una fila comparten el mismo "top"; sus botones deben compartir el mismo "bottom".
    await pagina.waitForTimeout(300); // Tailwind CDN genera estilos de lo recién pintado
    const filas = await pagina.$$eval("#rejillaProductos > li:not([hidden])", (items) => {
      const porFila = {};
      items.forEach((li) => {
        const top = Math.round(li.getBoundingClientRect().top);
        const boton = li.querySelector(".add-carrito").getBoundingClientRect();
        (porFila[top] ??= []).push(Math.round(boton.bottom));
      });
      return Object.values(porFila);
    });
    const desalineada = filas.find((fila) => new Set(fila).size > 1);
    esperar(!desalineada, `botones a distinta altura en una fila: ${JSON.stringify(desalineada)}`);
  });

  const novedades = CATALOGO.productos.filter((p) => p.novedad);
  await prueba("Inicio: carrusel de novedades (siguiente, miniaturas y pausa)", async () => {
    await pagina.goto(BASE + "index.html");
    await pagina.waitForSelector("#diapositivasNovedades .diapositiva");
    const visibles = () => pagina.locator("#diapositivasNovedades .diapositiva:not([hidden])");
    esperar((await visibles().count()) === 1, "debe verse exactamente una diapositiva");
    const primera = await visibles().locator("h3").textContent();
    esperar(primera === novedades[0]?.nombre || novedades.length === 0, `la primera diapositiva es "${primera}"`);
    await pagina.click(".carrusel-siguiente");
    const segunda = await visibles().locator("h3").textContent();
    esperar(segunda !== primera, "el botón siguiente no cambió la diapositiva");
    esperar(
      (await pagina.getAttribute("#diapositivasNovedades", "aria-live")) === "polite",
      "tras usar las flechas el carrusel debe quedar en pausa y anunciar los cambios"
    );
    await pagina.click("#miniaturasNovedades li:first-child button");
    esperar((await visibles().locator("h3").textContent()) === primera, "la miniatura no llevó a su diapositiva");
    esperar(
      (await pagina.getAttribute("#miniaturasNovedades li:first-child button", "aria-current")) === "true",
      "la miniatura activa no lleva aria-current"
    );
  });

  const categoria = CATALOGO.categorias[0];
  await prueba(`Catálogo: ?cat=${categoria.slug} filtra por categoría`, async () => {
    const esperados = CATALOGO.productos.filter((p) => p.categoria === categoria.slug).length;
    await pagina.goto(BASE + `catalogo.html?cat=${categoria.slug}`);
    await pagina.waitForSelector("#rejillaProductos:not([aria-busy]) li", { state: "attached" });
    const visibles = await tarjetasVisibles();
    esperar(visibles === esperados, `se ven ${visibles}, se esperaban ${esperados}`);
    esperar(await pagina.isChecked(`#filtro-${categoria.slug}`), "la casilla de la categoría no quedó marcada");
  });

  const buscado = CATALOGO.productos[1];
  // La búsqueda es SOLO por nombre: sin tildes y en minúsculas debe encontrarlo
  const terminoBuscado = buscado.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  await prueba("Catálogo: búsqueda por nombre sin tildes y persistencia en sessionStorage", async () => {
    await pagina.goto(BASE + "catalogo.html");
    await pagina.waitForSelector("#rejillaProductos:not([aria-busy]) li", { state: "attached" });
    await pagina.click("#botonLimpiar");
    await pagina.fill("#buscador", buscado.id.toLowerCase());
    esperar((await tarjetasVisibles()) === 0, `buscar el código "${buscado.id}" no debe encontrar nada (la búsqueda es por nombre)`);
    await pagina.fill("#buscador", terminoBuscado);
    esperar((await tarjetasVisibles()) === 1, `buscar "${terminoBuscado}" no dejó exactamente 1 resultado`);
    await pagina.reload();
    await pagina.waitForSelector("#rejillaProductos:not([aria-busy]) li", { state: "attached" });
    esperar((await pagina.inputValue("#buscador")) === terminoBuscado, "el filtro no se restauró al recargar");
    esperar((await tarjetasVisibles()) === 1, "tras recargar no se aplicó el filtro guardado");
    await pagina.click("#botonLimpiar");
  });

  const producto = CATALOGO.productos[0];
  await prueba(`Ficha: galería de ${producto.imagenes.length} fotos y datos de ${producto.id}`, async () => {
    await pagina.goto(BASE + `producto.html?id=${producto.id}`);
    await pagina.waitForSelector("#fichaProducto:not([hidden])");
    esperar((await pagina.textContent("#nombreProducto")) === producto.nombre, "el nombre no coincide");
    esperar((await pagina.textContent("#precioProducto")) === `$${producto.precio.toFixed(2)}`, "el precio no coincide");
    const imgs = await pagina.locator("#figuraPrincipal ~ * button, #fichaProducto button[aria-pressed]").count();
    esperar(imgs === producto.imagenes.length, `hay ${imgs} miniaturas, se esperaban ${producto.imagenes.length}`);
  });

  await prueba("Carrito: agregar 2 unidades desde la ficha y que persista al recargar", async () => {
    await pagina.fill("#cantidadProducto", "2");
    await pagina.click("#botonAgregarCarrito");
    await pagina.waitForFunction(() => document.getElementById("contadorCarrito").textContent === "2");
    await pagina.reload();
    await pagina.waitForFunction(() => document.getElementById("contadorCarrito").textContent === "2", null, { timeout: 5000 });
  });

  await prueba("Carrito: muestra la línea y el total calculado desde el catálogo", async () => {
    await pagina.goto(BASE + "carrito.html");
    await pagina.waitForSelector("#listaCarrito li");
    const total = await pagina.textContent("#totalCarrito");
    esperar(total.includes((producto.precio * 2).toFixed(2)), `el total dice "${total}"`);
  });

  await prueba("Checkout: Enter con campos vacíos nombra los campos con error y enfoca el primero", async () => {
    await pagina.focus("#nombreCheckout");
    await pagina.keyboard.press("Enter");
    await pagina.waitForSelector("#estadoCheckout:not([hidden])");
    const error = await pagina.textContent("#errorNombreCheckout");
    esperar(error.trim().length > 0, "no se mostró el error junto al campo nombre");
    const resumen = await pagina.textContent("#estadoCheckout");
    esperar(!/rojo/i.test(resumen), `el mensaje general depende del color: "${resumen}"`);
    esperar(resumen.includes("Nombre o empresa que cotiza") && resumen.includes("Correo electrónico"), `no nombra los campos: "${resumen}"`);
    esperar((await pagina.evaluate(() => document.activeElement.id)) === "nombreCheckout", "el foco no fue al primer campo con error");
    esperar(!(await pagina.evaluate(() => window.__abierto)), "se envió el pedido con campos inválidos");
  });

  const WHATSAPP = CATALOGO.empresa.telefono.replace(/\D/g, "");
  await prueba("Checkout: acepta empresa con números y puntos y teléfono con espacios y +593; no vacía la lista ni guarda datos sin permiso", async () => {
    await pagina.fill("#nombreCheckout", "Calzado 2000 Cía. Ltda.");
    await pagina.fill("#correoCheckout", "prueba@ejemplo.com");
    await pagina.fill("#telefonoCheckout", "+593 98 785 5906");
    await pagina.keyboard.press("Enter");
    await pagina.waitForSelector("#confirmacionEnvio:not([hidden])");
    const abierto = await pagina.evaluate(() => window.__abierto);
    esperar(abierto?.startsWith(`https://wa.me/${WHATSAPP}?`), `se abrió "${abierto}" (se esperaba el WhatsApp de empresa.telefono)`);
    esperar(decodeURIComponent(abierto).includes("Calzado 2000 Cía. Ltda."), "el mensaje no lleva el nombre de la empresa");
    esperar((await pagina.textContent("#contadorCarrito")) === "2", "la lista se vació antes de confirmar el envío");
    const registro = await pagina.evaluate(() => localStorage.getItem("ce_registro_v1"));
    esperar(registro === null, `se guardaron datos sin marcar la casilla: ${registro}`);
  });

  await prueba("Checkout: \"No, conservar la lista\" mantiene la lista", async () => {
    await pagina.click("#botonConservarLista");
    await pagina.waitForSelector("#confirmacionEnvio", { state: "hidden" });
    esperar((await pagina.textContent("#contadorCarrito")) === "2", "la lista no se conservó");
  });

  await prueba("Checkout: la pregunta sobrevive a una recarga y \"Sí\" vacía la lista, guarda historial y datos con permiso", async () => {
    await pagina.check("#recordarDatosCheckout");
    await pagina.click("#botonEnviarWhatsApp");
    await pagina.waitForSelector("#confirmacionEnvio:not([hidden])");
    await pagina.reload();
    await pagina.waitForSelector("#confirmacionEnvio:not([hidden])");
    await pagina.click("#botonConfirmarEnvio");
    await pagina.waitForSelector("#listaHistorial li");
    await pagina.waitForFunction(() => document.getElementById("contadorCarrito").textContent === "0");
    const cookie = (await contexto.cookies()).find((c) => c.name === "ce_ultima_actualizacion");
    esperar(cookie, "no se creó la cookie ce_ultima_actualizacion");
    const registro = await pagina.evaluate(() => JSON.parse(localStorage.getItem("ce_registro_v1") ?? "null"));
    esperar(registro?.telefono === "0987855906", `el teléfono no se guardó normalizado: ${JSON.stringify(registro)}`);
  });

  await prueba("Historial: \"Volver a pedir\" repone la lista", async () => {
    await pagina.click("#listaHistorial li button");
    await pagina.waitForFunction(() => document.getElementById("contadorCarrito").textContent === "2");
  });

  // La página "Guardar mis datos" se retiró (irá a la configuración de la cuenta):
  // mientras tanto el carrito ofrece borrar lo recordado, solo si hay algo guardado.
  await prueba("Carrito: precarga lo recordado y \"Olvidar mis datos\" lo borra", async () => {
    await pagina.goto(BASE + "carrito.html");
    await pagina.waitForSelector("#botonOlvidarDatos:not([hidden])");
    esperar((await pagina.inputValue("#correoCheckout")) === "prueba@ejemplo.com", "no se precargó el correo recordado");
    await pagina.click("#botonOlvidarDatos");
    await pagina.waitForSelector("#botonOlvidarDatos[hidden]", { state: "attached" });
    const guardado = await pagina.evaluate(() => localStorage.getItem("ce_registro_v1"));
    esperar(guardado === null, `los datos siguen guardados: ${guardado}`);
    esperar((await pagina.inputValue("#correoCheckout")) === "", "el correo sigue en el formulario");
    esperar(!(await pagina.isChecked("#recordarDatosCheckout")), "la casilla sigue marcada");
  });

  await prueba("Ficha inexistente muestra el error (sin inyectar el id como HTML)", async () => {
    await pagina.goto(BASE + "producto.html?id=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E");
    await pagina.waitForSelector("#errorProducto:not([hidden])");
    esperar((await pagina.locator("img[src=x]").count()) === 0, "el id de la URL se insertó como HTML");
  });

  await prueba("Sin errores de JavaScript durante las pruebas de funciones", async () => {
    esperar(errores.length === 0, errores.join(" | "));
  });

  await contexto.close();
} finally {
  await navegador.close();
  servidor.close();
}

console.log("");
if (fallos.length) {
  console.error(`✘ ${fallos.length} de ${pruebas} pruebas fallaron.`);
  process.exit(1);
}
console.log(`✔ ${pruebas} pruebas en navegador sin problemas.`);
