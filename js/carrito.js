// Página de la lista de cotización (carrito.html): CRUD completo sobre CarritoCE
// (js/api.js), que guarda el carrito en la base (ecommerce.carrito) cuando hay API.
// Cada línea es una PRESENTACIÓN (color + forma de venta), como en el modelo de la
// base, con su precio vigente y sus existencias. Envío por
// WhatsApp/correo (sin pago real, es B2B de cotización) y, cuando el usuario confirma
// que el mensaje salió, un registro en el historial de IndexedDB.
// El precio/nombre de cada línea siempre se resuelve contra el catálogo vigente (API o
// data/catalogo.json, ver js/api.js; nunca
// se guarda duplicado en el carrito), así que si un producto cambia de precio o se
// retira del catálogo, el carrito lo refleja en vez de mostrar un dato caducado.
(() => {
  const listaCarrito = document.getElementById("listaCarrito");
  if (!listaCarrito) return;

  // Auditoría IHC, H5: número y correo de destino salen de data/catalogo.json
  // (campo "empresa"), la misma fuente que muestran el pie y la página de Contacto.
  let empresa = null;

  const carritoVacio = document.getElementById("carritoVacio");
  const totalCarritoEl = document.getElementById("totalCarrito");
  const contadorItemsEl = document.getElementById("contadorItemsCarrito");
  const avisoAlmacenamiento = document.getElementById("avisoAlmacenamiento");
  const botonVaciar = document.getElementById("botonVaciarCarrito");
  const seccionHistorial = document.getElementById("seccionHistorial");
  const avisoHistorial = document.getElementById("avisoHistorial");
  const listaHistorial = document.getElementById("listaHistorial");
  const ultimaActualizacionEl = document.getElementById("ultimaActualizacion");
  const estadoCheckout = document.getElementById("estadoCheckout");
  const campoNombreCheckout = document.getElementById("nombreCheckout");
  const campoCorreoCheckout = document.getElementById("correoCheckout");
  const campoTelefonoCheckout = document.getElementById("telefonoCheckout");
  const casillaRecordar = document.getElementById("recordarDatosCheckout");
  const campoMensajeCheckout = document.getElementById("mensajeCheckout");
  const botonOlvidarDatos = document.getElementById("botonOlvidarDatos");
  const confirmacionEnvio = document.getElementById("confirmacionEnvio");
  const tituloConfirmacionEnvio = document.getElementById("tituloConfirmacionEnvio");
  const textoConfirmacionEnvio = document.getElementById("textoConfirmacionEnvio");
  const estadoHistorial = document.getElementById("estadoHistorial");

  const { patrones, mensajesError, normalizarTelefono, validarCampo: validarCampoCE, resumirErrores } =
    window.ValidacionCE;

  function formatearMoneda(valor) {
    return `$${valor.toFixed(2)}`;
  }

  function mostrarAvisoAlmacenamiento(mensaje) {
    avisoAlmacenamiento.hidden = false;
    avisoAlmacenamiento.textContent = mensaje;
  }

  function ocultarAvisoAlmacenamiento() {
    avisoAlmacenamiento.hidden = true;
  }

  function pintarUltimaActualizacion(fechaISO) {
    if (!fechaISO) {
      ultimaActualizacionEl.textContent = "";
      return;
    }
    const fecha = new Date(fechaISO);
    ultimaActualizacionEl.textContent = `Última actualización: ${fecha.toLocaleString("es-EC", {
      dateStyle: "medium",
      timeStyle: "short",
    })}`;
  }

  function avisarError(error, porDefecto) {
    mostrarAvisoAlmacenamiento(error.mensaje ?? porDefecto);
  }

  // Una línea es presentación + pieza: dos bandas del mismo color son dos líneas
  function actualizarCantidad(id, cantidad, pieza = null) {
    CarritoCE.cambiarCantidad(id, cantidad, pieza)
      .then(ocultarAvisoAlmacenamiento)
      .catch((error) => avisarError(error, "No se pudo actualizar la lista."));
  }

  function eliminar(id, pieza = null) {
    CarritoCE.quitar(id, pieza)
      .then(ocultarAvisoAlmacenamiento)
      .catch((error) => avisarError(error, "No se pudo actualizar la lista."));
  }

  // Línea que pide más de lo que hay (otro cliente compró, o se ajustó el stock)
  const excedeStock = (item) => item.stock != null && item.cantidad > item.stock;

  function crearFilaCarrito(item) {
    const li = document.createElement("li");
    li.className =
      "flex flex-wrap items-center gap-3 rounded-lg border border-elite-border p-3 dark:border-elitenight-border";

    // Rojo + ícono de papelera: el borrado es destructivo y debe distinguirse a
    // simple vista de los controles de edición (cantidad), no solo por la palabra.
    const botonEliminar = document.createElement("button");
    botonEliminar.type = "button";
    botonEliminar.className =
      "ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-lg border-2 border-error px-4 font-bold text-error transition-colors hover:bg-error-tint dark:border-error-dark dark:text-error-dark dark:hover:bg-error-darktint";
    botonEliminar.innerHTML = `<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" class="h-5 w-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg> Eliminar`;
    botonEliminar.addEventListener("click", () => eliminar(item.idPresentacion, item.pieza));

    if (!item.publicada) {
      const aviso = document.createElement("p");
      aviso.className = "m-0 flex-1 text-sm text-error dark:text-error-dark";
      aviso.textContent = `${item.nombre}: ya no está a la venta en el catálogo.`;
      botonEliminar.setAttribute("aria-label", `Eliminar ${item.nombre} de la lista`);
      li.append(aviso, botonEliminar);
      return li;
    }

    const variante = item.color ? ` (${item.color})` : "";
    const nombreCompleto = `${item.nombre}${variante}`;

    const img = document.createElement("img");
    img.src = item.imagenUrl ?? "";
    img.alt = "";
    img.width = 64;
    img.height = 64;
    img.className = "h-16 w-16 shrink-0 rounded-lg object-cover";

    const info = document.createElement("div");
    info.className = "min-w-40 flex-1";
    const nombre = document.createElement("a");
    const parametros = new URLSearchParams({ id: item.codigo, ...(item.color ? { color: item.color } : {}) });
    nombre.href = `producto.html?${parametros}`;
    nombre.className = "font-semibold text-elite-dark dark:text-elitenight-dark";
    nombre.textContent = item.nombre;
    const detalle = document.createElement("p");
    detalle.className = "m-0 text-sm text-elite-text dark:text-elitenight-text";
    detalle.textContent = [item.color && `Color: ${item.color}`, item.talla && `Talla: ${item.talla}`, item.presentacion,
      item.pieza && `Banda ${item.piezaCodigo ?? item.pieza}`, `${formatearMoneda(item.precioUnitario)} c/u`]
      .filter(Boolean)
      .join(" · ");
    info.append(nombre, detalle);

    // Existencias de la base: avisa si la línea ya no se puede atender completa
    if (item.stock != null && (item.stock === 0 || excedeStock(item) || item.stock <= 5)) {
      const stock = document.createElement("p");
      if (item.stock === 0) {
        stock.className = "m-0 text-sm font-semibold text-error dark:text-error-dark";
        stock.textContent = "Agotado: quítalo o elige otro color.";
      } else if (excedeStock(item)) {
        stock.className = "m-0 text-sm font-semibold text-error dark:text-error-dark";
        stock.textContent = `Solo quedan ${item.stock}: baja la cantidad.`;
      } else {
        stock.className = "m-0 text-sm font-semibold text-elite-cuero dark:text-elitenight-cuero";
        stock.textContent = `¡Solo quedan ${item.stock}!`;
      }
      info.append(stock);
    }

    // Stepper −/+ en vez de un <input type="number"> pelado: el clic/tap es un
    // objetivo más grande y obvio que los flechines nativos del input, y sigue
    // siendo editable a mano para quien prefiera teclear la cantidad.
    const grupoCantidad = document.createElement("div");
    grupoCantidad.className = "flex items-stretch";
    grupoCantidad.setAttribute("role", "group");
    grupoCantidad.setAttribute("aria-label", `Cantidad de ${nombreCompleto}`);

    const botonRestar = document.createElement("button");
    botonRestar.type = "button";
    botonRestar.className =
      "min-h-11 min-w-11 rounded-l-lg border-2 border-r-0 border-elite-borderstrong bg-white text-lg font-bold text-elite-ink dark:border-elitenight-border dark:bg-elitenight-bg dark:text-elitenight-text";
    botonRestar.textContent = "−";
    botonRestar.setAttribute("aria-label", `Restar una unidad de ${nombreCompleto}`);
    botonRestar.addEventListener("click", () => actualizarCantidad(item.idPresentacion, item.cantidad - 1, item.pieza));

    const campoCantidad = document.createElement("input");
    campoCantidad.type = "number";
    campoCantidad.min = "1";
    // el cuero por pie² admite cuartos (1.25...): la base valida el incremento
    campoCantidad.step = "any";
    if (item.stock) campoCantidad.max = String(item.stock);
    campoCantidad.value = String(item.cantidad);
    campoCantidad.className =
      "min-h-11 w-14 border-2 border-elite-borderstrong px-1 text-center text-elite-text dark:border-elitenight-border dark:bg-elitenight-bg dark:text-elitenight-text";
    campoCantidad.setAttribute("aria-label", `Cantidad de ${nombreCompleto}`);
    campoCantidad.addEventListener("change", () => {
      const nuevaCantidad = Math.max(0, Number.parseFloat(campoCantidad.value) || 0);
      actualizarCantidad(item.idPresentacion, nuevaCantidad, item.pieza);
    });

    const botonSumar = document.createElement("button");
    botonSumar.type = "button";
    botonSumar.className =
      "min-h-11 min-w-11 rounded-r-lg border-2 border-l-0 border-elite-borderstrong bg-white text-lg font-bold text-elite-ink disabled:cursor-not-allowed disabled:opacity-50 dark:border-elitenight-border dark:bg-elitenight-bg dark:text-elitenight-text";
    botonSumar.textContent = "+";
    botonSumar.setAttribute("aria-label", `Sumar una unidad de ${nombreCompleto}`);
    botonSumar.disabled = item.stock != null && item.cantidad >= item.stock;
    botonSumar.addEventListener("click", () => actualizarCantidad(item.idPresentacion, item.cantidad + 1, item.pieza));
    // Una banda elegida tiene su medida: no se suma ni se resta, solo se quita
    if (item.pieza) {
      botonRestar.disabled = true;
      botonSumar.disabled = true;
      campoCantidad.readOnly = true;
    }

    grupoCantidad.append(botonRestar, campoCantidad, botonSumar);

    const subtotal = document.createElement("p");
    subtotal.className = "m-0 w-24 text-right font-bold text-elite-cuero dark:text-elitenight-cuero";
    subtotal.textContent = formatearMoneda(item.subtotal);
    // Descuento por volumen (lo calcula la base sumando tallas y colores del producto)
    if (item.descuento > 0 && item.descuentoVolumen) {
      const lista = document.createElement("s");
      lista.className = "block text-sm font-normal text-elite-text dark:text-elitenight-text";
      lista.textContent = formatearMoneda(item.subtotalLista);
      const etiqueta = document.createElement("span");
      etiqueta.className = "block text-xs font-semibold text-elite-dark dark:text-elitenight-dark";
      etiqueta.textContent = `−${item.descuentoVolumen.porcentaje} % por volumen`;
      subtotal.prepend(lista);
      subtotal.append(etiqueta);
    }

    botonEliminar.setAttribute("aria-label", `Eliminar ${nombreCompleto} de la lista`);
    li.append(img, info, grupoCantidad, subtotal, botonEliminar);
    return li;
  }

  function renderizar(carrito) {
    const items = carrito.items;
    listaCarrito.innerHTML = "";
    const fragmento = document.createDocumentFragment();
    items.forEach((item) => fragmento.append(crearFilaCarrito(item)));
    listaCarrito.append(fragmento);

    carritoVacio.hidden = items.length !== 0;
    listaCarrito.hidden = items.length === 0;
    botonVaciar.hidden = items.length === 0;

    // El total lo calcula quien resuelve el carrito (la API, con precios de la base)
    totalCarritoEl.textContent = formatearMoneda(carrito.total);
    const ahorroEl = document.getElementById("ahorroCarrito");
    if (ahorroEl) {
      ahorroEl.hidden = !(carrito.ahorro > 0);
      ahorroEl.textContent = carrito.ahorro > 0 ? `Incluye ${formatearMoneda(carrito.ahorro)} de descuento por volumen.` : "";
    }
    const unidades = carrito.totalUnidades;
    contadorItemsEl.textContent = unidades === 1 ? "1 producto" : `${unidades} productos`;
  }

  botonVaciar.addEventListener("click", () => {
    if (!window.confirm("¿Vaciar toda la lista de cotización?")) return;
    CarritoCE.vaciar()
      .then(ocultarAvisoAlmacenamiento)
      .catch((error) => avisarError(error, "No se pudo vaciar la lista."));
  });

  document.addEventListener("ce:carrito-actualizado", (evento) => {
    renderizar(evento.detail);
    AlmacenCE.cookies.obtenerUltimaActualizacion().then(pintarUltimaActualizacion);
  });

  // ---- Historial de pedidos (IndexedDB) ----
  // Se arma con nodos y textContent (no innerHTML): el nombre lo escribe el usuario
  // y ahora admite signos como "&" o "/".
  function crearFilaHistorial(pedido) {
    const li = document.createElement("li");
    li.className =
      "flex flex-wrap items-center gap-3 rounded-lg border border-elite-border p-3 text-sm dark:border-elitenight-border";
    const fecha = new Date(pedido.fecha).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
    const medio = pedido.medio === "whatsapp" ? "WhatsApp" : "correo";
    const cantidadProductos = pedido.items.length === 1 ? "1 producto" : `${pedido.items.length} productos`;

    const resumen = document.createElement("p");
    resumen.className = "m-0 flex-1";
    const time = document.createElement("time");
    time.dateTime = pedido.fecha;
    time.textContent = fecha;
    const total = document.createElement("strong");
    total.textContent = formatearMoneda(pedido.total);
    const solicitante = pedido.nombre ? ` — ${pedido.nombre}` : "";
    const origen = pedido.idPedido ? ` (pedido web #${pedido.idPedido})` : ` (enviado por ${medio})`;
    resumen.append(time, `${solicitante} — ${cantidadProductos} — `, total, origen);

    // Pedido real en la base: su estado actual lo dice la tienda, no este navegador
    if (pedido.tokenPedido && CarritoCE.estadoPedido) {
      const estadoEl = document.createElement("span");
      estadoEl.className = "mt-1 block text-sm";
      estadoEl.textContent = "Consultando el estado en la tienda…";
      resumen.append(estadoEl);
      CarritoCE.estadoPedido(pedido.tokenPedido)
        .then((estado) => {
          const comprobante = estado.comprobanteVenta ? ` · comprobante ${estado.comprobanteVenta}` : "";
          estadoEl.textContent = `Estado en la tienda: ${estado.estadoNombre}${comprobante}`;
        })
        .catch(() => estadoEl.remove());
    }

    // SOAR / chunking: un pedido frecuente se repite con una sola acción.
    const botonRepetir = document.createElement("button");
    botonRepetir.type = "button";
    botonRepetir.className =
      "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-elite-borderstrong bg-white px-4 font-bold text-elite-ink transition-colors hover:bg-elite-tint dark:border-elitenight-border dark:bg-elitenight-bg dark:text-elitenight-text dark:hover:bg-elitenight-tint";
    botonRepetir.textContent = "Volver a pedir";
    botonRepetir.setAttribute("aria-label", `Volver a pedir la cotización del ${fecha}`);
    botonRepetir.addEventListener("click", () => volverAPedir(pedido));

    li.append(resumen, botonRepetir);
    return li;
  }

  function volverAPedir(pedido) {
    // Cotizaciones guardadas antes de las presentaciones solo tienen el código del
    // producto (item.id): sin la base sirven (se toma su primer color); con la base
    // no, porque no dicen qué color era.
    const conPresentacion = (item) =>
      item.idPresentacion ?? (CarritoCE.usaBaseDeDatos ? null : item.id);
    const vigentes = pedido.items.filter((item) => conPresentacion(item) != null);
    const retirados = pedido.items.length - vigentes.length;
    if (vigentes.length === 0) {
      estadoHistorial.textContent = "Esa cotización es de una versión anterior de la tienda: arma la lista desde el catálogo.";
      return;
    }
    // La base valida existencias: si algo ya no alcanza, avisa y no cambia nada
    CarritoCE.agregarVarios(vigentes.map((item) => ({ idPresentacion: conPresentacion(item), cantidad: item.cantidad })))
      .then(() => {
        const agregados = vigentes.length === 1 ? "1 producto" : `${vigentes.length} productos`;
        const aviso = retirados > 0 ? ` (${retirados} no se pudieron reponer)` : "";
        estadoHistorial.textContent = `Se agregaron ${agregados} a tu lista de cotización${aviso}.`;
        ocultarAvisoAlmacenamiento();
      })
      .catch((error) => {
        estadoHistorial.textContent = `No se pudo volver a pedir: ${error.mensaje ?? "intenta de nuevo."}`;
      });
  }

  function renderizarHistorial() {
    return AlmacenCE.pedidos
      .listar()
      .then((pedidosGuardados) => {
        avisoHistorial.hidden = true;
        if (pedidosGuardados.length === 0) {
          seccionHistorial.hidden = true;
          return;
        }
        seccionHistorial.hidden = false;
        listaHistorial.innerHTML = "";
        pedidosGuardados.forEach((pedido) => listaHistorial.append(crearFilaHistorial(pedido)));
      })
      .catch((error) => {
        seccionHistorial.hidden = false;
        avisoHistorial.hidden = false;
        avisoHistorial.textContent = error.mensaje ?? "No se pudo cargar el historial de pedidos en este navegador.";
        listaHistorial.innerHTML = "";
      });
  }

  // ---- Checkout: validación + envío por WhatsApp/correo ----
  function validarCorreoCheckout() {
    return validarCampoCE({
      input: campoCorreoCheckout,
      errorEl: document.getElementById("errorCorreoCheckout"),
      patron: patrones.correo,
      mensajeError: mensajesError.correo,
    });
  }

  function validarTelefonoCheckout() {
    return validarCampoCE({
      input: campoTelefonoCheckout,
      errorEl: document.getElementById("errorTelefonoCheckout"),
      patron: patrones.telefono,
      mensajeError: mensajesError.telefono,
      opcional: true,
      normalizar: normalizarTelefono,
    });
  }

  function validarNombreCheckout() {
    return validarCampoCE({
      input: campoNombreCheckout,
      errorEl: document.getElementById("errorNombreCheckout"),
      patron: patrones.nombre,
      mensajeError: mensajesError.nombre,
    });
  }

  campoNombreCheckout.addEventListener("blur", validarNombreCheckout);
  campoCorreoCheckout.addEventListener("blur", validarCorreoCheckout);
  campoTelefonoCheckout.addEventListener("blur", validarTelefonoCheckout);

  function mostrarEstadoCheckout(texto, esError) {
    estadoCheckout.hidden = false;
    estadoCheckout.className = esError
      ? "mb-5 rounded-lg border-2 border-error bg-error-tint p-4 text-error dark:border-error-dark dark:bg-error-darktint dark:text-error-dark"
      : "mb-5 rounded-lg border-2 border-elite-dark bg-elite-tint p-4 dark:border-elitenight-dark dark:bg-elitenight-tint";
    estadoCheckout.textContent = texto;
  }

  function construirMensajePedido(nombre, carrito, idPedido = null) {
    const lineas = carrito.items.map((item) => {
      const color = item.color ? `, color ${item.color}` : "";
      return `${item.nombre} (${item.codigo}${color}) — ${item.presentacion} x${item.cantidad} — ${formatearMoneda(item.subtotal)}`;
    });
    const encabezado = idPedido ? `Pedido web #${idPedido} — Comercial Elite` : "Cotización Comercial Elite";
    const ahorro = carrito.ahorro > 0 ? `\nIncluye descuento por volumen: -${formatearMoneda(carrito.ahorro)}` : "";
    const nota = campoMensajeCheckout.value.trim();
    return (
      `${encabezado}\nSolicitada por: ${nombre}\n\n${lineas.join("\n")}\n\n` +
      `Total referencial (IVA incluido): ${formatearMoneda(carrito.total)}${ahorro}` +
      (nota ? `\n\nMensaje: ${nota}` : "")
    );
  }

  // Con la base (CarritoCE.confirmarPedido existe): el pedido se registra de
  // verdad — el carrito se convierte en un pedido WEB en estado PENDIENTE, con
  // el precio y la oferta vigentes que fija la propia base — y recién después
  // se abre WhatsApp/correo para coordinar el pago y la entrega. Aquí no hace
  // falta la confirmación en dos pasos del flujo sin base: la fuente de verdad
  // del pedido es la base, no el mensaje.
  function confirmarPedidoEnBase(medio, carrito) {
    const nombre = campoNombreCheckout.value.trim();
    const correo = campoCorreoCheckout.value.trim();
    const telefono = normalizarTelefono(campoTelefonoCheckout.value.trim());
    const itemsEnviados = carrito.items.map((item) => ({
      idPresentacion: item.idPresentacion,
      id: item.codigo,
      nombre: item.nombre,
      color: item.color,
      presentacion: item.presentacion,
      cantidad: item.cantidad,
      precio: item.precioUnitario,
      subtotal: item.subtotal,
    }));

    AlmacenCE.sesionCliente.guardarNombre(nombre).catch(() => {});
    if (casillaRecordar.checked) {
      AlmacenCE.registro.guardar({ correo, telefono }).catch(() => {});
    }

    const nota = campoMensajeCheckout.value.trim().slice(0, 200);
    CarritoCE.confirmarPedido(
      { nombres: nombre, correo, telefono: telefono || null },
      `Contacto preferido: ${medio === "whatsapp" ? "WhatsApp" : "correo"}${nota ? `. Mensaje: ${nota}` : ""}`
    )
      .then(({ pedido, tokenPedido }) => {
        const mensaje = construirMensajePedido(nombre, carrito, pedido.idPedido);
        if (medio === "whatsapp") {
          const numero = empresa.telefono.replace(/\D/g, "");
          window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
        } else {
          const asunto = encodeURIComponent(`Pedido web #${pedido.idPedido} — Comercial Elite`);
          window.location.href = `mailto:${empresa.correo}?subject=${asunto}&body=${encodeURIComponent(mensaje)}`;
        }
        mostrarEstadoCheckout(
          `Tu pedido web #${pedido.idPedido} quedó registrado en la tienda (${(pedido.estadoNombre ?? "pendiente").toLowerCase()}) por ${formatearMoneda(pedido.total)}. Te contactaremos para coordinar el pago y la entrega.`,
          false
        );
        // Copia local para el historial; si falla, el pedido igual está en la base
        return AlmacenCE.pedidos
          .agregar({
            fecha: new Date().toISOString(),
            nombre,
            medio,
            items: itemsEnviados,
            total: pedido.total,
            idPedido: pedido.idPedido,
            tokenPedido,
          })
          .then(renderizarHistorial)
          .catch(() => {});
      })
      .catch((error) =>
        mostrarEstadoCheckout(error.mensaje ?? "No se pudo registrar el pedido. Intenta de nuevo.", true)
      );
  }

  function mostrarConfirmacionEnvio(medio, moverFoco) {
    textoConfirmacionEnvio.textContent =
      medio === "whatsapp"
        ? "Abrimos WhatsApp con tu lista preparada para enviar. Si ya pulsaste enviar allí, confírmalo aquí; si no, tu lista se conserva."
        : "Abrimos tu programa de correo con la lista preparada para enviar. Si ya pulsaste enviar allí, confírmalo aquí; si no, tu lista se conserva.";
    confirmacionEnvio.hidden = false;
    if (moverFoco) tituloConfirmacionEnvio.focus();
  }

  function enviarPedido(medio) {
    const campos = [
      [campoNombreCheckout, validarNombreCheckout()],
      [campoCorreoCheckout, validarCorreoCheckout()],
      [campoTelefonoCheckout, validarTelefonoCheckout()],
    ];
    const invalidos = campos.filter(([, valido]) => !valido).map(([input]) => input);
    if (invalidos.length > 0) {
      mostrarEstadoCheckout(resumirErrores(invalidos, "enviar"), true);
      return;
    }
    if (!empresa) {
      mostrarEstadoCheckout("Todavía estamos cargando los datos de contacto. Intenta de nuevo en un momento.", true);
      return;
    }

    CarritoCE.obtener().then((carrito) => {
      if (carrito.items.length === 0) {
        mostrarEstadoCheckout("Tu lista de cotización está vacía.", true);
        return;
      }
      // Como en una tienda en línea: no se envía lo que no se puede atender
      const conProblemas = carrito.items.filter((item) => !item.publicada || item.stock === 0 || excedeStock(item));
      if (conProblemas.length > 0) {
        mostrarEstadoCheckout(
          `Revisa tu lista antes de enviar: ${conProblemas.map((i) => `${i.nombre}${i.color ? ` (${i.color})` : ""}`).join(", ")} no tiene existencias suficientes.`,
          true
        );
        return;
      }

      // Con API, el checkout real es contra la base (carrito -> pedido WEB)
      if (CarritoCE.confirmarPedido) {
        confirmarPedidoEnBase(medio, carrito);
        return;
      }

      const total = carrito.total;
      const nombre = campoNombreCheckout.value.trim();
      const correo = campoCorreoCheckout.value.trim();
      const telefono = normalizarTelefono(campoTelefonoCheckout.value.trim());
      const mensaje = construirMensajePedido(nombre, carrito);

      if (medio === "whatsapp") {
        const numero = empresa.telefono.replace(/\D/g, "");
        window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
      } else {
        const asunto = encodeURIComponent("Cotización de insumos — Comercial Elite");
        window.location.href = `mailto:${empresa.correo}?subject=${asunto}&body=${encodeURIComponent(mensaje)}`;
      }

      // Copia de lo que se envió: si el usuario confirma, esto es lo que va al
      // historial, aunque después edite la lista.
      const itemsEnviados = carrito.items.map((item) => ({
        idPresentacion: item.idPresentacion,
        id: item.codigo,
        nombre: item.nombre,
        color: item.color,
        presentacion: item.presentacion,
        cantidad: item.cantidad,
        precio: item.precioUnitario,
        subtotal: item.subtotal,
      }));

      // El nombre/empresa es solo de esta sesión (sessionStorage). Correo y teléfono
      // se guardan de forma permanente SOLO si el usuario marcó la casilla
      // (auditoría IHC, H9: nada de guardar datos personales sin permiso).
      AlmacenCE.sesionCliente.guardarNombre(nombre).catch(() => {});
      if (casillaRecordar.checked) {
        AlmacenCE.registro.guardar({ correo, telefono }).catch(() => {});
      }

      // Auditoría IHC, H2: el sitio no sabe si el mensaje salió, así que NO vacía la
      // lista: pregunta. La lista se vacía recién en confirmarEnvio().
      AlmacenCE.envioPendiente
        .guardar({ fecha: new Date().toISOString(), nombre, medio, items: itemsEnviados, total })
        .catch(() => {})
        .then(() => {
          estadoCheckout.hidden = true;
          mostrarConfirmacionEnvio(medio, true);
        });
    });
  }

  function confirmarEnvio() {
    AlmacenCE.envioPendiente.obtener().then((envio) => {
      confirmacionEnvio.hidden = true;
      AlmacenCE.envioPendiente.borrar();
      const guardarHistorial = envio
        ? AlmacenCE.pedidos
            .agregar(envio)
            .then(renderizarHistorial)
            .catch((error) => {
              seccionHistorial.hidden = false;
              avisoHistorial.hidden = false;
              avisoHistorial.textContent = error.mensaje ?? "No se pudo guardar la cotización en el historial.";
            })
        : Promise.resolve();
      guardarHistorial
        .then(() => CarritoCE.vaciar())
        .then(() => {
          mostrarEstadoCheckout(
            "Listo: vaciamos tu lista y guardamos el envío en tu historial. Desde ahí puedes volver a pedirlo.",
            false
          );
        })
        .catch((error) => mostrarAvisoAlmacenamiento(error.mensaje ?? "No se pudo vaciar la lista."));
    });
  }

  function conservarLista() {
    AlmacenCE.envioPendiente.borrar();
    confirmacionEnvio.hidden = true;
    mostrarEstadoCheckout("Tu lista sigue guardada. Puedes enviarla de nuevo cuando quieras.", false);
  }

  document.getElementById("botonConfirmarEnvio").addEventListener("click", confirmarEnvio);
  document.getElementById("botonConservarLista").addEventListener("click", conservarLista);

  // WhatsApp es el botón submit del formulario: así Enter en cualquier campo envía
  // el pedido por el medio principal (WCAG H32), igual que hacer clic en el botón.
  document.getElementById("formularioCheckout").addEventListener("submit", (evento) => {
    evento.preventDefault();
    enviarPedido("whatsapp");
  });
  document.getElementById("botonEnviarCorreo").addEventListener("click", () => enviarPedido("correo"));

  // Borrar lo recordado: correo y teléfono salen del navegador y la casilla se
  // desmarca. Cuando exista la configuración de la cuenta, esto se mudará allí.
  botonOlvidarDatos.addEventListener("click", () => {
    AlmacenCE.registro
      .borrar()
      .then(() => {
        casillaRecordar.checked = false;
        campoCorreoCheckout.value = "";
        campoTelefonoCheckout.value = "";
        botonOlvidarDatos.hidden = true;
        mostrarAvisoAlmacenamiento("Listo: este navegador ya no recuerda tu correo ni tu teléfono.");
      })
      .catch(() => mostrarAvisoAlmacenamiento("No se pudieron borrar tus datos de este navegador."));
  });

  // ---- Carga inicial ----
  Promise.all([
    CatalogoCE.cargar(),
    CarritoCE.obtener(),
    AlmacenCE.registro.obtener().catch(() => null),
    AlmacenCE.sesionCliente.obtenerNombre().catch(() => null),
    AlmacenCE.cookies.obtenerUltimaActualizacion().catch(() => null),
    AlmacenCE.envioPendiente.obtener().catch(() => null),
  ])
    .then(([datosCatalogo, datosCarrito, datosRegistro, nombreSesion, fechaActualizacion, envio]) => {
      empresa = datosCatalogo.empresa;
      renderizar(datosCarrito);
      pintarUltimaActualizacion(fechaActualizacion);
      if (nombreSesion && !campoNombreCheckout.value) campoNombreCheckout.value = nombreSesion;
      if (datosRegistro) {
        if (!campoCorreoCheckout.value) campoCorreoCheckout.value = datosRegistro.correo || "";
        if (!campoTelefonoCheckout.value) campoTelefonoCheckout.value = datosRegistro.telefono || "";
        // Ya dio permiso antes (esta misma casilla).
        casillaRecordar.checked = true;
        botonOlvidarDatos.hidden = false;
      }
      // Volvió de WhatsApp/correo y la pestaña se recargó: se repite la pregunta.
      if (envio && datosCarrito.items.length > 0) mostrarConfirmacionEnvio(envio.medio, false);
      return renderizarHistorial();
    })
    .catch((error) => {
      console.error("No se pudo cargar el carrito:", error);
      mostrarAvisoAlmacenamiento(
        error.mensaje ?? "No pudimos cargar tu lista de cotización. Intenta recargar la página."
      );
    });
})();
