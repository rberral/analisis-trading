import { defineConfig, type Plugin } from 'vite';
import { CAMBIO_MONEDAS } from './src/config/app-config';

// Política de seguridad de contenido: solo se permite código y recursos de la propia web.
// La única conexión externa permitida es la del conversor de moneda (CAMBIO_MONEDAS en la configuración).
// Se añade únicamente al compilar, porque el servidor de desarrollo necesita scripts propios.
const POLITICA_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
  `connect-src 'self' ${new URL(CAMBIO_MONEDAS.urlApi).origin}; object-src 'none'; base-uri 'self'; form-action 'self'`;

function insertarCspEnProduccion(): Plugin {
  return {
    name: 'insertar-csp-en-produccion',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: POLITICA_CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  // Ruta relativa: la web funciona en cualquier dirección de GitHub Pages sin configurar nada.
  base: './',
  plugins: [insertarCspEnProduccion()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
