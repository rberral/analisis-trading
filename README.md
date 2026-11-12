# Análisis Trading

Aplicación web que importa las operaciones de una plataforma de trading (MetaTrader 4 y Quantfury),
calcula estadísticas, analiza errores y estrategia y las dibuja sobre un gráfico de velas.

Funciona **entera en el navegador**: no hay servidor ni base de datos externa. Tus datos se guardan
en el navegador de tu equipo (IndexedDB) y no salen de él. Se publica con GitHub Pages.

Estado actual: **esqueleto** (navegación, configuración, base de datos local y publicación).
Las pantallas se construyen por fases: importación del informe, estadísticas y errores, velas,
MAE/MFE y estrategia, y exportación a Pine Script.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/config/` | `app-config.ts` (única configuración) y `database-config.ts` (esquema de la base de datos, por versiones) |
| `src/models/` | Tipos de datos (operaciones, velas…) |
| `src/controllers/` | Deciden qué pantalla se muestra; solo coordinan |
| `src/views/` | Dibujan las pantallas; sin lógica de negocio |
| `src/services/` | Lógica de negocio (estadísticas, errores, estrategia, importación) |
| `src/adapters/` | Todo lo externo: base de datos, parsers de plataformas, velas, Pine Script |
| `src/core/` | Piezas comunes (navegación, registro de mensajes) |
| `tests/` | Pruebas con Vitest |

Los módulos solo se comunican por su interfaz pública. Cambiar de librería o de plataforma afecta a un único fichero de `adapters/`.

## Instalación y desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install     # instala las dependencias (la primera vez crea package-lock.json: súbelo a GitHub)
npm run dev     # servidor de desarrollo en http://localhost:5173
npm test        # ejecuta las pruebas
npm run build   # comprueba los tipos y genera la carpeta dist/
```

## Importar operaciones (MetaTrader 4)

Al importar hay que elegir el **broker** y la **cuenta** en desplegables: se elige uno ya guardado o se crea uno nuevo («Nuevo broker…», «Nueva cuenta…»; si se deja el nombre de la cuenta vacío se usa el número de cuenta del informe). Al elegir una cuenta existente su moneda queda fijada y se valida que el informe sea en esa misma moneda. Broker + cuenta identifican de dónde vienen los datos: Panel, Operaciones, Errores y Exportar trabajan siempre con una sola cuenta, que se elige en la barra de filtros, porque cada una puede usar una estrategia distinta. Las velas no se separan por broker.

En la pantalla **Importar** eliges el informe HTML (se recomienda el *Detailed Statement*, que incluye totales para validar), indicas el horario del servidor del broker (lista de horarios habituales con su UTC, o una zona/regla propia; no hay ninguno preseleccionado) y la aplicación:

- convierte todas las horas a UTC (sin deducir nada: el horario es obligatorio);
- guarda solo las operaciones nuevas y actualiza las que estaban abiertas y ya se han cerrado;
- recalcula las estadísticas y las compara con las del informe (tabla *Coincide / Diferencia*).

El fichero no se guarda: se lee, se importa y se descarta. Los datos quedan en el navegador (IndexedDB).

Las pruebas usan un informe inventado (`tests/fixtures/informe-mt4.ts`); no subas informes reales al repositorio.

### Importar desde Quantfury (PDF)

Se elige la plataforma **Quantfury (informe PDF)**. Hay tres PDF: el *Informe del historial de trading* (obligatorio) y, opcionales, el *Estado de la cuenta en efectivo* y el *Estado de la cuenta de trading* (en la pantalla se explica cómo descargar cada uno; se comprueba por su título que cada fichero está en su sitio). Con los tres se conoce el saldo de la cuenta; ver «Saldo» más abajo. El PDF se lee en el navegador con `pdf.js` (se carga solo al importar un PDF; el fichero no sale del navegador). Cada **posición** (apertura, ampliaciones, reducciones y cierre, hasta su fila «Total») se guarda como una operación: apertura = primera fila, cierre = última, precio de entrada y de salida = medias ponderadas por cantidad, resultado = el «Total» del informe. Las posiciones de «Posiciones Abiertas» se guardan como abiertas (sin resultado). El identificador es `ACTIVO-fechaDeApertura`, porque Quantfury no numera las posiciones; así una posición abierta se cierra sola al importar un PDF posterior. Las horas están en UTC (no se pregunta el horario).

El informe mezcla monedas (USDT, USD, EUR, JPY…) y la aplicación exige una moneda por cuenta: se escribe la **moneda de la cuenta** al importar y el resultado de las operaciones en otras monedas se convierte con el **cambio del día de cierre** del Banco Central Europeo (Frankfurter, solo al importar; USDT cuenta como USD, ver `CAMBIO_MONEDAS.equivalencias`). Se guarda también el importe original, la moneda original y el cambio aplicado. Sin conexión, la aplicación pide un cambio fijo por moneda. Las cifras de comprobación (número de posiciones y resultado) se comparan con los importes originales del PDF. Quantfury no informa de stop loss ni take profit: no se analizan y todas las operaciones se marcan como cierre **manual**, salvo las de break even (resultado menor del 0,1 % del saldo al abrir, igual que en MetaTrader), que solo se detectan si el saldo se conoce. La «Cuenta» no viene en el PDF, así que se escribe a mano.

