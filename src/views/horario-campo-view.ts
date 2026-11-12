import { crearElemento } from './dom';

export interface DatosHorario {
  readonly tipoHorario: 'zona' | 'nueva_york_mas' | null;
  readonly zona: string;
  readonly horas: string;
}

export interface CampoHorario {
  readonly elemento: HTMLElement;
  leer(): DatosHorario;
}

let contadorGrupos = 0;

/**
 * Selector del horario del servidor del broker. Lo usan la importación de informes
 * y la carga de velas, para que los dos pidan exactamente lo mismo.
 */
export function crearCampoHorario(): CampoHorario {
  // Cada instancia necesita su propio nombre de grupo: los radios de dos formularios no deben mezclarse.
  const nombreGrupo = `horario-${contadorGrupos++}`;
  const campoZona = crearElemento('input', { type: 'text', name: 'zona', placeholder: 'Europe/Athens', 'aria-label': 'Nombre de la zona horaria' }) as HTMLInputElement;
  const campoHoras = crearElemento('input', { type: 'number', name: 'horas', step: '1', placeholder: '7', 'aria-label': 'Horas de diferencia con Nueva York' }) as HTMLInputElement;
  const radioZona = crearElemento('input', { type: 'radio', name: nombreGrupo, value: 'zona' }) as HTMLInputElement;
  const radioNuevaYork = crearElemento('input', { type: 'radio', name: nombreGrupo, value: 'nueva_york_mas' }) as HTMLInputElement;

  const opcion = (radio: HTMLElement, texto: string, control: HTMLElement) =>
    crearElemento('div', { class: 'opcion-horario' }, [crearElemento('label', { class: 'opcion-horario__radio' }, [radio, texto]), control]);

  const elemento = crearElemento('fieldset', { class: 'grupo' }, [
    crearElemento('legend', {}, ['Horario del servidor del broker (obligatorio)']),
    opcion(radioZona, 'Zona horaria con nombre', campoZona),
    opcion(radioNuevaYork, 'Regla «Nueva York + N horas»', campoHoras),
    crearElemento('p', { class: 'texto-suave' }, ['No hay valor por defecto: el fichero no incluye la zona horaria y la aplicación no la deduce.']),
  ]);

  return {
    elemento,
    leer: () => ({
      tipoHorario: radioZona.checked ? 'zona' : radioNuevaYork.checked ? 'nueva_york_mas' : null,
      zona: campoZona.value,
      horas: campoHoras.value,
    }),
  };
}
