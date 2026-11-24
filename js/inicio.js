// Inicio: lee el catálogo (API o data/catalogo.json, ver js/api.js) para pintar (1) el carrusel de novedades, (2) las
// cifras del catálogo y (3) la cantidad de productos de cada línea, así nunca quedan
// desactualizados respecto al catálogo (RF-05, RNF-04). Si falla la carga se conserva
// el contenido escrito en el HTML como respaldo (lista de novedades y tarjetas).
(() => {
  const marco = document.querySelector("#carruselNovedades .carrusel-marco");
  const contenedor = document.getElementById("diapositivasNovedades");
  const listaMiniaturas = document.getElementById("miniaturasNovedades");
  if (!marco || !contenedor) return;

  const MAX_DIAPOSITIVAS = 6;
  const INTERVALO_MS = 6000;
  const SIZES = "(min-width: 48em) 50rem, 100vw";

  const formateador = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "short", year: "numeric" });
  const fecha = (iso) => formateador.format(new Date(`${iso}T00:00:00`));
  const moneda = (valor) => `$${valor.toFixed(2)}`;

  const ICONOS = {
    anterior: '<path d="M15 18l-6-6 6-6"/>',
    siguiente: '<path d="M9 18l6-6-6-6"/>',
    pausa: '<path d="M8 5v14M16 5v14"/>',
    reproducir: '<path d="M7 5l12 7-12 7z"/>',
  };
  const icono = (nombre) =>
    `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${ICONOS[nombre]}</svg>`;

  // Primero los marcados como novedad; si son pocos, se completa con los ingresos
  // más recientes que tienen foto real (las ilustraciones no lucen a pantalla ancha).
  function elegirDiapositivas(productos) {
    const porFecha = (a, b) => new Date(b.fechaIngreso) - new Date(a.fechaIngreso);
    const nuevos = productos.filter((p) => p.novedad).sort(porFecha);
    const recientes = productos.filter((p) => !p.novedad && !p.ilustracion).sort(porFecha);
    return [...nuevos, ...recientes].slice(0, MAX_DIAPOSITIVAS);
  }

  // Todo con nodos y textContent: los textos vienen del JSON.
  function nodo(etiqueta, clase, texto) {
    const el = document.createElement(etiqueta);
    if (clase) el.className = clase;
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function crearDiapositiva(producto, indice, total) {
    const articulo = nodo("article", "diapositiva");
    articulo.setAttribute("role", "group");
    articulo.setAttribute("aria-roledescription", "diapositiva");
    articulo.setAttribute("aria-label", `${indice + 1} de ${total}: ${producto.nombre}`);
    articulo.hidden = indice !== 0;

    const foto = nodo("div", "diapositiva-foto");
    const img = document.createElement("img");
    img.src = producto.imagen;
    if (producto.srcset) {
      img.srcset = producto.srcset;
      img.sizes = SIZES;
    }
    img.alt = producto.alt;
    img.width = 800;
    img.height = 450;
    if (indice > 0) img.loading = "lazy";
    foto.append(img);

    const texto = nodo("div", "diapositiva-texto");
    const etiquetas = nodo("p", "mb-3 flex flex-wrap items-center gap-3 text-sm font-bold uppercase tracking-[0.12em]");
    if (producto.novedad) {
      etiquetas.append(nodo("span", "rounded-full bg-elite-lime px-3 py-0.5 text-elite-ink", "Nuevo"));
    }
    const ingreso = nodo("span", "text-elite-border");
    const time = nodo("time", "", fecha(producto.fechaIngreso));
    time.dateTime = producto.fechaIngreso;
    ingreso.append("Ingresó el ", time);
    etiquetas.append(ingreso);

    const titulo = nodo("h3", "mb-2 text-2xl font-bold text-white md:text-4xl", producto.nombre);
    const meta = nodo("p", "mb-2 text-elite-tint", `${producto.subcategoria} · ${producto.presentacion}`);
    const uso = nodo("p", "mb-4 text-white", `${producto.uso}.`);

    const colores = nodo("ul", "mb-5 flex flex-wrap gap-2");
    colores.setAttribute("aria-label", "Colores disponibles");
    producto.colores.forEach((color) => {
      colores.append(nodo("li", "rounded-full border border-white/40 px-3 py-0.5 text-sm text-white", color));
    });

    const pie = nodo("div", "flex flex-wrap items-center gap-5");
    // El precio dice SIEMPRE de qué presentación es (es la más barata con
    // stock): "$0.40 por metro" no se confunde con el precio del rollo.
    const precio = nodo("p", "m-0 text-3xl font-bold text-elitenight-cuero md:text-4xl", moneda(producto.precio));
    precio.append(
      nodo("span", "ml-2 align-middle text-base font-semibold text-elite-tint md:text-lg", `por ${producto.presentacion.toLowerCase()}`)
    );
    const enlace = nodo(
      "a",
      "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-elite-lime px-6 py-2.5 font-bold text-elite-ink no-underline transition hover:text-elite-ink hover:brightness-90 focus-visible:text-elite-ink"
    );
    enlace.href = `producto.html?id=${encodeURIComponent(producto.id)}`;
    enlace.innerHTML = `Ver producto <span aria-hidden="true">→</span>`;
    enlace.setAttribute("aria-label", `Ver producto: ${producto.nombre}`);
    pie.append(precio, enlace);

    texto.append(etiquetas, titulo, meta, uso, colores, pie);

    const numero = nodo("span", "diapositiva-numero", String(indice + 1).padStart(2, "0"));
    numero.setAttribute("aria-hidden", "true");

    articulo.append(foto, texto, numero);
    return articulo;
  }

  function crearBoton(clase, etiqueta, nombreIcono) {
    const boton = nodo("button", `carrusel-boton ${clase}`);
    boton.type = "button";
    boton.setAttribute("aria-label", etiqueta);
    boton.innerHTML = icono(nombreIcono);
    return boton;
  }

  function montarCarrusel(productos) {
    const elegidos = elegirDiapositivas(productos);
    if (elegidos.length === 0) return;
    const total = elegidos.length;
    const diapositivas = elegidos.map((p, i) => crearDiapositiva(p, i, total));
    contenedor.replaceChildren(...diapositivas);

    const miniaturas = elegidos.map((producto, i) => {
      const li = document.createElement("li");
      const boton = nodo("button");
      boton.type = "button";
      boton.setAttribute("aria-label", `Ver novedad ${i + 1} de ${total}: ${producto.nombre}`);
      const img = document.createElement("img");
      img.src = producto.imagen;
      if (producto.srcset) {
        img.srcset = producto.srcset;
        img.sizes = "11rem";
      }
      img.alt = "";
      img.loading = "lazy";
      boton.append(img, nodo("span", "", producto.nombre));
      boton.addEventListener("click", () => {
        detenerPorUsuario();
        mostrar(i);
      });
      li.append(boton);
      return li;
    });
    listaMiniaturas.replaceChildren(...miniaturas);

    let actual = 0;
    let temporizador = null;
    let pausadoPorUsuario = false;
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function mostrar(indice) {
      actual = (indice + total) % total;
      diapositivas.forEach((d, i) => {
        d.hidden = i !== actual;
      });
      miniaturas.forEach((li, i) => {
        const boton = li.querySelector("button");
        if (i === actual) boton.setAttribute("aria-current", "true");
        else boton.removeAttribute("aria-current");
      });
    }

    if (total === 1) {
      mostrar(0);
      return;
    }

    const anterior = crearBoton("carrusel-anterior", "Novedad anterior", "anterior");
    const siguiente = crearBoton("carrusel-siguiente", "Novedad siguiente", "siguiente");
    const pausa = nodo("button", "carrusel-boton carrusel-pausa");
    pausa.type = "button";
    marco.append(pausa, anterior, siguiente);

    // Mientras avanza solo, el cambio no se anuncia (aria-live="off"); en pausa,
    // cada cambio manual sí se anuncia (aria-live="polite"), como pide el APG.
    function pintarPausa() {
      const reproduciendo = temporizador !== null;
      pausa.innerHTML = reproduciendo ? `${icono("pausa")} Pausar` : `${icono("reproducir")} Reproducir`;
      pausa.setAttribute("aria-label", reproduciendo ? "Pausar el carrusel" : "Reproducir el carrusel");
      contenedor.setAttribute("aria-live", reproduciendo ? "off" : "polite");
    }

    function iniciar() {
      if (temporizador !== null || pausadoPorUsuario || sinMovimiento) return;
      temporizador = window.setInterval(() => mostrar(actual + 1), INTERVALO_MS);
      pintarPausa();
    }

    function detener() {
      if (temporizador === null) return;
      window.clearInterval(temporizador);
      temporizador = null;
      pintarPausa();
    }

    function detenerPorUsuario() {
      pausadoPorUsuario = true;
      detener();
    }

    anterior.addEventListener("click", () => {
      detenerPorUsuario();
      mostrar(actual - 1);
    });
    siguiente.addEventListener("click", () => {
      detenerPorUsuario();
      mostrar(actual + 1);
    });
    pausa.addEventListener("click", () => {
      if (temporizador !== null) {
        detenerPorUsuario();
      } else {
        pausadoPorUsuario = false;
        iniciar();
      }
    });

    // Pausa temporal mientras el cursor o el foco están en el carrusel: nadie
    // debería perder lo que está leyendo porque la diapositiva cambió sola.
    const carrusel = document.getElementById("carruselNovedades");
    carrusel.addEventListener("mouseenter", detener);
    carrusel.addEventListener("mouseleave", iniciar);
    carrusel.addEventListener("focusin", detener);
    carrusel.addEventListener("focusout", (evento) => {
      if (!carrusel.contains(evento.relatedTarget)) iniciar();
    });

    mostrar(0);
    pintarPausa();
    iniciar();
  }

  // Tarjetas de categorías principales (las que no son subcategoría; lo
  // garantiza la vista v_categoria_web). Nodos + textContent: nada de innerHTML
  // con datos de la base. Con API, la imagen y las subcategorías vienen de la
  // base; sin API se derivan de los productos del catálogo local con la misma
  // regla que v_categoria_web (la imagen del primer producto como portada).
  function pintarCategorias(categorias, productos) {
    const lista = document.querySelector("ul.categorias");
    if (!lista) return;
    const fragmento = document.createDocumentFragment();
    categorias.forEach((categoria) => {
      const propios = productos.filter((p) => p.categoria === categoria.slug);
      const imagen = categoria.imagen ?? propios.find((p) => p.imagen)?.imagen;
      const subcategorias =
        categoria.subcategorias ??
        [...new Set(propios.map((p) => p.subcategoria).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b, "es")
        );
      const li = document.createElement("li");
      li.className = "categoria";
      li.dataset.cat = categoria.slug;

      const enlace = document.createElement("a");
      enlace.href = `catalogo.html?cat=${encodeURIComponent(categoria.slug)}`;

      const foto = document.createElement("span");
      foto.className = "categoria-foto";
      foto.setAttribute("aria-hidden", "true");
      if (imagen) {
        const img = document.createElement("img");
        img.src = imagen;
        img.alt = "";
        img.loading = "lazy";
        foto.append(img);
      }

      const texto = document.createElement("div");
      texto.className = "categoria-texto";
      const detalle = document.createElement("span");
      detalle.className = "categoria-detalle";
      detalle.textContent = subcategorias.join(" · ");
      const titulo = document.createElement("h3");
      titulo.textContent = categoria.nombre;
      const cantidad = document.createElement("span");
      cantidad.className = "categoria-cantidad";
      const numero = document.createElement("span");
      numero.dataset.cantidad = "";
      const flecha = document.createElement("span");
      flecha.setAttribute("aria-hidden", "true");
      flecha.textContent = "→";
      cantidad.append(numero, " ", flecha);
      texto.append(detalle, titulo, cantidad);

      enlace.append(foto, texto);
      li.append(enlace);
      fragmento.append(li);
    });
    lista.replaceChildren(fragmento);
  }

  function pintarCifras(datos) {
    const cifras = {
      cifraProductos: datos.productos.length,
      cifraLineas: datos.categorias.length,
      cifraNovedades: datos.productos.filter((p) => p.novedad).length,
    };
    Object.entries(cifras).forEach(([id, valor]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(valor);
    });

    // Las tarjetas de "Explora por línea" se arman SIEMPRE con los datos: con la
    // base salen de sus categorías principales (v_categoria_web) y crecen solas
    // cuando se agrega una línea; sin API, del catálogo local. Las del HTML son
    // solo el respaldo sin JavaScript.
    pintarCategorias(datos.categorias, datos.productos);

    document.querySelectorAll(".categoria[data-cat]").forEach((tarjeta) => {
      const cantidad = datos.productos.filter((p) => p.categoria === tarjeta.dataset.cat).length;
      const el = tarjeta.querySelector("[data-cantidad]");
      if (el) el.textContent = cantidad === 1 ? "1 producto" : `${cantidad} productos`;
    });
  }

  CatalogoCE.cargar()
    .then((datos) => {
      montarCarrusel(datos.productos);
      pintarCifras(datos);
    })
    .catch((error) => {
      console.error("No se pudo cargar el catálogo en el inicio:", error);
    });
})();
