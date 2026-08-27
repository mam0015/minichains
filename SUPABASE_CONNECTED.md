# Supabase connection for MINI

Project URL:
https://hkjgitxovfiamibgpoan.supabase.co

Project Ref:
hkjgitxovfiamibgpoan

Feedback Edge Function:
https://hkjgitxovfiamibgpoan.supabase.co/functions/v1/rapid-handler

The website's `feedback-config.js` is already configured to use that endpoint.

## Remaining Supabase dashboard steps

1. Make sure the table `mini_feedback` exists.
   Run:
   `supabase/migrations/20260827_create_mini_feedback.sql`

2. Open the existing Edge Function:
   `rapid-handler`

3. Replace its code with:
   `supabase/functions/rapid-handler/index.ts`

4. Deploy it.

5. Make sure JWT verification is disabled for this public survey endpoint.
   The included config is:
   `[functions.rapid-handler] verify_jwt = false`

6. Test by placing a checkout order with any optional survey field filled.

7. Check:
   Table Editor → mini_feedback

## Important

Do not put the database password, Secret Key, or service-role key in GitHub Pages.
The browser only uses the public Edge Function URL.
