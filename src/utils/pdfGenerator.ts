import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Meeting, Task } from '../types';
import { parseMeetingNotes } from './divisionNotesUtils';

export interface ReportOptions {
  includeStats?: boolean;
  includeNotes?: boolean;
  includeTasks?: boolean;
  statusFilter?: 'all' | 'pending' | 'done';
}

function formatDateIndo(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Filter tasks based on statusFilter option
 */
function filterTasksByOption<T extends Task>(tasks: T[], filter?: 'all' | 'pending' | 'done'): T[] {
  if (!filter || filter === 'all') return tasks;
  if (filter === 'done') return tasks.filter((t) => t.status === 'Done');
  return tasks.filter((t) => t.status !== 'Done');
}

/**
 * ─────────────────────────────────────────────────────────────
 * 1. EXPORT SINGLE MEETING PDF
 * ─────────────────────────────────────────────────────────────
 */
export function exportSingleMeetingPdf(meeting: Meeting, options: ReportOptions = {}): void {
  const {
    includeStats = true,
    includeNotes = true,
    includeTasks = true,
    statusFilter = 'all',
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 18;

  // ─── Header Kop Surat ───
  doc.setFillColor(24, 25, 29); // Dark graphite
  doc.rect(14, currentY, pageWidth - 28, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PT RAJA EMAS INDONESIA', 20, currentY + 9);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('LAPORAN NOTULENSI & TINDAK LANJUT RAPAT', 20, currentY + 16);

  // Badge Tanggal Terbit di Kanan Atas
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  const printDateStr = `Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  doc.text(printDateStr, pageWidth - 20 - doc.getTextWidth(printDateStr), currentY + 16);

  currentY += 28;

  // ─── Metadata Rapat Box ───
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 28, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  const titleText = meeting.title || `Rapat ${formatDateIndo(meeting.meetingDate)}`;
  doc.text(titleText, 18, currentY + 7);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text(`Tanggal Pelaksanaan : ${formatDateIndo(meeting.meetingDate)}`, 18, currentY + 14);

  const participantsList = meeting.participants && meeting.participants.length > 0
    ? meeting.participants.join(', ')
    : 'Tidak ada daftar peserta';
  
  const splitParticipants = doc.splitTextToSize(`Peserta Hadir (${meeting.participants?.length || 0}) : ${participantsList}`, pageWidth - 36);
  doc.text(splitParticipants, 18, currentY + 21);

  currentY += 34;

  // ─── Statistik Singkat Rapat ───
  const allTasks = meeting.tasks || [];
  const tasks = filterTasksByOption(allTasks, statusFilter);
  const doneCount = allTasks.filter((t) => t.status === 'Done').length;
  const inProgressCount = allTasks.filter((t) => t.status === 'In Progress').length;
  const pendingCount = allTasks.filter((t) => t.status === 'Pending Approval').length;
  const todoCount = allTasks.filter((t) => t.status === 'To Do').length;
  const completionRate = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;

  if (includeStats) {
    const boxWidth = (pageWidth - 28 - 9) / 4;
    const statBoxes = [
      { label: 'TOTAL TUGAS', val: `${allTasks.length}`, color: [79, 70, 229] },
      { label: 'SELESAI', val: `${doneCount} (${completionRate}%)`, color: [16, 185, 129] },
      { label: 'ON PROGRESS', val: `${inProgressCount}`, color: [59, 130, 246] },
      { label: 'REVIEW / TO DO', val: `${pendingCount + todoCount}`, color: [245, 158, 11] },
    ];

    statBoxes.forEach((box, idx) => {
      const bX = 14 + idx * (boxWidth + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(bX, currentY, boxWidth, 14, 1.5, 1.5, 'FD');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(box.color[0], box.color[1], box.color[2]);
      doc.text(box.label, bX + 3, currentY + 5);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(box.val, bX + 3, currentY + 11);
    });

    currentY += 19;
  }

  // ─── Catatan / Notulensi Rapat ───
  if (includeNotes && meeting.meetingNotes && meeting.meetingNotes.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('A. NOTULENSI & CATATAN PEMBAHASAN', 14, currentY);
    currentY += 4;

    const parsed = parseMeetingNotes(meeting.meetingNotes);

    if (parsed.isStructured && parsed.divisionNotes.length > 0) {
      if (parsed.generalNotes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        const splitGen = doc.splitTextToSize(parsed.generalNotes, pageWidth - 28);
        doc.text(splitGen, 14, currentY);
        currentY += splitGen.length * 3.8 + 2;
      }

      parsed.divisionNotes.forEach((dn) => {
        if (currentY > pageHeight - 35) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`• Divisi ${dn.divisionName}`, 16, currentY);
        currentY += 3.5;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        const splitDiv = doc.splitTextToSize(dn.notes || '(Tidak ada catatan)', pageWidth - 32);
        doc.text(splitDiv, 18, currentY);
        currentY += splitDiv.length * 3.6 + 3;
      });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      const splitNotes = doc.splitTextToSize(meeting.meetingNotes, pageWidth - 28);
      
      // Check pagination if notes are long
      if (currentY + splitNotes.length * 3.8 > pageHeight - 35) {
        doc.text(splitNotes.slice(0, 15), 14, currentY);
        doc.addPage();
        currentY = 20;
        doc.text(splitNotes.slice(15), 14, currentY);
        currentY += (splitNotes.length - 15) * 3.8 + 4;
      } else {
        doc.text(splitNotes, 14, currentY);
        currentY += splitNotes.length * 3.8 + 4;
      }
    }

    currentY += 4;
  }

  // ─── Tabel Tindak Lanjut / Action Items ───
  if (includeTasks) {
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const taskHeaderTitle = statusFilter === 'all'
      ? 'B. TINDAK LANJUT / ACTION ITEMS'
      : statusFilter === 'done'
      ? 'B. TINDAK LANJUT (HANYA STATUS SELESAI)'
      : 'B. TINDAK LANJUT (BELUM SELESAI / PENDING)';
    doc.text(taskHeaderTitle, 14, currentY);
    currentY += 4;

    const tableData = tasks.map((t, idx) => {
      const assigneesStr = Array.isArray(t.assignees) && t.assignees.length > 0
        ? t.assignees.join(', ')
        : t.assignee || 'Unassigned';

      return [
        (idx + 1).toString(),
        t.title,
        assigneesStr,
        formatShortDate(t.dueDate),
        t.priority || 'Medium',
        t.status,
      ];
    });

    if (tableData.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Tidak ada daftar tindak lanjut untuk kriteria yang dipilih.', 14, currentY + 3);
      currentY += 10;
    } else {
      autoTable(doc, {
        startY: currentY,
        head: [['No', 'Uraian Tugas / Action Item', 'PIC', 'Tenggat', 'Prioritas', 'Status']],
        body: tableData,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 7.5,
          cellPadding: 2.2,
          valign: 'middle',
          font: 'helvetica',
          textColor: [30, 41, 59],
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 32 },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 18, halign: 'center' },
          5: { cellWidth: 26, halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            const rawStatus = String(data.cell.raw);
            if (rawStatus === 'Done') {
              data.cell.styles.textColor = [16, 185, 129]; // Emerald
            } else if (rawStatus === 'In Progress') {
              data.cell.styles.textColor = [37, 99, 235]; // Blue
            } else if (rawStatus === 'Pending Approval') {
              data.cell.styles.textColor = [217, 119, 6]; // Amber
            } else {
              data.cell.styles.textColor = [100, 116, 139]; // Gray
            }
          }
        },
      });

      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 12;
    }
  }

  // ─── Footer Halaman ───
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Sistem Manajemen Tugas & Rapat - PT Raja Emas Indonesia | Halaman ${i} dari ${pageCount}`,
      14,
      pageHeight - 8
    );
  }

  // Download PDF
  const cleanTitle = (meeting.title || `Rapat_${meeting.meetingDate}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Laporan_${cleanTitle}.pdf`);
}

/**
 * ─────────────────────────────────────────────────────────────
 * 2. EXPORT ALL MEETINGS PDF (KONSOLIDASI PERUSAHAAN)
 * ─────────────────────────────────────────────────────────────
 */
export function exportAllMeetingsPdf(meetings: Meeting[], options: ReportOptions = {}): void {
  const {
    includeStats = true,
    includeTasks = true,
    statusFilter = 'all',
  } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let currentY = 18;

  // ─── Header Kop Surat ───
  doc.setFillColor(15, 23, 42); // Navy Dark Slate
  doc.rect(14, currentY, pageWidth - 28, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PT RAJA EMAS INDONESIA', 20, currentY + 9);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('LAPORAN REKAPITULASI SELURUH RAPAT & ACTION ITEMS', 20, currentY + 16);

  // Print Date
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  const printDateStr = `Tanggal Laporan: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  doc.text(printDateStr, pageWidth - 20 - doc.getTextWidth(printDateStr), currentY + 16);

  currentY += 30;

  // ─── Perhitungan Global Statistik ───
  const totalMeetings = meetings.length;
  const allTasksAcrossMeetings: Array<Task & { meetingTitle: string; meetingDate: string }> = [];

  meetings.forEach((m) => {
    (m.tasks || []).forEach((t) => {
      allTasksAcrossMeetings.push({
        ...t,
        meetingTitle: m.title || `Rapat ${m.meetingDate}`,
        meetingDate: m.meetingDate,
      });
    });
  });

  const filteredTasks = filterTasksByOption(allTasksAcrossMeetings, statusFilter);
  const totalTasks = allTasksAcrossMeetings.length;
  const doneTasks = allTasksAcrossMeetings.filter((t) => t.status === 'Done').length;
  const inProgressTasks = allTasksAcrossMeetings.filter((t) => t.status === 'In Progress').length;
  const pendingTasks = allTasksAcrossMeetings.filter((t) => t.status === 'Pending Approval').length;
  const globalCompletionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  if (includeStats) {
    const boxWidth = (pageWidth - 28 - 9) / 4;
    const statBoxes = [
      { label: 'TOTAL RAPAT', val: `${totalMeetings}`, color: [15, 23, 42] },
      { label: 'TOTAL ACTION ITEMS', val: `${totalTasks}`, color: [79, 70, 229] },
      { label: 'SELESAI (DONE)', val: `${doneTasks} (${globalCompletionRate}%)`, color: [16, 185, 129] },
      { label: 'BELUM SELESAI', val: `${totalTasks - doneTasks}`, color: [245, 158, 11] },
    ];

    statBoxes.forEach((box, idx) => {
      const bX = 14 + idx * (boxWidth + 3);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(bX, currentY, boxWidth, 14, 1.5, 1.5, 'FD');

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(box.color[0], box.color[1], box.color[2]);
      doc.text(box.label, bX + 3, currentY + 5);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(box.val, bX + 3, currentY + 11);
    });

    currentY += 19;
  }

  // ─── Tabel 1: Daftar Seluruh Rapat ───
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('A. REKAPITULASI DAFTAR RAPAT', 14, currentY);
  currentY += 4;

  const meetingsTableData = meetings.map((m, idx) => {
    const mTasks = m.tasks || [];
    const mDone = mTasks.filter((t) => t.status === 'Done').length;
    const mRate = mTasks.length > 0 ? `${Math.round((mDone / mTasks.length) * 100)}%` : '0%';
    const pCount = m.participants ? m.participants.length : 0;

    return [
      (idx + 1).toString(),
      formatShortDate(m.meetingDate),
      m.title || `Rapat ${m.meetingDate}`,
      `${pCount} Orang`,
      `${mDone} / ${mTasks.length}`,
      mRate,
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['No', 'Tanggal', 'Judul Rapat', 'Peserta', 'Selesai / Total', 'Tingkat Selesai']],
    body: meetingsTableData,
    theme: 'striped',
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      valign: 'middle',
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 26, halign: 'center' },
      5: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
    },
  });

  // @ts-ignore
  currentY = doc.lastAutoTable.finalY + 10;

  // ─── Tabel 2: Rekapitulasi Action Items ───
  if (includeTasks) {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const taskTitleLabel = statusFilter === 'all'
      ? 'B. DAFTAR SELURUH TINDAK LANJUT (ACTION ITEMS)'
      : statusFilter === 'done'
      ? 'B. DAFTAR TINDAK LANJUT (HANYA SELESAI)'
      : 'B. DAFTAR TINDAK LANJUT (BELUM SELESAI / PENDING)';
    doc.text(taskTitleLabel, 14, currentY);
    currentY += 4;

    const tasksTableData = filteredTasks.map((t, idx) => {
      const assigneesStr = Array.isArray(t.assignees) && t.assignees.length > 0
        ? t.assignees.join(', ')
        : t.assignee || 'Unassigned';

      return [
        (idx + 1).toString(),
        t.meetingTitle,
        t.title,
        assigneesStr,
        formatShortDate(t.dueDate),
        t.status,
      ];
    });

    if (tasksTableData.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Tidak ada data tugas untuk kriteria yang dipilih.', 14, currentY + 3);
      currentY += 10;
    } else {
      autoTable(doc, {
        startY: currentY,
        head: [['No', 'Rapat Asal', 'Uraian Action Item', 'PIC', 'Tenggat', 'Status']],
        body: tasksTableData,
        theme: 'striped',
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 7.2,
          cellPadding: 2,
          valign: 'middle',
          font: 'helvetica',
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 32 },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 28 },
          4: { cellWidth: 20, halign: 'center' },
          5: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 5) {
            const rawStatus = String(data.cell.raw);
            if (rawStatus === 'Done') {
              data.cell.styles.textColor = [16, 185, 129];
            } else if (rawStatus === 'In Progress') {
              data.cell.styles.textColor = [37, 99, 235];
            } else if (rawStatus === 'Pending Approval') {
              data.cell.styles.textColor = [217, 119, 6];
            } else {
              data.cell.styles.textColor = [100, 116, 139];
            }
          }
        },
      });

      // @ts-ignore
      currentY = doc.lastAutoTable.finalY + 12;
    }
  }

  // ─── Footer Halaman ───
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Laporan Konsolidasi Rapat Perusahaan - PT Raja Emas Indonesia | Halaman ${i} dari ${pageCount}`,
      14,
      pageHeight - 8
    );
  }

  // Download PDF
  const todayStr = new Date().toISOString().split('T')[0];
  doc.save(`Laporan_Rekap_Seluruh_Rapat_${todayStr}.pdf`);
}

