import React from 'react';

export interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * @deprecated Supabase has been migrated 100% to MySQL self-hosted database.
 */
export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = () => {
  return null;
};
