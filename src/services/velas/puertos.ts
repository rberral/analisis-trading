import type { RegistroCargaVelas, VelaBroker, VentanaVelas } from '../../models/velas';

export interface ParserVelas {
  leer(contenido: string): VelaBroker[];
}

export interface RepositorioVelas {
  /** Guarda todo o nada: la carga y sus ventanas. Si ya había ventanas de esas operaciones y temporalidad, se reemplazan. */
  guardarCarga(registro: RegistroCargaVelas, ventanas: readonly VentanaVelas[]): Promise<void>;
  listarCargas(): Promise<RegistroCargaVelas[]>;
}
