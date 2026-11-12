import { leerInformeQuantfury } from './src/adapters/statement-parsers/quantfury-texto-parser';
const t = `Posiciones Cerradas
BTC/USDT 04/03/2021 6:47:46 PM UTC VENDER (reducir) 48,000.00 0.00098994 BTC ₮ 50.00 - ₮ 2.48
BTC/USDT 05/03/2021 12:21:43 AM UTC VENDER (cerrar) 47,000.00 0.00098994 BTC ₮ 50.00 - ₮ 3.47
Total - ₮ 5.95`;
console.log(JSON.stringify(leerInformeQuantfury(t).cerradas.map(o=>[o.beneficio,o.monedaOrigen])), leerInformeQuantfury(t).avisos);
