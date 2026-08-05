# Workspace AI Chat Assistant

All AI-specific code lives under the top-level **`ai/`** folder. Secrets stay in the project-root **`.env`** (not inside `ai/`). Shared logistics data services remain in `services/data/`.

```text
ai/
  index.js              # Express entry (router + TTL cleanup + demo path)
  core/                 # Gemini, tools, parser, orchestrator
  history/              # MySQL chat history + SQL schema
  controllers/ routes/ jobs/
  docs/ demo/           # This doc + HTML test UI
```

Secure AI assistant that answers natural-language questions using live MySQL data.

## Setup

Add to your `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-flash-latest
```

Get an API key from [Google AI Studio](https://aistudio.google.com/). Classic keys usually start with `AIza...` (paid `AQ...` keys also work).

```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-flash-latest
# Optional: tried in order when primary fails / hits quota
GEMINI_FALLBACK_MODELS=gemini-3.6-flash,gemini-3.1-flash-lite,gemini-flash-lite-latest
# Chat history inactivity TTL (minutes). Each message extends expiry.
# 60 = 1 hour (recommended for general AI assistant)
AI_CHAT_HISTORY_TTL_MINUTES=60
```

Note: some paid keys **list** `gemini-2.0-flash` / `gemini-2.5-flash` but return **404** on `generateContent`. Prefer `gemini-flash-latest` or Gemini 3.x model IDs.

If you see **429 Too Many Requests / quota exceeded**, free-tier limits are used up. The app will:
1. Try fallback models
2. Cool down Gemini briefly
3. Answer with **rules** until quota resets

Options: wait for reset, enable billing in Google AI Studio, or switch `GEMINI_MODEL` to another available model.

## API Endpoints

### `GET /api/ai-chat/status`

Returns whether Gemini is configured and which tools are available.

### `POST /api/ai-chat/message`

```json
{
  "user_id": 1,
  "message": "What is the status of freight FRT123?",
  "session_id": "optional-session-id"
}
```

**Response:**

```json
{
  "success": true,
  "reply": "Formatted markdown answer...",
  "data": { "freight": {}, "orders": [], "invoices": [] },
  "sessionId": "user-1",
  "provider": "gemini"
}
```

Optional: pass `user_id` in the body (required for chat). No JWT / auth header.

### `GET /api/ai-chat/history?user_id=1&session_id=`

Returns saved messages for the given session (or the user's latest **non-expired** session). Refresh restores the conversation while the session is still within the inactivity TTL.

### `POST /api/ai-chat/new-session`

```json
{ "user_id": 1 }
```

Starts a fresh chat id (ChatGPT-style **New chat**).

## Chat history (Option 2 — inactivity TTL)

Best fit for most AI chatbots:

1. Messages are saved with a `sessionId`
2. Each session has an `expires_at` (TTL)
3. **Every new message extends** `expires_at` by `AI_CHAT_HISTORY_TTL_MINUTES` (default **60 minutes / 1 hour**)
4. Refresh keeps the chat if the user is still within that window
5. After inactivity, a cron (every 15 min) deletes expired sessions + messages so the DB stays clean

Typical TTLs: 30 min (live support), **1 hour (general AI — recommended)**, 24 hours (same-day return).

Tables are auto-created on first use (including `expires_at`), or run `ai/history/create-ai-chat-history.sql`.

## Test UI

Open in browser after starting the server (served from `ai/demo/ai-chat.html`):

```
http://localhost:8080/ai-chat.html
```

React can call the same `/api/ai-chat/*` endpoints later; this HTML page is only a local demo.

**React implementation guide:** [`REACT_AI_CHAT.md`](./REACT_AI_CHAT.md) (API + hook + widget + how to reuse the HTML demo).

## Supported questions

Examples users often ask:

- **Freight by number / Order Freight Detail:** status, shipper/consignee, addresses, cargo (weight/CBM/packages), POL/POD, incoterms, warehouse, estimate/charges, product, paid, client, route, supplier, sales rep — e.g. “Freight F-20260722005”, “Shipper of F-…”, “Weight of F-…”
- **Follow-ups:** “this freight”, “above freight”, “product desc?” (remembers last freight in the session)
- **List freights:** “Show all freights of user John”, “Freights for John”, “Show my freights”
- **Count:** “Count total freight”, “How many freights?”, “Count total orders”, “Count warehouse orders”, “Count batches”, “Count shipments”, “Count clearances”
- **Orders:** “What is OR000253?”, “Show orders for John”, “Orders of freight F-20260602006”, “Show my orders”
- **Warehouse orders:** “Warehouse orders for Shawn”, “Warehouse of OR0001296”, “Warehouse status of F-20260713006”, “Warehouse of batch ADSWB2607011”, “Warehouse order #42”
- **Batches:** “Status of batch ADAWB2405032”, “Show batches for John”, “Count batches”
- **Shipments:** “Shipment waybill DL26S0000776”, “Vessel of DL26S…”, “ETA of …”, “Shipments of freight F-…”, “Shipments for John”, “Count shipments”
- **Clearance:** “Status of C-202607001”, “Clearance details C-…”, “Product description of C-…”, “Port of loading of C-…”, “Clearances for John”
- **Clearance orders / Order Clearance:** “Clearance order C-202607081”, “Order clearance for Dominic”, “Find clearance order Multimeter”, “Show clearance orders”, “Count clearance orders”
- **Invoices:** by client name or Client ID (with disambiguation), or “my invoices” for customers
- **Clients / Customer Profile:** “Find client central agriculture”, “Customer CE21170”, “Client profile for central.agriculture1@gmail.com”, “Contact person of customer CE21170”, “Related freights for CE21170”, “Count clients”
- **Sage invoices:** “Sage invoice ADZWINV000637”, “Find sage invoice Quantrix”, “Sage invoices for Cash Client”, “Total of ADZWINV000637”, “Customer ref of ADZWINV000637”, “Show sage invoices”, “Count sage invoices”
- **Customer Query / Dispute:** “Dispute D-202638”, “Disputes for Vusani”, “Pending disputes”, “Outcome of D-202635”, “Disputes of F-20260522011”, “Count disputes”
- **Release Dashboard:** “Release dashboard OR000893”, “Open releases”, “Release dashboard for HC Water”, “Payment of release OR000893”, “Delivery of OR000868”, “Count release dashboard”
- **Quotation / Quote:** “Quote ADQO10284”, “Freight number of ADQO10300”, “Quotes for Barry”, “Unpaid quotes”, “Quote of F-…”, “Count quotes” (searches `freight_quote_estimate` and `estimate_shipping_quote`)
- **Freight Invoice:** “Freight invoice ADINV10002”, “Freight invoices for Neha”, “Unpaid freight invoices”, “Freight invoice of F-20260526016”, “Total of ADINV10002”, “Count freight invoices”
- **Cashbook:** “Cashbook 20260729001”, “Cashbook for Wahied”, “Allocated cashbook”, “Cashbook of OR0001283”, “Receipt of 20260729001”, “Show cashbook”, “Count cashbook”
- **Supplier Invoice:** “Supplier invoice SUPINV10015”, “Supplier invoices for Nimbus”, “Unpaid supplier invoices”, “Waybill of SUPINV10015”, “Show supplier invoices”, “Count supplier invoices”
- **Collection and Delivery:** “Collection of F-20260723003”, “Collection details OR0001283”, “Collections for Wahied”, “Pending collections”, “Show collection and delivery”, “Status of collection F-20260727009”, “Count collections”
- **Task Manager:** “Freight tasks”, “Clearance tasks”, “Custom tasks”, “Pending tasks”, “Tasks for Santosh”, “Task manager F-20260721004”, “Count tasks”
- **Contact Us Enquiries:** “Contact us enquiries”, “Enquiry ttttt2@gmail.com”, “Nature of enquiry Sales”, “Contact us South Africa”, “Count contact enquiries”
- **Country of Origin:** “Country of origin Austria”, “Cities of Austria origin”, “Sea ports of Zimbabwe”, “Show country of origin”, “Count countries of origin”
- **Custom Agent / Freight Forwarder / Groupage Warehouse / Transporter:** “Custom agents”, “Custom agent Brett Lee”, “Freight forwarders”, “Groupage warehouses”, “Transporters”, “Transporter Micky”, “Count transporters”
- **Company Addresses:** “Company addresses”, “Company address South Africa”, “Company address Asia Direct”, “Telephone of company address Zambia”, “Count company addresses”
- **Supplier / Edit Supplier:** “Supplier SANBRO”, “Edit supplier Asher”, “Do we have supplier SANBRO?”, “Email of supplier 32”, “Type of service of supplier SANBRO”, “Count suppliers”
- **Staff / Edit Staff:** “Edit staff support.imports1@asiadirect.africa”, “Staff Tshegofatso”, “Roles of staff Tshegofatso”, “Select country data of staff Tshegofatso”, “Count staff” (email, name, country code, phone, country, roles, country data; password never shown)
- **Client KPI:** “Show client KPI”, “Client KPI for TGOOD”, “Total amount of client KPI for VSD”, “Delivered orders of client KPI for Connect Pro”, “Count client KPI”

## Permissions

- **Admin / full-access users**: all data
- **Staff**: filtered by `access_country` and freight ownership (`user_id` / `sales_representative`)
- **Customers**: only their own freight, orders, warehouse, shipments, clearances, invoices, and profile
- **Invoices**: restricted to admin, full-access, accounts roles (5, 8), or customers (own data)

## Architecture

```
POST /api/ai-chat/message
  → chatOrchestrator
  → Gemini AI first (tool calling → MySQL)
  → rule-based fallback if AI unavailable / errors / weak reply
  → tools (freight, order, warehouse, batch, shipment, clearance, invoices, supplier, …)
  → permission checks
  → MySQL
```
