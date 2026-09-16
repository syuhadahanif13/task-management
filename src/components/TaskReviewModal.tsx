import React, { useState } from 'react';
import { Task, TaskSubmission } from '../types';
import { Check, X, FileText, User, Calendar, MessageSquare } from 'lucide-react';

interface TaskReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  submission: TaskSubmission | null;
  onApprove: (taskId: string, submissionId: string, reviewNote?: string) => Promise<Task>;
  onReject: (taskId: string, submissionId: string, reviewNote: string) => Promise<Task>;
}

export const TaskReviewModal: React.FC<TaskReviewModalProps> = ({
  isOpen,
  onClose,
  task,
  submission,
  onApprove,
  onReject,
}) => {
  const [reviewNote, setReviewNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleApprove = async () => {
    if (!task || !submission) return;
    setIsProcessing(true);
    setErrorMsg('');
    try {
      await onApprove(task.id, submission.id, reviewNote.trim() || undefined);
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menyetujui submission.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!task || !submission) return;
    if (!reviewNote.trim()) {
      setErrorMsg('Catatan review harus diisi untuk penolakan.');
      return;
    }
    setIsProcessing(true);
    setErrorMsg('');
    try {
      await onReject(task.id, submission.id, reviewNote.trim());
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal menolak submission.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setReviewNote('');
    setErrorMsg('');
    onClose();
  };

  if (!isOpen || !task || !submission) return null;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Review Submission
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {task.title}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-2">
              <MessageSquare className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Task Info */}
          <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex-1">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {task.title}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>{task.assignee}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{task.dueDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submission Notes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Catatan dari Assignee
            </label>
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">
              {submission.notes}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Disubmit pada {formatDate(submission.submittedAt)} oleh {submission.assignee}
            </p>
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Bukti / Attachment ({submission.attachments.length})
            </label>
            <div className="space-y-2">
              {submission.attachments.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg"
                >
                  <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {file.name}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {formatSize(file.size)}
                    </p>
                  </div>
                  {file.type.startsWith('image/') && file.data ? (
                    <img
                      src={file.data}
                      alt={file.name}
                      className="w-10 h-10 rounded object-cover border border-zinc-200 dark:border-zinc-700"
                    />
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 uppercase">
                      {file.type.split('/')[1] || 'file'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Review Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Catatan Review (Opsional untuk Approve, Wajib untuk Reject)
            </label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Tambahkan catatan review..."
              rows={2}
              className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={isProcessing || !reviewNote.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" />
              {isProcessing ? 'Memproses...' : 'Reject'}
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {isProcessing ? 'Memproses...' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};