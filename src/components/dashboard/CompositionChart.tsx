'use client';

import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface CompositionChartProps {
  data: {
    byCategory: Array<{ name: string; quantity: number; valuation: number }>;
    byBrand: Array<{ name: string; quantity: number; valuation: number }>;
  };
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export function CompositionChart({ data }: CompositionChartProps) {
  const [metric, setMetric] = useState<'valuation' | 'quantity'>('valuation');
  const [viewType, setViewType] = useState<'category' | 'brand'>('category');

  const activeData = viewType === 'category' ? data.byCategory : data.byBrand;

  if (!activeData || activeData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
        No inventory data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Switchers */}
      <div className="flex items-center justify-between text-xs pb-1">
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setViewType('category')}
            className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
              viewType === 'category' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            By Category
          </button>
          <button
            onClick={() => setViewType('brand')}
            className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
              viewType === 'brand' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            By Brand
          </button>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setMetric('valuation')}
            className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
              metric === 'valuation' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Valuation ($)
          </button>
          <button
            onClick={() => setMetric('quantity')}
            className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
              metric === 'quantity' ? 'bg-white shadow-xs text-blue-600' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Units (Qty)
          </button>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={activeData}
              dataKey={metric}
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
            >
              {activeData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                borderColor: '#334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f8fafc',
              }}
              formatter={(val: any) => [
                metric === 'valuation' ? `$${Number(val).toLocaleString()}` : `${Number(val)} units`,
                metric === 'valuation' ? 'Total Value' : 'Quantity',
              ]}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', color: '#64748b' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

