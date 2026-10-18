# ClaimMate

A working local product-aftercare prototype for the Alexa+ hackathon track. **Guided mode, not live AI. A simulated Alexa+ interface with real authenticated MCP tools; no Amazon connection or endorsement.** It prepares support requests for review; it never sends emails, submits claims, calls support, buys products or decides coverage.

## Start here

New to the app? Read the [easy customer guide](CUSTOMER_GUIDE.md) or [download the PDF guide](output/pdf/ClaimMate-Customer-Guide.pdf) for the complete purchase-to-support journey.

Requires Node 24 and pnpm (lockfile included).

```sh
git clone https://github.com/rajratanrr/claimmate.git
cd claimmate
pnpm install --frozen-lockfile
npm run migrate
npm run dev
```

Open http://localhost:3000. Create a local account. The server listens only on loopback by default. Passwords are scrypt-hashed; sessions are HTTP-only SameSite cookies, saved in SQLite for 30 days. There is no password-reset/email-verification service in this prototype. Use a unique local-demo password.

`npm run check`, `npm test`, and `npm run build` verify the project. Scripts are invoked through npm because this host's pnpm automatic dependency check selected a different store in sandboxed vs elevated runs. pnpm owns installation and the lockfile. `pnpm-workspace.yaml` explicitly permits esbuild's required install step and declines the unnecessary Tesseract postinstall; it does not globally allow package scripts.

Production local run:

```sh
npm run build
NODE_ENV=production npm start
```

Environment variables can be supplied by the process manager. `.env.example` is documentation; this server does not automatically load `.env` files. If desired, use Node's `--env-file` support in your own launch configuration.

## Where the database is

The default database is `data/claimmate.sqlite`. SQLite WAL/SHM files beside it are live database state; don't delete them while the server runs. Original documents use generated storage keys under `data/uploads/`. This directory is created with the first upload. `DATA_DIR` and `UPLOAD_DIR` override locations. `server/db.ts` applies numbered SQL migrations at startup.

The database contains users, hashed sessions, purchases, document metadata/extracted text, versioned policy passages, confirmed deadlines, cases, conversations, ordered messages and case events. Browser localStorage stores only a voice display preference. Refresh, browser close and server restart preserve saved work. Browser cookies identify the account; clearing them requires signing in again.

Back up **the whole data directory with the server stopped**, plus a separately configured upload directory. Do not commit it. `Settings & help → Export` exports records and extracted text; original binaries are downloaded separately. Ownership is enforced for tools, reads, writes and downloads. Files are private to the server process, not application-level encrypted at rest; use encrypted host storage for sensitive records.

## How to use it

1. **Add a purchase:** drop a receipt photo/PDF/TXT directly into the dialog, optionally add a product name, then select **Read receipt & review**. English image OCR runs on the server using bundled Tesseract assets. No receipt is transmitted to an AI or OCR service.
2. **Review:** readable product, merchant, date, amount, currency, order/invoice reference and serial fields are filled when identified. Suggestions are saved as unconfirmed fields. Unknown fields stay for manual entry; ambiguous numeric dates require review. A product photograph without printed purchase information cannot provide a price or purchase date. Confirm corrected details.
3. **Policy:** upload with document type **Return / warranty policy**, or paste text. Inspect exact excerpts. Confirm a deadline only when its source, trigger and calendar convention are clear. Policy periods do not prove a particular fault is covered.
4. **Support contacts:** the purchase and case screens automatically match saved names against eight verified brand support routes for India. Select the brand if automatic matching is ambiguous. Contact cards link official sources and show when checked. Unknown companies produce an explicit no-match result; no numbers or emails are invented. This is a curated directory, not live AI web search. For orders/returns start with the seller; for faults consider manufacturer support.
5. **Assistant:** enter “My headphones stopped charging,” choose the correct purchase if ambiguous, and prepare a draft. Voice input is optional and browser-dependent. Correct the transcript before sending. Browser speech services may process audio remotely.
6. **Cases:** add onset/troubleshooting notes, check evidence, edit the draft and save. Copy or download TXT/PDF. The PDF contains saved details and source passages; original attachments are separate. Only manually mark sent after contacting the seller yourself.
7. **Resume:** reopen Cases or refresh a case URL. Conversation history and its linked case remain saved. Reopening the browser/server is supported with the same data directory and account.
8. **Alexa+ demo:** initialize the real MCP endpoint, discover tools, inspect a purchase and policy evidence, prepare a draft through MCP, then open it in the case workspace. The trace displays real server responses.

Document limits: 10 MB, PDF ≤30 pages, extracted text ≤200,000 characters. PNG/JPEG signatures and UTF-8 TXT are checked. Corrupted or unreadable files offer retry/manual transcription. Scanned PDFs currently need individual page images or pasted transcription. Duplicate same-purchase/type/content uploads reuse the existing document. Replacing extracted policy text invalidates its old passages/deadlines; previously saved drafts warn about removed citations. OCR is English only, single concurrent job, with a 45-second recognition timeout. Poor photos and complex invoices may require corrections.

