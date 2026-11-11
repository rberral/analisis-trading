import { APP_CONFIG, SECCIONES } from '../config/app-config';
import { crearElemento } from './dom';

function crearEnlaceMenu(ruta: string, titulo: string, activa: boolean): HTMLElement {
  const atributos: Record<string, string> = {
    href: `#${ruta}`,
    class: activa ? 'menu__enlace menu__enlace--activo' : 'menu__enlace',
  };
  if (activa) atributos['aria-current'] = 'page';
  return crearElemento('a', atributos, [titulo]);
}

/** Dibuja el menú lateral y el contenedor de la pantalla activa. */
export function renderizarLayout(
  contenedor: HTMLElement,
  rutaActiva: string,
  contenido: HTMLElement,
): void {
  const enlaces = SECCIONES.map((seccion) =>
    crearEnlaceMenu(seccion.ruta, seccion.titulo, seccion.ruta === rutaActiva),
  );

  const menu = crearElemento('nav', { class: 'menu', 'aria-label': APP_CONFIG.textos.etiquetaNavegacion }, [
    crearElemento('div', { class: 'menu__marca' }, [APP_CONFIG.nombreApp]),
    ...enlaces,
  ]);

  const principal = crearElemento('main', { class: 'principal' }, [contenido]);
  const estructura = crearElemento('div', { class: 'estructura' }, [menu, principal]);

  contenedor.replaceChildren(estructura);
}
