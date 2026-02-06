import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // This prevents weird TS behaviour and gives a clear error at runtime
  console.warn('Missing Supabase env vars. Check .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
