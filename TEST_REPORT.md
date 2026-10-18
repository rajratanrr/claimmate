# Verification report

Verified 18 October 2026 on this Mac with Node 24.12.0. Results below are actual executed checks, not proposed tests.

## Automated

**41 tests passed, 0 failed** in the final `npm test` run:

- 16 core service tests: migrations, reviewed receipt persistence, exact/versioned sources, confirmed deadlines, leap-day/month-end/inclusive boundaries, cross-owner guards, ambiguous products, idempotent cases and separate issues, draft updates, Unicode PDF content, corrupt/wrong/oversized input, transcription/source invalidation, prompt-injection isolation, missing policy and SQLite close/reopen persistence.
- 13 receipt tests: ordinary invoice layouts, comma/lakh-grouped totals, labeled/table fields, explicit identifiers, named/numeric dates, ambiguous/invalid dates, conflicting totals, multiple items, missing facts, real bundled English Tesseract OCR, and photo upload → durable unconfirmed autofill → corrected transcription. Ambiguous replacement dates are cleared instead of retaining a stale date.
- 8 real HTTP/MCP integration tests using a temporary server and the official SDK: protocol 2025-11-25 initialization, notifications/discovery, ten tools, full purchase-to-draft/resume flow, schema errors, authenticated ownership, foreign origins, unauthenticated access, cross-user downloads, idempotency and sent-status restriction. See MCP_TEST_REPORT.md.
- 4 document-limit/failure tests: blank/scanned PDF fallback, PDF page limit, corrupted PNG and valid but unreadable PNG. The corrupted-image test found an uncaught Tesseract worker error; an explicit worker error handler now routes it through the existing failed-processing/manual-text path. The regression passes.

`npm run check` and `npm run build` passed after the final code edits. Vite produced the browser bundle successfully. `pnpm install --frozen-lockfile` passed with the retained lockfile and explicit package build configuration. Node prints its standard experimental SQLite warning. Deliberately invalid image/PDF fixtures print parser diagnostics, but the server/test process remains alive.

## Browser

Used the supported Codex browser automation with synthetic data in a separate local demo account:

1. Uploaded `fixtures/receipt-photo.png` through the receipt-first Add purchase dialog.
2. Observed real local OCR filling Dell Inspiron 15 Laptop, Northstar Computers, purchase/delivery dates, INR 70,798.82, invoice reference and serial. No field was marked confirmed automatically.
3. Confirmed the reviewed purchase, uploaded a policy and observed its stored source card.
4. Verified automatic Dell support matching links to the official Dell India contact page.
5. Seeded fictional headphone scenarios.
6. Opened Alexa+ demo, observed real initialize HTTP 200, initialized notification HTTP 202, tools/list and list_purchases, then get_purchase, search_policy_evidence, assess_documented_options, create_claim_draft and resume_case HTTP 200.
7. Opened the same tool-created case in the UI, saved user-entered notes, and downloaded its PDF.
8. Stopped the development server completely, started the production build, reloaded the case URL and observed the same case ID, draft, notes and download event. Browser login cookie remained valid.
9. Captured and inspected desktop (1280-wide) MCP and narrow (390-wide capture) case layouts. No overlapping content in the saved screenshots. Mobile navigation is collapsed behind its menu.

An initial React missing-key warning was corrected; no new application error was observed in the final production interaction. The browser log retains the earlier warning from the development session. Microphone permission/capture and audible speech playback were not exercised. A full browser application quit/relaunch was not performed; refresh and server process restart were performed.

Evidence screenshots: `docs/screenshots/mcp-desktop.jpg`, `docs/screenshots/case-mobile.jpg`.

## PDF

Downloaded the current saved headphone packet through the UI, copied it to `tmp/pdfs/claimmate-sample.pdf`, rendered both pages with Poppler and inspected both page images. Purchase fields, saved issue notes, long policy passages, draft, checklist, attachment list, margins and page numbering were readable without clipping. Original binary attachments are explicitly separate. Automated extraction additionally verified ₹ and Café text survives the embedded font.

## Explicitly unverified / not implemented

- Live AI: not connected, by user choice. No provider smoke test or timeout test applies to this guided-only build.
- Actual Alexa+/Amazon account linking, add-on registration, Echo interaction, certification and remote deployment: not performed.
- General-purpose automatic company web discovery: not implemented. Eight-brand India directory with cited official routes is implemented; contact routes were researched, not contacted.
- Universal OCR accuracy, handwriting/non-English OCR and scanned-PDF OCR: not claimed. Scanned PDFs have the visible manual/page-image fallback.
- No real merchant requests, emails, phone calls, refunds, retailer logins or claim submissions were made.
- Application verification did not include video publication or Devpost submission. Repository publication is tracked separately. No external-user usability study, penetration test or performance benchmark was conducted.
