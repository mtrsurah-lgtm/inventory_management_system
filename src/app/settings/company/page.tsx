'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Settings,
  Building2,
  DollarSign,
  Clock,
  Percent,
  CheckCircle,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

export default function CompanySettingsPage() {
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('America/New_York');
  const [taxRate, setTaxRate] = useState('8.5');
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [negativeStockEnabled, setNegativeStockEnabled] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/settings/company');
      const json = await res.json();
      if (json.success && json.data) {
        setName(json.data.name);
        setCurrency(json.data.currency);
        setTimezone(json.data.timezone);
        setTaxRate(String(json.data.taxRate));
        setDateFormat(json.data.dateFormat);
        setNegativeStockEnabled(json.data.negativeStockEnabled);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);

    try {
      const res = await fetch('/api/v1/settings/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          currency,
          timezone,
          taxRate: parseFloat(taxRate) || 0,
          dateFormat,
          negativeStockEnabled,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to save settings');
      }

      setSuccessMessage('Company settings updated successfully.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Company Profile & Global Configuration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure enterprise currency, timezone, tax rates, and inventory overselling protection rules.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Company Information</span>
            </h3>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Company Legal Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Operational Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 outline-none"
                >
                  <option value="USD">USD — United States Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                  <option value="CAD">CAD — Canadian Dollar ($)</option>
                  <option value="AUD">AUD — Australian Dollar ($)</option>
                  <option value="JPY">JPY — Japanese Yen (¥)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">System Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 outline-none"
                >
                  <option value="America/New_York">Eastern Time (US / Canada)</option>
                  <option value="America/Chicago">Central Time (US / Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US / Canada)</option>
                  <option value="Europe/London">London / Greenwich Mean Time (GMT)</option>
                  <option value="UTC">Coordinated Universal Time (UTC)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Default Sales Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Date Display Format</label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 outline-none"
                >
                  <option value="YYYY-MM-DD">YYYY-MM-DD (ISO 8601)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (US Standard)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (European)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Critical Inventory Protection */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Overselling & Negative Inventory Control</span>
            </h3>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={negativeStockEnabled}
                  onChange={(e) => setNegativeStockEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 mt-0.5"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    Allow Negative Inventory (Overselling)
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                    When disabled (Recommended), sales orders, transfers, and POS checkouts will be
                    immediately rejected by the database transaction if available stock is insufficient.
                    Enable only if your business allows physical shipments prior to recorded supplier receipts.
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

