# Biddy

Biddy takes a dictated job description and creates an unsent estimate in a QuickBooks Online sandbox. The API returns a message suitable for Siri and a structured draft when information needs attention.

## Configure and run

1. Use Node.js 22 and run `npm install`. Copy `.env.example` to `.env.local`.
2. Generate a shared secret with `openssl rand -hex 32` and set `BIDDY_SECRET`.
3. In Intuit's OAuth playground, use your app's Development credentials and the `com.intuit.quickbooks.accounting` scope. Authorize the intended sandbox company and exchange the authorization code. Set `QBO_REALM_ID` and `QBO_ACCESS_TOKEN` from that flow. Keep the Intuit client secret and refresh token in the playground or a password manager. Use the playground to refresh manually, then replace the access token and restart or redeploy. Intuit access tokens expire after about an hour. [Intuit OAuth documentation](https://static.developer.intuit.com/output_html/qbo/docs/develop/authentication-and-authorization/oauth-2.0.html)
4. Set `GOOGLE_GENERATIVE_AI_API_KEY`. `GEMINI_MODEL` optionally overrides the Gemini Flash-Lite model identifier.
5. Run `npm run build` and `npm run dev`. For Vercel, import this repository as a Next.js project, set the same server-side environment variables for the target environment, and deploy. Use the resulting HTTPS origin for the Shortcut.

## Verify with a sandbox customer

Replace the example customer and service names with exact names from the intended sandbox. For the example below, first export the shared secret as `BIDDY_SECRET` in your shell.

```sh
curl -sS http://localhost:3000/api/estimates \
  -H "Authorization: Bearer $BIDDY_SECRET" \
  -H 'Content-Type: application/json' \
  --data '{"dryRun":true,"transcript":"For Jane Example. Under General Contracting, remove the damaged porch steps for $450. Under General Contracting, install new cedar steps for $1,250."}'
```

Check for `ready` and verify the two lines and amounts. Run the same request once with `"dryRun":false`. Open the returned estimate in QuickBooks and verify the customer, descriptions, service references, quantities of 1, prices, and unsent status. Try another dry run with an omitted price and confirm `needs_attention`. Customer names must match uniquely. Prices must appear as digits in the transcription. If Biddy cannot confirm creation, look in QuickBooks before retrying. This prototype has no durable submission history or reliable duplicate prevention.

## Create Job Estimate Shortcut

Create a Shortcut on the contractor's Apple device and name it **Create Job Estimate**. Add these actions in order.

1. **Dictate Text**. Dictate the exact customer name and a fixed price per deliverable. Say the service name when it could be ambiguous.
2. **URL**. Enter `https://YOUR-VERCEL-HOST/api/estimates`.
3. **Get Contents of URL**. Use the URL from step 2, choose **POST**, add the header `Authorization` with value `Bearer YOUR_SHARED_SECRET`, and use a **JSON** request body. Add the text field `transcript` with the **Dictated Text** magic variable as its value. Use the secret generated for Biddy. Keep the configured Shortcut private.
4. **Get Dictionary Value**. Read the `message` key from **Contents of URL**.
5. **Show Result**. Pass in the dictionary value.

On the device, run it once in Shortcuts and allow microphone and network access when prompted. Then say “Hey Siri, Create Job Estimate” and verify the resulting message and estimate in the sandbox. The API returns a message for both `created` and `needs_attention`. [Apple Shortcuts POST setup](https://support.apple.com/guide/shortcuts/apd58d46713f/ios)

## OZ Construction project inquiries

The public page is at `/`. It uses the supplied OZ Construction logo and collects the visitor’s name, email, phone, project address, and description.

1. Verify the sending domain in [Resend](https://resend.com/docs/dashboard/domains/introduction) and create a sending API key.
2. Set `RESEND_API_KEY`, `INQUIRY_FROM_EMAIL` (an address on the verified domain), and `INQUIRY_TO_EMAIL` (the contractor’s inbox) in `.env.local` and Vercel.
3. Submit a test inquiry from the deployed page with dummy contact details. Confirm it appears in the contractor’s inbox, contains all five fields, and that Reply addresses the test submitter. Finish this check before sharing the URL.

The intake schema and email delivery live in `lib/intake`. The API emails the contractor for review. It sends no auto-reply and does not create or match QuickBooks customers. The inbox is the only review record. There is no durable delivery queue, submission history, or duplicate detection. The public form has a honeypot and request limits, but no durable rate limits.

The estimate client reads its Sandbox credentials through `SandboxCredentialProvider`. The current provider reads the access token from the environment. Refresh in the Intuit OAuth playground and replace the environment token as described above. A future persistent provider can refresh and store the rotated refresh token before returning an access token to the client.
