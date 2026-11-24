// Validación de formularios compartida: expone window.ValidacionCE para que
// el checkout de carrito.js (y los formularios que vengan, como la cuenta de usuario) usen los mismos patrones regex
// y el mismo feedback visual/accesible en vez de duplicarlos en cada página.
(() => {
  const patrones = {
    // Auditoría IHC, H3: la etiqueta dice "Nombre o empresa", así que se aceptan
    // nombres comerciales ("Calzado 2000", "Cueros Cía. Ltda.", "Pérez & Hijos"):
    // letras, números, espacios y . , & ' - /, con al menos una letra o número.
    nombre: /^(?=.*[\p{L}\p{N}])[\p{L}\p{M}\p{N}\s.,&'\/-]{2,80}$/u,
    correo: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
    // Se valida sobre el número ya normalizado (ver normalizarTelefono).
    telefono: /^[0-9]{7,10}$/,
    mensaje: /^.{5,600}$/s,
  };

  const mensajesError = {
    nombre: "Escribe tu nombre o el de tu empresa (2 a 80 caracteres). Puedes usar letras, números y . , & ' - /",
    correo: "Escribe un correo válido, por ejemplo nombre@empresa.com.",
    telefono: "El teléfono debe tener entre 7 y 10 dígitos, por ejemplo 098 785 5906 o +593 98 785 5906.",
    mensaje: "Cuéntanos brevemente qué producto o línea te interesa.",
  };

  // Auditoría IHC, H4: el propio sitio muestra su número como "098 785 5906", así
  // que se aceptan espacios, guiones, puntos, paréntesis y el prefijo de Ecuador
  // (+593, 00593 o 593) antes de validar. "+593 98 785 5906" -> "0987855906".
  function normalizarTelefono(valor) {
    let numero = valor.replace(/[\s().-]/g, "");
    const prefijo = numero.match(/^(\+593|00593|593(?=\d{8,9}$))/);
    if (prefijo) {
      numero = numero.slice(prefijo[0].length);
      if (!numero.startsWith("0")) numero = `0${numero}`;
    }
    return numero;
  }

  const CLASES_INVALIDO = ["border-error", "bg-error-tint", "dark:border-error-dark", "dark:bg-error-darktint"];
  const CLASES_VALIDO = ["border-elite-borderstrong", "dark:border-elitenight-border"];

  // input/errorEl: elementos del DOM. patron/mensajeError: del campo que se valida.
  // opcional: si está vacío y es opcional, se considera válido sin marcar nada.
  // normalizar: función opcional que limpia el valor antes de probar el patrón.
  function validarCampo({ input, errorEl, patron, mensajeError, opcional = false, normalizar = (v) => v }) {
    const campo = input.closest(".campo");
    const valor = normalizar(input.value.trim());

    if (opcional && valor === "") {
      campo?.removeAttribute("data-invalido");
      input.classList.remove(...CLASES_INVALIDO);
      input.classList.add(...CLASES_VALIDO);
      input.removeAttribute("aria-invalid");
      if (errorEl) errorEl.textContent = "";
      return true;
    }

    const esValido = patron.test(valor);
    if (esValido) {
      campo?.removeAttribute("data-invalido");
      input.classList.remove(...CLASES_INVALIDO);
      input.classList.add(...CLASES_VALIDO);
      input.removeAttribute("aria-invalid");
      if (errorEl) errorEl.textContent = "";
    } else {
      campo?.setAttribute("data-invalido", "");
      input.classList.remove(...CLASES_VALIDO);
      input.classList.add(...CLASES_INVALIDO);
      input.setAttribute("aria-invalid", "true");
      if (errorEl) errorEl.textContent = mensajeError;
    }
    return esValido;
  }

  // Auditoría IHC, H11: el mensaje general no remite al color ("marcados en rojo"),
  // nombra los campos con error, y el foco va al primero de ellos.
  // invalidos: inputs que no pasaron la validación, en orden del formulario.
  function resumirErrores(invalidos, accion = "enviar") {
    const nombres = invalidos.map((input) => {
      const etiqueta = document.querySelector(`label[for="${input.id}"]`);
      // Solo el texto propio de la etiqueta, sin "(opcional)".
      return (etiqueta?.firstChild?.textContent ?? input.name).trim();
    });
    invalidos[0]?.focus();
    const lista = nombres.join(", ");
    return invalidos.length === 1
      ? `Antes de ${accion}, corrige este campo: ${lista}.`
      : `Antes de ${accion}, corrige estos ${invalidos.length} campos: ${lista}.`;
  }

  window.ValidacionCE = {
    patrones,
    mensajesError,
    CLASES_INVALIDO,
    CLASES_VALIDO,
    normalizarTelefono,
    validarCampo,
    resumirErrores,
  };
})();
