/**
 * Informe de MetaTrader 4 inventado (cuenta y datos ficticios) con la misma
 * estructura que los reales. Las cifras están calculadas a mano:
 *
 *   operación   cierre         resultado neto (comisión + swap + beneficio)
 *   1001 compra 05/01          +98,00
 *   1002 venta  06/01          -52,00
 *   1003 compra 07/01          -33,00
 *   1004 venta  08/01          +18,00
 *
 *   beneficio bruto 116,00 · pérdida bruta 85,00 · neto 31,00
 *   balance inicial 10 000,00 · drawdown máximo 85,00 (0,84 %)
 */

const CABECERA_OPERACIONES = `<tr align=center bgcolor="#C0C0C0">
   <td>Ticket</td><td nowrap>Open Time</td><td>Type</td><td>Size</td><td>Item</td>
   <td>Price</td><td>S / L</td><td>T / P</td><td nowrap>Close Time</td>
   <td>Price</td><td>Commission</td><td>Taxes</td><td>Swap</td><td>Profit</td></tr>`;

function fila(
  ticket: string,
  comentario: string,
  apertura: string,
  tipo: 'buy' | 'sell',
  lotes: string,
  activo: string,
  entrada: string,
  stopLoss: string,
  takeProfit: string,
  cierre: string,
  precioCierre: string,
  comision: string,
  swap: string,
  beneficio: string,
): string {
  return `<tr align=right><td title="${comentario}">${ticket}</td><td class=msdate nowrap>${apertura}</td><td>${tipo}</td><td class=mspt>${lotes}</td><td>${activo}</td><td>${entrada}</td><td>${stopLoss}</td><td>${takeProfit}</td><td class=msdate nowrap>${cierre}</td><td>${precioCierre}</td><td class=mspt>${comision}</td><td class=mspt>0.00</td><td class=mspt>${swap}</td><td class=mspt>${beneficio}</td></tr>`;
}

function filaDeBalance(ticket: string, hora: string, descripcion: string, importe: string): string {
  return `<tr align=right><td title="${descripcion}">${ticket}</td><td class=msdate nowrap>${hora}</td><td>balance</td><td colspan=10 align=left>${descripcion}</td><td class=mspt>${importe}</td></tr>`;
}

function parejas(...textos: string[]): string {
  return `<tr align=right>${textos.map((texto) => `<td><b>${texto}</b></td>`).join('')}</tr>`;
}

export const INFORME_MT4_EJEMPLO = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN">
<html><head><title>Statement: 1000001 - Cuenta de prueba</title></head>
<body><div align=center>
<table cellspacing=1 cellpadding=3 border=0>
<tr align=left>
    <td colspan=2><b>Account: 1000001</b></td>
    <td colspan=5><b>Name: Cuenta de prueba</b></td>
    <td colspan=2><b>Currency: USD</b></td></tr>
<tr align=left><td colspan=13><b>Closed Transactions:</b></td></tr>
${CABECERA_OPERACIONES}
${filaDeBalance('1006', '2026.01.09 00:00:00', 'EURUSD div. 0.50 USD / lot', '0.50')}
${fila('1004', 'Prueba', '2026.01.08 08:00:00', 'sell', '0.50', 'eurusd', '1.10000', '0.00000', '0.00000', '2026.01.08 09:00:00', '1.09600', '-2.00', '0.00', '20.00')}
${fila('1003', 'Prueba', '2026.01.07 08:00:00', 'buy', '1.00', 'xauusd', '2 000.00', '0.00', '0.00', '2026.01.07 18:00:00', '1990.00', '-2.00', '-1.00', '-30.00')}
${fila('1002', 'Prueba[sl]', '2026.01.06 09:00:00', 'sell', '1.00', 'eurusd', '1.10000', '1.10500', '1.09000', '2026.01.06 09:30:00', '1.10500', '-2.00', '0.00', '-50.00')}
${fila('1001', 'Prueba[tp]', '2026.01.05 10:00:00', 'buy', '1.00', 'eurusd', '1.10000', '1.09500', '1.10500', '2026.01.05 12:00:00', '1.10500', '-2.00', '0.00', '100.00')}
${filaDeBalance('1000', '2026.01.01 00:00:00', 'Deposited using API', '10 000.00')}
<tr align=right><td colspan=10>&nbsp;</td><td class=mspt>-8.00</td><td class=mspt>0.00</td><td class=mspt>-1.00</td><td class=mspt>40.00</td></tr>
<tr align=right><td colspan=12><b>Closed P/L:</b></td><td colspan=2 class=mspt><b>31.00</b></td></tr>
<tr align=left><td colspan=14><b>Open Trades:</b></td></tr>
${CABECERA_OPERACIONES.replace('Close Time', '&nbsp;')}
<tr align=right><td title="Prueba">1007</td><td class=msdate nowrap>2026.01.09 10:00:00</td><td>buy</td><td class=mspt>1.00</td><td>eurusd</td><td>1.10000</td><td>1.09000</td><td>1.12000</td><td class=msdate nowrap>&nbsp;</td><td>1.10150</td><td class=mspt>-0.50</td><td class=mspt>0.00</td><td class=mspt>-0.20</td><td class=mspt>15.00</td></tr>
<tr align=right><td colspan=10>&nbsp;</td><td class=mspt>-0.50</td><td class=mspt>0.00</td><td class=mspt>-0.20</td><td class=mspt>15.00</td></tr>
<tr><td colspan=10>&nbsp;</td><td colspan=2 align=right><b>Floating P/L:</b></td><td colspan=2 align=right class=mspt><b>14.30</b></td></tr>
<tr align=left><td colspan=14><b>Working Orders:</b></td></tr>
<tr align=right><td colspan=13 align=center>No transactions</td></tr>
<tr align=left><td colspan=14><b>Summary:</b></td></tr>
${parejas('Deposit/Withdrawal:', '10 000.50')}
${parejas('Closed Trade P/L:', '31.00', 'Floating P/L:', '14.30')}
${parejas('Balance:', '10 031.50')}
<tr align=left><td colspan=14><b>Details:</b></td></tr>
<tr align=center><td colspan=14><img src="DetailedStatement.gif" alt="Graph"></td></tr>
${parejas('Gross Profit:', '116.00', 'Gross Loss:', '85.00', 'Total Net Profit:', '31.00')}
${parejas('Profit Factor:', '1.36', 'Expected Payoff:', '7.75')}
${parejas('Absolute Drawdown:', '0.00', 'Maximal Drawdown:', '85.00 (0.84%)', 'Relative Drawdown:', '0.84% (85.00)')}
${parejas('Total Trades:', '4', 'Short Positions (won %):', '2 (50.00%)', 'Long Positions (won %):', '2 (50.00%)')}
${parejas('Profit Trades (% of total):', '2 (50.00%)', 'Loss trades (% of total):', '2 (50.00%)')}
${parejas('Largest', 'profit trade:', '98.00', 'loss trade:', '-52.00')}
${parejas('Average', 'profit trade:', '58.00', 'loss trade:', '-42.50')}
${parejas('Maximum', 'consecutive wins ($):', '1 (98.00)', 'consecutive losses ($):', '2 (-85.00)')}
${parejas('Maximal', 'consecutive profit (count):', '98.00 (1)', 'consecutive loss (count):', '-85.00 (2)')}
</table></div></body></html>`;
