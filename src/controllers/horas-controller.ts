import { VISUALIZACION_HORAS } from '../config/app-config';
import type { Aplicacion } from '../composicion';
import { crearVisualizador, type VisualizadorHoras } from '../services/visualizacion/visualizador-horas';

/** Crea el visualizador de horas con el modo elegido por el usuario y los horarios de sus importaciones y cargas. */
export async function crearVisualizadorActual(aplicacion: Aplicacion): Promise<VisualizadorHoras> {
  const horarios = await aplicacion.lectorHorarios.leerHorarios();
  return crearVisualizador(aplicacion.preferenciaHoras.obtener(), horarios, VISUALIZACION_HORAS);
}
