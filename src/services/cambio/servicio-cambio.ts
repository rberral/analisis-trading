/**
 * Tipo de cambio de la moneda de una cuenta a euros: escrito a mano o consultado a una API pública.
 * Solo se usa para mostrar una equivalencia; los datos guardados nunca se convierten.
 */
import { ErrorDeUsuario } from '../../core/errores';
import type { AlmacenClaveValor } from '../visualizacion/preferencia-modo-hora';

export interface TipoCambio {
  readonly moneda: string;
  /** Cuántos euros vale una unidad de `moneda`. */
  readonly tasa: number;
  /** Fecha del dato (AAAA-MM-DD) si viene de la API; null si lo escribió el usuario. */
  readonly fecha: string | null;
  readonly origen: 'manual' | 'automatico';
}

/** Adaptador de la fuente externa: aislado para poder cambiar de proveedor tocando un solo fichero. */
export interface ProveedorCambio {
  obtenerTasa(origen: string, destino: string): Promise<{ readonly tasa: number; readonly fecha: string }>;
}

export interface ConfiguracionCambio {
  readonly monedaDestino: string;
  readonly prefijoClave: string;
}

/** Acepta «0,92» y «0.92». Devuelve null si no es un número positivo. */
export function leerTasa(texto: string): number | null {
  const numero = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(numero) && numero > 0 ? numero : null;
}

export const convertir = (importe: number, tasa: number): number => importe * tasa;

export class ServicioCambio {
  constructor(
    private readonly almacen: AlmacenClaveValor,
    private readonly proveedor: ProveedorCambio,
    private readonly configuracion: ConfiguracionCambio,
  ) {}

  get monedaDestino(): string {
    return this.configuracion.monedaDestino;
  }

  obtener(moneda: string): TipoCambio | null {
    const texto = this.almacen.leer(this.clave(moneda));
    if (texto === null) return null;
    try {
      const dato = JSON.parse(texto) as Partial<TipoCambio>;
      const valido = typeof dato.tasa === 'number' && dato.tasa > 0 && (dato.origen === 'manual' || dato.origen === 'automatico');
      return valido ? { moneda, tasa: dato.tasa as number, fecha: dato.fecha ?? null, origen: dato.origen as TipoCambio['origen'] } : null;
    } catch {
      return null;
    }
  }

  fijarManual(moneda: string, texto: string): TipoCambio {
    const tasa = leerTasa(texto);
    if (tasa === null) throw new ErrorDeUsuario('Escribe un cambio válido, mayor que 0 (por ejemplo 0,92).');
    return this.guardar({ moneda, tasa, fecha: null, origen: 'manual' });
  }

  /** Consulta el cambio del día. Si falla, lanza un ErrorDeUsuario y se mantiene el cambio anterior. */
  async actualizar(moneda: string): Promise<TipoCambio> {
    const { tasa, fecha } = await this.proveedor.obtenerTasa(moneda, this.configuracion.monedaDestino);
    return this.guardar({ moneda, tasa, fecha, origen: 'automatico' });
  }

  private guardar(cambio: TipoCambio): TipoCambio {
    this.almacen.escribir(this.clave(cambio.moneda), JSON.stringify(cambio));
    return cambio;
  }

  private clave(moneda: string): string {
    return `${this.configuracion.prefijoClave}${moneda}`;
  }
}
