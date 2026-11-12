import type { OpcionTemporalidad } from '../../config/app-config';
import type { Temporalidad, Vela, VentanaVelas } from '../../models/velas';

export function duracionDeTemporalidad(temporalidad: Temporalidad, temporalidades: readonly OpcionTemporalidad[]): number {
  const opcion = temporalidades.find((candidata) => candidata.valor === temporalidad);
  if (!opcion) throw new Error(`Temporalidad desconocida: ${temporalidad}`);
  return opcion.minutos * 60_000;
}

/** De varias ventanas de la misma operación (una por temporalidad) elige la de velas más pequeñas: tiene más detalle. */
export function ventanaMasDetallada(
  ventanas: readonly VentanaVelas[],
  temporalidades: readonly OpcionTemporalidad[],
): VentanaVelas | null {
  let mejor: VentanaVelas | null = null;
  for (const ventana of ventanas) {
    if (!mejor || duracionDeTemporalidad(ventana.temporalidad, temporalidades) < duracionDeTemporalidad(mejor.temporalidad, temporalidades)) {
      mejor = ventana;
    }
  }
  return mejor;
}

/** Una ventana por operación (la más detallada), para consultarlas por id. */
export function indexarVentanas(
  ventanas: readonly VentanaVelas[],
  temporalidades: readonly OpcionTemporalidad[],
): Map<string, VentanaVelas> {
  const porOperacion = new Map<string, VentanaVelas[]>();
  for (const ventana of ventanas) {
    porOperacion.set(ventana.operacionId, [...(porOperacion.get(ventana.operacionId) ?? []), ventana]);
  }
  const indice = new Map<string, VentanaVelas>();
  for (const [operacionId, lista] of porOperacion) {
    const elegida = ventanaMasDetallada(lista, temporalidades);
    if (elegida) indice.set(operacionId, elegida);
  }
  return indice;
}

/** La vela que contiene el instante (la última que empieza en o antes de él), o null si no hay. */
export function velaQueContiene(velas: readonly Vela[], instanteMs: number, duracionVelaMs: number): Vela | null {
  let bajo = 0;
  let alto = velas.length - 1;
  let encontrada: Vela | null = null;
  while (bajo <= alto) {
    const medio = (bajo + alto) >> 1;
    const vela = velas[medio]!;
    if (vela.utcMs <= instanteMs) {
      encontrada = vela;
      bajo = medio + 1;
    } else {
      alto = medio - 1;
    }
  }
  return encontrada && instanteMs < encontrada.utcMs + duracionVelaMs ? encontrada : null;
}
