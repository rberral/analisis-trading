import type { AlmacenClaveValor } from '../../services/visualizacion/preferencia-modo-hora';

/** localStorage puede estar bloqueado (navegación privada, datos borrados): nunca debe romper la aplicación. */
export class PreferenciasNavegador implements AlmacenClaveValor {
  leer(clave: string): string | null {
    try {
      return window.localStorage.getItem(clave);
    } catch {
      return null;
    }
  }

  escribir(clave: string, valor: string): void {
    try {
      window.localStorage.setItem(clave, valor);
    } catch {
      // Sin almacenamiento: la elección se pierde al recargar, sin más consecuencias.
    }
  }
}
