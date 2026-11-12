import { HORARIOS_PREDEFINIDOS, PLATAFORMAS } from '../config/app-config';
import { ErrorDeUsuario } from '../core/errores';
import { logger } from '../core/logger';
import type { Aplicacion } from '../composicion';
import { listarCuentas } from '../services/consultas/cuentas';
import { construirHorario } from './horario-controller';
import { crearVistaImportar, type DatosFormularioImportacion } from '../views/importar-view';

/** Pantalla de importación. Recoge los datos del formulario y llama al servicio; no calcula nada. */
export function crearPaginaImportar(aplicacion: Aplicacion): HTMLElement {
  const servicio = aplicacion.servicioImportacion;
  const vista = crearVistaImportar({
    plataformas: PLATAFORMAS,
    horarios: HORARIOS_PREDEFINIDOS,
    alEnviar: (datos) => void importar(datos),
  });

  async function importar(datos: DatosFormularioImportacion): Promise<void> {
    try {
      if (!datos.fichero) throw new ErrorDeUsuario('Elige el fichero del informe.');
      const horario = construirHorario(datos);
      vista.mostrarCargando();
      const contenido = await datos.fichero.text();
      const resultado = await servicio.importar(contenido, {
        plataforma: datos.plataforma,
        nombreFichero: datos.fichero.name,
        broker: datos.broker,
        cuenta: datos.cuenta,
        moneda: datos.moneda,
        horario,
      });
      vista.mostrarResultado(resultado);
    } catch (error) {
      if (error instanceof ErrorDeUsuario) {
        vista.mostrarError(error.message);
        return;
      }
      logger.error('Fallo inesperado al importar', error);
      vista.mostrarError('Ha ocurrido un error inesperado al importar el fichero.');
    }
  }

  // Brokers y cuentas ya guardados, para elegirlos en los desplegables.
  aplicacion.lectorDatos
    .leerTodo()
    .then((datos) => {
      vista.cargarCuentas(listarCuentas(datos));
    })
    .catch((error: unknown) => logger.error('No se pudieron leer las cuentas guardadas', error));

  return vista.elemento;
}
