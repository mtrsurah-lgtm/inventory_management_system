'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import {
  Package,
  Scan,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Building2,
  DollarSign,
  Layers,
} from 'lucide-react';

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [purchaseCost, setPurchaseCost] = useState('0.00');
  const [sellingPrice, setSellingPrice] = useState('0.00');
  const [taxRate, setTaxRate] = useState('8.5');
  const [minStock, setMinStock] = useState('10');
  const [maxStock, setMaxStock] = useState('');
  const [openingStock, setOpeningStock] = useState('0');
  const [locationId, setLocationId] = useState('');
  const [trackSerial, setTrackSerial] = useState(false);
  const [trackBatch, setTrackBatch] = useState(false);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPrerequisites();
  }, []);

  const loadPrerequisites = async () => {
    try {
      const [cRes, bRes, uRes, lRes] = await Promise.all([
        fetch('/api/v1/categories'),
        fetch('/api/v1/brands'),
        fetch('/api/v1/units'),
        fetch('/api/v1/locations'),
      ]);
      const cJson = await cRes.json();
      const bJson = await bRes.json();
      const uJson = await uRes.json();
      const lJson = await lRes.json();

      if (cJson.success) setCategories(cJson.data);
      if (bJson.success) setBrands(bJson.data);
      if (uJson.success) {
        setUnits(uJson.data);
        if (uJson.data.length > 0) setUnitId(uJson.data[0].id);
      }
      if (lJson.success) {
        setLocations(lJson.data);
        const primary = lJson.data.find((l: any) => l.isPrimary);
        if (primary) setLocationId(primary.id);
        else if (lJson.data.length > 0) setLocationId(lJson.data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateSku = () => {
    const prefix = name ? name.slice(0, 3).toUpperCase() : 'PRD';
    const random = Math.floor(1000 + Math.random() * 9000);
    setSku(`${prefix}-${random}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = {
        name,
        sku,
        barcode: barcode || undefined,
        description,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
        unitId: unitId || undefined,
        purchaseCost: parseFloat(purchaseCost) || 0,
        sellingPrice: parseFloat(sellingPrice) || 0,
        taxRate: parseFloat(taxRate) || 0,
        minStock: parseFloat(minStock) || 10,
        maxStock: maxStock ? parseFloat(maxStock) : undefined,
        openingStock: parseFloat(openingStock) || 0,
        locationId,
        trackSerial,
        trackBatch,
      };

      const res = await fetch('/api/v1/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to create product');
      }

      router.push('/inventory/products');
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/inventory/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Products</span>
          </Link>
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Add New Inventory Product</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Register a new catalog item with SKU, barcode, costing, and initial opening stock ledger entry.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Information */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>General Product Information</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-slate-700">Product Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. MacBook Pro 16 M3 Max or Industrial Power Supply"
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700">SKU (Stock Keeping Unit) *</label>
                  <button
                    type="button"
                    onClick={handleGenerateSku}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    Auto-Generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value.toUpperCase())}
                  placeholder="e.g. MBP16-M3-BLK"
                  className="w-full text-xs font-mono border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Barcode (UPC/EAN)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan or enter barcode"
                    className="flex-1 text-xs font-mono border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
                    title="Scan Barcode with Camera or Hardware Scanner"
                  >
                    <Scan className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 outline-none"
                >
                  <option value="">Select Category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Brand / Manufacturer</label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 outline-none"
                >
                  <option value="">Select Brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-medium text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Product specifications, dimensions, notes..."
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Valuation */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Pricing & Unit Valuation</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Purchase Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  className="w-full text-xs font-semibold border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Selling Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  className="w-full text-xs font-bold text-slate-900 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Inventory Balances & Reorder Settings */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>Stock Control & Opening Balance</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Initial Opening Stock</label>
                <input
                  type="number"
                  min="0"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(e.target.value)}
                  className="w-full text-xs font-bold text-blue-600 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">Written to stock ledger</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Target Warehouse</label>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-800 outline-none"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Reorder Threshold</label>
                <input
                  type="number"
                  min="0"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400">Triggers Low Stock Alert</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Max Capacity (Optional)</label>
                <input
                  type="number"
                  min="0"
                  value={maxStock}
                  onChange={(e) => setMaxStock(e.target.value)}
                  placeholder="Optional"
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Tracking Settings */}
            <div className="pt-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={trackSerial}
                  onChange={(e) => setTrackSerial(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span>Track Individual Serial Numbers</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={trackBatch}
                  onChange={(e) => setTrackBatch(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <span>Track Batch / Lot & Expiry</span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/inventory/products"
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Registering Product...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Save Product & Post Opening Ledger</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => setBarcode(code)}
      />
    </DashboardLayout>
  );
}

