import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { ingredients } = await req.json();
  if(!Array.isArray(ingredients)) {
    return new Response(JSON.stringify({ error: 'ingredients must be array of strings'}), { status: 400 });
  }
  const list = ingredients.join(', ');
  try {
    // Dynamic import to avoid bundle if key missing
    const { generateText } = await import('ai');
    const { createOpenAI } = await import('@ai-sdk/openai');
    if(!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = openai('gpt-4.1-mini');
    const prompt = `You are a helpful cooking assistant. Given the user's current ingredients: [${list}]. Generate 3 diverse recipe ideas that use ONLY these ingredients plus pantry staples (salt, pepper, oil, water). Respond ONLY with a strict, raw JSON array (no backticks, no prose) of exactly 3 objects shaped: {id: string (slug), title: string, ingredients: string[], steps: string[]}.`;
    const result = await generateText({ model, prompt });
    const raw = result.text.trim();
    let ideas: unknown;
    const attemptParse = (text:string) => {
      try {
        return JSON.parse(text);
      } catch {
        // try to extract first JSON array substring
        const match = text.match(/\[[\s\S]*\]/);
        if(match) {
          try { return JSON.parse(match[0]); } catch {}
        }
        return null;
      }
    };
    ideas = attemptParse(raw);
    if(!ideas) {
      // Retry with stricter reformulation instruction
      const repairPrompt = `${prompt}\nThe previous output was invalid. Re-output ONLY valid JSON array now.`;
      const repair = await generateText({ model, prompt: repairPrompt });
      ideas = attemptParse(repair.text.trim());
    }
    if(!Array.isArray(ideas)) throw new Error('Model JSON parse failed');
    // basic shape validation
    interface Idea { id: string; title: string; ingredients: unknown[]; steps: unknown[] }
    const filtered = (ideas as unknown[]).filter((r): r is { id:string; title:string; ingredients:string[]; steps:string[] } => {
      if(!r || typeof r !== 'object') return false;
      const obj = r as Partial<Idea> & { ingredients?: unknown; steps?: unknown };
      return typeof obj.id === 'string' && typeof obj.title === 'string' && Array.isArray(obj.ingredients) && Array.isArray(obj.steps);
    }) as Array<{ id:string; title:string; ingredients:string[]; steps:string[] }>;
    if(!filtered.length) throw new Error('Model JSON produced no valid entries');
    return new Response(JSON.stringify({ ideas: filtered }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    const fallback = [
      { id: 'fallback-1', title: 'Mixed Bowl', ingredients: ingredients.slice(0,3), steps: ['Combine ingredients','Season & serve'] }
    ];
    const msg = err instanceof Error ? err.message : 'error';
    return new Response(JSON.stringify({ ideas: fallback, note: 'fallback used', error: msg }), { status: 200 });
  }
}
