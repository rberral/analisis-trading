import { APP_CONFIG, SECCIONES, VISUALIZACION_HORAS } from '../config/app-config';
import type { ModoHora } from '../models/visualizacion';
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
export interface OpcionesHoras {
  readonly modo: ModoHora;
  readonly alCambiar: (modo: ModoHora) => void;
}

function crearSelectorHoras(opciones: OpcionesHoras): HTMLElement {
  const selector = crearElemento('select', { name: 'modo-horas' }) as HTMLSelectElement;
  for (const modo of VISUALIZACION_HORAS.modos) selector.append(crearElemento('option', { value: modo.id }, [modo.nombre]));
  selector.value = opciones.modo;
  selector.addEventListener('change', () => opciones.alCambiar(selector.value as ModoHora));
  return crearElemento('div', { class: 'menu__horas' }, [
    crearElemento('label', { class: 'campo' }, ['Mostrar horas en', selector]),
    crearElemento('p', { class: 'texto-suave' }, ['Todas las horas se guardan en UTC; esto solo cambia cómo se ven.']),
  ]);
}

export function renderizarLayout(
  contenedor: HTMLElement,
  rutaActiva: string,
  contenido: HTMLElement,
  horas: OpcionesHoras,
): void {
  const enlaces = SECCIONES.map((seccion) =>
    crearEnlaceMenu(seccion.ruta, seccion.titulo, seccion.ruta === rutaActiva),
  );

  const menu = crearElemento('nav', { class: 'menu', 'aria-label': APP_CONFIG.textos.etiquetaNavegacion }, [
    crearElemento('div', { class: 'menu__marca' }, [APP_CONFIG.nombreApp]),
    ...enlaces,
    crearSelectorHoras(horas),
  ]);

  const principal = crearElemento('main', { class: 'principal' }, [contenido]);
  const estructura = crearElemento('div', { class: 'estructura' }, [menu, principal]);

  contenedor.replaceChildren(estructura);
}
