import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// OCR + parsing via Gemini (if key available). Accepts multipart/form-data with a single 'image' field.
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';
  try {
    if(contentType.includes('application/json')) {
      // backward compatibility: { imageBase64 }
      const body = await req.json();
      if(!body.imageBase64) throw new Error('Missing imageBase64');
      const buffer = Buffer.from(body.imageBase64, 'base64');
      return await processImageBuffer(buffer);
    } else if(contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('image');
      if(!file || typeof file === 'string') throw new Error('Missing image file');
      const arrayBuffer = await (file as unknown as Blob).arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return await processImageBuffer(buffer);
    } else {
      return new Response(JSON.stringify({ error: 'Unsupported content type'}), { status: 415 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'OCR failed';
    return new Response(JSON.stringify({ error: msg, ingredients: fallbackIngredients() }), { status: 200 });
  }
}

async function processImageBuffer(buffer: Buffer) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if(!apiKey) {
    return new Response(JSON.stringify({ note: 'Missing GOOGLE_API_KEY; using fallback parse', ingredients: fallbackIngredients() }), { status: 200 });
  }
  try {
    // Dynamic import to avoid bundling when key absent
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const base64 = buffer.toString('base64');
    const mimeType = 'image/jpeg'; // heuristic; could attempt magic number detection
    const prompt = `You are an OCR + ingredient normalization assistant.
Extract a concise list of grocery ingredients from the receipt image.
Return ONLY valid JSON array of objects: { name: string, quantity: number, unit: string }.
Normalize units (g, kg, ml, l, pcs). If quantity missing, set quantity=1 and unit='pcs'. No extra keys.`;
    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType } },
      { text: prompt }
    ]);
    const text = result.response.text().trim();
    const parsed = attemptJsonArray(text) || attemptJsonArray(stripMarkdownFences(text));
    if(!parsed) throw new Error('Parse error');
    const cleaned = parsed.filter(validateItem).map(normalizeItem);
    if(!cleaned.length) throw new Error('No valid items');
    return new Response(JSON.stringify({ ingredients: cleaned }), { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gemini failure';
    return new Response(JSON.stringify({ error: msg, ingredients: fallbackIngredients() }), { status: 200 });
  }
}

function attemptJsonArray(text: string) {
  try {
    const direct = JSON.parse(text);
    if(Array.isArray(direct)) return direct;
  } catch {}
  const match = text.match(/\[[\s\S]*\]/);
  if(match) {
    try { const arr = JSON.parse(match[0]); if(Array.isArray(arr)) return arr; } catch {}
  }
  return null;
}

function stripMarkdownFences(t: string) {
  return t.replace(/```json/gi,'').replace(/```/g,'').trim();
}

type RawItem = { name?: unknown; quantity?: unknown; unit?: unknown };
function isObject(v: unknown): v is Record<string, unknown> { return typeof v === 'object' && v !== null; }
function validateItem(i: unknown): i is RawItem & { name: string } {
  return isObject(i) && typeof i.name === 'string';
}

function normalizeItem(i: RawItem & { name: string }) {
  const quantity = typeof i.quantity === 'number' && !isNaN(i.quantity) ? i.quantity : 1;
  let unit = typeof i.unit === 'string' ? i.unit.toLowerCase() : 'pcs';
  const unitMap: Record<string,string> = { grams: 'g', gram: 'g', g: 'g', kilogram: 'kg', kilograms: 'kg', kg: 'kg', milliliter: 'ml', milliliters: 'ml', ml: 'ml', liter: 'l', liters: 'l', piece: 'pcs', pieces: 'pcs', pc: 'pcs', pcs: 'pcs' };
  unit = unitMap[unit] || unit;
  return { name: i.name.trim().toLowerCase(), quantity, unit };
}

function fallbackIngredients() {
  return [
    { name: 'tomato', quantity: 3, unit: 'pcs' },
    { name: 'flour', quantity: 500, unit: 'g' }
  ];
}
