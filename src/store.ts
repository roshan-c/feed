import { create } from 'zustand';
import { Ingredient } from './types';

interface InventoryState {
  ingredients: Ingredient[];
  fetchAll: () => Promise<void>;
  addIngredient: (partial: Omit<Ingredient, 'id' | 'addedAt'>) => Promise<void>;
  removeIngredient: (id: string) => Promise<void>;
  updateIngredient: (id: string, updates: Partial<Omit<Ingredient, 'id' | 'addedAt'>>) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useInventoryStore = create<InventoryState>()((set, get) => ({
  ingredients: [],
  fetchAll: async () => {
    const res = await fetch('/api/ingredients');
    if (!res.ok) return; // silent fail for now
    const data: Array<{ id: string; name: string; quantity: number; unit: string; addedAt: string | Date }> = await res.json();
    set({ ingredients: data.map(d => ({ id: d.id, name: d.name, quantity: d.quantity, unit: d.unit, addedAt: new Date(d.addedAt).getTime() })) });
  },
  addIngredient: async (partial) => {
    // optimistic
    const tempId = crypto.randomUUID();
    const tempItem: Ingredient = { id: tempId, addedAt: Date.now(), ...partial };
    set(state => ({ ingredients: [...state.ingredients, tempItem] }));
    try {
      const res = await fetch('/api/ingredients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(partial) });
      if (!res.ok) throw new Error('Create failed');
      const saved = await res.json();
      set(state => ({ ingredients: state.ingredients.map(i => i.id === tempId ? { id: saved.id, name: saved.name, quantity: saved.quantity, unit: saved.unit, addedAt: new Date(saved.addedAt).getTime() } : i) }));
    } catch {
      set(state => ({ ingredients: state.ingredients.filter(i => i.id !== tempId) }));
    }
  },
  removeIngredient: async (id) => {
    const prev = get().ingredients;
    set(state => ({ ingredients: state.ingredients.filter(i => i.id !== id) }));
    try {
      const res = await fetch(`/api/ingredients?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    } catch {
      set({ ingredients: prev });
    }
  },
  updateIngredient: async (id, updates) => {
    const prev = get().ingredients;
    set(state => ({ ingredients: state.ingredients.map(i => i.id === id ? { ...i, ...updates } : i) }));
    try {
      const res = await fetch('/api/ingredients', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...updates }) });
      if (!res.ok) throw new Error('Update failed');
      const saved = await res.json();
      set(state => ({ ingredients: state.ingredients.map(i => i.id === id ? { id: saved.id, name: saved.name, quantity: saved.quantity, unit: saved.unit, addedAt: new Date(saved.addedAt).getTime() } : i) }));
    } catch {
      set({ ingredients: prev });
    }
  },
  clearAll: async () => {
    const prev = get().ingredients;
    set({ ingredients: [] });
    // naive: delete each
    try {
      await Promise.all(prev.map(p => fetch(`/api/ingredients?id=${encodeURIComponent(p.id)}`, { method: 'DELETE' })));
    } catch {
      set({ ingredients: prev });
    }
  }
}));
