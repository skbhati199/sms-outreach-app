const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { parse } = require("csv-parse/sync");
const twilio = require("twilio");
const nodemailer = require("nodemailer");

const PORT = process.env.PORT || 4000;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_API_ACCOUNT_SID = process.env.TWILIO_API_ACCOUNT_SID;
const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID ||
  (TWILIO_ACCOUNT_SID && TWILIO_ACCOUNT_SID.startsWith("SK") ? TWILIO_ACCOUNT_SID : null);
const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET ||
  (TWILIO_API_KEY_SID ? TWILIO_AUTH_TOKEN : null);
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const SMTP_ENDPOINT = process.env.SMTP_ENDPOINT;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USERNAME = process.env.SMTP_USERNAME;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USERNAME;
const SQLITE_DB_PATH = path.resolve(
  process.env.SQLITE_DB_PATH || path.join(__dirname, "data", "sms-app.sqlite")
);

const app = express();

// Allow requests from both the local dev server and the public Cloudflare Tunnel URLs
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:4000",
  process.env.PUBLIC_CLIENT_URL,
  process.env.PUBLIC_API_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, same-origin) and allowed origins
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

fs.mkdirSync(path.dirname(SQLITE_DB_PATH), { recursive: true });
const database = new DatabaseSync(SQLITE_DB_PATH);
database.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    sms_body TEXT,
    email_body TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS email_sends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL,
    message_id TEXT,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES contacts(id)
  );
