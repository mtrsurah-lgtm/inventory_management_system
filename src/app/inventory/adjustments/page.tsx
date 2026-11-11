'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Sliders,
  Plus,
  CheckCircle,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';

export default function AdjustmentsPage() {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [reason, setReason] = useState('Physical count correction');
  const [items, setItems] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAdjustments();
    loadPrerequisites();
  }, []);

  const loadAdjustments = async () => {
    try {
      const res = await fetch('/api/v1/stock/adjustments');
      const json = await res.json();
      if (json.success) setAdjustments(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPrerequisites = async () => {
    try {
      const [lRes, pRes] = await Promise.all([
        fetch('/api/v1/locations'),
        fetch('/api/v1/products?limit=100'),
      ]);
      const lJson = await lRes.json();
      const pJson = await pRes.json();

      if (lJson.success) {
        setLocations(lJson.data);
        if (lJson.data.length > 0) setSelectedLocationId(lJson.data[0].id);
      }
      if (pJson.success) {
        setProducts(pJson.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddItem = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    if (items.some((it) => it.productId === productId)) return;

    const available = prod.inventory?.available ?? 0;
    setItems([
      ...items,
      {
        productId,
        name: prod.name,
        sku: prod.sku,
        currentStock: available,
        adjustedStock: available,
        type: 'INCREASE',
        reason: '',
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedLocationId || items.length === 0) {
      setError('Please select a location and add at least one product.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        locationId: selectedLocationId,
        reason,
        notes,
        items: items.map((it) => ({
          productId: it.productId,
          adjustedStock: Number(it.adjustedStock),
          type: it.type,
          reason: it.reason || reason,
        })),
      };

      const res = await fetch('/api/v1/stock/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to post adjustment');
      }

      setIsModalOpen(false);
      setItems([]);
      loadAdjustments();
    } catch (err: any) {
      setError(err.message || 'Error posting adjustment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Stock Adjustments & Physical Inventory Reconciliation
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record cycle counts, write-offs, damages, and expired inventory with complete ledger accountability.
            </p>
          </div>

          <button
            onClick={() => {
              setIsModalOpen(true);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Record Stock Adjustment</span>
          </button>
        </div>

        {/* Adjustments Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Adjustment History</h3>
            <span className="text-xs text-slate-500">{adjustments.length} Records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Adjustment #</th>
                  <th className="py-2.5 px-3 font-semibold">Warehouse</th>
                  <th className="py-2.5 px-3 font-semibold">Primary Reason</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Items Adjusted</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Value Impact</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Date</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                      No stock adjustments on record.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-bold text-blue-600">{adj.adjustmentNumber}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-800">{adj.location.name}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-700 font-medium">{adj.reason}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900 font-sans">
                        {adj.items.length} items
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        ${adj.totalCost.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                        {new Date(adj.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {adj.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Post Stock Adjustment</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Affected Location</label>
                  <select
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Adjustment Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                  >
                    <option value="Physical count correction">Physical count correction (Cycle count)</option>
                    <option value="Damaged goods write-off">Damaged goods write-off</option>
                    <option value="Expired inventory">Expired inventory</option>
                    <option value="Missing or lost inventory">Missing or lost inventory</option>
                    <option value="Supplier discrepancy correction">Supplier discrepancy correction</option>
                  </select>
                </div>
              </div>

              {/* Add Product */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-slate-700">Add Product to Adjust</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) handleAddItem(e.target.value);
                  }}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                >
                  <option value="">Select product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Current: {p.inventory?.onHand ?? 0}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No items selected yet. Choose products from the dropdown above.
                  </div>
                ) : (
                  items.map((item, idx) => {
                    const diff = Number(item.adjustedStock) - Number(item.currentStock);

                    return (
                      <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Current On-Hand: {item.currentStock} units
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <label className="block text-[10px] font-medium text-slate-500">
                              Adjusted Stock Count
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.adjustedStock}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setItems((prev) =>
                                  prev.map((it, i) =>
                                    i === idx ? { ...it, adjustedStock: val } : it
                                  )
                                );
                              }}
                              className="w-20 text-right p-1.5 border border-slate-200 rounded text-xs font-bold text-slate-900"
                            />
                          </div>

                          <div className="w-16 text-right">
                            <div className="text-[10px] text-slate-400">Difference</div>
                            <div
                              className={`text-xs font-bold ${
                                diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : 'text-slate-400'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-slate-400 hover:text-rose-500 text-sm font-bold"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Audit Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Annual stocktake discrepancy verified by warehouse auditor"
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || items.length === 0}
                  className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Post Adjustment & Sync Ledger</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

