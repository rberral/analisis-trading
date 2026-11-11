import { APP_CONFIG, type Seccion } from '../config/app-config';
import { crearElemento } from './dom';

/** Pantalla provisional de una sección que todavía no está construida. */
export function crearPaginaPendiente(seccion: Seccion): HTMLElement {
  return crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h1', {}, [seccion.titulo]),
    crearElemento('p', {}, [seccion.descripcion]),
    crearElemento('p', { class: 'texto-suave' }, ['Esta pantalla se construirá en una fase posterior.']),
  ]);
}

export function crearPaginaNoEncontrada(): HTMLElement {
  return crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h1', {}, [APP_CONFIG.textos.paginaNoEncontrada]),
    crearElemento('a', { href: '#/', class: 'enlace' }, [APP_CONFIG.textos.volverAlPanel]),
  ]);
}
