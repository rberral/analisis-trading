import type { HorarioBroker } from '../core/horario';

export type Temporalidad = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1';

/** Vela tal como viene en el fichero: con la hora del servidor del broker, sin convertir. */
export interface VelaBroker {
  /** "2026-10-15T17:55:00" */
  readonly horaBroker: string;
  readonly abre: number;
  readonly maximo: number;
  readonly minimo: number;
  readonly cierra: number;
  readonly volumen: number;
}

/** Vela ya con la hora en UTC (instante de apertura de la vela). */
export interface Vela {
  readonly utcMs: number;
  readonly abre: number;
  readonly maximo: number;
  readonly minimo: number;
  readonly cierra: number;
  readonly volumen: number;
}

/**
 * Velas guardadas para una operación: unas pocas antes de entrar, todas las
 * de su duración y unas pocas después. Es lo único de las velas que se guarda.
 */
export interface VentanaVelas {
  /** "operacionId:temporalidad" */
  readonly id: string;
  readonly operacionId: string;
  readonly cuenta: string;
  readonly activo: string;
  readonly temporalidad: Temporalidad;
  readonly cargaId: string;
  /** true si la operación duró tanto que se recortó la ventana. */
  readonly truncada: boolean;
  readonly velas: readonly Vela[];
}

/** Metadatos de un fichero de velas cargado (el fichero en sí no se guarda). */
export interface RegistroCargaVelas {
  readonly id: string;
  readonly activo: string;
  readonly temporalidad: Temporalidad;
  readonly broker: string | null;
  readonly horario: HorarioBroker;
  readonly nombreFichero: string;
  readonly fechaMs: number;
  readonly velasLeidas: number;
  readonly primeraVelaUtc: number;
  readonly ultimaVelaUtc: number;
  readonly operacionesCubiertas: number;
  readonly ventanasGuardadas: number;
}
