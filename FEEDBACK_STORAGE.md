# MINI Survey / Feedback Storage

The checkout now has optional:
- First name
- Level
- Comment

The browser always keeps a local demo copy in:
`localStorage -> mini-feedback-v1`

That is useful for testing on one device, but it is NOT shared between customers.

## Recommended shared storage: Supabase

Create a table:

```sql
create table public.mini_feedback (
  id text primary key,
  order_id text,
  payment_method text,
  first_name text,
  level text,
  comment text,
  created_at timestamptz default now()
);
```

Do not expose a service-role key in GitHub Pages.

Recommended flow:

Website
→ public HTTPS POST endpoint / Edge Function
→ validate fields
→ insert into `mini_feedback`

Then put that public POST URL in:

`feedback-config.js`

```js
window.MINI_FEEDBACK = {
  endpoint: 'https://YOUR-ENDPOINT'
};
```

## Simpler alternative

For a school project, you can also use:
- Formspree
- Google Apps Script connected to Google Sheets

These are easier if you only need comments for your presentation.

## What you can present later

Export the responses and show:
- number of customers
- levels / year groups
- comments
- cash vs card preference
- favourite products
- satisfaction themes

Do not collect unnecessary personal information. First name is optional by design.
