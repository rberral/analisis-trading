/**
 * Conversión de la hora del servidor del broker a UTC.
 *
 * El informe no dice en qué horario está, así que el usuario lo indica al
 * cargarlo: o bien una zona con nombre (por ejemplo Europe/Athens), o bien la
 * regla «Nueva York + N horas», habitual en brokers de Forex. En ambos casos los
 * cambios de hora de verano se calculan con la base de datos de zonas del
 * navegador (Intl), sin tablas propias.
 */
import { ErrorDeUsuario } from './errores';

export type HorarioBroker =
  | { readonly tipo: 'zona'; readonly zona: string }
  | { readonly tipo: 'nueva_york_mas'; readonly horas: number };

/**
 * normal: la hora existe una sola vez.
 * ambigua: ocurre dos veces (cambio de hora de otoño); se usa la primera.
 * inexistente: no ocurre (cambio de hora de primavera); se usa el desfase anterior al salto.
 */
export type EstadoHora = 'normal' | 'ambigua' | 'inexistente';

export interface HoraConvertida {
  readonly utcMs: number;
  readonly estado: EstadoHora;
}

const ZONA_NUEVA_YORK = 'America/New_York';
const MS_POR_HORA = 3_600_000;
const MS_POR_DIA = 86_400_000;
const LIMITE_HORAS_NUEVA_YORK = 14;

// Crear un formateador es caro y se pide muchas veces (una vez por operación).
const formateadores = new Map<string, Intl.DateTimeFormat>();

function obtenerFormateador(zona: string): Intl.DateTimeFormat {
  const existente = formateadores.get(zona);
  if (existente) return existente;
  const nuevo = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  formateadores.set(zona, nuevo);
  return nuevo;
}

export function zonaValida(zona: string): boolean {
  if (zona.trim() === '') return false;
  try {
    obtenerFormateador(zona.trim());
    return true;
  } catch {
    return false;
  }
}

/** Devuelve un texto de error si el horario no es utilizable, o null si es correcto. */
export function validarHorario(horario: HorarioBroker): string | null {
  if (horario.tipo === 'zona') {
    return zonaValida(horario.zona)
      ? null
      : 'La zona horaria no es válida. Usa un nombre como Europe/Athens o America/New_York.';
  }
  const dentroDelLimite =
    Number.isFinite(horario.horas) && Math.abs(horario.horas) <= LIMITE_HORAS_NUEVA_YORK;
  return dentroDelLimite
    ? null
    : `Indica las horas de diferencia con Nueva York (un número entre -${LIMITE_HORAS_NUEVA_YORK} y ${LIMITE_HORAS_NUEVA_YORK}).`;
}

/** Desfase (en ms) de la zona respecto a UTC en un instante concreto. */
function desfaseEnInstante(instanteMs: number, zona: string): number {
  const partes = obtenerFormateador(zona).formatToParts(new Date(instanteMs));
  const valor = (tipo: string): number => Number(partes.find((parte) => parte.type === tipo)?.value);
  const comoSiFueraUtc = Date.UTC(
    valor('year'),
    valor('month') - 1,
    valor('day'),
    valor('hour'),
    valor('minute'),
    valor('second'),
  );
  const instanteSinMilisegundos = Math.floor(instanteMs / 1000) * 1000;
  return comoSiFueraUtc - instanteSinMilisegundos;
}

/** Desfase (en ms) de una zona con nombre respecto a UTC en un instante. Para mostrar horas en esa zona. */
export function desfaseDeZonaEnInstante(instanteMs: number, zona: string): number {
  return desfaseEnInstante(instanteMs, zona.trim());
}

/** Cuánto hay que sumar a un instante UTC para obtener la hora del reloj del servidor del broker en ese momento. */
export function desfaseDelBrokerMs(utcMs: number, horario: HorarioBroker): number {
  if (horario.tipo === 'zona') return desfaseEnInstante(utcMs, horario.zona.trim());
  return desfaseEnInstante(utcMs, ZONA_NUEVA_YORK) + horario.horas * MS_POR_HORA;
}

/**
 * Convierte una hora de reloj de una zona (expresada como si fuera UTC) en el
 * instante real. Prueba los desfases de un día antes y un día después: solo es
 * válido el que, al aplicarlo, devuelve la misma hora de reloj.
 */
function convertirHoraDeRelojEnZona(horaDeRelojMs: number, zona: string): HoraConvertida {
  const desfaseAntes = desfaseEnInstante(horaDeRelojMs - MS_POR_DIA, zona);
  const desfaseDespues = desfaseEnInstante(horaDeRelojMs + MS_POR_DIA, zona);

  const instantesValidos: number[] = [];
  for (const desfase of new Set([desfaseAntes, desfaseDespues])) {
    const instante = horaDeRelojMs - desfase;
    if (desfaseEnInstante(instante, zona) === desfase) instantesValidos.push(instante);
  }

  if (instantesValidos.length === 0) {
    return { utcMs: horaDeRelojMs - desfaseAntes, estado: 'inexistente' };
  }
  return {
    utcMs: Math.min(...instantesValidos),
    estado: instantesValidos.length === 1 ? 'normal' : 'ambigua',
  };
}

/** Convierte "2026-10-15T17:55:00" (hora del servidor del broker) en la hora UTC real. */
export function convertirHoraBrokerAUtc(horaBroker: string, horario: HorarioBroker): HoraConvertida {
  const horaDeRelojMs = leerHoraDeReloj(horaBroker);
  if (horario.tipo === 'zona') {
    return convertirHoraDeRelojEnZona(horaDeRelojMs, horario.zona.trim());
  }
  // Hora de Nueva York = hora del broker - N horas; luego se aplica el cambio de hora de Nueva York.
  return convertirHoraDeRelojEnZona(horaDeRelojMs - horario.horas * MS_POR_HORA, ZONA_NUEVA_YORK);
}

function leerHoraDeReloj(hora: string): number {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(hora);
  if (!coincidencia) throw new ErrorDeUsuario(`Fecha y hora no válidas en el informe: «${hora}»`);
  const [anio, mes, dia, horas, minutos, segundos] = coincidencia.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return Date.UTC(anio, mes - 1, dia, horas, minutos, segundos);
}
