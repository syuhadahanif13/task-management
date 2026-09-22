import React, { useState } from 'react';
import { Meeting } from '../types';
import { SUPABASE_SQL_MIGRATION } from '../lib/supabase';
import { Database, X, Code, CheckCircle, ArrowDown, Copy, Download, Layers } from 'lucide-react';

interface SchemaInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetings: Meeting[];
}

export const SchemaInspectorModal: React.FC<SchemaInspectorModalProps> = ({
  isOpen,
  onClose,
  meetings,
}) => {
  const [activeTab, setActiveTab] = useState<'erd' | 'dictionary' | 'sql' | 'json'>('erd');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const totalTasks = meetings.reduce((acc, m) => acc + (m.tasks?.length || 0), 0);

  const sqlSchema = SUPABASE_SQL_MIGRATION;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJsonBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(meetings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `meeting-tasks-export-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                System Architect: Data Schema & 1:N Relationship
              </h3>
              <p className="text-[11px] text-zinc-400">
                Pondasi arsitektur data sistem manajemen tugas hasil rapat
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

        {/* Tab Selection */}
        <div className="px-6 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1 py-2">
            {[
              { id: 'erd', label: 'Diagram Relasi ERD (1:N)' },
              { id: 'dictionary', label: 'Kamus 4 Data Inti' },
              { id: 'sql', label: 'Skema DDL SQL' },
              { id: 'json', label: 'Snapshot Data JSON' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={downloadJsonBackup}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-white border border-zinc-300 rounded hover:bg-zinc-100"
              title="Ekspor snapshot basis data JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor JSON</span>
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'erd' && (
            <div className="space-y-6">
              {/* Relational Status Banner */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900">
                      Integritas Relasional 1-ke-Banyak Terverifikasi
                    </h4>
                    <p className="text-[11px] text-emerald-700">
                      Setiap Tugas (Task) terikat ke satu Rapat (Meeting) melalui Foreign Key (meetingId).
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs font-mono font-bold text-emerald-800">
                  {meetings.length} Rapat ➔ {totalTasks} Tindak Lanjut
                </div>
              </div>

              {/* Visual ERD Diagram */}
              <div className="p-6 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col md:flex-row items-center justify-center gap-6">
                {/* Table 1: Meetings */}
                <div className="w-72 bg-white rounded-xl border-2 border-zinc-900 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-zinc-900 text-white text-xs font-bold flex items-center justify-between">
                    <span>MEETINGS (Tabel Rapat)</span>
                    <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded font-mono">1</span>
                  </div>
                  <div className="p-3 text-xs divide-y divide-zinc-100 space-y-1.5 font-mono">
                    <div className="flex justify-between pt-1 text-zinc-900 font-semibold">
                      <span>id [PK]</span>
                      <span className="text-zinc-400">VARCHAR(64)</span>
                    </div>
                    <div className="flex justify-between pt-1 text-zinc-900">
                      <span>1. meetingDate</span>
                      <span className="text-zinc-500">DATE</span>
                    </div>
                    <div className="flex justify-between pt-1 text-zinc-900">
                      <span>2. participants</span>
                      <span className="text-zinc-500">TEXT[]</span>
                    </div>
                    <div className="flex justify-between pt-1 text-zinc-900">
                      <span>3. meetingNotes</span>
                      <span className="text-zinc-500">TEXT</span>
                    </div>
                    <div className="flex justify-between pt-1 text-zinc-500 text-[11px]">
                      <span>title (optional)</span>
                      <span>VARCHAR</span>
                    </div>
                  </div>
                </div>

                {/* Connector Arrow */}
                <div className="flex flex-col items-center justify-center text-zinc-500 font-mono text-xs">
                  <div className="px-2.5 py-1 rounded bg-zinc-200 text-zinc-800 font-semibold mb-1">
                    1 : N
                  </div>
                  <span className="text-[10px] text-zinc-400 text-center max-w-[90px]">
                    One-to-Many CASCADE
                  </span>
                </div>

                {/* Table 2: Tasks */}
                <div className="w-72 bg-white rounded-xl border-2 border-indigo-600 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-indigo-600 text-white text-xs font-bold flex items-center justify-between">
                    <span>TASKS (Action Items)</span>
                    <span className="text-[10px] bg-indigo-700 px-1.5 py-0.5 rounded font-mono">N</span>
                  </div>
                  <div className="p-3 text-xs divide-y divide-zinc-100 space-y-1.5 font-mono">
                    <div className="flex justify-between pt-1 text-zinc-900 font-semibold">
                      <span>id [PK]</span>
                      <span className="text-zinc-400">VARCHAR(64)</span>
                    </div>
                    <div className="flex justify-between pt-1 text-indigo-700 font-bold bg-indigo-50/50 px-1 rounded">
                      <span>meetingId [FK]</span>
                      <span>➔ meetings.id</span>
                    </div>
                    <div className="flex justify-between pt-1 text-zinc-900">
                      <span>4a. title</span>
                      <span className="text-zinc-500">VARCHAR</span>
                    </div>
                    <div className="flex justify-between pt-1 text-zinc-900">
                      <span>4b. assignee</span>
                      <span className="text-zinc-500">VARCHAR</span>
                    </div>
                    <div className="flex justify-between pt-1 text-zinc-900">
                      <span>4c. dueDate</span>
                      <span className="text-zinc-500">DATE</span>
                    </div>
                    <div className="flex justify-between pt-1 text-zinc-900">
                      <span>4d. status</span>
                      <span className="text-zinc-500">ENUM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dictionary' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                Spesifikasi 4 Data Inti (Mandatory Fields)
              </h4>
              <div className="overflow-x-auto border border-zinc-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 border-b border-zinc-200 text-zinc-700">
                    <tr>
                      <th className="p-3 font-bold">No</th>
                      <th className="p-3 font-bold">Nama Field (ID / EN)</th>
                      <th className="p-3 font-bold">Tipe Data</th>
                      <th className="p-3 font-bold">Deskripsi & Peran Relasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    <tr>
                      <td className="p-3 font-bold">1</td>
                      <td className="p-3 font-semibold text-zinc-900">
                        Meeting Date (Tanggal Rapat)
                      </td>
                      <td className="p-3 font-mono text-zinc-600">DATE (YYYY-MM-DD)</td>
                      <td className="p-3 text-zinc-600">
                        Waktu kronologis rapat diselenggarakan. Menjadi dasar perhitungan tenggat waktu (due date) tindak lanjut.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold">2</td>
                      <td className="p-3 font-semibold text-zinc-900">
                        Participants (Peserta)
                      </td>
                      <td className="p-3 font-mono text-zinc-600">ARRAY&lt;STRING&gt;</td>
                      <td className="p-3 text-zinc-600">
                        Daftar seluruh pihak atau pemangku kepentingan yang menghadiri rapat. Berfungsi sebagai penyedia entitas penanggung jawab (Assignee) untuk tugas.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold">3</td>
                      <td className="p-3 font-semibold text-zinc-900">
                        Meeting Notes/Minutes (Catatan)
                      </td>
                      <td className="p-3 font-mono text-zinc-600">TEXT / MARKDOWN</td>
                      <td className="p-3 text-zinc-600">
                        Catatan substansi, latar belakang keputusan, dan pembahasan rapat. Merupakan sumber data utama yang diproses oleh AI pipeline.
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-bold">4</td>
                      <td className="p-3 font-semibold text-zinc-900">
                        Tasks (Action items: title, assignee, due date, status)
                      </td>
                      <td className="p-3 font-mono text-zinc-600">RELATIONAL COLLECTION (1:N)</td>
                      <td className="p-3 text-zinc-600">
                        Tindakan konkret turunan hasil notula rapat. Setiap item memiliki judul tindakan (title), penanggung jawab (assignee), batas waktu (dueDate), dan status pengerjaan (status).
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-mono">PostgreSQL / Cloud SQL Compatible DDL</span>
                <button
                  onClick={() => copyToClipboard(sqlSchema)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-300"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Tersalin!' : 'Salin SQL'}</span>
                </button>
              </div>
              <pre className="p-4 bg-zinc-900 text-zinc-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
                {sqlSchema}
              </pre>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-mono">Snapshot Live State ({meetings.length} Meetings)</span>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(meetings, null, 2))}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-300"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Tersalin!' : 'Salin JSON'}</span>
                </button>
              </div>
              <pre className="p-4 bg-zinc-900 text-zinc-100 rounded-xl text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
                {JSON.stringify(meetings, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
