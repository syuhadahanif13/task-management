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

export async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.type.includes('svg') || file.type.includes('gif')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX_DIM = 1400;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(compressedDataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };
    img.src = objectUrl;
  });
}
