export interface DivisionNoteItem {
  id: string;
  divisionName: string;
  notes: string;
}

export interface ParsedMeetingNotes {
  divisionNotes: DivisionNoteItem[];
  generalNotes: string;
  isStructured: boolean;
}

export const DEFAULT_DIVISIONS = [
  'Operasional',
  'Keuangan & Akuntansi',
  'Pemasaran & Penjualan',
  'Teknologi & IT',
  'SDM & Human Resources',
];

/**
 * Parses meeting notes text into structured per-division notes and general notes.
 * ONLY treats notes as structured division notes if explicit "Divisi <Name>" headers exist.
 * This guarantees 100% backward-compatibility: all previous free-form meeting notes,
 * markdown headings (##, ###), bold labels (**Agenda:**, **Catatan:**), bullet lists, etc.
 * will remain completely intact as general notes without any data loss or unwanted splitting.
 */
export function parseMeetingNotes(rawNotes: string): ParsedMeetingNotes {
  if (!rawNotes || typeof rawNotes !== 'string' || !rawNotes.trim()) {
    return {
      divisionNotes: [],
      generalNotes: '',
      isStructured: false,
    };
  }

  const clean = rawNotes.trim();

  // Strict check: Must contain at least one explicit "Divisi <Name>" heading
  // e.g. "### Divisi Marketing", "## Divisi IT", or "**Divisi Keuangan**"
  const hasExplicitDivision = /(?:^|\n)(?:#{2,3}[ \t]+Divisi[ \t]+|\*\*Divisi[ \t]+[^\n*]+\*\*)/i.test(clean);
  if (!hasExplicitDivision) {
    return {
      divisionNotes: [],
      generalNotes: clean,
      isStructured: false,
    };
  }

  // Regex to match section boundaries:
  // 1) Explicit division headers: ### Divisi [Name] or **Divisi [Name]**
  // 2) Plenary / General notes headers: ### Catatan Umum / Pleno, ### Pleno, etc.
  const sectionRegex = /(?:^|\n)(?:(#{2,3}[ \t]+Divisi[ \t]+|\*\*Divisi[ \t]+)|(#{2,3}[ \t]+(?:Catatan[ \t]+Umum(?:\s*\/\s*Pleno)?|Pleno|Kesimpulan(?:\s+Pleno|\s+Rapat)?)[ \t]*|\*\*(?:Catatan[ \t]+Umum(?:\s*\/\s*Pleno)?|Pleno|Kesimpulan(?:\s+Pleno|\s+Rapat)?)\*\*[ \t]*))([^\n*#]*)(?:\*\*)?(?:\n|$)/gi;

  const matches: Array<{ isDiv: boolean; isGen: boolean; name: string; index: number; fullLength: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = sectionRegex.exec(clean)) !== null) {
    const isDiv = Boolean(match[1]);
    const isGen = Boolean(match[2]);
    const rawName = match[3].trim();
    matches.push({
      isDiv,
      isGen,
      name: isDiv ? rawName : (rawName || 'Umum'),
      index: match.index + (match[0].startsWith('\n') ? 1 : 0),
      fullLength: match[0].length - (match[0].startsWith('\n') ? 1 : 0),
    });
  }

  if (matches.length === 0) {
    return {
      divisionNotes: [],
      generalNotes: clean,
      isStructured: false,
    };
  }

  const divisionNotes: DivisionNoteItem[] = [];
  let generalNotes = '';

  // Check if there was text before the first section header (preamble)
  if (matches[0].index > 0) {
    const preamble = clean.slice(0, matches[0].index).trim();
    if (preamble) {
      generalNotes += preamble;
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const startIndex = current.index + current.fullLength;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : clean.length;
    const content = clean.slice(startIndex, endIndex).trim();

    if (current.isGen) {
      generalNotes = generalNotes ? `${generalNotes}\n\n${content}` : content;
    } else {
      const cleanDivName = current.name.replace(/^Divisi\s+/i, '').trim();
      divisionNotes.push({
        id: `div-note-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 4)}`,
        divisionName: cleanDivName || current.name,
        notes: content,
      });
    }
  }

  return {
    divisionNotes,
    generalNotes: generalNotes.trim(),
    isStructured: divisionNotes.length > 0,
  };
}

/**
 * Combines division notes and general notes into a formatted Markdown string.
 */
export function formatMeetingNotes(
  divisionNotes: Array<{ divisionName: string; notes: string }>,
  generalNotes: string = ''
): string {
  const sections: string[] = [];

  for (const item of divisionNotes) {
    const cleanContent = item.notes.trim();
    if (cleanContent) {
      const name = item.divisionName.trim();
      const header = name.toLowerCase().startsWith('divisi ') ? name : `Divisi ${name}`;
      sections.push(`### ${header}\n${cleanContent}`);
    }
  }

  if (generalNotes && generalNotes.trim()) {
    sections.push(`### Catatan Umum / Pleno\n${generalNotes.trim()}`);
  }

  return sections.join('\n\n');
}
