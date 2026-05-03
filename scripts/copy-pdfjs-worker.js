/**
 * Copies the pdf.js worker bundle into public/ so the browser can load it.
 * Runs automatically after `npm install` via the postinstall script.
 */
const fs   = require('fs');
const path = require('path');

const src  = path.resolve(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.js');
const dest = path.resolve(__dirname, '../public/pdf.worker.min.js');

if (!fs.existsSync(src)) {
  console.warn('[docpipeline] pdfjs-dist worker not found — PDF support may not work.');
  process.exit(0);
}

fs.copyFileSync(src, dest);
console.log('[docpipeline] Copied pdf.worker.min.js → public/');
