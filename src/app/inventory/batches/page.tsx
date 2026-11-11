'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { 
  Barcode, Plus, Search, Filter, Calendar, AlertCircle, 
  CheckCircle, Clock, ShieldAlert, Tag, Building2, Hash 
} from 'lucide-react';

export default function BatchesAndSerialsPage() {
  const [activeTab, setActiveTab] = useState<'batches' | 'serials'>('batches');
  const [batches, setBatches] = useState<any[]>([]);
  const [serials, setSerials] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSerialModalOpen, setIsSerialModalOpen] = useState(false);

  // Form states
  const [newBatch, setNewBatch] = useState({
    productId: '',
    locationId: '',
    batchNumber: '',
    quantity: 0,
    manufactureDate: '',
    expiryDate: '',
    status: 'ACTIVE',
  });

  const [newSerials, setNewSerials] = useState({
    productId: '',
    locationId: '',
    serialsText: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [batchRes, serialRes, prodRes, locRes] = await Promise.all([
        fetch('/api/v1/stock/batches').then((r) => r.json()),
        fetch('/api/v1/stock/serials').then((r) => r.json()),
        fetch('/api/v1/products').then((r) => r.json()),
        fetch('/api/v1/locations').then((r) => r.json()),
      ]);

      if (batchRes.success) setBatches(batchRes.data || []);
      if (serialRes.success) setSerials(serialRes.data || []);
      if (prodRes.success) setProducts(prodRes.data || []);
      if (locRes.success) setLocations(locRes.data || []);
    } catch (err) {
      console.error('Failed to load batches/serials', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/stock/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newBatch,
          quantity: Number(newBatch.quantity),
          locationId: newBatch.locationId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsBatchModalOpen(false);
        setNewBatch({
          productId: '',
          locationId: '',
          batchNumber: '',
          quantity: 0,
          manufactureDate: '',
          expiryDate: '',
          status: 'ACTIVE',
        });
        fetchData();
      } else {
        alert(data.error || 'Failed to create batch');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSerials = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = newSerials.serialsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (list.length === 0) {
      alert('Please enter at least one serial number');
      return;
    }

    try {
      const res = await fetch('/api/v1/stock/serials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: newSerials.productId,
          locationId: newSerials.locationId || undefined,
          serialNumbers: list,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsSerialModalOpen(false);
        setNewSerials({ productId: '', locationId: '', serialsText: '' });
        fetchData();
      } else {
        alert(data.error || 'Failed to register serial numbers');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.product?.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'EXPIRING' && b.isExpiringSoon) ||
      (statusFilter === 'EXPIRED' && b.isExpired) ||
      b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredSerials = serials.filter((s) => {
    const matchesSearch =
      s.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.product?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.product?.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Barcode className="w-6 h-6 text-emerald-400" />
              Batches & Serial Number Tracking
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Trace product lots, expiration lifecycles, and discrete serial numbered units across warehouses.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'batches' ? (
              <button
                onClick={() => setIsBatchModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Register New Batch
              </button>
            ) : (
              <button
                onClick={() => setIsSerialModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Add Serial Numbers
              </button>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => {
              setActiveTab('batches');
              setStatusFilter('ALL');
            }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'batches'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag className="w-4 h-4" />
            Product Batches & Lots ({batches.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('serials');
              setStatusFilter('ALL');
            }}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'serials'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hash className="w-4 h-4" />
            Serialized Inventory ({serials.length})
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'batches' ? 'batches by number or product' : 'serial numbers'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Statuses</option>
              {activeTab === 'batches' ? (
                <>
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRING">Expiring in 30 Days</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="QUARANTINED">Quarantined</option>
                </>
              ) : (
                <>
                  <option value="IN_STOCK">In Stock</option>
                  <option value="SOLD">Sold</option>
                  <option value="TRANSFERRED">Transferred</option>
                  <option value="DEFECTIVE">Defective</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Content Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          {activeTab === 'batches' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 font-semibold border-b border-slate-700/60">
                  <tr>
                    <th className="px-5 py-3.5">Batch / Lot Number</th>
                    <th className="px-5 py-3.5">Product</th>
                    <th className="px-5 py-3.5">Location</th>
                    <th className="px-5 py-3.5 text-right">Quantity</th>
                    <th className="px-5 py-3.5">Mfg Date</th>
                    <th className="px-5 py-3.5">Expiry Date</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-500">
                        Loading batches...
                      </td>
                    </tr>
                  ) : filteredBatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-500">
                        No product batches found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 font-mono font-medium text-emerald-400">
                          {batch.batchNumber}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-200">{batch.product?.name}</div>
                          <div className="text-xs font-mono text-slate-500">{batch.product?.sku}</div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {batch.location?.name || 'All Warehouses'}
                        </td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-200">
                          {batch.quantity} {batch.product?.unit?.code || 'pcs'}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {batch.manufactureDate
                            ? new Date(batch.manufactureDate).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="px-5 py-4 text-xs">
                          {batch.expiryDate ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              <span
                                className={
                                  batch.isExpired
                                    ? 'text-red-400 font-semibold'
                                    : batch.isExpiringSoon
                                    ? 'text-amber-400 font-semibold'
                                    : 'text-slate-300'
                                }
                              >
                                {new Date(batch.expiryDate).toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            'No Expiry'
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {batch.isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/30">
                              <AlertCircle className="w-3 h-3" /> Expired
                            </span>
                          ) : batch.isExpiringSoon ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3" /> Expiring Soon
                            </span>
                          ) : batch.status === 'QUARANTINED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/30">
                              <ShieldAlert className="w-3 h-3" /> Quarantined
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                              <CheckCircle className="w-3 h-3" /> Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800/60 text-xs uppercase text-slate-400 font-semibold border-b border-slate-700/60">
                  <tr>
                    <th className="px-5 py-3.5">Serial Number</th>
                    <th className="px-5 py-3.5">Product</th>
                    <th className="px-5 py-3.5">Assigned Location</th>
                    <th className="px-5 py-3.5">Registered Date</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-500">
                        Loading serial numbers...
                      </td>
                    </tr>
                  ) : filteredSerials.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-slate-500">
                        No serialized items found.
                      </td>
                    </tr>
                  ) : (
                    filteredSerials.map((sn) => (
                      <tr key={sn.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-4 font-mono font-medium text-emerald-400">
                          {sn.serialNumber}
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-medium text-slate-200">{sn.product?.name}</div>
                          <div className="text-xs font-mono text-slate-500">{sn.product?.sku}</div>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {sn.location?.name || 'Unassigned'}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {new Date(sn.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border ${
                              sn.status === 'IN_STOCK'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : sn.status === 'SOLD'
                                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                                : sn.status === 'DEFECTIVE'
                                ? 'bg-red-500/10 text-red-300 border-red-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {sn.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Register New Batch */}
        {isBatchModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Tag className="w-5 h-5 text-emerald-400" />
                Register Product Batch / Lot
              </h2>

              <form onSubmit={handleCreateBatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Product *</label>
                  <select
                    required
                    value={newBatch.productId}
                    onChange={(e) => setNewBatch({ ...newBatch, productId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select a Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Batch Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LOT-2026-X01"
                      value={newBatch.batchNumber}
                      onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newBatch.quantity}
                      onChange={(e) => setNewBatch({ ...newBatch, quantity: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Warehouse Location</label>
                  <select
                    value={newBatch.locationId}
                    onChange={(e) => setNewBatch({ ...newBatch, locationId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">All / Unassigned</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Manufacture Date</label>
                    <input
                      type="date"
                      value={newBatch.manufactureDate}
                      onChange={(e) => setNewBatch({ ...newBatch, manufactureDate: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={newBatch.expiryDate}
                      onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsBatchModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Save Batch
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Register Serial Numbers */}
        {isSerialModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Hash className="w-5 h-5 text-emerald-400" />
                Register Serial Numbers
              </h2>

              <form onSubmit={handleCreateSerials} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Product *</label>
                  <select
                    required
                    value={newSerials.productId}
                    onChange={(e) => setNewSerials({ ...newSerials, productId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select a Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Warehouse Location</label>
                  <select
                    value={newSerials.locationId}
                    onChange={(e) => setNewSerials({ ...newSerials, locationId: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">All / Unassigned</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Serial Numbers (one per line or comma-separated) *
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder={`SN-8921-001\nSN-8921-002\nSN-8921-003`}
                    value={newSerials.serialsText}
                    onChange={(e) => setNewSerials({ ...newSerials, serialsText: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSerialModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Register Serials
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

