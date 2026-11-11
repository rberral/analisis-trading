/**
 * Interfaces que el servicio de importación necesita del exterior.
 * Las implementaciones concretas están en adapters/, de modo que el servicio no
 * sabe nada de IndexedDB ni del formato de cada plataforma.
 */
import type { InformeParseado } from '../../models/informe';
import type { InstantaneaAbierta, MovimientoGuardado, RegistroImportacion } from '../../models/importacion';
import type { OperacionGuardada } from '../../models/operacion';

/** Lee el informe de una plataforma y lo convierte al formato común. */
export interface ParserInforme {
  leer(contenido: string): InformeParseado;
}

export interface DatosAGuardar {
  readonly importacion: RegistroImportacion;
  readonly operaciones: readonly OperacionGuardada[];
  readonly movimientos: readonly MovimientoGuardado[];
  readonly instantaneas: readonly InstantaneaAbierta[];
}

export interface RepositorioOperaciones {
  /** Para cada id que ya existe, dice si la operación estaba abierta o cerrada. */
  estadoDeOperaciones(ids: readonly string[]): Promise<ReadonlyMap<string, 'abierta' | 'cerrada'>>;
  /** Guarda todo o nada: si algo falla, no queda una importación a medias. */
  guardarImportacion(datos: DatosAGuardar): Promise<void>;
}
