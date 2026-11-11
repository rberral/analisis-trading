/** Un patrón problemático encontrado en las operaciones, con consejo para corregirlo. */
export interface ErrorDetectado {
  readonly codigo: 'sin_stop_loss' | 'apertura_erronea' | 'perdida_desproporcionada' | 'lotes_tras_perdida' | 'sobreoperacion' | 'perdedoras_largas';
  readonly titulo: string;
  readonly descripcion: string;
  readonly consejo: string;
  /** Operaciones afectadas (vacío si el patrón es global). */
  readonly tickets: readonly string[];
  /** Suma del resultado neto de las operaciones afectadas. */
  readonly impacto: number | null;
}
