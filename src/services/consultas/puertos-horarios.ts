import type { HorarioBroker } from '../../core/horario';

export interface LectorHorarios {
  /** Horario elegido en cada importación y en cada carga de velas, por id. */
  leerHorarios(): Promise<ReadonlyMap<string, HorarioBroker>>;
}
