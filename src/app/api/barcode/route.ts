import { NextRequest } from 'next/server';
import axios from 'axios';

export const runtime = 'nodejs';

interface OFFProduct {
  product_name?: string;
  product_name_en?: string; product_name_es?: string; product_name_fr?: string;
  generic_name?: string; generic_name_en?: string; generic_name_es?: string; generic_name_fr?: string;
  brands?: string;
  product_quantity?: string | number;
  product_quantity_unit?: string;
  quantity?: string;
}

function pickName(product: OFFProduct) {
  const candidates = [
    product.product_name,
    product.product_name_en,
    product.product_name_es,
    product.product_name_fr,
    product.generic_name,
    product.generic_name_en,
    product.generic_name_es,
    product.generic_name_fr,
    product.brands,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return 'Unknown product';
}

function guessQuantityAndUnit(product: OFFProduct) {
  let quantityGuess = 1;
  let unitGuess = 'pcs';
  const allowedUnits = new Set(['pcs','g','kg','ml','l','tbsp','tsp','cup']);

  if (product.product_quantity) {
    const q = parseFloat(String(product.product_quantity));
    if (!Number.isNaN(q) && q > 0) {
      quantityGuess = q;
      if (typeof product.product_quantity_unit === 'string' && product.product_quantity_unit.trim()) {
        const unit = product.product_quantity_unit.trim().toLowerCase();
        if (allowedUnits.has(unit)) unitGuess = unit;
      }
    }
  } else if (typeof product.quantity === 'string') {
    const m = product.quantity.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(\w+)/);
    if (m) {
      const q = parseFloat(m[1]);
      const unit = m[2];
      if (!Number.isNaN(q) && q > 0) quantityGuess = q;
      if (allowedUnits.has(unit)) unitGuess = unit;
    }
  }

  return { quantityGuess, unitGuess };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  if(!code) return new Response(JSON.stringify({ error: 'Missing code'}), { status: 400 });
  try {
    const r = await axios.get(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
    const product = r.data?.product;
    if(!product) return new Response(JSON.stringify({ found: false }), { status: 404 });

    const name = pickName(product);
    const { quantityGuess, unitGuess } = guessQuantityAndUnit(product);

    return new Response(JSON.stringify({ found: true, name, quantityGuess, unitGuess }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Lookup failed'}), { status: 500 });
  }
}
