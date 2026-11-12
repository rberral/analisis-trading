/**
 * Configuración centralizada de la aplicación.
 *
 * Es el único sitio con constantes y textos parametrizables. El resto del código
 * solo importa este módulo. Al ser una web estática no hay secretos: todo lo que
 * se escriba aquí es público, así que nunca se deben añadir claves ni contraseñas.
 */
import type { HorarioBroker } from '../core/horario';
import type { ModoHora } from '../models/visualizacion';
import type { Plataforma } from '../models/importacion';
import type { Temporalidad } from '../models/velas';

export interface Seccion {
  /** Ruta dentro de la web (se usa tras el # de la dirección). */
  readonly ruta: string;
  readonly titulo: string;
  /** Texto provisional que se muestra hasta que la pantalla esté construida. */
  readonly descripcion: string;
}

export const SECCIONES: readonly Seccion[] = [
  {
    ruta: '/',
    titulo: 'Panel',
    descripcion: 'Resumen de balance y estadísticas, filtrable por periodo y activo.',
  },
  {
    ruta: '/importar',
    titulo: 'Importar operaciones',
    descripcion: 'Carga del informe de la plataforma y comprobación de sus totales.',
  },
  {
    ruta: '/operaciones',
    titulo: 'Operaciones',
    descripcion: 'Listado de operaciones con filtros y detalle de cada una.',
  },
  {
    ruta: '/errores',
    titulo: 'Errores y consejos',
    descripcion: 'Errores detectados en tus operaciones y cómo evitarlos.',
  },
  {
    ruta: '/velas',
    titulo: 'Velas y ficheros',
    descripcion: 'Carga de ficheros de velas por activo, temporalidad y horario del broker.',
  },
  {
    ruta: '/exportar',
    titulo: 'Exportar a TradingView',
    descripcion: 'Generación del script de Pine con tus entradas, SL y TP.',
  },
  {
    ruta: '/copia',
    titulo: 'Copia de seguridad',
    descripcion: 'Exportar e importar todos tus datos, que viven solo en este navegador.',
  },
  {
    ruta: '/sobre',
    titulo: 'Sobre la aplicación',
    descripcion: 'Qué hace la aplicación, cómo funciona cada apartado y en qué orden usarlos.',
  },
];

export interface OpcionPlataforma {
  readonly valor: Plataforma;
  readonly nombre: string;
}

/** Plataformas de las que se puede importar un informe. Para añadir otra: un parser y una entrada aquí. */
export const PLATAFORMAS: readonly OpcionPlataforma[] = [
  { valor: 'mt4', nombre: 'MetaTrader 4 (informe HTML)' },
];

/**
 * Margen aceptado al comparar las cifras del informe con las recalculadas.
 * El informe redondea cada cifra a dos decimales, así que sumar 800 operaciones
 * puede diferir unos céntimos sin que haya ningún error.
 */
export const TOLERANCIAS = {
  dinero: 0.05,
  ratio: 0.01,
  porcentaje: 0.01,
} as const;

export const APP_CONFIG = {
  nombreApp: 'Diario de trading',
  /** Nivel mínimo de los mensajes de registro: debug, info, warn o error. */
  nivelLog: 'info',
  textos: {
    paginaNoEncontrada: 'Esta página no existe.',
    volverAlPanel: 'Volver al panel',
    etiquetaNavegacion: 'Navegación principal',
  },
} as const;

/** Umbrales con los que se detectan errores. Son criterios orientativos, no verdades absolutas. */
export const UMBRALES_ERRORES = {
  /** Con menos operaciones cerradas no se analiza nada: sería ruido. */
  minimoOperaciones: 10,
  /** Una operación sin stop loss cerrada en menos de estos minutos se considera una apertura errónea. */
  minutosAperturaErronea: 5,
  /** Una pérdida es desproporcionada si supera N veces la ganancia media. */
  perdidaSobreGananciaMedia: 2,
  /** Se considera que subes el riesgo si abres con N veces los lotes de la operación perdedora anterior. */
  aumentoDeLotesTrasPerdida: 1.5,
  /** Más operaciones abiertas en un mismo día (UTC) que este número = sobreoperación. */
  operacionesPorDia: 8,
  /** Las perdedoras duran N veces más que las ganadoras. */
  duracionPerdedorasSobreGanadoras: 2,
  /** Mínimo de operaciones de cada tipo para comparar duraciones. */
  minimoParaDuraciones: 5,
} as const;

