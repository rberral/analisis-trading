import { COPIA_SEGURIDAD } from '../config/app-config';
import type { Aplicacion } from '../composicion';
import { descargarTexto } from '../adapters/descarga/descargar-texto';
import { ErrorDeUsuario } from '../core/errores';
import { logger } from '../core/logger';
import { crearElemento } from '../views/dom';
import { crearTarjetaBorrar, crearTarjetaExportar, crearTarjetaImportar, crearTarjetaResumen } from '../views/copia-view';

/** Pantalla Copia de seguridad: exportar, importar y borrar los datos del navegador. */
export function crearPaginaCopia(aplicacion: Aplicacion): HTMLElement {
  const servicio = aplicacion.servicioCopia;
  const zonaResumen = crearElemento('div', { 'aria-live': 'polite' });
  const zonaBorrado = crearElemento('div', { 'aria-live': 'polite' });
  const zonaMensaje = crearElemento('div', { 'aria-live': 'polite' });

  const mensaje = (texto: string, atencion = false) =>
    zonaMensaje.replaceChildren(crearElemento('p', { class: atencion ? 'aviso aviso--atencion' : 'aviso', role: atencion ? 'alert' : 'status' }, [texto]));

  async function exportar(incluirVelas = true): Promise<void> {
    const fechaMs = Date.now();
    const copia = await servicio.exportar(fechaMs, incluirVelas);
    const dia = new Date(fechaMs).toISOString().slice(0, 10);
    descargarTexto(`${COPIA_SEGURIDAD.prefijoFichero}_${dia}.json`, JSON.stringify(copia), 'application/json');
    mensaje('Copia descargada. Guárdala en un sitio seguro.');
  }

  async function refrescar(): Promise<void> {
    const resumen = await servicio.resumen();
    zonaResumen.replaceChildren(crearTarjetaResumen(resumen));
    zonaBorrado.replaceChildren(
      crearTarjetaBorrar(
        resumen,
        COPIA_SEGURIDAD.palabraConfirmacion,
        (alcance) => void ejecutar(async () => {
          await servicio.borrar(alcance);
          await refrescar();
          mensaje(
            alcance.tipo === 'todo' ? 'Todos los datos se han borrado.' : alcance.tipo === 'velas' ? 'Las velas se han borrado.' : 'Los datos de esa cuenta se han borrado.',
          );
        }),
        () => void ejecutar(() => exportar(true)),
      ),
    );
  }

  const tarjetaImportar = crearTarjetaImportar((fichero) =>
    void (async () => {
      try {
        const resultado = await servicio.importar(await fichero.text());
        tarjetaImportar.mostrarResultado(resultado);
        await refrescar();
      } catch (error) {
        if (error instanceof ErrorDeUsuario) tarjetaImportar.mostrarError(error.message);
        else {
          logger.error('Fallo inesperado al importar la copia', error);
          tarjetaImportar.mostrarError('Ha ocurrido un error inesperado al importar la copia.');
        }
      }
    })(),
  );

  async function ejecutar(accion: () => Promise<void>): Promise<void> {
    try {
      await accion();
    } catch (error) {
      logger.error('Fallo en la copia de seguridad', error);
      mensaje('Ha ocurrido un error inesperado. Inténtalo de nuevo.', true);
    }
  }

  void ejecutar(refrescar);
  return crearElemento('div', {}, [
    crearElemento('h1', { class: 'titulo-pagina' }, ['Copia de seguridad']),
    crearElemento('p', { class: 'aviso' }, ['Tus datos viven solo en este navegador (en IndexedDB): no hay servidor ni cuenta. Si borras los datos del sitio, usas otro navegador u otro ordenador, no los verás. La copia de seguridad te permite guardarlos y llevarlos contigo.']),
    zonaMensaje,
    zonaResumen,
    crearTarjetaExportar((incluirVelas) => void ejecutar(() => exportar(incluirVelas))),
    tarjetaImportar.elemento,
    zonaBorrado,
  ]);
}
