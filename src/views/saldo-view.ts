import type { ResumenSaldo } from '../services/analisis/resumen-saldo';
import { crearElemento } from './dom';
import { fechaHoraUtc, importe } from './formato';

function cifra(texto: string, valor: string, clase = ''): HTMLElement {
  return crearElemento('div', { class: 'cifra' }, [
    crearElemento('div', { class: `cifra__valor ${clase}`.trim() }, [valor]),
    crearElemento('div', { class: 'cifra__texto' }, [texto]),
  ]);
}

const claseSigno = (valor: number): string => (valor > 0 ? 'positivo' : valor < 0 ? 'negativo' : '');

/** Cuánto se fía uno del saldo calculado: lo dice la comparación con el saldo del broker y de dónde salen los ingresos. */
function textoPrecision(saldo: ResumenSaldo): string {
  if (saldo.diferencia === null) return '';
  const origen = saldo.ingresosConHora
    ? 'Los ingresos y retiradas se conocen con su hora exacta.'
    : 'Los ingresos y retiradas solo se conocen por año (falta el estado de la cuenta en efectivo): el saldo en cada operación es aproximado.';
  // Solo informa: la diferencia no cambia ningún cálculo.
  const comparacion = `Diferencia entre el saldo calculado y el del broker: ${importe(saldo.diferencia)} (solo informativo; puede deberse a los cambios de moneda, a algún fichero que falta o a operaciones sin importar).`;
  return `${comparacion} ${origen}`;
}

/**
 * Tarjeta «Cuenta» del Panel. Solo el saldo disponible se calcula; las ganancias no realizadas y el apalancamiento
 * se muestran tal como los dio el broker o el usuario, sin que intervengan en nada más.
 * `resultadoRealizado` es el resultado neto con el filtro elegido; el saldo, en cambio, es el de toda la cuenta.
 */
export function crearTarjetaSaldo(saldo: ResumenSaldo, moneda: string, resultadoRealizado: number): HTMLElement {
  const cifras: HTMLElement[] = [];
  if (saldo.saldoDisponible !== null && saldo.noRealizadas !== null && saldo.patrimonio !== null) {
    cifras.push(
      cifra('saldo disponible (en efectivo, sin apalancamiento)', importe(saldo.saldoDisponible)),
      cifra('ganancias y pérdidas realizadas (según el filtro)', importe(resultadoRealizado), claseSigno(resultadoRealizado)),
      cifra('no realizadas (solo informativo)', importe(saldo.noRealizadas), claseSigno(saldo.noRealizadas)),
      cifra('saldo del broker con las no realizadas (solo informativo)', importe(saldo.patrimonio)),
    );
  }
  if (saldo.apalancamiento !== null) cifras.push(cifra('apalancamiento indicado (solo informativo)', `${saldo.apalancamiento}:1`));
  const fecha = saldo.fechaUtcMs === null ? '' : ` Cifras del broker a ${fechaHoraUtc(saldo.fechaUtcMs)} (UTC).`;
  return crearElemento('div', { class: 'tarjeta' }, [
    crearElemento('h2', {}, [moneda === '' ? 'Cuenta' : `Cuenta (${moneda})`]),
    crearElemento('div', { class: 'cifras' }, cifras),
    crearElemento('p', { class: 'texto-suave' }, [`${textoPrecision(saldo)}${fecha}`.trim()]),
  ]);
}
