// Catálogo: carga el catálogo (API o data/catalogo.json, ver js/api.js), renderiza la rejilla y filtra por facetas en el
// navegador sin recargar la página (RF-02, RF-04, RNF-04).
// Las tarjetas se pintan con las mismas utilidades de Tailwind que usa el
// resto del sitio; Tailwind Play CDN observa el DOM y genera los estilos
// para estas clases aunque se añadan después de la carga inicial.
(() => {
  const rejilla = document.getElementById("rejillaProductos");
  const contador = document.getElementById("contadorResultados");
  const sinResultados = document.getElementById("sinResultados");
  const errorCarga = document.getElementById("errorCarga");
  const fieldsetCategoria = document.getElementById("filtroCategoria");
  const buscador = document.getElementById("buscador");
  const botonLimpiar = document.getElementById("botonLimpiar");
  const botonLimpiarAlterno = document.getElementById("botonLimpiarAlterno");
  const avisoCarrito = document.getElementById("avisoCarritoGlobal");

  if (!rejilla) return;

  // Botón "Agregar a la cotización": usa el token semántico "accion" (js/tailwind-config.js),
  // el mismo de la ficha de producto, para que la acción principal se vea igual en
  // todo el sitio (auditoría IHC, H6). Al confirmar se pinta de lima un instante como
  // retroalimentación inmediata (WCAG 4.1.3: el cambio de texto a "Agregado" ya lo
  // anuncia por sí solo, el color es un refuerzo).
  const CLASES_BOTON_AGREGAR =
    "add-carrito relative z-10 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-lg bg-accion px-3 text-sm font-bold text-accion-texto transition-colors hover:brightness-90 active:brightness-75 dark:bg-accion-noche dark:text-accion-nochetexto";
  const CLASES_BOTON_AGREGADO =
    "add-carrito relative z-10 inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-lg bg-elite-lime px-3 text-sm font-bold text-elite-ink transition-colors";

  // Ícono SVG propio en vez del emoji 🛒, que se dibuja distinto en cada sistema.
  const ICONO_LISTA =
    '<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/></svg>';

  function confirmarAgregado(boton) {
    const texto = boton.querySelector(".texto-boton-carrito");
    boton.className = CLASES_BOTON_AGREGADO;
    texto.textContent = "✓ Agregado";
    window.clearTimeout(boton._temporizadorConfirmacion);
    boton._temporizadorConfirmacion = window.setTimeout(() => {
      boton.className = CLASES_BOTON_AGREGAR;
      texto.textContent = "Agregar a la cotización";
    }, 1400);
  }

  let productos = [];
  let categorias = [];
  const tarjetas = new Map(); // código de producto -> <li> de su tarjeta
  const contenedorDinamico = document.getElementById("filtrosDinamicos");
  const ayudaFiltros = document.getElementById("ayudaFiltros");

  const normalizar = (texto) =>
    texto
      .toString()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();

  const parametros = new URLSearchParams(window.location.search);
  const categoriaInicial = parametros.get("cat");

  // ---- Filtros por facetas ----
  // Cada grupo filtra a nivel de PRODUCTO (categoría, unidad de medida) o de
  // PRESENTACIÓN (características como Color, forma de venta), siguiendo el modelo
  // de la base. Entre grupos se exige todo (Y); dentro de un grupo, cualquiera de
  // las opciones marcadas (O). Los filtros de presentación deben cumplirse en una
  // MISMA presentación: "Negro" + "Cono 500 m" exige un cono negro que exista.
  // Las opciones de cada grupo se calculan con los OTROS filtros aplicados: solo
  // se ven las que dan resultados, con su conteo.
  // Unidad, características y presentación DEPENDEN de la categoría: sin una
  // categoría elegida no se muestran (mezclar "Galón" con "Banda" o "Par" no
  // dice nada); al elegirla, solo ofrecen lo de esa categoría.
  let grupos = [];

  const compararEs = (a, b) => a.etiqueta.localeCompare(b.etiqueta, "es");
  const valoresUnicos = (valores) => {
    const vistos = new Map();
    valores.forEach(({ valor, etiqueta }) => {
      if (valor != null && !vistos.has(valor)) vistos.set(valor, { valor, etiqueta });
    });
    return [...vistos.values()];
  };

  function construirGrupos() {
    const todasLasPresentaciones = productos.flatMap((p) => p.presentaciones);
    const atributos = [
      ...new Set(todasLasPresentaciones.flatMap((x) => Object.keys(x.caracteristicas ?? {}))),
    ].sort((a, b) => a.localeCompare(b, "es"));

    grupos = [
      {
        clave: "categoria",
        titulo: "Categoría",
        nivel: "producto",
        valorDe: (p) => p.categoria,
        opciones: categorias.map((c) => ({ valor: c.slug, etiqueta: c.nombre })),
      },
      // Marca: opcional por producto (los que no tienen no aparecen al filtrar
      // por una). No depende de la categoría: tiene sentido buscar "todo lo de
      // una marca" en varias líneas.
      {
        clave: "marca",
        titulo: "Marca",
        nivel: "producto",
        independiente: true,
        valorDe: (p) => p.marca ?? null,
        opciones: valoresUnicos(productos.map((p) => ({ valor: p.marca, etiqueta: p.marca }))).sort(compararEs),
      },
      {
        clave: "unidad",
        titulo: "Unidad de medida",
        nivel: "producto",
        valorDe: (p) => p.unidad?.codigo ?? null,
        opciones: valoresUnicos(
          productos.map((p) => ({ valor: p.unidad?.codigo, etiqueta: p.unidad?.nombre }))
        ).sort(compararEs),
      },
      ...atributos.map((atributo) => ({
        clave: `atr-${normalizar(atributo).replace(/[^a-z0-9]+/g, "-")}`,
        titulo: atributo,
        nivel: "presentacion",
        valorDe: (x) => x.caracteristicas?.[atributo] ?? null,
        opciones: valoresUnicos(
          todasLasPresentaciones.map((x) => ({
            valor: x.caracteristicas?.[atributo],
            etiqueta: x.caracteristicas?.[atributo],
          }))
        ).sort(compararEs),
      })),
      {
        clave: "presentacion",
        titulo: "Presentación",
        nivel: "presentacion",
        valorDe: (x) => x.descripcion,
        opciones: valoresUnicos(
          todasLasPresentaciones.map((x) => ({ valor: x.descripcion, etiqueta: x.descripcion }))
        ).sort(compararEs),
      },
    ].filter((grupo) => grupo.opciones.length > 0);

    grupos.forEach(crearGrupo);
  }

  // Las casillas se crean UNA vez; luego solo se muestran/ocultan y cambia su
  // conteo, para no perder el foco del teclado al marcar una opción.
  function crearGrupo(grupo) {
    let fieldset = fieldsetCategoria;
    if (grupo.clave !== "categoria") {
      fieldset = document.createElement("fieldset");
      fieldset.className = "mb-5 border-0 p-0";
      const leyenda = document.createElement("legend");
      leyenda.className = "mb-1.5 p-0 font-bold text-elite-dark dark:text-elitenight-dark";
      leyenda.textContent = grupo.titulo;
      fieldset.append(leyenda);
      contenedorDinamico.append(fieldset);
    }
    grupo.fieldset = fieldset;
    grupo.elementos = new Map();

    grupo.opciones.forEach((opcion, indice) => {
      // La categoría conserva su id histórico (filtro-<slug>), que usan los enlaces y las pruebas
      const id = grupo.clave === "categoria" ? `filtro-${opcion.valor}` : `filtro-${grupo.clave}-${indice}`;
      const contenedor = document.createElement("div");
      contenedor.className = "flex min-h-9 items-center gap-2";

      const casilla = document.createElement("input");
      casilla.type = "checkbox";
      casilla.id = id;
      casilla.name = grupo.clave;
      casilla.value = opcion.valor;
      casilla.className = "h-5 w-5 accent-elite-dark dark:accent-elitenight-dark";
      if (grupo.clave === "categoria" && categoriaInicial === opcion.valor) casilla.checked = true;

      const etiqueta = document.createElement("label");
      etiqueta.setAttribute("for", id);
      etiqueta.textContent = opcion.etiqueta;

      contenedor.append(casilla, etiqueta);
      fieldset.append(contenedor);
      grupo.elementos.set(opcion.valor, { contenedor, casilla, etiqueta, texto: opcion.etiqueta });
    });

    fieldset.addEventListener("change", aplicarFiltros);
  }

  const seleccionDe = (grupo) =>
    new Set([...grupo.elementos.values()].filter((e) => e.casilla.checked).map((e) => e.casilla.value));

  // Presentaciones del producto que cumplen los filtros de presentación activos
  // (salvo el grupo "excluido", que es el que se está contando).
  function presentacionesQueCumplen(producto, activos, excluido) {
    return producto.presentaciones.filter((x) =>
      grupos.every((g) => {
        if (g === excluido || g.nivel !== "presentacion") return true;
        const marcados = activos.get(g);
        return marcados.size === 0 || marcados.has(g.valorDe(x));
      })
    );
  }

  function cumple(producto, activos, termino, excluido = null) {
    // Búsqueda SOLO por nombre (sin distinguir mayúsculas ni tildes)
    if (termino && !normalizar(producto.nombre).includes(termino)) return false;
    for (const g of grupos) {
      if (g === excluido || g.nivel !== "producto") continue;
      const marcados = activos.get(g);
      if (marcados.size > 0 && !marcados.has(g.valorDe(producto))) return false;
    }
    return presentacionesQueCumplen(producto, activos, excluido).length > 0;
  }

  function crearTarjeta(producto) {
    const li = document.createElement("li");

    const articulo = document.createElement("article");
    articulo.className =
      "tarjeta-producto relative flex h-full flex-col overflow-hidden rounded-lg border border-elite-border bg-white shadow-[0_1px_3px_rgba(26,26,26,0.12)] dark:border-elitenight-border dark:bg-elitenight-bg";
    articulo.dataset.categoria = producto.categoria;
    articulo.dataset.buscable = normalizar(producto.nombre); // la búsqueda es solo por nombre

    const figura = document.createElement("figure");
    figura.className = "relative m-0 bg-elite-tint dark:bg-elitenight-tint";
    const img = document.createElement("img");
    img.src = producto.imagen;
    // Auditoría IHC, H8: el teléfono descarga la versión de 400 px, no la de 800.
    if (producto.srcset) {
      img.srcset = producto.srcset;
      img.sizes = "(min-width: 60em) 22rem, (min-width: 30em) 50vw, 100vw";
    }
    img.alt = producto.alt;
    // Proporción fija 4:3 y recorte centrado: fotos verticales y horizontales
    // ocupan el mismo espacio y la rejilla no se desalinea.
    img.className = "aspect-[4/3] w-full object-cover";
    img.width = 400;
    img.height = 300;
    img.loading = "lazy";
    const figcaption = document.createElement("figcaption");
    figcaption.className = "sr-only";
    figcaption.textContent = producto.nombre;
    figura.append(img, figcaption);

    const cuerpo = document.createElement("div");
    cuerpo.className = "flex flex-1 flex-col gap-1.5 p-5";

    const h3 = document.createElement("h3");
    h3.className = "mb-0 text-base font-semibold";
    const enlace = document.createElement("a");
    enlace.className =
      "text-elite-dark no-underline after:absolute after:inset-0 after:content-[''] dark:text-elitenight-dark";
    enlace.href = `producto.html?id=${encodeURIComponent(producto.id)}`;
    enlace.textContent = producto.nombre;
    h3.append(enlace);

    const meta = document.createElement("p");
    meta.className = "m-0 text-sm text-elite-text dark:text-elitenight-text";
    meta.textContent = `${producto.id} · ${producto.presentacion}`;

    cuerpo.append(h3, meta);

    // La insignia va sobre la foto y no en el cuerpo: así no empuja hacia abajo el
    // precio y el botón solo en algunas tarjetas (alineación entre tarjetas).
    if (producto.novedad) {
      const chip = document.createElement("span");
      chip.className =
        "absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-elite-lime px-3 py-0.5 text-sm font-bold text-elite-ink shadow before:content-['●'] before:text-[0.7em]";
      chip.textContent = "Nuevo ingreso";
      figura.append(chip);
    }

    // Colores (variantes) como en una tienda en línea: puntos de muestra + conteo.
    // Los agotados se ven tachados en la ficha; aquí solo se cuenta lo que hay.
    const opciones = producto.presentaciones;
    const colores = [...new Set(opciones.map((x) => x.color).filter(Boolean))];
    if (colores.length > 1) {
      const filaColores = document.createElement("p");
      filaColores.className = "m-0 flex items-center gap-1.5 text-sm text-elite-text dark:text-elitenight-text";
      colores.forEach((color) => {
        const punto = document.createElement("span");
        punto.setAttribute("aria-hidden", "true");
        const agotado = opciones.filter((x) => x.color === color).every((x) => x.disponible === 0);
        punto.className = `h-3.5 w-3.5 rounded-full border border-elite-borderstrong dark:border-elitenight-border${agotado ? " opacity-30" : ""}`;
        punto.style.background = CatalogoCE.muestraColor(color);
        filaColores.append(punto);
      });
      filaColores.append(` ${colores.length} colores`);
      cuerpo.append(filaColores);
    }

    const precio = document.createElement("p");
    precio.className = "m-0 font-bold text-elite-cuero dark:text-elitenight-cuero";
    precio.textContent = `$${producto.precio.toFixed(2)}`;
    if (producto.precioSinOferta) {
      const antes = document.createElement("s");
      antes.className = "ml-2 text-sm font-normal text-elite-text dark:text-elitenight-text";
      antes.textContent = `$${producto.precioSinOferta.toFixed(2)}`;
      precio.append(antes);
    }

    // Tres casos, como en una tienda en línea:
    //  - agotado: botón deshabilitado que lo dice;
    //  - varias opciones (colores/presentaciones): lleva a la ficha a elegir;
    //  - una sola opción con stock: agrega directo esa presentación.
    const vendibles = opciones.filter((x) => x.disponible !== 0);
    let botonAgregar;
    if (producto.agotado || vendibles.length === 0) {
      botonAgregar = document.createElement("button");
      botonAgregar.type = "button";
      botonAgregar.disabled = true;
      botonAgregar.className = `${CLASES_BOTON_AGREGAR} cursor-not-allowed opacity-60`;
      botonAgregar.innerHTML = `<span class="texto-boton-carrito">Agotado</span>`;
      botonAgregar.setAttribute("aria-label", `${producto.nombre}: agotado`);
    } else if (opciones.length > 1) {
      botonAgregar = document.createElement("a");
      botonAgregar.href = `producto.html?id=${encodeURIComponent(producto.id)}`;
      botonAgregar.className = `${CLASES_BOTON_AGREGAR} no-underline`;
      botonAgregar.innerHTML = `<span class="texto-boton-carrito">Elegir color</span>`;
      botonAgregar.setAttribute("aria-label", `Elegir color de ${producto.nombre}`);
    } else {
      botonAgregar = document.createElement("button");
      botonAgregar.type = "button";
      botonAgregar.className = CLASES_BOTON_AGREGAR;
      botonAgregar.dataset.presentacion = String(vendibles[0].id);
      botonAgregar.dataset.nombre = producto.nombre;
      botonAgregar.setAttribute("aria-label", `Agregar ${producto.nombre} a la cotización`);
      botonAgregar.innerHTML = `${ICONO_LISTA}<span class="texto-boton-carrito">Agregar a la cotización</span>`;
    }

    // Precio y botón anclados al fondo (mt-auto): las tarjetas de una misma fila
    // tienen la misma altura (h-full), así que todos los botones quedan a la misma
    // altura aunque el nombre ocupe una, dos o tres líneas.
    const pie = document.createElement("div");
    pie.className = "mt-auto flex flex-col gap-2 pt-2";
    pie.append(precio, botonAgregar);
    cuerpo.append(pie);

    articulo.append(figura, cuerpo);
    li.append(articulo);
    return li;
  }

  function renderizarProductos() {
    rejilla.innerHTML = "";
    tarjetas.clear();
    const fragmento = document.createDocumentFragment();
    productos.forEach((producto) => {
      const li = crearTarjeta(producto);
      tarjetas.set(producto.id, li);
      fragmento.append(li);
    });
    rejilla.append(fragmento);
    rejilla.removeAttribute("aria-busy");
  }

  function aplicarFiltros() {
    // Sin categoría elegida, los filtros dependientes se limpian y se esconden:
    // un filtro oculto nunca debe seguir actuando sin que se vea.
    const grupoCategoria = grupos.find((g) => g.clave === "categoria");
    const hayCategoria = grupoCategoria ? seleccionDe(grupoCategoria).size > 0 : true;
    const dependientes = grupos.filter((g) => g !== grupoCategoria && !g.independiente);
    if (!hayCategoria) {
      dependientes.forEach((g) =>
        g.elementos.forEach(({ casilla }) => {
          casilla.checked = false;
        })
      );
    }
    if (ayudaFiltros) ayudaFiltros.hidden = hayCategoria || dependientes.length === 0;

    const activos = new Map(grupos.map((g) => [g, seleccionDe(g)]));
    const termino = normalizar(buscador.value.trim());
    let visibles = 0;

    productos.forEach((producto) => {
      const li = tarjetas.get(producto.id);
      const visible = cumple(producto, activos, termino);
      li.hidden = !visible;
      if (!visible) return;
      visibles += 1;
      // "Elegir color" abre la ficha con el color que coincide con los filtros
      const enlace = li.querySelector("a.add-carrito");
      if (enlace) {
        const coinciden = presentacionesQueCumplen(producto, activos, null);
        const color = coinciden.length < producto.presentaciones.length ? coinciden[0]?.color : null;
        const destino = new URLSearchParams({ id: producto.id, ...(color ? { color } : {}) });
        enlace.href = `producto.html?${destino}`;
      }
    });

    // Facetas: cada opción cuenta los productos que quedarían al marcarla,
    // con todos los demás filtros aplicados.
    grupos.forEach((grupo) => {
      let opcionesVisibles = 0;
      const candidatos = productos.filter((p) => cumple(p, activos, termino, grupo));
      grupo.elementos.forEach((elemento, valor) => {
        const cantidad = candidatos.filter((p) =>
          grupo.nivel === "producto"
            ? grupo.valorDe(p) === valor
            : presentacionesQueCumplen(p, activos, grupo).some((x) => grupo.valorDe(x) === valor)
        ).length;
        // Una opción marcada se sigue viendo aunque quede en 0, para poder desmarcarla
        const mostrar = cantidad > 0 || elemento.casilla.checked;
        elemento.contenedor.classList.toggle("hidden", !mostrar);
        elemento.etiqueta.textContent = `${elemento.texto} (${cantidad})`;
        if (mostrar) opcionesVisibles += 1;
      });
      grupo.fieldset.hidden =
        opcionesVisibles === 0 || (!hayCategoria && grupo !== grupoCategoria && !grupo.independiente);
    });

    contador.textContent =
      visibles === 1 ? "1 producto encontrado" : `${visibles} productos encontrados`;
    sinResultados.hidden = visibles !== 0;

    // Se persiste en sessionStorage (no localStorage): el filtro es parte de la
    // navegación de esta visita, no algo que deba sobrevivir a cerrar la pestaña.
    const facetas = Object.fromEntries(grupos.map((g) => [g.clave, [...activos.get(g)]]));
    window.AlmacenCE?.filtros
      .guardar({ busqueda: buscador.value.trim(), categorias: facetas.categoria ?? [], facetas })
      .catch(() => {});
  }

  function anunciarCarrito(texto, esError = false) {
    if (!avisoCarrito) return;
    avisoCarrito.setAttribute("role", esError ? "alert" : "status");
    avisoCarrito.className = esError
      ? "mb-3 font-semibold text-error dark:text-error-dark"
      : "mb-3 font-semibold text-elite-dark dark:text-elitenight-dark";
    avisoCarrito.textContent = texto;
  }

  function limpiarFiltros() {
    grupos.forEach((grupo) =>
      grupo.elementos.forEach(({ casilla }) => {
        casilla.checked = false;
      })
    );
    buscador.value = "";
    aplicarFiltros();
    buscador.focus();
  }

  function restaurarFiltros(guardados) {
    if (guardados.busqueda) buscador.value = guardados.busqueda;
    // "facetas" es el formato nuevo; "categorias" el de antes (se sigue leyendo)
    const facetas = guardados.facetas ?? { categoria: guardados.categorias ?? [] };
    grupos.forEach((grupo) =>
      (facetas[grupo.clave] ?? []).forEach((valor) => {
        const elemento = grupo.elementos.get(valor);
        if (elemento) elemento.casilla.checked = true;
      })
    );
  }

  function iniciar(datos, filtrosGuardados) {
    productos = datos.productos;
    categorias = datos.categorias;

    renderizarProductos();
    construirGrupos();

    // La URL (?cat=) manda sobre el filtro guardado si llega con una categoría;
    // si no, se restaura lo que había en sessionStorage de esta misma pestaña.
    if (!categoriaInicial && filtrosGuardados) restaurarFiltros(filtrosGuardados);

    aplicarFiltros();

    buscador.addEventListener("input", aplicarFiltros);
    botonLimpiar.addEventListener("click", limpiarFiltros);
    botonLimpiarAlterno?.addEventListener("click", limpiarFiltros);

    rejilla.addEventListener("click", (evento) => {
      const boton = evento.target.closest("button.add-carrito[data-presentacion]");
      if (!boton) return;
      // Ids de la base son números; los del modo sin API, texto ("CE-1042::Negro")
      const id = /^\d+$/.test(boton.dataset.presentacion) ? Number(boton.dataset.presentacion) : boton.dataset.presentacion;
      CarritoCE.agregar(id, 1)
        .then(() => {
          confirmarAgregado(boton);
          anunciarCarrito(`Se agregó ${boton.dataset.nombre} a tu lista de cotización.`);
        })
        .catch((error) => anunciarCarrito(error.mensaje ?? "No se pudo agregar a la lista.", true));
    });
  }

  Promise.all([
    CatalogoCE.cargar(),
    window.AlmacenCE ? AlmacenCE.filtros.obtener().catch(() => null) : Promise.resolve(null),
  ])
    .then(([datos, filtrosGuardados]) => iniciar(datos, filtrosGuardados))
    .catch((error) => {
      console.error("No se pudo cargar el catálogo:", error);
      contador.textContent = "";
      rejilla.hidden = true;
      errorCarga.hidden = false;
    });
})();
