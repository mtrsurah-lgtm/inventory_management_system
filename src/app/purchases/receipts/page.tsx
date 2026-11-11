'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Package,
  Plus,
  CheckCircle,
  Truck,
  Building2,
  Calendar,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

export default function GoodsReceivingPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [receivedItems, setReceivedItems] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReceipts();
    loadPrerequisites();
  }, []);

  const loadReceipts = async () => {
    try {
      const res = await fetch('/api/v1/purchases/receipts');
      const json = await res.json();
      if (json.success) setReceipts(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPrerequisites = async () => {
    try {
      const [poRes, locRes, supRes, prodRes] = await Promise.all([
        fetch('/api/v1/purchases/orders'),
        fetch('/api/v1/locations'),
        fetch('/api/v1/suppliers'),
        fetch('/api/v1/products?limit=100'),
      ]);

      const poJson = await poRes.json();
      const locJson = await locRes.json();
      const supJson = await supRes.json();
      const prodJson = await prodRes.json();

      if (poJson.success) setPurchaseOrders(poJson.data);
      if (locJson.success) setLocations(locJson.data);
      if (supJson.success) setSuppliers(supJson.data);
      if (prodJson.success) setProducts(prodJson.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectPo = (poId: string) => {
    setSelectedPoId(poId);
    const found = purchaseOrders.find((p) => p.id === poId);
    if (found) {
      setSelectedLocationId(found.location.id);
      setSelectedSupplierId(found.supplier.id);
      setReceivedItems(
        found.items.map((it: any) => ({
          poItemId: it.id,
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          orderedQty: it.quantity,
          receivedSoFar: it.receivedQuantity,
          remainingQty: Math.max(0, it.quantity - it.receivedQuantity),
          quantityReceived: Math.max(0, it.quantity - it.receivedQuantity),
          quantityRejected: 0,
          unitCost: it.unitCost,
        }))
      );
    }
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        poId: selectedPoId || undefined,
        locationId: selectedLocationId,
        supplierId: selectedSupplierId,
        notes,
        items: receivedItems.map((it) => ({
          poItemId: it.poItemId,
          productId: it.productId,
          quantityReceived: Number(it.quantityReceived),
          quantityRejected: Number(it.quantityRejected || 0),
          unitCost: Number(it.unitCost),
        })),
      };

      const res = await fetch('/api/v1/purchases/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to post receipt');
      }

      setIsModalOpen(false);
      loadReceipts();
      loadPrerequisites();
    } catch (err: any) {
      setError(err.message || 'Receipt posting failed');
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
              Goods Receiving & Inventory Inwarding (GRN)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Confirm supplier deliveries, record accepted/rejected quantities, and automatically credit inventory ledgers.
            </p>
          </div>

          <button
            onClick={() => {
              setIsModalOpen(true);
              setError(null);
              if (purchaseOrders.length > 0) handleSelectPo(purchaseOrders[0].id);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Receive Delivery (Post GRN)</span>
          </button>
        </div>

        {/* Goods Receipt Records Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Posted Goods Receipt Notes</h3>
            <span className="text-xs text-slate-500">{receipts.length} Historical Receipts</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">GRN Number</th>
                  <th className="py-2.5 px-3 font-semibold">Linked PO</th>
                  <th className="py-2.5 px-3 font-semibold">Supplier</th>
                  <th className="py-2.5 px-3 font-semibold">Warehouse</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Items Received</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Receipt Date</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                      No posted goods receipts yet.
                    </td>
                  </tr>
                ) : (
                  receipts.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-bold text-blue-600">{r.receiptNumber}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-semibold">{r.poNumber || '—'}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-900 font-medium">
                        {r.supplier.name}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-700">{r.location.name}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                        {r.items.reduce((sum: number, it: any) => sum + it.quantityReceived, 0)} units
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                        {new Date(r.receivedDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {r.status}
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

      {/* Post Receipt Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Post Goods Receiving (GRN)</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitReceipt} className="p-6 overflow-y-auto space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Link Purchase Order</label>
                  <select
                    value={selectedPoId}
                    onChange={(e) => handleSelectPo(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                  >
                    <option value="">Select Confirmed PO</option>
                    {purchaseOrders.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber} — {po.supplier.name} ({po.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Receiving Warehouse</label>
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
              </div>

              {/* Items Verification List */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-800">Verify Received Quantities:</div>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {receivedItems.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-semibold text-slate-900">{item.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Ordered: {item.orderedQty} | Remaining: {item.remainingQty}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <label className="block text-[10px] font-medium text-slate-500">
                            Accepted Qty
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={item.remainingQty || 9999}
                            value={item.quantityReceived}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setReceivedItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, quantityReceived: val } : it))
                              );
                            }}
                            className="w-20 text-right p-1.5 border border-slate-200 rounded text-xs font-bold text-emerald-700"
                          />
                        </div>

                        <div className="text-right">
                          <label className="block text-[10px] font-medium text-slate-500">
                            Rejected / Damaged
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={item.quantityRejected}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setReceivedItems((prev) =>
                                prev.map((it, i) => (i === idx ? { ...it, quantityRejected: val } : it))
                              );
                            }}
                            className="w-20 text-right p-1.5 border border-slate-200 rounded text-xs text-rose-700"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Receiving Dock Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Carrier invoice #89192, pallet inspected at Bay 2"
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
                  disabled={isSubmitting || receivedItems.length === 0}
                  className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Posting to Ledger...</span>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Post Receipt & Increase Stock</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

