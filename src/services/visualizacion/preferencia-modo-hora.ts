import type { ModoHora } from '../../models/visualizacion';

/** Dónde se recuerda la elección del usuario (en el navegador). */
export interface AlmacenClaveValor {
  leer(clave: string): string | null;
  escribir(clave: string, valor: string): void;
}

/** Guarda en qué hora quiere ver las horas el usuario. Una conveniencia: si no se puede guardar, se usa el valor inicial. */
export class PreferenciaModoHora {
  constructor(
    private readonly almacen: AlmacenClaveValor,
    private readonly clave: string,
    private readonly modosValidos: readonly ModoHora[],
    private readonly modoInicial: ModoHora,
  ) {}

  obtener(): ModoHora {
    const guardado = this.almacen.leer(this.clave);
    return this.modosValidos.find((modo) => modo === guardado) ?? this.modoInicial;
  }

  fijar(modo: ModoHora): void {
    this.almacen.escribir(this.clave, modo);
  }
}
