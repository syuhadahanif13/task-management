import React, { useState } from 'react';
import { Smartphone, Download, CheckCircle2, Share, PlusSquare, Info } from 'lucide-react';
import { usePwaInstall } from '../pwa/usePwaInstall';

export const PwaSettingsCard: React.FC = () => {
  const { canInstall, isInstalled, isIos, installApp } = usePwaInstall();
  const [showIosModal, setShowIosModal] = useState(false);

  return (
    <div className="ios-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#a3e635]" />
          <h3 className="notion-section-title !mb-0">Aplikasi Progressive Web App (PWA)</h3>
        </div>
        {isInstalled && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/40">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Terpasang
          </span>
        )}
      </div>

      <div className="p-4 rounded-2xl bg-notion-sidebar border border-notion-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#18191d] border border-white/10 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
            <img src="/icons/icon-192.png" alt="TaskManager" className="w-9 h-9 object-contain" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-notion-text">TaskManager Mobile & Desktop</h4>
            <p className="text-xs text-notion-text-secondary mt-0.5">
              Install ke layar beranda untuk pengalaman layar penuh, loading instan, dan performa maksimal.
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {isInstalled ? (
            <div className="text-xs text-notion-text-secondary flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-notion-text-secondary" />
              <span>Aplikasi aktif dalam mode Standalone</span>
            </div>
          ) : canInstall ? (
            <button
              onClick={installApp}
              className="w-full sm:w-auto px-4 py-2 bg-[#18191d] dark:bg-[#a3e635] text-white dark:text-zinc-950 text-xs font-semibold rounded-full hover:opacity-90 active:scale-95 transition-all shadow flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Install Sekarang
            </button>
          ) : isIos ? (
            <button
              onClick={() => setShowIosModal(!showIosModal)}
              className="w-full sm:w-auto px-3.5 py-2 bg-notion-bg text-notion-text border border-notion-border text-xs font-medium rounded-full hover:bg-notion-sidebar transition-all flex items-center justify-center gap-1.5"
            >
              <Share className="w-3.5 h-3.5 text-sky-500" />
              Petunjuk iOS Safari
            </button>
          ) : (
            <span className="text-xs text-notion-text-secondary bg-notion-bg px-3 py-1.5 rounded-xl border border-notion-border inline-block">
              ✓ Didukung di Chrome, Edge & Safari
            </span>
          )}
        </div>
      </div>

      {showIosModal && isIos && (
        <div className="mt-3 p-3.5 rounded-2xl bg-sky-50/80 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 text-xs text-sky-900 dark:text-sky-200 space-y-2">
          <p className="font-semibold flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-sky-500" />
            Cara menambahkan ke Beranda iPhone / iPad:
          </p>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-sky-200 dark:bg-sky-800 flex items-center justify-center font-bold text-[10px]">1</span>
            <span>Buka web ini di Safari, ketuk tombol <strong>Share / Bagikan</strong> <Share className="w-3.5 h-3.5 inline mx-0.5" /> di bilah navigasi bawah.</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-sky-200 dark:bg-sky-800 flex items-center justify-center font-bold text-[10px]">2</span>
            <span>Pilih menu <strong className="inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 inline" /> Tambah ke Layar Utama (Add to Home Screen)</strong>.</span>
          </div>
        </div>
      )}
    </div>
  );
};
