/**
 * validateDocument
 * Pure JS validation — checks field presence, date logic, and math.
 */
export function validateDocument(doc) {
  const issues = [];
  const f = doc.extracted || {};

  // Required fields
  if (!f.supplier)        issues.push('Missing supplier name');
  if (!f.documentNumber)  issues.push('Missing document number');
  if (!f.issueDate)       issues.push('Missing issue date');
  if (!f.currency)        issues.push('Missing currency');
  if (!f.total)           issues.push('Missing total amount');

  // Date logic
  if (f.issueDate && f.dueDate) {
    const issue = new Date(f.issueDate);
    const due   = new Date(f.dueDate);
    if (!isNaN(issue) && !isNaN(due) && due < issue) {
      issues.push('Due date is before issue date');
    }
  }
  if (f.issueDate) {
    const yr = new Date(f.issueDate).getFullYear();
    if (!isNaN(yr) && (yr < 2000 || yr > 2099)) {
      issues.push(`Suspicious issue date year: ${yr}`);
    }
  }

  // Line item math
  if (Array.isArray(f.lineItems) && f.lineItems.length > 0) {
    let calcSubtotal = 0;

    f.lineItems.forEach((item, i) => {
      const qty       = parseFloat(item.qty       ?? 1);
      const unitPrice = parseFloat(item.unitPrice ?? 0);
      const stated    = parseFloat(item.total     ?? 0);
      const expected  = qty * unitPrice;

      if (Math.abs(expected - stated) > 0.02) {
        issues.push(
          `Line item ${i + 1} ("${item.description || 'unknown'}") mismatch` +
          ` — expected ${expected.toFixed(2)}, stated ${stated.toFixed(2)}`
        );
      }
      calcSubtotal += stated;
    });

    const subtotal = parseFloat(f.subtotal ?? 0);
    if (f.subtotal != null && Math.abs(calcSubtotal - subtotal) > 0.05) {
      issues.push(
        `Subtotal mismatch — items sum to ${calcSubtotal.toFixed(2)},` +
        ` stated ${subtotal.toFixed(2)}`
      );
    }

    const tax   = parseFloat(f.tax   ?? 0);
    const total = parseFloat(f.total ?? 0);
    if (f.subtotal != null && f.tax != null && f.total != null) {
      const expectedTotal = subtotal + tax;
      if (Math.abs(expectedTotal - total) > 0.05) {
        issues.push(
          `Total mismatch — subtotal + tax = ${expectedTotal.toFixed(2)},` +
          ` stated total = ${total.toFixed(2)}`
        );
      }
    }
  }

  return issues;
}

export function detectDuplicates(doc, allDocs) {
  const num = doc.extracted?.documentNumber;
  if (!num) return [];
  return allDocs
    .filter(d => d.id !== doc.id && d.extracted?.documentNumber === num)
    .map(d => d.name);
}
