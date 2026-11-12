import type { OperacionGuardada } from '../models/operacion';
import type { AnalisisPeriodo } from '../services/consultas/analisis-periodo';
import { TEXTO_CLASIFICACION } from '../services/analisis/clasificacion-cierre';
import { crearElemento } from './dom';
import type { VisualizadorHoras } from '../services/visualizacion/visualizador-horas';
import { fechaHora, importe, precio } from './formato';
import { crearNotaClasificacionCierre, crearNotaHoras } from './notas-view';

function celda(texto: string, clase = ''): HTMLElement {
  return crearElemento('td', clase ? { class: clase } : {}, [texto]);
}

function neto(operacion: OperacionGuardada): number {
  return operacion.comision + operacion.impuestos + operacion.swap + operacion.beneficio;
}

function fila(operacion: OperacionGuardada, analisis: AnalisisPeriodo, horas: VisualizadorHoras): HTMLElement {
  const origen = operacion.importacionId;
  const clase = analisis.clasificacion.get(operacion.id);
  const resultado = neto(operacion);
  return crearElemento('tr', {}, [
    crearElemento('td', {}, [crearElemento('a', { href: `#/operaciones/${encodeURIComponent(operacion.id)}`, class: 'enlace' }, [operacion.ticket])]),
    celda(operacion.activo),
    celda(operacion.tipo === 'compra' ? 'Compra' : 'Venta'),
    celda(importe(operacion.lotes), 'numero'),
    celda(fechaHora(operacion.aperturaUtc, horas.desfaseMs(operacion.aperturaUtc, origen))),
    celda(operacion.cierreUtc === null ? 'Abierta' : fechaHora(operacion.cierreUtc, horas.desfaseMs(operacion.cierreUtc, origen))),
    celda(precio(operacion.precioEntrada), 'numero'),
    celda(precio(operacion.stopLoss), 'numero'),
    celda(precio(operacion.takeProfit), 'numero'),
    celda(clase ? TEXTO_CLASIFICACION[clase] : '—'),
    celda(importe(resultado), `numero ${resultado > 0 ? 'positivo' : resultado < 0 ? 'negativo' : ''}`.trim()),
  ]);
}

function tabla(operaciones: readonly OperacionGuardada[], analisis: AnalisisPeriodo, horas: VisualizadorHoras): HTMLElement {
  const columnas = ['Ticket', 'Activo', 'Tipo', 'Lotes', `Apertura (${horas.etiqueta})`, `Cierre (${horas.etiqueta})`, 'Entrada', 'SL', 'TP', 'Cierre', 'Neto'];
  const cabecera = crearElemento('tr', {}, columnas.map((nombre, i) => crearElemento('th', i >= 3 && [3, 6, 7, 8, 10].includes(i) ? { class: 'numero' } : {}, [nombre])));
  return crearElemento('div', { class: 'tabla-envoltorio' }, [
    crearElemento('table', { class: 'tabla' }, [
      crearElemento('thead', {}, [cabecera]),
      crearElemento('tbody', {}, operaciones.map((operacion) => fila(operacion, analisis, horas))),
    ]),
  ]);
}

export function crearContenidoOperaciones(analisis: AnalisisPeriodo, horas: VisualizadorHoras): HTMLElement {
  // Más recientes primero: es lo que se suele querer revisar.
  const cerradas = [...analisis.operaciones].reverse();
  const bloques: HTMLElement[] = [crearNotaHoras(horas), crearNotaClasificacionCierre()];
  if (analisis.abiertas.length > 0) {
    bloques.push(
      crearElemento('div', { class: 'tarjeta' }, [
        crearElemento('h2', {}, [`Abiertas ahora (${analisis.abiertas.length})`]),
        tabla(analisis.abiertas, analisis, horas),
      ]),
    );
  }
  bloques.push(
    crearElemento('div', { class: 'tarjeta' }, [
      crearElemento('h2', {}, [`Cerradas (${cerradas.length})`]),
      cerradas.length === 0 ? crearElemento('p', { class: 'texto-suave' }, ['No hay operaciones cerradas con este filtro.']) : tabla(cerradas, analisis, horas),
    ]),
  );
  return crearElemento('div', {}, bloques);
}
