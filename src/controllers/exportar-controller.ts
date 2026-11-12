import { CLASIFICACION_CIERRE, EXPORTACION_TRADINGVIEW, VISUALIZACION_HORAS } from '../config/app-config';
import type { Aplicacion } from '../composicion';
import { descargarTexto } from '../adapters/descarga/descargar-texto';
import { logger } from '../core/logger';
import type { ModoHora } from '../models/visualizacion';
import { crearCalculadorSaldo } from '../services/analisis/saldo-apertura';
import { analizarPeriodo, opcionesDelFiltro } from '../services/consultas/analisis-periodo';
import type { DatosGuardados } from '../services/consultas/puertos';
import { describirFiltro, generarScriptsPine, agruparPorActivo } from '../services/exportacion/generador-pine';
import { crearVisualizador } from '../services/visualizacion/visualizador-horas';
import { crearElemento } from '../views/dom';
import { crearCamposSimbolos, crearManual, crearResultado, crearSelectorHoras } from '../views/exportar-view';
import { crearBarraFiltros } from '../views/filtros-view';

/** Pantalla Exportar: elige filtros y horas, ajusta los símbolos y descarga los scripts Pine. */
export function crearPaginaExportar(aplicacion: Aplicacion): HTMLElement {
  const zonaFiltros = crearElemento('div');
  const zonaSimbolos = crearElemento('div');
  const zonaResultado = crearElemento('div', { 'aria-live': 'polite' }, [crearElemento('p', { class: 'texto-suave' }, ['Cargando…'])]);
  const pagina = crearElemento('div', {}, [
    crearElemento('h1', { class: 'titulo-pagina' }, ['Exportar a TradingView']),
    crearElemento('p', { class: 'aviso' }, ['Elige qué operaciones quieres ver en TradingView. Se genera un script por activo que dibuja cada operación (entrada, stop, take profit y salida) sobre el gráfico.']),
    crearManual(),
    zonaFiltros,
    zonaSimbolos,
    zonaResultado,
  ]);

  async function cargar(): Promise<void> {
    const datos = await aplicacion.lectorDatos.leerTodo();
    if (datos.operaciones.length === 0) {
      zonaResultado.replaceChildren(crearElemento('p', { class: 'aviso' }, ['Todavía no hay operaciones. Empieza por importar un informe.']));
      return;
    }
    const horarios = await aplicacion.lectorHorarios.leerHorarios();
    let modo: ModoHora = aplicacion.preferenciaHoras.obtener();
    const simbolos: Record<string, string> = { ...EXPORTACION_TRADINGVIEW.simbolosTradingView };

    const generar = () => mostrarResultado(zonaResultado, datos, aplicacion, modo, horarios, simbolos);
    const redibujarSimbolos = () => {
      const analisis = analizarPeriodo(datos, aplicacion.filtro.obtener());
      const activos = typeof analisis === 'string' ? [] : [...agruparPorActivo(analisis).keys()].sort();
      zonaSimbolos.replaceChildren(
        crearCamposSimbolos(activos, simbolos, (activo, simbolo) => {
          simbolos[activo] = simbolo;
          generar();
        }),
      );
    };

    zonaFiltros.replaceChildren(
      crearBarraFiltros({
        opciones: opcionesDelFiltro(datos),
        filtro: aplicacion.filtro.obtener(),
        alCambiar: (filtro) => {
          aplicacion.filtro.fijar(filtro);
          redibujarSimbolos();
          generar();
        },
      }),
      crearSelectorHoras(VISUALIZACION_HORAS.modos, modo, (nuevo) => {
        modo = nuevo;
        generar();
      }),
    );
    redibujarSimbolos();
    generar();
  }

  cargar().catch((error: unknown) => {
    logger.error('No se pudo preparar la exportación', error);
    zonaResultado.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, ['No se pudieron leer los datos guardados en este navegador.']));
  });
  return pagina;
}

function mostrarResultado(
  zona: HTMLElement,
  datos: DatosGuardados,
  aplicacion: Aplicacion,
  modo: ModoHora,
  horarios: Parameters<typeof crearVisualizador>[1],
  simbolos: Readonly<Record<string, string>>,
): void {
  const filtro = aplicacion.filtro.obtener();
  const analisis = analizarPeriodo(datos, filtro);
  if (typeof analisis === 'string') {
    zona.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, [analisis]));
    return;
  }
  const scripts = generarScriptsPine(
    {
      analisis,
      saldoEn: crearCalculadorSaldo(datos),
      horas: crearVisualizador(modo, horarios, VISUALIZACION_HORAS),
      simbolos,
      descripcionFiltros: describirFiltro(filtro),
    },
    { ...EXPORTACION_TRADINGVIEW, umbralBreakEvenPorcentaje: CLASIFICACION_CIERRE.umbralBreakEvenPorcentaje },
  );
  zona.replaceChildren(crearResultado(scripts, (script) => descargarTexto(script.nombreFichero, script.codigo)));
}