**Saldo (Quantfury).** El estado de efectivo da cada traspaso con su hora y el de trading da los dividendos (los de euros se convierten al cambio del día), las recompensas, los ingresos y retiradas de cada año (sin hora), el saldo actual y las ganancias no realizadas. El saldo en efectivo (sin apalancamiento) es: traspasos + dividendos + recompensas + resultado de lo cerrado. Los totales anuales solo se usan en los años sin traspasos con hora, para no contar dos veces el mismo dinero (`movimientos-vigentes.ts`). Sin ingresos conocidos no hay saldo y el break even queda desactivado, también en el script de TradingView. Las **ganancias no realizadas** y el **apalancamiento** son solo informativos: ningún cálculo los usa. El Panel muestra una tarjeta «Cuenta» con el saldo y compara el calculado con el que da el estado de trading (con una tolerancia, `SALDO_CUENTA`, por los cambios de moneda). Los estados de cuenta van en dólares, así que la cuenta debe ser en USD.

**Apalancamiento.** Al importar (de cualquier plataforma) se puede indicar el apalancamiento de la cuenta. Se guarda en el registro de importación y solo se muestra. Las pruebas usan un fragmento con el nombre cambiado (`tests/fixtures/quantfury-informe.ts`).

## Velas y ficheros (MetaTrader 4)

En **Velas y ficheros** cargas el CSV de velas que exporta MetaTrader 4 (Centro de historial). Hay que indicar el activo, la temporalidad y el horario del servidor del broker (obligatorio; el broker es opcional). Antes de guardar, la aplicación comprueba que el horario es el correcto: mira si el precio de entrada y de salida de tus operaciones está dentro de la vela de ese momento y lo repite con desfases de -3 a +3 horas, para que veas cuál encaja mejor. No corrige nada sola.

El fichero de velas **no se guarda**: solo se conservan, para cada operación cerrada, las velas de su duración más 20 antes y 20 después (como máximo 3 000). Los parámetros están en `VELAS` (`src/config/app-config.ts`).

## Detalle de operación, recorrido y perfil

Pulsando el ticket en **Operaciones** se abre el detalle: datos de la operación y, si has cargado velas, un gráfico con entrada, salida, stop loss y take profit (Lightweight Charts, horas en UTC). Con las velas se calcula:

- **Recorrido del precio (MFE/MAE):** máximo a favor y en contra, y qué parte del camino hasta el TP y el SL llegó a recorrer. Es un mínimo: solo cuentan las velas completas dentro de la operación, más los precios de entrada y salida.
- **Qué pasó después de cerrar a mano** una operación con take profit (si llegó al TP o al SL en las velas guardadas posteriores). Con esto, **Errores y consejos** detecta las salidas anticipadas.
- **Perfil de tu operativa** en el Panel: estilo (scalping, intradía, swing), sesiones, uso de SL y TP, relación objetivo/riesgo y desde dónde entras respecto a las últimas velas. Describe lo que muestran los datos; no pone etiquetas de estrategia. Criterios en `ESTRATEGIA` (`src/config/app-config.ts`).

Para probar la versión de producción (con la política de seguridad activa) en local: `npm run build` y `npm run preview`.

## Horas

Todas las horas se guardan en **UTC**: al importar un informe o cargar velas se convierten con el horario del servidor del broker que eliges. En el menú lateral, **Mostrar horas en** permite verlas en UTC (por defecto), en hora del broker (como en MetaTrader) o en hora de España; solo cambia la visualización y la elección se recuerda en el navegador. Los periodos de los filtros siempre se cuentan en UTC.

## Moneda y conversor a euros

Cada cuenta guarda su moneda (USD, EUR…), que se toma del informe de MetaTrader o se indica al importar si el informe no la trae; no se pueden mezclar monedas en una misma cuenta. En Panel, Operaciones y Errores aparece una tarjeta con la moneda de la cuenta y un **conversor a euros** orientativo (por defecto, el resultado neto del filtro). El cambio se puede **escribir a mano** o consultar con «Actualizar (BCE)», que pide el cambio del día a la API pública gratuita de Frankfurter (datos del Banco Central Europeo) solo cuando pulsas el botón; el cambio se recuerda en el navegador. La URL está en `CAMBIO_MONEDAS` (configuración) y la política de seguridad de la versión publicada permite únicamente esa conexión. Los datos guardados no se convierten.

## Velas: qué se guarda

Al cargar un fichero de velas **no se guarda entero**: solo un fragmento de velas (margen antes y después) por cada operación cerrada del activo que existe en ese momento. Por eso, las operaciones que importes después no tendrán velas hasta que vuelvas a cargar el fichero de velas de su activo; la aplicación lo avisa al terminar una importación. La copia de seguridad incluye esos fragmentos (se puede excluir con «Incluir las velas guardadas» para que el fichero sea ligero).

