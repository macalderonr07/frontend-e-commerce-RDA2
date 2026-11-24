// Tokens de diseño compartidos por las 7 páginas (auditoría IHC, H1 y H6).
// Antes cada página declaraba su propia paleta inline y la oscura no definía
// "ink", así que la clase dark:text-elitenight-ink nunca se generaba y el botón
// principal quedaba con texto blanco sobre #D9A066 (2,29:1). Con un solo archivo
// la paleta no puede divergir entre páginas.
//
// Se carga justo después del Play CDN de Tailwind y antes de styles.css.
// Contrastes (WCAG 2.2, fórmula de luminancia relativa):
//   accion            #845830 + texto #FFFFFF  6,14:1  (AA)
//   accion-noche      #D9A066 + texto #14170F  7,91:1  (AAA)
//
// Modo claro "descanso visual": la página va sobre crema (#F6F0E1) y las
// superficies (tarjetas, campos) sobre papel (#FFFBF2, la clase bg-white),
// en vez de blanco puro. El lima del logo (#93DC1D) como FONDO encandila en
// modo claro: elite-lime lee la variable --elite-lime (styles.css), que en
// claro es un verde salvia (#B8D88A, 11,41:1 con texto ink) y en oscuro sigue
// siendo el lima de marca. Contrastes sobre crema: texto 15,31 · elite 5,17 ·
// cuero 5,40 · error 5,75 · borde de campos 3,08 (WCAG 1.4.11).
tailwind.config = {
  darkMode: "media",
  theme: {
    // El Play CDN no genera las variantes arbitrarias min-[Nem]:, así que los
    // puntos de quiebre en em se declaran como pantallas con nombre (orden ascendente).
    screens: {
      s30: "30em",
      sm: "40em",
      s45: "45em",
      md: "48em",
      s55: "55em",
      s60: "60em",
      lg: "64em",
      xl: "80em",
      "2xl": "96em",
    },
    extend: {
      colors: {
        // bg-white = "papel": superficie apenas cálida sobre el fondo crema
        white: "#FFFBF2",
        elite: {
          lime: "rgb(var(--elite-lime) / <alpha-value>)",
          crema: "#F6F0E1",
          DEFAULT: "#4E6E1C",
          medium: "#3A5214",
          dark: "#2B3913",
          tint: "#E9F4D7",
          border: "#A7C577",
          borderstrong: "#719438",
          ink: "#14170F",
          text: "#1A1A1A",
          cuero: "#845830",
          cuerotint: "#F2E4D4",
        },
        elitenight: {
          DEFAULT: "#74A91E",
          medium: "#90C639",
          dark: "#A6D161",
          tint: "#273414",
          border: "#5E7538",
          bg: "#0D100A",
          text: "#EDF3E6",
          ink: "#14170F",
          cuero: "#D9A066",
          cuerotint: "#2E2013",
        },
        // Token semántico de la acción principal ("Agregar a la cotización"): el
        // mismo color en el catálogo, la ficha y los relacionados (Gestalt de
        // semejanza), para que la regla "clic en el botón cuero" se automatice.
        accion: {
          DEFAULT: "#845830",
          texto: "#FFFFFF",
          noche: "#D9A066",
          nochetexto: "#14170F",
        },
        error: { DEFAULT: "#B3261E", tint: "#FBECEB", dark: "#FF8A80", darktint: "#3A1613" },
      },
    },
  },
};
