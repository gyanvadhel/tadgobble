# Turning on notification emails

The code for the bell and the emails is in the repo. Nothing is live until you do these steps, in this order. They touch your Resend, Supabase and Firebase accounts, so they are yours to run.

1. Confirm `tadgobble.in` is **Verified** in Resend.
2. Create an API key in Resend with "Sending access" for tadgobble.in.
3. Set the secrets. In PowerShell, from the project folder (this makes the two random values for you; put your real Resend key in place of `re_YOUR_KEY_HERE`, with no spaces or quotes):
   ```powershell
   $cron  = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   $unsub = node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   supabase secrets set RESEND_API_KEY=re_YOUR_KEY_HERE CRON_SECRET=$cron UNSUBSCRIBE_SECRET=$unsub ADMIN_EMAIL=hello@tadgobble.in
   $cron
   ```
   - The last line prints `CRON_SECRET`. Keep it for step 6.
   - "Invalid secret pair" means a value is missing or has a space in it.
4. Run `supabase db push`.
5. Run `supabase functions deploy notify-send unsubscribe`.
   - These two functions were written without being run (no Deno on the build machine). If you have Deno, run `deno check supabase/functions/notify-send/index.ts supabase/functions/unsubscribe/index.ts` first and tell me about any error.
6. In the Supabase Dashboard, go to Integrations, enable **Cron** and create a job:
   - name `notify-send`, every 5 minutes (`*/5 * * * *`);
   - type "Supabase Edge Function", POST to `notify-send`;
   - add the header `x-cron-secret: <CRON_SECRET>`.
   - Enabling Cron also asks to enable `pg_net`; accept it.
   - After the first run, open the job's run history and the `notify-send` function logs. You want a 200 with `{"queued":…,"sent":…,"failed":…}`. A 401 means the header does not match `CRON_SECRET`; a 503 means a secret from step 3 is missing; a 500 means read the log line.
7. Run `npm run deploy:hosting`.
8. Test it: comment on your own test product from a second account, wait up to 5 minutes, and check the inbox.

## Notes

- `CRON_SECRET` must be the same value in step 3 and in the Cron header in step 6.
- `UNSUBSCRIBE_SECRET` signs the unsubscribe links. If you change it later, links in emails already sent stop working.
- The bell appears as soon as step 4 and step 7 are done. Emails start once steps 3 to 6 are done.
- Opening the unsubscribe link in an email shows a page with a "Yes, stop emailing me" button. Only the button (or the mail app's own one-click unsubscribe) turns emails off, so link-scanning mail systems cannot unsubscribe anyone by accident.
- If a send fails, Gobble tries again on the next run, up to 5 times, then gives up on that email.
