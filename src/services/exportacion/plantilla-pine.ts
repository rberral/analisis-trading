/**
 * Plantilla del script Pine v6, adaptada del proyecto Load_Operativas_to_TD.
 * Las marcas @@NOMBRE@@ las sustituye generador-pine.ts. Pine no puede leer ficheros, así que los
 * datos viajan dentro del script como texto (ver generador-pine.ts).
 * Todo el dibujo ocurre en barstate.islast; el límite de Pine es 500 cajas/líneas/etiquetas por script.
 */
export const PLANTILLA_PINE = String.raw`//@version=6
// Generado por «Análisis Trading» desde un Detailed Statement de MetaTrader 4
// Activo: @@SIMBOLO@@ (@@ACTIVO@@) | Operaciones: @@TOTAL@@ | @@PARTE@@
// Filtros aplicados en la aplicación: @@FILTROS@@
// Las marcas de tiempo son UTC absolutas: TradingView las coloca bien en cualquier zona horaria del gráfico.
// Los textos de los tooltips usan: @@ETIQUETA_HORA@@.
indicator("Análisis · @@SIMBOLO@@ · @@PARTE_CORTA@@", overlay = true, max_boxes_count = 500, max_lines_count = 500, max_labels_count = 500)

// ===== CONSTANTES =====
MAX_OPERACIONES = @@MAX_OPERACIONES@@ // 2 cajas por operación y 500 cajas como máximo en Pine

GRUPO_PERIODO = "1. Periodo"
GRUPO_TIPO = "2. Tipo de cierre y dirección"
GRUPO_BE = "3. Break-even (BE)"
GRUPO_CAJA = "4. Cajas y etiquetas"
GRUPO_TABLA = "5. Tabla de estadísticas"
GRUPO_COLORES = "6. Colores"

// ===== INPUTS =====
todoHistorico = input.bool(true, "Todo el histórico", group = GRUPO_PERIODO, tooltip = "Activo: se ignoran las fechas y se muestran las últimas operaciones. Desactívalo para usar fecha inicio y fin.")
fechaDesde = input.time(timestamp("01 Jan 2023 00:00 +0000"), "Fecha inicio", group = GRUPO_PERIODO, tooltip = "Solo operaciones abiertas a partir de esta fecha (si 'Todo el histórico' está desactivado).")
fechaHasta = input.time(timestamp("01 Jan 2100 00:00 +0000"), "Fecha fin", group = GRUPO_PERIODO, tooltip = "Solo operaciones abiertas hasta esta fecha (si 'Todo el histórico' está desactivado).")

verTP = input.bool(true, "TP", group = GRUPO_TIPO, tooltip = "Operaciones cerradas por Take Profit.")
verSL = input.bool(true, "SL", group = GRUPO_TIPO, tooltip = "Operaciones cerradas por Stop Loss (incluye SL movido).")
verBE = input.bool(true, "BE", group = GRUPO_TIPO, tooltip = "Operaciones con resultado dentro del umbral de break-even.")
verManual = input.bool(true, "Manual", group = GRUPO_TIPO, tooltip = "Operaciones cerradas a mano.")
verAbiertas = input.bool(true, "Abiertas", group = GRUPO_TIPO, tooltip = "Operaciones que siguen abiertas (no cuentan en la tabla).")
direccionFiltro = input.string("Todas", "Dirección", options = ["Todas", "Compras", "Ventas"], group = GRUPO_TIPO, tooltip = "Muestra todas las operaciones, solo compras o solo ventas.")

pctBE = input.float(@@PCT_BE@@, "BE: % de la cuenta", minval = 0.0, maxval = 5.0, step = 0.05, group = GRUPO_BE, tooltip = "Si el resultado neto (beneficio + comisión + swap) es menor que este % del saldo de la cuenta al abrir, la operación cuenta como BE, sea SL, TP o manual. 0 = desactivado.")

anchoCaja = input.int(@@ANCHO_CAJA@@, "Ancho de caja (barras)", minval = 1, maxval = 200, group = GRUPO_CAJA, tooltip = "Ancho fijo de todas las cajas, contado desde la entrada, en barras del marco temporal actual.")
verEtiquetas = input.bool(true, "Mostrar etiqueta de salida", group = GRUPO_CAJA, tooltip = "Etiqueta con tipo de cierre e importe, a la altura del precio real de salida.")

verTabla = input.bool(true, "Mostrar tabla", group = GRUPO_TABLA, tooltip = "Estadísticas de las operaciones mostradas en el gráfico.")
posicionTabla = input.string(position.top_right, "Posición de la tabla", options = [position.top_right, position.top_left, position.bottom_right, position.bottom_left, position.middle_right, position.middle_left], group = GRUPO_TABLA, tooltip = "Esquina del gráfico donde se dibuja la tabla.")

ignorarSimbolo = input.bool(false, "Ignorar la comprobación del símbolo", group = GRUPO_CAJA, tooltip = "Actívalo si el gráfico es del mismo activo pero su nombre en TradingView no contiene «@@SIMBOLO@@».")

colorZonaTP = input.color(color.new(color.green, 80), "Zona TP", group = GRUPO_COLORES)
colorZonaSL = input.color(color.new(color.red, 80), "Zona SL", group = GRUPO_COLORES)
colorEntrada = input.color(color.new(color.silver, 0), "Línea de entrada", group = GRUPO_COLORES)
colorSLMovido = input.color(color.new(color.gray, 0), "Línea SL movido", group = GRUPO_COLORES)
colorGanadora = input.color(color.new(color.green, 0), "Etiqueta ganadora", group = GRUPO_COLORES)
colorPerdedora = input.color(color.new(color.red, 0), "Etiqueta perdedora", group = GRUPO_COLORES)
colorBreakEven = input.color(color.new(color.orange, 0), "Etiqueta BE", group = GRUPO_COLORES)
colorTabla = input.color(color.new(#1e222d, 10), "Fondo de la tabla", group = GRUPO_COLORES)

// ===== DATOS (incrustados) =====
// Campos: ticket, compra(1/0), lotes, entradaMs, entrada, sl, tp, salidaMs, salida, neto, motivo, saldo, desfaseEntradaMin, desfaseSalidaMin
@@DATOS@@
trozosDatos = array.from(@@NOMBRES_TROZOS@@)

SIMBOLO_TV = "@@SIMBOLO@@"
ETIQUETA_HORA = "@@ETIQUETA_HORA@@"
simboloCoincide = ignorarSimbolo or str.contains(str.upper(syminfo.ticker), str.upper(SIMBOLO_TV))

anchoCajaMs = anchoCaja * timeframe.in_seconds() * 1000
var tablaEstadisticas = table.new(posicionTabla, 2, 10, bgcolor = colorTabla)

// ===== CÁLCULOS =====
// Recibe los trozos de datos y devuelve una lista con un texto por operación.
unirOperaciones(array<string> trozos) =>
    lista = array.new<string>()
    for trozo in trozos
        for texto in str.split(trozo, ";")
            if str.length(texto) > 0
                lista.push(texto)
    lista

// Recibe el texto de una operación y devuelve sus 14 campos.
leerOperacion(string texto) =>
    campos = str.split(texto, ",")
    ticket = array.get(campos, 0)
    esCompra = array.get(campos, 1) == "1"
    lotes = str.tonumber(array.get(campos, 2))
    tEntrada = int(str.tonumber(array.get(campos, 3)))
    pEntrada = str.tonumber(array.get(campos, 4))
    precioSL = str.tonumber(array.get(campos, 5))
    precioTP = str.tonumber(array.get(campos, 6))
    tSalida = int(str.tonumber(array.get(campos, 7)))
    pSalida = str.tonumber(array.get(campos, 8))
    neto = str.tonumber(array.get(campos, 9))
    motivo = array.get(campos, 10)
    saldo = str.tonumber(array.get(campos, 11))
    dEntrada = int(str.tonumber(array.get(campos, 12)))
    dSalida = int(str.tonumber(array.get(campos, 13)))
    [ticket, esCompra, lotes, tEntrada, pEntrada, precioSL, precioTP, tSalida, pSalida, neto, motivo, saldo, dEntrada, dSalida]

// Devuelve la categoría: "Abierta", "BE", "SL", "TP" o "Manual". El BE tiene prioridad.
clasificarOperacion(string motivo, float neto, float saldo, float umbralBE) =>
    categoria = "Manual"
    if motivo == "o"
        categoria := "Abierta"
    else if saldo > 0 and math.abs(neto) / saldo * 100 < umbralBE
        categoria := "BE"
    else if motivo == "s"
        categoria := "SL"
    else if motivo == "t"
        categoria := "TP"
    categoria

// Precio donde se dibuja la salida: el real, o el cierre actual si la operación sigue abierta.
precioSalidaVisible(string categoria, float pSalida, float pActual) =>
    categoria == "Abierta" ? pActual : pSalida

// ===== SEÑALES (FILTROS) =====
// Indica si la categoría de la operación está activada en los filtros.
pasaFiltroCategoria(string categoria, bool mostrarTP, bool mostrarSL, bool mostrarBE, bool mostrarManual, bool mostrarAbiertas) =>
    categoria == "TP" ? mostrarTP : categoria == "SL" ? mostrarSL : categoria == "BE" ? mostrarBE : categoria == "Manual" ? mostrarManual : mostrarAbiertas

// Indica si la dirección (compra/venta) está permitida por el filtro.
pasaFiltroDireccion(bool esCompra, string direccion) =>
    direccion == "Todas" or (direccion == "Compras" and esCompra) or (direccion == "Ventas" and not esCompra)

// Indica si la entrada cae dentro del periodo elegido.
pasaFiltroPeriodo(int tEntrada, bool historicoCompleto, int desde, int hasta) =>
    historicoCompleto or (tEntrada >= desde and tEntrada <= hasta)

// Indica si el SL final ya no está en el lado de pérdida (se movió a BE o a beneficio).
esSLMovido(bool esCompra, float pEntrada, float precioSL) =>
    precioSL > 0 and (esCompra ? precioSL >= pEntrada : precioSL <= pEntrada)

// ===== DIBUJO =====
// Color de la etiqueta de salida según el resultado.
colorDelResultado(string categoria, float neto, color colGanadora, color colPerdedora, color colBE) =>
    categoria == "BE" ? colBE : neto > 0 ? colGanadora : colPerdedora

// Texto del tooltip con los datos completos de la operación.
// Las horas se desplazan los minutos que indica la aplicación y se formatean como UTC, así el texto sale en la hora elegida.
textoDetalle(string ticket, bool esCompra, float lotes, int tEntrada, int tSalida, int dEntrada, int dSalida, float neto, float saldo, string categoria) =>
    texto = "#" + ticket + " · " + (esCompra ? "Compra " : "Venta ") + str.tostring(lotes) + " lotes"
    texto += "\nEntrada: " + str.format_time(tEntrada + dEntrada * 60000, "yyyy-MM-dd HH:mm", "UTC") + " " + ETIQUETA_HORA
    texto += "\nSalida: " + (categoria == "Abierta" ? "abierta" : str.format_time(tSalida + dSalida * 60000, "yyyy-MM-dd HH:mm", "UTC") + " " + ETIQUETA_HORA)
    texto += "\nResultado neto: " + str.tostring(neto, "#.##")
    texto += "\n% de la cuenta: " + (saldo > 0 ? str.tostring(neto / saldo * 100, "#.##") + " %" : "n/d")
    texto

// Dibuja las zonas TP (verde) y SL (roja) y la línea de entrada, como la herramienta de posición de TradingView.
dibujarZonas(bool esCompra, int tIzquierda, int tDerecha, float pEntrada, float precioSL, float precioTP, color colZonaTP, color colZonaSL, color colLineaEntrada) =>
    tpValido = precioTP > 0 and (esCompra ? precioTP > pEntrada : precioTP < pEntrada)
    slEnPerdida = precioSL > 0 and (esCompra ? precioSL < pEntrada : precioSL > pEntrada)
    if tpValido
        box.new(tIzquierda, math.max(precioTP, pEntrada), tDerecha, math.min(precioTP, pEntrada), xloc = xloc.bar_time, border_width = 0, bgcolor = colZonaTP)
    if slEnPerdida
        box.new(tIzquierda, math.max(precioSL, pEntrada), tDerecha, math.min(precioSL, pEntrada), xloc = xloc.bar_time, border_width = 0, bgcolor = colZonaSL)
    line.new(tIzquierda, pEntrada, tDerecha, pEntrada, xloc = xloc.bar_time, color = colLineaEntrada, width = 1)

// Dibuja una línea gris con el texto "SL movido" cuando el SL final no es el original.
dibujarSLMovido(int tIzquierda, int tDerecha, float precioSL, color colSLMovido) =>
    line.new(tIzquierda, precioSL, tDerecha, precioSL, xloc = xloc.bar_time, color = colSLMovido, style = line.style_dashed, width = 1)
    label.new(tIzquierda, precioSL, "SL movido", xloc = xloc.bar_time, color = colSLMovido, textcolor = color.white, style = label.style_label_right, size = size.tiny)

// Dibuja la etiqueta de salida en el borde derecho de la caja, a la altura del precio de salida.
dibujarSalida(bool esCompra, int tDerecha, float pSalida, string categoria, float neto, color colorEtiqueta, string detalle, bool conTexto) =>
    flecha = esCompra ? "▲ " : "▼ "
    importe = (neto > 0 ? "+" : "") + str.tostring(neto, "#.##")
    texto = conTexto ? flecha + categoria + " " + importe : ""
    label.new(tDerecha, pSalida, texto, xloc = xloc.bar_time, color = colorEtiqueta, textcolor = color.white, style = label.style_label_left, size = size.small, tooltip = detalle)

// Rellena la tabla con las estadísticas de las operaciones mostradas.
dibujarTabla(table tabla, string simbolo, int cerradas, int ganadoras, int perdedoras, int breakEven, float netoTotal, float mejor, float peor, int totalFiltradas, int dibujadas) =>
    sinBE = ganadoras + perdedoras
    porcentajeGanadoras = sinBE > 0 ? ganadoras * 100.0 / sinBE : 0.0
    colorNeto = netoTotal >= 0 ? color.lime : color.red
    table.cell(tabla, 0, 0, "Análisis Trading · " + simbolo, text_color = color.white, text_halign = text.align_center)
    table.cell(tabla, 0, 1, "Operaciones cerradas", text_color = color.white, text_halign = text.align_left)
    table.cell(tabla, 1, 1, str.tostring(cerradas), text_color = color.white, text_halign = text.align_right)
    table.cell(tabla, 0, 2, "Ganadoras", text_color = color.white, text_halign = text.align_left)
    table.cell(tabla, 1, 2, str.tostring(ganadoras), text_color = color.white, text_halign = text.align_right)
    table.cell(tabla, 0, 3, "Perdedoras", text_color = color.white, text_halign = text.align_left)
    table.cell(tabla, 1, 3, str.tostring(perdedoras), text_color = color.white, text_halign = text.align_right)
    table.cell(tabla, 0, 4, "BE", text_color = color.white, text_halign = text.align_left)
    table.cell(tabla, 1, 4, str.tostring(breakEven), text_color = color.white, text_halign = text.align_right)
    table.cell(tabla, 0, 5, "% ganadoras (sin BE)", text_color = color.white, text_halign = text.align_left)
    table.cell(tabla, 1, 5, str.tostring(porcentajeGanadoras, "#.##") + " %", text_color = color.white, text_halign = text.align_right)
    table.cell(tabla, 0, 6, "Neto total", text_color = color.white, text_halign = text.align_left)
    table.cell(tabla, 1, 6, str.tostring(netoTotal, "#.##"), text_color = colorNeto, text_halign = text.align_right)
    table.cell(tabla, 0, 7, "Mejor operación", text_color = color.white, text_halign = text.align_left)
    table.cell(tabla, 1, 7, na(mejor) ? "-" : str.tostring(mejor, "#.##"), text_color = color.lime, text_halign = text.align_right)
    table.cell(tabla, 0, 8, "Peor operación", text_color = color.white, text_halign = text.align_left)
    table.cell(tabla, 1, 8, na(peor) ? "-" : str.tostring(peor, "#.##"), text_color = color.red, text_halign = text.align_right)
    aviso = totalFiltradas > dibujadas ? "Por limitación de TradingView, solo se muestran " + str.tostring(dibujadas) + " operaciones de " + str.tostring(totalFiltradas) + " operaciones." : ""
    table.cell(tabla, 0, 9, aviso, text_color = color.orange, text_halign = text.align_left, text_size = size.small)

// ===== EJECUCIÓN =====
if barstate.isfirst
    table.merge_cells(tablaEstadisticas, 0, 0, 1, 0)
    table.merge_cells(tablaEstadisticas, 0, 9, 1, 9)

// Todo se dibuja en la última barra, de la operación más reciente a la más antigua.
if barstate.islast and not simboloCoincide
    table.cell(tablaEstadisticas, 0, 0, "Este script es de @@SIMBOLO@@ y el gráfico es " + syminfo.ticker + ". Abre el gráfico correcto o activa «Ignorar la comprobación del símbolo».", text_color = color.orange, text_halign = text.align_left)
if barstate.islast and simboloCoincide
    operaciones = unirOperaciones(trozosDatos)
    totalFiltradas = 0
    dibujadas = 0
    cerradas = 0
    ganadoras = 0
    perdedoras = 0
    breakEven = 0
    netoTotal = 0.0
    float mejor = na
    float peor = na
    for i = operaciones.size() - 1 to 0
        [ticket, esCompra, lotes, tEntrada, pEntrada, precioSL, precioTP, tSalida, pSalida, neto, motivo, saldo, dEntrada, dSalida] = leerOperacion(operaciones.get(i))
        categoria = clasificarOperacion(motivo, neto, saldo, pctBE)
        pasaFiltros = pasaFiltroPeriodo(tEntrada, todoHistorico, fechaDesde, fechaHasta) and pasaFiltroDireccion(esCompra, direccionFiltro) and pasaFiltroCategoria(categoria, verTP, verSL, verBE, verManual, verAbiertas)
        if pasaFiltros
            totalFiltradas += 1
            if dibujadas < MAX_OPERACIONES
                dibujadas += 1
                tDerecha = tEntrada + anchoCajaMs
                dibujarZonas(esCompra, tEntrada, tDerecha, pEntrada, precioSL, precioTP, colorZonaTP, colorZonaSL, colorEntrada)
                if esSLMovido(esCompra, pEntrada, precioSL)
                    dibujarSLMovido(tEntrada, tDerecha, precioSL, colorSLMovido)
                colorEtiqueta = colorDelResultado(categoria, neto, colorGanadora, colorPerdedora, colorBreakEven)
                detalle = textoDetalle(ticket, esCompra, lotes, tEntrada, tSalida, dEntrada, dSalida, neto, saldo, categoria)
                dibujarSalida(esCompra, tDerecha, precioSalidaVisible(categoria, pSalida, close), categoria, neto, colorEtiqueta, detalle, verEtiquetas)
                if categoria != "Abierta"
                    cerradas += 1
                    netoTotal += neto
                    mejor := na(mejor) ? neto : math.max(mejor, neto)
                    peor := na(peor) ? neto : math.min(peor, neto)
                    if categoria == "BE"
                        breakEven += 1
                    else if neto > 0
                        ganadoras += 1
                    else
                        perdedoras += 1
    if verTabla
        dibujarTabla(tablaEstadisticas, SIMBOLO_TV, cerradas, ganadoras, perdedoras, breakEven, netoTotal, mejor, peor, totalFiltradas, dibujadas)
`;
