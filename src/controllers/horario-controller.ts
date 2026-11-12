import { HORARIOS_PREDEFINIDOS, OPCION_OTRA_REGLA, OPCION_OTRA_ZONA } from '../config/app-config';
import { ErrorDeUsuario } from '../core/errores';
import type { HorarioBroker } from '../core/horario';
import type { DatosHorario } from '../views/horario-campo-view';

/** Convierte lo elegido en el formulario en un horario; si falta algo, avisa al usuario. */
export function construirHorario(datos: DatosHorario): HorarioBroker {
  if (datos.opcionHorario === '') {
    throw new ErrorDeUsuario('Indica el horario del servidor del broker: es obligatorio.');
  }
  if (datos.opcionHorario === OPCION_OTRA_ZONA) return { tipo: 'zona', zona: datos.zona };
  if (datos.opcionHorario === OPCION_OTRA_REGLA) {
    const horas = datos.horas.trim() === '' ? Number.NaN : Number(datos.horas);
    return { tipo: 'nueva_york_mas', horas };
  }
  const predefinido = HORARIOS_PREDEFINIDOS.find((opcion) => opcion.id === datos.opcionHorario);
  if (!predefinido) throw new ErrorDeUsuario('El horario elegido no es válido.');
  return predefinido.horario;
}
