const fs = require("fs");
const path = require("path");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>InfoSkills Outreach - SMS & Email Platform</title>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #0f172a; color: #f1f5f9; min-height: 100vh; line-height: 1.5; }
    .container { max-width: 900px; margin: 0 auto; padding: 32px 20px 80px; }
    .auth-container { min-height: 85vh; display: flex; align-items: center; justify-content: center; }
    .auth-card { text-align: center; padding: 48px 36px; max-width: 440px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 16px; box-shadow: 0 20px 35px -10px rgba(0,0,0,0.5); }
    .brand-badge { display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #38bdf8; background: rgba(56,189,248,0.12); border: 1px solid rgba(56,189,248,0.25); border-radius: 9999px; margin-bottom: 16px; }
    .google-btn-wrapper { display: flex; justify-content: center; margin: 28px 0; min-height: 44px; }
    .auth-hint { font-size: 13px; color: #94a3b8; margin-top: 24px; }
    .auth-hint code { color: #38bdf8; background: #0f172a; padding: 2px 6px; border-radius: 4px; }
    .app-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
    .user-profile { display: flex; align-items: center; gap: 12px; background: #1e293b; padding: 6px 14px; border-radius: 30px; border: 1px solid #334155; }
    .avatar { width: 34px; height: 34px; border-radius: 50%; border: 2px solid #38bdf8; }
    .user-info { display: flex; flex-direction: column; line-height: 1.2; text-align: left; }
    .user-name { font-size: 13px; font-weight: 600; color: #f1f5f9; }
    .user-email { font-size: 11px; color: #94a3b8; }
    .logout-btn { padding: 5px 12px; background: transparent; color: #ef4444; border: 1px solid rgba(239,68,68,0.3); border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.2s ease; }
    .logout-btn:hover { background: rgba(239,68,68,0.15); border-color: #ef4444; }
    h1 { margin: 0 0 6px; font-size: 26px; font-weight: 700; color: #f8fafc; }
    .subtitle { color: #94a3b8; margin: 0; font-size: 14px; }
    .tabs { display: flex; gap: 10px; margin: 20px 0; }
    .tabs button { padding: 10px 20px; font-size: 14px; font-weight: 600; border-radius: 8px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s ease; }
    .tabs .active { background: #2563eb; color: #fff; box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
    .tabs .secondary { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
    .tabs .secondary:hover { background: #334155; color: #f1f5f9; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2); }
    .card h2 { margin-bottom: 12px; font-size: 17px; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    .muted { color: #94a3b8; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
    th, td { text-align: left; padding: 10px; border-bottom: 1px solid #334155; vertical-align: top; }
    th { color: #94a3b8; font-weight: 600; }
    .message-details summary { color: #38bdf8; cursor: pointer; font-weight: 600; }
    .sms-preview { min-width: 220px; max-width: 360px; margin: 8px 0 0; white-space: normal; overflow-wrap: anywhere; background: #0f172a; padding: 8px; border-radius: 6px; border: 1px solid #334155; color: #cbd5e1; }
    .email-preview { display: block; width: min(440px, 70vw); height: 240px; margin-top: 8px; border: 1px solid #334155; border-radius: 6px; background: #fff; }
    textarea { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #334155; background: #0f172a; color: #f8fafc; font-family: inherit; font-size: 14px; resize: vertical; }
    textarea:focus, input:focus { outline: none; border-color: #38bdf8; box-shadow: 0 0 0 2px rgba(56,189,248,0.2); }
    label { display: block; margin: 14px 0 6px; font-size: 13px; font-weight: 600; color: #cbd5e1; }
    input:not([type="file"]) { width: 100%; padding: 11px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #f8fafc; font: inherit; }
    input[type="file"] { background: #0f172a; padding: 10px; border-radius: 8px; border: 1px dashed #475569; width: 100%; color: #94a3b8; }
    button.btn-primary { margin-top: 16px; background: #2563eb; color: #fff; border: none; padding: 11px 22px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
    button.btn-primary:hover:not(:disabled) { background: #1d4ed8; box-shadow: 0 4px 12px rgba(37,99,235,0.4); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .error { color: #f87171; background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); padding: 10px 14px; border-radius: 8px; font-size: 13px; margin: 12px 0; }
    .ok { color: #4ade80; font-weight: 600; margin-top: 8px; }
    .fail { color: #f87171; font-weight: 600; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>
</head>
<body>
  <div id="app"></div>
  <script>
    const GOOGLE_CLIENT_ID = "267028123948-8omvgmkdnm9k77ntoidj5pvf8ua3aouc.apps.googleusercontent.com";
    let token = localStorage.getItem("outreach_token") || "";
    let user = null;
    try { user = JSON.parse(localStorage.getItem("outreach_user") || "null"); } catch(e) {}
    let activeTab = "sms";
    let contacts = [];
    let rejectedCount = 0;
    let smsTemplate = "Hi {{name}}, this is a message from our team!";
    let emailSubject = "A digital solution for your business";
    let emailBodyTemplate = "";
    let statusMsg = "";
    let errorMsg = "";
    let smsResults = [];
    let emailResults = [];

    function normalizePhone(v) {
      const p = String(v || "").trim().replace(/[\\s()-]/g, "");
      const m = p.match(/^(?:\\+91)?([6-9]\\d{9})$/);
      return m ? "+91" + m[1] : null;
    }

    async function checkAuth() {
      if (!token) return render();
      try {
        const res = await fetch("/api/auth/me", { headers: { Authorization: "Bearer " + token } });
        if (res.ok) {
          const data = await res.json();
          user = data.user;
          localStorage.setItem("outreach_user", JSON.stringify(user));
        } else {
          logout();
        }
      } catch(e) { logout(); }
      render();
    }

    function logout() {
      token = "";
      user = null;
      localStorage.removeItem("outreach_token");
      localStorage.removeItem("outreach_user");
      render();
    }

    async function handleGoogleLogin(cred) {
      errorMsg = "";
      try {
        const res = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ credential: cred })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Google auth failed");
        token = data.token;
        user = data.user;
        localStorage.setItem("outreach_token", token);
        localStorage.setItem("outreach_user", JSON.stringify(user));
      } catch (err) {
        errorMsg = err.message;
      }
      render();
    }

    async function parseCSV(file) {
      if (!file) return;
      errorMsg = "";
      statusMsg = "Parsing CSV...";
      render();
      try {
        const text = await file.text();
        const lines = text.split(/\\r?\\n/).map(l => l.trim()).filter(Boolean);
        if (!lines.length) throw new Error("CSV file is empty");
        const list = [];
        let rej = 0;
        for (let i = 1; i < lines.length; i++) {
          const p = lines[i].split(",").map(s => s.replace(/^"|"$/g, "").trim());
          const name = p[0] || "";
          const phone = normalizePhone(p[1] || "");
          const email = p.length >= 5 ? p[2] : "";
          const sBody = p.length >= 5 ? p[3] : p[2] || "";
          const eBody = p.length >= 5 ? p[4] : p[3] || "";
          if (phone) {
            list.push({ id: i, name, phone, email, smsBody: sBody, emailBody: eBody });
          } else { rej++; }
        }
        contacts = list;
        rejectedCount = rej;
        if (list[0]?.smsBody) smsTemplate = list[0].smsBody;
        if (list[0]?.emailBody) emailBodyTemplate = list[0].emailBody;
        statusMsg = "";
      } catch(e) {
        errorMsg = e.message;
        statusMsg = "";
      }
      render();
    }

    async function sendSms() {
      errorMsg = "";
      statusMsg = "Sending SMS via Twilio...";
      smsResults = [];
      render();
      try {
        const res = await fetch("/api/send-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ contacts, message: smsTemplate })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "SMS dispatch failed");
        smsResults = data.results || [];
      } catch(e) { errorMsg = e.message; }
      statusMsg = "";
      render();
    }

    async function sendEmail() {
      errorMsg = "";
      statusMsg = "Sending Email via AWS SES...";
      emailResults = [];
      render();
      try {
        const res = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ contacts, subject: emailSubject, emailBody: emailBodyTemplate })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Email dispatch failed");
        emailResults = data.results || [];
      } catch(e) { errorMsg = e.message; }
      statusMsg = "";
      render();
    }

    function render() {
      const app = document.getElementById("app");
      if (!user) {
        app.innerHTML = \`
          <div class="container auth-container">
            <div class="card auth-card">
              <div class="brand-badge">INFOSKILLS OUTREACH</div>
              <h1>Admin Sign In</h1>
              <p class="subtitle">Secure multi-channel outreach engine powered by AWS SES & Twilio.</p>
              \${errorMsg ? \`<p class="error">\${errorMsg}</p>\` : ""}
              <div class="google-btn-wrapper"><div id="google-btn"></div></div>
              <p class="auth-hint">Access is restricted to authorized administrators (<code>skbhati199@gmail.com</code>).</p>
            </div>
          </div>
        \`;
        setTimeout(() => {
          if (window.google && window.google.accounts) {
            window.google.accounts.id.initialize({
              client_id: GOOGLE_CLIENT_ID,
              callback: (res) => handleGoogleLogin(res.credential),
              auto_select: false
            });
            const btn = document.getElementById("google-btn");
            if (btn) window.google.accounts.id.renderButton(btn, { theme: "filled_blue", size: "large", shape: "rectangular", text: "signin_with", width: 280 });
          }
        }, 100);
        return;
      }

      app.innerHTML = \`
        <div class="container">
          <header class="app-header">
            <div>
              <h1>InfoSkills Outreach</h1>
              <p class="subtitle">SMS & Email Marketing Campaign Engine</p>
            </div>
            <div class="user-profile">
              \${user.picture ? \`<img src="\${user.picture}" class="avatar" alt="\${user.name}"/>\` : ""}
              <div class="user-info">
                <span class="user-name">\${user.name}</span>
                <span class="user-email">\${user.email}</span>
              </div>
              <button class="logout-btn" onclick="logout()">Sign Out</button>
            </div>
          </header>

          <nav class="tabs">
            <button class="\${activeTab === 'sms' ? 'active' : 'secondary'}" onclick="setTab('sms')">📱 SMS Campaign</button>
            <button class="\${activeTab === 'email' ? 'active' : 'secondary'}" onclick="setTab('email')">✉️ Email Campaign</button>
          </nav>

          <section class="card">
            <h2>1. Upload Contacts (CSV)</h2>
            <input type="file" accept=".csv" onchange="parseCSV(this.files[0])" />
            \${statusMsg === "Parsing CSV..." ? '<p class="muted">Parsing contacts...</p>' : ""}
            \${contacts.length ? \`<p class="ok">\${contacts.length} contact(s) ready for outreach.</p>\` : ""}
            \${rejectedCount > 0 ? \`<p class="error">\${rejectedCount} row(s) excluded (only valid 10-digit Indian numbers accepted).</p>\` : ""}
          </section>

          \${contacts.length ? \`
            <section class="card">
              <h2>2. Preview Contacts</h2>
              <p class="muted">Review imported contacts before triggering dispatch.</p>
              <table>
                <thead><tr><th>Name</th><th>Phone</th><th>SMS Preview</th><th>Email Preview</th></tr></thead>
                <tbody>
                  \${contacts.map(c => \`
                    <tr>
                      <td><strong>\${c.name || "(No name)"}</strong></td>
                      <td><code>\${c.phone}</code></td>
                      <td>
                        <details class="message-details">
                          <summary>\${c.smsBody ? "View SMS" : "Fallback"}</summary>
                          <p class="sms-preview">\${c.smsBody || smsTemplate}</p>
                        </details>
                      </td>
                      <td>
                        <details class="message-details">
                          <summary>\${c.email ? (c.emailBody ? "HTML Preview" : c.email) : "No Email"}</summary>
                          \${c.emailBody ? \`<iframe class="email-preview" srcdoc="\${encodeURI(c.emailBody).replace(/"/g, '&quot;')}" sandbox=""></iframe>\` : \`<p class="muted">\${c.email || "No email"}</p>\`}
                        </details>
                      </td>
                    </tr>
                  \`).join("")}
                </tbody>
              </table>
            </section>
          \` : ""}

          \${activeTab === "sms" && contacts.length ? \`
            <section class="card">
              <h2>3. Compose & Send SMS</h2>
              <p class="muted">Personalize using <code>{{name}}</code>. Dispatched via Twilio Messaging Service.</p>
              <label for="sms-template">Default Message Template</label>
              <textarea id="sms-template" rows="4" oninput="smsTemplate = this.value">\${smsTemplate}</textarea>
              <button class="btn-primary" onclick="sendSms()" \${statusMsg ? "disabled" : ""}>\${statusMsg === "Sending SMS via Twilio..." ? "Sending via Twilio..." : \`Send SMS to \${contacts.length} Contact(s)\`}</button>
            </section>
          \` : ""}

          \${activeTab === "email" && contacts.length ? \`
            <section class="card">
              <h2>3. Compose & Send Email</h2>
              <p class="muted">Sent via <strong>contact@update.infoskillstechnology.com</strong> (AWS SES verified with DKIM).</p>
              <label for="email-subject">Subject Line</label>
              <input id="email-subject" value="\${emailSubject}" oninput="emailSubject = this.value" />
              <label for="email-body">Default HTML Body</label>
              <textarea id="email-body" rows="12" oninput="emailBodyTemplate = this.value">\${emailBodyTemplate}</textarea>
              <button class="btn-primary" onclick="sendEmail()" \${statusMsg ? "disabled" : ""}>\${statusMsg === "Sending Email via AWS SES..." ? "Sending via AWS SES..." : "Send Email to Contacts"}</button>
            </section>
          \` : ""}

          \${errorMsg ? \`<p class="error">\${errorMsg}</p>\` : ""}

          \${smsResults.length ? \`
            <section class="card">
              <h2>SMS Dispatch Results</h2>
              <table>
                <thead><tr><th>Name</th><th>Phone</th><th>Status</th><th>Details / SID</th></tr></thead>
                <tbody>
                  \${smsResults.map(r => \`
                    <tr>
                      <td>\${r.name}</td>
                      <td>\${r.phone}</td>
                      <td class="\${r.status === 'sent' ? 'ok' : 'fail'}">\${r.status}</td>
                      <td><code>\${r.sid || r.error}</code></td>
                    </tr>
                  \`).join("")}
                </tbody>
              </table>
            </section>
          \` : ""}

          \${emailResults.length ? \`
            <section class="card">
              <h2>Email Dispatch Results</h2>
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Message ID / Details</th></tr></thead>
                <tbody>
                  \${emailResults.map(r => \`
                    <tr>
                      <td>\${r.name}</td>
                      <td>\${r.email}</td>
                      <td class="\${r.status === 'sent' ? 'ok' : 'fail'}">\${r.status}</td>
                      <td><code>\${r.id || r.error}</code></td>
                    </tr>
                  \`).join("")}
                </tbody>
              </table>
            </section>
          \` : ""}
        </div>
      \`;
    }

    function setTab(tab) {
      activeTab = tab;
      render();
    }

    window.onload = checkAuth;
    if (document.readyState === "complete" || document.readyState === "interactive") {
      checkAuth();
    }
  </script>
</body>
</html>`;

const backendCode = `
const DEFAULT_ADMINS = ["skbhati199@gmail.com", "skbhati2015@gmail.com"];

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key, data) {
  const enc = new TextEncoder();
  const kData = typeof key === "string" ? enc.encode(key) : key;
  const mData = typeof data === "string" ? enc.encode(data) : data;
  const cryptoKey = await crypto.subtle.importKey("raw", kData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, mData));
}

async function getSignatureKey(secretKey, dateStamp, regionName, serviceName) {
  const kDate = await hmacSha256("AWS4" + secretKey, dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  return await hmacSha256(kService, "aws4_request");
}

async function sendSesEmail({ accessKey, secretKey, region, fromEmail, toEmail, subject, htmlBody }) {
  const endpoint = "https://email." + region + ".amazonaws.com/v2/email/outbound-emails";
  const host = "email." + region + ".amazonaws.com";
  const payload = JSON.stringify({
    FromEmailAddress: fromEmail,
    Destination: { ToAddresses: [toEmail] },
    Content: {
      Simple: {
        Subject: { Data: subject },
        Body: { Html: { Data: htmlBody } }
      }
    }
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\\.\\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);
  const payloadHash = await sha256Hex(payload);

  const canonicalHeaders = "content-type:application/json\\nhost:" + host + "\\nx-amz-date:" + amzDate + "\\n";
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalRequest = ["POST", "/v2/email/outbound-emails", "", canonicalHeaders, signedHeaders, payloadHash].join("\\n");

  const credentialScope = dateStamp + "/" + region + "/ses/aws4_request";
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\\n");

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, "ses");
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(signatureBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

  const authHeader = "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + credentialScope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Host": host,
      "X-Amz-Date": amzDate,
      "Authorization": authHeader
    },
    body: payload
  });

  const resText = await res.text();
  if (!res.ok) throw new Error("SES Error (" + res.status + "): " + resText);
  return JSON.parse(resText);
}

async function sendTwilioSms({ accountSid, authToken, messagingServiceSid, fromNumber, to, body }) {
  const url = "https://api.twilio.com/2010-04-01/Accounts/" + accountSid + "/Messages.json";
  const basicAuth = btoa(accountSid + ":" + authToken);
  const params = new URLSearchParams();
  params.append("To", to);
  params.append("Body", body);
  if (messagingServiceSid) params.append("MessagingServiceSid", messagingServiceSid);
  else if (fromNumber) params.append("From", fromNumber);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + basicAuth,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || ("Twilio error " + (data.code || res.status)));
  return data;
}

async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
  const data = encodedHeader + "." + encodedPayload;

  const signatureBytes = await hmacSha256(secret, data);
  const encodedSignature = btoa(String.fromCharCode(...signatureBytes)).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
  return data + "." + encodedSignature;
}

async function verifyJwt(token, secret) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const data = headerB64 + "." + payloadB64;

  const expectedSigBytes = await hmacSha256(secret, data);
  const expectedSig = btoa(String.fromCharCode(...expectedSigBytes)).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
  if (expectedSig !== sigB64) return null;

  try {
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function normalizeIndianMobile(value) {
  const phone = String(value || "").trim().replace(/[\\s()-]/g, "");
  const mobile = phone.match(/^(?:\\+91)?([6-9]\\d{9})$/);
  return mobile ? ("+91" + mobile[1]) : null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    const JWT_SECRET = env.JWT_SECRET || "notifysetu-outreach-secret-key-2026";
    const ADMIN_EMAILS = (env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const ALLOWED_ADMINS = ADMIN_EMAILS.length > 0 ? ADMIN_EMAILS : DEFAULT_ADMINS;

    if (path === "/api/health") {
      return jsonResponse({
        status: "ok",
        service: "sms-outreach-app",
        runtime: "cloudflare-workers",
        emailVerified: true,
        sender: env.SES_FROM_EMAIL || "contact@update.infoskillstechnology.com"
      });
    }

    if (path === "/api/auth/google" && request.method === "POST") {
      try {
        const body = await request.json();
        const credential = body.credential;
        if (!credential) return jsonResponse({ error: "Missing Google ID token" }, 400);

        const gRes = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential));
        if (!gRes.ok) return jsonResponse({ error: "Invalid Google credential" }, 401);
        const gPayload = await gRes.json();
        const email = (gPayload.email || "").toLowerCase();

        if (gPayload.email_verified !== "true" && gPayload.email_verified !== true) {
          return jsonResponse({ error: "Google email is not verified" }, 403);
        }
        if (!ALLOWED_ADMINS.includes(email)) {
          return jsonResponse({ error: "Access denied. " + email + " is not authorized." }, 403);
        }

        const user = {
          email,
          name: gPayload.name || email.split("@")[0],
          picture: gPayload.picture || ""
        };
        const token = await signJwt({ ...user, exp: Math.floor(Date.now() / 1000) + 7 * 86400 }, JWT_SECRET);
        return jsonResponse({ token, user });
      } catch (err) {
        return jsonResponse({ error: "Authentication failed: " + err.message }, 500);
      }
    }

    if (path === "/api/auth/me") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\\s+/i, "");
      const session = await verifyJwt(token, JWT_SECRET);
      if (!session) return jsonResponse({ error: "Unauthorized" }, 401);
      return jsonResponse({ user: { email: session.email, name: session.name, picture: session.picture } });
    }

    if (path.startsWith("/api/send-")) {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\\s+/i, "");
      const session = await verifyJwt(token, JWT_SECRET);
      if (!session) return jsonResponse({ error: "Unauthorized: Administrator sign-in required." }, 401);
    }

    if (path === "/api/send-sms" && request.method === "POST") {
      try {
        const { contacts, message } = await request.json();
        if (!Array.isArray(contacts) || contacts.length === 0) return jsonResponse({ error: "No contacts provided" }, 400);

        const accountSid = env.TWILIO_ACCOUNT_SID;
        const authToken = env.TWILIO_AUTH_TOKEN;
        const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
        const fromNumber = env.TWILIO_FROM_NUMBER;
        if (!accountSid || !authToken) return jsonResponse({ error: "Twilio credentials not configured on worker" }, 500);

        const results = [];
        for (const contact of contacts) {
          const phone = normalizeIndianMobile(contact.phone);
          if (!phone) {
            results.push({ name: contact.name, phone: contact.phone, status: "failed", error: "Invalid Indian mobile number" });
            continue;
          }
          const contactMsg = contact.smsBody?.trim() || message || "";
          const personalized = contactMsg.replace(/{{name}}/g, contact.name || "there");
          try {
            const sent = await sendTwilioSms({ accountSid, authToken, messagingServiceSid, fromNumber, to: phone, body: personalized });
            results.push({ name: contact.name, phone, status: "sent", sid: sent.sid });
          } catch (err) {
            results.push({ name: contact.name, phone, status: "failed", error: err.message });
          }
        }
        return jsonResponse({ results });
      } catch (err) {
        return jsonResponse({ error: "Send SMS failed: " + err.message }, 500);
      }
    }

    if (path === "/api/send-email" && request.method === "POST") {
      try {
        const { contacts, subject, emailBody } = await request.json();
        if (!Array.isArray(contacts) || contacts.length === 0) return jsonResponse({ error: "No contacts provided" }, 400);
        if (!subject || !subject.trim()) return jsonResponse({ error: "Email subject is required" }, 400);

        const accessKey = env.AWS_ACCESS_KEY_ID;
        const secretKey = env.AWS_SECRET_ACCESS_KEY;
        const region = env.AWS_REGION || "ap-south-1";
        const fromEmail = env.SES_FROM_EMAIL || "contact@update.infoskillstechnology.com";
        if (!accessKey || !secretKey) return jsonResponse({ error: "AWS SES credentials not configured on worker" }, 500);

        const results = [];
        for (const contact of contacts) {
          const recipients = String(contact.email || "").split(/[;,]/).map((e) => e.trim()).filter((e) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e));
          if (recipients.length === 0) {
            results.push({ name: contact.name, email: contact.email || "(none)", status: "failed", error: "Missing or invalid email address" });
            continue;
          }
          for (const recipient of recipients) {
            const body = (contact.emailBody || emailBody || "").replace(/{{name}}/g, contact.name || "there");
            try {
              const res = await sendSesEmail({ accessKey, secretKey, region, fromEmail, toEmail: recipient, subject, htmlBody: body });
              results.push({ name: contact.name, email: recipient, status: "sent", id: res.MessageId });
            } catch (err) {
              results.push({ name: contact.name, email: recipient, status: "failed", error: err.message });
            }
          }
        }
        return jsonResponse({ results });
      } catch (err) {
        return jsonResponse({ error: "Send email failed: " + err.message }, 500);
      }
    }

    return new Response(INDEX_HTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });
  }
};
`;

const completeWorkerCode = "const INDEX_HTML = " + JSON.stringify(html) + ";\n" + backendCode;
fs.writeFileSync(path.join(__dirname, "compact-worker.js"), completeWorkerCode, "utf8");
console.log("compact-worker.js updated successfully! Length:", completeWorkerCode.length);
