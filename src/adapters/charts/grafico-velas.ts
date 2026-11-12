/**
 * Único sitio que conoce la librería del gráfico (Lightweight Charts).
 * Si se cambia de librería, solo se toca este fichero.
 */
import { ColorType, LineStyle, createChart, type CandlestickData, type SeriesMarker, type Time, type UTCTimestamp } from 'lightweight-charts';
import { COLORES_GRAFICO } from '../../config/app-config';
import type { Vela } from '../../models/velas';

export interface LineaPrecio {
  readonly precio: number;
  readonly titulo: string;
  readonly color: string;
}

export interface MarcadorGrafico {
  /** Hora de APERTURA de la vela donde se dibuja la marca. */
  readonly velaUtcMs: number;
  readonly texto: string;
  readonly color: string;
  readonly posicion: 'arriba' | 'abajo';
  readonly forma: 'flecha_arriba' | 'flecha_abajo' | 'circulo';
}

export interface DatosGrafico {
  readonly velas: readonly Vela[];
  readonly lineas: readonly LineaPrecio[];
  readonly marcadores: readonly MarcadorGrafico[];
}

export interface GraficoVelas {
  destruir(): void;
}

const FORMAS = { flecha_arriba: 'arrowUp', flecha_abajo: 'arrowDown', circulo: 'circle' } as const;
const segundos = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;

export function crearGraficoVelas(contenedor: HTMLElement, datos: DatosGrafico): GraficoVelas {
  const grafico = createChart(contenedor, {
    autoSize: true,
    layout: { background: { type: ColorType.Solid, color: COLORES_GRAFICO.fondo }, textColor: COLORES_GRAFICO.texto },
    grid: { vertLines: { color: COLORES_GRAFICO.cuadricula }, horzLines: { color: COLORES_GRAFICO.cuadricula } },
    timeScale: { timeVisible: true, secondsVisible: false },
  });
  const serie = grafico.addCandlestickSeries({
    upColor: COLORES_GRAFICO.velaAlcista,
    downColor: COLORES_GRAFICO.velaBajista,
    wickUpColor: COLORES_GRAFICO.velaAlcista,
    wickDownColor: COLORES_GRAFICO.velaBajista,
    borderVisible: false,
  });
  const velas: CandlestickData<Time>[] = datos.velas.map((vela) => ({
    time: segundos(vela.utcMs),
    open: vela.abre,
    high: vela.maximo,
    low: vela.minimo,
    close: vela.cierra,
  }));
  serie.setData(velas);

  for (const linea of datos.lineas) {
    serie.createPriceLine({ price: linea.precio, color: linea.color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: linea.titulo });
  }
  // La librería exige las marcas ordenadas por tiempo.
  const marcas: SeriesMarker<Time>[] = [...datos.marcadores]
    .sort((a, b) => a.velaUtcMs - b.velaUtcMs)
    .map((m) => ({ time: segundos(m.velaUtcMs), position: m.posicion === 'arriba' ? 'aboveBar' : 'belowBar', color: m.color, shape: FORMAS[m.forma], text: m.texto }));
  serie.setMarkers(marcas);
  grafico.timeScale().fitContent();

  return { destruir: () => grafico.remove() };
}
