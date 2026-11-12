/**
 * Copia de seguridad (exportar e importar todos los datos) y borrado del histórico.
 * Código puro: el acceso al navegador está detrás de AlmacenDatos.
 */
import { ErrorDeUsuario } from '../../core/errores';
import { claveCuenta, mismaCuenta, type CuentaTrading } from '../../models/cuenta';
import { NOMBRES_TABLAS, type AlmacenDatos, type Fila, type NombreTabla, type TablasCopia } from './puertos';

export interface ConfiguracionCopia {
  readonly formato: string;
  readonly version: number;
}

export interface CopiaSeguridad {
  readonly formato: string;
  readonly version: number;
  readonly fechaMs: number;
  readonly tablas: TablasCopia;
}

export interface ResumenDatos {
  readonly operaciones: number;
  readonly importaciones: number;
  readonly ventanasVelas: number;
  readonly cuentas: ReadonlyArray<{ readonly cuenta: CuentaTrading; readonly operaciones: number }>;
}

export interface ResultadoImportacionCopia {
  /** Filas que traía la copia, por tabla. */
  readonly filas: Readonly<Record<NombreTabla, number>>;
  readonly operacionesNuevas: number;
}

export type AlcanceBorrado = { readonly tipo: 'todo' } | { readonly tipo: 'cuenta'; readonly cuenta: CuentaTrading };

const esObjeto = (valor: unknown): valor is Record<string, unknown> => typeof valor === 'object' && valor !== null && !Array.isArray(valor);

export class ServicioCopia {
  constructor(
    private readonly almacen: AlmacenDatos,
    private readonly configuracion: ConfiguracionCopia,
  ) {}

  async resumen(): Promise<ResumenDatos> {
    const tablas = await this.almacen.leerTablas();
    const porCuenta = new Map<string, { cuenta: CuentaTrading; operaciones: number }>();
    for (const fila of tablas.operaciones) {
      const cuenta = { broker: String(fila['broker']), cuenta: String(fila['cuenta']) };
      const actual = porCuenta.get(claveCuenta(cuenta));
      porCuenta.set(claveCuenta(cuenta), { cuenta, operaciones: (actual?.operaciones ?? 0) + 1 });
    }
    const cuentas = [...porCuenta.values()].sort((a, b) => a.cuenta.broker.localeCompare(b.cuenta.broker) || a.cuenta.cuenta.localeCompare(b.cuenta.cuenta));
    return {
      operaciones: tablas.operaciones.length,
      importaciones: tablas.importaciones.length,
      ventanasVelas: tablas.ventanasVelas.length,
      cuentas,
    };
  }

  async exportar(fechaMs: number): Promise<CopiaSeguridad> {
    return { formato: this.configuracion.formato, version: this.configuracion.version, fechaMs, tablas: await this.almacen.leerTablas() };
  }

  /** Lee y valida el texto de una copia, la fusiona con lo que ya hay y guarda. No borra nada de lo existente. */
  async importar(texto: string): Promise<ResultadoImportacionCopia> {
    const copia = this.leerCopia(texto);
    const existentes = await this.almacen.leerTablas();
    const idsExistentes = new Map(existentes.operaciones.map((o) => [o.id, o]));

    // Una operación ya cerrada aquí no vuelve a abierta por una copia más antigua.
    const operaciones = copia.tablas.operaciones.filter((o) => !(idsExistentes.get(o.id)?.['cierreUtc'] != null && o['cierreUtc'] == null));
    await this.almacen.guardarTablas({ ...copia.tablas, operaciones });

    const filas = Object.fromEntries(NOMBRES_TABLAS.map((nombre) => [nombre, copia.tablas[nombre].length])) as Record<NombreTabla, number>;
    return { filas, operacionesNuevas: copia.tablas.operaciones.filter((o) => !idsExistentes.has(o.id)).length };
  }

  async borrar(alcance: AlcanceBorrado): Promise<void> {
    if (alcance.tipo === 'todo') {
      await this.almacen.vaciarTodo();
      return;
    }
    const tablas = await this.almacen.leerTablas();
    const deLaCuenta = (fila: Fila) => mismaCuenta({ broker: String(fila['broker']), cuenta: String(fila['cuenta']) }, alcance.cuenta);
    const idsOperaciones = new Set(tablas.operaciones.filter(deLaCuenta).map((o) => o.id));
    const idsImportaciones = new Set(tablas.importaciones.filter(deLaCuenta).map((i) => i.id));

    await this.almacen.eliminar('operaciones', [...idsOperaciones]);
    await this.almacen.eliminar('movimientos', tablas.movimientos.filter(deLaCuenta).map((m) => m.id));
    await this.almacen.eliminar('importaciones', [...idsImportaciones]);
    await this.almacen.eliminar('instantaneasAbiertas', tablas.instantaneasAbiertas.filter(deLaCuenta).map((i) => i.id));
    // Las velas de esas operaciones ya no sirven; los ficheros de velas cargados (que no son de un broker) se conservan.
    await this.almacen.eliminar('ventanasVelas', tablas.ventanasVelas.filter((v) => idsOperaciones.has(String(v['operacionId']))).map((v) => v.id));
  }

  private leerCopia(texto: string): CopiaSeguridad {
    let datos: unknown;
    try {
      datos = JSON.parse(texto);
    } catch {
      throw new ErrorDeUsuario('El fichero no es una copia de seguridad válida (no se puede leer).');
    }
    if (!esObjeto(datos) || datos['formato'] !== this.configuracion.formato) {
      throw new ErrorDeUsuario('El fichero no es una copia de seguridad de esta aplicación.');
    }
    const version = datos['version'];
    if (typeof version !== 'number' || version > this.configuracion.version) {
      throw new ErrorDeUsuario('La copia es de una versión más nueva de la aplicación. Actualiza la aplicación y vuelve a intentarlo.');
    }
    const tablasLeidas = datos['tablas'];
    if (!esObjeto(tablasLeidas)) throw new ErrorDeUsuario('La copia no contiene datos.');

    const tablas = {} as TablasCopia;
    for (const nombre of NOMBRES_TABLAS) {
      const filas = tablasLeidas[nombre];
      if (!Array.isArray(filas) || !filas.every((fila) => esObjeto(fila) && typeof fila['id'] === 'string')) {
        throw new ErrorDeUsuario(`La copia está dañada: la tabla «${nombre}» no es correcta.`);
      }
      tablas[nombre] = filas as Fila[];
    }
    const sinBroker = [...tablas.operaciones, ...tablas.movimientos, ...tablas.importaciones].some((f) => typeof f['broker'] !== 'string' || typeof f['cuenta'] !== 'string');
    if (sinBroker) throw new ErrorDeUsuario('La copia es de una versión antigua sin broker y cuenta. Impórtala de nuevo desde los informes.');
    return { formato: this.configuracion.formato, version, fechaMs: Number(datos['fechaMs']) || 0, tablas };
  }
}
