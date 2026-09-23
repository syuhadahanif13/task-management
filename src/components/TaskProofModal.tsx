import React, { useState, useEffect } from 'react';
import { Task, TaskSubmission, TaskAttachment } from '../types';
import { api } from '../api/client';
import {
  X,
  Paperclip,
  Calendar,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  Eye,
  Loader2,
  ZoomIn,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon
} from 'lucide-react';

interface TaskProofModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

export const TaskProofModal: React.FC<TaskProofModalProps> = ({
  isOpen,
  onClose,
  task,
}) => {
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<TaskAttachment | null>(null);

  useEffect(() => {
    if (!isOpen || !task) {
      setSubmissions([]);
      setErrorMsg('');
      setPreviewImage(null);
      return;
    }

    let isMounted = true;
    const fetchSubmissions = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const data = await api.getTaskSubmissions(task.id);
        if (isMounted) {
          setSubmissions(data || []);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Error fetching task submissions:', err);
          setErrorMsg(err.message || 'Gagal memuat data bukti kerja.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchSubmissions();

    return () => {
      isMounted = false;
    };
  }, [isOpen, task]);

  if (!isOpen || !task) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes && bytes !== 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = (file: TaskAttachment) => {
    const src = file.data || (file as any).url || (file as any).dataUrl;
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = file.name || 'attachment';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFileIcon = (file: TaskAttachment) => {
    const type = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) {
      return <ImageIcon className="w-5 h-5 text-indigo-500 shrink-0" />;
    }
    if (type.includes('sheet') || type.includes('excel') || /\.(xlsx|xls|csv)$/.test(name)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />;
    }
    if (type.includes('zip') || type.includes('rar') || type.includes('tar') || /\.(zip|rar|7z|tar|gz)$/.test(name)) {
      return <FileArchive className="w-5 h-5 text-amber-500 shrink-0" />;
    }
    return <FileText className="w-5 h-5 text-zinc-500 shrink-0" />;
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Paperclip className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  Bukti Kerja &amp; Lampiran
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[320px] sm:max-w-[450px]">
                  {task.title}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Task Info Summary */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/60">
              <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {task.title}
                </h3>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                  task.status === 'Done'
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : task.status === 'Pending Approval'
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700/60 dark:text-zinc-300'
                }`}>
                  {task.status === 'Pending Approval' ? 'In Review' : task.status}
                </span>
              </div>
              {task.description && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">
                  {task.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                <div className="flex items-center gap-1.5" title="Penanggung Jawab">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium">{task.assignee || 'Belum ditugaskan'}</span>
                </div>
                {task.dueDate && (
                  <div className="flex items-center gap-1.5" title="Tenggat Waktu">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{task.dueDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Loading State */}
            {isLoading && (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-400 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-xs">Memuat lampiran bukti kerja...</p>
              </div>
            )}

            {/* Error State */}
            {!isLoading && errorMsg && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Empty State */}
            {!isLoading && !errorMsg && submissions.length === 0 && (
              <div className="py-10 text-center space-y-2">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <Paperclip className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Belum Ada Bukti Kerja
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                  Belum ada laporan atau file lampiran yang diunggah untuk tugas ini.
                </p>
              </div>
            )}

            {/* Submissions List */}
            {!isLoading && !errorMsg && submissions.length > 0 && (
              <div className="space-y-6">
                {submissions.map((sub, idx) => (
                  <div
                    key={sub.id || idx}
                    className="p-5 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 shadow-2xs space-y-4"
                  >
                    {/* Submission Metadata Header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap border-b border-zinc-100 dark:border-zinc-700/70 pb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center">
                          {(sub.assignee || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {sub.assignee || 'Assignee'}
                          </p>
                          <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                            <Clock className="w-3 h-3" />
                            <span>{formatDate(sub.submittedAt)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {sub.status === 'approved' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-900/50">
                            <CheckCircle2 className="w-3 h-3" />
                            Disetujui
                          </span>
                        )}
                        {sub.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/50">
                            <Clock className="w-3 h-3" />
                            Menunggu Review
                          </span>
                        )}
                        {sub.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/50">
                            <AlertCircle className="w-3 h-3" />
                            Ditolak / Revisi
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Assignee Notes */}
                    {sub.notes && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          Catatan PIC
                        </span>
                        <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-750 rounded-xl text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                          {sub.notes}
                        </div>
                      </div>
                    )}

                    {/* Review Feedback if available */}
                    {(sub.reviewNote || sub.reviewedBy) && (
                      <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                        sub.status === 'approved'
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/70 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
                          : 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
                      }`}>
                        <div className="flex items-center justify-between font-semibold text-[11px]">
                          <span>Catatan Reviewer ({sub.reviewedBy || 'Admin'})</span>
                          {sub.reviewedAt && (
                            <span className="opacity-80 font-normal">{formatDate(sub.reviewedAt)}</span>
                          )}
                        </div>
                        {sub.reviewNote && (
                          <p className="whitespace-pre-wrap leading-relaxed">{sub.reviewNote}</p>
                        )}
                      </div>
                    )}

                    {/* Attachments */}
                    {sub.attachments && sub.attachments.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          Lampiran File ({sub.attachments.length})
                        </span>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {sub.attachments.map((file, fIdx) => {
                            const isImg = file.type?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
                            const fileSrc = file.data || (file as any).url || (file as any).dataUrl;
                            return (
                              <div
                                key={fIdx}
                                className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200/70 dark:border-zinc-700/60 rounded-xl group hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
                              >
                                {isImg && fileSrc ? (
                                  <div
                                    onClick={() => setPreviewImage(file)}
                                    className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700 cursor-pointer bg-zinc-100 dark:bg-zinc-800"
                                  >
                                    <img
                                      src={fileSrc}
                                      alt={file.name}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    />
                                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                      <Eye className="w-3.5 h-3.5 text-white" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                                    {getFileIcon(file)}
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate" title={file.name}>
                                    {file.name}
                                  </p>
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                    {formatSize(file.size)}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  {isImg && fileSrc && (
                                    <button
                                      type="button"
                                      onClick={() => setPreviewImage(file)}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                      title="Perbesar Gambar"
                                    >
                                      <ZoomIn className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {fileSrc && (
                                    <button
                                      type="button"
                                      onClick={() => handleDownload(file)}
                                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                                      title="Unduh File"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-3.5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* Lightbox / Zoom Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Top Bar */}
            <div className="w-full flex items-center justify-between text-white/90 pb-3">
              <span className="text-xs font-medium truncate max-w-md">
                {previewImage.name} ({formatSize(previewImage.size)})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(previewImage)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Tutup Preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Image */}
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10 flex items-center justify-center max-h-[80vh]">
              <img
                src={previewImage.data || (previewImage as any).url || (previewImage as any).dataUrl}
                alt={previewImage.name}
                className="max-h-[80vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