export interface OpcionTemporalidad {
  readonly valor: Temporalidad;
  readonly nombre: string;
  readonly minutos: number;
}

export const TEMPORALIDADES: readonly OpcionTemporalidad[] = [
  { valor: 'M1', nombre: '1 minuto', minutos: 1 },
  { valor: 'M5', nombre: '5 minutos', minutos: 5 },
  { valor: 'M15', nombre: '15 minutos', minutos: 15 },
  { valor: 'M30', nombre: '30 minutos', minutos: 30 },
  { valor: 'H1', nombre: '1 hora', minutos: 60 },
  { valor: 'H4', nombre: '4 horas', minutos: 240 },
  { valor: 'D1', nombre: 'Diario', minutos: 1440 },
];

/** Parámetros de la carga de velas y de la comprobación del horario del broker. */
export const VELAS = {
  /** Velas guardadas antes de la entrada y después de la salida de cada operación. */
  margenVelas: 20,
  /** Tope de velas por operación; si se supera se recorta y se marca la ventana como truncada. */
  maximoVelasPorVentana: 3000,
  /** Un precio "está dentro" de una vela si no se sale de ella más de esta fracción del precio (cubre el spread). */
  toleranciaPrecio: 0.0002,
  /** Desfases (en horas) que se prueban para ver si el horario declarado es el que mejor encaja. */
  desfasesHoras: [-3, -2, -1, 0, 1, 2, 3],
  /** Con menos precios que comprobar, la comprobación no es concluyente. */
  minimoComprobaciones: 10,
  /** Porcentaje de precios que deben encajar para dar el horario por correcto. */
  porcentajeMinimoCorrecto: 90,
} as const;

/** Criterios para describir la operativa. Las sesiones se miden con la hora UTC de apertura. */
export const ESTRATEGIA = {
  /** Duración mediana por debajo de la cual se habla de scalping (minutos). */
  scalpingMinutos: 15,
  /** Por debajo de un día se habla de intradía; por encima, de swing (minutos). */
  intradiaMinutos: 1440,
  sesiones: [
    { nombre: 'Asia', desdeHora: 0, hastaHora: 7 },
    { nombre: 'Londres', desdeHora: 7, hastaHora: 12 },
    { nombre: 'Londres + Nueva York', desdeHora: 12, hastaHora: 16 },
    { nombre: 'Nueva York', desdeHora: 16, hastaHora: 21 },
    { nombre: 'Cierre de mercado', desdeHora: 21, hastaHora: 24 },
  ],
  /** Velas anteriores a la entrada con las que se mide desde dónde se entra. */
  velasPreviasEntrada: 20,
  minimoVelasPrevias: 5,
  /** Fracción del rango (extremo superior o inferior) que se considera "máximo" o "mínimo". */
  umbralExtremo: 0.2,
  minimoMuestrasEntradas: 10,
} as const;

/** Colores del gráfico de velas (la librería los pide como valores, no como clases de CSS). */
export const COLORES_GRAFICO = {
  fondo: '#ffffff',
  texto: '#14181f',
  cuadricula: '#eef0f3',
  velaAlcista: '#15803d',
  velaBajista: '#b91c1c',
  entrada: '#1d4ed8',
  salida: '#7c3aed',
  stopLoss: '#b91c1c',
  takeProfit: '#15803d',
} as const;

/**
 * Una operación con |resultado neto| menor que este % del saldo de la cuenta al abrirla se considera
 * break even. Es la misma regla que el script de TradingView (campo «% break even» de sus ajustes).
 */
export const CLASIFICACION_CIERRE = {
  umbralBreakEvenPorcentaje: 0.1,
} as const;

export interface OpcionHorario {
  readonly id: string;
  readonly nombre: string;
  /** Diferencia con UTC, para que el usuario reconozca su broker. */
  readonly detalle: string;
  readonly horario: HorarioBroker;
}

/**
 * Horarios habituales del servidor del broker. No hay ninguno preseleccionado: el usuario debe elegir.
 * Europa del Este y «Nueva York + 7» coinciden casi todo el año; difieren unas semanas en marzo y octubre/noviembre,
 * porque EE. UU. y Europa cambian de hora en fechas distintas.
 */
