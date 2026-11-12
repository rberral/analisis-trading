import { OPCION_OTRA_REGLA, OPCION_OTRA_ZONA, type OpcionHorario } from '../config/app-config';
import { crearElemento } from './dom';

export interface DatosHorario {
  /** '' si no ha elegido nada; si no, el id de una opción predefinida o una de las dos especiales. */
  readonly opcionHorario: string;
  /** Solo con «Otra zona horaria». */
  readonly zona: string;
  /** Solo con «Otra regla Nueva York + N horas». */
  readonly horas: string;
}

export interface CampoHorario {
  readonly elemento: HTMLElement;
  leer(): DatosHorario;
}

/**
 * Selector del horario del servidor del broker. Lo usan la importación de informes
 * y la carga de velas, para que los dos pidan exactamente lo mismo.
 * Empieza vacío a propósito: el usuario tiene que elegir, la aplicación no lo supone.
 */
export function crearCampoHorario(opciones: readonly OpcionHorario[]): CampoHorario {
  const selector = crearElemento('select', { name: 'horario', 'aria-label': 'Horario del servidor del broker' }) as HTMLSelectElement;
  selector.append(crearElemento('option', { value: '' }, ['Elige un horario…']));
  for (const opcion of opciones) {
    selector.append(crearElemento('option', { value: opcion.id }, [`${opcion.nombre} · ${opcion.detalle}`]));
  }
  selector.append(crearElemento('option', { value: OPCION_OTRA_ZONA }, ['Otra zona horaria (escribir su nombre)']));
  selector.append(crearElemento('option', { value: OPCION_OTRA_REGLA }, ['Otra regla «Nueva York + N horas»']));

  const campoZona = crearElemento('input', { type: 'text', name: 'zona', placeholder: 'Por ejemplo: Asia/Dubai', 'aria-label': 'Nombre de la zona horaria' }) as HTMLInputElement;
  const campoHoras = crearElemento('input', { type: 'number', name: 'horas', step: '1', placeholder: '7', 'aria-label': 'Horas de diferencia con Nueva York' }) as HTMLInputElement;
  const filaZona = crearElemento('label', { class: 'campo', hidden: '' }, ['Nombre de la zona', campoZona]);
  const filaHoras = crearElemento('label', { class: 'campo', hidden: '' }, ['Horas sobre Nueva York', campoHoras]);

  selector.addEventListener('change', () => {
    filaZona.hidden = selector.value !== OPCION_OTRA_ZONA;
    filaHoras.hidden = selector.value !== OPCION_OTRA_REGLA;
  });

  const elemento = crearElemento('fieldset', { class: 'grupo' }, [
    crearElemento('legend', {}, ['Horario del servidor del broker (obligatorio)']),
    selector,
    filaZona,
    filaHoras,
    crearElemento('p', { class: 'texto-suave' }, ['No hay valor por defecto: el fichero no incluye la zona horaria y la aplicación no la deduce. Todas las horas se guardan en UTC: al cargar el fichero se convierten a UTC con el horario que elijas aquí.']),
  ]);

  return { elemento, leer: () => ({ opcionHorario: selector.value, zona: campoZona.value, horas: campoHoras.value }) };
}
