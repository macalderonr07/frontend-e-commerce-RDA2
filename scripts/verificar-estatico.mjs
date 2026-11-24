// Verificación estática del sitio (no abre navegador). La corre GitHub Actions antes
// de publicar; también se puede correr a mano: npm run verificar:estatico
//
// Comprueba:
//   1. Sintaxis de todo el JavaScript (node --check).
//   2. data/catalogo.json: estructura, ids únicos, categorías existentes, precios,
//      al menos 3 fotos por producto con texto alternativo, y que cada imagen exista.
//   3. Que cada src/href local de las páginas apunte a un archivo existente.
//   4. Que cada página cargue storage.js antes que los scripts que usan AlmacenCE.
//   5. Tokens de diseño en un solo archivo (js/tailwind-config.js), sin paletas
//      inline por página (auditoría IHC, H1 y H6).
//   6. Datos de contacto (teléfono, WhatsApp, correo, dirección, horario) iguales
//      al campo "empresa" de data/catalogo.json en todas las páginas y scripts
//      (auditoría IHC, H5), y peso anunciado del PDF igual al real (H13).
//
// Termina con código 1 si algo falla, así el job de Actions se marca en rojo y
// no se publica.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const errores = [];
const ok = (mensaje) => console.log(`  ✔ ${mensaje}`);
const fallo = (mensaje) => errores.push(mensaje);
const seccion = (titulo) => console.log(`\n▶ ${titulo}`);

const PAGINAS = ["index.html", "catalogo.html", "producto.html", "carrito.html", "nosotros.html"];

// ---------------------------------------------------------------- 1. JavaScript
seccion("Sintaxis de JavaScript");
const archivosJS = readdirSync("js").filter((f) => f.endsWith(".js")).map((f) => join("js", f));
for (const archivo of archivosJS) {
  try {
    execFileSync(process.execPath, ["--check", archivo], { stdio: "pipe" });
  } catch (error) {
    fallo(`${archivo}: error de sintaxis\n${error.stderr}`);
  }
}
ok(`${archivosJS.length} archivos revisados`);

// ---------------------------------------------------------------- 2. Catálogo
seccion("Catálogo (data/catalogo.json)");
const MIN_FOTOS = 3;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
let catalogo = null;
try {
  catalogo = JSON.parse(readFileSync("data/catalogo.json", "utf8"));
} catch (error) {
  fallo(`data/catalogo.json: JSON inválido (${error.message})`);
}
if (catalogo) {
  const { categorias = [], productos = [] } = catalogo;
  const slugs = new Set();
  for (const c of categorias) {
    if (!c.slug || !c.nombre) fallo(`categoría sin slug o nombre: ${JSON.stringify(c)}`);
    if (slugs.has(c.slug)) fallo(`categoría repetida: ${c.slug}`);
    slugs.add(c.slug);
  }

  const ids = new Set();
  let fotos = 0;
  for (const p of productos) {
    const donde = `producto ${p.id ?? "(sin id)"}`;
    for (const campo of ["id", "nombre", "categoria", "subcategoria", "presentacion", "uso", "imagen", "alt"]) {
      if (typeof p[campo] !== "string" || !p[campo].trim()) fallo(`${donde}: falta el campo "${campo}"`);
    }
    if (ids.has(p.id)) fallo(`${donde}: id repetido`);
    ids.add(p.id);
    if (!/^CE-\d{4}$/.test(p.id ?? "")) fallo(`${donde}: el id debe tener el formato CE-0000 (va en la URL)`);
    if (!Number.isFinite(p.precio) || p.precio <= 0) fallo(`${donde}: precio inválido`);
    if (!slugs.has(p.categoria)) fallo(`${donde}: la categoría "${p.categoria}" no existe`);
    if (!Array.isArray(p.colores) || p.colores.length === 0) fallo(`${donde}: "colores" debe ser una lista no vacía`);
    if (typeof p.novedad !== "boolean") fallo(`${donde}: "novedad" debe ser true o false`);
    if (!FECHA.test(p.fechaIngreso ?? "")) fallo(`${donde}: "fechaIngreso" debe ser AAAA-MM-DD`);
    if (!existsSync(p.imagen ?? "")) fallo(`${donde}: no existe la imagen principal ${p.imagen}`);
    for (const [, archivo] of (p.srcset ?? "").matchAll(/(\S+)\s+\d+w/g)) {
      if (!existsSync(archivo)) fallo(`${donde}: el srcset apunta a ${archivo}, que no existe`);
    }

    const galeria = Array.isArray(p.imagenes) ? p.imagenes : [];
    if (galeria.length < MIN_FOTOS) fallo(`${donde}: tiene ${galeria.length} fotos, el mínimo es ${MIN_FOTOS}`);
    if (galeria[0]?.src !== p.imagen) fallo(`${donde}: la primera foto de la galería debe ser la imagen principal`);
    const srcs = new Set();
    galeria.forEach((foto, i) => {
      const f = `${donde}, foto ${i + 1}`;
      fotos += 1;
      if (!existsSync(foto.src ?? "")) fallo(`${f}: no existe el archivo ${foto.src}`);
      if (srcs.has(foto.src)) fallo(`${f}: foto repetida ${foto.src}`);
      srcs.add(foto.src);
      if (!foto.alt?.trim()) fallo(`${f}: falta el texto alternativo (WCAG 1.1.1)`);
    });
  }
  for (const c of categorias) {
    if (!productos.some((p) => p.categoria === c.slug)) fallo(`categoría ${c.slug}: no tiene productos`);
  }
  ok(`${categorias.length} categorías, ${productos.length} productos, ${fotos} fotos`);
}

