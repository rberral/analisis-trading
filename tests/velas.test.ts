import { describe, expect, it } from 'vitest';
import { ParserVelasMt4Csv } from '../src/adapters/candle-parsers/mt4-csv-parser';
import { TEMPORALIDADES } from '../src/config/app-config';
import { ErrorDeUsuario } from '../src/core/errores';
import type { RegistroCargaVelas, VentanaVelas } from '../src/models/velas';
import type { DatosGuardados, LectorDatos } from '../src/services/consultas/puertos';
import { ServicioVelas } from '../src/services/velas/servicio-velas';
import type { RepositorioVelas } from '../src/services/velas/puertos';
import { crearOperacion } from './fixtures/operaciones';

const HORA = 3_600_000;

/** Genera un CSV de MT4 de velas H1 en hora del broker (Atenas = UTC+2 en invierno). */
function csvH1(inicioBrokerMs: number, cantidad: number, precioBase: number): string {
  const lineas: string[] = [];
  for (let i = 0; i < cantidad; i++) {
    const t = new Date(inicioBrokerMs + i * HORA);
    const precio = precioBase + (i % 7) * 0.001;
    const fecha = t.toISOString().slice(0, 10).replace(/-/g, '.');
    lineas.push(`${fecha},${t.toISOString().slice(11, 16)},${precio.toFixed(5)},${(precio + 0.0005).toFixed(5)},${(precio - 0.0005).toFixed(5)},${precio.toFixed(5)},100`);
  }
  return lineas.join('\n');
}

class RepositorioEnMemoria implements RepositorioVelas {
  cargas: RegistroCargaVelas[] = [];
  ventanas: VentanaVelas[] = [];
  async guardarCarga(registro: RegistroCargaVelas, ventanas: readonly VentanaVelas[]) {
    this.cargas.push(registro);
    this.ventanas.push(...ventanas);
  }
  async listarCargas() {
    return this.cargas;
  }
}

const horario = { tipo: 'zona', zona: 'Europe/Athens' } as const;

describe('ParserVelasMt4Csv', () => {
  const parser = new ParserVelasMt4Csv();

  it('lee velas de MT4 y las ordena', () => {
    const velas = parser.leer('2026.10.30,16:00,1.1,1.2,1.0,1.15,10\r\n2026.10.30,15:00,1.1,1.2,1.0,1.15,10\r\n');
    expect(velas.map((v) => v.horaBroker)).toEqual(['2026-10-30T15:00:00', '2026-10-30T16:00:00']);
  });

  it('indica la línea cuando el formato no es válido', () => {
    expect(() => parser.leer('2026.10.30,15:00,1.1,1.2,1.0,1.15,10\nbasura')).toThrow(ErrorDeUsuario);
  });

  it('rechaza un fichero vacío y un máximo menor que el mínimo', () => {
    expect(() => parser.leer('')).toThrow(ErrorDeUsuario);
    expect(() => parser.leer('2026.10.30,15:00,1.1,1.0,1.2,1.15,10')).toThrow(ErrorDeUsuario);
  });
});

describe('ServicioVelas', () => {
  // Operaciones de enero 2026 en EURUSD, en UTC. Entran y salen a precios que están en las velas.
  const inicioBroker = Date.UTC(2026, 0, 5, 0); // 00:00 hora del broker = 22:00 UTC del día anterior
  const velasUtc0 = inicioBroker - 2 * HORA;
  function velaPrecio(utcMs: number): number {
    const i = Math.floor((utcMs - velasUtc0) / HORA);
    return 1.1 + (i % 7) * 0.001;
  }
  const operaciones = Array.from({ length: 15 }, (_, k) => {
    const apertura = Date.UTC(2026, 0, 5, 3) + k * 4 * HORA;
    const cierre = apertura + 2 * HORA;
    return crearOperacion(String(500 + k), {
      aperturaUtc: apertura,
      cierreUtc: cierre,
      precioEntrada: velaPrecio(apertura),
      precioCierre: velaPrecio(cierre),
    });
  });
  const lector: LectorDatos = {
    leerTodo: async (): Promise<DatosGuardados> => ({ operaciones, movimientos: [] }),
  };
  const csv = csvH1(inicioBroker, 24 * 5, 1.1);

  function crear() {
    const repositorio = new RepositorioEnMemoria();
    return { repositorio, servicio: new ServicioVelas(new ParserVelasMt4Csv(), lector, repositorio, TEMPORALIDADES) };
  }
  const opciones = { activo: 'eurusd', temporalidad: 'H1', broker: null, horario, nombreFichero: 'EURUSD60.csv' } as const;

  it('con el horario correcto la comprobación lo da por bueno', async () => {
    const { servicio } = crear();
    const a = await servicio.analizar(csv, opciones);
    expect(a.comprobacion.veredicto).toBe('correcto');
    expect(a.comprobacion.mejorDesfaseHoras).toBe(0);
    expect(a.registro.activo).toBe('EURUSD');
    expect(a.operacionesFueraDeRango).toBe(0);
    expect(a.ventanas).toHaveLength(15);
  });

  it('con el horario equivocado (UTC+3) lo marca como sospechoso y señala el desfase', async () => {
    const { servicio } = crear();
    const a = await servicio.analizar(csv, { ...opciones, horario: { tipo: 'zona', zona: 'Europe/Moscow' } });
    expect(a.comprobacion.veredicto).toBe('sospechoso');
    expect(a.comprobacion.mejorDesfaseHoras).not.toBe(0);
  });

  it('cada ventana incluye las velas de la operación más el margen', async () => {
    const { servicio } = crear();
    const a = await servicio.analizar(csv, opciones);
    const ventana = a.ventanas[0]!;
    const op = operaciones[0]!;
    expect(ventana.velas[0]!.utcMs <= op.aperturaUtc).toBe(true);
    expect(ventana.velas[ventana.velas.length - 1]!.utcMs >= op.cierreUtc!).toBe(true);
    expect(ventana.truncada).toBe(false);
  });

  it('guardar envía solo las ventanas y la carga', async () => {
    const { servicio, repositorio } = crear();
    await servicio.guardar(await servicio.analizar(csv, opciones));
    expect(repositorio.cargas).toHaveLength(1);
    expect(repositorio.ventanas).toHaveLength(15);
  });

  it('rechaza activo vacío y horario inválido', async () => {
    const { servicio } = crear();
    await expect(servicio.analizar(csv, { ...opciones, activo: ' ' })).rejects.toThrow(ErrorDeUsuario);
    await expect(servicio.analizar(csv, { ...opciones, horario: { tipo: 'zona', zona: 'Marte/X' } })).rejects.toThrow(ErrorDeUsuario);
  });
});
