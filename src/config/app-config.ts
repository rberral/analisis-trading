/**
 * Configuración centralizada de la aplicación.
 *
 * Es el único sitio con constantes y textos parametrizables. El resto del código
 * solo importa este módulo. Al ser una web estática no hay secretos: todo lo que
 * se escriba aquí es público, así que nunca se deben añadir claves ni contraseñas.
 */
import type { Plataforma } from '../models/importacion';

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
