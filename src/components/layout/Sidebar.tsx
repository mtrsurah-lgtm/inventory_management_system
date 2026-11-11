'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Layers,
  ArrowLeftRight,
  Sliders,
  History,
  ShoppingCart,
  Store,
  Truck,
  Users,
  FileBarChart,
  UploadCloud,
  Bell,
  Settings,
  ShieldCheck,
  Building2,
  ChevronRight,
  LogOut,
  AlertTriangle,
} from 'lucide-react';

interface SidebarProps {
  user?: any;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ user, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();

  const navigation = [
    {
      group: 'OVERVIEW',
      items: [
        { name: 'Dashboard', href: '/', icon: LayoutDashboard },
        { name: 'Point of Sale (POS)', href: '/pos', icon: Store, badge: 'Active' },
      ],
    },
    {
      group: 'INVENTORY & CATALOG',
      items: [
        { name: 'All Products', href: '/inventory/products', icon: Package },
        { name: 'Stock Balances', href: '/inventory/balances', icon: Layers },
        { name: 'Stock Movements', href: '/inventory/movements', icon: History },
        { name: 'Stock Transfers', href: '/inventory/transfers', icon: ArrowLeftRight },
        { name: 'Stock Adjustments', href: '/inventory/adjustments', icon: Sliders },
        { name: 'Inventory Alerts', href: '/inventory/alerts', icon: AlertTriangle, alertCount: true },
      ],
    },
    {
      group: 'PROCUREMENT & SALES',
      items: [
        { name: 'Suppliers', href: '/purchases/suppliers', icon: Truck },
        { name: 'Purchase Orders', href: '/purchases/orders', icon: ShoppingCart },
        { name: 'Goods Receiving', href: '/purchases/receipts', icon: Package },
        { name: 'Sales Orders', href: '/sales/orders', icon: Store },
        { name: 'Customers', href: '/sales/customers', icon: Users },
        { name: 'Sales Returns', href: '/sales/returns', icon: ArrowLeftRight },
      ],
    },
    {
      group: 'ANALYTICS & TOOLS',
      items: [
        { name: 'Reports & Valuation', href: '/reports', icon: FileBarChart },
        { name: 'CSV Bulk Import', href: '/imports', icon: UploadCloud },
      ],
    },
    {
      group: 'CONFIGURATION',
      items: [
        { name: 'Locations & Warehouses', href: '/settings/locations', icon: Building2 },
        { name: 'Users & Permissions', href: '/settings/users', icon: ShieldCheck },
        { name: 'Company Settings', href: '/settings/company', icon: Settings },
      ],
    },
  ];

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out border-r border-slate-800 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Logo & Name */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-semibold text-white tracking-tight flex items-center gap-1.5">
              Inventory Pro
              <span className="text-[10px] font-medium bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30">
                v2.0
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
              {user?.organization?.name || 'Enterprise Edition'}
            </div>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navigation.map((section, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                {section.group}
              </div>
              <div className="space-y-0.5 pt-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => {
                        if (window.innerWidth < 1024 && onClose) onClose();
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-semibold">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Card & Logout Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/30">
          <div className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center font-semibold text-xs shrink-0">
                {user?.firstName?.[0] || 'A'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-white truncate">
                  {user ? `${user.firstName} ${user.lastName}` : 'Administrator'}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {user?.role?.name || 'Company Admin'}
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-slate-400 hover:text-rose-400 transition-colors p-1.5 rounded-md hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

