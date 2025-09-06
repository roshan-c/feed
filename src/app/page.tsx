"use client";
import { useInventoryStore } from "../store";
import { useState, useMemo, useEffect } from "react";
import { Ingredient } from "../types";
import toast, { Toaster } from "react-hot-toast";

export default function Home() {
  const { ingredients, removeIngredient, clearAll, fetchAll } = useInventoryStore();
  const [showEdit, setShowEdit] = useState<string | null>(null);
  const [tab, setTab] = useState<'inventory' | 'recipes'>('inventory');
  const [loaded, setLoaded] = useState(false);

  const sorted = useMemo(() => [...ingredients].sort((a,b)=> b.addedAt - a.addedAt), [ingredients]);

  useEffect(()=> {
    if(!loaded) {
      fetchAll().finally(()=> setLoaded(true));
    }
  }, [loaded, fetchAll]);

  return (
    <main className="py-6 space-y-6">
      <Toaster containerClassName="!top-4" />
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Kitchen</h1>
          <a href="/add" className="rounded-md bg-green-600 text-white px-4 py-2 text-sm font-medium active:scale-[.97]">Add</a>
        </div>
        <div className="flex rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-700">
          <button onClick={()=> setTab('inventory')} className={`flex-1 px-4 py-2 text-sm font-medium ${tab==='inventory' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}>Inventory</button>
          <button onClick={()=> setTab('recipes')} className={`flex-1 px-4 py-2 text-sm font-medium ${tab==='recipes' ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'}`}>Recipes</button>
        </div>
      </header>

      {tab === 'inventory' && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">You have {ingredients.length} ingredient{ingredients.length!==1 && 's'} stored.</p>
          <div className="flex gap-2">
            <button onClick={()=>{ if(confirm('Clear all ingredients?')) { clearAll(); toast.success('Inventory cleared'); } }} className="flex-1 rounded-md bg-neutral-200 dark:bg-neutral-800 px-4 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200">Clear</button>
          </div>

          {sorted.length === 0 && (
            <div className="text-center py-16 border border-dashed rounded-xl border-neutral-300 dark:border-neutral-700">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">No ingredients yet. Add some to get recipe ideas.</p>
            </div>
          )}

          {sorted.length > 0 && (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden">
              {sorted.map(item => (
                <li key={item.id} className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    {showEdit === item.id ? (
                      <InlineEditor ingredient={item} onDone={()=> setShowEdit(null)} />
                    ) : (
                      <>
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-xs text-neutral-500">{item.quantity} {item.unit}</p>
                      </>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {showEdit === item.id ? null : (
                      <button onClick={()=> setShowEdit(item.id)} className="text-xs px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-700">Edit</button>
                    )}
                    <button onClick={()=> { removeIngredient(item.id); toast.success('Removed'); }} className="text-xs px-2 py-1 rounded bg-red-500 text-white">Del</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-neutral-400 text-center pb-2">Synced to local SQLite DB.</p>
        </div>
      )}

      {tab === 'recipes' && (
        <div className="space-y-4">
          <RecipeWorkspace ingredients={ingredients} />
        </div>
      )}
    </main>
  );
}

function InlineEditor({ ingredient, onDone }: { ingredient: Ingredient; onDone: ()=>void }) {
  const { updateIngredient } = useInventoryStore();
  const [name, setName] = useState(ingredient.name);
  const [quantity, setQuantity] = useState(ingredient.quantity.toString());
  const [unit, setUnit] = useState(ingredient.unit);

  return (
    <form className="flex flex-col gap-1" onSubmit={(e)=> { e.preventDefault(); const q = parseFloat(quantity) || 0; updateIngredient(ingredient.id, { name, quantity: q, unit }); toast.success('Updated'); onDone(); }}>
      <input value={name} onChange={e=> setName(e.target.value)} className="text-sm px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800" />
      <div className="flex gap-1">
        <input value={quantity} onChange={e=> setQuantity(e.target.value)} className="w-20 text-sm px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800" />
        <input value={unit} onChange={e=> setUnit(e.target.value)} className="flex-1 text-sm px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800" />
        <button type="submit" className="text-xs px-2 py-1 rounded bg-green-600 text-white">Save</button>
        <button type="button" onClick={onDone} className="text-xs px-2 py-1 rounded bg-neutral-300 dark:bg-neutral-700">Cancel</button>
      </div>
    </form>
  );
}

function RecipeWorkspace({ ingredients }: { ingredients: Ingredient[] }) {
  const [loading, setLoading] = useState(false);
  interface RecipeIdea { id: string; title: string; ingredients: string[]; steps: string[] }
  const [ideas, setIdeas] = useState<RecipeIdea[] | null>(null);
  const has = ingredients.length > 0;
  async function generate() {
    if(!has) { toast.error('Add ingredients first'); return; }
    setLoading(true);
    setIdeas(null);
    try {
      const res = await fetch('/api/recipes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ingredients: ingredients.map(i=> i.name) }) });
      const data = await res.json();
      if(data.ideas) setIdeas(data.ideas);
      if(data.error) toast.error(data.error);
      else toast.success('Recipes ready');
    } catch {
      toast.error('Failed to get recipes');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={generate} disabled={loading || !has} className="flex-1 rounded-md bg-blue-600 text-white px-4 py-3 text-sm font-medium disabled:opacity-50 active:scale-[.98]">{loading ? 'Generating...' : 'Generate Ideas'}</button>
        <button onClick={()=> setIdeas(null)} disabled={!ideas} className="rounded-md px-3 py-3 text-xs bg-neutral-200 dark:bg-neutral-800 disabled:opacity-40">Reset</button>
      </div>
      {!has && <p className="text-xs text-neutral-500">Add some ingredients first to get ideas.</p>}
      {ideas && (
        <div className="space-y-3">
          {ideas.map(r => (
            <div key={r.id} className="p-4 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{r.title}</p>
                  <p className="text-[10px] text-neutral-500 mt-1">{r.ingredients?.join(', ')}</p>
                </div>
              </div>
              <ol className="list-decimal ml-4 mt-3 text-xs space-y-1">
                {r.steps?.map((s:string, idx:number)=>(<li key={idx}>{s}</li>))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
