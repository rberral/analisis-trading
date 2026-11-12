import type { VentanaVelas } from '../../models/velas';

export interface LectorVentanas {
  /** Todas las ventanas guardadas (varias por operación si se cargaron distintas temporalidades). */
  leerVentanas(): Promise<VentanaVelas[]>;
  leerVentanasDe(operacionId: string): Promise<VentanaVelas[]>;
}
