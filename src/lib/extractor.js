/**
 * extractor.js
 * Handles reading + extracting structured data from:
 *   .txt  → plain text regex
 *   .csv  → column/header parsing
 *   .pdf  → pdfjs-dist text layer
 *   image → Tesseract.js OCR
 */

import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `${process.env.PUBLIC_URL || ''}/pdf.worker.min.js`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function first(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return (m[1] || m[0]).trim();
  }
  return null;
}

function parseAmount(str) {
  if (!str && str !== 0) return null;
  const cleaned = String(str).replace(/[,$€£¥\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function normaliseDate(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const slashMatch = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    let [, a, b, y] = slashMatch;
    if (y.length === 2) y = '20' + y;
    const day   = parseInt(a) > 12 ? a : b;
    const month = parseInt(a) > 12 ? b : a;
    return `${y}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
  }
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const wm1 = raw.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (wm1) {
    const mo = months[wm1[2].slice(0,3).toLowerCase()];
    if (mo) return `${wm1[3]}-${String(mo).padStart(2,'0')}-${wm1[1].padStart(2,'0')}`;
  }
  const wm2 = raw.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (wm2) {
    const mo = months[wm2[1].slice(0,3).toLowerCase()];
    if (mo) return `${wm2[3]}-${String(mo).padStart(2,'0')}-${wm2[2].padStart(2,'0')}`;
  }
  return null;
}

function detectCurrency(text) {
  if (/€|EUR/i.test(text)) return 'EUR';
  if (/£|GBP/i.test(text)) return 'GBP';
  if (/\$|USD/i.test(text)) return 'USD';
  if (/¥|JPY/i.test(text)) return 'JPY';
  if (/CHF/i.test(text)) return 'CHF';
  if (/CAD/i.test(text)) return 'CAD';
  if (/AUD/i.test(text)) return 'AUD';
  if (/BAM/i.test(text)) return 'BAM';
  return null;
}

function detectDocType(text) {
  const lower = text.toLowerCase();
  if (/purchase\s*order|^po\b|\bpo#|\bpo\s*\d/im.test(lower)) return 'purchase_order';
  return 'invoice';
}

// ─── Plain text extraction ────────────────────────────────────────────────────

function parseLineItemsFromText(text) {
  const items = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip summary/header rows — but NOT description lines that happen to contain these words
    // Only skip if the WHOLE line is a summary (starts with the keyword)
    if (/^(total|subtotal|tax|vat|gst|due date|invoice number|purchase order|bill to|ship to|description|item|service|product)/i.test(trimmed)) continue;

    // Format 1: columns separated by 2+ spaces: "Service A   5   129.00   645.00"
    const multiSpace = trimmed.match(/^(.+?)\s{2,}(\d[\d,\.]*)\s+(\d[\d,\.]*)\s+(\d[\d,\.]*)$/);
    if (multiSpace) {
      items.push({ description: multiSpace[1].trim(), qty: parseAmount(multiSpace[2]), unitPrice: parseAmount(multiSpace[3]), total: parseAmount(multiSpace[4]) });
      continue;
    }

    // Format 2: "Description Qty UnitPrice Total" — ends with 3 numbers, anything before is the description
    // Handles single-space separation (common in PDF text extraction)
    const threeNums = trimmed.match(/^(.+?)\s+(\d[\d,\.]*)\s+(\d[\d,\.]+)\s+(\d[\d,\.]+)$/);
    if (threeNums) {
      const desc = threeNums[1].trim();
      const qty  = parseAmount(threeNums[2]);
      const unit = parseAmount(threeNums[3]);
      const tot  = parseAmount(threeNums[4]);
      // Sanity check: qty should be a reasonable number, desc shouldn't be just digits
      if (desc && !/^\d+$/.test(desc) && qty !== null && qty < 10000) {
        items.push({ description: desc, qty, unitPrice: unit, total: tot });
        continue;
      }
    }

    // Format 3: explicitly labelled "Item: X  Qty: 2  Price: $10  Total: $20"
    const labelled = trimmed.match(/(.+?)\s+(?:qty|quantity)[:\s]+(\d[\d,\.]*)\s+(?:price|unit)[:\s]+\$?([\d,\.]+)\s+(?:total|amount)[:\s]+\$?([\d,\.]+)/i);
    if (labelled) {
      items.push({ description: labelled[1].trim(), qty: parseAmount(labelled[2]), unitPrice: parseAmount(labelled[3]), total: parseAmount(labelled[4]) });
    }
  }
  return items;
}

export function extractFromText(text) {
  // --- supplier ---
  // Try labelled first ("Supplier: Acme", "From: Acme"), then bare "Supplier Acme" style
  const supplier =
    first(text, [
      /(?:from|vendor|supplier|company|billed?\s*by|issued?\s*by)[:\s]+([A-Za-z0-9 &.,'-]{2,60})/i,
    ]) ||
    first(text, [
      /^supplier\s+(.+)$/im,
      /^vendor\s+(.+)$/im,
      /^company\s+(.+)$/im,
      /^from\s+(.+)$/im,
    ]);

  // --- document number ---
  // Try "Invoice #X", "Number: X", bare "Invoice X" (word followed by alphanumeric id)
  const documentNumber =
    first(text, [
      /(?:invoice|inv|po|purchase\s*order|order|doc(?:ument)?|ref(?:erence)?)\s*[#:\-]+\s*([A-Z0-9\-\/]{2,30})/i,
      /#\s*([A-Z0-9\-\/]{3,20})/i,
      /number[:\s]+([A-Z0-9\-\/]{2,20})/i,
    ]) ||
    first(text, [
      // "Invoice 3724" — keyword space then a standalone number/id on same line
      /^(?:invoice|inv|po|order)\s+([A-Z0-9\-\/]{2,30})\s*$/im,
    ]);

  return {
    documentType:   detectDocType(text),
    currency:       detectCurrency(text),
    supplier,
    documentNumber,
    issueDate: normaliseDate(first(text, [
      /(?:issue|invoice|date|dated|created)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:issue|invoice|date|dated|created)[:\s]+(\d{4}-\d{2}-\d{2})/i,
      /(?:issue|invoice|date|dated|created)[:\s]+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
      /(?:issue|invoice|date|dated|created)[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i,
      /^date[:\s]+(.+)$/im,
    ])),
    dueDate: normaliseDate(first(text, [
      /(?:due|payment\s*due|pay\s*by|payable\s*by)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(?:due|payment\s*due|pay\s*by|payable\s*by)[:\s]+(\d{4}-\d{2}-\d{2})/i,
      /(?:due|payment\s*due|pay\s*by|payable\s*by)[:\s]+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    ])),
    lineItems: parseLineItemsFromText(text),
    subtotal:  parseAmount(first(text, [/subtotal[:\s]+[€$£¥]?\s*([\d,\.]+)/i, /sub\s*total[:\s]+[€$£¥]?\s*([\d,\.]+)/i])),
    tax:       parseAmount(first(text, [/(?:tax|vat|gst|hst)\s*(?:\(\d+%\))?[:\s]+[€$£¥]?\s*([\d,\.]+)/i])),
    total:     (() => {
      // Use negative lookbehind so "subtotal" doesn't match the "total" pattern
      const extracted = parseAmount(first(text, [
        /(?:total\s*due|amount\s*due|grand\s*total|total\s*amount)[:\s]+[€$£¥]?\s*([\d,\.]+)/i,
        /(?<!sub)\btotal[:\s]+[€$£¥]?\s*([\d,\.]+)/i,
        /^total\s+[€$£¥]?([\d,\.]+)\s*$/im,
      ]));
      // Fallback: calculate from subtotal + tax if total not found or looks wrong
      const sub = parseAmount(first(text, [/subtotal[:\s]+[€$£¥]?\s*([\d,\.]+)/i]));
      const tax = parseAmount(first(text, [/(?:tax|vat|gst|hst)\s*(?:\(\d+%\))?[:\s]+[€$£¥]?\s*([\d,\.]+)/i]));
      if (!extracted && sub !== null && tax !== null) return sub + tax;
      if (extracted && sub !== null && Math.abs(extracted - sub) < 0.01 && tax !== null) return sub + tax;
      return extracted;
    })(),
  };
}

// ─── CSV extraction ───────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim()); current = '';
    } else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function extractFromCSV(text) {
  const rawLines = text.split(/\r?\n/).filter(l => l.trim());
  const lines = rawLines.map(parseCSVLine);
  const twoColRows = lines.filter(r => r.length === 2).length;
  const isKeyValue = twoColRows > lines.length * 0.5;

  let extracted = {
    documentType: null, supplier: null, documentNumber: null,
    issueDate: null, dueDate: null, currency: null,
    lineItems: [], subtotal: null, tax: null, total: null,
  };

  if (isKeyValue) {
    const kv = {};
    for (const [k, v] of lines) kv[k.toLowerCase().trim()] = v;
    const get = (...keys) => {
      for (const k of keys)
        for (const [mk, val] of Object.entries(kv))
          if (mk.includes(k)) return val;
      return null;
    };
    extracted.documentType   = detectDocType(Object.values(kv).join(' '));
    extracted.supplier       = get('supplier','vendor','company','from','billed by','issued by');
    extracted.documentNumber = get('invoice','inv','number','doc','ref','po');
    extracted.issueDate      = normaliseDate(get('issue date','invoice date','date','created'));
    extracted.dueDate        = normaliseDate(get('due date','payment due','pay by'));
    extracted.currency       = detectCurrency(Object.values(kv).join(' ')) || get('currency','curr');
    extracted.subtotal       = parseAmount(get('subtotal','sub total','net'));
    extracted.tax            = parseAmount(get('tax','vat','gst'));
    extracted.total          = parseAmount(get('total due','amount due','grand total','total'));
  } else {
    const ITEM_H = /desc|item|product|service|name/i;
    const NUM_H  = /qty|quantity|price|amount|cost|rate|total/i;
    let headerRowIdx = lines.findIndex(r => r.some(c => ITEM_H.test(c)) && r.some(c => NUM_H.test(c)));
    if (headerRowIdx === -1) headerRowIdx = 0;
    const headers = lines[headerRowIdx].map(h => h.toLowerCase().trim());
    const ci = {
      desc:      headers.findIndex(h => /desc|item|product|service|name/i.test(h)),
      qty:       headers.findIndex(h => /qty|quantity/i.test(h)),
      unitPrice: headers.findIndex(h => /unit.?price|rate|price|cost/i.test(h)),
      total:     headers.findIndex(h => /total|amount/i.test(h)),
    };
    const metaText = lines.slice(0, headerRowIdx).map(r => r.join(' ')).join('\n');
    const fullText = rawLines.join('\n');
    extracted.documentType   = detectDocType(fullText);
    extracted.currency       = detectCurrency(fullText);
    // Only use fallback supplier from first cell if it looks like a real company name
    // (not a header word like "desc", "item", "description")
    const firstCellIsHeader = !lines[0]?.[0] || ITEM_H.test(lines[0][0]) || NUM_H.test(lines[0][0]);
    extracted.supplier = first(metaText, [/(?:from|vendor|supplier|company|billed?\s*by)[:\s]+([A-Za-z0-9 &.,'-]{2,60})/i])
                        || (firstCellIsHeader || headerRowIdx === 0 ? null : lines[0][0]);
    extracted.documentNumber = first(fullText, [/(?:invoice|inv|po|order|ref)[#:\s\-]+([A-Z0-9\-\/]{2,30})/i, /#([A-Z0-9\-\/]{3,20})/i]);
    extracted.issueDate      = normaliseDate(first(fullText, [/(?:date|issued?)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i, /(?:date|issued?)[:\s]+(\d{4}-\d{2}-\d{2})/i]));
    extracted.dueDate        = normaliseDate(first(fullText, [/(?:due|payment\s*due)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i]));
    const lineItems = [];
    let subtotal = null, tax = null, total = null;
    for (const row of lines.slice(headerRowIdx + 1)) {
      if (row.every(c => !c)) continue;
      if (/^\s*subtotal/i.test(row[0])) { subtotal = parseAmount(row[row.length-1]); continue; }
      if (/^\s*(tax|vat|gst)/i.test(row[0])) { tax = parseAmount(row[row.length-1]); continue; }
      if (/^\s*(total|amount due|grand total)/i.test(row[0])) { total = parseAmount(row[row.length-1]); continue; }
      const desc      = ci.desc      >= 0 ? row[ci.desc]      : row[0];
      const qty       = ci.qty       >= 0 ? parseAmount(row[ci.qty]) : 1;
      const unitPrice = ci.unitPrice >= 0 ? parseAmount(row[ci.unitPrice]) : null;
      const itemTotal = ci.total     >= 0 ? parseAmount(row[ci.total]) : (qty && unitPrice ? qty * unitPrice : null);
      if (desc && (unitPrice !== null || itemTotal !== null)) {
        lineItems.push({ description: desc, qty: qty ?? 1, unitPrice: unitPrice ?? 0, total: itemTotal ?? 0 });
      }
    }
    extracted.lineItems = lineItems;
    extracted.subtotal  = subtotal;
    extracted.tax       = tax;

    // Calculate total from line items if not explicitly stated
    if (!total && lineItems.length > 0) {
      const itemsSum = lineItems.reduce((sum, item) => sum + parseFloat(item.total || 0), 0);
      if (subtotal !== null) {
        total = subtotal + (tax || 0);
      } else if (itemsSum > 0) {
        total = itemsSum + (tax || 0);
        extracted.subtotal = itemsSum;
      }
    }
    extracted.total = total || parseAmount(first(fullText, [/(?<!sub)\btotal[:\s]+[€$£¥]?\s*([\d,\.]+)/i]));
  }
  return extracted;
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

async function extractFromPDF(arrayBuffer) {
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items;
    if (items.length === 0) continue;

    // Group items into lines by their Y position (transform[5])
    const lineMap = new Map();
    for (const item of items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y).push({ str: item.str, x: item.transform[4] });
    }

    // Sort lines top-to-bottom (higher Y = higher on page in PDF coords)
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);

    for (const y of sortedYs) {
      // Sort items left-to-right within each line
      const lineItems = lineMap.get(y).sort((a, b) => a.x - b.x);
      let line = '';
      for (let j = 0; j < lineItems.length; j++) {
        const str = lineItems[j].str;
        if (j === 0) {
          line += str;
        } else {
          line += (line.endsWith(' ') || str.startsWith(' ')) ? str : ' ' + str;
        }
      }
      fullText += line.trim() + '\n';
    }
    fullText += '\n';
  }

  return extractFromText(fullText);
}

// ─── Image OCR via Tesseract.js ───────────────────────────────────────────────

async function extractFromImage(file, onProgress) {
  const result = await Tesseract.recognize(file, 'eng', {
    logger: m => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });
  const text = result.data.text;
  if (!text || text.trim().length < 10) {
    throw new Error('OCR found no readable text in this image. Make sure the image is clear and well-lit.');
  }
  return extractFromText(text);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * readAndExtract(file, onProgress?)
 * onProgress(pct) is called during image OCR with 0–100
 */
export async function readAndExtract(file, onProgress) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|tiff?)$/.test(name)) {
    return extractFromImage(file, onProgress);
  }

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    const buffer = await readFileAsArrayBuffer(file);
    return extractFromPDF(buffer);
  }

  if (type === 'text/csv' || name.endsWith('.csv')) {
    const text = await readFileAsText(file);
    return extractFromCSV(text);
  }

  const text = await readFileAsText(file);
  return extractFromText(text);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsText(file);
  });
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('Failed to read file'));
    r.readAsArrayBuffer(file);
  });
}
