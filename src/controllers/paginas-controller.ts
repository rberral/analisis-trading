import { SECCIONES, type Seccion } from '../config/app-config';
import type { Aplicacion } from '../composicion';
import { crearPaginaNoEncontrada, crearPaginaPendiente } from '../views/pagina-view';
import { renderizarLayout } from '../views/layout-view';
import { crearPaginaErrores, crearPaginaOperaciones, crearPaginaPanel } from './analisis-controller';
import { crearPaginaImportar } from './importar-controller';
import { crearPaginaVelas } from './velas-controller';

type FabricaDePagina = (aplicacion: Aplicacion, seccion: Seccion) => HTMLElement;

/** Pantallas ya construidas. Las que no están aquí muestran una página provisional. */
const PAGINAS: Readonly<Record<string, FabricaDePagina>> = {
  '/': (aplicacion) => crearPaginaPanel(aplicacion),
  '/operaciones': (aplicacion) => crearPaginaOperaciones(aplicacion),
  '/errores': (aplicacion) => crearPaginaErrores(aplicacion),
  '/velas': (aplicacion) => crearPaginaVelas(aplicacion),
  '/importar': (aplicacion) => crearPaginaImportar(aplicacion.servicioImportacion),
};

/**
 * Decide qué pantalla se muestra para cada ruta.
 * Solo coordina: no contiene lógica de negocio.
 */
export function mostrarPagina(contenedor: HTMLElement, ruta: string, aplicacion: Aplicacion): void {
  const seccion = SECCIONES.find((candidata) => candidata.ruta === ruta);
  const contenido = seccion ? crearContenido(seccion, aplicacion) : crearPaginaNoEncontrada();
  renderizarLayout(contenedor, ruta, contenido);
}

function crearContenido(seccion: Seccion, aplicacion: Aplicacion): HTMLElement {
  const fabrica = PAGINAS[seccion.ruta];
  return fabrica ? fabrica(aplicacion, seccion) : crearPaginaPendiente(seccion);
}
