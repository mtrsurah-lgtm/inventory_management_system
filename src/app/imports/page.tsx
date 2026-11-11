'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  UploadCloud,
  Download,
  CheckCircle,
  AlertCircle,
  FileText,
  Building2,
  ArrowRight,
  RefreshCw,
  Layers,
} from 'lucide-react';

export default function CsvImportPage() {
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [preview, setPreview] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      const res = await fetch('/api/v1/locations');
      const json = await res.json();
      if (json.success) {
        setLocations(json.data);
        const primary = json.data.find((l: any) => l.isPrimary);
        if (primary) setSelectedLocationId(primary.id);
        else if (json.data.length > 0) setSelectedLocationId(json.data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith('.csv')) {
      setError('Please select a valid .csv file.');
      return;
    }

    setFile(selected);
    setError(null);
    setPreview(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvContent(event.target?.result as string);
    };
    reader.readAsText(selected);
  };

  const handleValidateDryRun = async () => {
    if (!csvContent) return;
    setError(null);
    setIsValidating(true);

    try {
      const res = await fetch('/api/v1/imports/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'CSV validation failed');
      }

      setPreview(json.data);
    } catch (err: any) {
      setError(err.message || 'Validation error');
    } finally {
      setIsValidating(false);
    }
  };

  const handleProcessImport = async () => {
    if (!preview || !preview.validRows || preview.validRows.length === 0) return;
    if (!selectedLocationId) {
      setError('Please select a destination warehouse location.');
      return;
    }

    setError(null);
    setIsImporting(true);

    try {
      const res = await fetch('/api/v1/imports/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId: selectedLocationId,
          validRows: preview.validRows,
          filename: file?.name || 'bulk_products.csv',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Import execution failed');
      }

      setImportResult(json.data);
      setPreview(null);
      setFile(null);
      setCsvContent('');
    } catch (err: any) {
      setError(err.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Bulk CSV Product & Inventory Import Engine
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Two-stage import with pre-validation dry-run, duplicate checking, and safe stock ledger posting.
            </p>
          </div>

          <a
            href="/api/v1/imports/template"
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold rounded-lg shadow-2xs self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV Template</span>
          </a>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {importResult && (
          <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
              <span>Import Completed Successfully!</span>
            </div>
            <p>
              Successfully imported {importResult.importedCount} products into your catalog and
              recorded corresponding opening balances in the permanent stock movement ledger.
            </p>
          </div>
        )}

        {/* Step 1: Upload Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-semibold text-slate-900">Select CSV & Target Location</h3>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Target Warehouse for Stock</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 outline-none"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">CSV Spreadsheet File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          {file && !preview && (
            <div className="pt-2">
              <button
                onClick={handleValidateDryRun}
                disabled={isValidating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-2 shadow-xs"
              >
                {isValidating ? (
                  <span>Validating CSV Rows...</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Run Dry-Run Validation</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Step 2: Dry Run Validation Preview */}
        {preview && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-semibold text-slate-900">Validation Summary & Preview</h3>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {preview.validCount} Valid Rows
                </span>
                {preview.invalidCount > 0 && (
                  <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {preview.invalidCount} Errors
                  </span>
                )}
              </div>
            </div>

            {/* Error List if any */}
            {preview.errors && preview.errors.length > 0 && (
              <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 space-y-2">
                <div className="text-xs font-bold text-rose-800">
                  Validation detected {preview.errors.length} issue(s) that need correction:
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {preview.errors.map((err: any, idx: number) => (
                    <div key={idx} className="text-[11px] text-rose-700 flex items-center gap-2">
                      <span className="font-bold">Row {err.row}:</span>
                      <span>{err.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Valid Rows Table Preview */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-800">
                Ready to Import ({preview.validRows.length} items):
              </div>
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">SKU</th>
                      <th className="py-2 px-3">Item Name</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3 text-right">Cost</th>
                      <th className="py-2 px-3 text-right">Price</th>
                      <th className="py-2 px-3 text-center">Opening Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.validRows.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-medium text-slate-900">{r.sku}</td>
                        <td className="py-2 px-3 font-semibold text-slate-900">{r.name}</td>
                        <td className="py-2 px-3 text-slate-600">{r.category || '—'}</td>
                        <td className="py-2 px-3 text-right text-slate-700">
                          ${r.purchaseCost.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900">
                          ${r.sellingPrice.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-blue-600">
                          {r.openingStock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Commit Import Button */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleProcessImport}
                disabled={isImporting || preview.validCount === 0}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm"
              >
                {isImporting ? (
                  <span>Processing & Writing Ledger...</span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Confirm & Commit Import ({preview.validCount} Items)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

