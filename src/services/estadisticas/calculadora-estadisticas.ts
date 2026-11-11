/**
 * Cálculo de estadísticas de operaciones cerradas. Es código puro (sin base de
 * datos ni pantalla) para poder probarlo y reutilizarlo en el panel.
 */
import type { EstadisticasOperaciones } from '../../models/estadisticas';
import type { TipoOperacion } from '../../models/operacion';

export interface OperacionCalculable {
  readonly ticket: string;
  readonly tipo: TipoOperacion;
  readonly comision: number;
  readonly impuestos: number;
  readonly swap: number;
  readonly beneficio: number;
  /** Momento del cierre: sirve para ordenar. No se mezclan textos y números en una misma lista. */
  readonly cierre: string | number;
}

export function redondear2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Resultado de la operación contando comisión, impuestos y swap. */
export function netoDeOperacion(operacion: OperacionCalculable): number {
  return redondear2(operacion.comision + operacion.impuestos + operacion.swap + operacion.beneficio);
}

function ordenarPorCierre(operaciones: readonly OperacionCalculable[]): OperacionCalculable[] {
  return [...operaciones].sort((a, b) => {
    if (a.cierre !== b.cierre) return a.cierre < b.cierre ? -1 : 1;
    return Number(a.ticket) - Number(b.ticket);
  });
}

interface Racha {
  cantidad: number;
  importe: number;
}

/** Racha más larga de ganadoras y de perdedoras, con lo que sumaron. */
function calcularRachas(netos: readonly number[]): { ganadoras: Racha; perdedoras: Racha } {
  const mejor = { ganadoras: { cantidad: 0, importe: 0 }, perdedoras: { cantidad: 0, importe: 0 } };
  let actual: Racha = { cantidad: 0, importe: 0 };
  let signoActual = 0;

  for (const neto of netos) {
    const signo = Math.sign(neto);
    if (signo === 0 || signo !== signoActual) {
      actual = { cantidad: 0, importe: 0 };
      signoActual = signo;
    }
    if (signo === 0) continue;
    actual = { cantidad: actual.cantidad + 1, importe: actual.importe + neto };
    const candidata = signo > 0 ? mejor.ganadoras : mejor.perdedoras;
    if (actual.cantidad > candidata.cantidad) {
      if (signo > 0) mejor.ganadoras = actual;
      else mejor.perdedoras = actual;
    }
  }
  return mejor;
}

/**
 * Drawdown sobre el balance acumulado, partiendo del balance inicial y
 * ordenando por cierre. Es la misma definición que usa MetaTrader 4.
 */
function calcularDrawdown(netos: readonly number[], balanceInicial: number) {
  let balance = balanceInicial;
  let maximo = balanceInicial;
  let minimo = balanceInicial;
  let caidaMaxima = 0;
  let caidaMaximaPct = 0;

  for (const neto of netos) {
    balance += neto;
    maximo = Math.max(maximo, balance);
    minimo = Math.min(minimo, balance);
    caidaMaxima = Math.max(caidaMaxima, maximo - balance);
    if (maximo > 0) caidaMaximaPct = Math.max(caidaMaximaPct, ((maximo - balance) / maximo) * 100);
  }
  return {
    absoluto: redondear2(balanceInicial - minimo),
    maximo: redondear2(caidaMaxima),
    maximoPct: redondear2(caidaMaximaPct),
  };
}

function sumar(valores: readonly number[]): number {
  return redondear2(valores.reduce((suma, valor) => suma + valor, 0));
}

function media(valores: readonly number[]): number {
  return valores.length === 0 ? 0 : redondear2(sumar(valores) / valores.length);
}

export function calcularEstadisticas(
  operaciones: readonly OperacionCalculable[],
  balanceInicial: number,
): EstadisticasOperaciones {
  const ordenadas = ordenarPorCierre(operaciones);
  const netos = ordenadas.map(netoDeOperacion);
  const ganancias = netos.filter((neto) => neto > 0);
  const perdidas = netos.filter((neto) => neto < 0);
  const rachas = calcularRachas(netos);
  const drawdown = calcularDrawdown(netos, balanceInicial);

  const beneficioBruto = sumar(ganancias);
  const perdidaBruta = sumar(perdidas);
  const beneficioNeto = sumar(netos);

  return {
    totalOperaciones: ordenadas.length,
    largas: ordenadas.filter((operacion) => operacion.tipo === 'compra').length,
    cortas: ordenadas.filter((operacion) => operacion.tipo === 'venta').length,
    ganadoras: ganancias.length,
    perdedoras: perdidas.length,
    beneficioBruto,
    perdidaBruta,
    beneficioNeto,
    factorBeneficio: perdidaBruta === 0 ? null : redondear2(beneficioBruto / Math.abs(perdidaBruta)),
    pagoEsperado: ordenadas.length === 0 ? 0 : redondear2(beneficioNeto / ordenadas.length),
    mayorGanancia: ganancias.length === 0 ? 0 : Math.max(...ganancias),
    mayorPerdida: perdidas.length === 0 ? 0 : Math.min(...perdidas),
    gananciaMedia: media(ganancias),
    perdidaMedia: media(perdidas),
    rachaGanadoras: rachas.ganadoras.cantidad,
    rachaGanadorasImporte: redondear2(rachas.ganadoras.importe),
    rachaPerdedoras: rachas.perdedoras.cantidad,
    rachaPerdedorasImporte: redondear2(rachas.perdedoras.importe),
    drawdownAbsoluto: drawdown.absoluto,
    drawdownMaximo: drawdown.maximo,
    drawdownMaximoPct: drawdown.maximoPct,
  };
}
