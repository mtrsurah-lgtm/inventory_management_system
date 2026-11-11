'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  FileBarChart,
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  Percent,
} from 'lucide-react';

export default function ReportsPage() {
  const [profitability, setProfitability] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCategories();
    loadProfitabilityReport();
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const res = await fetch('/api/v1/categories');
      const json = await res.json();
      if (json.success) setCategories(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadProfitabilityReport = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('categoryId', selectedCategory);

      const res = await fetch(`/api/v1/reports/profitability?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setProfitability(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const summary = profitability?.summary;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Profitability & Inventory Valuation Reports
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Accurate financial reconciliation with Weighted Average Costing, Cost of Goods Sold (COGS), and Gross Margins.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/v1/exports/products"
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Report</span>
            </a>
          </div>
        </div>

        {/* 5 Financial Summary KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Gross Sales</div>
            <div className="text-lg font-bold text-slate-900 mt-1">
              ${summary ? summary.grossSales.toLocaleString() : '0.00'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Discounts</div>
            <div className="text-lg font-bold text-slate-700 mt-1">
              ${summary ? summary.discounts.toLocaleString() : '0.00'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Net Sales</div>
            <div className="text-lg font-bold text-blue-600 mt-1">
              ${summary ? summary.netSales.toLocaleString() : '0.00'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Total COGS</div>
            <div className="text-lg font-bold text-slate-700 mt-1">
              ${summary ? summary.costOfGoodsSold.toLocaleString() : '0.00'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Gross Profit</div>
            <div className="text-lg font-bold text-emerald-600 mt-1">
              ${summary ? summary.grossProfit.toLocaleString() : '0.00'}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">Profit Margin</div>
            <div className="text-lg font-bold text-emerald-700 mt-1">
              {summary ? `${summary.profitMargin}%` : '0%'}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-700">Filter by Category:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg p-1.5 bg-slate-50 text-slate-800 outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Profitability by Product Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Profitability Breakdown by Product</h3>
            <span className="text-xs text-slate-500">
              {profitability?.items?.length || 0} Products Analyzed
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Product / SKU</th>
                  <th className="py-2.5 px-3 font-semibold">Category</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Units Sold</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gross Revenue</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Net Revenue</th>
                  <th className="py-2.5 px-3 font-semibold text-right">COGS</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Gross Profit</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Margin %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Calculating financial metrics...
                    </td>
                  </tr>
                ) : (!profitability?.items || profitability.items.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      No sales data available for this category filter.
                    </td>
                  </tr>
                ) : (
                  profitability.items.map((it: any) => (
                    <tr key={it.productId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{it.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{it.sku}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{it.category}</td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                        {it.unitsSold}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        ${it.grossRevenue.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-blue-600">
                        ${it.netRevenue.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-700">
                        ${it.cogs.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                        ${it.grossProfit.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {it.marginPercent}%
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

