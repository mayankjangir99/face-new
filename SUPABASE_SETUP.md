# Supabase setup

1. In the Supabase Dashboard, open **SQL Editor** and run [`supabase/schema.sql`](./supabase/schema.sql).
2. In **Authentication → Providers → Email**, enable Email and Password. For a quick local demo, turn off **Confirm email**.
3. Create the first account using Supabase Auth (or after the React Auth migration), then promote it once in SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'your-admin-email@example.com');
```

The browser uses only `VITE_SUPABASE_PUBLISHABLE_KEY`. Never add `sb_secret_...` to a Vite environment file.

## Enable staff signup from the app

Deploy `supabase/functions/create-staff/index.ts` as an Edge Function named `create-staff`. In Supabase Dashboard, open **Edge Functions → Deploy a new function → Via Editor**, name it `create-staff`, replace the template with that file's content, and deploy. The function uses the server-side Supabase environment variables and verifies the caller is an admin before creating a staff user.

## Migration status

The Supabase client and secure database/storage schema are ready. The existing screens still use the Express/MongoDB endpoints. Migrate those screen data calls together with Supabase Auth, rather than enabling Supabase Auth alone, because the Express API currently verifies its own JWT tokens.
