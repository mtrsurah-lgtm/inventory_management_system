'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  changePercent?: number;
  icon: LucideIcon;
  subtext?: string;
  isNegativeGood?: boolean;
}

export function KPICard({
  title,
  value,
  changePercent = 0,
  icon: Icon,
  subtext = 'vs previous period',
  isNegativeGood = false,
}: KPICardProps) {
  const isPositive = changePercent >= 0;
  const isGood = isNegativeGood ? !isPositive : isPositive;

  return (
    <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-slate-900">{value}</span>
      </div>

      {changePercent !== undefined && changePercent !== 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span
            className={`inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded text-[11px] ${
              isGood ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}
          >
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? `+${changePercent}%` : `${changePercent}%`}
          </span>
          <span className="text-slate-400 text-[11px]">{subtext}</span>
        </div>
      )}
    </div>
  );
}

