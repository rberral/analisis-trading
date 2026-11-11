import { SECCIONES } from '../config/app-config';
import { crearPaginaNoEncontrada, crearPaginaPendiente } from '../views/pagina-view';
import { renderizarLayout } from '../views/layout-view';

/**
 * Decide qué pantalla se muestra para cada ruta.
 * Solo coordina: no contiene lógica de negocio.
 */
export function mostrarPagina(contenedor: HTMLElement, ruta: string): void {
  const seccion = SECCIONES.find((candidata) => candidata.ruta === ruta);
  const contenido = seccion ? crearPaginaPendiente(seccion) : crearPaginaNoEncontrada();
  renderizarLayout(contenedor, ruta, contenido);
}
