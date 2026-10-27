import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Gunakan SUPABASE_SERVICE_ROLE_KEY (backend secret) jika tersedia untuk bypass RLS dengan aman di server,
// atau fallback ke NEXT_PUBLIC_SUPABASE_ANON_KEY.
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('Warning: Supabase URL or Key is missing from environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
