'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { SalesChart } from '@/components/dashboard/SalesChart';
import { CompositionChart } from '@/components/dashboard/CompositionChart';
import { StockHealthChart } from '@/components/dashboard/StockHealthChart';
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  Package,
  AlertTriangle,
  XCircle,
  BarChart3,
  Calendar,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export default function DashboardPage() {
  const [period, setPeriod] = useState('this_month');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetchDashboardMetrics();
  }, [period]);

  const fetchDashboardMetrics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/reports/dashboard-kpis?period=${period}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const kpis = data?.kpis;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header / Period Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Operations Overview
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time multi-location inventory metrics, sales performance, and ledger health.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="bg-transparent outline-none cursor-pointer text-xs font-semibold text-slate-800"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="previous_week">Previous Week</option>
                <option value="this_month">This Month</option>
                <option value="previous_month">Previous Month</option>
                <option value="this_year">This Year</option>
              </select>
            </div>

            <button
              onClick={fetchDashboardMetrics}
              title="Refresh Data"
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* 8 Primary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Orders"
            value={kpis ? kpis.totalOrders.value : '-'}
            changePercent={kpis?.totalOrders.changePercent}
            icon={ShoppingBag}
          />
          <KPICard
            title="Net Sales"
            value={kpis ? `$${kpis.netSales.value.toLocaleString()}` : '-'}
            changePercent={kpis?.netSales.changePercent}
            icon={DollarSign}
          />
          <KPICard
            title="Gross Profit"
            value={kpis ? `$${kpis.grossProfit.value.toLocaleString()}` : '-'}
            changePercent={kpis?.grossProfit.changePercent}
            icon={TrendingUp}
          />
          <KPICard
            title="Units Sold"
            value={kpis ? kpis.totalUnitsSold.value.toLocaleString() : '-'}
            changePercent={kpis?.totalUnitsSold.changePercent}
            icon={BarChart3}
          />
          <KPICard
            title="Total Inventory Value"
            value={kpis ? `$${kpis.inventoryValuation.value.toLocaleString()}` : '-'}
            icon={Package}
            subtext="at weighted average cost"
          />
          <KPICard
            title="Low Stock Alerts"
            value={kpis ? kpis.lowStockAlerts.value : '-'}
            icon={AlertTriangle}
            isNegativeGood={true}
            subtext="reorder threshold reached"
          />
          <KPICard
            title="Out-of-Stock Products"
            value={kpis ? kpis.outOfStockProducts.value : '-'}
            icon={XCircle}
            isNegativeGood={true}
            subtext="immediate stockout"
          />
          <KPICard
            title="Gross Sales"
            value={kpis ? `$${kpis.grossSales.value.toLocaleString()}` : '-'}
            changePercent={kpis?.grossSales.changePercent}
            icon={DollarSign}
          />
        </div>

        {/* Charts Row 1: Sales Trends & Inventory Composition */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Revenue & Profit Trends</h3>
                <p className="text-xs text-slate-500">Historical performance across the selected date range</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Net Sales
                </span>
                <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Gross Profit
                </span>
              </div>
            </div>
            <SalesChart data={data?.trends || []} />
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Inventory Composition</h3>
              <p className="text-xs text-slate-500">Distribution by Category & Brand</p>
            </div>
            <CompositionChart
              data={data?.composition || { byCategory: [], byBrand: [] }}
            />
          </div>
        </div>

        {/* Charts Row 2: Stock Health & Hot-Selling Products */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Stock Health by Location</h3>
              <p className="text-xs text-slate-500">Healthy vs Low vs Out of Stock across warehouses</p>
            </div>
            <StockHealthChart data={data?.stockHealth || []} />
          </div>

          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Top-Selling Products</h3>
                <p className="text-xs text-slate-500">Fastest-moving items based on sales velocity</p>
              </div>
              <Link
                href="/reports"
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Full Valuation Report <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-y border-slate-100">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Product / SKU</th>
                    <th className="py-2.5 px-3 font-medium">Category</th>
                    <th className="py-2.5 px-3 font-medium text-right">Units Sold</th>
                    <th className="py-2.5 px-3 font-medium text-right">Velocity (Units/Day)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!data?.topSelling || data.topSelling.length === 0) ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No sales activity in this period.
                      </td>
                    </tr>
                  ) : (
                    data.topSelling.map((prod: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          <div>{prod.name}</div>
                          <div className="text-[10px] text-slate-400">{prod.sku}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{prod.categoryName}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                          {prod.netUnitsSold}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-blue-600">
                          {prod.velocityPerDay}/day
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                          ${prod.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Activity Table */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recent Sales Transactions</h3>
              <p className="text-xs text-slate-500">Audited live order ledger entries</p>
            </div>
            <Link
              href="/sales/orders"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All Orders <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-y border-slate-100">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Order Number</th>
                  <th className="py-2.5 px-3 font-medium">Date & Time</th>
                  <th className="py-2.5 px-3 font-medium">Customer</th>
                  <th className="py-2.5 px-3 font-medium">Location</th>
                  <th className="py-2.5 px-3 font-medium text-center">Items</th>
                  <th className="py-2.5 px-3 font-medium text-right">Total</th>
                  <th className="py-2.5 px-3 font-medium text-center">Payment</th>
                  <th className="py-2.5 px-3 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!data?.recentActivity || data.recentActivity.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      No recent sales transactions recorded.
                    </td>
                  </tr>
                ) : (
                  data.recentActivity.map((act: any) => (
                    <tr key={act.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 px-3 font-semibold text-blue-600 font-mono">
                        {act.orderNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(act.date).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-900 font-medium">{act.customer}</td>
                      <td className="py-2.5 px-3 text-slate-600">{act.location}</td>
                      <td className="py-2.5 px-3 text-center font-medium text-slate-700">
                        {act.itemsCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        ${act.totalAmount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {act.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {act.status}
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

