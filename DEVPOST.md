# ClaimMate

## One-line pitch
An aftercare companion that turns a product problem into an evidence-backed support request you can review and send yourself.

## Inspiration
Receipts, policy documents and issue notes are often scattered. We wanted a single saved workflow from purchase intake to a prepared support packet.

## What it does
ClaimMate reads receipt text and English receipt photos, asks for purchase review, stores original documents, exposes exact policy sources, records user-confirmed deadlines, prepares editable requests and exports packets. Users can resume saved cases. A curated official-source directory suggests contact routes for recognized brands in India.

## Alexa+ track implementation
A working authenticated MCP server speaks Streamable HTTP protocol 2025-11-25. The web demonstration makes real initialization, discovery and tool calls against the same services as the UI. The experience is clearly labeled **simulated Alexa+**. It is not connected to an Amazon account, approved as an Alexa+ add-on, or tested on an Alexa device. Guided mode is deterministic; no live LLM is connected.

## Built with
React, TypeScript, Vite, Express, Node SQLite, official MCP SDK, Zod, PDF.js, Tesseract.js with bundled English language data, PDFKit and Lucide icons.

## Verified / limits
See TEST_REPORT.md and MCP_TEST_REPORT.md for actual checks. General OCR accuracy is not guaranteed; unclear fields need review. Scanned PDFs need image pages or transcription. The support directory is not arbitrary-company AI web search. No emails, calls, retailer logins, claims, refunds or purchases are initiated.

## Next steps
Broader receipt-layout evaluation; supported live-AI adapter if requested; maintained support-directory coverage; production hosting and security hardening; OAuth and live Alexa+ onboarding only if authorized access becomes available.

## Submission placeholders — complete before submitting
- Repository: https://github.com/rajratanrr/claimmate
- Demo video: not recorded or uploaded by this task; provide a public video under three minutes.
- Select Alexa+ track; attach actual friction log.
- Recheck current official rules and reviewer access requirements.
