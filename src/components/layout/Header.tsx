'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu,
  Search,
  Bell,
  Plus,
  Building2,
  ChevronDown,
  Store,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface HeaderProps {
  user?: any;
  onToggleSidebar?: () => void;
  selectedLocationId?: string;
  onSelectLocation?: (locId: string) => void;
}

export function Header({
  user,
  onToggleSidebar,
  selectedLocationId,
  onSelectLocation,
}: HeaderProps) {
  const pathname = usePathname();
  const [alertCount, setAlertCount] = useState(0);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/v1/alerts');
      const data = await res.json();
      if (data.success && data.data) {
        setAlerts(data.data);
        setAlertCount(data.data.length);
      }
    } catch (e) {
      console.error('Failed to load alerts', e);
    }
  };

  // Convert pathname to readable breadcrumb
  const pathParts = pathname.split('/').filter(Boolean);
  const breadcrumb = pathParts.length > 0
    ? pathParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' / ')
    : 'Dashboard';

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 shadow-xs">
      {/* Left: Mobile Menu Trigger & Breadcrumbs */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-900">{breadcrumb}</span>
        </div>
      </div>

      {/* Right Controls: Location, Search, Notifications, Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Location Selector */}
        {user?.allLocations && user.allLocations.length > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-medium">
            <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <select
              value={selectedLocationId || user.defaultLocationId}
              onChange={(e) => onSelectLocation && onSelectLocation(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 outline-none cursor-pointer pr-1"
            >
              <option value="">All Locations</option>
              {user.allLocations.map((loc: any) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* POS Quick Launch */}
        <Link
          href="/pos"
          className="hidden sm:flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-xs"
        >
          <Store className="w-3.5 h-3.5" />
          <span>Launch POS</span>
        </Link>

        {/* Quick Add Product */}
        <Link
          href="/inventory/products/new"
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Add Product</span>
        </Link>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 relative transition-colors"
            title="Notifications & Inventory Alerts"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                {alertCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Active Inventory Alerts</span>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full">
                  {alertCount} unread
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {alerts.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500 flex flex-col items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                    <span>All inventory levels are healthy!</span>
                  </div>
                ) : (
                  alerts.map((alt) => (
                    <div
                      key={alt.id}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs flex items-start gap-2.5"
                    >
                      <div
                        className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                          alt.severity === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-900 truncate">
                          {alt.productName} ({alt.sku})
                        </div>
                        <div className="text-[11px] text-slate-600 leading-snug">
                          {alt.message}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 text-center">
                <Link
                  href="/inventory/alerts"
                  onClick={() => setShowNotifications(false)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  View All Alerts & Suggested Reorders →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

