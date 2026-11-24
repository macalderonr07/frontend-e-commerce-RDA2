// Badge de la lista de cotización en el header: se repite en las 7 páginas. Se mantiene al día
// consultando CarritoCE al cargar y escuchando "ce:carrito-actualizado" (lo dispara
// js/api.js en cada cambio, con el carrito resuelto), así no depende de qué página lo cambió.
// Acceso a la administración (último elemento del menú). El HTML trae la dirección
// publicada en GitHub Pages, que funciona aunque no corra JavaScript. Aquí se ajusta:
//  · window.CE_ADMIN_URL (lo escribe preparar-sitio con la variable del repositorio) manda;
//  · en localhost, la administración de desarrollo (puerto 8090).
(() => {
  const admin = document.getElementById("enlaceAdmin");
  if (!admin) return;
  const local = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (window.CE_ADMIN_URL) admin.href = window.CE_ADMIN_URL;
  else if (local) admin.href = `${window.location.protocol}//${window.location.hostname}:8090/`;
})();

(() => {
  const enlace = document.getElementById("enlaceCarrito");
  const contador = document.getElementById("contadorCarrito");
  if (!enlace || !contador || !window.CarritoCE) return;

  function pintar(cantidad, conPulso = false) {
    contador.textContent = String(cantidad);
    enlace.setAttribute(
      "aria-label",
      cantidad === 1 ? "Lista de cotización, 1 producto" : `Lista de cotización, ${cantidad} productos`
    );
    if (conPulso) {
      contador.classList.remove("carrito-pulso");
      // Reinicia la animación aunque dos cambios lleguen muy seguido.
      void contador.offsetWidth;
      contador.classList.add("carrito-pulso");
    }
  }

  CarritoCE.obtener()
    .then((carrito) => pintar(carrito.totalUnidades))
    .catch(() => pintar(0));

  document.addEventListener("ce:carrito-actualizado", (evento) => {
    pintar(evento.detail.totalUnidades, true);
  });
})();
