import { HORARIOS_PREDEFINIDOS, PLATAFORMAS, type FicheroPlataforma, type OpcionPlataforma } from '../config/app-config';
import { TEXTO_TIPO_INFORME, tipoInformeQuantfury } from '../adapters/statement-parsers/quantfury-comun';
import type { ResultadoImportacion } from '../services/importacion/importacion-service';
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
  const leidos = new Map<File, string>();

  async function leerFichero(fichero: File, tipo: 'html' | 'pdf'): Promise<string> {
    const guardado = leidos.get(fichero);
    if (guardado !== undefined) return guardado;
    const contenido = tipo === 'pdf' ? await extraerTextoPdf(fichero) : await fichero.text();
    leidos.set(fichero, contenido);
    return contenido;
  }

  /** Cada hueco de fichero debe recibir el informe que le toca (no el de efectivo en el de trading, por ejemplo). */
  function comprobarTipo(contenido: string, ficheroEsperado: FicheroPlataforma): void {
    const tipo = tipoInformeQuantfury(contenido);
    if (tipo === ficheroEsperado.clave) return;
    const encontrado = tipo === null ? 'no es ninguno de los informes de Quantfury' : `es ${TEXTO_TIPO_INFORME[tipo]}`;
    throw new ErrorDeUsuario(`El fichero de «${ficheroEsperado.etiqueta}» ${encontrado}. Ponlo en el campo que le corresponde.`);
  }

  /** Ficheros que hay que importar, en orden: uno solo, o los que el usuario ha elegido de la plataforma. */
  function ficherosAImportar(datos: DatosFormularioImportacion, plataforma: OpcionPlataforma | undefined): Array<{ fichero: File; esperado: FicheroPlataforma | null }> {
    if (!plataforma?.ficheros) {
      if (!datos.fichero) throw new ErrorDeUsuario('Elige el fichero del informe.');
      return [{ fichero: datos.fichero, esperado: null }];
    }
    const faltante = plataforma.ficheros.find((f) => f.obligatorio && !datos.ficheros[f.clave]);
    if (faltante) throw new ErrorDeUsuario(`Falta el fichero obligatorio: ${faltante.etiqueta.replace(' (obligatorio)', '')}.`);
    return plataforma.ficheros.flatMap((esperado) => {
      const fichero = datos.ficheros[esperado.clave];
      return fichero ? [{ fichero, esperado }] : [];
    });
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
      const plataforma = PLATAFORMAS.find((opcion) => opcion.valor === datos.plataforma);
      const aImportar = ficherosAImportar(datos, plataforma);
      const horario = plataforma?.horarioFijo ?? construirHorario(datos);
      const apalancamiento = datos.apalancamiento.trim() === '' ? null : leerTasa(datos.apalancamiento);
      if (datos.apalancamiento.trim() !== '' && apalancamiento === null) {
        throw new ErrorDeUsuario('El apalancamiento debe ser un número mayor que cero (por ejemplo 5 si es 5:1), o dejarse vacío.');
      }
      vista.mostrarCargando();
      // Primero se lee y se comprueba todo; solo entonces se importa, para no dejar a medias una carga con un fichero equivocado.
      const contenidos: string[] = [];
      for (const { fichero, esperado } of aImportar) {
        const contenido = await leerFichero(fichero, plataforma?.tipoFichero ?? 'html');
        if (esperado) comprobarTipo(contenido, esperado);
        contenidos.push(contenido);
      }
      const resultados: ResultadoImportacion[] = [];
      for (const [indice, { fichero }] of aImportar.entries()) {
        resultados.push(
          await servicio.importar(contenidos[indice]!, {
            plataforma: datos.plataforma,
            nombreFichero: fichero.name,
            broker: datos.broker,
            cuenta: datos.cuenta,
            moneda: datos.moneda,
            horario,
            apalancamiento,
            ...(cambiosManuales ? { cambiosManuales } : {}),
          }),
        );
      }
      const resultado = resultados[0]!;
      // Las operaciones recién importadas no tienen velas hasta que se vuelva a cargar el fichero de velas.
      const [guardados, ventanas] = await Promise.all([aplicacion.lectorDatos.leerTodo(), aplicacion.lectorVentanas.leerVentanas()]);
      const deLaCuenta = guardados.operaciones.filter((o) => o.broker === resultado.broker && o.cuenta === resultado.cuenta);
      vista.mostrarResultado(resultados, operacionesSinVelas(deLaCuenta, ventanas));
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
