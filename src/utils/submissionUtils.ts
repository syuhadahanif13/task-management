import { TaskSubmission } from '../types';

export const SUBMISSION_DELIMITER = '__SUBMISSION_DATA__';

export function extractTaskDescription(desc?: string): string {
  if (!desc) return '';
  const idx = desc.indexOf(SUBMISSION_DELIMITER);
  if (idx >= 0) {
    return desc.substring(0, idx).trim();
  }
  return desc;
}

export function extractTaskSubmissionFromDescription(desc?: string): TaskSubmission | null {
  if (!desc) return null;
  const idx = desc.indexOf(SUBMISSION_DELIMITER);
  if (idx < 0) return null;
  try {
    const jsonStr = desc.substring(idx + SUBMISSION_DELIMITER.length).trim();
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object') {
      return parsed as TaskSubmission;
    }
    return null;
  } catch {
    return null;
  }
}

export function embedTaskSubmissionIntoDescription(originalDesc: string = '', sub: TaskSubmission): string {
  const cleanDesc = extractTaskDescription(originalDesc);
  return `${cleanDesc}\n${SUBMISSION_DELIMITER}\n${JSON.stringify(sub)}`;
}
