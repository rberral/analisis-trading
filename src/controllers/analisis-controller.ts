import { ESTRATEGIA, TEMPORALIDADES, UMBRALES_ERRORES } from '../config/app-config';
import type { Aplicacion } from '../composicion';
import { logger } from '../core/logger';
import { analizarPeriodo, opcionesDelFiltro, type AnalisisPeriodo } from '../services/consultas/analisis-periodo';
import type { DatosGuardados } from '../services/consultas/puertos';
import type { VentanaVelas } from '../models/velas';
import { crearPerfil } from '../services/analisis/perfil-estrategia';
import { duracionDeTemporalidad, indexarVentanas } from '../services/analisis/ventanas-operacion';
import { detectarErrores } from '../services/errores/detector-errores';
import { detectarSalidasAnticipadas } from '../services/errores/detector-salidas';
import { crearElemento } from '../views/dom';
import { crearContenidoErrores } from '../views/errores-view';
import { crearBarraFiltros } from '../views/filtros-view';
import { crearContenidoOperaciones } from '../views/operaciones-view';
import { crearContenidoPanel } from '../views/panel-view';

/** Una ventana de velas por operación (la más detallada); vacío si no se han cargado velas. */
type VentanasPorOperacion = ReadonlyMap<string, VentanaVelas>;

type Dibujar = (analisis: AnalisisPeriodo, ventanas: VentanasPorOperacion) => HTMLElement;

/**
 * Pantalla con barra de filtros arriba y contenido que depende del filtro.
 * Las tres pantallas (Panel, Operaciones, Errores) solo se diferencian en `dibujar`.
 */
function crearPaginaFiltrada(aplicacion: Aplicacion, titulo: string, dibujar: Dibujar): HTMLElement {
  const zonaBarra = crearElemento('div');
  const zonaContenido = crearElemento('div', { 'aria-live': 'polite' }, [crearElemento('p', { class: 'texto-suave' }, ['Cargando…'])]);
  const pagina = crearElemento('div', {}, [crearElemento('h1', { class: 'titulo-pagina' }, [titulo]), zonaBarra, zonaContenido]);

  function mostrar(datos: DatosGuardados, ventanas: VentanasPorOperacion): void {
    const resultado = analizarPeriodo(datos, aplicacion.filtro.obtener());
    zonaContenido.replaceChildren(
      typeof resultado === 'string'
        ? crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, [resultado])
        : dibujar(resultado, ventanas),
    );
  }

  async function cargar(): Promise<void> {
    const datos = await aplicacion.lectorDatos.leerTodo();
    const ventanas = indexarVentanas(await aplicacion.lectorVentanas.leerVentanas(), TEMPORALIDADES);
    if (datos.operaciones.length === 0) {
      zonaContenido.replaceChildren(
        crearElemento('p', { class: 'aviso' }, ['Todavía no hay operaciones. Empieza por '], ),
      );
      zonaContenido.firstElementChild?.append(crearElemento('a', { href: '#/importar', class: 'enlace' }, ['importar un informe']), '.');
      return;
    }
    zonaBarra.replaceChildren(
      crearBarraFiltros({
        opciones: opcionesDelFiltro(datos),
        filtro: aplicacion.filtro.obtener(),
        alCambiar: (filtro) => {
          aplicacion.filtro.fijar(filtro);
          mostrar(datos, ventanas);
        },
      }),
    );
    mostrar(datos, ventanas);
  }

  cargar().catch((error: unknown) => {
    logger.error('No se pudieron cargar las operaciones', error);
    zonaContenido.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, ['No se pudieron leer los datos guardados en este navegador.']));
  });
  return pagina;
}

const duracionDeVentana = (ventana: VentanaVelas): number => duracionDeTemporalidad(ventana.temporalidad, TEMPORALIDADES);

export const crearPaginaPanel = (aplicacion: Aplicacion): HTMLElement =>
  crearPaginaFiltrada(aplicacion, 'Panel', (analisis, ventanas) =>
    crearContenidoPanel(analisis, crearPerfil(analisis.operaciones, ventanas, duracionDeVentana, ESTRATEGIA)),
  );

export const crearPaginaOperaciones = (aplicacion: Aplicacion): HTMLElement =>
  crearPaginaFiltrada(aplicacion, 'Operaciones', crearContenidoOperaciones);

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
