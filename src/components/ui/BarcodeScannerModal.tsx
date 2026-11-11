'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Scan, Keyboard, AlertCircle } from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

export function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scan Product Barcode',
}: BarcodeScannerModalProps) {
  const [manualCode, setManualCode] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Global listener for hardware USB / Bluetooth barcode scanners
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Hardware scanners typically type characters very quickly (< 40ms between keys)
      const now = Date.now();
      if (now - lastKeyTime > 100) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          onScan(buffer);
          buffer = '';
          if (isOpen) onClose();
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onScan, onClose]);

  // Camera initialization
  useEffect(() => {
    if (isOpen && isCameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen, isCameraActive]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access not supported on this device/browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn('Camera permission or device error:', err);
      setCameraError(err.message || 'Unable to access camera.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Camera Viewfinder */}
          {isCameraActive ? (
            <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video flex items-center justify-center border border-slate-800">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Scan targeting reticle */}
              <div className="absolute inset-x-8 inset-y-6 border-2 border-dashed border-blue-400 rounded-lg pointer-events-none animate-pulse flex items-center justify-center">
                <div className="w-full h-0.5 bg-rose-500/80 shadow-md shadow-rose-500" />
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 mx-auto flex items-center justify-center">
                <Scan className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800">Ready for Hardware Scanner</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Scan any physical USB or Bluetooth barcode scanner now, or toggle camera mode.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCameraActive(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-100 shadow-2xs"
              >
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                <span>Enable Camera Scanner</span>
              </button>
            </div>
          )}

          {cameraError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 text-amber-800 text-xs border border-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>{cameraError} (Falling back to keyboard/manual entry)</span>
            </div>
          )}

          {/* Manual Entry Fallback */}
          <form onSubmit={handleManualSubmit} className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-medium text-slate-700">
              Manual Barcode or SKU Entry:
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Keyboard className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  autoFocus
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. 194253912044 or SKU"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-xs"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

