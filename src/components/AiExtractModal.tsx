import React, { useState } from 'react';
import { api } from '../api/client';
import { CreateMeetingInput, TaskStatus } from '../types';
import { Sparkles, X, Check, ArrowRight, FileText, Calendar, Users, CheckSquare, Loader2, AlertCircle } from 'lucide-react';

interface AiExtractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: CreateMeetingInput) => Promise<void>;
  initialRawText?: string;
  initialMeetingDate?: string;
}

const SAMPLE_NOTES = [
  {
    label: 'Contoh 1: Rapat Evaluasi Proyek (Bahasa Indonesia)',
    text: `Notula Rapat Koordinasi Tim Pengembang
Tanggal: 2026-09-14
Peserta Rapat: Budi Santoso (Lead Architect), Siti Fatimah (Backend Eng), Andi Wijaya (QA Lead), Rina Marlina (Product Owner)

Poin Pembahasan:
1. Siti melaporkan bahwa integrasi payment gateway sandbox telah rampung, namun modul webhook perlu dilakukan load test sebelum peluncuran produksi.
2. Andi menyampaikan coverage unit test di modul autentikasi baru 68%, target minimal 85% sebelum audit minggu depan.
3. Rina meminta pembaruan dokumen spesifikasi produk (PRD) untuk fitur notifikasi push aplikasi mobile.
4. Budi mengusulkan migrasi skema database dengan index komposit untuk memangkas latensi query.

Tindak Lanjut & Action Items:
- Siti Fatimah wajib menyelesaikan load test webhook payment gateway paling lambat 2026-09-18.
- Andi Wijaya meningkatkan test coverage autentikasi hingga minimal 85% sebelum 2026-09-20.
- Rina Marlina memfinalisasi revisi PRD notifikasi push sebelum 2026-09-16.
- Budi Santoso menyusun migrasi script database composite indexing paling lambat 2026-09-22.`
  },
  {
    label: 'Contoh 2: Sprint Retrospective & Strategy (English)',
    text: `Engineering Sprint Sync & Action Plan
Date of Meeting: 2026-09-13
Participants: Michael Chen, Sarah Lopez, David Kim, Priya Patel

Meeting Notes & Key Takeaways:
Discussed the slow database query response times during the end-of-month financial reconciliation batch job. The memory usage peaked at 92%. We agreed to refactor the data aggregation pipeline into asynchronous worker queues. In addition, Sarah highlighted that customer support reported 5 duplicate ticket submissions due to lack of client-side button debouncing.

Action Items:
- Michael Chen to implement Redis BullMQ asynchronous queue by 2026-09-19 (status: To Do).
- Sarah Lopez to fix UI button debounce on the support submit form by 2026-09-15 (status: In Progress).
- David Kim to benchmark memory footprints under simulated 50k concurrent requests by 2026-09-21 (status: To Do).
- Priya Patel to conduct stakeholder sign-off review on new queue performance metrics by 2026-09-23 (status: To Do).`
  }
];

