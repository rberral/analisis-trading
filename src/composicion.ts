/**
 * Único sitio donde se crean los objetos concretos y se conectan entre sí.
 * El resto del código recibe lo que necesita ya construido.
 */
import type Dexie from 'dexie';
import { crearParsers } from './adapters/statement-parsers/registro-parsers';
import { abrirBaseDeDatos } from './adapters/storage/base-de-datos';
import { RepositorioOperacionesDexie } from './adapters/storage/operaciones-repositorio';
import { LectorDexie } from './adapters/storage/lector-dexie';
import { AlmacenFiltro } from './services/consultas/almacen-filtro';
import type { LectorDatos } from './services/consultas/puertos';
import { ServicioImportacion } from './services/importacion/importacion-service';

export interface Aplicacion {
  readonly baseDeDatos: Dexie;
  readonly servicioImportacion: ServicioImportacion;
  readonly lectorDatos: LectorDatos;
  /** Filtro elegido por el usuario; se comparte entre pantallas. */
  readonly filtro: AlmacenFiltro;
}

export function crearAplicacion(): Aplicacion {
  const baseDeDatos = abrirBaseDeDatos();
  const repositorio = new RepositorioOperacionesDexie(baseDeDatos);
  return {
    baseDeDatos,
    servicioImportacion: new ServicioImportacion(crearParsers(), repositorio),
    lectorDatos: new LectorDexie(baseDeDatos),
    filtro: new AlmacenFiltro(),
  };
}
