import { ErrorDeUsuario } from '../core/errores';
import type { HorarioBroker } from '../core/horario';
import type { DatosHorario } from '../views/horario-campo-view';

/** Convierte lo escrito en el formulario en un horario; si falta algo, avisa al usuario. */
export function construirHorario(datos: DatosHorario): HorarioBroker {
  if (datos.tipoHorario === 'zona') return { tipo: 'zona', zona: datos.zona };
  if (datos.tipoHorario === 'nueva_york_mas') {
    const horas = datos.horas.trim() === '' ? Number.NaN : Number(datos.horas);
    return { tipo: 'nueva_york_mas', horas };
  }
  throw new ErrorDeUsuario('Indica el horario del servidor del broker: es obligatorio.');
}
