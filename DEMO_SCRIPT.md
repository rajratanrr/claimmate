# ClaimMate — under-three-minute demo

Use only fictional sample records. Start the server, sign in and add samples through Overview or Settings. Samples are generated relative to UTC today's date (not a frozen real-data clock): headphones bought 120 days ago have expired 30-day returns and a recorded one-year warranty; kettle bought 26 days ago has a return date in four days; backpack has no policy; Mini headphones exercise ambiguity.

0:00–0:20 — “After checkout, receipts and policies disappear into different places. ClaimMate helps us prepare the next step when something fails.” State **simulated Alexa+ experience, guided mode**.

0:20–0:50 — Add a purchase with `fixtures/receipt-photo.png`, or use `fixtures/receipt.txt`. Show real extraction, fields and review notes. Correct/confirm details. Upload `fixtures/policy.txt` or show its exact source card on the seeded headphones. The upload fixtures are explicitly fictional and their dates are printed, not silently assumed current.

0:50–1:15 — Show manufacturer support suggestions for a real recognized brand in a separate fictional test purchase, with source/date. Explain that the seller and manufacturer differ. Fictional Northstar/SoundArc has no real support contact and should show no match.

1:15–1:50 — Open **Alexa+ demo**. Connect → real initialize, initialized notification, tools/list, list_purchases. Select the main SoundArc Headphones. Read documents/assess periods. Prepare “My headphones stopped charging” through MCP. Show successful tools/call and returned case ID.

1:50–2:20 — Open the generated case, add truthful notes, edit the draft and download PDF. Nothing was submitted. Refresh the case URL and show the same ID and saved message.

2:20–2:40 — “The same authenticated MCP service is what an Alexa+ integration could call. This hackathon demo uses our own client because Alexa+ tooling is partner-gated. We have not connected to Amazon or made coverage decisions.”

Optional backup: Assistant text flow → select purchase → draft → export. Voice capture is browser-dependent and should not be the only live-demo route.
