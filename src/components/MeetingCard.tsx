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
      className={`notion-card notion-card-hover cursor-pointer ${
        isSelected ? 'border-notion-accent bg-notion-hover' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="notion-badge bg-notion-sidebar text-notion-text-secondary">
            <Calendar className="mr-1 h-3 w-3" />
            {formattedDate}
          </span>
          <span className="text-[11px] text-notion-text-secondary">{meeting.meetingDate}</span>
        </div>

        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(meeting.id);
            }}
            className="rounded-md p-1 text-notion-text-secondary opacity-0 transition-opacity hover:text-notion-danger group-hover:opacity-100"
            title="Hapus Rapat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <h3 className="notion-page-title mb-2 line-clamp-1">
        {meeting.title || `Rapat ${meeting.meetingDate}`}
      </h3>

      <p className="text-sm text-notion-text-secondary line-clamp-2 mb-3.5 leading-relaxed">
        {meeting.meetingNotes}
      </p>

      <div className="mb-4">
        <div className="flex items-center gap-1 text-[11px] font-medium text-notion-text-secondary mb-1.5">
          <Users className="h-3.5 w-3.5" />
          <span>Peserta ({meeting.participants.length})</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {meeting.participants.slice(0, 3).map((p, idx) => (
            <span
              key={idx}
              className="notion-badge bg-notion-sidebar text-notion-text-secondary"
            >
              {p}
            </span>
          ))}
          {meeting.participants.length > 3 && (
            <span className="notion-badge bg-notion-sidebar text-notion-text-secondary">
              +{meeting.participants.length - 3}
            </span>
          )}
        </div>
      </div>

      <div className="notion-divider pt-3 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-notion-text-secondary" />
          <span className="font-medium text-notion-text-secondary">
            {totalTasks} Action Items
          </span>
          {totalTasks > 0 && (
            <span className="text-[11px] text-notion-text-secondary">
              ({completedTasks} selesai)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-medium text-notion-text-secondary">
          <span className="text-[11px] font-mono">{progressPercent}%</span>
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>

      {totalTasks > 0 && (
        <div className="mt-2 h-1 rounded-full bg-notion-sidebar">
          <div
            className="h-full rounded-full bg-notion-accent transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};