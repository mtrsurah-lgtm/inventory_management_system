'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
} from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [stockStatus, setStockStatus] = useState('ALL');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    loadCategoriesAndBrands();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [search, selectedCategory, selectedBrand, stockStatus, page]);

  const loadCategoriesAndBrands = async () => {
    try {
      const [cRes, bRes] = await Promise.all([
        fetch('/api/v1/categories'),
        fetch('/api/v1/brands'),
      ]);
      const cJson = await cRes.json();
      const bJson = await bRes.json();
      if (cJson.success) setCategories(cJson.data);
      if (bJson.success) setBrands(bJson.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        search,
        categoryId: selectedCategory,
        brandId: selectedBrand,
        stockStatus,
      });

      const res = await fetch(`/api/v1/products?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setProducts(json.data);
        setMeta(json.meta);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to archive "${name}"?`)) return;
    try {
      const res = await fetch(`/api/v1/products/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        loadProducts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Product Catalog & Stock Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage SKUs, barcodes, multi-location stock, costs, selling prices, and reorder levels.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/v1/exports/products"
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </a>

            <Link
              href="/imports"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              <span>Bulk Import</span>
            </Link>

            <Link
              href="/inventory/products/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Product</span>
            </Link>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, SKU, or barcode..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Brand Filter */}
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Stock Status Pills */}
            <select
              value={stockStatus}
              onChange={(e) => {
                setStockStatus(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none font-medium"
            >
              <option value="ALL">All Stock Statuses</option>
              <option value="HEALTHY">Healthy Stock Only</option>
              <option value="LOW_STOCK">Low Stock (≤ Reorder Point)</option>
              <option value="OUT_OF_STOCK">Out of Stock (0 units)</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-semibold">Product Name & SKU</th>
                  <th className="py-3 px-3 font-semibold">Category</th>
                  <th className="py-3 px-3 font-semibold">Barcode</th>
                  <th className="py-3 px-3 font-semibold text-right">Cost Price</th>
                  <th className="py-3 px-3 font-semibold text-right">Selling Price</th>
                  <th className="py-3 px-3 font-semibold text-center">On-Hand</th>
                  <th className="py-3 px-3 font-semibold text-center">Reserved</th>
                  <th className="py-3 px-3 font-semibold text-center">Available</th>
                  <th className="py-3 px-3 font-semibold text-center">Health</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      Loading product catalog...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      No products matching the criteria found.
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const available = p.inventory?.available ?? 0;
                    const onHand = p.inventory?.onHand ?? 0;
                    const reserved = p.inventory?.reserved ?? 0;
                    const status = p.inventory?.healthStatus;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-900">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>SKU: {p.sku}</span>
                            {p.brand && <span>• {p.brand.name}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-600">{p.category?.name || '—'}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                          {p.barcode || '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-slate-700">
                          ${p.purchaseCost.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          ${p.sellingPrice.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-900">
                          {onHand}
                        </td>
                        <td className="py-3 px-3 text-center text-amber-700 font-medium">
                          {reserved > 0 ? reserved : '0'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-blue-600">
                          {available}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {status === 'OUT_OF_STOCK' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" /> Out of stock
                            </span>
                          ) : status === 'LOW_STOCK' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              <AlertTriangle className="w-3 h-3" /> Low stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="w-3 h-3" /> Healthy
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleArchive(p.id, p.name)}
                            title="Archive Product"
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {meta && meta.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {(page - 1) * meta.limit + 1} to{' '}
                {Math.min(page * meta.limit, meta.total)} of {meta.total} products
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium text-slate-800">
                  Page {page} of {meta.totalPages}
                </span>
                <button
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

