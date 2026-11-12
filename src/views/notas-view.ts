import { CLASIFICACION_CIERRE } from '../config/app-config';
import type { VisualizadorHoras } from '../services/visualizacion/visualizador-horas';
import { crearElemento } from './dom';

/** Explica en qué hora se ven las fechas y por qué. Se muestra en las pantallas que enseñan horas. */
export function crearNotaHoras(visualizador: VisualizadorHoras): HTMLElement {
  return crearElemento('p', { class: 'aviso' }, [
    `Horas mostradas en ${visualizador.etiqueta}. Internamente todas las horas se guardan en UTC: al cargar los ficheros de operaciones y de velas, sus horas se convierten a UTC a partir del horario que elegiste al cargarlos. Puedes cambiar cómo se muestran en el menú lateral («Mostrar horas en»).`,
  ]);
}

/** Explica cómo se decide si una operación es take profit, stop loss, break even o manual, y dónde se cambia el umbral. */
export function crearNotaClasificacionCierre(): HTMLElement {
  const umbral = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 }).format(CLASIFICACION_CIERRE.umbralBreakEvenPorcentaje);
  return crearElemento('details', { class: 'tarjeta nota-desplegable' }, [
    crearElemento('summary', {}, ['Cómo se clasifica el tipo de cierre (Take profit, Stop loss, Break even, Manual)']),
    crearElemento('p', {}, ['La clasificación se hace por el resultado de la operación, no por la etiqueta de MetaTrader, que llama «stop loss» también a los stops movidos a break even o a beneficio.']),
    crearElemento('ul', {}, [
      crearElemento('li', {}, [crearElemento('strong', {}, ['Manual: ']), 'la cerraste tú. Siempre es manual, aunque el resultado sea casi nulo.']),
      crearElemento('li', {}, [
        crearElemento('strong', {}, ['Break even: ']),
        `cierre automático (stop o take profit) cuyo movimiento de precio vale menos del ${umbral} % del valor de la posición (lotes × tamaño del contrato × precio de entrada). Para el beneficio se usa el importe sin comisión ni swap.`,
      ]),
      crearElemento('li', {}, [crearElemento('strong', {}, ['Take profit: ']), 'cierre automático con ganancia, aunque MetaTrader lo registre como stop loss (stop movido a beneficio).']),
      crearElemento('li', {}, [crearElemento('strong', {}, ['Stop loss: ']), 'cierre automático con pérdida.']),
    ]),
    crearElemento('p', {}, [
      'El porcentaje se cambia en el fichero ',
      crearElemento('code', {}, ['src/config/app-config.ts']),
      ', en la constante ',
      crearElemento('code', {}, ['CLASIFICACION_CIERRE']),
      ' (campo ',
      crearElemento('code', {}, ['umbralBreakEvenPorcentaje']),
      `, ahora ${umbral}). Como referencia, en EURUSD el 0,01 % equivale a algo más de 1 pip. El tamaño del contrato de cada activo se deduce de tus propias operaciones.`,
    ]),
  ]);
}
