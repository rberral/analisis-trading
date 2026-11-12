import { crearElemento } from './dom';

interface Paso {
  readonly titulo: string;
  readonly ruta: string | null;
  readonly texto: string;
}

/** Orden recomendado de uso, de la primera carga de datos a la exportación. */
const PASOS: readonly Paso[] = [
  {
    titulo: 'Importar operaciones',
    ruta: '/importar',
    texto:
      'Empieza aquí. Carga el informe «Detailed Statement» de MetaTrader 4 (fichero HTML) y elige el broker y la cuenta (uno ya guardado o uno nuevo) y el horario del servidor del broker. Broker + cuenta identifican de dónde vienen los datos y cada combinación se analiza por separado, porque puede usar una estrategia distinta. El horario es obligatorio, porque las horas del informe se convierten a UTC con él. Antes de guardar, la aplicación comprueba que sus cifras coinciden con los totales del propio informe. Puedes importar informes nuevos cuando quieras: las operaciones que ya estaban se actualizan, no se duplican.',
  },
  {
    titulo: 'Velas y ficheros (opcional)',
    ruta: '/velas',
    texto:
      'Carga el CSV de velas que exporta MetaTrader 4 (activo, temporalidad y horario del broker). La aplicación comprueba si el horario es el correcto mirando si tus precios de entrada y salida caen dentro de la vela de ese momento. Solo se guardan las velas que rodean a cada operación cerrada. Sin velas todo funciona, pero no habrá gráfico en el detalle ni los análisis que dependen de él.',
  },
  {
    titulo: 'Panel',
    ruta: '/',
    texto: 'Resumen de balance, estadísticas, curva de balance y perfil de tu operativa (duración, sesiones, uso de SL y TP). Se filtra por periodo, activo y tipo de cierre.',
  },
  {
    titulo: 'Operaciones y detalle',
    ruta: '/operaciones',
    texto:
      'Lista de operaciones con los mismos filtros. Al abrir una, ves su gráfico de velas con la entrada, el stop, el take profit y la salida, cuánto se movió el precio a favor y en contra, y qué pasó después de cerrar a mano.',
  },
  {
    titulo: 'Errores y consejos',
    ruta: '/errores',
    texto: 'Detecta patrones que suelen costar dinero: aperturas erróneas, operaciones sin stop loss, pérdidas desproporcionadas, subir lotes tras perder, sobreoperación y salidas anticipadas. Los umbrales están en la configuración.',
  },
  {
    titulo: 'Exportar a TradingView',
    ruta: '/exportar',
    texto:
      'Elige periodo, activo y cierre, y la aplicación genera un script Pine por activo (en varias partes si hay muchas operaciones) que dibuja tus operaciones sobre el gráfico de TradingView. Allí hay un desplegable con los pasos para usarlo.',
  },
  {
    titulo: 'Copia de seguridad',
    ruta: '/copia',
    texto: 'Tus datos viven solo en este navegador. Aquí puedes exportarlos a un fichero y volver a importarlos (se fusionan con lo que ya tengas), por ejemplo para cambiar de navegador o de ordenador. También puedes borrar todos los datos o solo los de una cuenta.',
  },
];

const CONCEPTOS: ReadonlyArray<readonly [string, string]> = [
  ['Horas', 'Todo se guarda en UTC. «Mostrar horas en» (menú lateral) cambia solo cómo se ven: UTC, hora del broker u hora de España. Los periodos de los filtros se cuentan en UTC.'],
  ['Tipo de cierre', 'Se clasifica por el resultado, no por la etiqueta de MetaTrader: Break even si el resultado neto es menor del 0,1 % del saldo al abrir; si no, Manual si lo cerraste tú, y Take profit o Stop loss según ganes o pierdas. El porcentaje está en la configuración.'],
  ['Moneda', 'Cada cuenta tiene su moneda (USD, EUR…), que se toma del informe, y todos sus importes están en ella. En Panel, Operaciones y Errores hay un conversor orientativo a euros: el cambio se puede escribir a mano o consultar (botón «Actualizar (BCE)», que solo envía una petición a una API pública cuando lo pulsas). No cambia tus datos.'],
  ['Cuenta de trading', 'Panel, Operaciones, Errores y Exportar trabajan siempre con una sola cuenta (broker + cuenta), la que eliges arriba, para no mezclar estrategias ni saldos. Al importar informes nuevos de una cuenta que ya tienes, elígela en los desplegables (su moneda debe coincidir).'],
  ['Filtros', 'Cuenta, periodo, activo y cierre. Se mantienen al cambiar entre Panel, Operaciones, Errores y Exportar.'],
  ['Tus datos', 'No hay servidor ni cuenta: todo se guarda en este navegador y no sale de él. Si borras los datos del sitio, se pierden; por eso conviene la copia de seguridad.'],
];

function enlazar(paso: Paso): HTMLElement {
  return paso.ruta === null
    ? crearElemento('strong', {}, [paso.titulo])
    : crearElemento('a', { href: `#${paso.ruta}`, class: 'enlace' }, [paso.titulo]);
}

export function crearPaginaSobre(): HTMLElement {
  return crearElemento('div', {}, [
    crearElemento('h1', { class: 'titulo-pagina' }, ['Sobre la aplicación']),
    crearElemento('section', { class: 'tarjeta' }, [
      crearElemento('p', {}, [
        'Análisis Trading analiza tu historial de operaciones: importa el informe de tu plataforma, calcula estadísticas, detecta errores habituales y dibuja tus operaciones en TradingView. Funciona entera en tu navegador, sin servidor ni cuenta.',
      ]),
    ]),
    crearElemento('section', { class: 'tarjeta' }, [
      crearElemento('h2', {}, ['Por dónde empezar, paso a paso']),
      crearElemento('ol', {}, PASOS.map((paso) => crearElemento('li', {}, [enlazar(paso), ': ', paso.texto]))),
    ]),
    crearElemento('section', { class: 'tarjeta' }, [
      crearElemento('h2', {}, ['Conceptos importantes']),
      crearElemento('ul', {}, CONCEPTOS.map(([titulo, texto]) => crearElemento('li', {}, [crearElemento('strong', {}, [`${titulo}: `]), texto]))),
    ]),
  ]);
}
