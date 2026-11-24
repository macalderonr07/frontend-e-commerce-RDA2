# Comercial Elite — catálogo y carrito

**Sitio publicado:** https://macalderonr07.github.io/Reto-1-RDA1/

Sitio web de Comercial Elite, distribuidor de insumos para calzado y marroquinería en
Quito (cueros, sintéticos, suelas, plantillas, hilos, adhesivos, herrajes y
herramienta menor). Es un catálogo con carrito de cotización: el cliente arma un
pedido con precios y cantidades, y lo envía por WhatsApp o correo — no hay pasarela de
pago ni backend, el negocio sigue cerrando la venta directamente con el cliente.

## Estructura de carpetas

```
comercial-elite/
├── index.html          # portada: líneas de producto + novedades
├── catalogo.html        # catálogo filtrable (categoría + texto)
├── producto.html         # ficha de un producto (galería, precio, agregar al carrito)
├── carrito.html           # lista de cotización: CRUD, total, descuento por volumen, envío, historial
├── nosotros.html              # quiénes somos + "¿Prefieres comprar en persona?" (dirección, horario, mapa)
├── styles.css                  # paleta, foco visible, portada diagonal
├── data/
│   └── catalogo.json             # "backend" del sitio: productos, precios, categorías
├── js/
│   ├── storage.js                  # AlmacenCE: localStorage/sessionStorage/IndexedDB/cookies
│   ├── validacion.js                # ValidacionCE: regex y feedback de formularios
│   ├── encabezado.js                 # badge del carrito en el header (5 páginas)
│   ├── menu.js                        # menú móvil accesible
│   ├── inicio.js, catalogo.js,         # un script por página (mismo patrón IIFE)
│   │   producto.js, carrito.js
├── assets/
│   ├── img/                               # fotos e ilustraciones de producto + logo
│   └── catalogo.pdf                        # catálogo descargable
├── robots.txt, sitemap.xml                  # SEO básico
├── scripts/                                  # verificación y publicación (no se publican)
│   ├── verificar-estatico.mjs                 # JS, catálogo, enlaces, orden de scripts
│   ├── verificar-e2e.mjs                       # pruebas en Chromium (axe, celulares, carrito…)
│   └── preparar-sitio.mjs                       # arma _site/ con solo lo publicable
├── .github/workflows/verificar-y-publicar.yml    # CI: verifica y publica en GitHub Pages
├── .htmlvalidate.mjs                              # reglas de html-validate
└── package.json                                    # dependencias de desarrollo (solo para verificar)
```

## Arquitectura técnica

Sitio 100% estático, sin build ni framework: Tailwind se carga por CDN (Play CDN) y
las 5 páginas comparten una sola paleta de tokens en `js/tailwind-config.js` (incluido
el token semántico `accion` del botón principal). El
JavaScript es un script por página, cada uno un IIFE `(() => { ... })()` con una guard
clause al inicio (`if (!elemento) return;`) para que el mismo archivo pueda incluirse
en páginas donde no aplica sin romper nada.

Dos módulos se comparten entre páginas:

- **`js/storage.js`** expone `window.AlmacenCE`, la única capa que toca
  localStorage/sessionStorage/IndexedDB/cookies. Toda su API devuelve **Promesas**
  (incluidas las operaciones síncronas de localStorage, envueltas para uniformidad) y
  las de IndexedDB están envueltas de verdad (la API nativa es por callbacks). Si el
  almacenamiento persistente falla (cuota llena, navegación privada estricta), cada
  mutación del carrito/registro deja una copia en memoria para que el sitio siga
  funcionando el resto de la sesión, y rechaza la Promesa con un error
  `{ codigo, mensaje }` en español listo para mostrarse en un `role="alert"`.
- **`js/validacion.js`** expone `window.ValidacionCE` con los patrones regex
  (nombre/correo/teléfono/mensaje) y el helper de validación visual que usan
  el checkout de `carrito.js` (y los formularios que vengan), para no repetir las
  expresiones regulares en cada formulario.

El catálogo (`data/catalogo.json`) es la única fuente de verdad de nombre/precio de
cada producto: el carrito solo guarda `id` + `cantidad` + timestamps, y siempre resuelve
el resto contra el JSON al mostrarse. Así, si cambia un precio, el carrito lo refleja en
vez de mostrar un dato guardado y caducado.

