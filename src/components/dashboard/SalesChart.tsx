'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface SalesChartProps {
  data: Array<{
    date: string;
    sales: number;
    netSales: number;
    grossProfit: number;
  }>;
}

export function SalesChart({ data }: SalesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-72 flex items-center justify-center text-xs text-slate-400">
        No sales data available for the selected period
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="date"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(val) => `$${val.toLocaleString()}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              borderColor: '#334155',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#f8fafc',
            }}
            formatter={(value: any, name: string) => [
              `$${Number(value).toLocaleString()}`,
              name === 'netSales' ? 'Net Sales' : name === 'grossProfit' ? 'Gross Profit' : 'Gross Sales',
            ]}
          />
          <Area
            type="monotone"
            dataKey="netSales"
            stroke="#3b82f6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#salesGrad)"
            name="netSales"
          />
          <Area
            type="monotone"
            dataKey="grossProfit"
            stroke="#10b981"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#profitGrad)"
            name="grossProfit"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