export const AiExtractModal: React.FC<AiExtractModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialRawText = '',
  initialMeetingDate = '',
}) => {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [rawText, setRawText] = useState(initialRawText);
  const [fallbackDate, setFallbackDate] = useState(
    initialMeetingDate || new Date().toISOString().split('T')[0]
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [aiNotice, setAiNotice] = useState('');

  // Extracted core fields for review step
  const [parsedTitle, setParsedTitle] = useState('');
  const [parsedDate, setParsedDate] = useState('');
  const [parsedParticipants, setParsedParticipants] = useState<string[]>([]);
  const [parsedNotes, setParsedNotes] = useState('');
  const [parsedTasks, setParsedTasks] = useState<
    Array<{ title: string; assignee: string; dueDate: string; status: TaskStatus }>
  >([]);

  if (!isOpen) return null;

  const handleExtract = async () => {
    if (!rawText.trim()) {
      setErrorMsg('Masukkan teks notula atau transkrip rapat terlebih dahulu.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    try {
      const result = await api.extractFromNotes(rawText, fallbackDate);
      setParsedTitle(result.title || `Rapat ${result.meetingDate}`);
      setParsedDate(result.meetingDate || fallbackDate);
      setParsedParticipants(result.participants || []);
      setParsedNotes(result.meetingNotes || rawText);
      setParsedTasks(result.tasks || []);
      if (result.notice) setAiNotice(result.notice);
      setStep('review');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengekstrak data rapat via AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAndSave = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      await onSuccess({
        title: parsedTitle,
        meetingDate: parsedDate,
        participants: parsedParticipants,
        meetingNotes: parsedNotes,
        tasks: parsedTasks,
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyimpan rapat.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-3xl my-8 overflow-hidden transition-colors">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-900 dark:bg-zinc-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                AI Notula & Action Items Extractor
              </h3>
              <p className="text-[11px] text-zinc-300">
                Ekstraksi otomatis 4 data inti (Tanggal, Peserta, Catatan, Action Items) via Gemini
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 'input' ? (
            /* STEP 1: Input text */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Tempel Catatan Mentah, Transkrip, atau Notula Rapat:
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Gunakan Contoh:</span>
                  {SAMPLE_NOTES.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setRawText(s.text);
                      }}
                      className="text-[10px] px-2 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded border border-zinc-300 dark:border-zinc-700 transition-colors"
                    >
                      {idx === 0 ? 'Sampel ID' : 'Sampel EN'}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={10}
                placeholder="Contoh: Rapat evaluasi Senin 14 September dihadiri Budi dan Siti. Budi sepakat menyelesaikan API sebelum Jumat..."
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="w-full p-3 text-xs font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100 leading-relaxed"
              />

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Tanggal Default:
                  </label>
                  <input
                    type="date"
                    value={fallbackDate}
                    onChange={(e) => setFallbackDate(e.target.value)}
                    className="text-xs px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md font-mono text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleExtract}
                    disabled={isLoading || !rawText.trim()}
                    className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 rounded-lg disabled:opacity-50 shadow-xs transition-colors"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Menganalisis Notula...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Ekstrak 4 Data Inti</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* STEP 2: Review parsed fields */
            <div className="space-y-4">
              {aiNotice && (
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-800 dark:text-indigo-300 rounded-lg text-xs">
                  {aiNotice}
                </div>
              )}

              <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-4 max-h-[460px] overflow-y-auto">
                {/* Title */}
                <div>
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1 uppercase">
                    Topik / Judul Rapat
                  </label>
                  <input
                    type="text"
                    value={parsedTitle}
                    onChange={(e) => setParsedTitle(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Field 1: Tanggal Rapat */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1 uppercase flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                      1. Tanggal Rapat (Meeting Date)
                    </label>
                    <input
                      type="date"
                      value={parsedDate}
                      onChange={(e) => setParsedDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg font-mono text-zinc-900 dark:text-zinc-100"
                    />
                  </div>

                  {/* Field 2: Peserta */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1 uppercase flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-zinc-400" />
                      2. Peserta (Participants)
                    </label>
                    <input
                      type="text"
                      value={parsedParticipants.join(', ')}
                      onChange={(e) =>
                        setParsedParticipants(
                          e.target.value.split(',').map((p) => p.trim()).filter(Boolean)
                        )
                      }
                      className="w-full px-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                    />
                  </div>
                </div>

                {/* Field 3: Catatan */}
                <div>
                  <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 block mb-1 uppercase flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    3. Catatan Notula (Meeting Notes/Minutes)
                  </label>
                  <textarea
                    rows={4}
                    value={parsedNotes}
                    onChange={(e) => setParsedNotes(e.target.value)}
                    className="w-full p-2.5 text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg leading-relaxed text-zinc-900 dark:text-zinc-100"
                  />
                </div>

                {/* Field 4: Tasks (Action items) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-400 uppercase flex items-center gap-1">
                      <CheckSquare className="w-3.5 h-3.5 text-zinc-400" />
                      4. Tasks / Action Items Terdeteksi ({parsedTasks.length})
                    </label>
                  </div>

                  <div className="space-y-2.5">
                    {parsedTasks.map((t, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl space-y-2 shadow-2xs"
                      >
                        {/* Row 1: Full-width Task Title */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-400 shrink-0 w-6 text-center">
                            #{idx + 1}
                          </span>
                          <input
                            type="text"
                            value={t.title}
                            placeholder="Judul tugas / action item..."
                            onChange={(e) => {
                              const updated = [...parsedTasks];
                              updated[idx].title = e.target.value;
                              setParsedTasks(updated);
                            }}
                            className="w-full px-3 py-1.5 text-xs font-semibold bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900 dark:focus:ring-zinc-100"
                          />
                        </div>

                        {/* Row 2: Metadata (Assignee, Due Date, Status) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-8 text-xs">
                          <div>
                            <input
                              type="text"
                              value={t.assignee}
                              placeholder="PIC / Assignee"
                              onChange={(e) => {
                                const updated = [...parsedTasks];
                                updated[idx].assignee = e.target.value;
                                setParsedTasks(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                            />
                          </div>
                          <div>
                            <input
                              type="date"
                              value={t.dueDate}
                              onChange={(e) => {
                                const updated = [...parsedTasks];
                                updated[idx].dueDate = e.target.value;
                                setParsedTasks(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg font-mono text-zinc-900 dark:text-zinc-100"
                            />
                          </div>
                          <div>
                            <select
                              value={t.status}
                              onChange={(e) => {
                                const updated = [...parsedTasks];
                                updated[idx].status = e.target.value as TaskStatus;
                                setParsedTasks(updated);
                              }}
                              className="w-full px-2.5 py-1.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-zinc-100"
                            >
                              <option value="To Do">To Do</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Pending Approval">Pending Approval</option>
                              <option value="Done">Done</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Review Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  ← Edit Teks Asli
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAndSave}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Konfirmasi & Simpan Rapat</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
