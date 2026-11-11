/**
 * Configuración centralizada de la aplicación.
 *
 * Es el único sitio con constantes y textos parametrizables. El resto del código
 * solo importa este módulo. Al ser una web estática no hay secretos: todo lo que
 * se escriba aquí es público, así que nunca se deben añadir claves ni contraseñas.
 */

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
