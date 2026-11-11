'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { BarcodeScannerModal } from '@/components/ui/BarcodeScannerModal';
import { ReceiptModal } from '@/components/ui/ReceiptModal';
import {
  Search,
  Scan,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Building2,
  Package,
} from 'lucide-react';

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  unitPrice: number;
  availableStock: number;
  quantity: number;
  discount: number;
}

export default function PosPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'BANK'>('CASH');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('0');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadCatalog();
    loadCustomers();
  }, []);

  const loadCatalog = async () => {
    try {
      const [prodRes, catRes] = await Promise.all([
        fetch('/api/v1/products?limit=100'),
        fetch('/api/v1/categories'),
      ]);
      const prodJson = await prodRes.json();
      const catJson = await catRes.json();
      if (prodJson.success) setProducts(prodJson.data);
      if (catJson.success) setCategories(catJson.data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await fetch('/api/v1/customers');
      const json = await res.json();
      if (json.success) setCustomers(json.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleBarcodeScanned = (code: string) => {
    const clean = code.trim().toUpperCase();
    const found = products.find(
      (p) => (p.barcode && p.barcode.toUpperCase() === clean) || p.sku.toUpperCase() === clean
    );

    if (found) {
      addToCart(found);
    } else {
      setErrorMessage(`No product found matching barcode/SKU "${code}".`);
    }
  };

  const addToCart = (product: any) => {
    setErrorMessage(null);
    const available = product.inventory?.available ?? 0;

    if (available <= 0) {
      setErrorMessage(`Cannot add "${product.name}" — product is out of stock!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        if (existing.quantity + 1 > available) {
          setErrorMessage(`Cannot add more than ${available} available units for "${product.name}".`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: Number(product.sellingPrice),
          availableStock: available,
          quantity: 1,
          discount: 0,
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const nextQty = item.quantity + delta;
            if (nextQty > item.availableStock) {
              setErrorMessage(`Cannot exceed available stock of ${item.availableStock}.`);
              return item;
            }
            return { ...item, quantity: Math.max(1, nextQty) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  // Calculations
  const rawSubtotal = cart.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0);
  const cartDiscount = parseFloat(discountAmount) || 0;
  const netSubtotal = Math.max(0, rawSubtotal - cartDiscount);
  const taxRate = 8.5; // Standard company tax rate
  const taxAmount = Number(((netSubtotal * taxRate) / 100).toFixed(2));
  const grandTotal = Number((netSubtotal + taxAmount).toFixed(2));

  const tendered = parseFloat(amountTendered) || grandTotal;
  const changeDue = paymentMethod === 'CASH' && tendered > grandTotal ? tendered - grandTotal : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const payload = {
        customerId: selectedCustomerId || null,
        orderType: 'POS',
        discountAmount: cartDiscount,
        paymentMethod,
        amountTendered: tendered,
        items: cart.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: it.discount,
        })),
      };

      const res = await fetch('/api/v1/sales/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Checkout failed');
      }

      // Show receipt modal
      setReceiptData(json.data.receipt);
      setIsReceiptOpen(true);

      // Reset cart and reload catalog stock
      setCart([]);
      setDiscountAmount('0');
      setAmountTendered('');
      loadCatalog();
    } catch (err: any) {
      setErrorMessage(err.message || 'Checkout failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter products by category & search
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'ALL' || p.categoryId === selectedCategory;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Point of Sale (POS)</h1>
            <p className="text-xs text-slate-500">Fast checkout, hardware scanner support, and instant receipt generation.</p>
          </div>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shadow-xs"
          >
            <Scan className="w-4 h-4" />
            <span>Scan Barcode (F2)</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 font-bold">×</button>
          </div>
        )}

        {/* 2-Column POS Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Product Catalog Grid (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search and Category Filter */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products by name, SKU, or scan barcode..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === 'ALL'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Items
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1 rounded-full font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === c.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((p) => {
                const available = p.inventory?.available ?? 0;
                const isOutOfStock = available <= 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`p-3 bg-white border rounded-xl shadow-2xs transition-all flex flex-col justify-between ${
                      isOutOfStock
                        ? 'opacity-60 cursor-not-allowed border-slate-200'
                        : 'cursor-pointer hover:border-blue-500 hover:shadow-md border-slate-200/80 active:scale-[0.99]'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] font-mono text-slate-400 truncate">{p.sku}</span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                            available > 5
                              ? 'bg-emerald-50 text-emerald-700'
                              : available > 0
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {available > 0 ? `${available} in stock` : 'Out of stock'}
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-slate-900 mt-1 line-clamp-2">
                        {p.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        ${Number(p.sellingPrice).toFixed(2)}
                      </span>
                      <button
                        disabled={isOutOfStock}
                        className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Active Cart & Checkout (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-sm p-4 space-y-4">
            {/* Customer & Register Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">Active Order Cart</h3>
                <span className="text-xs bg-blue-50 text-blue-700 font-bold px-1.5 py-0.2 rounded-full">
                  {cart.length}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Customer Selector */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Customer (Optional)
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Walk-in Customer (Default)</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customerType})
                  </option>
                ))}
              </select>
            </div>

            {/* Cart Items List */}
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 border-y border-slate-100">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                  <Package className="w-8 h-8 mx-auto text-slate-300" />
                  <p>Cart is currently empty.</p>
                  <p className="text-[10px]">Click a product or scan a barcode to add.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-900 truncate">{item.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ${item.unitPrice.toFixed(2)} / unit • {item.sku}
                      </div>
                    </div>

                    {/* Quantity Stepper */}
                    <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                      <button
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold w-6 text-center text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="w-5 h-5 rounded flex items-center justify-center text-slate-600 hover:bg-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right shrink-0 w-16">
                      <div className="text-xs font-bold text-slate-900">
                        ${(item.unitPrice * item.quantity).toFixed(2)}
                      </div>
                    </div>

                    <button
                      onClick={() => removeItem(item.productId)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Calculations & Discounts */}
            <div className="space-y-2 text-xs pt-1">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-900">${rawSubtotal.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Cart Discount ($):</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="w-20 text-right text-xs p-1 border border-slate-200 rounded font-semibold text-slate-900"
                />
              </div>

              <div className="flex justify-between text-slate-600">
                <span>Tax (8.5%):</span>
                <span className="font-semibold text-slate-900">${taxAmount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="text-blue-600">${grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition-colors ${
                    paymentMethod === 'CASH'
                      ? 'bg-blue-50 text-blue-700 border-blue-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CARD')}
                  className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition-colors ${
                    paymentMethod === 'CARD'
                      ? 'bg-blue-50 text-blue-700 border-blue-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('BANK')}
                  className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition-colors ${
                    paymentMethod === 'BANK'
                      ? 'bg-blue-50 text-blue-700 border-blue-500'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Bank</span>
                </button>
              </div>

              {/* Cash Tendered & Change */}
              {paymentMethod === 'CASH' && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">Cash Tendered:</span>
                    <input
                      type="number"
                      step="0.01"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      placeholder={grandTotal.toFixed(2)}
                      className="w-24 text-right p-1 border border-slate-300 rounded text-xs font-bold text-slate-900 bg-white"
                    />
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between text-xs font-bold text-emerald-700 pt-1 border-t border-slate-200">
                      <span>Change Due:</span>
                      <span>${changeDue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Complete Sale Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || isSubmitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              {isSubmitting ? (
                <span>Posting Transaction...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Sale & Deduct Stock (${grandTotal.toFixed(2)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        receiptData={receiptData}
      />
    </DashboardLayout>
  );
}

