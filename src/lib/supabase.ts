/**
 * @deprecated Supabase has been completely removed in favor of self-hosted MySQL.
 * Stub maintained for backward compatibility.
 */

export function getSupabaseConfig(): {
  url: string | null;
  anonKey: string | null;
  isConfigured: boolean;
  source: 'none';
} {
  return { url: null, anonKey: null, isConfigured: false, source: 'none' };
}

export function getSupabaseClient(): null {
  return null;
}

export function setSupabaseCredentials(_url: string, _anonKey: string): null {
  return null;
}

export function clearSupabaseCredentials(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_anon_key');
  }
}

export async function initSupabaseClient(): Promise<null> {
  return null;
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; tables: { meetings: boolean; tasks: boolean } }> {
  return {
    success: false,
    message: 'Supabase telah dinonaktifkan sepenuhnya. Sistem menggunakan database MySQL.',
    tables: { meetings: false, tasks: false },
  };
}

export const SUPABASE_SQL_MIGRATION = '';
