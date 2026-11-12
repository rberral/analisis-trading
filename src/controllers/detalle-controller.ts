import { COLORES_GRAFICO, TEMPORALIDADES } from '../config/app-config';
import type { Aplicacion } from '../composicion';
import { crearGraficoVelas, type GraficoVelas, type MarcadorGrafico } from '../adapters/charts/grafico-velas';
import { logger } from '../core/logger';
import type { OperacionGuardada } from '../models/operacion';
import type { VentanaVelas } from '../models/velas';
import { calcularRecorrido, evaluarSalidaPosterior } from '../services/analisis/recorrido';
import { duracionDeTemporalidad, ventanaMasDetallada, velaQueContiene } from '../services/analisis/ventanas-operacion';
import { crearElemento } from '../views/dom';
import { crearSinVelas, crearTarjetaDatos, crearTarjetaRecorrido, crearTarjetaSalida } from '../views/detalle-view';

function crearMarcadores(operacion: OperacionGuardada, ventana: VentanaVelas, duracionMs: number): MarcadorGrafico[] {
  const esCompra = operacion.tipo === 'compra';
  const marcadores: MarcadorGrafico[] = [];
  const velaEntrada = velaQueContiene(ventana.velas, operacion.aperturaUtc, duracionMs);
  if (velaEntrada) {
    marcadores.push({ velaUtcMs: velaEntrada.utcMs, texto: 'Entrada', color: COLORES_GRAFICO.entrada, posicion: esCompra ? 'abajo' : 'arriba', forma: esCompra ? 'flecha_arriba' : 'flecha_abajo' });
  }
  const velaSalida = operacion.cierreUtc === null ? null : velaQueContiene(ventana.velas, operacion.cierreUtc, duracionMs);
  if (velaSalida) {
    marcadores.push({ velaUtcMs: velaSalida.utcMs, texto: 'Salida', color: COLORES_GRAFICO.salida, posicion: esCompra ? 'arriba' : 'abajo', forma: 'circulo' });
  }
  return marcadores;
}

/** Detalle de una operación: datos, recorrido del precio y gráfico con entrada, salida, SL y TP. */
export function crearPaginaDetalle(aplicacion: Aplicacion, operacionId: string): HTMLElement {
  const pagina = crearElemento('div', {}, [crearElemento('p', { class: 'texto-suave' }, ['Cargando…'])]);
  let grafico: GraficoVelas | null = null;

  function dibujarVelas(zona: HTMLElement, operacion: OperacionGuardada, ventana: VentanaVelas): void {
    grafico?.destruir();
    const duracionMs = duracionDeTemporalidad(ventana.temporalidad, TEMPORALIDADES);
    const contenedor = crearElemento('div', { class: 'grafico' });
    const lineas = [
      { precio: operacion.precioEntrada, titulo: 'Entrada', color: COLORES_GRAFICO.entrada },
      ...(operacion.stopLoss === null ? [] : [{ precio: operacion.stopLoss, titulo: 'SL', color: COLORES_GRAFICO.stopLoss }]),
      ...(operacion.takeProfit === null ? [] : [{ precio: operacion.takeProfit, titulo: 'TP', color: COLORES_GRAFICO.takeProfit }]),
    ];
    const tarjetaGrafico = crearElemento('div', { class: 'tarjeta' }, [
      crearElemento('h2', {}, [`Gráfico · ${ventana.temporalidad}`]),
      contenedor,
      ventana.truncada ? crearElemento('p', { class: 'aviso aviso--atencion' }, ['La operación duró tanto que solo se muestran las primeras velas guardadas.']) : crearElemento('p', { class: 'texto-suave' }, ['Horas en UTC.']),
    ]);
    const recorrido = calcularRecorrido(operacion, ventana.velas, duracionMs);
    const tarjetaSalida = crearTarjetaSalida(evaluarSalidaPosterior(operacion, ventana.velas));
    zona.replaceChildren(tarjetaGrafico, crearTarjetaRecorrido(recorrido), ...(tarjetaSalida ? [tarjetaSalida] : []));
    try {
      grafico = crearGraficoVelas(contenedor, { velas: ventana.velas, lineas, marcadores: crearMarcadores(operacion, ventana, duracionMs) });
    } catch (error) {
      logger.error('No se pudo dibujar el gráfico', error);
      contenedor.replaceChildren('No se pudo dibujar el gráfico.');
    }
  }

  async function cargar(): Promise<void> {
    const datos = await aplicacion.lectorDatos.leerTodo();
    const operacion = datos.operaciones.find((candidata) => candidata.id === operacionId);
    if (!operacion) {
      pagina.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion' }, ['No se encuentra esa operación.']), crearElemento('a', { href: '#/operaciones', class: 'enlace' }, ['Volver a Operaciones']));
      return;
    }
    const ventanas = await aplicacion.lectorVentanas.leerVentanasDe(operacion.id);
    const zonaVelas = crearElemento('div');
    const elegida = ventanaMasDetallada(ventanas, TEMPORALIDADES);
    const controles: HTMLElement[] = [];
    if (ventanas.length > 1) {
      const selector = crearElemento('select', { 'aria-label': 'Temporalidad' }) as HTMLSelectElement;
      for (const v of ventanas) selector.append(crearElemento('option', { value: v.temporalidad }, [v.temporalidad]));
      selector.value = elegida?.temporalidad ?? '';
      selector.addEventListener('change', () => {
        const otra = ventanas.find((v) => v.temporalidad === selector.value);
        if (otra) dibujarVelas(zonaVelas, operacion, otra);
      });
      controles.push(crearElemento('label', { class: 'campo campo--filtro' }, ['Temporalidad', selector]));
    }
    if (elegida) dibujarVelas(zonaVelas, operacion, elegida);
    else zonaVelas.replaceChildren(crearSinVelas());

    pagina.replaceChildren(
      crearElemento('a', { href: '#/operaciones', class: 'enlace' }, ['← Volver a Operaciones']),
      crearElemento('h1', { class: 'titulo-pagina' }, ['Detalle de la operación']),
      ...controles,
      crearTarjetaDatos(operacion),
      zonaVelas,
    );
  }

  cargar().catch((error: unknown) => {
    logger.error('No se pudo cargar el detalle de la operación', error);
    pagina.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, ['No se pudieron leer los datos guardados en este navegador.']));
  });
  return pagina;
}