## MCP

`POST /mcp` uses SDK 1.32.1, Streamable HTTP, protocol 2025-11-25. Stateless initialization and JSON responses are supported. GET/DELETE return 405 because no standalone SSE stream or stateful sessions are offered. Notifications receive acknowledgement via the SDK. Browser origin and cross-site requests are checked. All tools use the authenticated user, never an `owner_id` argument.

Tools: `list_purchases`, `get_purchase`, `search_policy_evidence`, `assess_documented_options`, `create_claim_draft`, `get_claim`, `update_claim`, `get_claim_packet`, `resume_case`, `find_support_contacts`.

Use **Alexa+ demo** for the easiest real protocol walkthrough. For another client, Settings → Developer connection → Copy a new private MCP token. Send it as `Authorization: Bearer …`; it lasts 24 hours. Do not paste it into source or logs. Logging out clears the browser session but does not revoke separately issued client tokens; deleting the account revokes them. These tokens are local testing credentials, not OAuth account linking.

`tests/integration.test.ts` launches a separate server and temporary database, connects the official MCP SDK client, exercises tools and tests unauthorized/cross-user requests. See `MCP_TEST_REPORT.md` and `ALEXA_HACKATHON_GUIDE.md`.

## Deploy on Render

The repository includes [`render.yaml`](render.yaml). In the [Render dashboard](https://dashboard.render.com/), select **New → Blueprint**, connect `rajratanrr/claimmate`, choose branch `main`, and leave **Blueprint Path** at its default, `render.yaml`. Review the service and disk costs, then deploy.

The Blueprint provisions one **paid `1c-2g` web service (1 CPU, 2 GB RAM)** with a **1 GB persistent disk**. OCR benefits from the extra memory. [Render's free services cannot attach persistent disks](https://render.com/docs/disks), so switching this SQLite app to the free tier would lose saved data on restarts/redeploys. No cloud resources are created by adding this file.

The build installs the pinned pnpm dependencies, including the build tools and `tsx` runtime, then builds the frontend. Startup runs the Express server and applies database migrations after the disk is mounted. Render supplies `PORT`; the server binds to `0.0.0.0`, serves the frontend/API/MCP together, and answers health checks at `/api/health`. Guided mode and receipt OCR require no API key.

- **Database:** `/var/data/claimmate/claimmate.sqlite` (with its WAL/SHM files).
- **Original receipts:** `/var/data/claimmate/uploads/` on the same persistent disk.
- **Sign-in:** HTTPS-only cookies. Render's assigned `RENDER_EXTERNAL_URL` is automatically allowed. For a custom domain, add its exact HTTPS origin to `ALLOWED_ORIGINS` in Render's Environment settings; separate additional origins with commas.
- **First visit:** open the assigned HTTPS URL and create an account. The hosted database starts empty; your local account and uploads are not automatically copied.
- **Verify:** upload a sample receipt, confirm the details, then redeploy and sign back in to check that saved records and original downloads remain available. Keep one instance and back up the database plus uploads.

## Deployment boundary

This checkout is an ordinary Express/SQLite app, not the unavailable earlier Sites/Vinext project. No Site was registered and no Amazon add-on was installed. Adding the Render Blueprint does not deploy the app. For deployment use a Node 24 host with a durable volume, HTTPS reverse proxy, exact allowed origins, `COOKIE_SECURE=true`, backups and request/upload limits. Set HOST only as appropriate for the host network. `VolumeStorage` implements the `PrivateStorage` adapter for persistent-volume production hosting. Never place the database/uploads on ephemeral serverless disk or publicly served static storage. Multi-instance deployments need a coordinated database/storage strategy; this prototype is single-instance.

Actual Alexa+ account linking needs partner access and additional OAuth/onboarding implementation. The official hackathon FAQ accepts local runnable demonstrations; see the linked guide. Live AI and arbitrary web company discovery remain unimplemented by the user's guided-mode choice.

## Dependencies and attribution

React, Vite and TypeScript: UI/build. Express and Multer: HTTP/multipart intake. Node SQLite: database. Zod: input validation. Official Model Context Protocol SDK: protocol. PDF.js (`pdfjs-dist`): text extraction. Tesseract.js and bundled `@tesseract.js-data/eng`: local English OCR. PDFKit and DejaVu Sans: Unicode packet rendering. Lucide: icons. Packages retain their upstream licenses. Bundled font license is in `public/fonts/LICENSE-DejaVu.txt`. Original branding and CSS illustration; no Amazon logos.

See `DEMO_SCRIPT.md`, `DEVPOST.md`, `TEST_REPORT.md`, `FRICTION_LOG.md`, and `BUILD_STATUS.md` for delivery evidence and limitations.
