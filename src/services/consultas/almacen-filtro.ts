import { FILTRO_INICIAL, type Filtro } from '../../models/filtro';

/** Guarda el filtro elegido para que se mantenga al cambiar de pantalla. */
export class AlmacenFiltro {
  private filtro: Filtro = FILTRO_INICIAL;

  obtener(): Filtro {
    return this.filtro;
  }

  fijar(filtro: Filtro): void {
    this.filtro = filtro;
  }
}
