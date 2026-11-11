'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  FileText, ArrowLeft, CheckCircle, Shield, Database, 
  Search, ExternalLink, Code2, Copy, Check 
} from 'lucide-react';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  category: string;
  summary: string;
  description: string;
  authRequired: boolean;
  sampleBody?: string;
  sampleResponse?: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/health',
    category: 'System & Health',
    summary: 'System health check and database connectivity',
    description: 'Returns real-time operational status, database query latency, process uptime, and memory consumption.',
    authRequired: false,
    sampleResponse: JSON.stringify({
      status: 'healthy',
      version: '1.0.0',
      uptimeSeconds: 342,
      database: { status: 'healthy', latencyMs: 3 },
      system: { memory: { rssMb: 112, heapUsedMb: 64 } }
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/auth/login',
    category: 'Authentication',
    summary: 'Authenticate user and issue JWT token',
    description: 'Validates user credentials, creates a secure session, and sets HTTP-only cookies.',
    authRequired: false,
    sampleBody: JSON.stringify({ email: 'admin@inventorypro.com', password: 'Password123!' }, null, 2),
    sampleResponse: JSON.stringify({
      success: true,
      data: {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: { id: 'usr_1', email: 'admin@inventorypro.com', role: 'SUPER_ADMIN' }
      }
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/products',
    category: 'Catalog & Products',
    summary: 'List products with aggregated multi-location balances',
    description: 'Retrieves all products, supporting search, category filter, and brand aggregation.',
    authRequired: true,
    sampleResponse: JSON.stringify({
      success: true,
      data: [
        { id: 'prod_1', name: 'Industrial Barcode Scanner', sku: 'SCAN-IND-01', sellingPrice: 289.99, totalOnHand: 45 }
      ]
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/products',
    category: 'Catalog & Products',
    summary: 'Create product with opening stock ledger record',
    description: 'Validates uniqueness of SKU and barcode, creates product record, and posts initial stock movement.',
    authRequired: true,
    sampleBody: JSON.stringify({
      name: 'Wireless Ergonomic Scanner',
      sku: 'SCAN-WIR-02',
      barcode: '890123456789',
      purchaseCost: 75.00,
      sellingPrice: 149.99,
      categoryId: 'cat_electronics',
      initialStock: 25,
      locationId: 'loc_main_wh'
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/stock/balances',
    category: 'Stock Management',
    summary: 'Real-time multi-warehouse stock balances',
    description: 'Calculates Available = On-Hand - Reserved stock across specified location filters.',
    authRequired: true,
    sampleResponse: JSON.stringify({
      success: true,
      data: [
        { productId: 'prod_1', locationName: 'Main Warehouse', onHand: 100, reserved: 10, available: 90, inTransit: 0 }
      ]
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/stock/movements',
    category: 'Stock Management',
    summary: 'Immutable stock movement ledger audit log',
    description: 'Returns chronological ledger movements (OPENING_BALANCE, PURCHASE_RECEIPT, SALE, TRANSFER_IN, etc.).',
    authRequired: true,
    sampleResponse: JSON.stringify({
      success: true,
      data: [
        { movementType: 'PURCHASE_RECEIPT', quantity: 50, referenceType: 'PURCHASE_RECEIPT', referenceId: 'grn_1' }
      ]
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/stock/adjustments',
    category: 'Stock Management',
    summary: 'Post discrepancy adjustment with reason audit',
    description: 'Requires authorized role, updates inventory balance atomically, and generates ledger audit line.',
    authRequired: true,
    sampleBody: JSON.stringify({
      locationId: 'loc_main_wh',
      reason: 'Physical inventory cycle count verification',
      items: [{ productId: 'prod_1', quantity: 2, type: 'DECREASE' }]
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/stock/transfers',
    category: 'Stock Management',
    summary: 'Initiate inter-warehouse stock transfer',
    description: 'Creates transfer order in DRAFT status between source and destination warehouses.',
    authRequired: true,
    sampleBody: JSON.stringify({
      sourceLocationId: 'loc_main_wh',
      destinationLocationId: 'loc_store_1',
      items: [{ productId: 'prod_1', quantity: 15 }]
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/purchases/orders',
    category: 'Procurement',
    summary: 'Create purchase order without increasing stock',
    description: 'Establishes purchase order with vendor. Stock remains unchanged until goods receipt (GRN) is posted.',
    authRequired: true,
    sampleBody: JSON.stringify({
      supplierId: 'supp_1',
      locationId: 'loc_main_wh',
      items: [{ productId: 'prod_1', quantity: 50, unitCost: 120.00 }]
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/purchases/receipts',
    category: 'Procurement',
    summary: 'Post goods receipt note (GRN) and increment stock',
    description: 'Increases warehouse on-hand stock atomically for verified received quantities.',
    authRequired: true,
    sampleBody: JSON.stringify({
      purchaseOrderId: 'po_1',
      locationId: 'loc_main_wh',
      items: [{ purchaseOrderItemId: 'poi_1', productId: 'prod_1', receivedQuantity: 50, rejectedQuantity: 0, unitCost: 120.00 }]
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/sales/checkout',
    category: 'Sales & POS',
    summary: 'Execute point of sale checkout transaction',
    description: 'Validates inventory availability, deducts on-hand stock, records sale, and issues printable receipt data.',
    authRequired: true,
    sampleBody: JSON.stringify({
      locationId: 'loc_store_1',
      paymentMethod: 'CARD',
      amountPaid: 289.99,
      items: [{ productId: 'prod_1', quantity: 1, unitPrice: 289.99 }]
    }, null, 2),
  },
  {
    method: 'POST',
    path: '/api/v1/sales/returns',
    category: 'Sales & POS',
    summary: 'Process return with inspection quarantine gate',
    description: 'Restocks inventory ONLY if condition is inspected and restockApproved is set to true.',
    authRequired: true,
    sampleBody: JSON.stringify({
      salesOrderId: 'so_1',
      locationId: 'loc_store_1',
      reason: 'Customer ordered wrong size',
      items: [{ productId: 'prod_1', quantity: 1, condition: 'UNOPENED', restockApproved: true }]
    }, null, 2),
  },
  {
    method: 'GET',
    path: '/api/v1/reports/dashboard-kpis',
    category: 'Reports & Analytics',
    summary: 'Real-time executive KPI metrics & charts',
    description: 'Computes total valuation, sales revenue, low stock count, sales velocity, and gross margins.',
    authRequired: true,
  },
  {
    method: 'POST',
    path: '/api/v1/imports/validate',
    category: 'Bulk Data Engine',
    summary: 'Dry-run validation of bulk CSV import',
    description: 'Verifies format, headers, duplicate SKUs, and category references without mutating database.',
    authRequired: true,
  }
];

export default function ApiDocsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const categories = ['ALL', ...Array.from(new Set(ENDPOINTS.map((e) => e.category)))];

  const filteredEndpoints = ENDPOINTS.filter((endpoint) => {
    const matchesCategory = selectedCategory === 'ALL' || endpoint.category === selectedCategory;
    const matchesSearch = 
      endpoint.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      endpoint.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopy = (text: string, path: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const getMethodBadge = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-blue-900/60 text-blue-300 border-blue-700/60';
      case 'POST':
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/60';
      case 'PUT':
        return 'bg-amber-900/60 text-amber-300 border-amber-700/60';
      case 'DELETE':
        return 'bg-red-900/60 text-red-300 border-red-700/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
              <span className="text-slate-600">/</span>
              <span className="text-sm font-medium text-emerald-400">OpenAPI 3.0 Documentation</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mt-2 flex items-center gap-3">
              <FileText className="w-8 h-8 text-emerald-400" />
              Inventory Pro API Reference
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Production-ready RESTful API gateway with JWT authorization, double-entry stock ledger, and real-time operations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/docs/openapi.json"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg text-sm font-medium text-slate-200 transition-colors shadow-sm"
            >
              <Code2 className="w-4 h-4 text-emerald-400" />
              Raw OpenAPI JSON
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Global Details & Architecture Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <Shield className="w-4 h-4" />
              Authentication & Security
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Standard Bearer Token via <code className="text-slate-300">Authorization: Bearer &lt;jwt&gt;</code> or session cookies. Enforces tenant boundary isolation.
            </p>
          </div>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
              <Database className="w-4 h-4" />
              Ledger Invariant Guarantee
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Stock balance mutations write immutable ledger audit rows. Available stock is calculated as <code className="text-slate-300">On-Hand - Reserved</code>.
            </p>
          </div>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl">
            <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
              <CheckCircle className="w-4 h-4" />
              Standard Envelope
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              All responses follow <code className="text-slate-300">&#123; success, data, message, error &#125;</code> for consistent client consumption.
            </p>
          </div>
        </div>

        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search endpoints by path, summary, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border ${
                  selectedCategory === cat
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Endpoints List */}
        <div className="space-y-4">
          {filteredEndpoints.map((ep, idx) => (
            <div
              key={`${ep.method}-${ep.path}-${idx}`}
              className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden shadow-sm hover:border-slate-700 transition-all"
            >
              <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getMethodBadge(ep.method)}`}>
                      {ep.method}
                    </span>
                    <span className="font-mono text-sm font-semibold text-slate-100">{ep.path}</span>
                    {ep.authRequired ? (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Auth Required
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                        Public
                      </span>
                    )}
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                      {ep.category}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-slate-300">{ep.summary}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{ep.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleCopy(ep.path, ep.path)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
                    title="Copy path"
                  >
                    {copiedPath === ep.path ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {(ep.sampleBody || ep.sampleResponse) && (
                <div className="bg-slate-950/80 border-t border-slate-800/80 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ep.sampleBody && (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Sample Request Body
                      </div>
                      <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto max-h-48">
                        {ep.sampleBody}
                      </pre>
                    </div>
                  )}

                  {ep.sampleResponse && (
                    <div className={ep.sampleBody ? '' : 'md:col-span-2'}>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Sample Response
                      </div>
                      <pre className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-blue-300 overflow-x-auto max-h-48">
                        {ep.sampleResponse}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

