import type { EvaluacionSalida, Recorrido } from '../models/analisis-operacion';
import type { OperacionGuardada } from '../models/operacion';
import { crearElemento } from './dom';
import { fechaHoraUtc, importe, precio } from './formato';

const TEXTO_CIERRE = { tp: 'Take profit', sl: 'Stop loss', manual: 'Manual' } as const;

const neto = (o: OperacionGuardada): number => o.comision + o.impuestos + o.swap + o.beneficio;

function duracionLegible(ms: number): string {
  const minutos = Math.round(ms / 60_000);
  if (minutos < 1) return `${Math.max(1, Math.round(ms / 1000))} s`;
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `${horas} h ${minutos % 60} min`;
  return `${Math.floor(horas / 24)} días ${horas % 24} h`;
}

function filaDato(nombre: string, valor: string): HTMLElement {
  return crearElemento('tr', {}, [crearElemento('th', {}, [nombre]), crearElemento('td', {}, [valor])]);
}

export function crearTarjetaDatos(o: OperacionGuardada): HTMLElement {
  const resultado = neto(o);
  const filas = [
    filaDato('Tipo y tamaño', `${o.tipo === 'compra' ? 'Compra' : 'Venta'} · ${importe(o.lotes)} lotes`),
    filaDato('Entrada', precio(o.precioEntrada)),
    filaDato('Stop loss (el último que tuvo)', precio(o.stopLoss)),
    filaDato('Take profit', precio(o.takeProfit)),
    filaDato('Apertura (UTC)', fechaHoraUtc(o.aperturaUtc)),
    filaDato('Cierre (UTC)', o.cierreUtc === null ? 'Sigue abierta' : fechaHoraUtc(o.cierreUtc)),
    filaDato('Duración', o.cierreUtc === null ? '—' : duracionLegible(o.cierreUtc - o.aperturaUtc)),
    filaDato('Precio de cierre', precio(o.precioCierre)),
    filaDato('Cerrada por', o.cierrePor ? TEXTO_CIERRE[o.cierrePor] : '—'),
    filaDato('Beneficio / comisión / swap', `${importe(o.beneficio)} / ${importe(o.comision)} / ${importe(o.swap)}`),
    filaDato('Resultado neto', importe(resultado)),
  ];
  if (o.comentario !== '') filas.push(filaDato('Comentario', o.comentario));
  return crearElemento('div', { class: 'tarjeta' }, [
    crearElemento('h2', {}, [`${o.activo} · ${o.ticket}`]),
    crearElemento('table', { class: 'tabla-datos' }, [crearElemento('tbody', {}, filas)]),
  ]);
}

export function crearTarjetaRecorrido(recorrido: Recorrido | null): HTMLElement {
  const contenido: HTMLElement[] = [crearElemento('h2', {}, ['Recorrido del precio'])];
  if (!recorrido) {
    contenido.push(crearElemento('p', { class: 'texto-suave' }, ['Solo se calcula para operaciones cerradas.']));
    return crearElemento('div', { class: 'tarjeta' }, contenido);
  }
  const conPorcentaje = (valor: number, pct: number | null, hacia: string) => `${precio(valor)}${pct === null ? '' : ` (${importe(pct)} % del camino hasta el ${hacia})`}`;
  contenido.push(
    crearElemento('table', { class: 'tabla-datos' }, [
      crearElemento('tbody', {}, [
        filaDato('Máximo a favor', conPorcentaje(recorrido.mfe, recorrido.mfePorcentajeTp, 'take profit')),
        filaDato('Máximo en contra', conPorcentaje(recorrido.mae, recorrido.maePorcentajeSl, 'stop loss')),
      ]),
    ]),
    crearElemento('p', { class: 'texto-suave' }, [
      recorrido.velasUsadas > 0
        ? `Calculado con ${recorrido.velasUsadas} velas completas dentro de la operación: es un mínimo, el recorrido real pudo ser algo mayor. Distancias en precio. Si moviste el stop a break even, no hay porcentaje contra el stop.`
        : 'La operación es más corta que una vela: solo se conocen los precios de entrada y salida, el recorrido real pudo ser mayor.',
    ]),
  );
  return crearElemento('div', { class: 'tarjeta' }, contenido);
}

const TEXTO_SALIDA: Record<EvaluacionSalida['resultado'], string> = {
  tp_alcanzado: 'Cerraste a mano y el precio llegó después a tu take profit.',
  sl_alcanzado: 'Cerraste a mano y el precio fue después hacia tu stop loss: cerrar te ayudó.',
  ninguno: 'Cerraste a mano y el precio no llegó ni al take profit ni al stop loss en las velas siguientes.',
  no_aplica: '',
};

/** Devuelve null si no hay nada que decir (la operación no se cerró a mano o no tiene take profit). */
export function crearTarjetaSalida(evaluacion: EvaluacionSalida): HTMLElement | null {
  if (evaluacion.resultado === 'no_aplica') return null;
  return crearElemento('div', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Qué pasó después de cerrar']),
    crearElemento('p', {}, [TEXTO_SALIDA[evaluacion.resultado]]),
    crearElemento('p', { class: 'texto-suave' }, [`Se han mirado ${evaluacion.velasMiradas} velas posteriores al cierre.`]),
  ]);
}

export function crearSinVelas(): HTMLElement {
  const enlace = crearElemento('a', { href: '#/velas', class: 'enlace' }, ['Velas y ficheros']);
  return crearElemento('div', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Gráfico']),
    crearElemento('p', { class: 'texto-suave' }, ['Esta operación no tiene velas guardadas. Cárgalas en ', enlace, ' (con el activo y el rango de fechas que la incluyan).']),
  ]);
}
