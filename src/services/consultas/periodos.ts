import type { Periodo } from '../../models/filtro';

/** Intervalo [desdeMs, hastaMs) en UTC. null en un extremo = sin límite. */
export interface RangoUtc {
  readonly desdeMs: number | null;
  readonly hastaMs: number | null;
}

const MS_POR_DIA = 86_400_000;

function leerFecha(texto: string): number | null {
  const coincide = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto);
  if (!coincide) return null;
  const [anio, mes, dia] = [Number(coincide[1]), Number(coincide[2]), Number(coincide[3])];
  const ms = Date.UTC(anio, mes - 1, dia);
  // Date.UTC corrige fechas imposibles (31 de febrero): se comprueba que no lo ha hecho.
  return new Date(ms).getUTCDate() === dia ? ms : null;
}

/** Devuelve el intervalo del periodo, o un mensaje de error si el periodo no es válido. */
export function rangoDePeriodo(periodo: Periodo): RangoUtc | string {
  switch (periodo.tipo) {
    case 'total':
      return { desdeMs: null, hastaMs: null };
    case 'anio':
      return { desdeMs: Date.UTC(periodo.anio, 0, 1), hastaMs: Date.UTC(periodo.anio + 1, 0, 1) };
    case 'trimestre': {
      const mesInicial = (periodo.trimestre - 1) * 3;
      return {
        desdeMs: Date.UTC(periodo.anio, mesInicial, 1),
        hastaMs: Date.UTC(periodo.anio, mesInicial + 3, 1),
      };
    }
    case 'mes':
      return {
        desdeMs: Date.UTC(periodo.anio, periodo.mes - 1, 1),
        hastaMs: Date.UTC(periodo.anio, periodo.mes, 1),
      };
    case 'rango': {
      const desde = leerFecha(periodo.desde);
      const hasta = leerFecha(periodo.hasta);
      if (desde === null || hasta === null) return 'Indica las dos fechas del rango.';
      if (hasta < desde) return 'La fecha final no puede ser anterior a la inicial.';
      return { desdeMs: desde, hastaMs: hasta + MS_POR_DIA };
    }
  }
}

export function estaEnRango(utcMs: number, rango: RangoUtc): boolean {
  if (rango.desdeMs !== null && utcMs < rango.desdeMs) return false;
  if (rango.hastaMs !== null && utcMs >= rango.hastaMs) return false;
  return true;
}
