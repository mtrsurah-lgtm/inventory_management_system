'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Store,
  Search,
  Calendar,
  Building2,
  DollarSign,
  Plus,
  ArrowRight,
} from 'lucide-react';

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/sales/orders');
      const json = await res.json();
      if (json.success) setOrders(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Sales Orders & Live Invoices
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Audited historical record of POS checkouts, corporate sales orders, and customer billing.
            </p>
          </div>

          <Link
            href="/pos"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Launch POS Checkout</span>
          </Link>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Order #</th>
                  <th className="py-3 px-3 font-semibold">Date & Time</th>
                  <th className="py-3 px-3 font-semibold">Customer</th>
                  <th className="py-3 px-3 font-semibold">Location</th>
                  <th className="py-3 px-3 font-semibold text-center">Type</th>
                  <th className="py-3 px-3 font-semibold text-right">Total</th>
                  <th className="py-3 px-3 font-semibold text-center">Payment</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                      No sales orders found. Complete a sale in the POS to begin.
                    </td>
                  </tr>
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-blue-600">{o.orderNumber}</td>
                      <td className="py-3 px-3 text-slate-500 text-[11px]">
                        {new Date(o.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-900 font-medium">
                        {o.customer?.name || 'Walk-in Customer'}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-700">{o.location.name}</td>
                      <td className="py-3 px-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {o.orderType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        ${o.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {o.status}
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
    </DashboardLayout>
  );
}