## Copia de seguridad y borrado

**Copia de seguridad** exporta todos los datos (operaciones, movimientos, importaciones, velas y brokers) a un fichero JSON (`analisis-trading_copia_AAAA-MM-DD.json`) y los importa de nuevo. Al importar se **fusiona** con lo que ya hay: no se borra nada, las filas con el mismo id se actualizan y una operación ya cerrada no vuelve a abierta. Cada exportación genera un fichero nuevo (el navegador no puede sobrescribir un fichero del disco por su cuenta). La misma pantalla permite **borrar** todos los datos o solo los de una cuenta (broker + cuenta), escribiendo `BORRAR` para confirmar; al borrar una cuenta se conservan las demás y, salvo que marques «Borrar también las velas de esas operaciones», también las velas (así, si reimportas esa cuenta, recupera sus velas sin recargar los ficheros); «Solo las velas» borra únicamente las velas. Los ajustes de pantalla se conservan siempre.

## Sobre la aplicación

La sección **Sobre la aplicación** del menú explica, para quien la ve por primera vez, qué hace cada apartado y en qué orden usarlos.

## Exportar a TradingView

La pantalla **Exportar a TradingView** usa los mismos filtros (periodo, año, activo, cierre) y genera un script Pine v6 por activo, que dibuja cada operación (zonas de TP y SL, entrada, SL movido, salida y tabla de estadísticas). Pasos: elige filtros, ajusta el nombre del activo en TradingView si difiere (p. ej. SP500 → SPX), descarga el `.pine`, pégalo en el Editor de Pine del gráfico de ese activo y pulsa «Añadir al gráfico».

- **Nombre del fichero:** `PERIODO_ACTIVO.pine` (`Total`, `2026`, `2026-T1`, `2026-03` o `2026-01-01_2026-03-15`); si filtras por cierre se añade `_TP`, `_SL`, `_BE` o `_Manual`, y `_parteXdeN` si hay varias partes.
- **Límite:** Pine admite 500 cajas/líneas/etiquetas por script; con 2 de cada por operación caben 250 (`EXPORTACION_TRADINGVIEW` en la configuración). Si un activo tiene más, se reparte en partes (parte 1 de N…) que se añaden como indicadores distintos.
- **Horas:** el script lleva marcas de tiempo UTC absolutas, así que las operaciones caen siempre en su vela; el eje horario lo decide TradingView (Ajustes del gráfico → Zona horaria). «Horas de las etiquetas» solo cambia los textos de los tooltips (UTC, hora del broker u hora de España).
- **Precios:** son los de tu broker; el gráfico de TradingView puede diferir unos pips.

## Panel, Operaciones y Errores

Las tres pantallas comparten una barra de filtros: periodo (total, año, trimestre, mes o rango de fechas), activo y, si hay varias, cuenta. El filtro **Cierre** clasifica por resultado, no por la etiqueta de MetaTrader (que llama «stop loss» también a los stops movidos a beneficio): Take profit (cierre automático con ganancia), Stop loss (con pérdida), Break even (resultado neto menor al 0,1 % del saldo de la cuenta al abrir; tiene prioridad sobre Manual; `CLASIFICACION_CIERRE` en la configuración) y Manual. Los periodos se cuentan en UTC según la hora de **cierre** de la operación, y el drawdown se calcula dentro del periodo elegido, partiendo del balance que había al empezar.

Errores detectados solo con el informe (umbrales en `src/config/app-config.ts`): operaciones sin stop loss, pérdidas desproporcionadas, subir lotes tras perder, sobreoperación diaria y perdedoras más largas que las ganadoras.

## Variables de entorno

Ninguna. Al ser una web estática no hay secretos: todo el código y la configuración son públicos.
Nunca escribas claves ni contraseñas en el código. Si en el futuro hiciera falta una API con clave,
habría que usar un servidor intermedio.

## Despliegue en GitHub Pages

1. Sube el proyecto a un repositorio de GitHub, incluido `package-lock.json`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada subida a la rama `main` ejecuta las pruebas, compila y publica la web (`.github/workflows/desplegar.yml`).
4. La web quedará en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPOSITORIO/`.

En el plan gratuito la web publicada es pública aunque el repositorio sea privado. Tus datos no lo son:
cada persona solo ve los que están en su propio navegador.

## Tus datos

- Viven solo en el navegador donde uses la aplicación. Si borras los datos del sitio, se pierden.
- Habrá una pantalla de **copia de seguridad** para exportar e importar todo en un fichero. Úsala con regularidad.
- Los ficheros que subas (informes, velas) se procesan y se descartan; no se guardan.

## Seguridad

- El contenido de los ficheros importados nunca se inserta como HTML en la página (protección contra XSS).
- La versión publicada incluye una política de seguridad de contenido que solo permite código de la propia web.
- Activa **Secret scanning** y **Push protection** en GitHub (*Settings → Code security*), aunque el proyecto no use secretos.
