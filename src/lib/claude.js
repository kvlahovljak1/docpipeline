const API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are a document processing AI. Extract structured data from business documents (invoices, purchase orders).
Return ONLY a valid JSON object with these exact fields (use null for missing values, never omit a key):
{
  "documentType": "invoice" or "purchase_order",
  "supplier": "company/supplier name string or null",
  "documentNumber": "invoice or PO number string or null",
  "issueDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "currency": "3-letter ISO code e.g. USD, EUR or null",
  "lineItems": [
    { "description": "string", "qty": 1, "unitPrice": 0.00, "total": 0.00 }
  ],
  "subtotal": 0.00,
  "tax": 0.00,
  "total": 0.00
}
Return ONLY the raw JSON object. No markdown fences, no explanation, no extra text.`;

export async function extractDocument(textContent) {
  if (!API_KEY || API_KEY === 'your_api_key_here') {
    throw new Error('No API key set. Add REACT_APP_ANTHROPIC_API_KEY to your .env file.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extract structured data from this business document:\n\n${textContent.slice(0, 4000)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  const raw = (data.content || []).map(b => b.text || '').join('');
  const clean = raw.replace(/```json\n?|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw new Error('Could not parse extraction response as JSON');
  }
}

export async function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
