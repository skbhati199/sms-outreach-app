const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "client", "dist");
const indexHtml = fs.readFileSync(path.join(distDir, "index.html"), "utf8");

const assetsDir = path.join(distDir, "assets");
const assetFiles = fs.readdirSync(assetsDir);

const assets = {};
for (const file of assetFiles) {
  const filePath = path.join(assetsDir, file);
  const content = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(file);
  const mime = ext === ".css" ? "text/css" : ext === ".js" ? "application/javascript" : "text/plain";
  assets[`/assets/${file}`] = {
    content,
    mime,
  };
}

console.log("Assets prepared:", Object.keys(assets));

// Generate the self-contained Worker code
const workerTemplate = `
// InfoSkills Outreach - SMS & Email Cloudflare Worker
const INDEX_HTML = ${JSON.stringify(indexHtml)};
const ASSETS = ${JSON.stringify(assets)};

const DEFAULT_ADMINS = ["skbhati199@gmail.com", "skbhati2015@gmail.com"];

// --- Crypto & AWS SigV4 Utilities ---
async function sha256Hex(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key, data) {
  const encoder = new TextEncoder();
  const keyData = typeof key === "string" ? encoder.encode(key) : key;
  const msgData = typeof data === "string" ? encoder.encode(data) : data;

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, msgData));
}

async function getSignatureKey(secretKey, dateStamp, regionName, serviceName) {
  const kDate = await hmacSha256("AWS4" + secretKey, dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  return await hmacSha256(kService, "aws4_request");
}

async function sendSesEmail({ accessKey, secretKey, region, fromEmail, toEmail, subject, htmlBody }) {
  const endpoint = \`https://email.\${region}.amazonaws.com/v2/email/outbound-emails\`;
  const host = \`email.\${region}.amazonaws.com\`;
  const payload = JSON.stringify({
    FromEmailAddress: fromEmail,
    Destination: {
      ToAddresses: [toEmail],
    },
    Content: {
      Simple: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: htmlBody },
        },
      },
    },
  });

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\\.\\d{3}/g, "");
  const dateStamp = amzDate.substring(0, 8);

  const payloadHash = await sha256Hex(payload);
  const canonicalHeaders = \`content-type:application/json\\nhost:\${host}\\nx-amz-date:\${amzDate}\\n\`;
  const signedHeaders = "content-type;host;x-amz-date";
  const canonicalRequest = [
    "POST",
    "/v2/email/outbound-emails",
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\\n");

  const credentialScope = \`\${dateStamp}/\${region}/ses/aws4_request\`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\\n");

  const signingKey = await getSignatureKey(secretKey, dateStamp, region, "ses");
  const signatureBytes = await hmacSha256(signingKey, stringToSign);
  const signature = Array.from(signatureBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authHeader = \`AWS4-HMAC-SHA256 Credential=\${accessKey}/\${credentialScope}, SignedHeaders=\${signedHeaders}, Signature=\${signature}\`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Host": host,
      "X-Amz-Date": amzDate,
      "Authorization": authHeader,
    },
    body: payload,
  });

  const resText = await res.text();
  if (!res.ok) {
    throw new Error(\`SES Error (\${res.status}): \${resText}\`);
  }
  return JSON.parse(resText);
}

async function sendTwilioSms({ accountSid, authToken, messagingServiceSid, fromNumber, to, body }) {
  const url = \`https://api.twilio.com/2010-04-01/Accounts/\${accountSid}/Messages.json\`;
  const basicAuth = btoa(\`\${accountSid}:\${authToken}\`);

  const params = new URLSearchParams();
  params.append("To", to);
  params.append("Body", body);
  if (messagingServiceSid) {
    params.append("MessagingServiceSid", messagingServiceSid);
  } else if (fromNumber) {
    params.append("From", fromNumber);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": \`Basic \${basicAuth}\`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || \`Twilio error code \${data.code || res.status}\`);
  }
  return data;
}

// --- JWT Auth Utilities ---
async function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\\+/g, "-").replace(/\\//g, "_");
  const data = \`\${encodedHeader}.\${encodedPayload}\`;

  const signatureBytes = await hmacSha256(secret, data);
  const encodedSignature = btoa(String.fromCharCode(...signatureBytes))
    .replace(/=/g, "")
    .replace(/\\+/g, "-")
    .replace(/\\//g, "_");

  return \`\${data}.\${encodedSignature}\`;
}

async function verifyJwt(token, secret) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  const data = \`\${headerB64}.\${payloadB64}\`;

  const expectedSigBytes = await hmacSha256(secret, data);
  const expectedSig = btoa(String.fromCharCode(...expectedSigBytes))
    .replace(/=/g, "")
    .replace(/\\+/g, "-")
    .replace(/\\//g, "_");

  if (expectedSig !== sigB64) return null;

  try {
    const payloadJson = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(payloadJson);
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function normalizeIndianMobile(value) {
  const phone = String(value || "").trim().replace(/[\\s()-]/g, "");
  const mobile = phone.match(/^(?:\\+91)?([6-9]\\d{9})$/);
  return mobile ? \`+91\${mobile[1]}\` : null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const JWT_SECRET = env.JWT_SECRET || "notifysetu-outreach-secret-key-2026";
    const ADMIN_EMAILS = (env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const ALLOWED_ADMINS = ADMIN_EMAILS.length > 0 ? ADMIN_EMAILS : DEFAULT_ADMINS;

    // --- API ROUTES ---
    if (path === "/api/health") {
      return jsonResponse({
        status: "ok",
        service: "sms-outreach-app",
        runtime: "cloudflare-workers",
        emailVerified: true,
        sender: env.SES_FROM_EMAIL || "contact@update.infoskillstechnology.com",
      });
    }

    if (path === "/api/auth/google" && request.method === "POST") {
      try {
        const body = await request.json();
        const credential = body.credential;
        if (!credential) {
          return jsonResponse({ error: "Missing Google ID token" }, 400);
        }

        // Verify ID token with Google
        const gRes = await fetch(\`https://oauth2.googleapis.com/tokeninfo?id_token=\${encodeURIComponent(credential)}\`);
        if (!gRes.ok) {
          return jsonResponse({ error: "Invalid Google credential" }, 401);
        }
        const gPayload = await gRes.json();
        const email = (gPayload.email || "").toLowerCase();

        if (gPayload.email_verified !== "true" && gPayload.email_verified !== true) {
          return jsonResponse({ error: "Google email is not verified" }, 403);
        }

        if (!ALLOWED_ADMINS.includes(email)) {
          return jsonResponse({
            error: \`Access denied. \${email} is not authorized. Please contact the administrator.\`,
          }, 403);
        }

        const user = {
          email,
          name: gPayload.name || email.split("@")[0],
          picture: gPayload.picture || "",
        };

        const token = await signJwt(
          {
            ...user,
            exp: Math.floor(Date.now() / 1000) + 7 * 86400, // 7 days
          },
          JWT_SECRET
        );

        return jsonResponse({ token, user });
      } catch (err) {
        return jsonResponse({ error: "Authentication failed: " + err.message }, 500);
      }
    }

    if (path === "/api/auth/me") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\\s+/i, "");
      const session = await verifyJwt(token, JWT_SECRET);

      if (!session) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      return jsonResponse({
        user: {
          email: session.email,
          name: session.name,
          picture: session.picture,
        },
      });
    }

    // Protected API routes guard
    if (path.startsWith("/api/send-") || path === "/api/upload-csv") {
      const authHeader = request.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\\s+/i, "");
      const session = await verifyJwt(token, JWT_SECRET);

      if (!session) {
        return jsonResponse({ error: "Unauthorized: Administrator sign-in required." }, 401);
      }
    }

    if (path === "/api/send-sms" && request.method === "POST") {
      try {
        const { contacts, message } = await request.json();
        if (!Array.isArray(contacts) || contacts.length === 0) {
          return jsonResponse({ error: "No contacts provided" }, 400);
        }

        const accountSid = env.TWILIO_ACCOUNT_SID;
        const authToken = env.TWILIO_AUTH_TOKEN;
        const messagingServiceSid = env.TWILIO_MESSAGING_SERVICE_SID;
        const fromNumber = env.TWILIO_FROM_NUMBER;

        if (!accountSid || !authToken) {
          return jsonResponse({ error: "Twilio credentials not configured on worker" }, 500);
        }

        const results = [];
        for (const contact of contacts) {
          const phone = normalizeIndianMobile(contact.phone);
          if (!phone) {
            results.push({
              name: contact.name,
              phone: contact.phone,
              status: "failed",
              error: "Invalid Indian mobile number (must be 10 digits starting with 6-9)",
            });
            continue;
          }

          const contactMsg = contact.smsBody?.trim() || message || "";
          const personalized = contactMsg.replace(/{{name}}/g, contact.name || "there");

          try {
            const sent = await sendTwilioSms({
              accountSid,
              authToken,
              messagingServiceSid,
              fromNumber,
              to: phone,
              body: personalized,
            });
            results.push({
              name: contact.name,
              phone,
              status: "sent",
              sid: sent.sid,
            });
          } catch (err) {
            results.push({
              name: contact.name,
              phone,
              status: "failed",
              error: err.message,
            });
          }
        }

        return jsonResponse({ results });
      } catch (err) {
        return jsonResponse({ error: "Send SMS request failed: " + err.message }, 500);
      }
    }

    if (path === "/api/send-email" && request.method === "POST") {
      try {
        const { contacts, subject, emailBody } = await request.json();
        if (!Array.isArray(contacts) || contacts.length === 0) {
          return jsonResponse({ error: "No contacts provided" }, 400);
        }
        if (!subject || !subject.trim()) {
          return jsonResponse({ error: "Email subject is required" }, 400);
        }

        const accessKey = env.AWS_ACCESS_KEY_ID;
        const secretKey = env.AWS_SECRET_ACCESS_KEY;
        const region = env.AWS_REGION || "ap-south-1";
        const fromEmail = env.SES_FROM_EMAIL || "contact@update.infoskillstechnology.com";

        if (!accessKey || !secretKey) {
          return jsonResponse({ error: "AWS SES credentials not configured on worker" }, 500);
        }

        const results = [];
        for (const contact of contacts) {
          const recipients = String(contact.email || "")
            .split(/[;,]/)
            .map((e) => e.trim())
            .filter((e) => /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(e));

          if (recipients.length === 0) {
            results.push({
              name: contact.name,
              email: contact.email || "(none)",
              status: "failed",
              error: "Missing or invalid email address",
            });
            continue;
          }

          for (const recipient of recipients) {
            const body = (contact.emailBody || emailBody || "").replace(/{{name}}/g, contact.name || "there");
            try {
              const res = await sendSesEmail({
                accessKey,
                secretKey,
                region,
                fromEmail,
                toEmail: recipient,
                subject,
                htmlBody: body,
              });
              results.push({
                name: contact.name,
                email: recipient,
                status: "sent",
                id: res.MessageId,
              });
            } catch (err) {
              results.push({
                name: contact.name,
                email: recipient,
                status: "failed",
                error: err.message,
              });
            }
          }
        }

        return jsonResponse({ results });
      } catch (err) {
        return jsonResponse({ error: "Send email request failed: " + err.message }, 500);
      }
    }

    // --- STATIC ASSETS & SPA SERVING ---
    if (ASSETS[path]) {
      const asset = ASSETS[path];
      return new Response(asset.content, {
        headers: {
          "Content-Type": asset.mime,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Default to SPA index.html for all page requests
    return new Response(INDEX_HTML, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  },
};
`;

fs.writeFileSync(path.join(__dirname, "bundled-worker.js"), workerTemplate, "utf8");
console.log("Successfully generated bundled-worker.js (Size:", Buffer.byteLength(workerTemplate), "bytes)");
