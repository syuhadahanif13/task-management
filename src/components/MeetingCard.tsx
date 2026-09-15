import React from 'react';
import { Meeting } from '../types';
import { Calendar, Users, FileText, CheckCircle2, ChevronRight, Trash2 } from 'lucide-react';

interface MeetingCardProps {
  meeting: Meeting;
  isSelected?: boolean;
  onSelect: (meeting: Meeting) => void;
  onDelete?: (meetingId: string) => void;
}

export const MeetingCard: React.FC<MeetingCardProps> = ({
  meeting,
  isSelected = false,
  onSelect,
  onDelete,
}) => {
  const totalTasks = meeting.tasks?.length || 0;
  const completedTasks = meeting.tasks?.filter((t) => t.status === 'Done').length || 0;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Format date nicely
  const formattedDate = new Date(meeting.meetingDate).toLocaleDateString('id-ID', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      id={`meeting-card-${meeting.id}`}
      onClick={() => onSelect(meeting)}
      className={`group relative p-5 rounded-xl border transition-all cursor-pointer ${
        isSelected
          ? 'bg-zinc-900 text-white border-zinc-900 shadow-md ring-2 ring-zinc-900 ring-offset-2'
          : 'bg-white hover:bg-zinc-50/90 text-zinc-900 border-zinc-200 hover:border-zinc-300 shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Core Field 1: Meeting Date (Tanggal Rapat) */}
        <div className="flex items-center gap-2">
          <div
            className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 ${
              isSelected ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{formattedDate}</span>
          </div>
          <span className={`text-[11px] ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
            ({meeting.meetingDate})
          </span>
        </div>

        {/* Delete action button */}
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(meeting.id);
            }}
            className={`p-1.5 rounded-md transition-colors ${
              isSelected
                ? 'text-zinc-400 hover:text-rose-300 hover:bg-zinc-800'
                : 'text-zinc-400 hover:text-rose-600 hover:bg-rose-50'
            }`}
            title="Hapus Rapat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Meeting Title / Topic */}
      <h3
        className={`text-base font-semibold leading-tight tracking-tight mb-2.5 line-clamp-1 ${
          isSelected ? 'text-white' : 'text-zinc-900'
        }`}
      >
        {meeting.title || `Rapat ${meeting.meetingDate}`}
      </h3>

      {/* Core Field 3: Meeting Notes (Catatan) - Preview */}
      <p
        className={`text-xs line-clamp-2 mb-3.5 leading-relaxed ${
          isSelected ? 'text-zinc-300' : 'text-zinc-600'
        }`}
      >
        {meeting.meetingNotes}
      </p>

      {/* Core Field 2: Participants (Peserta) */}
      <div className="mb-4">
        <div className="flex items-center gap-1 text-[11px] font-medium mb-1.5">
          <Users className={`w-3.5 h-3.5 ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`} />
          <span className={isSelected ? 'text-zinc-300' : 'text-zinc-600'}>
            Peserta ({meeting.participants.length})
          </span>
        </div>
        <div className="flex flex-wrap gap-1">
          {meeting.participants.slice(0, 3).map((p, idx) => (
            <span
              key={idx}
              className={`text-[11px] px-2 py-0.5 rounded-md truncate max-w-[140px] ${
                isSelected
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
              }`}
            >
              {p}
            </span>
          ))}
          {meeting.participants.length > 3 && (
            <span
              className={`text-[11px] px-1.5 py-0.5 rounded-md font-mono ${
                isSelected ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-500'
              }`}
            >
              +{meeting.participants.length - 3} lainnya
            </span>
          )}
        </div>
      </div>

      {/* Core Field 4: Tasks (Action Items) Summary & Progress (One-to-Many) */}
      <div
        className={`pt-3 border-t flex items-center justify-between gap-3 text-xs ${
          isSelected ? 'border-zinc-800' : 'border-zinc-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2
            className={`w-4 h-4 ${
              completedTasks === totalTasks && totalTasks > 0
                ? 'text-emerald-500'
                : isSelected
                ? 'text-zinc-400'
                : 'text-zinc-400'
            }`}
          />
          <span className={`font-medium ${isSelected ? 'text-zinc-200' : 'text-zinc-700'}`}>
            {totalTasks} Action Items
          </span>
          {totalTasks > 0 && (
            <span className={`text-[11px] ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>
              ({completedTasks} selesai)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-medium">
          <span
            className={`text-[11px] font-mono ${
              isSelected ? 'text-zinc-300' : 'text-zinc-600'
            }`}
          >
            {progressPercent}%
          </span>
          <ChevronRight
            className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              isSelected ? 'text-white' : 'text-zinc-400'
            }`}
          />
        </div>
      </div>

      {/* Mini Progress Bar */}
      {totalTasks > 0 && (
        <div
          className={`mt-2 h-1 rounded-full overflow-hidden ${
            isSelected ? 'bg-zinc-800' : 'bg-zinc-100'
          }`}
        >
          <div
            className={`h-full transition-all duration-300 ${
              progressPercent === 100
                ? 'bg-emerald-500'
                : isSelected
                ? 'bg-white'
                : 'bg-zinc-900'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};
