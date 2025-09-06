import { NextRequest } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET() {
  const items = await prisma.ingredient.findMany({ orderBy: { addedAt: 'asc' } });
  return new Response(JSON.stringify(items), { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, quantity = 0, unit = 'pcs' } = body || {};
    if (!name || typeof name !== 'string') return new Response(JSON.stringify({ error: 'Invalid name'}), { status: 400 });
    const item = await prisma.ingredient.create({ data: { name: name.trim(), quantity: Number(quantity)||0, unit: String(unit||'pcs') } });
    return new Response(JSON.stringify(item), { status: 201 });
  } catch {
    return new Response(JSON.stringify({ error: 'Create failed'}), { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...rest } = body || {};
    if (!id || typeof id !== 'string') return new Response(JSON.stringify({ error: 'Invalid id'}), { status: 400 });
    const item = await prisma.ingredient.update({ where: { id }, data: { ...('name' in rest ? { name: String(rest.name) } : {}), ...('quantity' in rest ? { quantity: Number(rest.quantity)||0 } : {}), ...('unit' in rest ? { unit: String(rest.unit) } : {}), } });
    return new Response(JSON.stringify(item), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Update failed'}), { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'Missing id'}), { status: 400 });
    await prisma.ingredient.delete({ where: { id } });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Delete failed'}), { status: 500 });
  }
}
