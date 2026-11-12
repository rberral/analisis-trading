import { ErrorDeUsuario } from '../../core/errores';
import { logger } from '../../core/logger';
import type { ProveedorCambio } from '../../services/cambio/servicio-cambio';
import type { ProveedorTasasHistoricas } from '../../services/importacion/conversion-moneda';

const MENSAJE_FALLO = 'No se pudo obtener el cambio automático (sin conexión o servicio no disponible). Puedes escribirlo a mano.';

const MS_POR_DIA = 86_400_000;
const fechaIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** Consulta los cambios a Frankfurter (datos del Banco Central Europeo): el del día y los históricos. */
export class ProveedorFrankfurter implements ProveedorCambio, ProveedorTasasHistoricas {
  constructor(
    private readonly urlApi: string,
    private readonly urlHistorica: string,
    private readonly diasPorConsulta: number,
  ) {}

  /** Cambios diarios entre dos fechas. Pide el rango por tramos para que el servicio dé un dato por día. */
  async obtenerSerie(origen: string, destino: string, desde: string, hasta: string): Promise<ReadonlyMap<string, number>> {
    const serie = new Map<string, number>();
    const fin = Date.parse(`${hasta}T00:00:00Z`);
    // Un margen de una semana hacia atrás permite usar el último cambio conocido si la operación cae en festivo.
    for (let inicio = Date.parse(`${desde}T00:00:00Z`) - 7 * MS_POR_DIA; inicio <= fin; inicio += this.diasPorConsulta * MS_POR_DIA) {
      const final = Math.min(fin, inicio + (this.diasPorConsulta - 1) * MS_POR_DIA);
      await this.cargarTramo(serie, origen, destino, fechaIso(inicio), fechaIso(final));
    }
    return serie;
  }

  private async cargarTramo(serie: Map<string, number>, origen: string, destino: string, desde: string, hasta: string): Promise<void> {
    const url = `${this.urlHistorica}/${desde}..${hasta}?base=${encodeURIComponent(origen)}&symbols=${encodeURIComponent(destino)}`;
    try {
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      const datos = (await respuesta.json()) as { rates?: Record<string, Record<string, unknown>> };
      if (!datos.rates) throw new Error('Respuesta inesperada');
      for (const [fecha, cambios] of Object.entries(datos.rates)) {
        const tasa = cambios[destino];
        if (typeof tasa === 'number' && tasa > 0) serie.set(fecha, tasa);
      }
    } catch (error) {
      logger.error('Fallo al consultar los cambios históricos', error);
      throw new ErrorDeUsuario(MENSAJE_FALLO);
    }
  }

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
