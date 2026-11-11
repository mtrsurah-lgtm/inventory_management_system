'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  History,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Building2,
  Calendar,
  Layers,
} from 'lucide-react';

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [selectedLocation, selectedType, page]);

  const loadLocations = async () => {
    try {
      const res = await fetch('/api/v1/locations');
      const json = await res.json();
      if (json.success) setLocations(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadMovements = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        locationId: selectedLocation,
        type: selectedType,
      });

      const res = await fetch(`/api/v1/stock/movements?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setMovements(json.data);
        setMeta(json.meta);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatMovementBadge = (type: string, qty: number) => {
    const isPositive = qty > 0;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
          isPositive
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}
      >
        {isPositive ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
        {type.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Permanent Stock Movement Ledger
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Immutable audited trail of every stock change: receipts, sales, transfers, adjustments, and returns.
            </p>
          </div>

          <button
            onClick={loadMovements}
            className="self-start sm:self-auto p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 shadow-2xs"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap gap-3">
          <div className="w-full sm:w-64">
            <select
              value={selectedLocation}
              onChange={(e) => {
                setSelectedLocation(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
            >
              <option value="">All Warehouses & Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-64">
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none font-medium"
            >
              <option value="ALL">All Movement Types</option>
              <option value="OPENING_BALANCE">Opening Balance</option>
              <option value="PURCHASE_RECEIPT">Purchase Receipt (Stock In)</option>
              <option value="SALE">Sale (Stock Out)</option>
              <option value="CUSTOMER_RETURN">Customer Return (Stock In)</option>
              <option value="TRANSFER_OUT">Transfer Out (Dispatched)</option>
              <option value="TRANSFER_IN">Transfer In (Received)</option>
              <option value="ADJUSTMENT_INCREASE">Adjustment Increase</option>
              <option value="ADJUSTMENT_DECREASE">Adjustment Decrease</option>
              <option value="DAMAGE_WRITE_OFF">Damage or Write-Off</option>
            </select>
          </div>
        </div>

        {/* Ledger Data Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Date & Time</th>
                  <th className="py-3 px-3 font-semibold">Product Name & SKU</th>
                  <th className="py-3 px-3 font-semibold">Location</th>
                  <th className="py-3 px-3 font-semibold">Movement Type</th>
                  <th className="py-3 px-3 font-semibold text-right">Quantity</th>
                  <th className="py-3 px-3 font-semibold text-right">Unit Cost</th>
                  <th className="py-3 px-3 font-semibold text-center">Balance Before</th>
                  <th className="py-3 px-3 font-semibold text-center">Balance After</th>
                  <th className="py-3 px-4 font-semibold">Audit Reason / Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                      Loading stock ledger records...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-sans">
                      No stock movements found.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => {
                    const isPositive = m.quantity > 0;

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-sans">
                          <div className="font-semibold text-slate-900">{m.productName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{m.sku}</div>
                        </td>
                        <td className="py-3 px-3 font-sans text-slate-700">{m.location.name}</td>
                        <td className="py-3 px-3 font-sans">
                          {formatMovementBadge(m.type, m.quantity)}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-bold text-xs ${
                            isPositive ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {isPositive ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-700">
                          ${m.unitCost.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-500">{m.balanceBefore}</td>
                        <td className="py-3 px-3 text-center font-bold text-slate-900">
                          {m.balanceAfter}
                        </td>
                        <td className="py-3 px-4 font-sans text-slate-600 text-[11px] max-w-xs truncate">
                          {m.reason || m.referenceType || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

