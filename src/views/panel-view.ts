import type { AnalisisPeriodo, PuntoBalance } from '../services/consultas/analisis-periodo';
import { crearElemento, crearSvg } from './dom';
import type { PerfilEstrategia } from '../services/analisis/perfil-estrategia';
import { crearTarjetaPerfil } from './perfil-view';
import type { ResumenSaldo } from '../services/analisis/resumen-saldo';
import { crearTarjetaSaldo } from './saldo-view';
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

interface ElementosCurva {
  readonly dibujo: SVGElement;
  readonly contenedor: HTMLElement;
  readonly etiqueta: HTMLElement;
  readonly guia: SVGElement;
  readonly marca: SVGElement;
  readonly curva: readonly PuntoBalance[];
  readonly balanceInicial: number;
  readonly x: (indice: number) => number;
  readonly y: (balance: number) => number;
}

/** Al pasar el puntero (o el dedo) por la curva, enseña la fecha, el balance y el resultado acumulado de la operación más cercana. */
function activarEtiqueta(e: ElementosCurva): void {
  const ocultar = (): void => {
    e.etiqueta.hidden = true;
    e.guia.setAttribute('visibility', 'hidden');
    e.marca.setAttribute('visibility', 'hidden');
  };
  const mostrar = (evento: PointerEvent): void => {
    const caja = e.dibujo.getBoundingClientRect();
    if (caja.width === 0) return;
    const xSvg = ((evento.clientX - caja.left) / caja.width) * ANCHO;
    const ultima = e.curva.length - 1;
    const indice = Math.min(ultima, Math.max(0, Math.round(((xSvg - MARGEN) / (ANCHO - 2 * MARGEN)) * ultima)));
    const punto = e.curva[indice]!;
    const px = e.x(indice);
    const py = e.y(punto.balance);
    e.guia.setAttribute('x1', String(px));
    e.guia.setAttribute('x2', String(px));
    e.marca.setAttribute('cx', String(px));
    e.marca.setAttribute('cy', String(py));
    e.guia.setAttribute('visibility', 'visible');
    e.marca.setAttribute('visibility', 'visible');

    // Resultado acumulado respecto al balance inicial del periodo, en importe y en % de la cuenta.
    const acumulado = punto.balance - e.balanceInicial;
    const enPorcentaje = e.balanceInicial > 0 ? ` (${porcentaje((acumulado / e.balanceInicial) * 100)})` : '';
    e.etiqueta.replaceChildren(
      crearElemento('div', {}, [`${fechaHoraUtc(punto.utcMs)} UTC`]),
      crearElemento('div', {}, [`Balance: ${importe(punto.balance)}`]),
      crearElemento('div', { class: claseSigno(acumulado) }, [`Acumulado: ${importe(acumulado)}${enPorcentaje}`]),
      crearElemento('div', { class: 'texto-suave' }, [`Operación ${indice + 1} de ${e.curva.length}`]),
    );
    e.etiqueta.hidden = false;
    // La etiqueta sigue al puntero, pero sin salirse del gráfico por ningún lado.
    const cajaContenedor = e.contenedor.getBoundingClientRect();
    const izquierda = ((px / ANCHO) * caja.width) + (caja.left - cajaContenedor.left);
    const mitad = e.etiqueta.offsetWidth / 2;
    const limite = Math.max(mitad, Math.min(cajaContenedor.width - mitad, izquierda));
    e.etiqueta.style.left = `${limite}px`;
  };
  e.dibujo.addEventListener('pointermove', mostrar);
  e.dibujo.addEventListener('pointerdown', mostrar);
  e.dibujo.addEventListener('pointerleave', ocultar);
}

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

  const guia = crearSvg('line', { x1: '0', x2: '0', y1: '0', y2: String(ALTO), class: 'curva__guia', visibility: 'hidden' });
  const marca = crearSvg('circle', { r: '4', cx: '0', cy: '0', class: 'curva__marca', visibility: 'hidden' });
  const dibujo = crearSvg('svg', { viewBox: `0 0 ${ANCHO} ${ALTO}`, class: 'curva', role: 'img', 'aria-label': 'Curva de balance' }, [
    crearSvg('line', { x1: String(MARGEN), x2: String(ANCHO - MARGEN), y1: yInicial, y2: yInicial, class: 'curva__base' }),
    crearSvg('polyline', { points: puntos, class: 'curva__linea' }),
    guia,
    marca,
  ]);
  const etiqueta = crearElemento('div', { class: 'curva__etiqueta', hidden: '' });
  const contenedor = crearElemento('div', { class: 'curva__contenedor' }, [dibujo as unknown as HTMLElement, etiqueta]);
  activarEtiqueta({ dibujo, contenedor, etiqueta, guia, marca, curva, balanceInicial, x, y });
  const primero = curva[0];
  const ultimo = curva[curva.length - 1];
  return crearElemento('div', {}, [
    contenedor,
    crearElemento('p', { class: 'texto-suave' }, [
      `Pasa el ratón por encima para ver la fecha y el balance de cada operación. De ${primero ? fechaHoraUtc(primero.utcMs) : ''} a ${ultimo ? fechaHoraUtc(ultimo.utcMs) : ''} (UTC) · mínimo ${importe(minimo)} · máximo ${importe(maximo)}. La línea fina marca el balance inicial.`,
    ]),
  ]);
}

export function crearContenidoPanel(analisis: AnalisisPeriodo, perfil: PerfilEstrategia | null, moneda: string, saldo: ResumenSaldo | null): HTMLElement {
  const e = analisis.estadisticas;
  if (e.totalOperaciones === 0) {
    return crearElemento('p', { class: 'aviso' }, ['No hay operaciones cerradas con este filtro.']);
  }
  const acierto = (e.ganadoras / e.totalOperaciones) * 100;
  return crearElemento('div', {}, [
    crearElemento('div', { class: 'tarjeta' }, [
      crearElemento('h2', {}, [moneda === '' ? 'Resumen' : `Resumen (${moneda})`]),
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
    ...(saldo ? [crearTarjetaSaldo(saldo, moneda, e.beneficioNeto)] : []),
    crearElemento('div', { class: 'tarjeta' }, [crearElemento('h2', {}, ['Curva de balance']), crearCurva(analisis.curva, analisis.balanceInicial)]),
    ...(perfil ? [crearTarjetaPerfil(perfil)] : []),
  ]);
}
