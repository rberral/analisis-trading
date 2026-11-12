import { ESTRATEGIA, SALDO_CUENTA, TEMPORALIDADES, UMBRALES_ERRORES } from '../config/app-config';
import type { Aplicacion } from '../composicion';
import { logger } from '../core/logger';
import { analizarPeriodo, opcionesDelFiltro, type AnalisisPeriodo } from '../services/consultas/analisis-periodo';
import { asegurarCuenta, listarCuentas } from '../services/consultas/cuentas';
import { convertir, leerTasa, type TipoCambio } from '../services/cambio/servicio-cambio';
import { crearConversor } from '../views/conversor-view';
import type { DatosGuardados } from '../services/consultas/puertos';
import type { VentanaVelas } from '../models/velas';
import { resumirSaldo, type ResumenSaldo } from '../services/analisis/resumen-saldo';
import { crearPerfil } from '../services/analisis/perfil-estrategia';
import { duracionDeTemporalidad, indexarVentanas } from '../services/analisis/ventanas-operacion';
import { detectarErrores } from '../services/errores/detector-errores';
import { detectarSalidasAnticipadas } from '../services/errores/detector-salidas';
import type { VisualizadorHoras } from '../services/visualizacion/visualizador-horas';
import { crearVisualizadorActual } from './horas-controller';
import { crearElemento } from '../views/dom';
import { crearContenidoErrores } from '../views/errores-view';
import { crearBarraFiltros } from '../views/filtros-view';
import { crearContenidoOperaciones } from '../views/operaciones-view';
import { crearContenidoPanel } from '../views/panel-view';

/** Una ventana de velas por operación (la más detallada); vacío si no se han cargado velas. */
type VentanasPorOperacion = ReadonlyMap<string, VentanaVelas>;

type Dibujar = (analisis: AnalisisPeriodo, ventanas: VentanasPorOperacion, horas: VisualizadorHoras, moneda: string, saldo: ResumenSaldo | null) => HTMLElement;

/**
 * Pantalla con barra de filtros arriba y contenido que depende del filtro.
 * Las tres pantallas (Panel, Operaciones, Errores) solo se diferencian en `dibujar`.
 */
function crearPaginaFiltrada(aplicacion: Aplicacion, titulo: string, dibujar: Dibujar): HTMLElement {
  const zonaBarra = crearElemento('div');
  const zonaConversor = crearElemento('div');
  const zonaContenido = crearElemento('div', { 'aria-live': 'polite' }, [crearElemento('p', { class: 'texto-suave' }, ['Cargando…'])]);
  const pagina = crearElemento('div', {}, [crearElemento('h1', { class: 'titulo-pagina' }, [titulo]), zonaBarra, zonaConversor, zonaContenido]);

  function mostrar(datos: DatosGuardados, ventanas: VentanasPorOperacion, horas: VisualizadorHoras): void {
    const filtro = aplicacion.filtro.obtener();
    const resultado = analizarPeriodo(datos, filtro);
    const moneda = listarCuentas(datos).find((c) => filtro.cuenta !== null && c.broker === filtro.cuenta.broker && c.cuenta === filtro.cuenta.cuenta)?.moneda ?? '';
    zonaConversor.replaceChildren(
      typeof resultado === 'string' ? '' : crearConversor(opcionesConversor(aplicacion, moneda, resultado.estadisticas.beneficioNeto)),
    );
    zonaContenido.replaceChildren(
      typeof resultado === 'string'
        ? crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, [resultado])
        : dibujar(resultado, ventanas, horas, moneda, filtro.cuenta === null ? null : resumirSaldo(datos, filtro.cuenta, SALDO_CUENTA.toleranciaCuadre)),
    );
  }

  async function cargar(): Promise<void> {
    const datos = await aplicacion.lectorDatos.leerTodo();
    const ventanas = indexarVentanas(await aplicacion.lectorVentanas.leerVentanas(), TEMPORALIDADES);
    const horas = await crearVisualizadorActual(aplicacion);
    if (datos.operaciones.length === 0) {
      zonaContenido.replaceChildren(
        crearElemento('p', { class: 'aviso' }, ['Todavía no hay operaciones. Empieza por '], ),
      );
      zonaContenido.firstElementChild?.append(crearElemento('a', { href: '#/importar', class: 'enlace' }, ['importar un informe']), '.');
      return;
    }
    const cuentas = listarCuentas(datos);
    aplicacion.filtro.fijar(asegurarCuenta(aplicacion.filtro.obtener(), cuentas));
    zonaBarra.replaceChildren(
      crearBarraFiltros({
        cuentas,
        opcionesDe: (cuenta) => opcionesDelFiltro(datos, cuenta),
        filtro: aplicacion.filtro.obtener(),
        alCambiar: (filtro) => {
          aplicacion.filtro.fijar(filtro);
          mostrar(datos, ventanas, horas);
        },
      }),
    );
    mostrar(datos, ventanas, horas);
  }

  cargar().catch((error: unknown) => {
    logger.error('No se pudieron cargar las operaciones', error);
    zonaContenido.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, ['No se pudieron leer los datos guardados en este navegador.']));
  });
  return pagina;
}

const duracionDeVentana = (ventana: VentanaVelas): number => duracionDeTemporalidad(ventana.temporalidad, TEMPORALIDADES);

export const crearPaginaPanel = (aplicacion: Aplicacion): HTMLElement =>
  crearPaginaFiltrada(aplicacion, 'Panel', (analisis, ventanas, _horas, moneda, saldo) =>
    crearContenidoPanel(analisis, crearPerfil(analisis.operaciones, ventanas, duracionDeVentana, ESTRATEGIA), moneda, saldo),
  );

export const crearPaginaOperaciones = (aplicacion: Aplicacion): HTMLElement =>
  crearPaginaFiltrada(aplicacion, 'Operaciones', (analisis, _ventanas, horas) => crearContenidoOperaciones(analisis, horas));

export const crearPaginaErrores = (aplicacion: Aplicacion): HTMLElement =>
  crearPaginaFiltrada(aplicacion, 'Errores y consejos', (analisis, ventanas) =>
    crearContenidoErrores(
      [
        ...detectarErrores(analisis.operaciones, analisis.estadisticas, UMBRALES_ERRORES),
        ...detectarSalidasAnticipadas(analisis.operaciones, ventanas),
      ],
      analisis.operaciones.length,
      ventanas.size > 0,
    ),
  );

const textoOrigen = (cambio: TipoCambio): string =>
  cambio.origen === 'manual' ? 'escrito por ti' : `BCE, ${cambio.fecha ?? 'sin fecha'}`;

function opcionesConversor(aplicacion: Aplicacion, moneda: string, importeInicial: number) {
  const servicio = aplicacion.servicioCambio;
  const guardado = servicio.obtener(moneda);
  return {
    moneda,
    destino: servicio.monedaDestino,
    importeInicial,
    tasaInicial: guardado?.tasa ?? null,
    origenInicial: guardado ? textoOrigen(guardado) : '',
    leerTasa,
    convertir,
    alFijarManual: (texto: string) => {
      const cambio = servicio.fijarManual(moneda, texto);
      return { tasa: cambio.tasa, origen: textoOrigen(cambio) };
    },
    alActualizar: async () => {
      const cambio = await servicio.actualizar(moneda);
      return { tasa: cambio.tasa, origen: textoOrigen(cambio) };
    },
  };
}
