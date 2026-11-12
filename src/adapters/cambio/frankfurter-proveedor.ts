import { ErrorDeUsuario } from '../../core/errores';
import { logger } from '../../core/logger';
import type { ProveedorCambio } from '../../services/cambio/servicio-cambio';

const MENSAJE_FALLO = 'No se pudo obtener el cambio automático (sin conexión o servicio no disponible). Puedes escribirlo a mano.';

/** Consulta el cambio del día a Frankfurter (datos del Banco Central Europeo). */
export class ProveedorFrankfurter implements ProveedorCambio {
  constructor(private readonly urlApi: string) {}

  async obtenerTasa(origen: string, destino: string): Promise<{ tasa: number; fecha: string }> {
    const url = `${this.urlApi}?base=${encodeURIComponent(origen)}&symbols=${encodeURIComponent(destino)}`;
    try {
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const datos = (await respuesta.json()) as { date?: unknown; rates?: Record<string, unknown> };
      const tasa = datos.rates?.[destino];
      if (typeof tasa !== 'number' || !(tasa > 0) || typeof datos.date !== 'string') throw new Error('Respuesta inesperada');
      return { tasa, fecha: datos.date };
    } catch (error) {
      logger.error('Fallo al consultar el tipo de cambio', error);
      throw new ErrorDeUsuario(MENSAJE_FALLO);
    }
  }
}
