/** Formatos de números y fechas compartidos por las pantallas (siempre en castellano y UTC). */
const crearFormatoNumero = (decimales: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

const FORMATO_2 = crearFormatoNumero(2);
const FORMATO_0 = crearFormatoNumero(0);
const FORMATO_FECHA_HORA = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'UTC',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const importe = (valor: number): string => FORMATO_2.format(valor);
export const entero = (valor: number): string => FORMATO_0.format(valor);
export const porcentaje = (valor: number): string => `${FORMATO_2.format(valor)} %`;
export const fechaHoraUtc = (utcMs: number): string => FORMATO_FECHA_HORA.format(new Date(utcMs));

/** Precios: sin ceros de más (1,1 en vez de 1,10000), hasta 5 decimales. */
export const precio = (valor: number | null): string =>
  valor === null ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 5 }).format(valor);