export const HORARIOS_PREDEFINIDOS: readonly OpcionHorario[] = [
  { id: 'europa_este', nombre: 'Europa del Este (Atenas, Chipre, Finlandia)', detalle: 'UTC+2, UTC+3 en verano', horario: { tipo: 'zona', zona: 'Europe/Athens' } },
  { id: 'europa_central', nombre: 'Europa Central (Madrid, París, Berlín)', detalle: 'UTC+1, UTC+2 en verano', horario: { tipo: 'zona', zona: 'Europe/Berlin' } },
  { id: 'reino_unido', nombre: 'Reino Unido y Portugal (Londres)', detalle: 'UTC+0, UTC+1 en verano', horario: { tipo: 'zona', zona: 'Europe/London' } },
  { id: 'nueva_york', nombre: 'Nueva York (costa este de EE. UU.)', detalle: 'UTC−5, UTC−4 en verano', horario: { tipo: 'zona', zona: 'America/New_York' } },
  { id: 'nueva_york_mas_7', nombre: 'Nueva York + 7 horas (habitual en brokers de divisas)', detalle: 'UTC+2, UTC+3 con el verano de EE. UU.', horario: { tipo: 'nueva_york_mas', horas: 7 } },
  { id: 'utc', nombre: 'UTC', detalle: 'UTC+0 fijo, sin cambio de hora', horario: { tipo: 'zona', zona: 'UTC' } },
  { id: 'utc_mas_2', nombre: 'Fijo UTC+2', detalle: 'sin cambio de hora', horario: { tipo: 'zona', zona: 'Etc/GMT-2' } },
  { id: 'utc_mas_3', nombre: 'Fijo UTC+3', detalle: 'sin cambio de hora', horario: { tipo: 'zona', zona: 'Etc/GMT-3' } },
];

/** Opciones especiales del selector de horario que no son una zona concreta. */
export const OPCION_OTRA_ZONA = 'otra_zona';
export const OPCION_OTRA_REGLA = 'otra_regla';

export interface OpcionModoHora {
  readonly id: ModoHora;
  readonly nombre: string;
  /** Cómo se escribe junto a las horas: «Apertura (hora del broker)». */
  readonly etiqueta: string;
}

/** Cómo se muestran las horas. Los datos no cambian: solo la visualización. */
export const VISUALIZACION_HORAS = {
  inicial: 'utc' as ModoHora,
  zonaEspana: 'Europe/Madrid',
  claveAlmacenamiento: 'modo-horas',
  modos: [
    { id: 'utc', nombre: 'UTC', etiqueta: 'UTC' },
    { id: 'broker', nombre: 'Hora del broker (como en MetaTrader)', etiqueta: 'hora del broker' },
    { id: 'espana', nombre: 'Hora de España', etiqueta: 'hora de España' },
  ] as readonly OpcionModoHora[],
};

/** Exportación a TradingView (script Pine). */
export const EXPORTACION_TRADINGVIEW = {
  /** Cada operación usa 2 cajas y 2 líneas/etiquetas: con el límite de 500 de Pine caben 250. */
  maximoOperacionesPorScript: 250,
  /** Pine limita las cadenas de texto a ~4096 caracteres; los datos se parten en trozos más cortos. */
  tamanoTrozo: 3500,
  /** Ancho de las cajas de cada operación, en barras del gráfico (ajustable luego en TradingView). */
  anchoCajaBarras: 20,
  /**
   * Nombre en TradingView de los activos cuyo nombre en el broker es distinto. Si no aparece aquí se usa
   * el del broker. El usuario puede cambiarlo en la pantalla antes de generar.
   */
  simbolosTradingView: {} as Readonly<Record<string, string>>,
} as const;

/** Copia de seguridad y borrado de datos. */
export const COPIA_SEGURIDAD = {
  /** Marca del fichero para reconocer que es una copia de esta aplicación. */
  formato: 'diario-trading-copia',
  /** Sube si cambia la estructura del fichero; una copia de una versión mayor no se acepta. */
  version: 1,
  prefijoFichero: 'diario-trading_copia',
  /** Palabra que hay que escribir para confirmar que se borran los datos. */
  palabraConfirmacion: 'BORRAR',
} as const;