## Accesibilidad (WCAG 2.2 AA)

- **Paleta verificada por contraste real**, no arbitraria: los verdes de marca se
  calcularon en el mismo matiz del logo (`styles.css`, líneas 1-38) hasta cumplir AA;
  el acento "cuero" para precios/totales (`#8B5E34` claro / `#D9A066` oscuro) se
  verificó igual (5.60:1 / 8.37:1 sobre sus fondos).
- **Foco visible propio** (`:focus-visible` global, nunca `outline: none` sin
  reemplazo), **skip-link** al contenido, objetivos táctiles ≥ 44px (Ley de Fitts).
- **No depender solo del color**: el ítem de nav activo cambia de forma además de
  color; los enlaces llevan subrayado; los errores de formulario llevan texto, no solo
  un borde rojo.
- **Formularios**: errores junto al campo con `aria-describedby`, confirmaciones en
  `role="status"`/`aria-live="polite"`, errores bloqueantes en `role="alert"`.
- **`prefers-reduced-motion`** respetado en toda animación/transición.
- Navegación completa por teclado: el botón "Agregar al carrito" de cada tarjeta del
  catálogo está por encima (`z-10`) del enlace que cubre toda la tarjeta, para que Tab
  + Enter/Espacio lo activen sin disparar la navegación de la tarjeta.

## Persistencia: qué vive dónde y por qué

| Mecanismo | Dato | Por qué |
|---|---|---|
| `localStorage` (`ce_carrito_v1`) | Carrito: id + cantidad + `agregadoEn`/`actualizadoEn` | Debe sobrevivir a cerrar el navegador y a recargar la página |
| `localStorage` (`ce_registro_v1`) | Solo correo + teléfono, con la casilla "Recordar mis datos" del carrito (se borran con "Olvidar mis datos") | Evitar reescribirlos en cada visita. Cuando exista el login de cuentas, pasarán a la configuración de la cuenta (en la base) |
| `sessionStorage` (`ce_filtros_catalogo_v1`) | Texto buscado + categorías marcadas en el catálogo | Es estado de navegación de la visita actual, no algo que deba persistir para siempre |
| `IndexedDB` (`ComercialEliteDB` → `pedidos`) | Historial de pedidos ya enviados (fecha, ítems, total, medio) | Estructura más rica que un par clave/valor; se consulta como lista, no como un único blob |
| Cookie (`ce_ultima_actualizacion`, 30 días) | Solo una fecha ISO, sin datos personales | Marca de "última actualización" visible en el carrito, pensada como ejercicio de uso de cookies sin guardar PII en ellas |

## Cómo ejecutar localmente

El sitio no necesita **servidor dinámico** (no hay Node/PHP/backend alguno). Sin
embargo, el catálogo se carga con `fetch("data/catalogo.json")`, y **Chrome bloquea
`fetch()` contra `file://` por su política de CORS** cuando `index.html` se abre con
doble clic (Firefox sí lo permite). Para desarrollar sin tropezar con esto:

- Abrir la carpeta con Firefox, **o**
- Levantar un servidor estático simple (no dinámico) en la carpeta, por ejemplo:
  ```
  python3 -m http.server 8080
  ```
  y entrar a `http://localhost:8080/`, **o**
  usar la extensión "Live Server" de VS Code.

## Verificación y despliegue en GitHub Pages

El sitio se publica con GitHub Actions (`.github/workflows/verificar-y-publicar.yml`)
en cada push a `main`. **Publicar solo corre si Verificar y Seguridad pasan
completos**; si algo falla, el sitio publicado queda como estaba:

1. **Verificar el sitio**
   - `npm run verificar:estatico` — sintaxis de todo `js/`, estructura de
     `data/catalogo.json` (ids únicos, categorías existentes, precios, ≥ 3 fotos por
     producto con texto alternativo y archivo existente), que cada `src`/`href` local
     de las 5 páginas exista, y que `storage.js` se cargue antes que sus consumidores.
   - `npm run verificar:html` — `html-validate` (reglas recomendadas + WCAG) sobre
     las 5 páginas.
   - `npm run verificar:e2e` — Chromium con Playwright en escritorio, iPhone SE,
     Pixel 5 e iPad Mini: sin errores de JS, sin scroll horizontal, **0 violaciones
     de axe-core (WCAG 2.2 AA)**, y las funciones clave: filtros por URL/texto y su
     restauración desde `sessionStorage`, ficha y galería, carrito persistente en
     `localStorage`, checkout (validación, envío con Enter, historial en IndexedDB,
     cookie, "Olvidar mis datos").
