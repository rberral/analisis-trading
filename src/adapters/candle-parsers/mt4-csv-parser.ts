/**
 * Lee el CSV que exporta el Centro de historial de MetaTrader 4:
 *   2026.10.30,15:00,1.11956,1.11966,1.11707,1.11760,14153
 * Sin cabecera. La hora es la del servidor del broker.
 */
import { ErrorDeUsuario } from '../../core/errores';
import type { VelaBroker } from '../../models/velas';
import type { ParserVelas } from '../../services/velas/puertos';

const LINEA = /^(\d{4})\.(\d{2})\.(\d{2}),(\d{2}):(\d{2}),([^,]+),([^,]+),([^,]+),([^,]+),([^,]+)$/;

function leerPrecio(texto: string, numeroLinea: number): number {
  const valor = Number(texto);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new ErrorDeUsuario(`Línea ${numeroLinea}: «${texto}» no es un número válido.`);
  }
  return valor;
}

function leerLinea(linea: string, numeroLinea: number): VelaBroker {
  const partes = LINEA.exec(linea);
  if (!partes) {
    throw new ErrorDeUsuario(
      `Línea ${numeroLinea}: no tiene el formato de MetaTrader 4 (fecha AAAA.MM.DD, hora HH:MM, apertura, máximo, mínimo, cierre y volumen).`,
    );
  }
  const [anio, mes, dia, hora, minuto, abre, maximo, minimo, cierra, volumen] = partes.slice(1) as [
    string, string, string, string, string, string, string, string, string, string,
  ];
  const vela: VelaBroker = {
    horaBroker: `${anio}-${mes}-${dia}T${hora}:${minuto}:00`,
    abre: leerPrecio(abre, numeroLinea),
    maximo: leerPrecio(maximo, numeroLinea),
    minimo: leerPrecio(minimo, numeroLinea),
    cierra: leerPrecio(cierra, numeroLinea),
    volumen: leerPrecio(volumen, numeroLinea),
  };
  if (vela.maximo < vela.minimo) {
    throw new ErrorDeUsuario(`Línea ${numeroLinea}: el máximo es menor que el mínimo.`);
  }
  return vela;
}

export class ParserVelasMt4Csv implements ParserVelas {
  leer(contenido: string): VelaBroker[] {
    const lineas = contenido.replace(/^﻿/, '').split(/\r?\n/);
    const velas: VelaBroker[] = [];
    lineas.forEach((linea, indice) => {
      if (linea.trim() === '') return;
      velas.push(leerLinea(linea.trim(), indice + 1));
    });
    if (velas.length === 0) throw new ErrorDeUsuario('El fichero de velas está vacío.');
    // El texto "AAAA-MM-DDTHH:MM:SS" se ordena igual que el tiempo.
    return velas.sort((a, b) => (a.horaBroker < b.horaBroker ? -1 : a.horaBroker > b.horaBroker ? 1 : 0));
  }
}
