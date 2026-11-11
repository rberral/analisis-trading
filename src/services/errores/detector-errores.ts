/**
 * Detecta errores habituales usando solo los datos del informe (sin velas).
 * Los que necesitan precios intermedios (salidas anticipadas, MAE/MFE) llegan
 * en una fase posterior.
 */
import type { UMBRALES_ERRORES } from '../../config/app-config';
import type { ErrorDetectado } from '../../models/error-detectado';
import type { EstadisticasOperaciones } from '../../models/estadisticas';
import type { OperacionGuardada } from '../../models/operacion';
import { netoDeOperacion, redondear2 } from '../estadisticas/calculadora-estadisticas';

type Umbrales = typeof UMBRALES_ERRORES;

const MS_POR_HORA = 3_600_000;

const neto = (operacion: OperacionGuardada): number =>
  netoDeOperacion({ ...operacion, cierre: operacion.cierreUtc ?? 0 });

function impactoDe(operaciones: readonly OperacionGuardada[]): number {
  return redondear2(operaciones.reduce((total, operacion) => total + neto(operacion), 0));
}

function crearError(
  base: Omit<ErrorDetectado, 'tickets' | 'impacto'>,
  afectadas: readonly OperacionGuardada[],
): ErrorDetectado {
  return { ...base, tickets: afectadas.map((o) => o.ticket), impacto: impactoDe(afectadas) };
}

const MS_POR_MINUTO = 60_000;

/**
 * Sin stop loss al cerrar. Las que se cerraron en pocos minutos se separan: casi
 * siempre son aperturas por error (clic equivocado) corregidas enseguida, no una
 * falta de disciplina. Un stop loss movido a break even no cuenta: sigue siendo un precio.
 */
function detectarSinStopLoss(operaciones: readonly OperacionGuardada[], umbrales: Umbrales): ErrorDetectado[] {
  const sinStop = operaciones.filter((o) => o.stopLoss === null);
  const esRapida = (o: OperacionGuardada) =>
    (o.cierreUtc ?? o.aperturaUtc) - o.aperturaUtc <= umbrales.minutosAperturaErronea * MS_POR_MINUTO;
  const erroneas = sinStop.filter(esRapida);
  const duraderas = sinStop.filter((o) => !esRapida(o));
  const errores: ErrorDetectado[] = [];
  if (duraderas.length > 0) {
    errores.push(
      crearError(
        {
          codigo: 'sin_stop_loss',
          titulo: 'Operaciones mantenidas sin stop loss',
          descripcion: `${duraderas.length} operaciones estuvieron más de ${umbrales.minutosAperturaErronea} minutos abiertas sin stop loss.`,
          consejo: 'Define el stop loss antes de entrar: es lo que limita cuánto puedes perder en una operación.',
        },
        duraderas,
      ),
    );
  }
  if (erroneas.length > 0) {
    errores.push(
      crearError(
        {
          codigo: 'apertura_erronea',
          titulo: 'Posibles aperturas por error',
          descripcion: `${erroneas.length} operaciones sin stop loss se cerraron en menos de ${umbrales.minutosAperturaErronea} minutos.`,
          consejo: 'Parecen entradas abiertas por equivocación y cerradas enseguida. Si se repiten, añade una confirmación o un stop loss automático a tu forma de abrir.',
        },
        erroneas,
      ),
    );
  }
  return errores;
}

function detectarPerdidaDesproporcionada(
  operaciones: readonly OperacionGuardada[],
  estadisticas: EstadisticasOperaciones,
  umbrales: Umbrales,
): ErrorDetectado[] {
  if (estadisticas.gananciaMedia <= 0) return [];
  const limite = -umbrales.perdidaSobreGananciaMedia * estadisticas.gananciaMedia;
  const afectadas = operaciones.filter((o) => neto(o) < limite);
  if (afectadas.length === 0) return [];
  return [
    crearError(
      {
        codigo: 'perdida_desproporcionada',
        titulo: 'Pérdidas mucho mayores que tu ganancia media',
        descripcion: `${afectadas.length} operaciones perdieron más de ${umbrales.perdidaSobreGananciaMedia} veces tu ganancia media (${estadisticas.gananciaMedia}).`,
        consejo: 'Una sola pérdida grande borra varias ganancias. Reduce el tamaño o acerca el stop para que ninguna pérdida supere lo que esperas ganar.',
      },
      afectadas,
    ),
  ];
}

