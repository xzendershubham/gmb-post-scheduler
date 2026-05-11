import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey || supabaseServiceKey === 'YOUR_SUPABASE_SERVICE_KEY') {
  console.warn('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Admin client may fail.');
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'https://bvoszzsyjnrsfntvsiiy.supabase.co',
  supabaseServiceKey || 'YOUR_SUPABASE_SERVICE_KEY',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

