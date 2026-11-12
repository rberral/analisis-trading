import { HORARIOS_PREDEFINIDOS, PLATAFORMAS } from '../config/app-config';
import { extraerTextoPdf } from '../adapters/pdf/lector-pdf';
import { ErrorDeUsuario } from '../core/errores';
import { logger } from '../core/logger';
import type { Aplicacion } from '../composicion';
import { leerTasa } from '../services/cambio/servicio-cambio';
import { ErrorCambioNecesario } from '../services/importacion/conversion-moneda';
import { listarCuentas } from '../services/consultas/cuentas';
import { operacionesSinVelas } from '../services/velas/cobertura';
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

  // El texto de un PDF tarda en extraerse: si hay que reintentar con otros cambios, no se vuelve a leer.
  let leido: { readonly fichero: File; readonly contenido: string } | null = null;

  async function leerFichero(fichero: File, tipo: 'html' | 'pdf'): Promise<string> {
    if (leido?.fichero === fichero) return leido.contenido;
    const contenido = tipo === 'pdf' ? await extraerTextoPdf(fichero) : await fichero.text();
    leido = { fichero, contenido };
    return contenido;
  }

  function leerCambios(texto: Readonly<Record<string, string>>): Record<string, number> {
    const cambios: Record<string, number> = {};
    for (const [moneda, valor] of Object.entries(texto)) {
      const tasa = leerTasa(valor);
      if (tasa === null) throw new ErrorDeUsuario(`El cambio de ${moneda} no es válido: escribe un número mayor que cero (por ejemplo 0,92).`);
      cambios[moneda] = tasa;
    }
    return cambios;
  }

  async function importar(datos: DatosFormularioImportacion, cambiosManuales?: Readonly<Record<string, number>>): Promise<void> {
    try {
      if (!datos.fichero) throw new ErrorDeUsuario('Elige el fichero del informe.');
      const plataforma = PLATAFORMAS.find((opcion) => opcion.valor === datos.plataforma);
      const horario = plataforma?.horarioFijo ?? construirHorario(datos);
      vista.mostrarCargando();
      const contenido = await leerFichero(datos.fichero, plataforma?.tipoFichero ?? 'html');
      const resultado = await servicio.importar(contenido, {
        plataforma: datos.plataforma,
        nombreFichero: datos.fichero.name,
        broker: datos.broker,
        cuenta: datos.cuenta,
        moneda: datos.moneda,
        horario,
        ...(cambiosManuales ? { cambiosManuales } : {}),
      });
      // Las operaciones recién importadas no tienen velas hasta que se vuelva a cargar el fichero de velas.
      const [guardados, ventanas] = await Promise.all([aplicacion.lectorDatos.leerTodo(), aplicacion.lectorVentanas.leerVentanas()]);
      const deLaCuenta = guardados.operaciones.filter((o) => o.broker === resultado.broker && o.cuenta === resultado.cuenta);
      vista.mostrarResultado(resultado, operacionesSinVelas(deLaCuenta, ventanas));
    } catch (error) {
      if (error instanceof ErrorCambioNecesario) {
        vista.pedirCambios(error.message, error.monedas, error.destino, (texto) => {
          try {
            void importar(datos, leerCambios(texto));
          } catch (errorCambio) {
            vista.mostrarError(errorCambio instanceof Error ? errorCambio.message : 'Los cambios no son válidos.');
          }
        });
        return;
      }
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
