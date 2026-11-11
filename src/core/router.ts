/**
 * Navegación por el # de la dirección (por ejemplo, #/operaciones).
 * GitHub Pages no sabe servir rutas propias, por eso no se usan rutas normales.
 */

/** Convierte el hash del navegador ("#/errores", "", "#errores") en una ruta limpia. */
export function resolverRuta(hash: string): string {
  const sinAlmohadilla = hash.replace(/^#/, '');
  if (sinAlmohadilla === '') return '/';
  return sinAlmohadilla.startsWith('/') ? sinAlmohadilla : `/${sinAlmohadilla}`;
}

/** Avisa con la ruta actual al arrancar y cada vez que el usuario navega. */
export function iniciarRouter(alCambiarRuta: (ruta: string) => void): void {
  const avisar = () => alCambiarRuta(resolverRuta(window.location.hash));
  window.addEventListener('hashchange', avisar);
  avisar();
}
