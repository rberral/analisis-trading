import type { CuentaConMoneda } from '../services/consultas/cuentas';
import { crearElemento } from './dom';

export interface DatosBrokerCuenta {
  readonly broker: string;
  readonly cuenta: string;
  readonly moneda: string;
}

export interface CampoBrokerCuenta {
  readonly elemento: HTMLElement;
  /** Cuentas ya guardadas, para poder elegirlas en los desplegables. */
  cargar(cuentas: readonly CuentaConMoneda[]): void;
  leer(): DatosBrokerCuenta;
  /** Texto de error si falta elegir o escribir algo; null si todo está bien. */
  validar(): string | null;
}

/** Valor del desplegable que significa «crear uno nuevo». */
const NUEVO = '__nuevo__';
const SIN_ELEGIR = '';

const campo = (etiqueta: string, control: HTMLElement) => crearElemento('label', { class: 'campo' }, [etiqueta, control]);
const opcion = (valor: string, texto: string) => crearElemento('option', { value: valor }, [texto]);

/**
 * Broker y cuenta: se elige uno guardado o se crea uno nuevo. Al elegir una cuenta que ya existe,
 * su moneda queda fijada: no se pueden mezclar monedas en una misma cuenta.
 */
export function crearCampoBrokerCuenta(): CampoBrokerCuenta {
  let cuentas: readonly CuentaConMoneda[] = [];

  const selectorBroker = crearElemento('select', { name: 'broker' }) as HTMLSelectElement;
  const campoBrokerNuevo = crearElemento('input', { type: 'text', name: 'broker nuevo', placeholder: 'Nombre del nuevo broker (por ejemplo IC Markets)', maxlength: '60' }) as HTMLInputElement;
  const selectorCuenta = crearElemento('select', { name: 'cuenta' }) as HTMLSelectElement;
  const campoCuentaNueva = crearElemento('input', { type: 'text', name: 'cuenta nueva', placeholder: 'Nombre de la cuenta (vacío = número de cuenta del informe)', maxlength: '60' }) as HTMLInputElement;
  const campoMoneda = crearElemento('input', { type: 'text', name: 'moneda', placeholder: 'Por defecto, la del informe (por ejemplo USD)', maxlength: '3' }) as HTMLInputElement;
  const notaMoneda = crearElemento('p', { class: 'texto-suave' }, ['Los informes de MetaTrader traen la moneda (USD, EUR…) y se usa sola; solo escríbela si el informe no la incluye.']);

  const cuentasDe = (broker: string) => cuentas.filter((c) => c.broker === broker);
  const cuentaElegida = () => cuentasDe(selectorBroker.value).find((c) => c.cuenta === selectorCuenta.value) ?? null;

  function pintarMoneda(): void {
    const existente = cuentaElegida();
    if (existente && existente.moneda !== '') {
      campoMoneda.value = existente.moneda;
      campoMoneda.disabled = true;
      notaMoneda.replaceChildren(`Esta cuenta ya está en ${existente.moneda}: el informe tiene que ser en esa moneda.`);
      return;
    }
    if (campoMoneda.disabled) campoMoneda.value = '';
    campoMoneda.disabled = false;
    notaMoneda.replaceChildren('Los informes de MetaTrader traen la moneda (USD, EUR…) y se usa sola; solo escríbela si el informe no la incluye.');
  }

  function pintarCuentas(): void {
    const broker = selectorBroker.value;
    campoBrokerNuevo.hidden = broker !== NUEVO;
    if (broker === SIN_ELEGIR) {
      selectorCuenta.replaceChildren(opcion(SIN_ELEGIR, 'Elige primero un broker'));
    } else if (broker === NUEVO) {
      selectorCuenta.replaceChildren(opcion(NUEVO, 'Nueva cuenta'));
    } else {
      selectorCuenta.replaceChildren(
        opcion(SIN_ELEGIR, 'Elige una cuenta…'),
        ...cuentasDe(broker).map((c) => opcion(c.cuenta, c.moneda === '' ? c.cuenta : `${c.cuenta} (${c.moneda})`)),
        opcion(NUEVO, 'Nueva cuenta…'),
      );
    }
    selectorCuenta.disabled = broker === SIN_ELEGIR || broker === NUEVO;
    pintarCuentaNueva();
  }

  function pintarCuentaNueva(): void {
    campoCuentaNueva.hidden = selectorCuenta.value !== NUEVO;
    pintarMoneda();
  }

  function pintarBrokers(): void {
    const brokers = [...new Set(cuentas.map((c) => c.broker))].sort((a, b) => a.localeCompare(b));
    const anterior = selectorBroker.value;
    selectorBroker.replaceChildren(
      ...(brokers.length > 0 ? [opcion(SIN_ELEGIR, 'Elige un broker…')] : []),
      ...brokers.map((b) => opcion(b, b)),
      opcion(NUEVO, 'Nuevo broker…'),
    );
    // Sin brokers guardados solo se puede crear uno; con ellos se conserva lo elegido si sigue existiendo.
    selectorBroker.value = brokers.length === 0 ? NUEVO : brokers.includes(anterior) || anterior === NUEVO ? anterior : SIN_ELEGIR;
    pintarCuentas();
  }

  selectorBroker.addEventListener('change', pintarCuentas);
  selectorCuenta.addEventListener('change', pintarCuentaNueva);
  pintarBrokers();

  const elemento = crearElemento('div', { class: 'formulario' }, [
    crearElemento('h3', {}, ['Broker y cuenta']),
    crearElemento('p', { class: 'aviso' }, [
      'Broker + cuenta identifican de dónde vienen tus datos, y cada combinación se analiza por separado (Panel, Operaciones, Errores y Exportar). Es importante porque cada cuenta puede usar una estrategia distinta: mezclarlas falsearía las estadísticas, el saldo, el drawdown, el break even y la detección de errores. Elige un broker y una cuenta ya guardados para añadirles datos, o crea nuevos; si escribes un nombre distinto se guardará como otra cuenta.',
    ]),
    campo('Broker', selectorBroker),
    campoBrokerNuevo,
    campo('Cuenta', selectorCuenta),
    campoCuentaNueva,
    campo('Moneda de la cuenta (opcional)', campoMoneda),
    notaMoneda,
  ]);

  return {
    elemento,
    cargar(nuevas) {
      cuentas = nuevas;
      pintarBrokers();
    },
    leer() {
      return {
        broker: selectorBroker.value === NUEVO ? campoBrokerNuevo.value : selectorBroker.value,
        cuenta: selectorCuenta.value === NUEVO ? campoCuentaNueva.value : selectorCuenta.value,
        moneda: campoMoneda.value,
      };
    },
    validar() {
      if (selectorBroker.value === SIN_ELEGIR) return 'Elige un broker o crea uno nuevo.';
      if (selectorBroker.value === NUEVO && campoBrokerNuevo.value.trim() === '') return 'Escribe el nombre del nuevo broker.';
      if (selectorCuenta.value === SIN_ELEGIR) return 'Elige una cuenta o crea una nueva.';
      return null;
    },
  };
}
