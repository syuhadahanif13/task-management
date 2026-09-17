import React, { useState, useEffect } from 'react';
import { Download, X, Share, PlusSquare, Sparkles } from 'lucide-react';
import { usePwaInstall } from '../pwa/usePwaInstall';

export const PwaInstallBanner: React.FC = () => {
  const { canInstall, isInstalled, isIos, installApp } = usePwaInstall();
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [showIosGuide, setShowIosGuide] = useState<boolean>(false);

  useEffect(() => {
    const isDismissed = sessionStorage.getItem('pwa_banner_dismissed') === 'true';
    if (isDismissed) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  // Do not show if already running in installed standalone mode or dismissed
  if (isInstalled || dismissed) {
    return null;
  }

  // Case 1: Browser supports native install prompt (Android, Chrome, Edge, Brave, etc.)
  if (canInstall) {
    return (
      <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-[#18191d]/95 backdrop-blur-xl border border-white/10 text-white rounded-[26px] p-4 shadow-2xl flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#242630] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
            <img src="/icons/icon-192.png" alt="App Icon" className="w-9 h-9 object-contain" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#a3e635] uppercase tracking-wider">Aplikasi PWA</span>
              <Sparkles className="w-3 h-3 text-[#a3e635]" />
            </div>
            <h4 className="text-sm font-semibold text-white leading-tight truncate">Install TaskManager</h4>
            <p className="text-xs text-zinc-400 truncate">Akses cepat & layar penuh tanpa browser bar</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={installApp}
              className="px-3.5 py-2 bg-[#a3e635] hover:bg-[#bef264] text-zinc-950 text-xs font-semibold rounded-full transition-transform active:scale-95 shadow-md flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: iOS Safari device (Provide guidance to Add to Home Screen)
  if (isIos && !dismissed) {
    return (
      <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="bg-[#18191d]/95 backdrop-blur-xl border border-white/10 text-white rounded-[26px] p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#242630] border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                <img src="/icons/icon-192.png" alt="App Icon" className="w-8 h-8 object-contain" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Pasang di iPhone / iPad</h4>
                <p className="text-xs text-zinc-400">Jalankan seperti aplikasi iOS native</p>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!showIosGuide ? (
            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={() => setShowIosGuide(true)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-full transition-colors"
              >
                Cara Memasang ➔
              </button>
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-white/10 text-xs text-zinc-300 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">1</span>
                <span>Ketuk ikon bagikan <Share className="w-3.5 h-3.5 inline text-sky-400 mx-0.5" /> di Safari</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">2</span>
                <span>Gulir ke bawah & pilih <strong className="text-white"><PlusSquare className="w-3.5 h-3.5 inline text-lime-400 mx-0.5" /> Tambah ke Layar Utama</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};
