'use client';

import React from 'react';
import { Printer, X, CheckCircle, Package } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptData: {
    orderNumber: string;
    date: string | Date;
    location: string;
    customer: string;
    items: Array<{
      productName: string;
      sku: string;
      quantity: number;
      unitPrice: number;
      totalAmount: number;
    }>;
    subtotal: number;
    taxAmount: number;
    grandTotal: number;
    amountTendered: number;
    changeAmount: number;
    paymentMethod: string;
  } | null;
}

export function ReceiptModal({ isOpen, onClose, receiptData }: ReceiptModalProps) {
  if (!isOpen || !receiptData) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Controls */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <CheckCircle className="w-4 h-4" />
            <span>Sale Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium flex items-center gap-1"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div id="printable-receipt" className="p-6 overflow-y-auto space-y-4 text-slate-800 text-xs font-mono">
          {/* Header */}
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-4">
            <div className="font-bold text-sm tracking-wider uppercase text-slate-900">
              Inventory Pro
            </div>
            <div className="text-[11px] text-slate-500">{receiptData.location}</div>
            <div className="text-[10px] text-slate-400">
              {new Date(receiptData.date).toLocaleString()}
            </div>
            <div className="text-[11px] font-semibold text-slate-700">
              Receipt #{receiptData.orderNumber}
            </div>
            <div className="text-[10px] text-slate-500">Customer: {receiptData.customer}</div>
          </div>

          {/* Line Items */}
          <div className="space-y-2 border-b border-dashed border-slate-300 pb-4">
            {receiptData.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start text-[11px]">
                <div className="pr-2">
                  <div className="font-medium text-slate-900">{item.productName}</div>
                  <div className="text-[10px] text-slate-500">
                    {item.quantity} x ${Number(item.unitPrice).toFixed(2)}
                  </div>
                </div>
                <div className="font-semibold text-slate-900 shrink-0">
                  ${Number(item.totalAmount).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          {/* Financial Breakdown */}
          <div className="space-y-1 text-xs border-b border-dashed border-slate-300 pb-4">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span>${Number(receiptData.subtotal).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Tax:</span>
              <span>${Number(receiptData.taxAmount).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
              <span>Total:</span>
              <span>${Number(receiptData.grandTotal).toFixed(2)}</span>
            </div>
          </div>

          {/* Payment & Change */}
          <div className="space-y-1 text-xs pt-1">
            <div className="flex justify-between text-slate-600">
              <span>Payment ({receiptData.paymentMethod}):</span>
              <span>${Number(receiptData.amountTendered).toFixed(2)}</span>
            </div>
            {receiptData.changeAmount > 0 && (
              <div className="flex justify-between font-bold text-emerald-700">
                <span>Change Returned:</span>
                <span>${Number(receiptData.changeAmount).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Barcode representation */}
          <div className="text-center pt-4 text-[10px] text-slate-400 space-y-1">
            <div className="tracking-widest font-bold">*{receiptData.orderNumber}*</div>
            <div>Thank you for your business!</div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-xs flex items-center justify-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
}

