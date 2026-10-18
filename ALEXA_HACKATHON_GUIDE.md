# ClaimMate: Alexa+ hackathon and demo guide

Verified against official Amazon and hackathon sources on **18 October 2026**. Recheck the linked rules before submitting.

## The honest connection to Alexa+

ClaimMate is a purchase-aftercare service designed to supply tools to an assistant: retrieve a purchase, inspect its policy evidence, prepare a support-request draft, and resume the saved case later. **This local app has an MCP server; it is not currently an installed or certified Alexa+ add-on.** The browser's microphone/read-aloud features are browser features, not Amazon Alexa.

Amazon describes Alexa+ as the MCP client that discovers and invokes a service's tools. A registered add-on connects that client to a remote MCP server. In that future arrangement, Alexa+ handles the conversation and ClaimMate supplies the purchase records, evidence, and case operations. [Amazon MCP overview](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-overview)

The connection intended for a real deployment is:

```text
Customer speaks to Alexa+
  → Alexa+ selects a ClaimMate tool
  → linked user's OAuth token accompanies the HTTPS MCP request
  → ClaimMate checks the user and reads/writes their saved records
  → tool result returns to Alexa+
  → Alexa+ explains the next step
```

## What exists in this repository

- `server/mcp.ts` registers real MCP tools using the MCP SDK and stateless Streamable HTTP at `/mcp`.
- Tool examples include `list_purchases`, `get_purchase`, `search_policy_evidence`, `assess_documented_options`, `create_claim_draft`, `get_claim_packet`, and `resume_case`.
- `server/index.ts` protects `/mcp` with the same user authentication used by the web app. `server/auth.ts` accepts local session cookies or issued bearer session tokens. **That is local authentication, not Amazon OAuth account linking.**
- The MCP tools call `server/services.ts`, so the web app and tools use the same purchases and cases. A tool-created draft can be reopened in the app.
- `server/db.ts` uses Node's SQLite database. The default database is `data/claimmate.sqlite`; uploaded files are in `data/uploads/`. `DATA_DIR` and `UPLOAD_DIR` can override these paths. Resolve these paths relative to the project checkout.
- Guided mode runs without an OpenAI key. OCR and guided workflows do not prove a live connection to an LLM or to Amazon.

The current code provides no evidence of an Amazon add-on ID, completed account linking, a remote deployment, or an Alexa device conversation. Show those only after actually completing and verifying them.

## You can submit without gated Amazon access

