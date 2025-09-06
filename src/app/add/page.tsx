"use client";
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

const COMMON_UNITS = ['pcs','g','kg','ml','l','tbsp','tsp','cup'];
import { useInventoryStore } from '../../store';
import toast from 'react-hot-toast';

const TABS = ["Manual", "Photo OCR", "Barcode"] as const;

type Tab = typeof TABS[number];

export default function AddPage() {
  const [tab, setTab] = useState<Tab>('Manual');
  return (
    <main className="py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Add Ingredients</h1>
        <Link href="/" className="rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 px-3 py-2 text-sm font-medium active:scale-[.97]">Home</Link>
      </div>
      <div className="flex rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-700">
        {TABS.map(t => (
          <button key={t} onClick={()=> setTab(t)} className={`flex-1 px-3 py-2 text-sm font-medium ${tab===t ? 'bg-green-600 text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Manual' && <ManualForm />}
      {tab === 'Photo OCR' && <PhotoOCRSection />}
      {tab === 'Barcode' && <BarcodeScannerSection />}
    </main>
  );
}

function ManualForm() {
  const { addIngredient } = useInventoryStore();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [customUnit, setCustomUnit] = useState('');

  return (
    <form className="space-y-4" onSubmit={(e)=> { e.preventDefault(); if(!name) return; const finalUnit = unit === '__custom__' ? (customUnit || 'pcs') : unit; addIngredient({ name, quantity: parseFloat(quantity)||0, unit: finalUnit }); setName(''); setQuantity(''); setUnit(''); setCustomUnit(''); toast.success('Added'); }}>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-neutral-500">Name</label>
        <input value={name} onChange={e=> setName(e.target.value)} className="w-full rounded-md bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm" placeholder="e.g. Eggs" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs uppercase tracking-wide text-neutral-500">Quantity</label>
          <input value={quantity} onChange={e=> setQuantity(e.target.value)} className="w-full rounded-md bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm" placeholder="e.g. 12" />
        </div>
        <div className="w-32 space-y-1">
          <label className="text-xs uppercase tracking-wide text-neutral-500">Unit</label>
          {unit === '__custom__' ? (
            <input autoFocus value={customUnit} onChange={e=> setCustomUnit(e.target.value)} onBlur={()=> { if(!customUnit) { setUnit(''); setCustomUnit(''); } }} className="w-full rounded-md bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm" placeholder="enter unit" />
          ) : (
            <select value={unit} onChange={e=> { if(e.target.value==='__add') { setUnit('__custom__'); } else { setUnit(e.target.value); } }} className="w-full rounded-md bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-sm">
              <option value="">-</option>
              {COMMON_UNITS.map(u=> <option key={u} value={u}>{u}</option>)}
              <option value="__add">+ custom</option>
            </select>
          )}
        </div>
      </div>
      <button type="submit" className="w-full rounded-md bg-green-600 text-white py-3 font-medium text-sm active:scale-[.98]">Add</button>
    </form>
  );
}

function PhotoOCRSection() {
  const { addIngredient } = useInventoryStore();
  const [file, setFile] = useState<File| null>(null);
  const [preview, setPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ name:string; quantity:number; unit:string }>>([]);

  const onFile = (f: File | null) => {
    setResults([]);
    setFile(f);
    if(f) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview('');
    }
  };

  const runOCR = async () => {
    if(!file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch('/api/ocr', { method: 'POST', body: form });
      const data = await res.json();
      if(!res.ok || data.error) {
        toast.error(data.error || 'OCR failed');
      }
      setResults(data.ingredients || []);
      if(data.note) toast(data.note);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'OCR error';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const addSelected = () => {
    if(!results.length) return;
    results.forEach(r => addIngredient({ name: r.name, quantity: r.quantity, unit: r.unit }));
    toast.success('Imported ingredients');
    setResults([]);
    setFile(null);
    setPreview('');
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-sm space-y-3">
        <p className="font-medium">Receipt Photo OCR</p>
        <p className="text-neutral-500 text-xs">Upload a clear photo of a grocery receipt. Data stays local; image is sent to Gemini only for text extraction.</p>
        <input type="file" accept="image/*" capture="environment" onChange={e=> onFile(e.target.files?.[0] || null)} />
        {preview && (
          <div className="relative">
            <Image src={preview} alt="preview" width={400} height={400} className="max-h-48 rounded-md object-contain border border-neutral-300 dark:border-neutral-700" />
          </div>
        )}
        <div className="flex gap-2">
          <button disabled={!file || loading} onClick={runOCR} className="rounded-md bg-green-600 text-white px-4 py-2 text-xs disabled:opacity-50">{loading ? 'Processing...' : 'Run OCR'}</button>
          <button disabled={!results.length} onClick={addSelected} className="rounded-md bg-blue-600 text-white px-4 py-2 text-xs disabled:opacity-50">Add All</button>
          {file && <button onClick={()=> { onFile(null); }} className="rounded-md bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 px-4 py-2 text-xs">Reset</button>}
        </div>
      </div>
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Detected Ingredients</p>
          <ul className="space-y-2">
            {results.map((r,i)=>(
              <li key={i} className="rounded-md border border-neutral-300 dark:border-neutral-700 p-3 text-sm space-y-2 bg-white dark:bg-neutral-900">
                <div className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-neutral-500">Name</label>
                    <input value={r.name} onChange={e=> setResults(prev => prev.map((it,idx)=> idx===i ? { ...it, name: e.target.value } : it))} className="w-full rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-xs" />
                  </div>
                  <div className="w-20 space-y-1">
                    <label className="text-[10px] uppercase tracking-wide text-neutral-500">Qty</label>
                    <input value={r.quantity} onChange={e=> setResults(prev => prev.map((it,idx)=> idx===i ? { ...it, quantity: parseFloat(e.target.value)||0 } : it))} className="w-full rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-xs" />
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="text:[10px] uppercase tracking-wide text-neutral-500">Unit</label>
                    {r.unit === '__custom__' ? (
                      <input value={''} onChange={e=> setResults(prev => prev.map((it,idx)=> idx===i ? { ...it, unit: e.target.value } : it))} onBlur={()=> setResults(prev => prev.map((it,idx)=> idx===i ? { ...it, unit: it.unit === '__custom__' ? 'pcs' : it.unit } : it))} className="w-full rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-xs" placeholder="enter" />
                    ) : (
                      <select value={r.unit} onChange={e=> setResults(prev => prev.map((it,idx)=> idx===i ? { ...it, unit: e.target.value === '__add' ? '__custom__' : e.target.value } : it))} className="w-full rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-1 text-xs">
                        <option value="">-</option>
                        {COMMON_UNITS.map(u=> <option key={u} value={u}>{u}</option>)}
                        <option value="__add">+ custom</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <button onClick={()=> { const finalUnit = (r.unit==='__custom__' || !r.unit) ? 'pcs' : r.unit; addIngredient({ name: r.name.trim(), quantity: r.quantity, unit: finalUnit }); toast.success('Added'); setResults(prev => prev.filter((_,idx)=> idx!==i)); }} className="text-xs rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-1">Add</button>
                  <button onClick={()=> setResults(prev => prev.filter((_,idx)=> idx!==i))} className="text-[10px] text-red-500">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BarcodeScannerSection() {
  // Reworked: photo upload + decode instead of live camera
  const { addIngredient } = useInventoryStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [decoding, setDecoding] = useState(false);
  const [code, setCode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [product, setProduct] = useState<{ name:string; quantityGuess:number; unitGuess:string } | null>(null);
  const [error, setError] = useState('');

  const onFile = (f: File | null) => {
    setProduct(null); setCode(''); setError('');
    setFile(f);
    if(f) setPreview(URL.createObjectURL(f)); else setPreview('');
  };

  const decodeImage = async () => {
    if(!file) return;
    setDecoding(true); setError(''); setCode('');
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const imgBitmap = await createImageBitmap(file);
      // create an offscreen canvas
      const canvas = document.createElement('canvas');
      canvas.width = imgBitmap.width; canvas.height = imgBitmap.height;
      const ctx = canvas.getContext('2d');
      if(!ctx) throw new Error('Canvas unsupported');
      ctx.drawImage(imgBitmap,0,0);
      // Convert to data URL and decode
      const dataUrl = canvas.toDataURL('image/png');
      const result = await reader.decodeFromImageUrl(dataUrl);
      const value = result.getText();
      if(!value) throw new Error('No barcode detected');
      setCode(value);
      lookup(value);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Decode failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setDecoding(false);
    }
  };

  const lookup = async (c:string) => {
    setLookupLoading(true); setProduct(null);
    try {
      const res = await fetch(`/api/barcode?code=${encodeURIComponent(c)}`);
      const data = await res.json();
      if(!res.ok || data.error) {
        toast.error(data.error || 'Lookup failed');
      } else if(!data.found) {
        toast('Not found');
      } else {
        setProduct({ name: data.name || 'unknown product', quantityGuess: data.quantityGuess || 1, unitGuess: data.unitGuess || 'pcs' });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lookup error';
      toast.error(msg);
    } finally {
      setLookupLoading(false);
    }
  };

  const lookupManual = () => {
    const c = manualCode.trim();
    if(!c) return; setCode(c); lookup(c);
  };

  const addFromProduct = () => {
    if(!product) return;
    addIngredient({ name: product.name.toLowerCase(), quantity: product.quantityGuess, unit: product.unitGuess });
    toast.success('Added');
    setProduct(null); setCode(''); setManualCode(''); setFile(null); setPreview('');
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-sm space-y-3">
        <p className="font-medium">Barcode (Photo Upload)</p>
        <p className="text-neutral-500 text-xs">Take a clear photo of a barcode (sharp, good lighting) and upload it. We decode locally, then look up OpenFoodFacts.</p>
        <input type="file" accept="image/*" capture="environment" onChange={e=> onFile(e.target.files?.[0] || null)} />
        {preview && (
          <div className="relative">
            <Image src={preview} alt="barcode preview" width={400} height={400} className="max-h-48 rounded-md object-contain border border-neutral-300 dark:border-neutral-700" />
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button disabled={!file || decoding} onClick={decodeImage} className="rounded-md bg-green-600 text-white px-4 py-2 text-xs disabled:opacity-50">{decoding ? 'Decoding...' : 'Decode'}</button>
          <button disabled={!file} onClick={()=> onFile(null)} className="rounded-md bg-neutral-200 dark:bg-neutral-800 px-4 py-2 text-xs">Reset</button>
          {code && <span className="text-xs px-2 py-2">Code: {code}</span>}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] uppercase tracking-wide text-neutral-500">Manual Code</label>
            <input value={manualCode} onChange={e=> setManualCode(e.target.value)} placeholder="Enter digits" className="w-full rounded-md bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 px-2 py-2 text-xs" />
          </div>
          <button onClick={lookupManual} className="h-9 rounded-md bg-blue-600 text-white px-3 text-xs">Lookup</button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <p className="text-[10px] text-neutral-500">Tips: Fill frame, avoid glare, crop excess background, use high contrast.</p>
      </div>
      {lookupLoading && <p className="text-xs text-neutral-500">Looking up product...</p>}
      {product && (
        <div className="space-y-3 p-4 border rounded-md border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900">
          <p className="text-sm font-medium">{product.name}</p>
          <div className="flex gap-2 text-xs">
            <input type="number" min={0} value={product.quantityGuess} onChange={e=> setProduct(p=> p? { ...p, quantityGuess: parseFloat(e.target.value)||0 }: p)} className="w-24 rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-1" />
            <select value={product.unitGuess} onChange={e=> setProduct(p=> p? { ...p, unitGuess: e.target.value }: p)} className="w-28 rounded-md bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 px-2 py-1">
              {COMMON_UNITS.map(u=> <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={addFromProduct} className="rounded-md bg-blue-600 text-white px-4 py-2 text-xs">Add</button>
            <button onClick={()=> { setProduct(null); setCode(''); setManualCode(''); }} className="rounded-md bg-neutral-200 dark:bg-neutral-800 px-4 py-2 text-xs">Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}