// ---------------------------------------------------------------- 3. Enlaces locales
seccion("Enlaces y recursos locales de las páginas");
let enlaces = 0;
for (const pagina of PAGINAS) {
  const html = readFileSync(pagina, "utf8");
  for (const [, ruta] of html.matchAll(/(?:src|href)="([^"#?:]+)(?:[?#][^"]*)?"/g)) {
    enlaces += 1;
    if (!existsSync(ruta)) fallo(`${pagina}: apunta a "${ruta}", que no existe`);
  }
}
ok(`${enlaces} referencias revisadas en ${PAGINAS.length} páginas`);

// ---------------------------------------------------------------- 4. Orden de scripts
seccion("Orden de carga de scripts");
const USAN_ALMACEN = ["encabezado.js", "catalogo.js", "producto.js", "carrito.js"];
for (const pagina of PAGINAS) {
  const scripts = [...readFileSync(pagina, "utf8").matchAll(/<script src="js\/([^"]+)"/g)].map((m) => m[1]);
  const posAlmacen = scripts.indexOf("storage.js");
  for (const s of scripts.filter((s) => USAN_ALMACEN.includes(s))) {
    if (posAlmacen === -1 || scripts.indexOf(s) < posAlmacen) fallo(`${pagina}: ${s} se carga antes que storage.js`);
  }
}
ok("storage.js se carga antes que sus consumidores en todas las páginas");

// js/api.js define window.CatalogoCE y window.CarritoCE (y usa AlmacenCE): va después
// de storage.js y antes de quienes lo usan.
const USAN_CATALOGO = ["encabezado.js", "inicio.js", "catalogo.js", "producto.js", "carrito.js"];
for (const pagina of PAGINAS) {
  const scripts = [...readFileSync(pagina, "utf8").matchAll(/<script src="js\/([^"]+)"/g)].map((m) => m[1]);
  const posApi = scripts.indexOf("api.js");
  for (const s of scripts.filter((s) => USAN_CATALOGO.includes(s))) {
    if (posApi === -1 || scripts.indexOf(s) < posApi) fallo(`${pagina}: ${s} se carga antes que api.js`);
  }
  if (posApi !== -1 && posApi < scripts.indexOf("storage.js")) fallo(`${pagina}: api.js se carga antes que storage.js`);
}
ok("api.js se carga antes que sus consumidores en todas las páginas");

// ---------------------------------------------------------------- 5. Tokens de diseño
seccion("Tokens de diseño compartidos");
for (const pagina of PAGINAS) {
  const html = readFileSync(pagina, "utf8");
  if (/tailwind\.config\s*=/.test(html)) fallo(`${pagina}: declara su propia paleta inline; usa js/tailwind-config.js`);
  const cdn = html.indexOf("cdn.tailwindcss.com");
  const config = html.indexOf('src="js/tailwind-config.js"');
  if (config === -1) fallo(`${pagina}: no carga js/tailwind-config.js`);
  else if (cdn === -1 || config < cdn) fallo(`${pagina}: js/tailwind-config.js debe ir después del CDN de Tailwind`);
}
ok(`las ${PAGINAS.length} páginas usan la misma paleta (js/tailwind-config.js)`);

// ---------------------------------------------------------------- 6. Datos de contacto
seccion("Datos de contacto: una sola fuente (empresa en data/catalogo.json)");
if (catalogo?.empresa) {
  const { telefono, correo, direccion, horario = [] } = catalogo.empresa;
  const digitos = telefono.replace(/\D/g, "");
  const calle = direccion.split(",")[0];
  const fuentes = [...PAGINAS, ...archivosJS];
  for (const archivo of fuentes) {
    const texto = readFileSync(archivo, "utf8");
    for (const [, numero] of texto.matchAll(/wa\.me\/(\d+)/g)) {
      if (numero !== digitos) fallo(`${archivo}: WhatsApp a ${numero}, pero empresa.telefono es ${telefono}`);
    }
    for (const [, destino] of texto.matchAll(/mailto:([^"?`$\s]+)/g)) {
      if (destino !== correo) fallo(`${archivo}: mailto a ${destino}, pero empresa.correo es ${correo}`);
    }
    for (const [, correoFijo] of texto.matchAll(/"([^"\s@:]+@[^"\s@]+\.[a-z]{2,})"/g)) {
      if (correoFijo !== correo) fallo(`${archivo}: correo fijo ${correoFijo}, pero empresa.correo es ${correo}`);
    }
    if (archivo.endsWith(".html")) {
      for (const [, numero] of texto.matchAll(/href="tel:([^"]+)"/g)) {
        if (numero !== telefono) fallo(`${archivo}: tel:${numero}, pero empresa.telefono es ${telefono}`);
      }
      for (const [, numero] of texto.matchAll(/"telephone":\s*"([^"]+)"/g)) {
        if (numero !== telefono) fallo(`${archivo}: datos estructurados con teléfono ${numero}`);
      }
      for (const [, calleLD] of texto.matchAll(/"streetAddress":\s*"([^"]+)"/g)) {
        if (calleLD !== calle) fallo(`${archivo}: datos estructurados con dirección "${calleLD}", se esperaba "${calle}"`);
      }
      if (/<address/.test(texto) && !texto.includes(calle)) fallo(`${archivo}: la dirección visible no es "${direccion}"`);
      for (const { dias, horas } of horario) {
        const [abre, cierra] = horas.split(/\s*–\s*/);
        for (const [, horasPagina] of texto.matchAll(new RegExp(`${dias}:\\s*([0-9:]+\\s*–\\s*[0-9:]+)`, "g"))) {
          if (horasPagina.replace(/\s/g, "") !== horas.replace(/\s/g, "")) {
            fallo(`${archivo}: horario "${dias}: ${horasPagina}", pero en el catálogo es "${horas}"`);
          }
        }
        for (const [, apertura, cierre] of texto.matchAll(/"opens":\s*"([^"]+)",\s*"closes":\s*"([^"]+)"/g)) {
          if (![abre, ...horario.map((h) => h.horas.split(/\s*–\s*/)[0])].includes(apertura)) {
            fallo(`${archivo}: datos estructurados abren a las ${apertura}`);
          }
          if (![cierra, ...horario.map((h) => h.horas.split(/\s*–\s*/)[1])].includes(cierre)) {
            fallo(`${archivo}: datos estructurados cierran a las ${cierre}`);
          }
        }
      }
    }
  }
  ok(`teléfono, WhatsApp, correo, dirección y horario coinciden en ${fuentes.length} archivos`);

  const bytesPDF = statSync("assets/catalogo.pdf").size;
  const kbPDF = Math.max(1, Math.round(bytesPDF / 1024));
  for (const pagina of PAGINAS) {
    for (const [, kb] of readFileSync(pagina, "utf8").matchAll(/\(PDF, (\d+) KB\)/g)) {
      if (Number(kb) !== kbPDF) fallo(`${pagina}: anuncia el PDF con ${kb} KB, pero pesa ${kbPDF} KB (${bytesPDF} bytes)`);
    }
  }
  ok(`el peso anunciado del PDF coincide con el real (${kbPDF} KB)`);
}

// ---------------------------------------------------------------- Resultado
console.log("");
if (errores.length) {
  console.error(`✘ ${errores.length} problema(s):`);
  errores.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}
console.log("✔ Verificación estática sin problemas.");
