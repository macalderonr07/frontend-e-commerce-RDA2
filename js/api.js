// Capa de datos de la tienda. Expone dos módulos:
//
//  window.CatalogoCE.cargar() -> Promesa con { empresa, categorias, productos, origen }
//    Cada producto trae sus "presentaciones": lo que de verdad se vende según el
//    modelo de la base (variante = color, presentación = forma de venta), cada una
//    con su id, precio final con IVA y existencias disponibles.
//
//  window.CarritoCE -> el carrito según el modelo de la base:
//    · sus líneas son PRESENTACIONES (no productos) con una cantidad;
//    · no guarda precios: se leen del catálogo vigente en cada consulta;
//    · un visitante sin cuenta se reconoce por el token del carrito;
//    · con API, el checkout es real: confirmarPedido() identifica al cliente y
//      convierte el carrito en un pedido WEB en la base (estado PENDIENTE).
//    Toda operación devuelve el carrito "resuelto" ({ items, total, totalUnidades })
//    y avisa con el evento "ce:carrito-actualizado" (detail = carrito resuelto).
//
// De dónde salen los datos:
//  · Con API (en localhost): de la base Oracle a través de proyecto/servidor. El
//    catálogo y el carrito viven en la base; si la API no responde, se muestra el
//    error (no se cae a datos viejos sin avisar).
//  · Sin API (GitHub Pages, pruebas E2E con window.CE_API_URL = ""):
//    data/catalogo.json y un carrito en localStorage con la misma forma.
//  "empresa" (teléfono, correo, horario) siempre sale de data/catalogo.json.
(() => {
  // window.CE_API_URL, si se define antes de este script, manda: una URL fuerza esa
  // API y "" la desactiva.
  const EN_LOCAL = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const URL_API =
    "CE_API_URL" in window
      ? window.CE_API_URL || null
      : EN_LOCAL
        ? `http://${window.location.hostname}:5050/api/v1`
        : null;
  const ESPERA_MS = 6000;
  const POR_PAGINA = 100; // máximo que acepta la API

  function crearError(mensaje, extra = {}) {
    const error = new Error(mensaje);
    error.mensaje = mensaje;
    return Object.assign(error, extra);
  }

  // fetch con tiempo límite y errores de la API en español ({ status, message, detalles })
  async function pedir(url, { metodo = "GET", cuerpo } = {}) {
    const control = new AbortController();
    const temporizador = window.setTimeout(() => control.abort(), ESPERA_MS);
    let respuesta;
    try {
      respuesta = await fetch(url, {
        method: metodo,
        signal: control.signal,
        headers: { Accept: "application/json", ...(cuerpo ? { "Content-Type": "application/json" } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
    } catch {
      throw crearError("No pudimos conectar con la tienda. Revisa tu conexión e intenta de nuevo.", { status: 0 });
    } finally {
      window.clearTimeout(temporizador);
    }
    if (respuesta.status === 204) return null;
    const json = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      // El detalle de la API ya viene en español y dice qué pasó ("solo hay 2 disponibles")
      const detalle = json?.detalles?.[0]?.mensaje;
      throw crearError(detalle ?? json?.message ?? `Error ${respuesta.status}`, {
        status: respuesta.status,
        detalles: json?.detalles ?? [],
      });
    }
    return json;
  }

  // ======================================================== Catálogo
  async function productosDeLaApi() {
    const productos = [];
    for (let pagina = 1; ; pagina += 1) {
      const respuesta = await pedir(`${URL_API}/productos?limit=${POR_PAGINA}&page=${pagina}`);
      productos.push(...respuesta.data);
      if (pagina >= respuesta.meta.totalPages) return productos;
    }
  }

  // Las descripciones de la base vienen en ASCII ("Pie2"): se muestran bonitas
  const nombrePresentacion = (texto) => (texto ?? "").replace(/\bPie2\b/g, "Pie²");

  // Producto de la API -> forma que usan las páginas (la de data/catalogo.json + presentaciones)
  function adaptarProductoApi(p) {
    const alt = `Foto de ${p.nombre}`;
    return {
      id: p.codigo,
      nombre: p.nombre,
      categoria: p.linea.codigo,
      subcategoria: p.subcategoria,
      unidad: p.unidad, // { codigo, nombre }: unidad en la que se lleva el inventario
      presentacion: nombrePresentacion(p.presentacion),
      precio: p.precio,
      precioSinOferta: p.precioSinOferta,
      colores: p.colores,
      uso: p.uso ?? "",
      imagen: p.imagenUrl,
      alt,
      imagenes: p.imagenUrl ? [{ src: p.imagenUrl, alt }] : [],
      novedad: p.novedad,
      fechaIngreso: p.fechaIngreso,
      stockTotal: p.stockTotal,
      agotado: p.agotado,
      // Venta por pieza (cuero): cada lote es una pieza física (banda) y una
      // línea sale de una sola pieza. "piezas" solo viene en el detalle:
      // { "CE-1043-01": [{ codigo, saldo }, ...] } de menor a mayor.
      // Cortes estándar (fibra de caucho): piezas de medida fija que la base corta
      // de la plancha al pedir. No usan el módulo de bandas: se venden por cantidad.
      cortesEstandar: p.cortesEstandar === true,
      porPieza: p.porPieza === true && p.cortesEstandar !== true,
      piezas: p.piezas ?? null,
      marca: p.marca ?? null, // opcional
      // Descuento por volumen: [{ desde, porcentaje, unidad }] (lo aplica la base al pedir)
      descuentosVolumen: p.descuentosVolumen ?? [],
      presentaciones: p.presentaciones.map((x) => ({
        id: x.idPresentacion,
        sku: x.sku,
        color: x.color,
        caracteristicas: x.caracteristicas, // { Color: "Negro", ... } de la base
        descripcion: nombrePresentacion(x.descripcion),
        precio: x.precioFinal,
        precioSinOferta: x.oferta ? x.precio : null,
        oferta: x.oferta,
        disponible: x.disponible,
        cantidadMinima: x.cantidadMinima,
        // la cantidad va en múltiplos de esto (cuero por pie²: 0.01; lo demás: 1)
        incremento: x.incremento ?? 1,
        factor: x.factor ?? 1,
        corteDe: x.corteDe ?? null, // fibra: de que pieza sale este corte (dos ramas: fracciones y pies)
      })),
    };
  }

  // Sin API: cada color del JSON pasa a ser una presentación con id "CODIGO::Color".
  // No hay existencias reales (disponible = null: no se limita la cantidad).
  function adaptarProductoLocal(p) {
    return {
      ...p,
      unidad: null, // el JSON no trae unidad de medida
      stockTotal: null,
      agotado: false,
      presentaciones: (p.colores.length > 0 ? p.colores : [null]).map((color) => ({
        id: color ? `${p.id}::${color}` : p.id,
        sku: null,
        color,
        caracteristicas: color ? { Color: color } : {},
        descripcion: p.presentacion,
        precio: p.precio,
        precioSinOferta: null,
        oferta: null,
        disponible: null,
        cantidadMinima: 1,
      })),
    };
  }

  let promesaCatalogo = null; // una sola carga por página aunque varios scripts la pidan

  function cargar() {
    if (promesaCatalogo) return promesaCatalogo;
    const local = pedir("data/catalogo.json");
    if (!URL_API) {
      promesaCatalogo = local.then((datos) => ({
        ...datos,
        productos: datos.productos.map(adaptarProductoLocal),
        origen: "local",
      }));
    } else {
      promesaCatalogo = Promise.all([local, pedir(`${URL_API}/categorias`), productosDeLaApi()]).then(
        ([datos, categorias, productos]) => ({
          empresa: datos.empresa,
          // Solo categorías PRINCIPALES (la base excluye las subcategorías)
          categorias: categorias.data.map((c) => ({
            slug: c.codigo,
            nombre: c.nombre,
            subcategorias: c.subcategorias,
            productos: c.productos,
            imagen: c.imagenUrl,
          })),
          productos: productos.map(adaptarProductoApi),
          origen: "api",
        })
      );
    }
    // Si falla, la próxima llamada lo vuelve a intentar
    promesaCatalogo.catch(() => {
      promesaCatalogo = null;
    });
    return promesaCatalogo;
  }

  // Muestra visual de cada color del catálogo (fondo CSS del círculo junto al
  // nombre). Es decorativa: el nombre del color siempre se muestra en texto.
  const MUESTRAS = {
    negro: "#1a1a1a", "café": "#6b4423", miel: "#c8902e", camel: "#c19a6b", blanco: "#ffffff",
    natural: "#e8d8b8", beige: "#e3cfa8", "ámbar": "#ffbf00", plateado: "#c0c0c0", dorado: "#d4af37",
    acero: "#8a9199", "madera y acero": "linear-gradient(135deg, #8b5a2b 50%, #8a9199 50%)",
    transparente: "repeating-conic-gradient(#d9d9d9 0 25%, #ffffff 0 50%) 0 0 / 8px 8px",
  };
  const muestraColor = (color) => MUESTRAS[(color ?? "").toLowerCase()] ?? "#9ca3af";

  // Detalle de un producto (GET /productos/:codigo). Solo con API: trae lo que
  // el listado no incluye, como las piezas físicas de los productos por pieza.
  async function detalle(id) {
    if (!URL_API) return null;
    const respuesta = await pedir(`${URL_API}/productos/${encodeURIComponent(id)}`);
    return respuesta?.data ? adaptarProductoApi(respuesta.data) : null;
  }

  // Combos que incluyen un producto (GET /combos?producto=). Solo con API: un
  // combo es una receta de presentaciones de la base; sin API no hay combos.
  async function combosDe(codigoProducto) {
    if (!URL_API) return [];
    const respuesta = await pedir(`${URL_API}/combos?producto=${encodeURIComponent(codigoProducto)}`);
    return (respuesta?.data ?? []).map((c) => ({
      ...c,
      componentes: c.componentes.map((x) => ({ ...x, presentacion: nombrePresentacion(x.presentacion) })),
    }));
  }

  window.CatalogoCE = { cargar, detalle, combosDe, muestraColor, urlApi: URL_API, controlaStock: Boolean(URL_API) };

  // ======================================================== Carrito
  const VACIO = Object.freeze({ items: [], total: 0, totalUnidades: 0 });
  const redondear = (n) => Math.round(n * 100) / 100;

  function anunciar(carrito) {
    document.dispatchEvent(new CustomEvent("ce:carrito-actualizado", { detail: carrito }));
    window.AlmacenCE?.cookies.marcarActualizacion().catch(() => {});
    return carrito;
  }

  // ---- En la base (API) ----
  const remoto = {
    async token() {
      return window.AlmacenCE ? AlmacenCE.tokenCarrito.obtener().catch(() => null) : null;
    },

    resolver(c) {
      return {
        items: c.items.map((i) => ({
          idPresentacion: i.idPresentacion,
          // banda elegida (productos por pieza); null = la asigna la base al pedir
          pieza: i.pieza ?? null,
          piezaCodigo: i.piezaCodigo ?? null,
          codigo: i.codigo,
          nombre: i.nombre ?? "Producto retirado",
          color: i.color,
          talla: i.talla ?? null,
          presentacion: nombrePresentacion(i.presentacion),
          imagenUrl: i.imagenUrl,
          cantidad: i.cantidad,
          precioUnitario: i.precioUnitario,
          subtotalLista: i.subtotalLista ?? i.subtotal,
          descuento: i.descuento ?? 0,
          descuentoVolumen: i.descuentoVolumen ?? null, // { porcentaje, desde, unidad }
          subtotal: i.subtotal,
          stock: i.publicada ? i.stock : 0,
          publicada: i.publicada,
        })),
        ahorro: c.ahorro ?? 0,
        total: c.total,
        totalUnidades: c.totalUnidades,
      };
    },

    async obtener() {
      const token = await this.token();
      if (!token) return VACIO;
      try {
        return this.resolver((await pedir(`${URL_API}/carritos/${token}`)).data);
      } catch (error) {
        // El carrito ya no existe en la base (se borró o la base se reinstaló)
        if (error.status === 404 || error.status === 422) {
          await AlmacenCE.tokenCarrito.borrar().catch(() => {});
          return VACIO;
        }
        throw error;
      }
    },

    // Ejecuta una operación sobre el carrito; lo crea si aún no existe y, si el token
    // guardado ya no vale (404), crea uno nuevo y reintenta una vez.
    async conCarrito(operacion) {
      let token = await this.token();
      for (let intento = 0; intento < 2; intento += 1) {
        if (!token) {
          token = (await pedir(`${URL_API}/carritos`, { metodo: "POST" })).data.token;
          await AlmacenCE.tokenCarrito.guardar(token).catch(() => {});
        }
        try {
          return await operacion(token);
        } catch (error) {
          const carritoPerdido = error.status === 404 && /carrito/i.test(error.mensaje);
          if (!carritoPerdido || intento === 1) throw error;
          await AlmacenCE.tokenCarrito.borrar().catch(() => {});
          token = null;
        }
      }
      return VACIO;
    },

    agregar(idPresentacion, cantidad, pieza = null) {
      const cuerpo = { idPresentacion, cantidad, ...(pieza ? { pieza } : {}) };
      return this.conCarrito(async (token) =>
        this.resolver((await pedir(`${URL_API}/carritos/${token}/items`, { metodo: "POST", cuerpo })).data)
      );
    },

    // Un combo entra como sus líneas reales, en una sola transacción de la base
    agregarCombo(codigo, color, cantidad) {
      return this.conCarrito(async (token) =>
        this.resolver(
          (await pedir(`${URL_API}/carritos/${token}/combos`, { metodo: "POST", cuerpo: { codigo, color, cantidad } }))
            .data
        )
      );
    },

    // La línea se identifica por presentación + pieza (cada banda es su propia línea)
    cambiarCantidad(idPresentacion, cantidad, pieza = null) {
      if (cantidad <= 0) return this.quitar(idPresentacion, pieza);
      const conPieza = pieza ? `?pieza=${encodeURIComponent(pieza)}` : "";
      return this.conCarrito(async (token) =>
        this.resolver(
          (
            await pedir(`${URL_API}/carritos/${token}/items/${idPresentacion}${conPieza}`, {
              metodo: "PATCH",
              cuerpo: { cantidad },
            })
          ).data
        )
      );
    },

    quitar(idPresentacion, pieza = null) {
      const conPieza = pieza ? `?pieza=${encodeURIComponent(pieza)}` : "";
      return this.conCarrito(async (token) => {
        await pedir(`${URL_API}/carritos/${token}/items/${idPresentacion}${conPieza}`, { metodo: "DELETE" });
        return this.obtener();
      });
    },

    // PUT reemplaza todas las líneas de una vez (atómico en la base)
    reemplazar(lineas) {
      return this.conCarrito(async (token) =>
        this.resolver(
          (
            await pedir(`${URL_API}/carritos/${token}/items`, {
              metodo: "PUT",
              cuerpo: {
                items: lineas.map(({ idPresentacion, cantidad, pieza }) => ({
                  idPresentacion,
                  cantidad,
                  ...(pieza ? { pieza } : {}),
                })),
              },
            })
          ).data
        )
      );
    },

    async vaciar() {
      return (await this.token()) ? this.reemplazar([]) : VACIO;
    },

    // ---- Checkout contra la base ----
    // Identifica al cliente del carrito (datos de invitado) y lo confirma como
    // pedido WEB: la base crea el pedido con el precio y la oferta VIGENTES y
    // valida las existencias (fn_crear_pedido_desde_carrito). El carrito queda
    // cerrado en la base como traza del pedido, así que su token deja de ser el
    // carrito activo y se devuelve aparte (tokenPedido) para seguir el estado.
    async confirmarPedido(datosCliente, observacion) {
      const token = await this.token();
      if (!token) throw crearError("Tu lista de cotización está vacía.", { status: 422 });
      try {
        await pedir(`${URL_API}/carritos/${token}/cliente`, { metodo: "POST", cuerpo: datosCliente });
        const pedido = (
          await pedir(`${URL_API}/carritos/${token}/pedido`, {
            metodo: "POST",
            cuerpo: observacion ? { observacion } : {},
          })
        ).data;
        await AlmacenCE.tokenCarrito.borrar().catch(() => {});
        return { pedido, tokenPedido: token };
      } catch (error) {
        // El carrito ya no existe en la base (se borró o la base se reinstaló)
        if (error.status === 404 && /carrito/i.test(error.mensaje)) {
          await AlmacenCE.tokenCarrito.borrar().catch(() => {});
          throw crearError("Tu lista ya no existe en la tienda. Vuelve a armarla desde el catálogo.", { status: 404 });
        }
        throw error;
      }
    },

    // Estado y total actuales del pedido de un carrito ya confirmado
    async estadoPedido(tokenPedido) {
      return (await pedir(`${URL_API}/carritos/${tokenPedido}/pedido`)).data;
    },
  };

  // ---- En el navegador (sin API) ----
  // Usa AlmacenCE.carrito (localStorage): cada línea { id: idPresentacion, cantidad }.
  // Los precios se resuelven contra el catálogo, igual que hace la base.
  const local = {
    async obtener() {
      const [guardado, catalogo] = await Promise.all([AlmacenCE.carrito.obtener(), cargar()]);
      const porId = new Map();
      catalogo.productos.forEach((p) =>
        p.presentaciones.forEach((pres) => porId.set(String(pres.id), { producto: p, pres }))
      );
      // Listas guardadas antes de las presentaciones: el id era el código del producto
      const resolverId = (id) =>
        porId.get(String(id)) ??
        (() => {
          const producto = catalogo.productos.find((p) => p.id === id);
          return producto ? { producto, pres: producto.presentaciones[0] } : null;
        })();

      const items = guardado.items.map(({ id, cantidad }) => {
        const encontrado = resolverId(id);
        if (!encontrado) {
          return { idPresentacion: id, codigo: null, nombre: "Producto retirado", cantidad, publicada: false,
                   precioUnitario: null, subtotal: null, stock: 0, color: null, presentacion: null, imagenUrl: null };
        }
        const { producto, pres } = encontrado;
        return {
          idPresentacion: id,
          codigo: producto.id,
          nombre: producto.nombre,
          color: pres.color,
          talla: pres.caracteristicas?.Talla ?? null,
          presentacion: pres.descripcion,
          imagenUrl: producto.imagen,
          cantidad,
          precioUnitario: pres.precio,
          subtotal: redondear(pres.precio * cantidad),
          stock: pres.disponible,
          publicada: true,
        };
      });
      return {
        items,
        total: redondear(items.reduce((s, i) => s + (i.subtotal ?? 0), 0)),
        totalUnidades: items.reduce((s, i) => s + i.cantidad, 0),
      };
    },

    // Si localStorage falla, AlmacenCE deja el cambio en memoria y rechaza con un aviso:
    // se devuelve el carrito igual y se propaga el aviso.
    async mutar(cambio) {
      let aviso = null;
      await cambio().catch((error) => {
        aviso = error;
      });
      const carrito = await this.obtener();
      if (aviso) throw Object.assign(aviso, { carrito });
      return carrito;
    },

    agregar(id, cantidad) {
      return this.mutar(() => AlmacenCE.carrito.agregarItem(id, cantidad));
    },
    cambiarCantidad(id, cantidad) {
      return this.mutar(() => AlmacenCE.carrito.actualizarCantidad(id, cantidad));
    },
    quitar(id) {
      return this.mutar(() => AlmacenCE.carrito.eliminarItem(id));
    },
    vaciar() {
      return this.mutar(() => AlmacenCE.carrito.vaciar());
    },
    reemplazar(lineas) {
      return this.mutar(() =>
        AlmacenCE.carrito
          .vaciar()
          .then(() => AlmacenCE.carrito.agregarVarios(lineas.map((l) => ({ id: l.idPresentacion, cantidad: l.cantidad }))))
      );
    },
  };

  const motor = URL_API ? remoto : local;

  // Toda mutación anuncia el carrito resultante (también si falló en el medio y
  // hay un carrito que mostrar, para que la página no quede desfasada).
  function mutacion(operacion) {
    return operacion().then(anunciar, (error) => {
      if (error.carrito) anunciar(error.carrito);
      throw error;
    });
  }

  window.CarritoCE = {
    obtener: () => motor.obtener(),
    agregar: (idPresentacion, cantidad = 1, pieza = null) =>
      mutacion(() => motor.agregar(idPresentacion, cantidad, pieza)),
    cambiarCantidad: (idPresentacion, cantidad, pieza = null) =>
      mutacion(() => motor.cambiarCantidad(idPresentacion, cantidad, pieza)),
    quitar: (idPresentacion, pieza = null) => mutacion(() => motor.quitar(idPresentacion, pieza)),
    vaciar: () => mutacion(() => motor.vaciar()),
    // "Volver a pedir": suma las líneas a lo que ya hay, en una sola operación
    agregarVarios: (lineas) =>
      mutacion(async () => {
        const actual = await motor.obtener();
        const suma = new Map(actual.items.map((i) => [String(i.idPresentacion), { ...i }]));
        lineas.forEach(({ idPresentacion, cantidad }) => {
          const clave = String(idPresentacion);
          const linea = suma.get(clave) ?? { idPresentacion, cantidad: 0 };
          linea.cantidad += cantidad;
          suma.set(clave, linea);
        });
        return motor.reemplazar([...suma.values()]);
      }),
    usaBaseDeDatos: Boolean(URL_API),
    // Solo con la base (los combos son recetas de la base)
    agregarCombo: URL_API
      ? (codigo, color, cantidad = 1) => mutacion(() => remoto.agregarCombo(codigo, color, cantidad))
      : null,
    // Solo con la base: sin API no hay pedidos reales (el checkout cae al envío
    // por WhatsApp/correo de siempre, ver js/carrito.js).
    confirmarPedido: URL_API
      ? (datosCliente, observacion) =>
          remoto.confirmarPedido(datosCliente, observacion).then((resultado) => {
            anunciar(VACIO); // el carrito activo ya no existe: nació el pedido
            return resultado;
          })
      : null,
    estadoPedido: URL_API ? (tokenPedido) => remoto.estadoPedido(tokenPedido) : null,
  };
})();
