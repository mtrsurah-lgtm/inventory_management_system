'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ArrowLeftRight,
  Plus,
  CheckCircle,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

export default function SalesReturnsPage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [salesOrderId, setSalesOrderId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [condition, setCondition] = useState('GOOD');
  const [restockApproved, setRestockApproved] = useState(true);
  const [reason, setReason] = useState('Customer returned unwanted item in original box');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReturns();
    loadPrerequisites();
  }, []);

  const loadReturns = async () => {
    try {
      const res = await fetch('/api/v1/sales/returns');
      const json = await res.json();
      if (json.success) setReturns(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPrerequisites = async () => {
    try {
      const [oRes, pRes] = await Promise.all([
        fetch('/api/v1/sales/orders'),
        fetch('/api/v1/products?limit=100'),
      ]);
      const oJson = await oRes.json();
      const pJson = await pRes.json();

      if (oJson.success) setSalesOrders(oJson.data);
      if (pJson.success && pJson.data.length > 0) {
        setProducts(pJson.data);
        setProductId(pJson.data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!productId) {
      setError('Please select a product.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        salesOrderId: salesOrderId || undefined,
        reason,
        restockApproved,
        items: [
          {
            productId,
            quantity: parseFloat(quantity) || 1,
            condition,
            restockApproved,
            reason,
          },
        ],
      };

      const res = await fetch('/api/v1/sales/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Return failed');
      }

      setIsModalOpen(false);
      loadReturns();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Customer Sales Returns & Restocking
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify returned condition. Restocking approval automatically increases sellable inventory in the movement ledger.
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
            <span>Process Sales Return</span>
          </button>
        </div>

        {/* Returns Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Return #</th>
                  <th className="py-3 px-3 font-semibold">Order Ref</th>
                  <th className="py-3 px-3 font-semibold">Customer</th>
                  <th className="py-3 px-3 font-semibold text-center">Items</th>
                  <th className="py-3 px-3 font-semibold text-center">Condition</th>
                  <th className="py-3 px-3 font-semibold text-center">Restocked</th>
                  <th className="py-3 px-3 font-semibold">Reason</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {returns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                      No sales returns on record.
                    </td>
                  </tr>
                ) : (
                  returns.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-blue-600">{r.returnNumber}</td>
                      <td className="py-3 px-3 text-slate-700 font-semibold">{r.orderNumber || 'Walk-in'}</td>
                      <td className="py-3 px-3 font-sans text-slate-900 font-medium">{r.customer?.name || 'Walk-in'}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900 font-sans">
                        {r.items.reduce((s: number, i: any) => s + i.quantity, 0)} units
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {r.items[0]?.condition || 'GOOD'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        {r.restockApproved ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Yes (+Stock)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">Discarded</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-600 max-w-xs truncate">{r.reason}</td>
                      <td className="py-3 px-4 text-center font-sans">
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

      {/* Add Return Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Process Customer Sales Return</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 text-lg font-bold">×</button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-3">
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Link Sales Order (Optional)</label>
                <select
                  value={salesOrderId}
                  onChange={(e) => setSalesOrderId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                >
                  <option value="">Walk-in / Direct Return</option>
                  {salesOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNumber} — {o.customer?.name || 'Walk-in'} (${o.totalAmount.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Returned Product</label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Returned Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 font-bold outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Product Condition</label>
                  <select
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none font-medium"
                  >
                    <option value="GOOD">Good / Resellable</option>
                    <option value="DAMAGED">Damaged Package</option>
                    <option value="DEFECTIVE">Defective / Return to Vendor</option>
                  </select>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={restockApproved}
                    onChange={(e) => setRestockApproved(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Approve for Restocking (Increases On-Hand Stock)</span>
                </label>
                <p className="text-[10px] text-slate-500 pl-6 mt-0.5">
                  Uncheck if item is broken and should not be added back to sellable inventory.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Return Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Unopened box, customer changed mind"
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  Confirm Return
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

