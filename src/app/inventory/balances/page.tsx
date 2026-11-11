'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Layers,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Building2,
  DollarSign,
  RefreshCw,
} from 'lucide-react';

export default function BalancesPage() {
  const [balances, setBalances] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadBalances();
  }, [selectedLocation, selectedStatus, search]);

  const loadLocations = async () => {
    try {
      const res = await fetch('/api/v1/locations');
      const json = await res.json();
      if (json.success) setLocations(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadBalances = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        locationId: selectedLocation,
        status: selectedStatus,
        search,
      });

      const res = await fetch(`/api/v1/stock/balances?${params.toString()}`);
      const json = await res.json();
      if (json.success) setBalances(json.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const totalValuation = balances.reduce((sum, b) => sum + b.valuation, 0);
  const totalOnHandUnits = balances.reduce((sum, b) => sum + b.onHand, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Live Multi-Warehouse Stock Balances
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Available = On-Hand Stock - Reserved Stock. Instant visibility across all warehouses.
            </p>
          </div>

          <button
            onClick={loadBalances}
            className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 shadow-2xs self-start sm:self-auto"
            title="Refresh Balances"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

        {/* Quick Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Inventory Value</div>
            <div className="text-xl font-bold text-slate-900 mt-1">
              ${totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">across selected warehouse scope</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Total On-Hand Units</div>
            <div className="text-xl font-bold text-blue-600 mt-1">
              {totalOnHandUnits.toLocaleString()} units
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">physical stock in storage</div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Tracked Product Rows</div>
            <div className="text-xl font-bold text-slate-900 mt-1">{balances.length} items</div>
            <div className="text-[10px] text-slate-400 mt-0.5">with live balance records</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, SKU, or barcode..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
          >
            <option value="">All Warehouses</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none font-medium"
          >
            <option value="ALL">All Stock Statuses</option>
            <option value="HEALTHY">Healthy Stock Only</option>
            <option value="LOW_STOCK">Low Stock (≤ Threshold)</option>
            <option value="OUT_OF_STOCK">Out of Stock (0 units)</option>
          </select>
        </div>

        {/* Data Grid */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Product Name & SKU</th>
                  <th className="py-3 px-3 font-semibold">Warehouse Location</th>
                  <th className="py-3 px-3 font-semibold text-center">On-Hand Stock</th>
                  <th className="py-3 px-3 font-semibold text-center">Reserved</th>
                  <th className="py-3 px-3 font-semibold text-center">Available Stock</th>
                  <th className="py-3 px-3 font-semibold text-right">Unit Cost</th>
                  <th className="py-3 px-3 font-semibold text-right">Valuation</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Loading stock balances...
                    </td>
                  </tr>
                ) : balances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No stock balances found matching criteria.
                    </td>
                  </tr>
                ) : (
                  balances.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-medium text-slate-900">
                        <div className="font-semibold">{b.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{b.sku}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">{b.location.name}</td>
                      <td className="py-3 px-3 text-center font-semibold text-slate-900">
                        {b.onHand} {b.unit}
                      </td>
                      <td className="py-3 px-3 text-center text-amber-700 font-medium">
                        {b.reserved > 0 ? `${b.reserved} ${b.unit}` : '0'}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-blue-600 text-sm">
                        {b.available} {b.unit}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        ${b.unitCost.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        ${b.valuation.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {b.healthStatus === 'OUT_OF_STOCK' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            <XCircle className="w-3 h-3" /> Out of stock
                          </span>
                        ) : b.healthStatus === 'LOW_STOCK' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> Low stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle className="w-3 h-3" /> Healthy
                          </span>
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
    </DashboardLayout>
  );
}

