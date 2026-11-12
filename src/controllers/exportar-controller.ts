import { CLASIFICACION_CIERRE, EXPORTACION_TRADINGVIEW, VISUALIZACION_HORAS } from '../config/app-config';
import type { Aplicacion } from '../composicion';
import { descargarTexto } from '../adapters/descarga/descargar-texto';
import { logger } from '../core/logger';
import type { Filtro } from '../models/filtro';
import type { ModoHora } from '../models/visualizacion';
import { crearCalculadorSaldo } from '../services/analisis/saldo-apertura';
import { analizarPeriodo, opcionesDelFiltro } from '../services/consultas/analisis-periodo';
import { asegurarCuenta, listarCuentas } from '../services/consultas/cuentas';
import type { DatosGuardados } from '../services/consultas/puertos';
import { generarScriptsPine } from '../services/exportacion/generador-pine';
import { crearVisualizador } from '../services/visualizacion/visualizador-horas';
import { crearElemento } from '../views/dom';
import { crearBotonGenerar, crearCamposSimbolos, crearManual, crearResultado, crearSelectorHoras } from '../views/exportar-view';
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

    // No se calcula nada hasta que el usuario pulsa «Generar script»; cualquier cambio deja el resultado anterior como caducado.
    const generar = () => mostrarResultado(zonaResultado, datos, aplicacion, modo, horarios, simbolos);
    const invalidar = () => zonaResultado.replaceChildren(crearElemento('p', { class: 'texto-suave' }, ['Has cambiado las opciones. Pulsa «Generar script» para crear los scripts con ellas.']));
    const redibujarSimbolos = () => {
      zonaSimbolos.replaceChildren(
        crearCamposSimbolos(activosDelFiltro(datos, aplicacion.filtro.obtener()), simbolos, (activo, simbolo) => {
          simbolos[activo] = simbolo;
          invalidar();
        }),
      );
    };

    const cuentas = listarCuentas(datos);
    aplicacion.filtro.fijar(asegurarCuenta(aplicacion.filtro.obtener(), cuentas));
    zonaFiltros.replaceChildren(
      crearBarraFiltros({
        cuentas,
        opcionesDe: (cuenta) => opcionesDelFiltro(datos, cuenta),
        filtro: aplicacion.filtro.obtener(),
        alCambiar: (filtro) => {
          aplicacion.filtro.fijar(filtro);
          redibujarSimbolos();
          invalidar();
        },
      }),
      crearSelectorHoras(VISUALIZACION_HORAS.modos, modo, (nuevo) => {
        modo = nuevo;
        invalidar();
      }),
      crearBotonGenerar(generar),
    );
    redibujarSimbolos();
    zonaResultado.replaceChildren(crearElemento('p', { class: 'texto-suave' }, ['Elige las opciones y pulsa «Generar script».']));
  }

  cargar().catch((error: unknown) => {
    logger.error('No se pudo preparar la exportación', error);
    zonaResultado.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, ['No se pudieron leer los datos guardados en este navegador.']));
  });
  return pagina;
}

/** Activos de la cuenta elegida (y del activo elegido, si lo hay): sin analizar nada, solo para pedir sus símbolos. */
function activosDelFiltro(datos: DatosGuardados, filtro: Filtro): string[] {
  const activos = new Set<string>();
  for (const o of datos.operaciones) {
    if (filtro.cuenta !== null && (o.broker !== filtro.cuenta.broker || o.cuenta !== filtro.cuenta.cuenta)) continue;
    if (filtro.activo !== null && o.activo !== filtro.activo) continue;
    activos.add(o.activo);
  }
  return [...activos].sort();
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
      filtro,
    },
    { ...EXPORTACION_TRADINGVIEW, umbralBreakEvenPorcentaje: CLASIFICACION_CIERRE.umbralBreakEvenPorcentaje },
  );
  zona.replaceChildren(crearResultado(scripts, (script) => descargarTexto(script.nombreFichero, script.codigo)));
}
