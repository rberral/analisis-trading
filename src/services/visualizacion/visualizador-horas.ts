/**
 * Decide cuánto hay que desplazar una hora UTC para mostrarla en el modo elegido.
 * Los datos guardados siempre están en UTC; esto solo afecta a cómo se ven.
 */
import type { OpcionModoHora } from '../../config/app-config';
import { desfaseDeZonaEnInstante, desfaseDelBrokerMs, type HorarioBroker } from '../../core/horario';
import type { ModoHora } from '../../models/visualizacion';

export interface VisualizadorHoras {
  readonly modo: ModoHora;
  /** Texto para poner junto a las horas: «UTC», «hora del broker»… */
  readonly etiqueta: string;
  /**
   * Milisegundos a sumar a la hora UTC para mostrarla. `origenId` es la importación o carga de donde
   * viene el dato: de ahí sale su horario cuando se pide la hora del broker (null = origen desconocido).
   */
  desfaseMs(utcMs: number, origenId: string | null): number;
  /** El mismo visualizador, sabiendo además el horario de un origen concreto (una carga recién analizada). */
  conOrigen(origenId: string, horario: HorarioBroker): VisualizadorHoras;
}

export interface ConfiguracionVisualizacion {
  readonly zonaEspana: string;
  readonly modos: readonly OpcionModoHora[];
}

export function crearVisualizador(
  modo: ModoHora,
  horarios: ReadonlyMap<string, HorarioBroker>,
  configuracion: ConfiguracionVisualizacion,
): VisualizadorHoras {
  const etiqueta = configuracion.modos.find((opcion) => opcion.id === modo)?.etiqueta ?? 'UTC';
  return {
    modo,
    etiqueta,
    desfaseMs(utcMs, origenId) {
      if (modo === 'espana') return desfaseDeZonaEnInstante(utcMs, configuracion.zonaEspana);
      if (modo === 'utc' || origenId === null) return 0;
      const horario = horarios.get(origenId);
      return horario ? desfaseDelBrokerMs(utcMs, horario) : 0;
    },
    conOrigen(origenId, horario) {
      return crearVisualizador(modo, new Map([...horarios, [origenId, horario]]), configuracion);
    },
  };
}