`);

// Store uploaded file in memory (simple, no disk writes needed)
const upload = multer({ storage: multer.memoryStorage() });

const emailTransporter =
  SMTP_ENDPOINT && SMTP_USERNAME && SMTP_PASSWORD
    ? nodemailer.createTransport({
        host: SMTP_ENDPOINT,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USERNAME, pass: SMTP_PASSWORD },
      })
    : null;

function normalizeIndianMobile(value) {
  const phone = String(value || "").trim();
  const compactPhone = phone.replace(/[\s()-]/g, "");
  const mobile = compactPhone.match(/^(?:\+91)?([6-9]\d{9})$/);

  return mobile ? `+91${mobile[1]}` : null;
}

let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_ACCOUNT_SID.startsWith("AC") && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
} else if (TWILIO_API_KEY_SID && TWILIO_API_KEY_SECRET && TWILIO_API_ACCOUNT_SID) {
  twilioClient = twilio(TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, {
    accountSid: TWILIO_API_ACCOUNT_SID,
  });
}

/**
 * POST /api/upload-csv
 * Accepts a CSV file with columns: name,phone  (phone in E.164 format e.g. +919876543210)
 * Returns the parsed rows so the frontend can preview them before sending.
 */
app.post("/api/upload-csv", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const records = parse(req.file.buffer, {
      columns: false,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });

    const [headers, ...rows] = records;
    const normalizedHeaders = headers.map((header) => header.trim().toLowerCase());

    // Accept full business exports and compact rows containing company, phone,
    // (optional email), SMS body, and email body in the same uploaded file.
    const parsedContacts = rows
      .map((row) => {
        const isCompactMessageRow =
          (row.length === 4 || row.length === 5) && normalizeIndianMobile(row[1]);
        const normalizedRow = isCompactMessageRow
          ? {
              company: row[0],
              phone: row[1],
              email: row.length === 5 ? row[2] : "",
              "sms body": row.length === 5 ? row[3] : row[2],
              "email body (html)": row.length === 5 ? row[4] : row[3],
            }
          : Object.fromEntries(
              normalizedHeaders.map((header, index) => [header, row[index] || ""])
            );

        return {
          name: normalizedRow.name || normalizedRow.company || "",
          phone: normalizedRow.phone || normalizedRow.mobile || normalizedRow["phone number"] || "",
          email: normalizedRow.email || "",
          smsBody: normalizedRow["sms body (140 char)"] || normalizedRow["sms body"] || "",
          emailBody: normalizedRow["email body (html)"] || normalizedRow["email body"] || "",
        };
      })
      .filter((contact) => contact.phone);

    const contacts = parsedContacts
      .map((contact) => ({
        name: contact.name,
        phone: normalizeIndianMobile(contact.phone),
        email: contact.email,
        smsBody: contact.smsBody,
        emailBody: contact.emailBody,
      }))
      .filter((contact) => contact.phone);

    const insertContact = database.prepare(
      "INSERT INTO contacts (name, phone, email, sms_body, email_body) VALUES (?, ?, ?, ?, ?)"
    );
    const contactsWithIds = contacts.map((contact) => ({
      ...contact,
      id: Number(insertContact.run(
        contact.name,
        contact.phone,
        contact.email,
        contact.smsBody,
        contact.emailBody
      ).lastInsertRowid),
    }));

    res.json({
      contacts: contactsWithIds,
      rejected: parsedContacts.length - contacts.length,
    });
  } catch (err) {
    res.status(400).json({ error: "Could not parse CSV: " + err.message });
  }
});

app.post("/api/send-email", async (req, res) => {
  if (!emailTransporter) {
    return res.status(500).json({
      error: "SES SMTP is not configured. Set SMTP_ENDPOINT, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_FROM_EMAIL in server/.env",
    });
  }

  const { contacts, subject, emailBody } = req.body;
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: "No contacts provided" });
  }
  if (!subject || !subject.trim()) {
    return res.status(400).json({ error: "Email subject is empty" });
  }
  if (!emailBody || !emailBody.trim()) {
    return res.status(400).json({ error: "Email body is empty" });
  }

  const insertSend = database.prepare(
    "INSERT INTO email_sends (contact_id, recipient, subject, status, message_id, error) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const results = [];

  for (const contact of contacts) {
    const recipients = String(contact.email || "")
      .split(/[;,]/)
      .map((email) => email.trim())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    if (recipients.length === 0) {
      results.push({
        name: contact.name,
        email: contact.email || "(none)",
        status: "failed",
        error: "Recipient email is missing or invalid in contact data",
      });
      continue;
    }

    for (const recipient of recipients) {
      const body = (contact.emailBody || emailBody).replace(/{{name}}/g, contact.name || "there");
      try {
        const sent = await emailTransporter.sendMail({
          from: SMTP_FROM_EMAIL,
          to: recipient,
          subject,
          html: body,
        });
        insertSend.run(contact.id || null, recipient, subject, "sent", sent.messageId, null);
        results.push({ name: contact.name, email: recipient, status: "sent", id: sent.messageId });
      } catch (err) {
        insertSend.run(contact.id || null, recipient, subject, "failed", null, err.message);
        results.push({ name: contact.name, email: recipient, status: "failed", error: err.message });
      }
    }
  }

  res.json({ results });
});

/**
 * POST /api/send-sms
 * Body: { contacts: [{ name, phone }], message: "..." }
 * Uses each contact's imported smsBody when available. {{name}} is replaced per-contact.
 */
app.post("/api/send-sms", async (req, res) => {
  if (!twilioClient) {
    return res.status(500).json({
      error: "Twilio is not configured. Use an AC... Account SID with TWILIO_AUTH_TOKEN, or set TWILIO_API_ACCOUNT_SID for the SK... API key in server/.env",
    });
  }
  if (!TWILIO_FROM_NUMBER && !TWILIO_MESSAGING_SERVICE_SID) {
    return res.status(500).json({
      error: "Twilio sender is not configured. Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID in server/.env",
    });
  }

  const { contacts, message } = req.body;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ error: "No contacts provided" });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message body is empty" });
  }

  const results = [];

  for (const contact of contacts) {
    const phone = normalizeIndianMobile(contact.phone);
    if (!phone) {
      results.push({
        phone: contact.phone,
        name: contact.name,
        status: "failed",
        error: "Only valid Indian mobile numbers are accepted. Use 10 digits starting with 6-9 or +91 followed by those 10 digits.",
      });
      continue;
    }

    const contactMessage = contact.smsBody?.trim() || message;
    const personalizedMessage = contactMessage.replace(/{{name}}/g, contact.name || "there");
    try {
      const sent = await twilioClient.messages.create({
        to: phone,
        ...(TWILIO_MESSAGING_SERVICE_SID
          ? { messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID }
          : { from: TWILIO_FROM_NUMBER }),
        body: personalizedMessage,
      });
      results.push({
        phone,
        name: contact.name,
        status: "sent",
        sid: sent.sid,
      });
    } catch (err) {
      results.push({
        phone: contact.phone,
        name: contact.name,
        status: "failed",
        error: err.message,
      });
    }
  }

  res.json({ results });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    twilioConfigured: !!twilioClient,
    emailConfigured: !!emailTransporter,
    fromEmail: SMTP_FROM_EMAIL,
  });
});

// Serve the Vite production build when it exists
const clientDistPath = path.resolve(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  // SPA fallback – let React Router handle unknown paths
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });
  console.log(`Serving static client build from: ${clientDistPath}`);
}

app.listen(PORT, () => {
  console.log(`SMS app server running on http://localhost:${PORT}`);
  if (process.env.PUBLIC_CLIENT_URL) {
    console.log(`Public URL: ${process.env.PUBLIC_CLIENT_URL}`);
  }
});
