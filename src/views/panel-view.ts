import type { AnalisisPeriodo, PuntoBalance } from '../services/consultas/analisis-periodo';
import { crearElemento, crearSvg } from './dom';
import type { PerfilEstrategia } from '../services/analisis/perfil-estrategia';
import { crearTarjetaPerfil } from './perfil-view';
import { entero, fechaHoraUtc, importe, porcentaje } from './formato';

function cifra(texto: string, valor: string, clase = ''): HTMLElement {
  return crearElemento('div', { class: 'cifra' }, [
    crearElemento('div', { class: `cifra__valor ${clase}`.trim() }, [valor]),
    crearElemento('div', { class: 'cifra__texto' }, [texto]),
  ]);
}

const claseSigno = (valor: number): string => (valor > 0 ? 'positivo' : valor < 0 ? 'negativo' : '');

const ANCHO = 640;
const ALTO = 220;
const MARGEN = 8;

function crearCurva(curva: readonly PuntoBalance[], balanceInicial: number): HTMLElement {
  if (curva.length < 2) {
    return crearElemento('p', { class: 'texto-suave' }, ['Hacen falta al menos dos operaciones para dibujar la curva.']);
  }
  const balances = [balanceInicial, ...curva.map((punto) => punto.balance)];
  const minimo = Math.min(...balances);
  const maximo = Math.max(...balances);
  const rango = maximo - minimo || 1;
  // Eje X por orden de operación (no por fecha) para que las rachas no queden comprimidas.
  const x = (indice: number) => MARGEN + (indice / (curva.length - 1)) * (ANCHO - 2 * MARGEN);
  const y = (balance: number) => ALTO - MARGEN - ((balance - minimo) / rango) * (ALTO - 2 * MARGEN);
  const puntos = curva.map((punto, indice) => `${x(indice).toFixed(1)},${y(punto.balance).toFixed(1)}`).join(' ');
  const yInicial = y(balanceInicial).toFixed(1);

  const dibujo = crearSvg('svg', { viewBox: `0 0 ${ANCHO} ${ALTO}`, class: 'curva', role: 'img', 'aria-label': 'Curva de balance' }, [
    crearSvg('line', { x1: String(MARGEN), x2: String(ANCHO - MARGEN), y1: yInicial, y2: yInicial, class: 'curva__base' }),
    crearSvg('polyline', { points: puntos, class: 'curva__linea' }),
  ]);
  const primero = curva[0];
  const ultimo = curva[curva.length - 1];
  return crearElemento('div', {}, [
    dibujo as unknown as HTMLElement,
    crearElemento('p', { class: 'texto-suave' }, [
      `De ${primero ? fechaHoraUtc(primero.utcMs) : ''} a ${ultimo ? fechaHoraUtc(ultimo.utcMs) : ''} (UTC) · mínimo ${importe(minimo)} · máximo ${importe(maximo)}. La línea fina marca el balance inicial.`,
    ]),
  ]);
}

export function crearContenidoPanel(analisis: AnalisisPeriodo, perfil: PerfilEstrategia | null): HTMLElement {
  const e = analisis.estadisticas;
  if (e.totalOperaciones === 0) {
    return crearElemento('p', { class: 'aviso' }, ['No hay operaciones cerradas con este filtro.']);
  }
  const acierto = (e.ganadoras / e.totalOperaciones) * 100;
  return crearElemento('div', {}, [
    crearElemento('div', { class: 'tarjeta' }, [
      crearElemento('h2', {}, ['Resumen']),
      crearElemento('div', { class: 'cifras' }, [
        cifra('resultado neto', importe(e.beneficioNeto), claseSigno(e.beneficioNeto)),
        cifra('operaciones', entero(e.totalOperaciones)),
        cifra('% de acierto', porcentaje(acierto)),
        cifra('factor de beneficio', e.factorBeneficio === null ? '—' : importe(e.factorBeneficio)),
        cifra('pago esperado por operación', importe(e.pagoEsperado), claseSigno(e.pagoEsperado)),
        cifra('drawdown máximo', `${importe(e.drawdownMaximo)} (${porcentaje(e.drawdownMaximoPct)})`),
        cifra('mayor ganancia', importe(e.mayorGanancia)),
        cifra('mayor pérdida', importe(e.mayorPerdida)),
        cifra('ganancia media', importe(e.gananciaMedia)),
        cifra('pérdida media', importe(e.perdidaMedia)),
        cifra('mejor racha de ganadoras', `${e.rachaGanadoras} (${importe(e.rachaGanadorasImporte)})`),
        cifra('peor racha de perdedoras', `${e.rachaPerdedoras} (${importe(e.rachaPerdedorasImporte)})`),
        cifra('largas / cortas', `${e.largas} / ${e.cortas}`),
      ]),
      crearElemento('p', { class: 'texto-suave' }, [
        `Balance de partida del periodo: ${importe(analisis.balanceInicial)}. El drawdown se calcula dentro del periodo elegido.`,
      ]),
    ]),
    crearElemento('div', { class: 'tarjeta' }, [crearElemento('h2', {}, ['Curva de balance']), crearCurva(analisis.curva, analisis.balanceInicial)]),
    ...(perfil ? [crearTarjetaPerfil(perfil)] : []),
  ]);
}
