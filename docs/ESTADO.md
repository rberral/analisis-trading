# Estado del proyecto (para retomarlo)

Última actualización: 2026-11-12

## Qué es
Análisis Trading: web estática (TypeScript + Vite, sin framework; Dexie, Lightweight Charts, Vitest) publicada en GitHub Pages. Sin roles ni permisos. Los datos viven en el navegador (IndexedDB) de cada usuario. Los ficheros subidos no se guardan.

## Decisiones tomadas
- Todas las horas se guardan en UTC. El horario del servidor del broker lo elige el usuario al subir cada fichero (zona con nombre o regla «Nueva York + N horas»); no se deduce nada ni hay valor por defecto.
- ID de operación = `cuenta:ticket`. Reimportar no duplica; una abierta que ya está cerrada se actualiza.
- Cada importación guarda una foto del SL/TP de las operaciones abiertas (sirve para detectar movimientos de SL; el informe solo da el SL final).
- Velas: el fichero NO se guarda; solo las ventanas de velas por operación y los resultados derivados. El formulario pide activo, temporalidad, horario UTC del broker y broker (opcional).
- Periodos en UTC por hora de cierre; el drawdown se calcula dentro del periodo.
- Informe a usar: el *Detailed Statement* de MT4 (trae totales para validar).

## Hecho
1. Esqueleto, despliegue en GitHub Pages, menú y rutas.
2. Importar informe MT4 con validación de totales (las 25 cifras coinciden con el informe real).
3. Panel, Operaciones y Errores y consejos, con filtros por periodo, activo y cuenta. Errores solo con el informe: sin stop loss, aperturas erróneas (sin SL cerradas en < 5 min), pérdidas desproporcionadas, subir lotes tras perder, sobreoperación, perdedoras más largas que ganadoras. Umbrales en `src/config/app-config.ts`.

4. Velas: carga del CSV de MT4 (activo, temporalidad, horario, broker opcional), comprobación del horario con desfases -3..+3 h (no corrige sola), y guardado solo de las ventanas de velas por operación cerrada (IndexedDB v3). Pantalla «Velas y ficheros» con la lista de cargas.
5. Detalle de operación (gráfico con Lightweight Charts, ruta `#/operaciones/<id>`), MFE/MAE, qué pasó tras cerrar a mano, salidas anticipadas en Errores y perfil de la operativa en el Panel. Pendiente de verificar en navegador: el gráfico (la librería no se pudo probar en el contenedor) y que funcione con la CSP de producción (`npm run build` + `npm run preview`).

Cambios tras las pruebas del usuario (12-nov): gráfico centrado y con 5 decimales; filtro «Cierre» (Take profit / Stop loss / Break even / Manual por resultado, umbral 0,01 %); lista de horarios predefinidos sin valor por defecto (Europa del Este = Europe/Athens, UTC+2 y UTC+3 en verano, es el broker del usuario). Selector «Mostrar horas en» (UTC por defecto / hora del broker / hora de España) en el menú lateral, recordado en el navegador; todo se guarda siempre en UTC. Notas informativas sobre las horas y sobre la regla de clasificación del cierre.

6. Exportar a TradingView (12-nov): pantalla `/exportar` con filtros Periodo/Año/Activo/Cierre, selector de horas de las etiquetas, símbolo de TradingView por activo, un script Pine v6 por activo (plantilla adaptada de Load_Operativas_to_TD en `src/services/exportacion/plantilla-pine.ts`), partes de hasta 250 operaciones, datos en trozos de 3500 caracteres y manual. Timestamps en UTC absoluto (TradingView los muestra en la zona del gráfico); el desfase de las etiquetas va por operación. Validado con el validador de Pine de TradingView (sin errores). Pendiente: probarlo en un gráfico real.
Regla de Break Even cambiada a la del proyecto de TradingView: |neto| < 0,1 % del saldo al abrir, con prioridad sobre Manual.

7. Separación por broker + cuenta (12-nov): importar exige broker y admite nombre de cuenta; id de operación `broker:cuenta:ticket`; esquema IndexedDB v4; la barra de filtros elige una cuenta (no hay «todas»); el saldo al abrir y la clasificación van por cuenta. Los datos anteriores (sin broker) se agrupan como «Sin asignar»: se recomienda borrarlos y reimportar. Las velas no se separan por broker.

8. Copia de seguridad y borrado (12-nov): pantalla `/copia` (exportar JSON de todas las tablas, importar fusionando, borrar todo o una cuenta con confirmación escrita). Servicio `ServicioCopia` + adaptador `AlmacenDexie`; formato versionado en `COPIA_SEGURIDAD`. Pendiente de probar en navegador.

9. Moneda y conversor a euros (12-nov): la moneda (del informe o indicada) se guarda con operaciones, movimientos e importaciones; no se mezclan monedas en una cuenta. Tarjeta con conversor orientativo a EUR en Panel/Operaciones/Errores; cambio manual o automático (Frankfurter/BCE, solo al pulsar), recordado en localStorage; CSP de producción permite solo ese origen. No se pudo probar la API desde el contenedor (sin red): verificar en el navegador.

10. Velas y borrado (12-nov): aviso tras importar de operaciones cerradas sin velas (por activo); casilla «Incluir las velas guardadas» al exportar la copia; borrar: Todo / Solo las velas / una cuenta (con casilla «Borrar también las velas de esas operaciones», desmarcada por defecto; al marcarla se recuentan o quitan los registros de ficheros cargados). Las velas se guardan por operación (id broker:cuenta:ticket), no el fichero entero: las operaciones nuevas necesitan recargar el fichero de velas.

## Pendiente (hoja de ruta)


Otros pendientes menores: lista de importaciones anteriores en Importar; resolver horas ambiguas/inexistentes por cambio de horario (hoy solo avisos); actualizar maquetas (quitar el correo de la cabecera, añadir Copia de seguridad).

## Datos de velas (hallazgos)
- El H1 trae un reloj distinto al del informe (+2 h en invierno, +1 h en verano); M5 y M30 coinciden con el del informe.
- El History Center de MT4 limita a 65 000 barras.

## Cómo probar en local
`npm install`, `npm test`, `npm run dev`. No subas informes reales al repositorio (es público): los tests usan `tests/fixtures/informe-mt4.ts`.

## 11. Estilo del Panel
El estilo se calcula con la duración de cada operación (apertura → cierre) de las operaciones filtradas. Es swing si el % de operaciones de un día o más alcanza `ESTRATEGIA.swingPorcentajeMinimo` (30 %); si no, manda la mediana (scalping < 15 min, intradía < 1 día). El Panel muestra además el reparto de duraciones.
