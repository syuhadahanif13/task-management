import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskSubmission, TaskAttachment } from '../types';
import { api, getCachedTaskSubmissions, saveCachedTaskSubmission } from '../api/client';
import { extractTaskDescription, extractTaskSubmissionFromDescription, embedTaskSubmissionIntoDescription, compressImageFile } from '../utils/submissionUtils';
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
  Image as ImageIcon,
  Plus,
  UploadCloud,
  Send
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

  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [uploadNotes, setUploadNotes] = useState<string>('');
  const [uploadAttachments, setUploadAttachments] = useState<TaskAttachment[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        let data = await api.getTaskSubmissions(task.id, task.title);
        const hasAttachments = Array.isArray(data) && data.some(s => Array.isArray(s.attachments) && s.attachments.length > 0);

        // If no data or no attachments found, check task description for embedded submission
        if (!hasAttachments && task.description) {
          const emb = extractTaskSubmissionFromDescription(task.description);
          if (emb && Array.isArray(emb.attachments) && emb.attachments.length > 0) {
            if (!data || data.length === 0) {
              data = [emb];
            } else {
              data = data.map(s => {
                const isMatch = s.id === emb.id || s.taskId === emb.taskId || (!s.attachments || s.attachments.length === 0);
                return isMatch
                  ? { ...s, attachments: emb.attachments, notes: emb.notes || s.notes }
                  : s;
              });
            }
          }
        }

        // Check local cached submissions (covers cross-page and offline submissions on this browser)
        const stillNoAtt = !data || !data.some(s => Array.isArray(s.attachments) && s.attachments.length > 0);
        if (stillNoAtt) {
          const cached = getCachedTaskSubmissions(task.id, task.title);
          const cachedWithAtt = cached.find(c => Array.isArray(c.attachments) && c.attachments.length > 0);
          if (cachedWithAtt) {
            if (!data || data.length === 0) {
              data = [cachedWithAtt];
            } else {
              data = data.map(s => ({
                ...s,
                attachments: Array.isArray(s.attachments) && s.attachments.length > 0 ? s.attachments : cachedWithAtt.attachments,
                notes: s.notes || cachedWithAtt.notes,
              }));
            }
          }
        }

        if (isMounted) {
          setSubmissions(data || []);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('Error fetching task submissions:', err);
          let fallbackData: TaskSubmission[] = [];
          if (task.description) {
            const emb = extractTaskSubmissionFromDescription(task.description);
            if (emb) fallbackData.push(emb);
          }
          const cached = getCachedTaskSubmissions(task.id, task.title);
          if (cached.length > 0 && fallbackData.length === 0) {
            fallbackData = cached;
          }
          if (fallbackData.length > 0) {
            setSubmissions(fallbackData);
            return;
          }
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploadError('');
    const newAttachments: TaskAttachment[] = [];
    for (const file of Array.from(files) as File[]) {
      if (file.size > 15 * 1024 * 1024) {
        setUploadError(`File ${file.name} terlalu besar (>15MB).`);
        continue;
      }
      try {
        const dataUrl = await compressImageFile(file);
        const approxSize = Math.round((dataUrl.length * 3) / 4);
        newAttachments.push({
          name: file.name,
          type: file.type.startsWith('image/') ? 'image/jpeg' : file.type,
          size: approxSize || file.size,
          data: dataUrl,
        });
      } catch (err: any) {
        console.warn('Error reading file:', err);
      }
    }
    setUploadAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (uploadAttachments.length === 0) {
      setUploadError('Pilih minimal satu file bukti kerja.');
      return;
    }
    setIsUploading(true);
    setUploadError('');
    try {
      const nowIso = new Date().toISOString();
      const newSub: TaskSubmission = {
        id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
        taskId: task.id,
        taskTitle: task.title,
        assignee: task.assignee || 'User',
        notes: uploadNotes.trim() || 'Lampiran bukti kerja',
        attachments: uploadAttachments,
        status: task.status === 'Done' ? 'approved' : 'pending',
        submittedAt: nowIso,
        reviewedBy: task.status === 'Done' ? 'admin' : undefined,
        reviewedAt: task.status === 'Done' ? nowIso : undefined,
      };

      // 1. Save locally
      saveCachedTaskSubmission(newSub);

      // 2. Submit to API / Supabase
      try {
        await api.submitTask(task.id, {
          notes: newSub.notes,
          attachments: newSub.attachments,
          taskTitle: task.title,
        });
      } catch (apiErr) {
        console.warn('API submit in TaskProofModal warning:', apiErr);
      }

      // 3. Update task description in background
      try {
        const newDesc = embedTaskSubmissionIntoDescription(task.description || '', newSub);
        await api.updateTask(task.id, { description: newDesc, title: task.title });
        task.description = newDesc;
      } catch {}

      // 4. Update modal state
      setSubmissions((prev) => [newSub, ...prev]);
      setUploadNotes('');
      setUploadAttachments([]);
      setIsUploadOpen(false);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tasksUpdated'));
      }
    } catch (err: any) {
      setUploadError(err.message || 'Gagal mengunggah bukti.');
    } finally {
      setIsUploading(false);
    }
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
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[280px] sm:max-w-[400px]">
                  {task.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsUploadOpen(!isUploadOpen);
                  setUploadError('');
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                {isUploadOpen ? 'Batal' : 'Tambah Bukti'}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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
                  {extractTaskDescription(task.description)}
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

            {/* Inline Upload Form */}
            {isUploadOpen && (
              <form onSubmit={handleUploadSubmit} className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200/80 dark:border-indigo-800/60 rounded-2xl space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Unggah Bukti Baru
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadOpen(false);
                      setUploadAttachments([]);
                      setUploadNotes('');
                      setUploadError('');
                    }}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {uploadError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    Catatan Bukti / Keterangan
                  </label>
                  <textarea
                    rows={2}
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                    placeholder="Contoh: Bukti live streaming telah dijalankan dan akun REI aktif."
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 mb-1">
                    File Lampiran (Gambar / PDF / Dokumen)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 border-2 border-dashed border-indigo-300 dark:border-indigo-700 hover:border-indigo-500 rounded-xl bg-white dark:bg-zinc-900 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      Pilih File / Foto
                    </button>
                    {uploadAttachments.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[11px] text-zinc-700 dark:text-zinc-300 max-w-[200px]"
                      >
                        <span className="truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setUploadAttachments(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-zinc-400 hover:text-rose-500 ml-1"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(false)}
                    className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading || uploadAttachments.length === 0}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Mengunggah...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Simpan Bukti
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

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
            {!isLoading && !errorMsg && submissions.length === 0 && !isUploadOpen && (
              <div className="py-10 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <Paperclip className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    Belum Ada Bukti Kerja
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                    Belum ada laporan atau file lampiran yang tersimpan untuk tugas ini.
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setIsUploadOpen(true)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Unggah Bukti Sekarang
                  </button>
                </div>
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
