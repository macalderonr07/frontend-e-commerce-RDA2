// Ficha de producto: lee ?id= de la URL y pinta el detalle desde
// catálogo de CatalogoCE (API o data/catalogo.json, ver js/api.js) (RF-03).
(() => {
  const estadoCarga = document.getElementById("estadoCarga");
  const ficha = document.getElementById("fichaProducto");
  const errorProducto = document.getElementById("errorProducto");
  const seccionRelacionados = document.getElementById("seccionRelacionados");
  const rejillaRelacionados = document.getElementById("rejillaRelacionados");

  if (!ficha) return;


  function crearTarjetaRelacionada(producto) {
    const li = document.createElement("li");
    li.innerHTML = `
      <article class="relative flex h-full flex-col overflow-hidden rounded-lg border border-elite-border bg-white shadow-[0_1px_3px_rgba(26,26,26,0.12)] dark:border-elitenight-border dark:bg-elitenight-bg">
        <figure class="m-0 bg-elite-tint dark:bg-elitenight-tint">
          <img class="aspect-[4/3] w-full object-cover" src="${producto.imagen}" srcset="${producto.srcset ?? producto.imagen}" sizes="(min-width: 60em) 22rem, (min-width: 30em) 50vw, 100vw" alt="${producto.alt}" width="400" height="300" loading="lazy">
          <figcaption class="sr-only">${producto.nombre}</figcaption>
        </figure>
        <div class="flex flex-1 flex-col gap-1.5 p-5">
          <h3 class="mb-0 text-base font-semibold"><a class="text-elite-dark no-underline after:absolute after:inset-0 after:content-[''] dark:text-elitenight-dark" href="producto.html?id=${encodeURIComponent(producto.id)}">${producto.nombre}</a></h3>
          <p class="m-0 text-sm text-elite-text dark:text-elitenight-text">${producto.id} · ${producto.presentacion}</p>
        </div>
      </article>
    `;
    return li;
  }

  // Galería: imagen principal con proporción fija + miniaturas (botones).
  // Accesibilidad: cada miniatura es un <button> con nombre propio y
  // aria-pressed; el pie de foto es aria-live para anunciar el cambio; las
  // flechas del teclado recorren las miniaturas.
  function crearGaleria(producto) {
    const imagenes =
      producto.imagenes && producto.imagenes.length > 0
        ? producto.imagenes
        : [{ src: producto.imagen, alt: producto.alt }];
    const figura = document.getElementById("figuraPrincipal");
    const total = imagenes.length;

    figura.innerHTML = `
      <div class="overflow-hidden rounded-lg border border-elite-border bg-elite-tint dark:border-elitenight-border dark:bg-elitenight-tint">
        <img class="aspect-[4/3] w-full object-contain" id="imagenPrincipal" src="${imagenes[0].src}" alt="${imagenes[0].alt}" width="800" height="600">
      </div>
      <figcaption class="mt-1.5 text-sm text-elite-text dark:text-elitenight-text" id="pieImagen" aria-live="polite"></figcaption>
    `;
    const principal = figura.querySelector("#imagenPrincipal");
    const pie = figura.querySelector("#pieImagen");
    const botones = [];

    function seleccionar(indice) {
      const { src, alt } = imagenes[indice];
      principal.src = src;
      principal.alt = alt;
      pie.textContent = total > 1 ? `Imagen ${indice + 1} de ${total}: ${producto.nombre}` : producto.nombre;
      botones.forEach((boton, i) => {
        const activo = i === indice;
        boton.setAttribute("aria-pressed", String(activo));
        boton.classList.toggle("border-elite-dark", activo);
        boton.classList.toggle("dark:border-elitenight-dark", activo);
        boton.classList.toggle("border-transparent", !activo);
      });
    }

    if (total > 1) {
      const lista = document.createElement("ul");
      lista.className = "mt-3 grid grid-cols-3 gap-2 s30:grid-cols-4";
      lista.setAttribute("aria-label", "Imágenes del producto");
      imagenes.forEach(({ src, alt }, indice) => {
        const li = document.createElement("li");
        const boton = document.createElement("button");
        boton.type = "button";
        boton.className =
          "block min-h-11 w-full overflow-hidden rounded-lg border-4 border-transparent bg-elite-tint p-0 dark:bg-elitenight-tint";
        boton.setAttribute("aria-label", `Ver imagen ${indice + 1} de ${total}: ${alt}`);
        boton.innerHTML = `<img class="aspect-[4/3] w-full object-cover" src="${src}" alt="" width="200" height="150" loading="lazy">`;
        boton.addEventListener("click", () => seleccionar(indice));
        boton.addEventListener("keydown", (evento) => {
          const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[evento.key];
          if (!paso) return;
          evento.preventDefault();
          const siguiente = (indice + paso + total) % total;
          botones[siguiente].focus();
          seleccionar(siguiente);
        });
        botones.push(boton);
        li.append(boton);
        lista.append(li);
      });
      figura.after(lista);
    }
    seleccionar(0);
  }

  // ---- Selector de variante (estilo tienda en línea) ----
  // Cada color es una variante y cada forma de venta una presentación (modelo de la
  // base). El selector muestra todas las opciones, marca las agotadas sin
  // esconderlas y limita la cantidad a lo que hay, descontando lo que ya está en
  // la lista de cotización.


  const CLASE_OPCION =
    "inline-flex min-h-11 items-center gap-2 rounded-lg border-2 border-elite-border bg-white px-3 py-1.5 text-elite-ink transition-colors peer-checked:border-elite-dark peer-checked:bg-elite-tint peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-elite-dark hover:border-elite-borderstrong dark:border-elitenight-border dark:bg-elitenight-bg dark:text-elitenight-text dark:peer-checked:border-elitenight-dark dark:peer-checked:bg-elitenight-tint";

  function crearOpcion({ nombre, valor, etiqueta, detalle, agotada, color, alElegir }) {
    const label = document.createElement("label");
    label.className = "cursor-pointer";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = nombre;
    input.value = valor;
    input.className = "peer sr-only";
    input.addEventListener("change", alElegir);
    const caja = document.createElement("span");
    caja.className = CLASE_OPCION + (agotada ? " opacity-70" : "");
    if (color !== undefined) {
      const punto = document.createElement("span");
      punto.setAttribute("aria-hidden", "true");
      punto.className = "h-5 w-5 shrink-0 rounded-full border border-elite-borderstrong dark:border-elitenight-border";
      punto.style.background = CatalogoCE.muestraColor(color);
      caja.append(punto);
    }
    const texto = document.createElement("span");
    texto.textContent = etiqueta;
    if (agotada) texto.className = "line-through";
    caja.append(texto);
    if (detalle) {
      const extra = document.createElement("span");
      extra.className = "text-sm text-elite-text dark:text-elitenight-text";
      extra.textContent = detalle;
      caja.append(extra);
    }
    label.append(input, caja);
    return { label, input };
  }

  // empresa: campo "empresa" de data/catalogo.json, la misma fuente del pie y de
  // Contacto (auditoría IHC, H5: antes el número y el correo estaban fijos aquí).
  function mostrarProducto(producto, todos, empresa, carritoInicial) {
    document.title = `${producto.nombre} — Comercial Elite`;
    const meta = document.getElementById("descripcionPagina");
    if (meta) {
      meta.setAttribute("content", `${producto.nombre}: ${producto.presentacion}. ${producto.uso}.`);
    }

    document.getElementById("migaProducto").textContent = producto.nombre;
    crearGaleria(producto);

    document.getElementById("nombreProducto").textContent = producto.nombre;
    document.getElementById("codigoProducto").textContent = producto.id;
    document.getElementById("coloresProducto").textContent = producto.colores.join(", ");
    document.getElementById("usoProducto").textContent = producto.uso;
    // Marca: opcional por producto; la fila aparece solo si la tiene
    if (producto.marca && !document.getElementById("marcaProducto")) {
      const filaUso = document.getElementById("usoProducto").parentElement;
      const fila = filaUso.cloneNode(true);
      fila.querySelector("dt").textContent = "Marca";
      const dd = fila.querySelector("dd");
      dd.id = "marcaProducto";
      dd.textContent = producto.marca;
      filaUso.before(fila);
    }

    const presentacionEl = document.getElementById("presentacionProducto");
    const precioEl = document.getElementById("precioProducto");
    const ofertaEl = document.getElementById("ofertaProducto");
    const estadoStock = document.getElementById("estadoStock");
    const estadoCarritoProducto = document.getElementById("estadoCarritoProducto");
    const campoCantidad = document.getElementById("cantidadProducto");
    const botonRestar = document.getElementById("botonRestarCantidad");
    const botonSumar = document.getElementById("botonSumarCantidad");
    const botonAgregarCarrito = document.getElementById("botonAgregarCarrito");
    const textoBotonAgregar = botonAgregarCarrito.querySelector(".texto-boton-carrito");
    const enlaceWhatsApp = document.getElementById("enlaceWhatsApp");
    const enlaceCorreo = document.getElementById("enlaceCorreo");

    const CLASE_BOTON_AGREGAR =
      "add-carrito inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accion px-6 font-bold text-accion-texto no-underline transition-colors hover:brightness-90 active:brightness-75 dark:bg-accion-noche dark:text-accion-nochetexto disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100";
    const CLASE_BOTON_AGREGADO =
      "add-carrito inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-elite-lime px-6 font-bold text-elite-ink no-underline transition-colors";

    const presentaciones = producto.presentaciones;
    const colores = [...new Set(presentaciones.map((p) => p.color))];
    // Cantidad de cada presentación que ya está en la lista de cotización
    let enCarrito = new Map();
    let seleccion = null;
    let mostrandoAgregado = false;

    // ---- Venta por pieza (cuero): bandas medidas, media banda y corte por pie² ----
    // Modelo de la base: cada banda es un lote con su área real, una línea de
    // venta sale de UNA sola pieza (los retazos no se juntan) y al despachar se
    // toma la pieza más pequeña que alcanza. Aquí se muestran esas piezas y se
    // aplica la MISMA regla al asignar y recomendar, para que lo que ve el
    // cliente coincida con lo que la base hará en el checkout.
    const porPieza = Boolean(producto.porPieza && producto.piezas);
    const UMBRAL_BANDA = 0.85; // desde esta proporción de la banda se sugiere llevarla completa
    const unidadCorta = producto.unidad?.codigo === "pie2" ? "pie²" : (producto.unidad?.nombre ?? "unidades");
    const esBanda = (pres) => /precio banda/i.test(pres.descripcion);
    // Lo que ya está en la lista por banda (unidad base): una banda tomada entera
    // desaparece de las opciones y una cortada muestra lo que le queda, SIN
    // bloquear las demás bandas (antes se bloqueaban todas).
    let usadoPorPieza = new Map();
    const piezasDe = (pres) =>
      (producto.piezas?.[pres.sku] ?? [])
        .map((p) => ({ ...p, saldo: Math.round((p.saldo - (usadoPorPieza.get(p.idLote) ?? 0)) * 1000) / 1000 }))
        .filter((p) => p.saldo > 0);
    const formatoCantidad = (n) => String(Math.round(n * 100) / 100);
    let modoPieza = "banda"; // "banda" (entera) | "media" | "pies"
    let bandaElegida = null;
    let fsModo = null;
    let fsBanda = null;
    let opcionesBanda = null;
    let notaPieza = null;

    const presentacionesDelColor = (color) => presentaciones.filter((p) => p.color === color);
    const presDetalDe = (color) => presentacionesDelColor(color).find((p) => !esBanda(p));
    const presBandaDe = (color) => presentacionesDelColor(color).find(esBanda);

    // Según el modo, deriva la cantidad (del saldo de la banda elegida) y la
    // presentación que corresponde: precio banda solo si llega a su mínimo.
    function ajustarPieza() {
      const piezas = piezasDe(seleccion);
      if (modoPieza === "pies") {
        seleccion = presDetalDe(seleccion.color) ?? seleccion;
        return;
      }
      bandaElegida = piezas.find((p) => p.idLote === bandaElegida?.idLote) ?? piezas[piezas.length - 1] ?? null;
      const saldo = bandaElegida?.saldo ?? 0;
      const detal = presDetalDe(seleccion.color);
      // El cuero se vende de 0.25 en 0.25 pie²: la media banda (y una banda con
      // medida rara) se redondea HACIA ABAJO al cuarto, nunca se entrega de más.
      const paso = detal?.incremento ?? 0.25;
      const aCuartos = (n) => Math.floor(n / paso + 1e-9) * paso;
      const cantidad = modoPieza === "banda" ? aCuartos(saldo) : aCuartos(saldo / 2);
      const banda = presBandaDe(seleccion.color);
      seleccion = banda && cantidad >= (banda.cantidadMinima ?? 1) ? banda : (detal ?? seleccion);
      if (cantidad > 0) campoCantidad.value = formatoCantidad(cantidad);
    }

    function pintarNotaPieza() {
      const cantidad = leerCantidad();
      const piezas = piezasDe(seleccion);
      const total = ` Total aprox.: $${(cantidad * seleccion.precio).toFixed(2)}.`;
      if (modoPieza === "pies") {
        const pieza = piezas.find((p) => p.saldo >= cantidad);
        if (pieza) {
          notaPieza.textContent =
            `Tu corte de ${formatoCantidad(cantidad)} ${unidadCorta} sale de la banda más pequeña que alcanza ` +
            `(${formatoCantidad(pieza.saldo)} ${unidadCorta}; quedarían ${formatoCantidad(pieza.saldo - cantidad)}).` +
            total;
        } else if (piezas.length > 0) {
          notaPieza.textContent =
            `Ninguna banda alcanza para ${formatoCantidad(cantidad)} ${unidadCorta}: la mayor tiene ` +
            `${formatoCantidad(piezas[piezas.length - 1].saldo)} (los retazos de piezas distintas no se juntan).`;
        } else {
          notaPieza.textContent = "";
        }
      } else if (bandaElegida) {
        notaPieza.textContent =
          (modoPieza === "banda"
            ? `Banda completa de ${formatoCantidad(bandaElegida.saldo)} ${unidadCorta} a precio banda.`
            : `Media banda: ${formatoCantidad(cantidad)} ${unidadCorta} de la banda de ` +
              `${formatoCantidad(bandaElegida.saldo)} ${unidadCorta}` +
              (esBanda(seleccion) ? " a precio banda." : " (va al detal: no llega al mínimo del precio banda).")) + total;
      } else {
        notaPieza.textContent = "";
      }
    }

    // Chips de bandas + bloqueo de la cantidad cuando la fija la banda elegida
    function pintarPiezaUI() {
      const piezas = piezasDe(seleccion);
      opcionesBanda.innerHTML = "";
      piezas.forEach((pieza) => {
        const { label, input } = crearOpcion({
          nombre: "bandaPieza",
          valor: pieza.codigo ?? formatoCantidad(pieza.saldo),
          etiqueta: `${formatoCantidad(pieza.saldo)} ${unidadCorta}`,
          alElegir: () => {
            bandaElegida = pieza;
            elegir(seleccion);
          },
        });
        input.checked = pieza.idLote === bandaElegida?.idLote;
        opcionesBanda.append(label);
      });
      fsBanda.hidden = modoPieza === "pies" || piezas.length === 0;
      if (modoPieza !== "pies") {
        campoCantidad.disabled = true;
        botonRestar.disabled = true;
        botonSumar.disabled = true;
      }
      pintarNotaPieza();
    }

    // Recomendación al agregar un corte por pies: con la banda más pequeña que
    // alcanza, si el corte llega al umbral de su tamaño conviene la banda
    // completa (más material a mejor precio). Si el cliente no quiere, se evalúa
    // la siguiente banda con la misma lógica.
    function recomendarBanda(cantidad) {
      if (!porPieza || modoPieza !== "pies") return Promise.resolve(null);
      const presBanda = presBandaDe(seleccion.color);
      if (!presBanda) return Promise.resolve(null);
      const alcanzan = piezasDe(seleccion).filter((p) => p.saldo >= cantidad);
      const detal = seleccion;
      return new Promise((resolver) => {
        const evaluar = (i) => {
          if (i >= alcanzan.length) return resolver(null);
          const pieza = alcanzan[i];
          if (cantidad < UMBRAL_BANDA * pieza.saldo) return resolver(null);
          abrirDialogoBanda({ pieza, cantidad, detal, presBanda }).then((acepta) =>
            acepta ? resolver({ pieza, pres: presBanda }) : evaluar(i + 1)
          );
        };
        evaluar(0);
      });
    }

    // Mensaje emergente accesible (dialog modal). Nodos + textContent, nada de
    // innerHTML con datos de la base.
    function abrirDialogoBanda({ pieza, cantidad, detal, presBanda }) {
      return new Promise((resolver) => {
        const costoCorte = cantidad * detal.precio;
        const costoBanda = pieza.saldo * presBanda.precio;
        const diferencia = costoBanda - costoCorte;
        const extra = pieza.saldo - cantidad;

        const dialogo = document.createElement("dialog");
        dialogo.className =
          "w-[min(28rem,92vw)] rounded-lg border border-elite-border bg-white p-6 text-elite-text shadow-xl backdrop:bg-black/50 dark:border-elitenight-border dark:bg-elitenight-bg dark:text-elitenight-text";

        const titulo = document.createElement("h2");
        titulo.className = "mt-0 mb-3 text-xl font-bold text-elite-dark dark:text-elitenight-dark";
        titulo.textContent = "¿Mejor la banda completa?";

        const parrafo = document.createElement("p");
        parrafo.className = "mb-2";
        parrafo.textContent =
          `Tu corte de ${formatoCantidad(cantidad)} ${unidadCorta} saldría de la banda de ` +
          `${formatoCantidad(pieza.saldo)} ${unidadCorta} y la dejaría en solo ${formatoCantidad(extra)} ${unidadCorta}.`;

        const comparacion = document.createElement("p");
        comparacion.className = "mb-2";
        comparacion.textContent =
          `La banda completa a precio banda cuesta $${costoBanda.toFixed(2)} ` +
          `($${presBanda.precio.toFixed(2)}/${unidadCorta}); tu corte al detal, $${costoCorte.toFixed(2)} ` +
          `($${detal.precio.toFixed(2)}/${unidadCorta}).`;

        const veredicto = document.createElement("p");
        veredicto.className = "mb-4 font-semibold";
        veredicto.textContent =
          diferencia <= 0
            ? `Te ahorras $${Math.abs(diferencia).toFixed(2)} y te llevas ${formatoCantidad(extra)} ${unidadCorta} más.`
            : `Por $${diferencia.toFixed(2)} más te llevas ${formatoCantidad(extra)} ${unidadCorta} adicionales a mejor precio por ${unidadCorta}.`;

        const botones = document.createElement("div");
        botones.className = "flex flex-wrap justify-end gap-3";
        const mantener = document.createElement("button");
        mantener.type = "button";
        mantener.className =
          "inline-flex min-h-11 items-center rounded-lg border-2 border-elite-borderstrong bg-white px-4 font-bold text-elite-ink dark:border-elitenight-border dark:bg-elitenight-bg dark:text-elitenight-text";
        mantener.textContent = `Mantener ${formatoCantidad(cantidad)} ${unidadCorta}`;
        mantener.addEventListener("click", () => dialogo.close("corte"));
        const llevar = document.createElement("button");
        llevar.type = "button";
        llevar.className =
          "inline-flex min-h-11 items-center rounded-lg bg-accion px-4 font-bold text-accion-texto dark:bg-accion-noche dark:text-accion-nochetexto";
        llevar.textContent = `Llevar la banda completa (${formatoCantidad(pieza.saldo)} ${unidadCorta})`;
        llevar.addEventListener("click", () => dialogo.close("banda"));
        botones.append(mantener, llevar);

        dialogo.append(titulo, parrafo, comparacion, veredicto, botones);
        dialogo.addEventListener("close", () => {
          resolver(dialogo.returnValue === "banda");
          dialogo.remove();
        });
        document.body.append(dialogo);
        dialogo.showModal();
      });
    }

    // Construcción del módulo (solo productos por pieza, con API)
    if (porPieza) {
      const fsPres = document.getElementById("selectorPresentacion");

      fsModo = document.createElement("fieldset");
      fsModo.className = "mb-4 border-0 p-0";
      fsModo.id = "selectorModoPieza";
      const leyendaModo = document.createElement("legend");
      leyendaModo.className = "mb-2 font-bold";
      leyendaModo.textContent = "¿Cómo lo quieres?";
      const opcionesModo = document.createElement("div");
      opcionesModo.className = "flex flex-wrap gap-2";
      [
        ["banda", "Banda entera"],
        ["media", "Media banda"],
        ["pies", `Por ${unidadCorta}`],
      ].forEach(([valor, etiqueta]) => {
        const { label, input } = crearOpcion({
          nombre: "modoPieza",
          valor,
          etiqueta,
          alElegir: () => {
            modoPieza = valor;
            // al pasar a pie² se arranca en el mínimo del precio al detal (1), no en el del precio banda
            if (valor === "pies") campoCantidad.value = String(presDetalDe(seleccion.color)?.cantidadMinima ?? 1);
            elegir(seleccion);
          },
        });
        input.checked = valor === modoPieza;
        opcionesModo.append(label);
      });
      fsModo.append(leyendaModo, opcionesModo);

      fsBanda = document.createElement("fieldset");
      fsBanda.className = "mb-4 border-0 p-0";
      fsBanda.id = "selectorBanda";
      const leyendaBanda = document.createElement("legend");
      leyendaBanda.className = "mb-2 font-bold";
      leyendaBanda.textContent = `Bandas disponibles (${unidadCorta} de cada una)`;
      opcionesBanda = document.createElement("div");
      opcionesBanda.id = "opcionesBanda";
      opcionesBanda.className = "flex flex-wrap gap-2";
      fsBanda.append(leyendaBanda, opcionesBanda);
      fsPres.after(fsModo, fsBanda);

      notaPieza = document.createElement("p");
      notaPieza.className = "mb-3 text-sm empty:hidden";
      notaPieza.id = "notaPieza";
      estadoStock.after(notaPieza);

      const notaPrecio = document.getElementById("notaPrecio");
      if (notaPrecio) {
        notaPrecio.textContent = `Precio por ${unidadCorta}, IVA incluido. El valor final se confirma en la cotización.`;
      }
    }

    function leerCarrito(carrito) {
      enCarrito = new Map();
      usadoPorPieza = new Map();
      carrito.items.forEach((i) => {
        const clave = String(i.idPresentacion);
        enCarrito.set(clave, (enCarrito.get(clave) ?? 0) + i.cantidad);
        if (i.pieza) {
          const factor = presentaciones.find((x) => String(x.id) === clave)?.factor ?? 1;
          usadoPorPieza.set(i.pieza, (usadoPorPieza.get(i.pieza) ?? 0) + i.cantidad * factor);
        }
      });
    }
    leerCarrito(carritoInicial);

    // Lo que todavía se puede agregar de una presentación (null = sin control de stock)
    function restante(pres) {
      if (pres.disponible == null) return null;
      // Por pieza: lo máximo de una línea es lo que le queda a la banda más grande
      if (porPieza) {
        const mayor = Math.max(0, ...piezasDe(pres).map((p) => p.saldo)) / (pres.factor ?? 1);
        const paso = pasoDe(pres); // en cuartos de pie², no en enteros
        return Math.round(Math.floor(mayor / paso + 1e-9) * paso * 1000) / 1000;
      }
      return Math.max(0, pres.disponible - (enCarrito.get(String(pres.id)) ?? 0));
    }
    const sumaDisponible = (lista) =>
      lista.some((p) => p.disponible == null) ? null : lista.reduce((s, p) => s + p.disponible, 0);

    // Cada presentación se vende en múltiplos de su incremento (lo dice la base):
    // el cuero por pie² va de 0.25 en 0.25 (1, 1.25, 1.5, 1.75...), lo demás en
    // enteros. Lo que se escriba se lleva al múltiplo más cercano.
    const pasoDe = (pres) => pres?.incremento ?? 1;
    function leerCantidad() {
      const paso = pasoDe(seleccion);
      const minimo = Math.max(Number.parseFloat(campoCantidad.min) || paso, paso);
      const valor = Number.parseFloat(campoCantidad.value);
      if (!Number.isFinite(valor) || valor <= 0) return minimo;
      const multiplo = Math.round(Math.round(valor / paso) * paso * 1000) / 1000;
      return Math.max(minimo, multiplo);
    }

    function pintarBoton() {
      if (mostrandoAgregado) return;
      const quedan = restante(seleccion);
      const sinStock = seleccion.disponible === 0;
      const todoEnLista = quedan === 0 && !sinStock;
      botonAgregarCarrito.className = CLASE_BOTON_AGREGAR;
      botonAgregarCarrito.disabled = quedan === 0;
      textoBotonAgregar.textContent = sinStock
        ? "Agotado"
        : todoEnLista
          ? "Ya está todo en tu lista"
          : "Agregar a la cotización";
    }

    function pintarSeleccion() {
      const pres = seleccion;
      document.getElementById("colorElegido").textContent = pres.color ?? "";
      document.getElementById("presentacionElegida").textContent = pres.descripcion;
      presentacionEl.textContent = pres.descripcion;
      precioEl.textContent = porPieza ? `$${pres.precio.toFixed(2)} / ${unidadCorta}` : `$${pres.precio.toFixed(2)}`;
      if (pres.precioSinOferta) {
        ofertaEl.hidden = false;
        ofertaEl.textContent = `Antes $${pres.precioSinOferta.toFixed(2)} · ${pres.oferta.porcentaje} % de descuento por oferta`;
      } else {
        ofertaEl.hidden = true;
      }

      // Existencias: lo que hay en la base menos lo que ya está en la lista
      const quedan = restante(pres);
      const enLista = enCarrito.get(String(pres.id)) ?? 0;
      if (quedan === null) {
        estadoStock.textContent = "";
      } else if (pres.disponible === 0) {
        estadoStock.className = "mb-3 font-semibold text-error dark:text-error-dark";
        estadoStock.textContent = pres.color ? `Agotado en color ${pres.color}.` : "Agotado.";
      } else if (quedan === 0) {
        estadoStock.className = "mb-3 font-semibold text-elite-cuero dark:text-elitenight-cuero";
        estadoStock.textContent = porPieza
          ? `Ya tienes en tu lista los ${formatoCantidad(pres.disponible)} ${unidadCorta} que se pueden pedir de una pieza.`
          : `Ya tienes en tu lista las ${pres.disponible} unidades disponibles.`;
      } else if (porPieza) {
        const piezas = piezasDe(pres);
        const totalPiezas = piezas.reduce((suma, pieza) => suma + pieza.saldo, 0);
        const pocas = piezas.length <= 3;
        estadoStock.className = pocas
          ? "mb-3 font-semibold text-elite-cuero dark:text-elitenight-cuero"
          : "mb-3 font-semibold text-elite-dark dark:text-elitenight-dark";
        const base = `${piezas.length} ${piezas.length === 1 ? "banda" : "bandas"} en stock · ${formatoCantidad(totalPiezas)} ${unidadCorta} en total.`;
        estadoStock.textContent =
          enLista > 0 ? `${base} (${formatoCantidad(enLista)} ${unidadCorta} ya en tu lista)` : base;
      } else {
        const pocas = pres.disponible <= 5;
        estadoStock.className = pocas
          ? "mb-3 font-semibold text-elite-cuero dark:text-elitenight-cuero"
          : "mb-3 font-semibold text-elite-dark dark:text-elitenight-dark";
        const base = pocas ? `¡Solo quedan ${pres.disponible}!` : `En stock: ${pres.disponible} disponibles.`;
        estadoStock.textContent = enLista > 0 ? `${base} (${enLista} ya en tu lista)` : base;
      }

      // Cantidad acotada a lo que se puede agregar
      if (quedan === null) campoCantidad.removeAttribute("max");
      else campoCantidad.max = String(Math.max(1, quedan));
      campoCantidad.min = String(pres.cantidadMinima ?? 1);
      campoCantidad.step = String(pasoDe(pres));
      const unidadPaso = pasoDe(pres) === 1 ? "una unidad" : `${pasoDe(pres)} ${porPieza ? unidadCorta : "unidades"}`;
      botonRestar.setAttribute("aria-label", `Restar ${unidadPaso}`);
      botonSumar.setAttribute("aria-label", `Sumar ${unidadPaso}`);
      if (quedan !== null && leerCantidad() > quedan) campoCantidad.value = String(Math.max(1, quedan));
      const bloqueado = quedan === 0;
      campoCantidad.disabled = bloqueado;
      botonRestar.disabled = bloqueado;
      botonSumar.disabled = bloqueado || (quedan !== null && leerCantidad() >= quedan);
      pintarBoton();
      if (porPieza) pintarPiezaUI();

      // WhatsApp/correo cotizan exactamente lo elegido (color y talla incluidos)
      const detalleVariante = [pres.color, tallaDe(pres) ? `talla ${tallaDe(pres)}` : null]
        .filter(Boolean)
        .join(", ");
      const variante = detalleVariante ? ` (${detalleVariante})` : "";
      enlaceWhatsApp.href = `https://wa.me/${empresa.telefono.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hola, quiero cotizar el producto ${producto.id} - ${producto.nombre}${variante}, ${pres.descripcion}.`
      )}`;
      const asunto = encodeURIComponent(`Cotización ${producto.id} — ${producto.nombre}${variante}`);
      const cuerpo = encodeURIComponent(
        `Hola,\n\nQuisiera solicitar una cotización para:\n\nProducto: ${producto.nombre}\nCódigo: ${producto.id}\n` +
          `${pres.color ? `Color: ${pres.color}\n` : ""}${tallaDe(pres) ? `Talla: ${tallaDe(pres)}\n` : ""}` +
          `Presentación: ${pres.descripcion}\n\nGracias.`
      );
      enlaceCorreo.href = `mailto:${empresa.correo}?subject=${asunto}&body=${cuerpo}`;
    }

    // Opciones de presentación del color elegido (solo se muestran si hay más de una)
    function pintarPresentaciones(color) {
      const fieldset = document.getElementById("selectorPresentacion");
      // Por pieza, la presentación (detal o precio banda) la deriva el modo de
      // compra: el selector clásico sobra.
      if (porPieza) {
        fieldset.hidden = true;
        return;
      }
      // Con tallas, las formas de venta que se comparan son las de la talla elegida
      const delColor = presentaciones.filter(
        (p) => p.color === color && (!conTallas || tallaDe(p) === tallaDe(seleccion))
      );
      const contenedor = document.getElementById("opcionesPresentacion");
      contenedor.innerHTML = "";
      fieldset.hidden = delColor.length < 2;
      delColor.forEach((pres) => {
        const { label, input } = crearOpcion({
          nombre: "presentacion",
          valor: String(pres.id),
          etiqueta: pres.descripcion,
          detalle: `$${pres.precio.toFixed(2)}${pres.disponible === 0 ? " · agotado" : ""}`,
          agotada: pres.disponible === 0,
          alElegir: () => elegir(pres),
        });
        input.checked = pres === seleccion;
        contenedor.append(label);
      });
    }

    function elegir(pres) {
      seleccion = pres;
      // Por pieza, el modo de compra puede cambiar la presentación (detal o
      // precio banda) y fijar la cantidad desde la banda elegida
      if (porPieza) ajustarPieza();
      pintarPresentaciones(seleccion.color);
      pintarTallas(seleccion.color);
      const radioColor = document.querySelector(`#opcionesColor input[value="${CSS.escape(String(seleccion.color))}"]`);
      if (radioColor) radioColor.checked = true;
      pintarSeleccion();
    }

    // ---- Tallas (suelas y plantillas): atributo "Talla" de la base ----
    // Cada color x talla es una variante con su propio stock; el selector se
    // arma desde las características, igual que el de color.
    const tallaDe = (pres) => pres.caracteristicas?.Talla ?? null;
    const conTallas = presentaciones.some((p) => tallaDe(p));
    const tallasDe = (color) =>
      [...new Set(presentaciones.filter((p) => p.color === color).map(tallaDe).filter(Boolean))].sort(
        (a, b) => Number(a) - Number(b) || String(a).localeCompare(b, "es")
      );
    let opcionesTalla = null;
    let tallaElegidaEl = null;
    if (conTallas) {
      const fsTalla = document.createElement("fieldset");
      fsTalla.className = "mb-4 border-0 p-0";
      fsTalla.id = "selectorTalla";
      const leyenda = document.createElement("legend");
      leyenda.className = "mb-2 font-bold";
      tallaElegidaEl = document.createElement("span");
      tallaElegidaEl.className = "font-normal";
      leyenda.append("Talla: ", tallaElegidaEl);
      opcionesTalla = document.createElement("div");
      opcionesTalla.id = "opcionesTalla";
      opcionesTalla.className = "flex flex-wrap gap-2";
      fsTalla.append(leyenda, opcionesTalla);
      document.getElementById("selectorColor").after(fsTalla);
    }

    function pintarTallas(color) {
      if (!conTallas) return;
      opcionesTalla.innerHTML = "";
      tallasDe(color).forEach((talla) => {
        const deLaTalla = presentaciones.filter((p) => p.color === color && tallaDe(p) === talla);
        const disponible = sumaDisponible(deLaTalla);
        const { label, input } = crearOpcion({
          nombre: "talla",
          valor: talla,
          etiqueta: talla,
          detalle: disponible === 0 ? "(agotada)" : "",
          agotada: disponible === 0,
          alElegir: () => {
            elegir(deLaTalla.find((p) => p.disponible !== 0) ?? deLaTalla[0]);
          },
        });
        input.checked = tallaDe(seleccion) === talla;
        opcionesTalla.append(label);
      });
      tallaElegidaEl.textContent = tallaDe(seleccion) ?? "";
    }

    // Opciones de color, en el orden del catálogo; las agotadas se ven pero tachadas
    const fieldsetColor = document.getElementById("selectorColor");
    const opcionesColor = document.getElementById("opcionesColor");
    fieldsetColor.hidden = colores.length === 0 || (colores.length === 1 && colores[0] == null);
    colores.forEach((color) => {
      const delColor = presentaciones.filter((p) => p.color === color);
      const disponible = sumaDisponible(delColor);
      const { label } = crearOpcion({
        nombre: "color",
        valor: String(color),
        etiqueta: color ?? "Único",
        detalle: disponible === 0 ? "(agotado)" : "",
        agotada: disponible === 0,
        color,
        alElegir: () => {
          // Al cambiar de color se mantiene la misma forma de venta (y talla) si existe
          const misma = delColor.find(
            (p) =>
              p.descripcion === seleccion?.descripcion &&
              (!conTallas || tallaDe(p) === tallaDe(seleccion))
          );
          elegir(misma ?? delColor.find((p) => p.disponible !== 0) ?? delColor[0]);
        },
      });
      opcionesColor.append(label);
    });

    // Selección inicial: el color de la URL (?color=) o la primera opción con stock
    const colorPedido = new URLSearchParams(window.location.search).get("color");
    elegir(
      presentaciones.find((p) => p.color === colorPedido) ??
        presentaciones.find((p) => p.disponible !== 0) ??
        presentaciones[0]
    );

    // Los botones suben y bajan de a un incremento (un cuarto de pie² en el cuero)
    const redondear3 = (n) => Math.round(n * 1000) / 1000;
    botonRestar.addEventListener("click", () => {
      campoCantidad.value = Math.max(Number(campoCantidad.min) || 1, redondear3(leerCantidad() - pasoDe(seleccion)));
      pintarSeleccion();
    });
    botonSumar.addEventListener("click", () => {
      const quedan = restante(seleccion);
      const siguiente = redondear3(leerCantidad() + pasoDe(seleccion));
      campoCantidad.value = quedan === null ? siguiente : Math.min(quedan, siguiente);
      pintarSeleccion();
    });
    campoCantidad.addEventListener("change", () => {
      campoCantidad.value = leerCantidad();
      pintarSeleccion();
    });

    // Si la lista cambia (otra pestaña de esta página, o el propio agregado), se
    // recalcula lo que queda disponible para agregar.
    document.addEventListener("ce:carrito-actualizado", (evento) => {
      leerCarrito(evento.detail);
      // Por pieza, la banda que se acaba de tomar sale de las opciones: se vuelve
      // a elegir (la misma si le queda algo, si no la mayor libre) y su cantidad.
      if (porPieza) elegir(seleccion);
      else pintarSeleccion();
    });

    botonAgregarCarrito.addEventListener("click", () => {
      const cantidadPedida = leerCantidad();
      campoCantidad.value = cantidadPedida;

      // Corte por pies: antes de agregar, la recomendación de la banda completa
      // (mismo criterio con el que la base despacha: la pieza más pequeña que alcanza)
      recomendarBanda(cantidadPedida).then((mejor) => {
      const pres = mejor ? mejor.pres : seleccion;
      const cantidad = mejor ? mejor.pieza.saldo : cantidadPedida;
      const detalleVariante = [pres.color, tallaDe(pres) ? `talla ${tallaDe(pres)}` : null]
        .filter(Boolean)
        .join(", ");
      const variante = detalleVariante ? ` (${detalleVariante})` : "";

      // En banda entera o media banda se manda la banda elegida: queda reservada
      // en el pedido. Por pie², la base toma la más pequeña libre que alcance.
      const pieza = mejor ? mejor.pieza.idLote : porPieza && modoPieza !== "pies" ? bandaElegida?.idLote : null;
      CarritoCE.agregar(pres.id, cantidad, pieza)
        .then(() => {
          estadoCarritoProducto.className = "mb-3 empty:hidden text-sm text-elite-dark dark:text-elitenight-dark";
          estadoCarritoProducto.textContent = porPieza
            ? `Se agregó ${formatoCantidad(cantidad)} ${unidadCorta} de ${producto.nombre}${variante}` +
              `${mejor ? " (banda completa a precio banda)" : ""} a tu lista de cotización.`
            : `Se agregó ${cantidad} × ${producto.nombre}${variante} a tu lista de cotización.`;
          if (!porPieza) campoCantidad.value = "1";

          // Retroalimentación inmediata junto al botón: cambia a lima + "✓ Agregado"
          // un instante, además del texto en estadoCarritoProducto (WCAG 1.4.1: el
          // texto es lo que confirma la acción, el color es solo refuerzo visual).
          mostrandoAgregado = true;
          botonAgregarCarrito.className = CLASE_BOTON_AGREGADO;
          textoBotonAgregar.textContent = "✓ Agregado";
          window.clearTimeout(botonAgregarCarrito._temporizadorConfirmacion);
          botonAgregarCarrito._temporizadorConfirmacion = window.setTimeout(() => {
            mostrandoAgregado = false;
            pintarSeleccion();
          }, 1400);
          pintarSeleccion();
        })
        .catch((error) => {
          estadoCarritoProducto.className = "mb-3 empty:hidden text-sm text-error dark:text-error-dark";
          estadoCarritoProducto.textContent = error.mensaje ?? "No se pudo agregar a la lista.";
          // Las existencias pudieron cambiar: se vuelve a leer la lista
          CarritoCE.obtener().then((carrito) => {
            leerCarrito(carrito);
            pintarSeleccion();
          });
        });
      });
    });

    // ---- Cortes estándar (fibra de caucho en planchas) ----
    // La fibra solo se vende en piezas de medida fija (plancha 24, ½ 12, ¼ 6,
    // 2 pies y 1 pie). Si el cliente necesita una medida que no es un corte
    // (3 pies), se le arma la combinación MÁS BARATA de cortes que suma
    // exacto (2 + 1). Si una pieza mayor cuesta lo mismo o casi, se le avisa.
    // La base corta la plancha en cascada al confirmar el pedido.
    if (producto.cortesEstandar && !document.getElementById("calculadoraCortes")) {
      const UMBRAL_PIEZA = 0.85; // desde aquí se sugiere la pieza entera mayor
      const dinero = (n) => `$${n.toFixed(2)}`;
      const unidadCortes = producto.unidad?.codigo === "pie2" ? "pie²" : "unidades";
      // Rama de PIES del arbol de cortes: la pieza de 1 pie y las que la contienen
      // (2 pies -> 1/2 plancha -> plancha). Los cuartos y octavos son la otra
      // forma de medida (fracciones de plancha) y no se mezclan con los pies.
      const ramaPies = (lista) => {
        const porFactor = new Map(lista.map((p) => [p.factor, p]));
        const nodos = new Set();
        let actual = Math.min(...lista.map((p) => p.factor).filter((f) => Number.isInteger(f)));
        while (Number.isFinite(actual) && porFactor.has(actual) && !nodos.has(actual)) {
          nodos.add(actual);
          actual = porFactor.get(actual).corteDe ?? NaN;
        }
        // sin arbol definido (corteDe vacio): todas las medidas valen
        return lista.some((p) => p.corteDe) ? lista.filter((p) => nodos.has(p.factor)) : lista;
      };
      const cortesDelColor = () =>
        ramaPies(presentaciones.filter((p) => p.color === seleccion?.color))
          .filter((p) => p.disponible > 0)
          .sort((a, b) => b.factor - a.factor);

      // Mínimo costo para sumar EXACTO n (mochila sin límite; a igual precio,
      // menos piezas). Los factores son enteros y pocos: n × cortes pasos.
      function combinar(n, cortes) {
        const costo = new Array(n + 1).fill(Infinity);
        const piezas = new Array(n + 1).fill(Infinity);
        const desde = new Array(n + 1).fill(null);
        costo[0] = 0;
        piezas[0] = 0;
        for (let m = 1; m <= n; m++) {
          for (const c of cortes) {
            if (c.factor > m || costo[m - c.factor] === Infinity) continue;
            const total = Math.round((costo[m - c.factor] + c.precio) * 100) / 100;
            const cuantas = piezas[m - c.factor] + 1;
            if (total < costo[m] || (total === costo[m] && cuantas < piezas[m])) {
              costo[m] = total;
              piezas[m] = cuantas;
              desde[m] = c;
            }
          }
        }
        if (costo[n] === Infinity) return null;
        const conteo = new Map();
        for (let m = n; m > 0; m -= desde[m].factor) conteo.set(desde[m], (conteo.get(desde[m]) ?? 0) + 1);
        const lineas = [...conteo].map(([pres, cantidad]) => ({ pres, cantidad }));
        return { lineas, total: costo[n] };
      }

      const crear = (etiqueta, props = {}) => Object.assign(document.createElement(etiqueta), props);
      const caja = crear("section", {
        id: "calculadoraCortes",
        className:
          "mb-4 rounded-lg border border-elite-border bg-elite-tint px-3 py-3 dark:border-elitenight-border dark:bg-elitenight-tint",
      });
      caja.setAttribute("aria-labelledby", "tituloCortes");
      const titulo = crear("h2", { id: "tituloCortes", className: "mb-1 text-base font-bold", textContent: "¿Cuánta fibra necesitas?" });
      const ayuda = crear("p", {
        id: "ayudaCortes",
        className: "mb-2 text-sm",
        textContent: "Se vende en cortes fijos. Escribe los pies que necesitas y te armamos la combinación más barata de plancha, media plancha y cortes en pies. Los cuartos y octavos de plancha se eligen en Presentación.",
      });
      const fila = crear("div", { className: "flex flex-wrap items-end gap-2" });
      const etiqueta = crear("label", { htmlFor: "piesNecesarios", className: "flex flex-col text-sm font-semibold", textContent: "Pie² que necesitas" });
      const campo = crear("input", {
        id: "piesNecesarios",
        type: "number",
        inputMode: "numeric",
        min: "1",
        step: "1",
        value: "3",
        className:
          "mt-1 min-h-11 w-28 rounded-lg border-2 border-elite-borderstrong bg-white px-2 text-elite-ink dark:border-elitenight-border dark:bg-elitenight-bg dark:text-elitenight-text",
      });
      campo.setAttribute("aria-describedby", "ayudaCortes errorCortes");
      etiqueta.append(campo);
      const calcular = crear("button", {
        type: "button",
        id: "botonCalcularCortes",
        className:
          "min-h-11 rounded-lg border-2 border-elite-borderstrong bg-white px-4 font-bold text-elite-ink dark:border-elitenight-border dark:bg-elitenight-bg dark:text-elitenight-text",
        textContent: "Calcular cortes",
      });
      fila.append(etiqueta, calcular);
      const error = crear("p", { id: "errorCortes", className: "mb-0 mt-2 text-sm font-semibold text-error empty:hidden dark:text-error-dark" });
      const resultado = crear("div", { id: "resultadoCortes", className: "mt-2 text-sm" });
      resultado.setAttribute("role", "status");
      resultado.setAttribute("aria-live", "polite");
      caja.append(titulo, ayuda, fila, error, resultado);
      document.getElementById("selectorPresentacion").after(caja);

      const texto = (lineas) => lineas.map(({ pres, cantidad }) => `${cantidad} × ${pres.descripcion}`).join(" + ");

      function botonAgregar(rotulo, lineas) {
        const b = crear("button", {
          type: "button",
          className:
            "mt-2 mr-2 min-h-11 rounded-lg bg-accion px-4 font-bold text-accion-texto hover:brightness-90 dark:bg-accion-noche dark:text-accion-nochetexto",
          textContent: rotulo,
        });
        b.addEventListener("click", async () => {
          b.disabled = true;
          try {
            // en orden: si una falla, las anteriores ya quedaron y el mensaje lo dice
            for (const { pres, cantidad } of lineas) await CarritoCE.agregar(pres.id, cantidad);
            estadoCarritoProducto.className = "mb-3 empty:hidden text-sm text-elite-dark dark:text-elitenight-dark";
            estadoCarritoProducto.textContent = `Se agregó ${texto(lineas)} de ${producto.nombre} (${seleccion.color}) a tu lista de cotización.`;
          } catch (e) {
            estadoCarritoProducto.className = "mb-3 empty:hidden text-sm text-error dark:text-error-dark";
            estadoCarritoProducto.textContent = e.mensaje ?? "No se pudo agregar a la lista.";
          } finally {
            b.disabled = false;
          }
        });
        return b;
      }

      function calcularCortes() {
        resultado.replaceChildren();
        error.textContent = "";
        campo.removeAttribute("aria-invalid");
        if (!/^[1-9]\d{0,3}$/.test(campo.value.trim())) {
          error.textContent = "Escribe una cantidad entera de pie², de 1 a 9999.";
          campo.setAttribute("aria-invalid", "true");
          campo.focus();
          return;
        }
        const n = Number(campo.value);
        const cortes = cortesDelColor();
        // lo que hay en total: el corte más chico cuenta todos los pie² libres
        const libres = cortes.reduce((s, c) => Math.max(s, c.disponible * c.factor), 0);
        const combo = cortes.length > 0 && n <= libres ? combinar(n, cortes) : null;
        if (!combo) {
          error.textContent = `No hay fibra ${String(seleccion?.color ?? "").toLowerCase()} suficiente para ${n} ${unidadCortes}.`;
          return;
        }
        const p = crear("p", { className: "mb-0" });
        const fuerte = crear("strong", { textContent: texto(combo.lineas) });
        p.append("Te recomendamos ", fuerte, ` = ${n} ${unidadCortes} por ${dinero(combo.total)}.`);
        resultado.append(p, botonAgregar("Agregar estos cortes", combo.lineas));

        // ¿Una sola pieza mayor sale igual o casi? (la siguiente medida que alcanza)
        const mayor = [...cortes].reverse().find((c) => c.factor > n);
        if (mayor && (mayor.precio <= combo.total || n / mayor.factor >= UMBRAL_PIEZA)) {
          const diferencia = Math.round((mayor.precio - combo.total) * 100) / 100;
          const sugerencia = crear("p", {
            className: "mb-0 mt-2",
            textContent:
              diferencia <= 0
                ? `Mejor aún: ${mayor.descripcion} cuesta ${dinero(mayor.precio)}, ${dinero(-diferencia)} menos, y llevas ${mayor.factor - n} ${unidadCortes} más.`
                : `Por ${dinero(diferencia)} más llevas ${mayor.descripcion} (${mayor.factor - n} ${unidadCortes} más).`,
          });
          resultado.append(sugerencia, botonAgregar(`Agregar ${mayor.descripcion}`, [{ pres: mayor, cantidad: 1 }]));
        }
      }
      calcular.addEventListener("click", calcularCortes);
      campo.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          calcularCortes();
        }
      });
    }

    // ---- Descuento por volumen (suelas, plantillas...) ----
    // Lo calcula y aplica la base al crear el pedido, sumando todas las tallas y
    // colores del producto; aquí solo se anuncia para que el cliente lo sepa.
    const plural = (palabra) => (/[aeiouáéíóú]$/i.test(palabra) ? `${palabra}s` : `${palabra}es`);
    if (producto.descuentosVolumen?.length > 0 && !document.getElementById("avisoVolumen")) {
      const aviso = document.createElement("p");
      aviso.id = "avisoVolumen";
      aviso.className =
        "mb-4 rounded-lg border border-elite-border bg-elite-tint px-3 py-2 text-sm dark:border-elitenight-border dark:bg-elitenight-tint";
      const fuerte = document.createElement("strong");
      fuerte.textContent = "Descuento por volumen: ";
      const escalones = producto.descuentosVolumen
        .map((regla) => `${regla.porcentaje} % desde ${regla.desde} ${plural(String(regla.unidad ?? "unidad").toLowerCase())}`)
        .join(" · ");
      aviso.append(fuerte, `${escalones}, sumando todas las tallas y colores. Se aplica solo en tu lista.`);
      document.getElementById("notaPrecio").after(aviso);
    }

    // ---- Combos que incluyen este producto (ej. 1 m de cierre + 2 llaves) ----
    // Un combo es una receta de presentaciones de la base: al agregarlo entra
    // como sus líneas reales (con su precio vigente y validación de stock), en
    // una sola transacción. Solo con API; sin combos, la sección no aparece.
    if (CarritoCE.agregarCombo) {
      CatalogoCE.combosDe(producto.id)
        .then((combos) => {
          if (combos.length === 0) return;
          const seccion = document.createElement("section");
          seccion.className = "mt-6 rounded-lg border border-elite-border p-4 dark:border-elitenight-border";
          seccion.id = "seccionCombos";
          seccion.setAttribute("aria-labelledby", "tituloCombos");
          const titulo = document.createElement("h2");
          titulo.className = "mt-0 mb-3 text-lg font-bold text-elite-dark dark:text-elitenight-dark";
          titulo.id = "tituloCombos";
          titulo.textContent = "Combos con este producto";
          const lista = document.createElement("ul");
          lista.className = "m-0 flex list-none flex-col gap-3 p-0";
          const estado = document.createElement("p");
          estado.className = "mt-3 mb-0 text-sm empty:hidden";
          estado.setAttribute("role", "status");
          estado.setAttribute("aria-live", "polite");

          combos.forEach((combo) => {
            const li = document.createElement("li");
            li.className = "flex flex-col gap-2";
            const nombre = document.createElement("p");
            nombre.className = "m-0 font-semibold";
            nombre.textContent = combo.nombre;
            const detalle = document.createElement("p");
            detalle.className = "m-0 text-sm";
            detalle.textContent = combo.componentes
              .map((c) => `${c.nombre}: ${c.cantidad === 1 ? "" : `${c.cantidad} × `}${c.presentacion.toLowerCase()}`)
              .join(" + ");

            // El combo es uno solo: el color se elige aquí, entre los que tienen
            // existencias en TODOS sus componentes (lo calcula la API). Arranca
            // con el color que se está mirando en la ficha, si el combo lo tiene.
            let elegido =
              combo.colores.find((c) => c.color === seleccion?.color && c.disponible > 0) ??
              combo.colores.find((c) => c.disponible > 0) ??
              combo.colores[0];
            const colores = document.createElement("fieldset");
            colores.className = "m-0 border-0 p-0";
            const leyenda = document.createElement("legend");
            leyenda.className = "sr-only";
            leyenda.textContent = `Color del ${combo.nombre}`;
            const chips = document.createElement("div");
            chips.className = "flex flex-wrap gap-2";
            colores.append(leyenda, chips);

            const pie = document.createElement("div");
            pie.className = "flex flex-wrap items-center gap-3";
            const precio = document.createElement("span");
            precio.className = "font-bold text-elite-cuero dark:text-elitenight-cuero";
            const boton = document.createElement("button");
            boton.type = "button";
            boton.className =
              "inline-flex min-h-11 items-center rounded-lg bg-accion px-4 font-bold text-accion-texto transition-colors hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-accion-noche dark:text-accion-nochetexto";
            boton.dataset.combo = combo.codigo;
            pie.append(precio, boton);

            function pintarCombo() {
              precio.textContent = `$${elegido.precio.toFixed(2)} el combo`;
              const agotado = elegido.disponible < 1;
              boton.disabled = agotado;
              boton.textContent = agotado ? `Agotado en ${elegido.color.toLowerCase()}` : "Agregar combo";
              boton.setAttribute("aria-label", `Agregar ${combo.nombre} en color ${elegido.color} a la cotización`);
            }
            combo.colores.forEach((opcion) => {
              const { label, input } = crearOpcion({
                nombre: `colorCombo-${combo.codigo}`,
                valor: opcion.color,
                etiqueta: opcion.color,
                detalle: opcion.disponible < 1 ? "(agotado)" : "",
                agotada: opcion.disponible < 1,
                color: opcion.color,
                alElegir: () => {
                  elegido = opcion;
                  pintarCombo();
                },
              });
              input.checked = opcion === elegido;
              chips.append(label);
            });
            pintarCombo();

            boton.addEventListener("click", () => {
              boton.disabled = true;
              CarritoCE.agregarCombo(combo.codigo, elegido.color, 1)
                .then(() => {
                  estado.className = "mt-3 mb-0 text-sm text-elite-dark empty:hidden dark:text-elitenight-dark";
                  estado.textContent = `Se agregó ${combo.nombre} (${elegido.color.toLowerCase()}) a tu lista de cotización.`;
                })
                .catch((error) => {
                  estado.className = "mt-3 mb-0 text-sm text-error empty:hidden dark:text-error-dark";
                  estado.textContent = error.mensaje ?? "No se pudo agregar el combo.";
                })
                .finally(pintarCombo);
            });
            li.append(nombre, detalle, colores, pie);
            lista.append(li);
          });
          seccion.append(titulo, lista, estado);
          enlaceWhatsApp.parentElement.after(seccion);
        })
        .catch(() => {
          /* sin combos: la ficha sigue igual */
        });
    }

    const relacionados = todos
      .filter((p) => p.categoria === producto.categoria && p.id !== producto.id)
      .slice(0, 3);

    if (relacionados.length > 0) {
      rejillaRelacionados.innerHTML = "";
      relacionados.forEach((p) => rejillaRelacionados.append(crearTarjetaRelacionada(p)));
      seccionRelacionados.hidden = false;
    }

    estadoCarga.hidden = true;
    ficha.hidden = false;
  }

  function mostrarError() {
    estadoCarga.hidden = true;
    errorProducto.hidden = false;
  }

  const parametros = new URLSearchParams(window.location.search);
  const id = parametros.get("id");

  if (!id) {
    mostrarError();
    return;
  }

  Promise.all([CatalogoCE.cargar(), CarritoCE.obtener().catch(() => ({ items: [] }))])
    .then(async ([datos, carrito]) => {
      let producto = datos.productos.find((p) => p.id === id);
      if (!producto) {
        mostrarError();
        return;
      }
      // Venta por pieza (cuero): el detalle trae las piezas físicas (bandas) que
      // el listado no incluye. Si falla, la ficha sigue sin el módulo de piezas.
      if (producto.porPieza && !producto.piezas) {
        try {
          producto = (await CatalogoCE.detalle(id)) ?? producto;
        } catch {
          /* ficha normal sin piezas */
        }
      }
      mostrarProducto(producto, datos.productos, datos.empresa, carrito);
    })
    .catch((error) => {
      console.error("No se pudo cargar la ficha de producto:", error);
      mostrarError();
    });
})();
