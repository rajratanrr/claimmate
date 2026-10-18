# Actual development friction

1. The prompt referenced `/workspace/sites/claimmate`, but that checkout was not present on this Mac. The selected folder was empty. Resolution: followed the authorized local React/Express/SQLite path; did not claim prior deployment.
2. Sandboxed npm registry access failed DNS resolution. Retried with approved network access. Dependency resolution completed, but pnpm initially rejected unapproved scripts. Resolution: explicitly allowed esbuild and declined Tesseract's unnecessary postinstall in pnpm-workspace.yaml; installation then passed.
3. pnpm selected different dependency store locations between sandboxed and elevated commands. Its automatic pre-run install attempted to purge modules without a TTY. Resolution: used pnpm for installation and npm run for scripts; no validation or global script protections disabled.
4. tsx IPC sockets and localhost calls needed execution outside the restricted sandbox. Used approved execution for tests/server, preserving isolation of integration-test data.
5. Initial receipt parsing only supported colon-labeled sample fields. A user screenshot showed blank fields and Supporting evidence selected. Resolution: receipt-first intake, explicit document-type labels, broader conservative parsing, durable unconfirmed suggestions and review notes. Real receipt OCR varies; no universal accuracy claim.
6. Alexa+ tooling is partner-gated according to the official hackathon FAQ. We did not personally test gated tools or invent access errors. Resolution: built and tested real MCP tools and a web MCP client; labeled the Amazon experience simulated.
7. User first requested secure API setup, then explicitly chose guided mode. No key was created or connected. All optional AI-dependent work remains honestly disconnected.

8. A corrupted PNG regression exposed Tesseract.js throwing a worker-level error after rejecting its recognition promise. Added the supported error handler so the saved document becomes a recoverable failure. Verified corrupted and blank valid image paths; all 41 tests pass.
