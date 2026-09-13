const fs = require("fs");
const path = require("path");

// Load secrets from environment variables (never hardcode credentials!)
// Copy .env.example to .env and fill in your values before running this script.
require("dotenv").config();

const workerCode = fs.readFileSync(path.join(__dirname, "compact-worker.js"), "utf8");
const base64Worker = Buffer.from(workerCode).toString("base64");

const metadata = {
  main_module: "worker.js",
  compatibility_date: "2024-09-01",
  compatibility_flags: ["nodejs_compat"],
  bindings: [
    { type: "plain_text", name: "TWILIO_ACCOUNT_SID",         text: process.env.TWILIO_ACCOUNT_SID || "" },
    { type: "plain_text", name: "TWILIO_AUTH_TOKEN",           text: process.env.TWILIO_AUTH_TOKEN || "" },
    { type: "plain_text", name: "TWILIO_MESSAGING_SERVICE_SID",text: process.env.TWILIO_MESSAGING_SERVICE_SID || "" },
    { type: "plain_text", name: "TWILIO_FROM_NUMBER",          text: process.env.TWILIO_FROM_NUMBER || "" },
    { type: "plain_text", name: "AWS_ACCESS_KEY_ID",           text: process.env.AWS_ACCESS_KEY_ID || "" },
    { type: "plain_text", name: "AWS_SECRET_ACCESS_KEY",       text: process.env.AWS_SECRET_ACCESS_KEY || "" },
    { type: "plain_text", name: "AWS_REGION",                  text: process.env.AWS_REGION || "ap-south-1" },
    { type: "plain_text", name: "SES_FROM_EMAIL",              text: process.env.SES_FROM_EMAIL || "" },
    { type: "plain_text", name: "GOOGLE_CLIENT_ID",            text: process.env.GOOGLE_CLIENT_ID || "" },
    { type: "plain_text", name: "ADMIN_EMAILS",                text: process.env.ADMIN_EMAILS || "" },
    { type: "plain_text", name: "JWT_SECRET",                  text: process.env.JWT_SECRET || "" }
  ]
};

const scriptName = "sms-outreach-app";

const executeCode = `async () => {
  const code = atob(${JSON.stringify(base64Worker)});
  const metadata = ${JSON.stringify(metadata)};
  
  const b = "----WebKitFormBoundary" + Date.now();
  const body = [
    "--" + b,
    'Content-Disposition: form-data; name="metadata"',
    'Content-Type: application/json',
    '',
    JSON.stringify(metadata),
    "--" + b,
    'Content-Disposition: form-data; name="worker.js"; filename="worker.js"',
    'Content-Type: application/javascript+module',
    '',
    code,
    "--" + b + "--"
  ].join("\\r\\n");

  return cloudflare.request({
    method: "PUT",
    path: "/accounts/" + accountId + "/workers/scripts/${scriptName}",
    body,
    contentType: "multipart/form-data; boundary=" + b,
    rawBody: true
  });
}`;

fs.writeFileSync(path.join(__dirname, "mcp-execute-upload.js"), executeCode, "utf8");
console.log("Written base64-safe mcp-execute-upload.js! Total length:", executeCode.length);
