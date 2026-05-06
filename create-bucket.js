import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bvoszzsyjnrsfntvsiiy.supabase.co';
const supabaseServiceKey = 'YOUR_SUPABASE_SERVICE_KEY';

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
