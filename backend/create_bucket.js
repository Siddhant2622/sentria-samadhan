const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://vmebhogqcthxzfwdzfgg.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'your_supabase_key';
const supabase = createClient(supabaseUrl, supabaseKey);

async function createBucket() {
  const { data, error } = await supabase.storage.createBucket('complaints', {
    public: true,
    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif'],
    fileSizeLimit: 8388608 // 8MB
  });
  
  if (error) {
    if (error.message.includes('already exists')) {
        console.log("Bucket 'complaints' already exists.");
    } else {
        console.error("Error creating bucket:", error);
    }
  } else {
    console.log("Bucket created successfully:", data);
  }
}

createBucket();
