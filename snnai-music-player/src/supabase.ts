import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tjrpeifrekpykmchydof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqcnBlaWZyZWtweWttY2h5ZG9mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2MDEwNjUsImV4cCI6MjA5OTE3NzA2NX0.LSWpsA0oby1MwYLiWB8ZMTTGLhxFUaLG7bQFME4Bam0';

export const supabase = createClient(supabaseUrl, supabaseKey);
