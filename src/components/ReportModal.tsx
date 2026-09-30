import React, { useState } from 'react';
import { Meeting, Task } from '../types';
import {
  exportSingleMeetingPdf,
  exportAllMeetingsPdf,
  printReportHtml,
  generateTextReportSummary,
  ReportOptions,
} from '../utils/pdfGenerator';
import {
  X,
  FileDown,
  Printer,
  Copy,
  Check,
  FileText,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Layers,
  ChevronDown,
} from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: Meeting[];
  initialMeetingId?: string | null;
  onToast?: (message: string) => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  meetings,
  initialMeetingId,
  onToast,
}) => {
  // Mode: 'single' (specific meeting) or 'all' (all meetings)
  const [reportScope, setReportScope] = useState<'single' | 'all'>(
    initialMeetingId ? 'single' : 'all'
  );
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(
    initialMeetingId || (meetings.length > 0 ? meetings[0].id : '')
  );

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [includeStats, setIncludeStats] = useState<boolean>(true);
  const [includeNotes, setIncludeNotes] = useState<boolean>(true);
  const [includeTasks, setIncludeTasks] = useState<boolean>(true);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentMeeting = meetings.find((m) => m.id === selectedMeetingId) || meetings[0];

  const handleExportPdf = () => {
    setIsExporting(true);
    try {
      const opts: ReportOptions = {
        includeStats,
        includeNotes,
        includeTasks,
        statusFilter,
      };

      if (reportScope === 'single' && currentMeeting) {
        exportSingleMeetingPdf(currentMeeting, opts);
        onToast?.('Laporan rapat berhasil diunduh dalam format PDF.');
      } else {
        exportAllMeetingsPdf(meetings, opts);
        onToast?.('Laporan rekapitulasi seluruh rapat berhasil diunduh.');
      }
    } catch (err: any) {
      console.error('Gagal export PDF:', err);
      alert('Gagal mengunduh PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    const opts: ReportOptions = {
      includeStats,
      includeNotes,
      includeTasks,
      statusFilter,
    };

    if (reportScope === 'single' && currentMeeting) {
      printReportHtml(currentMeeting, opts);
    } else {
      printReportHtml(meetings, opts);
    }
  };

  const handleCopyText = async () => {
    try {
      const text = reportScope === 'single' && currentMeeting
        ? generateTextReportSummary(currentMeeting)
        : generateTextReportSummary(meetings);

      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      onToast?.('Ringkasan laporan berhasil disalin ke clipboard.');
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      alert('Gagal menyalin teks ke clipboard.');
    }
  };

  // Quick stats calculation for preview
  const previewTasks = reportScope === 'single' && currentMeeting
    ? (currentMeeting.tasks || [])
    : meetings.flatMap((m) => m.tasks || []);

  const filteredPreviewTasks = previewTasks.filter((t) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'done') return t.status === 'Done';
    return t.status !== 'Done';
  });

  const totalTasksCount = previewTasks.length;
  const doneTasksCount = previewTasks.filter((t) => t.status === 'Done').length;
  const inProgressCount = previewTasks.filter((t) => t.status === 'In Progress').length;
  const completionRate = totalTasksCount > 0 ? Math.round((doneTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-zinc-850 rounded-[28px] w-full max-w-3xl overflow-hidden shadow-2xl border border-gray-200/80 dark:border-zinc-750 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                Export PDF & Generate Laporan
              </h2>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                Buat dan unduh dokumen laporan resmi otomatis untuk kebutuhan manajemen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Container */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Scope Selector: Single Meeting vs All Meetings */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-2">
              Pilih Cakupan Laporan
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReportScope('single')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                  reportScope === 'single'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-gray-300'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm">Laporan Rapat Tertentu</div>
                  <div className="text-[11px] text-gray-500 dark:text-zinc-400">
                    Notulensi lengkap, peserta, & action items rapat
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setReportScope('all')}
                className={`p-3.5 rounded-2xl border text-left transition flex items-center gap-3 ${
                  reportScope === 'all'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20'
                    : 'border-gray-200 dark:border-zinc-750 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:border-gray-300'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-sm">Rekapitulasi Seluruh Rapat</div>
                  <div className="text-[11px] text-gray-500 dark:text-zinc-400">
                    Konsolidasi {meetings.length} rapat & seluruh tugas perusahaan
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* If Single Meeting Scope: Select specific meeting */}
          {reportScope === 'single' && (
            <div className="bg-gray-50 dark:bg-zinc-800/60 p-4 rounded-2xl border border-gray-200/60 dark:border-zinc-750 space-y-2">
              <label className="text-[11px] font-bold text-gray-600 dark:text-zinc-400 uppercase tracking-wider block">
                Pilih Rapat yang Ingin Dilaporkan:
              </label>
              <div className="relative">
                <select
                  value={selectedMeetingId}
                  onChange={(e) => setSelectedMeetingId(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-700 text-gray-900 dark:text-white px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-600 appearance-none font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 pr-10"
                >
                  {meetings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.meetingDate} — {m.title || `Rapat ${m.meetingDate}`} ({m.tasks?.length || 0} tugas)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-3 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Customization & Filter Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status Filter */}
            <div>
              <label className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider block mb-1.5">
                Filter Status Tugas:
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-white px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua Status (Lengkap)</option>
                <option value="pending">Hanya Belum Selesai (Pending / On Progress / To Do)</option>
                <option value="done">Hanya Selesai (Done)</option>
              </select>
            </div>

            {/* Checkboxes */}
            <div className="flex flex-col justify-end space-y-2 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-zinc-300 font-medium">
                <input
                  type="checkbox"
                  checked={includeStats}
                  onChange={(e) => setIncludeStats(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Sertakan Ringkasan Statistik & KPI</span>
              </label>

              {reportScope === 'single' && (
                <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-zinc-300 font-medium">
                  <input
                    type="checkbox"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Sertakan Notulensi & Catatan Pembahasan</span>
                </label>
              )}

              <label className="flex items-center gap-2 cursor-pointer text-gray-700 dark:text-zinc-300 font-medium">
                <input
                  type="checkbox"
                  checked={includeTasks}
                  onChange={(e) => setIncludeTasks(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span>Sertakan Tabel Daftar Action Items</span>
              </label>
            </div>
          </div>

          {/* Document Preview Card (Paper-like aesthetic) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
                Pratinjau Laporan Resmi
              </span>
              <span className="text-[10px] text-gray-400 dark:text-zinc-500">
                Format: Kertas Standar A4 Portrait
              </span>
            </div>

            <div className="bg-gray-50 dark:bg-zinc-900/80 p-5 rounded-2xl border border-gray-200 dark:border-zinc-750 shadow-inner space-y-4">
              {/* Paper Header */}
              <div className="bg-[#18191d] text-white p-4 rounded-xl">
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                  PT RAJA EMAS INDONESIA
                </div>
                <div className="text-sm font-extrabold mt-0.5">
                  {reportScope === 'single'
                    ? (currentMeeting?.title || `Rapat ${currentMeeting?.meetingDate || ''}`)
                    : 'Rekapitulasi Seluruh Rapat & Action Items Perusahaan'}
                </div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {reportScope === 'single'
                    ? `📅 ${currentMeeting?.meetingDate || '-'} | 👥 ${currentMeeting?.participants?.length || 0} Peserta`
                    : `📊 Mencakup ${meetings.length} Rapat Terlaksana`}
                </div>
              </div>

              {/* Stats KPI Pills */}
              {includeStats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white dark:bg-zinc-800 p-2.5 rounded-xl border border-gray-200/60 dark:border-zinc-700 text-center">
                    <div className="text-[10px] text-gray-400 uppercase font-bold">Total Tugas</div>
                    <div className="text-base font-extrabold text-gray-900 dark:text-white">
                      {totalTasksCount}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 p-2.5 rounded-xl border border-gray-200/60 dark:border-zinc-700 text-center">
                    <div className="text-[10px] text-emerald-600 uppercase font-bold">Selesai (Done)</div>
                    <div className="text-base font-extrabold text-emerald-600">
                      {doneTasksCount} ({completionRate}%)
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 p-2.5 rounded-xl border border-gray-200/60 dark:border-zinc-700 text-center">
                    <div className="text-[10px] text-blue-600 uppercase font-bold">On Progress</div>
                    <div className="text-base font-extrabold text-blue-600">
                      {inProgressCount}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 p-2.5 rounded-xl border border-gray-200/60 dark:border-zinc-700 text-center">
                    <div className="text-[10px] text-amber-600 uppercase font-bold">Belum Selesai</div>
                    <div className="text-base font-extrabold text-amber-600">
                      {totalTasksCount - doneTasksCount}
                    </div>
                  </div>
                </div>
              )}

              {/* Action items preview snippet */}
              {includeTasks && (
                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-gray-200/60 dark:border-zinc-700 p-3">
                  <div className="text-[11px] font-bold text-gray-700 dark:text-zinc-200 mb-2 flex items-center justify-between">
                    <span>Daftar Action Items ({filteredPreviewTasks.length}):</span>
                    {filteredPreviewTasks.length > 3 && (
                      <span className="text-[10px] text-gray-400 font-normal">
                        Menampilkan 3 dari {filteredPreviewTasks.length} tugas di pratinjau
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {filteredPreviewTasks.slice(0, 3).map((t, i) => (
                      <div
                        key={t.id || i}
                        className="flex items-center justify-between text-[11px] py-1 px-2 rounded-lg bg-gray-50 dark:bg-zinc-750"
                      >
                        <div className="truncate font-medium text-gray-800 dark:text-zinc-200 pr-2">
                          {i + 1}. {t.title}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-gray-500 dark:text-zinc-400 text-[10px]">
                            {Array.isArray(t.assignees) && t.assignees.length > 0 ? t.assignees.join(', ') : t.assignee}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              t.status === 'Done'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : t.status === 'In Progress'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}
                          >
                            {t.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {filteredPreviewTasks.length === 0 && (
                      <div className="text-center py-3 text-gray-400 text-[11px]">
                        Tidak ada tugas yang sesuai dengan filter yang dipilih.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              title="Salin ringkasan teks untuk WhatsApp atau Telegram"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Tersalin!' : 'Salin Ringkasan'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
              title="Cetak atau simpan via browser print dialog"
            >
              <Printer className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-400" />
              <span>Cetak / Print A4</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700 text-xs font-bold transition"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition flex items-center gap-2 shadow-md disabled:opacity-50"
            >
              <FileDown className="w-4 h-4" />
              <span>{isExporting ? 'Memproses PDF...' : 'Unduh File PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
