/**
 * Único sitio donde se crean los objetos concretos y se conectan entre sí.
 * El resto del código recibe lo que necesita ya construido.
 */
import type Dexie from 'dexie';
import { crearParsers } from './adapters/statement-parsers/registro-parsers';
import { abrirBaseDeDatos } from './adapters/storage/base-de-datos';
import { RepositorioOperacionesDexie } from './adapters/storage/operaciones-repositorio';
import { ParserVelasMt4Csv } from './adapters/candle-parsers/mt4-csv-parser';
import { RepositorioVelasDexie } from './adapters/storage/velas-repositorio';
import { TEMPORALIDADES } from './config/app-config';
import { ServicioVelas } from './services/velas/servicio-velas';
import { LectorDexie } from './adapters/storage/lector-dexie';
import { AlmacenFiltro } from './services/consultas/almacen-filtro';
import type { LectorDatos } from './services/consultas/puertos';
import { ServicioImportacion } from './services/importacion/importacion-service';

export interface Aplicacion {
  readonly baseDeDatos: Dexie;
  readonly servicioImportacion: ServicioImportacion;
  readonly servicioVelas: ServicioVelas;
  readonly lectorDatos: LectorDatos;
  /** Filtro elegido por el usuario; se comparte entre pantallas. */
  readonly filtro: AlmacenFiltro;
}

export function crearAplicacion(): Aplicacion {
  const baseDeDatos = abrirBaseDeDatos();
  const repositorio = new RepositorioOperacionesDexie(baseDeDatos);
  const lectorDatos = new LectorDexie(baseDeDatos);
  return {
    baseDeDatos,
    servicioImportacion: new ServicioImportacion(crearParsers(), repositorio),
    servicioVelas: new ServicioVelas(new ParserVelasMt4Csv(), lectorDatos, new RepositorioVelasDexie(baseDeDatos), TEMPORALIDADES),
    lectorDatos,
    filtro: new AlmacenFiltro(),
  };
}
