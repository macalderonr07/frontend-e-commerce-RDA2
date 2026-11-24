// Badge de la lista de cotización en el header: se repite en las 7 páginas. Se mantiene al día
// consultando CarritoCE al cargar y escuchando "ce:carrito-actualizado" (lo dispara
// js/api.js en cada cambio, con el carrito resuelto), así no depende de qué página lo cambió.
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
