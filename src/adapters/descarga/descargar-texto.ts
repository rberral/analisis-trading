/** Descarga un texto como fichero desde el navegador (adaptador: aísla el uso de Blob y del enlace de descarga). */
export function descargarTexto(nombreFichero: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/plain;charset=utf-8' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreFichero;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
