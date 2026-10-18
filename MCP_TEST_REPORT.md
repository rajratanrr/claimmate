# ClaimMate local MCP verification

Verified on 18 October 2026 using Node 24.12.0 and the installed official `@modelcontextprotocol/sdk` 1.32.1. The package manifest accepts SDK versions `^1.27.1`.

## Result

**8 integration tests passed; TypeScript check passed.** These tests launch the actual application server on an available loopback port with a new temporary SQLite database and upload directory. They register two test accounts, exercise the HTTP routes and connect a real MCP SDK client. No existing user account, database or upload is used. Temporary data is removed after the run.

Reproduce from the project directory:

```sh
node --import tsx --test tests/integration.test.ts
npm run check
```

The normal `npm test` command includes this integration test file. In a restricted execution sandbox, permission to open a local listening socket is required.

## Verified behavior

- An authenticated raw JSON-RPC `initialize` request negotiates MCP protocol `2025-11-25`. The official SDK independently connects using the same protocol. The server uses stateless Streamable HTTP and does not issue a session ID.
- `tools/list` exposes ten tools with object input schemas: `list_purchases`, `get_purchase`, `search_policy_evidence`, `assess_documented_options`, `find_support_contacts`, `create_claim_draft`, `get_claim`, `update_claim`, `get_claim_packet` and `resume_case`.
- The SDK can list and retrieve purchases, search stored policy passages, assess documented options, prepare a support draft, edit it, read its packet and resume the saved case with its timeline.
- Receipt and policy intake work through HTTP. Unconfirmed purchases cannot produce a claim draft. User confirmation unlocks draft creation.
- Reusing a claim's idempotency key with the same inputs returns the existing case. Reusing it for a different issue returns a tool error.
- The support tool returns a clearly labelled, curated India directory, official source URLs and verification dates. An unknown product produces no fabricated match; a selected supported brand returns its official route. Unsupported brand arguments are rejected.
- Invalid UUIDs and short issue/idempotency inputs produce MCP tool validation errors. An MCP client cannot set the user-only “sent” status.
- Missing or invalid credentials return HTTP 401. A foreign Origin and `Sec-Fetch-Site: cross-site` return HTTP 403; the configured Origin is accepted. Authenticated GET requests to `/mcp` return HTTP 405 because this endpoint uses POST.
- A second authenticated user cannot read the first user's purchases, evidence, assessments, support lookup context, cases, packets, original documents, extraction suggestions or exported drafts. The owner can download the original file and PDF packet.
- Browser logout invalidates its cookie session. A separately issued MCP token continues to work until its own 24-hour expiry; it is a separate credential.

## Implementation corrections

Added `find_support_contacts` to the MCP server, sharing the same ownership-checked directory service as the website. Its optional brand input is constrained to the available directory identifiers.

Corrected `update_claim`'s `idempotentHint` to `false`: saving an update adds a timeline event, so repeated calls have an additional observable effect. Read-only tools and key-protected draft creation retain the idempotent hint.

Tool results are JSON encoded inside MCP text content. No `outputSchema` is advertised, so the server does not claim structured-output validation. This response form is accepted by the tested SDK.

## What this proves about Alexa+

ClaimMate has a working local MCP service, not merely a mock tool list. An MCP-compatible assistant can use these authenticated tools against the same data as the web app. The test proves that local connection and workflow.

This test does **not** prove an Amazon/Alexa+ account connection, an Echo voice session, public HTTPS reachability, Alexa+ authorization/account linking, Amazon acceptance, or production deployment. No Alexa+ device or remote Alexa+ client was exercised. Those must be demonstrated separately before describing ClaimMate as live on Alexa+.

The app remains in guided mode. Receipt extraction and the verified support directory do not require an OpenAI API key. The support lookup does not crawl arbitrary sites or discover arbitrary companies live. The tools do not send email, place calls, submit claims or determine coverage.
