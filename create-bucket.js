import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorage() {
  console.log('Creating posts bucket...');
  const { data, error } = await supabase.storage.createBucket('posts', {
    public: true,
    fileSizeLimit: 5242880, // 5MB limit
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('Bucket "posts" already exists. Ensuring it is public...');
      const { error: updateError } = await supabase.storage.updateBucket('posts', {
        public: true,
      });
      if (updateError) {
        console.error('Failed to make bucket public:', updateError);
      } else {
        console.log('Bucket is public and ready.');
      }
    } else {
      console.error('Error creating bucket:', error);
    }
  } else {
    console.log('Bucket "posts" created successfully.');
  }
}

setupStorage();
