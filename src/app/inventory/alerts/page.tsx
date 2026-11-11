'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  AlertTriangle,
  XCircle,
  TrendingDown,
  ShoppingCart,
  CheckCircle,
  RefreshCw,
  Building2,
  DollarSign,
  ArrowRight,
} from 'lucide-react';

export default function InventoryAlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [reorders, setReorders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAlertsAndReorders();
  }, []);

  const loadAlertsAndReorders = async () => {
    setIsLoading(true);
    try {
      const [altRes, reorderRes] = await Promise.all([
        fetch('/api/v1/alerts'),
        fetch('/api/v1/stock/reorder-suggestions'),
      ]);
      const altJson = await altRes.json();
      const reorderJson = await reorderRes.json();

      if (altJson.success) setAlerts(altJson.data);
      if (reorderJson.success) setReorders(reorderJson.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Smart Inventory Alerts & Reorder Engine
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Proactive threshold monitoring, stockout prevention, and mathematical reorder suggestions.
            </p>
          </div>

          <button
            onClick={loadAlertsAndReorders}
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 shadow-2xs self-start sm:self-auto"
            title="Rescan Alerts"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

        {/* Section 1: Active Alerts Grid */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-slate-900">Active Stock Alerts</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {alerts.length} Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.length === 0 ? (
              <div className="col-span-2 py-8 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <p className="font-semibold text-slate-800">All inventory levels are optimal!</p>
                <p className="text-slate-400">No active out-of-stock or low-stock thresholds breached.</p>
              </div>
            ) : (
              alerts.map((alt) => (
                <div
                  key={alt.id}
                  className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                    alt.severity === 'CRITICAL'
                      ? 'bg-rose-50/60 border-rose-200'
                      : 'bg-amber-50/60 border-amber-200'
                  }`}
                >
                  <div className="mt-0.5">
                    {alt.severity === 'CRITICAL' ? (
                      <XCircle className="w-5 h-5 text-rose-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-900 truncate">
                        {alt.productName}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          alt.severity === 'CRITICAL'
                            ? 'bg-rose-200 text-rose-800'
                            : 'bg-amber-200 text-amber-800'
                        }`}
                      >
                        {alt.alertType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono">SKU: {alt.sku}</div>
                    <p className="text-xs text-slate-700 leading-snug">{alt.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 2: Mathematical Reorder Suggestions Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Mathematical Reorder Suggestions
              </h3>
              <p className="text-xs text-slate-500">
                Formula: (Avg Daily Demand × Lead Time) + Safety Stock buffer.
              </p>
            </div>
            <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {reorders.length} Suggested Reorders
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Product Name & SKU</th>
                  <th className="py-2.5 px-3 font-semibold">Warehouse</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Available Stock</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Daily Demand</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Lead Time</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Reorder Point</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Suggested Order Qty</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reorders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No products currently require reordering.
                    </td>
                  </tr>
                ) : (
                  reorders.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        <div className="font-semibold">{r.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{r.sku}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{r.locationName}</td>
                      <td
                        className={`py-2.5 px-3 text-center font-bold ${
                          r.currentAvailable <= 0 ? 'text-rose-600' : 'text-amber-600'
                        }`}
                      >
                        {r.currentAvailable}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-700">
                        {r.avgDailyDemand}/day
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-700">
                        {r.leadTimeDays} days
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-slate-900">
                        {r.suggestedReorderPoint} units
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-blue-600 text-sm">
                        +{r.suggestedOrderQuantity}
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-slate-900">
                        ${r.estimatedCost.toLocaleString()}
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

