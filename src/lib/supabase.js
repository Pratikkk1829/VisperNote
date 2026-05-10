import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://wumxputtvpwjtdqyngrn.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind1bXhwdXR0dnB3anRkcXluZ3JuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MzM3NDIsImV4cCI6MjA5MzQwOTc0Mn0.Sty4U2c5NcL6gaZsGhx3p-Etb3hJsgkI8bDb_u8MBhk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)