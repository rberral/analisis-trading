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
  /** Decimales con los que se muestran los precios (5 en EURUSD, 3 en USDJPY, 2 en oro…). */
  readonly decimales: number;
  /** Milisegundos a sumar a cada hora UTC para mostrarla en el horario elegido (el eje del gráfico siempre escribe sus horas como UTC). */
  readonly desfaseMs: (utcMs: number) => number;
  readonly velas: readonly Vela[];
  readonly lineas: readonly LineaPrecio[];
  readonly marcadores: readonly MarcadorGrafico[];
}

export interface GraficoVelas {
  destruir(): void;
}

const TAMANIO_INICIAL = { ancho: 800, alto: 420 } as const;
const FORMAS = { flecha_arriba: 'arrowUp', flecha_abajo: 'arrowDown', circulo: 'circle' } as const;
const segundos = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;

export function crearGraficoVelas(contenedor: HTMLElement, datos: DatosGrafico): GraficoVelas {
  // Tamaño inicial razonable: si el contenedor aún no está en pantalla mide 0 y el gráfico saldría aplastado.
  const grafico = createChart(contenedor, {
    width: contenedor.clientWidth || TAMANIO_INICIAL.ancho,
    height: contenedor.clientHeight || TAMANIO_INICIAL.alto,
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
    priceFormat: { type: 'price', precision: datos.decimales, minMove: 10 ** -datos.decimales },
  });
  const hora = (utcMs: number): UTCTimestamp => segundos(utcMs + datos.desfaseMs(utcMs));
  const velas: CandlestickData<Time>[] = [];
  for (const vela of datos.velas) {
    const time = hora(vela.utcMs);
    // Con un cambio de hora dentro de la ventana, el reloj mostrado puede repetirse: la librería exige tiempos crecientes.
    const anterior = velas[velas.length - 1];
    if (anterior && (time as number) <= (anterior.time as number)) continue;
    velas.push({ time, open: vela.abre, high: vela.maximo, low: vela.minimo, close: vela.cierra });
  }
  serie.setData(velas);

  for (const linea of datos.lineas) {
    serie.createPriceLine({ price: linea.precio, color: linea.color, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: linea.titulo });
  }
  // La librería exige las marcas ordenadas por tiempo.
  const marcas: SeriesMarker<Time>[] = [...datos.marcadores]
    .sort((a, b) => a.velaUtcMs - b.velaUtcMs)
    .map((m) => ({ time: hora(m.velaUtcMs), position: m.posicion === 'arriba' ? 'aboveBar' : 'belowBar', color: m.color, shape: FORMAS[m.forma], text: m.texto }));
  serie.setMarkers(marcas);

  // El contenedor puede recibir su ancho real después de crear el gráfico (al insertarse en la página):
  // se ajusta el tamaño y se encuadran las velas la primera vez que hay ancho, y el tamaño al cambiar la ventana.
  let encuadrado = false;
  const observador = new ResizeObserver(() => {
    if (contenedor.clientWidth === 0) return;
    grafico.resize(contenedor.clientWidth, contenedor.clientHeight || TAMANIO_INICIAL.alto);
    if (!encuadrado) {
      encuadrado = true;
      grafico.timeScale().fitContent();
    }
  });
  observador.observe(contenedor);

  return {
    destruir: () => {
      observador.disconnect();
      grafico.remove();
    },
  };
}
