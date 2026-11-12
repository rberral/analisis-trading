/**
 * Extrae el texto de un PDF en el navegador con pdf.js (Mozilla). La librería se carga solo
 * cuando se importa un PDF, así que no pesa en el resto de la aplicación. Es el único
 * fichero que la conoce: cambiar de librería solo afecta a este.
 */
import { ErrorDeUsuario } from '../../core/errores';
import { logger } from '../../core/logger';
import { agruparEnLineas, type FragmentoTexto } from './agrupar-lineas';

/** Lo mínimo que se usa de pdf.js, para no depender de sus tipos completos. */
interface PdfJs {
  readonly GlobalWorkerOptions: { workerSrc: string };
  getDocument(opciones: { data: Uint8Array; isEvalSupported: boolean }): {
    readonly promise: Promise<{
      readonly numPages: number;
      getPage(numero: number): Promise<{
        getTextContent(): Promise<{ readonly items: ReadonlyArray<{ readonly str?: string; readonly transform?: readonly number[] }> }>;
      }>;
    }>;
  };
}

/** Devuelve el texto del PDF, una línea por fila de tabla. */
export async function extraerTextoPdf(fichero: File): Promise<string> {
  try {
    const pdfjs = (await import('pdfjs-dist')) as unknown as PdfJs;
    const { default: rutaDelTrabajador } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjs.GlobalWorkerOptions.workerSrc = rutaDelTrabajador;
    const documento = await pdfjs.getDocument({ data: new Uint8Array(await fichero.arrayBuffer()), isEvalSupported: false }).promise;
    const lineas: string[] = [];
    for (let numero = 1; numero <= documento.numPages; numero++) {
      const pagina = await documento.getPage(numero);
      const contenido = await pagina.getTextContent();
      const fragmentos: FragmentoTexto[] = contenido.items.flatMap((item) =>
        item.str !== undefined && item.transform ? [{ texto: item.str, x: item.transform[4] ?? 0, y: item.transform[5] ?? 0 }] : [],
      );
      lineas.push(...agruparEnLineas(fragmentos));
    }
    return lineas.join('\n');
  } catch (error) {
    logger.error('No se pudo leer el PDF', error);
    throw new ErrorDeUsuario('No se pudo leer el PDF. Comprueba que es el informe de historial de Quantfury sin modificar.');
  }
}
