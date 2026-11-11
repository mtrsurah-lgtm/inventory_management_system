'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  ShoppingCart,
  Plus,
  Truck,
  Building2,
  Calendar,
  CheckCircle,
  AlertCircle,
  Package,
} from 'lucide-react';

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOrders();
    loadPrerequisites();
  }, []);

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/v1/purchases/orders');
      const json = await res.json();
      if (json.success) setOrders(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadPrerequisites = async () => {
    try {
      const [sRes, lRes, pRes] = await Promise.all([
        fetch('/api/v1/suppliers'),
        fetch('/api/v1/locations'),
        fetch('/api/v1/products?limit=100'),
      ]);
      const sJson = await sRes.json();
      const lJson = await lRes.json();
      const pJson = await pRes.json();

      if (sJson.success && sJson.data.length > 0) {
        setSuppliers(sJson.data);
        setSupplierId(sJson.data[0].id);
      }
      if (lJson.success && lJson.data.length > 0) {
        setLocations(lJson.data);
        setLocationId(lJson.data[0].id);
      }
      if (pJson.success) setProducts(pJson.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddItem = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod || orderItems.some((it) => it.productId === productId)) return;

    setOrderItems([
      ...orderItems,
      {
        productId,
        name: prod.name,
        sku: prod.sku,
        quantity: 10,
        unitCost: Number(prod.purchaseCost),
      },
    ]);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!supplierId || !locationId || orderItems.length === 0) {
      setError('Please select supplier, location, and add at least one line item.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/purchases/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          locationId,
          status: 'CONFIRMED',
          items: orderItems,
          notes,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create order');
      }

      setIsModalOpen(false);
      setOrderItems([]);
      loadOrders();
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
              Purchase Orders & Procurement
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Draft, confirm, and track vendor orders. Stock increases only when Goods Receiving (GRN) is posted.
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
            <span>Create Purchase Order</span>
          </button>
        </div>

        {/* PO Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">PO Number</th>
                  <th className="py-3 px-3 font-semibold">Supplier</th>
                  <th className="py-3 px-3 font-semibold">Warehouse</th>
                  <th className="py-3 px-3 font-semibold text-center">Items</th>
                  <th className="py-3 px-3 font-semibold text-right">Total Amount</th>
                  <th className="py-3 px-3 font-semibold text-center">Order Status</th>
                  <th className="py-3 px-3 font-semibold text-center">Payment Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                      No purchase orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-blue-600">{po.poNumber}</td>
                      <td className="py-3 px-3 font-sans font-semibold text-slate-900">
                        {po.supplier.name}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-700">{po.location.name}</td>
                      <td className="py-3 px-3 text-center font-bold text-slate-900 font-sans">
                        {po.itemCount} items
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        ${po.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            po.status === 'RECEIVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : po.status === 'PARTIALLY_RECEIVED'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {po.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <Link
                          href="/purchases/receipts"
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Receive Goods →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create PO Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Create Purchase Order</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 text-lg font-bold">×</button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 overflow-y-auto space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Supplier</label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Receiving Warehouse</label>
                  <select
                    value={locationId}
                    onChange={(e) => setLocationId(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Add Items */}
              <div className="space-y-1 pt-1">
                <label className="text-xs font-semibold text-slate-700">Add Line Item</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) handleAddItem(e.target.value);
                  }}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
                >
                  <option value="">Select product to order...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Cost: ${Number(p.purchaseCost).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                {orderItems.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No items selected yet.
                  </div>
                ) : (
                  orderItems.map((item, idx) => (
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
                            setOrderItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, quantity: val } : it))
                            );
                          }}
                          className="w-16 p-1 text-right border border-slate-200 rounded text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => setOrderItems((prev) => prev.filter((_, i) => i !== idx))}
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
                <label className="text-xs font-semibold text-slate-700">Order Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Terms, shipping instructions..."
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
                  disabled={isSubmitting || orderItems.length === 0}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  Save & Confirm PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

