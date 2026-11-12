import { UMBRALES_ERRORES } from '../config/app-config';
import type { ErrorDetectado } from '../models/error-detectado';
import { crearElemento } from './dom';
import { importe } from './formato';

const MAXIMO_TICKETS_VISIBLES = 20;

function crearTarjetaError(error: ErrorDetectado): HTMLElement {
  const lineas: HTMLElement[] = [
    crearElemento('h2', {}, [error.titulo]),
    crearElemento('p', {}, [error.descripcion]),
    crearElemento('p', { class: 'consejo' }, [`Consejo: ${error.consejo}`]),
  ];
  if (error.impacto !== null) {
    lineas.push(crearElemento('p', { class: 'texto-suave' }, [`Resultado neto de las operaciones afectadas: ${importe(error.impacto)}`]));
  }
  if (error.tickets.length > 0) {
    const visibles = error.tickets.slice(0, MAXIMO_TICKETS_VISIBLES).join(', ');
    const resto = error.tickets.length - MAXIMO_TICKETS_VISIBLES;
    lineas.push(crearElemento('p', { class: 'texto-suave' }, [`Tickets: ${visibles}${resto > 0 ? ` y ${resto} más` : ''}`]));
  }
  return crearElemento('div', { class: 'tarjeta' }, lineas);
}

export function crearContenidoErrores(errores: readonly ErrorDetectado[], totalOperaciones: number, hayVelas: boolean): HTMLElement {
  if (totalOperaciones < UMBRALES_ERRORES.minimoOperaciones) {
    return crearElemento('p', { class: 'aviso' }, [
      `Se necesitan al menos ${UMBRALES_ERRORES.minimoOperaciones} operaciones cerradas para analizar errores (ahora hay ${totalOperaciones}).`,
    ]);
  }
  if (errores.length === 0) {
    return crearElemento('p', { class: 'aviso' }, ['No se ha detectado ningún patrón problemático con los datos del informe.']);
  }
  return crearElemento('div', {}, [
    ...errores.map(crearTarjetaError),
    crearElemento('p', { class: 'texto-suave' }, [
      hayVelas
        ? 'Son criterios orientativos. Las salidas anticipadas se calculan con las velas que hayas cargado.'
        : 'Son criterios orientativos calculados solo con el informe. Carga velas en «Velas y ficheros» para detectar también las salidas anticipadas.',
    ]),
  ]);
}
