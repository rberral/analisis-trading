/** Elige, para cada operación, las velas que se guardan: margen antes, duración y margen después. */
import type { OperacionGuardada } from '../../models/operacion';
import type { Temporalidad, Vela, VentanaVelas } from '../../models/velas';

export interface ParametrosVentana {
  readonly duracionVelaMs: number;
  readonly margenVelas: number;
  readonly maximoVelas: number;
}

export interface ResultadoVentanas {
  readonly ventanas: VentanaVelas[];
  /** Operaciones cerradas del activo que caen dentro del rango de velas del fichero. */
  readonly cubiertas: number;
  /** Operaciones cerradas del activo que quedan fuera del rango del fichero. */
  readonly fueraDeRango: number;
}

/** Primer índice con vela cuyo utcMs >= valor. */
function primerIndiceDesde(velas: readonly Vela[], valor: number): number {
  let bajo = 0;
  let alto = velas.length;
  while (bajo < alto) {
    const medio = (bajo + alto) >> 1;
    if (velas[medio]!.utcMs < valor) bajo = medio + 1;
    else alto = medio;
  }
  return bajo;
}

export function crearVentanas(
  velas: readonly Vela[],
  operaciones: readonly OperacionGuardada[],
  temporalidad: Temporalidad,
  cargaId: string,
  parametros: ParametrosVentana,
): ResultadoVentanas {
  const ventanas: VentanaVelas[] = [];
  let fueraDeRango = 0;
  const primera = velas[0];
  const ultima = velas[velas.length - 1];
  if (!primera || !ultima) return { ventanas, cubiertas: 0, fueraDeRango: operaciones.length };
  const finDeDatos = ultima.utcMs + parametros.duracionVelaMs;

  for (const operacion of operaciones) {
    if (operacion.cierreUtc === null) continue;
    if (operacion.aperturaUtc < primera.utcMs || operacion.cierreUtc >= finDeDatos) {
      fueraDeRango += 1;
      continue;
    }
    // La vela que contiene la apertura empieza antes que la apertura: se retrocede una vela más.
    const desde = primerIndiceDesde(velas, operacion.aperturaUtc - parametros.duracionVelaMs + 1) - parametros.margenVelas;
    const hasta = primerIndiceDesde(velas, operacion.cierreUtc + 1) + parametros.margenVelas;
    const inicio = Math.max(0, desde);
    const fin = Math.min(velas.length, hasta);
    const truncada = fin - inicio > parametros.maximoVelas;
    ventanas.push({
      id: `${operacion.id}:${temporalidad}`,
      operacionId: operacion.id,
      cuenta: operacion.cuenta,
      activo: operacion.activo,
      temporalidad,
      cargaId,
      truncada,
      velas: velas.slice(inicio, truncada ? inicio + parametros.maximoVelas : fin),
    });
  }
  return { ventanas, cubiertas: ventanas.length, fueraDeRango };
}
