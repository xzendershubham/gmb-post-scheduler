import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Initialization of the Supabase Admin client
// Note: We check for keys at runtime when needed, or you can check process.env here
if (typeof process !== 'undefined' && (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL)) {
  console.warn('Supabase URL not found in environment.');
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

