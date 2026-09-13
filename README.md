# CSV SMS Sender — Simple Sample App

A minimal React + Node.js app: upload a CSV of contacts, preview them, write a message, and send SMS to everyone via Twilio. Intentionally kept simple — one backend file, one frontend component, no database, no auth.

```
sms-app/
├── sample-contacts.csv     # example CSV to test with
├── server/                 # Node.js + Express backend
│   ├── server.js
│   ├── package.json
│   └── .env.example
└── client/                 # React (Vite) frontend
    ├── src/App.jsx
    ├── src/main.jsx
    ├── src/style.css
    └── package.json
```

## CSV format

```csv
name,phone
Rahul Sharma,+919876543210
Priya Verma,+919812345678
```

`phone` must be an Indian mobile number: either 10 digits beginning with `6-9` (automatically converted to `+91...`) or an existing `+91` number. Landlines, other country codes, and malformed numbers are rejected. The uploader also accepts case-insensitive `Phone` headers and uses `Company` as the contact name when `name` is not present.

## 1. Backend setup

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:

```env
PORT=4000
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
# For an API Key, use the SK... key SID and its parent AC... Account SID:
# TWILIO_API_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_API_KEY_SID=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# TWILIO_API_KEY_SECRET=your_api_key_secret
TWILIO_FROM_NUMBER=+15017122661
# Or use a Twilio Messaging Service instead of TWILIO_FROM_NUMBER.
# TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The server loads `server/.env` based on its own location, so it can be started from the repository root or from the `server` directory. Configure either a sender number or a Messaging Service SID, not neither. API Key credentials also require the parent Account SID.

## Email / AWS SES SMTP

The Email page uses AWS SES SMTP through `SMTP_ENDPOINT`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `SMTP_FROM_EMAIL`. The sender address must be verified in SES, and SES sandbox accounts can only send to verified recipients. Email contacts and send results are stored in SQLite at `server/data/sms-app.sqlite` by default. Set `SQLITE_DB_PATH` to an absolute SSD path for a different location.

Run it:

```bash
npm start
```

Backend runs on `http://localhost:4000`.

## 2. Frontend setup

```bash
cd client
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api/*` calls to the backend (see `vite.config.js`).

Open `http://localhost:5173` in your browser.

## 3. Using the app

1. **Upload CSV** — choose `sample-contacts.csv` (or your own file with `name,phone` or `Company,Phone` columns).
2. **Preview Contacts** — table shows what was parsed.
3. **Compose Message** — write your SMS text. Use `{{name}}` anywhere to auto-insert each contact's name.
4. Click **Send SMS** — the backend loops through contacts and sends each one via Twilio, then shows a results table (sent / failed with reason).

## How it works

- `POST /api/upload-csv` — accepts a multipart file upload, parses it in-memory with `csv-parse`, and returns `{ contacts: [{name, phone, smsBody, emailBody}] }`. The optional `SMS Body (140 char)` and `Email Body (HTML)` columns populate the React form.
- `POST /api/send-sms` — accepts `{ contacts, message }`, loops through contacts, calls `twilioClient.messages.create()` for each, returns per-contact results.

No database, no queues, no MCP layer here — this is a plain, direct Twilio integration for anyone who just wants a working CSV → SMS tool without extra moving parts. (If you want this routed through the OAuth-protected `twilio-mcp-server` instead, swap the `twilioClient.messages.create()` call in `server.js` for a call to that MCP server's `twilio_send_sms` tool.)

## Notes

- Twilio trial accounts can only send to **verified** numbers (Console → Phone Numbers → Verified Caller IDs).
- For large contact lists, add a short delay between sends to respect Twilio rate limits (not included here to keep the sample simple).
