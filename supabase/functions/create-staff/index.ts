import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  const authorization = request.headers.get('Authorization') || '';
  const callerClient = createClient(
    Deno.env.get('SUPABASE_URL') || '',
    Deno.env.get('SUPABASE_ANON_KEY') || '',
    { global: { headers: { Authorization: authorization } } }
  );
  const { data: { user } } = await callerClient.auth.getUser();
  if (!user) return Response.json({ message: 'Authentication required.' }, { status: 401, headers: corsHeaders });

  const admin = createClient(Deno.env.get('SUPABASE_URL') || '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '');
  const { data: caller } = await admin.from('profiles').select('role').eq('id', user.id).single();
  if (caller?.role !== 'admin') return Response.json({ message: 'Administrator access is required.' }, { status: 403, headers: corsHeaders });

  const { name, email, password, role = 'teacher' } = await request.json();
  if (!name || !email || !password || !['admin', 'teacher'].includes(role)) {
    return Response.json({ message: 'Name, email, password, and a valid role are required.' }, { status: 400, headers: corsHeaders });
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) return Response.json({ message: error.message }, { status: 400, headers: corsHeaders });
  const { error: profileError } = await admin.from('profiles').update({ full_name: name, role }).eq('id', data.user.id);
  if (profileError) return Response.json({ message: profileError.message }, { status: 400, headers: corsHeaders });
  return Response.json({ user: data.user }, { headers: corsHeaders });
});