/**
 * ─────────────────────────────────────────────────────────────
 * 3. GENERATE PRINTABLE HTML & TRIGGER BROWSER PRINT
 * ─────────────────────────────────────────────────────────────
 */
export function printReportHtml(meetingOrMeetings: Meeting | Meeting[], options: ReportOptions = {}): void {
  const isMultiple = Array.isArray(meetingOrMeetings);
  const meetings = isMultiple ? meetingOrMeetings : [meetingOrMeetings];
  const singleMeeting = !isMultiple ? meetingOrMeetings : null;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Browser memblokir pop-up. Mohon izinkan pop-up untuk mencetak dokumen.');
    return;
  }

  const titleHeader = singleMeeting
    ? (singleMeeting.title || `Rapat ${formatDateIndo(singleMeeting.meetingDate)}`)
    : 'Rekapitulasi Seluruh Rapat & Action Items Perusahaan';

  let bodyContent = '';

  if (singleMeeting) {
    const allTasks = singleMeeting.tasks || [];
    const tasks = filterTasksByOption(allTasks, options.statusFilter);
    const doneCount = allTasks.filter((t) => t.status === 'Done').length;
    const completionRate = allTasks.length > 0 ? Math.round((doneCount / allTasks.length) * 100) : 0;

    bodyContent = `
      <div class="header-box">
        <div class="company-badge">PT RAJA EMAS INDONESIA</div>
        <h1>${titleHeader}</h1>
        <p class="subtitle">Laporan Resmi Notulensi & Pemantauan Tindak Lanjut Rapat</p>
      </div>

      <div class="meta-card">
        <div class="meta-row">
          <span class="meta-label">📅 Tanggal Rapat:</span>
          <span class="meta-val"><strong>${formatDateIndo(singleMeeting.meetingDate)}</strong></span>
        </div>
        <div class="meta-row">
          <span class="meta-label">👥 Peserta Hadir (${singleMeeting.participants?.length || 0}):</span>
          <span class="meta-val">${(singleMeeting.participants || []).join(', ') || '-'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">🕒 Dicetak Pada:</span>
          <span class="meta-val">${new Date().toLocaleString('id-ID')}</span>
        </div>
      </div>

      ${options.includeStats !== false ? `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-num">${allTasks.length}</div>
            <div class="stat-label">TOTAL TUGAS</div>
          </div>
          <div class="stat-card stat-done">
            <div class="stat-num">${doneCount} (${completionRate}%)</div>
            <div class="stat-label">SELESAI</div>
          </div>
          <div class="stat-card stat-progress">
            <div class="stat-num">${allTasks.filter((t) => t.status === 'In Progress').length}</div>
            <div class="stat-label">DALAM PROSES</div>
          </div>
          <div class="stat-card stat-todo">
            <div class="stat-num">${allTasks.filter((t) => t.status === 'To Do' || t.status === 'Pending Approval').length}</div>
            <div class="stat-label">REVIEW / TO DO</div>
          </div>
        </div>
      ` : ''}

      ${options.includeNotes !== false && singleMeeting.meetingNotes ? `
        <div class="section-title">A. NOTULENSI & CATATAN RAPAT</div>
        <div class="notes-box">
          ${singleMeeting.meetingNotes.replace(/\n/g, '<br/>')}
        </div>
      ` : ''}

      ${options.includeTasks !== false ? `
        <div class="section-title">B. TINDAK LANJUT / ACTION ITEMS</div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 45%;">Uraian Action Item</th>
              <th style="width: 20%;">PIC / Penanggung Jawab</th>
              <th style="width: 15%; text-align: center;">Tenggat</th>
              <th style="width: 15%; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map((t, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td><strong>${t.title}</strong>${t.description ? `<br/><small style="color: #64748b;">${t.description}</small>` : ''}</td>
                <td>${Array.isArray(t.assignees) && t.assignees.length > 0 ? t.assignees.join(', ') : t.assignee}</td>
                <td style="text-align: center;">${formatShortDate(t.dueDate)}</td>
                <td style="text-align: center;"><span class="badge badge-${t.status.toLowerCase().replace(/\s+/g, '-')}">${t.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    `;
  } else {
    // Multiple meetings consolidated
    const allTasks: Array<Task & { meetingTitle: string }> = [];
    meetings.forEach((m) => {
      (m.tasks || []).forEach((t) => {
        allTasks.push({ ...t, meetingTitle: m.title || `Rapat ${m.meetingDate}` });
      });
    });
    const tasks = filterTasksByOption(allTasks, options.statusFilter);
    const totalDone = allTasks.filter((t) => t.status === 'Done').length;
    const globalRate = allTasks.length > 0 ? Math.round((totalDone / allTasks.length) * 100) : 0;

    bodyContent = `
      <div class="header-box">
        <div class="company-badge">PT RAJA EMAS INDONESIA</div>
        <h1>Rekapitulasi Seluruh Rapat & Tindak Lanjut Perusahaan</h1>
        <p class="subtitle">Laporan Konsolidasi Koordinasi Lintas Divisi</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-num">${meetings.length}</div>
          <div class="stat-label">TOTAL RAPAT</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">${allTasks.length}</div>
          <div class="stat-label">TOTAL ACTION ITEMS</div>
        </div>
        <div class="stat-card stat-done">
          <div class="stat-num">${totalDone} (${globalRate}%)</div>
          <div class="stat-label">SELESAI</div>
        </div>
        <div class="stat-card stat-todo">
          <div class="stat-num">${allTasks.length - totalDone}</div>
          <div class="stat-label">BELUM SELESAI</div>
        </div>
      </div>

      <div class="section-title">A. DAFTAR SELURUH RAPAT</div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 5%; text-align: center;">No</th>
            <th style="width: 20%; text-align: center;">Tanggal</th>
            <th style="width: 45%;">Judul Rapat</th>
            <th style="width: 15%; text-align: center;">Peserta</th>
            <th style="width: 15%; text-align: center;">Progres</th>
          </tr>
        </thead>
        <tbody>
          ${meetings.map((m, idx) => {
            const mTasks = m.tasks || [];
            const done = mTasks.filter((t) => t.status === 'Done').length;
            const rate = mTasks.length > 0 ? `${Math.round((done / mTasks.length) * 100)}%` : '0%';
            return `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td style="text-align: center;">${formatShortDate(m.meetingDate)}</td>
                <td><strong>${m.title || `Rapat ${m.meetingDate}`}</strong></td>
                <td style="text-align: center;">${m.participants?.length || 0} Orang</td>
                <td style="text-align: center;"><strong>${done}/${mTasks.length}</strong> (${rate})</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      ${options.includeTasks !== false ? `
        <div class="section-title" style="margin-top: 30px;">B. REKAPITULASI SELURUH ACTION ITEMS</div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 25%;">Rapat Asal</th>
              <th style="width: 35%;">Action Item</th>
              <th style="width: 15%;">PIC</th>
              <th style="width: 10%; text-align: center;">Tenggat</th>
              <th style="width: 10%; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tasks.map((t, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td>${t.meetingTitle}</td>
                <td><strong>${t.title}</strong></td>
                <td>${Array.isArray(t.assignees) && t.assignees.length > 0 ? t.assignees.join(', ') : t.assignee}</td>
                <td style="text-align: center;">${formatShortDate(t.dueDate)}</td>
                <td style="text-align: center;"><span class="badge badge-${t.status.toLowerCase().replace(/\s+/g, '-')}">${t.status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    `;
  }

  const htmlDoc = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <title>${titleHeader} - PT Raja Emas Indonesia</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm 15mm 20mm 15mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #fff;
          margin: 0;
          padding: 20px;
          line-height: 1.5;
        }
        .header-box {
          background: #18191d;
          color: #ffffff;
          padding: 20px 24px;
          border-radius: 12px;
          margin-bottom: 20px;
        }
        .company-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          color: #f59e0b;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .header-box h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 800;
        }
        .header-box .subtitle {
          margin: 4px 0 0 0;
          font-size: 11px;
          color: #94a3b8;
        }
        .meta-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px 18px;
          margin-bottom: 20px;
          font-size: 12px;
        }
        .meta-row {
          margin-bottom: 6px;
        }
        .meta-row:last-child {
          margin-bottom: 0;
        }
        .meta-label {
          color: #64748b;
          font-weight: 600;
          display: inline-block;
          width: 160px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 24px;
        }
        .stat-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 12px;
          text-align: center;
        }
        .stat-num {
          font-size: 16px;
          font-weight: 800;
          color: #0f172a;
        }
        .stat-label {
          font-size: 9px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .stat-done .stat-num { color: #10b981; }
        .stat-progress .stat-num { color: #3b82f6; }
        .stat-todo .stat-num { color: #f59e0b; }
        .section-title {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
          border-bottom: 2px solid #e2e8f0;
          padding-bottom: 6px;
          margin: 24px 0 12px 0;
        }
        .notes-box {
          background: #fafafa;
          border: 1px solid #f1f5f9;
          border-radius: 8px;
          padding: 14px;
          font-size: 11.5px;
          color: #334155;
          margin-bottom: 24px;
          white-space: pre-wrap;
        }
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
          font-size: 11px;
        }
        .report-table th {
          background: #1e293b;
          color: #ffffff;
          font-weight: 700;
          padding: 8px 10px;
          text-align: left;
        }
        .report-table td {
          border-bottom: 1px solid #e2e8f0;
          padding: 8px 10px;
          color: #334155;
        }
        .report-table tr:nth-child(even) td {
          background: #f8fafc;
        }
        .badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 9999px;
          font-size: 9px;
          font-weight: 700;
        }
        .badge-done { background: #d1fae5; color: #065f46; }
        .badge-in-progress { background: #dbeafe; color: #1e40af; }
        .badge-to-do { background: #f1f5f9; color: #475569; }
        .badge-pending-approval { background: #fef3c7; color: #92400e; }
        .signature-section {
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          page-break-inside: avoid;
        }
        .signature-box {
          text-align: center;
          width: 220px;
          font-size: 11px;
          color: #475569;
        }
        .signature-line {
          height: 60px;
        }
        @media print {
          body {
            padding: 0;
          }
          .header-box {
            background: #18191d !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .report-table th {
            background: #1e293b !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .stat-card, .meta-card {
            background: #f8fafc !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      </style>
    </head>
    <body>
      ${bodyContent}
      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(htmlDoc);
  printWindow.document.close();
}

/**
 * ─────────────────────────────────────────────────────────────
 * 4. GENERATE PLAIN TEXT SUMMARY (FOR WHATSAPP / TELEGRAM)
 * ─────────────────────────────────────────────────────────────
 */
export function generateTextReportSummary(meetingOrMeetings: Meeting | Meeting[]): string {
  const isMultiple = Array.isArray(meetingOrMeetings);

  if (!isMultiple) {
    const meeting = meetingOrMeetings;
    const tasks = meeting.tasks || [];
    const done = tasks.filter((t) => t.status === 'Done').length;
    const rate = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

    let text = `📢 *NOTULENSI & LAPORAN RAPAT REI*\n`;
    text += `*Judul:* ${meeting.title || `Rapat ${meeting.meetingDate}`}\n`;
    text += `*Tanggal:* ${formatDateIndo(meeting.meetingDate)}\n`;
    text += `*Peserta:* ${(meeting.participants || []).join(', ') || '-'}\n`;
    text += `*Penyelesaian Action Items:* ${done}/${tasks.length} Selesai (${rate}%)\n\n`;

    if (tasks.length > 0) {
      text += `*📋 DAFTAR TINDAK LANJUT (ACTION ITEMS):*\n`;
      tasks.forEach((t, i) => {
        const icon = t.status === 'Done' ? '✅' : t.status === 'In Progress' ? '🔄' : t.status === 'Pending Approval' ? '⏳' : '📌';
        const assignee = Array.isArray(t.assignees) && t.assignees.length > 0 ? t.assignees.join(', ') : t.assignee;
        text += `${i + 1}. [${icon} ${t.status}] *${t.title}*\n   👤 PIC: ${assignee} | 📅 Deadline: ${formatShortDate(t.dueDate)}\n`;
      });
    }

    if (meeting.meetingNotes && meeting.meetingNotes.trim()) {
      text += `\n*📝 CATATAN/NOTULENSI RINGKAS:*\n${meeting.meetingNotes.slice(0, 500)}${meeting.meetingNotes.length > 500 ? '...' : ''}\n`;
    }

    text += `\n_Dicetak otomatis dari Sistem Rapat & Manajemen Tugas PT Raja Emas Indonesia_`;
    return text;
  } else {
    const meetings = meetingOrMeetings;
    let text = `📊 *REKAPITULASI RAPAT & ACTION ITEMS REI*\n`;
    text += `*Tanggal Rekap:* ${formatDateIndo(new Date().toISOString().split('T')[0])}\n`;
    text += `*Total Rapat:* ${meetings.length} Rapat\n\n`;

    text += `*DAFTAR RAPAT & PROGRES:*\n`;
    meetings.forEach((m, i) => {
      const t = m.tasks || [];
      const d = t.filter((x) => x.status === 'Done').length;
      const r = t.length > 0 ? Math.round((d / t.length) * 100) : 0;
      text += `${i + 1}. *${m.title || `Rapat ${m.meetingDate}`}* (${formatShortDate(m.meetingDate)})\n   Progres: ${d}/${t.length} Selesai (${r}%)\n`;
    });

    text += `\n_Dicetak otomatis dari Sistem Rapat & Manajemen Tugas PT Raja Emas Indonesia_`;
    return text;
  }
}
