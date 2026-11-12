/** Salidas anticipadas: cierres a mano antes del take profit cuando el precio acabó llegando a él. Necesita velas. */
import type { ErrorDetectado } from '../../models/error-detectado';
import type { OperacionGuardada } from '../../models/operacion';
import type { Vela, VentanaVelas } from '../../models/velas';
import { netoDeOperacion, redondear2 } from '../estadisticas/calculadora-estadisticas';
import { evaluarSalidaPosterior } from '../analisis/recorrido';

const neto = (operacion: OperacionGuardada): number => netoDeOperacion({ ...operacion, cierre: operacion.cierreUtc ?? 0 });

export function detectarSalidasAnticipadas(
  operaciones: readonly OperacionGuardada[],
  ventanas: ReadonlyMap<string, VentanaVelas>,
): ErrorDetectado[] {
  const perdioElTp: OperacionGuardada[] = [];
  let evitaronPerder = 0;
  for (const operacion of operaciones) {
    const ventana = ventanas.get(operacion.id);
    if (!ventana) continue;
    const velas: readonly Vela[] = ventana.velas;
    const evaluacion = evaluarSalidaPosterior(operacion, velas);
    if (evaluacion.resultado === 'tp_alcanzado') perdioElTp.push(operacion);
    if (evaluacion.resultado === 'sl_alcanzado') evitaronPerder += 1;
  }
  if (perdioElTp.length === 0) return [];
  const complemento = evitaronPerder > 0 ? ` En otras ${evitaronPerder}, el precio fue después hacia el stop loss: ahí cerrar a mano te ayudó.` : '';
  return [
    {
      codigo: 'salida_anticipada',
      titulo: 'Cierras a mano antes del take profit',
      descripcion: `${perdioElTp.length} operaciones cerradas a mano llegaron a su take profit en las velas siguientes a tu salida.${complemento}`,
      consejo: 'Si el plan tiene un objetivo, déjalo trabajar. Si sueles cerrar antes, escribe una regla de salida (por ejemplo, mover el stop a break even en lugar de cerrar).',
      tickets: perdioElTp.map((o) => o.ticket),
      impacto: redondear2(perdioElTp.reduce((total, o) => total + neto(o), 0)),
    },
  ];
}
