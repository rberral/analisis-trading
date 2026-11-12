import { leerInformeQuantfury } from './src/adapters/statement-parsers/quantfury-texto-parser';
import { readFileSync } from 'node:fs';
const i = leerInformeQuantfury(readFileSync('/tmp/q_pdfjs.txt','utf8'));
console.log(i.avisos?.slice(0,3));
