import { readFileSync } from 'node:fs';
import { leerInformeQuantfury } from './src/adapters/statement-parsers/quantfury-texto-parser';
for (const f of ['/tmp/q_pdfjs.txt','/tmp/q.txt']) {
  const t0=performance.now();
  const i = leerInformeQuantfury(readFileSync(f,'utf8'));
  console.log(f, 'cerradas',i.cerradas.length,'abiertas',i.abiertas.length,'avisos',i.avisos?.length, 'totales',JSON.stringify(i.totales), Math.round(performance.now()-t0)+'ms');
  const m:Record<string,number>={}; for(const o of i.cerradas) m[o.monedaOrigen??'?']=(m[o.monedaOrigen??'?']??0)+1; console.log(m);
  console.log(i.cerradas[1], i.abiertas[0], i.abiertas.at(-1)?.activo);
}