2. **Seguridad**: `npm audit` (severidad alta o más) y gitleaks sobre todo el
   historial. Aparte, `codeql.yml` hace el análisis estático del JavaScript y
   Dependabot propone actualizaciones cada semana.
3. **Publicar en GitHub Pages**: `npm run preparar-sitio` arma `_site/` solo con
   las páginas y sus recursos (sin `scripts/`, `node_modules` ni el README). Se
   despliega con `actions/deploy-pages`.
   - Si la variable del repositorio **`CE_API_URL`** existe (https; en *Settings
     › Secrets and variables › Actions › Variables*), la tienda publicada usa esa
     API, que está en el repositorio
     [Backend-RDA2](https://github.com/macalderonr07/Backend-RDA2), carpeta
     `api-tienda`. Para eso la API necesita el dominio de Pages en
     `CLIENT_ORIGIN`.
   - Sin la variable, usa `data/catalogo.json` y el carrito en `localStorage`.

En un pull request solo se verifica, no se publica. Para correr lo mismo en local:

```
npm ci
npx playwright install chromium
npm run verificar
```

> Las pruebas en navegador necesitan internet porque Tailwind se carga desde su CDN.

## Correcciones de la auditoría IHC (20-10-2026)

| # | Corrección |
|---|---|
| H1, H6 | Paleta única en `js/tailwind-config.js`; la oscura define `ink` y el botón principal usa el token `accion` (7,91:1 en oscuro). axe ahora también corre en modo oscuro. |
| H2 | La lista no se vacía al abrir WhatsApp/correo: se pregunta "¿Enviaste tu lista de cotización?" (la pregunta sobrevive a una recarga). El historial ofrece "Volver a pedir". |
| H3 | "Nombre o empresa" acepta letras, números y `. , & ' - /` (2 a 80 caracteres). |
| H4 | El teléfono acepta espacios, guiones y `+593`; se normaliza antes de validar y la indicación aparece también en la lista de cotización. |
| H5 | Teléfono, WhatsApp, correo, dirección y horario salen del campo `empresa` de `data/catalogo.json`; `npm run verificar:estatico` falla si alguna página o script lo contradice. |
| H7 | "Carrito" → "Lista de cotización", "Registro" → "Guardar mis datos", "Total referencial, IVA incluido". |
| H8 | Fotos PNG pesadas → WebP de 800 px con versión de 400 px (`srcset`); logo de 56/112 px. Originales en `originales-img/` (no se publica). |
| H9 | Casilla "Recordar mis datos en este dispositivo", desmarcada por defecto; el historial ya no guarda correo ni teléfono. |
| H10 | Mínimo 14 px en insignias, contador y nombres de la portada (sin recorte a dos líneas). |
| H11 | El error general nombra los campos y enfoca el primero (checkout del carrito). |
| H12 | Las 8 ventanas de la portada usan un solo tono; la foto diferencia cada línea. |
| H13 | El peso del PDF se verifica contra el archivo real. |
| H14 | Logo con `alt=""` dentro del enlace "Comercial Elite". |

## Cambios de estructura (noviembre 2026)

- **Contacto** se retiró: su formulario repetía el de la lista de cotización. El
  campo de mensaje pasó al checkout del carrito, y la dirección, horario y mapa a
  Nosotros ("¿Prefieres comprar en persona?").
- **Guardar mis datos** (`registro.html`) se retiró: guardar los datos del
  cliente es tarea de la futura configuración de la cuenta de usuario (con login,
  los datos vendrán de la base al iniciar sesión). Mientras tanto el carrito
  conserva la casilla "Recordar mis datos" y ofrece "Olvidar mis datos".
- **Modo claro con descanso visual**: fondo crema (#F6F0E1), superficies papel
  (#FFFBF2) y el verde de fondo en salvia (#B8D88A) en lugar del lima del logo,
  que se mantiene en modo oscuro. Contrastes AA verificados en `js/tailwind-config.js`.
