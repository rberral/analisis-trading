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
import { CAMBIO_MONEDAS, COPIA_SEGURIDAD, TEMPORALIDADES, VISUALIZACION_HORAS } from './config/app-config';
import { ProveedorFrankfurter } from './adapters/cambio/frankfurter-proveedor';
import { ServicioCambio } from './services/cambio/servicio-cambio';
import { AlmacenDexie } from './adapters/storage/almacen-dexie';
import { ServicioCopia } from './services/copia/servicio-copia';
import { ServicioVelas } from './services/velas/servicio-velas';
import { PreferenciasNavegador } from './adapters/storage/preferencias-navegador';
import { LectorHorariosDexie } from './adapters/storage/lector-horarios-dexie';
import type { LectorHorarios } from './services/consultas/puertos-horarios';
import { PreferenciaModoHora } from './services/visualizacion/preferencia-modo-hora';
import { LectorDexie } from './adapters/storage/lector-dexie';
import { LectorVentanasDexie } from './adapters/storage/lector-ventanas-dexie';
import type { LectorVentanas } from './services/consultas/puertos-ventanas';
import { AlmacenFiltro } from './services/consultas/almacen-filtro';
import type { LectorDatos } from './services/consultas/puertos';
import { ServicioImportacion } from './services/importacion/importacion-service';

export interface Aplicacion {
  readonly baseDeDatos: Dexie;
  readonly servicioImportacion: ServicioImportacion;
  readonly servicioVelas: ServicioVelas;
  readonly servicioCopia: ServicioCopia;
  /** Conversor de la moneda de la cuenta a euros. */
  readonly servicioCambio: ServicioCambio;
  readonly lectorDatos: LectorDatos;
  readonly lectorVentanas: LectorVentanas;
  readonly lectorHorarios: LectorHorarios;
  /** En qué hora quiere ver las horas el usuario. */
  readonly preferenciaHoras: PreferenciaModoHora;
  /** Filtro elegido por el usuario; se comparte entre pantallas. */
  readonly filtro: AlmacenFiltro;
}

export function crearAplicacion(): Aplicacion {
  const baseDeDatos = abrirBaseDeDatos();
  const repositorio = new RepositorioOperacionesDexie(baseDeDatos);
  const lectorDatos = new LectorDexie(baseDeDatos);
  const preferencias = new PreferenciasNavegador();
  const proveedorCambio = new ProveedorFrankfurter(CAMBIO_MONEDAS.urlApi, CAMBIO_MONEDAS.urlHistorica, CAMBIO_MONEDAS.diasPorConsulta);
  return {
    baseDeDatos,
    servicioCambio: new ServicioCambio(preferencias, proveedorCambio, CAMBIO_MONEDAS),
    servicioImportacion: new ServicioImportacion(crearParsers(), repositorio, { proveedor: proveedorCambio, equivalencias: CAMBIO_MONEDAS.equivalencias }),
    servicioCopia: new ServicioCopia(new AlmacenDexie(baseDeDatos), COPIA_SEGURIDAD),
    servicioVelas: new ServicioVelas(new ParserVelasMt4Csv(), lectorDatos, new RepositorioVelasDexie(baseDeDatos), TEMPORALIDADES),
    lectorDatos,
    lectorVentanas: new LectorVentanasDexie(baseDeDatos),
    lectorHorarios: new LectorHorariosDexie(baseDeDatos),
    preferenciaHoras: new PreferenciaModoHora(
      preferencias,
      VISUALIZACION_HORAS.claveAlmacenamiento,
      VISUALIZACION_HORAS.modos.map((modo) => modo.id),
      VISUALIZACION_HORAS.inicial,
    ),
    filtro: new AlmacenFiltro(),
  };
}
