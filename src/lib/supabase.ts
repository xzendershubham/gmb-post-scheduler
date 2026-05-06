import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bvoszzsyjnrsfntvsiiy.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0NaRah6DijN1rYtiEqwUKw_9AGPO1Xk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