The official FAQ says the Alexa+ developer CLI, MCP Toolkit, Category SDK and Amazon web simulator remain restricted to selected partners. Hackathon registration does not grant access, and the FAQ currently offers no application route for participants. It accepts a local runnable repository and demo video; public hosting and physical hardware are unnecessary. A browser that sends real MCP `initialize`, `tools/list`, and `tools/call` requests over Streamable HTTP is an accepted demo approach. [Official FAQ](https://amazonappdev2026.devpost.com/details/faqs)

The rules accept a working self-hosted MCP server using specification **2025-11-25 or later** over Streamable HTTP. They also permit a simulated Alexa+ experience. Label a simulation clearly. Use the working MCP implementation as the concrete technical connection, and describe live Alexa+ onboarding as future work. [Official rules](https://amazonappdev2026.devpost.com/rules)

## Suggested demo: 2 minutes 40 seconds

Use fictional purchases and a clear sample receipt. Show the following sequence in one recording:

1. **0:00–0:20 — The problem.** “A product breaks after checkout. Finding the receipt, checking the policy, and assembling a support request takes time. ClaimMate keeps that work together.”
2. **0:20–0:50 — Receipt intake.** Upload the receipt, show extracted suggestions, correct any ambiguous fields, and confirm the purchase. Unknown fields should stay unknown. A receipt does not automatically establish a warranty duration.
3. **0:50–1:15 — Evidence and contact.** Add the policy, inspect the exact source passage, and show the support destination with its official source. Explain that the merchant and manufacturer can have different responsibilities.
4. **1:15–1:50 — Tool workflow.** In a real MCP client, initialize the connection, discover tools, retrieve the purchase, and prepare a draft. Show the actual tool result. Describe the interface as the ClaimMate simulator unless it is genuinely Amazon's simulator.
5. **1:50–2:15 — Review and resume.** Open the created case, review the draft and export the packet. Reload and resume the same case to demonstrate saved state. Nothing is sent simply by creating a draft.
6. **2:15–2:40 — Alexa+ fit.** Explain that the same tools are the service layer an Alexa+ add-on could invoke after onboarding, then state the current integration boundary.

Suggested pitch:

> ClaimMate turns a purchase problem into a prepared next step. It collects purchase evidence, helps the customer review documented options, and prepares a support packet that remains available across sessions. Our demo uses a real authenticated MCP server and a local interface. It is built for the Alexa+ track; live Alexa+ account linking and deployment are future work because the developer tooling is currently partner-gated.

Emphasize the complete, persistent workflow: intake → evidence → support destination → editable draft → resume. Demonstrate the actual behavior rather than promising universal receipt accuracy or guaranteed claim eligibility.

## Submission essentials

The published deadline is **23 October 2026, 12:00 noon PDT**, which is **24 October 2026, 12:30 am IST**. Submit earlier to leave room for uploads. Provide a GitHub repository with source, assets and setup instructions; public repositories need an open-source license, while private repositories must be shared with the specified reviewers. Include a public YouTube/Vimeo demo under three minutes, the project description, selected track, and product feedback. Recheck the current reviewer list on the rules page. [Hackathon overview](https://amazonappdev2026.devpost.com/)

The four judging dimensions are implementation, design, impact and idea quality, with equal weight. The Alexa+ examples favor workflows that retain context across sessions. Optional friction logs can add up to 10%. Keep a short record of actual onboarding/testing problems, what happened, and an actionable improvement; never invent experience with gated tools. [Official rules](https://amazonappdev2026.devpost.com/rules)

## Future live Alexa+ integration: engineering checklist

This section is a roadmap for a developer who receives Amazon partner access, not a completed setup or a requirement to finish the local hackathon demo.

1. **Host the service.** Provide a stable HTTPS MCP endpoint with persistent storage. `localhost` on your laptop is not reachable by Amazon. Configure the canonical URL consistently. Amazon permits a development tunnel and requires Streamable HTTP. A text-only tool experience does not need an MCP Apps UI. Its quickstart also lists a round-trip response target below 500 ms, so run expensive OCR at document intake rather than in a time-critical tool call. [MCP quickstart](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart)
2. **Implement real user account linking.** Use OAuth authorization-code flow with PKCE S256 and refresh tokens. Publish protected-resource and authorization-server metadata, identify supported scopes, validate `resource`, and map authorized users to their ClaimMate owner ID. Register all Alexa callback URIs supplied for the add-on and validate the received callback. Static client registration is required; local session tokens cannot replace this flow. The CLI caches metadata at deployment, so redeploy after auth changes. [MCP account linking](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-account-linking)
3. **Separate discovery from personal data.** If protecting the whole MCP service, implement Amazon's service-level `client_credentials` flow for negotiation and tool discovery. Restrict that token to service operations; it must not read a customer's purchases. Personal tools require the user's linked token. The current app's authentication middleware requires a user before every MCP request, so this needs engineering work. [MCP authentication](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-authentication)
4. **Register and deploy the add-on.** With authorized CLI access, authenticate, scaffold the MCP add-on against the remote URL, configure account linking, fill in store metadata/privacy/terms/assets, and deploy to development. The documented CLI sequence includes `alexa-ai configure`, `alexa-ai new mcp`, and `alexa-ai deploy`. Registering an MCP server locally does not perform this step. [MCP quickstart](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-quickstart)
5. **Prove the integration.** First check tools with an independent MCP client, including invalid input and repeat calls. After add-on deployment, test the whole linked-user journey in Amazon's simulator or a supported device; record real tool traces and confirm the saved draft is the same one displayed in ClaimMate. Publish/certification is a separate later step. [Amazon testing guide](https://developer.amazon.com/docs/alexaplus/add-ons/mcp-toolkit-test-add-ons)

Partner access and supported locale/device availability must be verified for the actual developer account. Documentation examples using `en-US` do not establish availability for an Indian Amazon account. The local hackathon route above avoids depending on that access.
