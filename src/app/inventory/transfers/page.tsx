'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeftRight,
  Plus,
  Send,
  CheckCircle,
  Truck,
  Building2,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [sourceId, setSourceId] = useState('');
  const [destId, setDestId] = useState('');
  const [transferItems, setTransferItems] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTransfers();
    loadPrerequisites();
  }, []);

  const loadTransfers = async () => {
    try {
      const res = await fetch('/api/v1/stock/transfers');
      const json = await res.json();
      if (json.success) setTransfers(json.data);
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
        if (lJson.data.length >= 2) {
          setSourceId(lJson.data[0].id);
          setDestId(lJson.data[1].id);
        }
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
    if (transferItems.some((it) => it.productId === productId)) return;

    setTransferItems([
      ...transferItems,
      {
        productId,
        name: prod.name,
        sku: prod.sku,
        quantity: 1,
      },
    ]);
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (sourceId === destId) {
      setError('Source and Destination locations must be different.');
      return;
    }
    if (transferItems.length === 0) {
      setError('Please add at least one item to transfer.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/stock/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLocationId: sourceId,
          destinationLocationId: destId,
          items: transferItems,
          notes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create transfer');
      }

      setIsNewModalOpen(false);
      setTransferItems([]);
      loadTransfers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDispatch = async (transferId: string) => {
    if (!confirm('Dispatch this transfer? Stock will be deducted from source and placed in-transit.')) return;
    try {
      const res = await fetch(`/api/v1/stock/transfers/${transferId}/dispatch`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        loadTransfers();
      } else {
        alert(json.error?.message || 'Dispatch failed');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReceive = async (transfer: any) => {
    if (!confirm(`Confirm receipt of transfer ${transfer.transferNumber} at destination?`)) return;
    try {
      const receivedItems = transfer.items.map((i: any) => ({
        itemId: i.id,
        quantityReceived: i.quantityDispatched,
        quantityDamaged: 0,
      }));

      const res = await fetch(`/api/v1/stock/transfers/${transfer.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receivedItems }),
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        loadTransfers();
      } else {
        alert(json.error?.message || 'Receive failed');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Inter-Warehouse Stock Transfers
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-stage workflow: Draft → Dispatched (In-Transit) → Destination Receiving Confirmation.
            </p>
          </div>

          <button
            onClick={() => {
              setIsNewModalOpen(true);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Transfer</span>
          </button>
        </div>

        {/* Transfers Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Stock Transfer Registry</h3>
            <span className="text-xs text-slate-500">{transfers.length} Transfers</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Transfer Number</th>
                  <th className="py-2.5 px-3 font-semibold">Source Warehouse</th>
                  <th className="py-2.5 px-3 font-semibold">Destination Warehouse</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Items</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Workflow Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                      No stock transfers found. Create one to begin.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-bold text-blue-600">{t.transferNumber}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-800">{t.sourceLocation.name}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-800">{t.destinationLocation.name}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900 font-sans">
                        {t.items.reduce((s: number, i: any) => s + i.quantityDispatched, 0)} units ({t.itemCount} items)
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : t.status === 'DISPATCHED'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-sans">
                        {t.status === 'DRAFT' && (
                          <button
                            onClick={() => handleDispatch(t.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-semibold"
                          >
                            <Send className="w-3 h-3" />
                            <span>Dispatch</span>
                          </button>
                        )}
                        {t.status === 'DISPATCHED' && (
                          <button
                            onClick={() => handleReceive(t)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Confirm Receipt</span>
                          </button>
                        )}
                        {t.status === 'COMPLETED' && (
                          <span className="text-[11px] text-slate-400 font-medium">Reconciled</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* New Transfer Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Initiate Inter-Warehouse Transfer</h3>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateTransfer} className="p-6 overflow-y-auto space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Source Location</label>
                  <select
                    value={sourceId}
                    onChange={(e) => setSourceId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Destination Location</label>
                  <select
                    value={destId}
                    onChange={(e) => setDestId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Product Selector */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-slate-700">Add Item to Transfer</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) handleAddItem(e.target.value);
                  }}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                >
                  <option value="">Select product to add...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Available: {p.inventory?.available ?? 0}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {transferItems.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No items selected yet. Choose products from the dropdown above.
                  </div>
                ) : (
                  transferItems.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-slate-500">Qty:</label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 1;
                            setTransferItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                            );
                          }}
                          className="w-16 p-1 text-right border border-slate-200 rounded text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setTransferItems((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="text-slate-400 hover:text-rose-500 p-1 text-sm font-bold"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Transfer Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Replenishment for flagship storefront"
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || transferItems.length === 0}
                  className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span>Create Transfer Draft</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