/** Abre con más lotes justo después de perder: señal típica de querer recuperar. */
function detectarLotesTrasPerdida(operaciones: readonly OperacionGuardada[], umbrales: Umbrales): ErrorDetectado[] {
  const porApertura = [...operaciones].sort((a, b) => a.aperturaUtc - b.aperturaUtc);
  const afectadas: OperacionGuardada[] = [];
  porApertura.forEach((actual, indice) => {
    const anterior = porApertura[indice - 1];
    if (!anterior || anterior.cuenta !== actual.cuenta) return;
    const anteriorCerradaYPerdedora = (anterior.cierreUtc ?? Infinity) <= actual.aperturaUtc && neto(anterior) < 0;
    if (anteriorCerradaYPerdedora && actual.lotes >= anterior.lotes * umbrales.aumentoDeLotesTrasPerdida) {
      afectadas.push(actual);
    }
  });
  if (afectadas.length === 0) return [];
  return [
    crearError(
      {
        codigo: 'lotes_tras_perdida',
        titulo: 'Subes el tamaño después de una pérdida',
        descripcion: `${afectadas.length} veces abriste con al menos ${umbrales.aumentoDeLotesTrasPerdida} veces los lotes de la operación perdedora anterior.`,
        consejo: 'Aumentar el riesgo para recuperar suele agrandar las pérdidas. Fija un tamaño por operación y respétalo, también tras perder.',
      },
      afectadas,
    ),
  ];
}

function dia(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

function detectarSobreoperacion(operaciones: readonly OperacionGuardada[], umbrales: Umbrales): ErrorDetectado[] {
  const porDia = new Map<string, OperacionGuardada[]>();
  for (const operacion of operaciones) {
    const clave = dia(operacion.aperturaUtc);
    porDia.set(clave, [...(porDia.get(clave) ?? []), operacion]);
  }
  const excesivos = [...porDia.entries()].filter(([, lista]) => lista.length > umbrales.operacionesPorDia);
  if (excesivos.length === 0) return [];
  const afectadas = excesivos.flatMap(([, lista]) => lista);
  return [
    crearError(
      {
        codigo: 'sobreoperacion',
        titulo: 'Días con demasiadas operaciones',
        descripcion: `${excesivos.length} días con más de ${umbrales.operacionesPorDia} operaciones abiertas (${excesivos
          .map(([fecha]) => fecha)
          .slice(0, 5)
          .join(', ')}${excesivos.length > 5 ? '…' : ''}).`,
        consejo: 'Operar mucho en un día suele indicar impulsividad. Fija un máximo diario de operaciones y para al alcanzarlo.',
      },
      afectadas,
    ),
  ];
}

function duracionMediaHoras(operaciones: readonly OperacionGuardada[]): number {
  const total = operaciones.reduce((suma, o) => suma + ((o.cierreUtc ?? o.aperturaUtc) - o.aperturaUtc), 0);
  return total / operaciones.length / MS_POR_HORA;
}

function detectarPerdedorasLargas(operaciones: readonly OperacionGuardada[], umbrales: Umbrales): ErrorDetectado[] {
  const ganadoras = operaciones.filter((o) => neto(o) > 0);
  const perdedoras = operaciones.filter((o) => neto(o) < 0);
  if (ganadoras.length < umbrales.minimoParaDuraciones || perdedoras.length < umbrales.minimoParaDuraciones) return [];
  const horasGanadoras = duracionMediaHoras(ganadoras);
  const horasPerdedoras = duracionMediaHoras(perdedoras);
  if (horasPerdedoras < horasGanadoras * umbrales.duracionPerdedorasSobreGanadoras) return [];
  return [
    {
      codigo: 'perdedoras_largas',
      titulo: 'Mantienes las perdedoras más tiempo que las ganadoras',
      descripcion: `Las perdedoras duran de media ${redondear2(horasPerdedoras)} h y las ganadoras ${redondear2(horasGanadoras)} h.`,
      consejo: 'Es el patrón de «dejar correr las pérdidas y cortar las ganancias». Respeta el stop y deja que las ganadoras lleguen a su objetivo.',
      tickets: [],
      impacto: null,
    },
  ];
}

/** `operaciones` debe contener solo operaciones cerradas. */
export function detectarErrores(
  operaciones: readonly OperacionGuardada[],
  estadisticas: EstadisticasOperaciones,
  umbrales: Umbrales,
): ErrorDetectado[] {
  if (operaciones.length < umbrales.minimoOperaciones) return [];
  return [
    ...detectarSinStopLoss(operaciones, umbrales),
    ...detectarPerdidaDesproporcionada(operaciones, estadisticas, umbrales),
    ...detectarLotesTrasPerdida(operaciones, umbrales),
    ...detectarSobreoperacion(operaciones, umbrales),
    ...detectarPerdedorasLargas(operaciones, umbrales),
  ];
}
