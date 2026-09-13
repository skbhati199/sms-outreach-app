import { useState, useEffect, useRef } from "react";

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "267028123948-8omvgmkdnm9k77ntoidj5pvf8ua3aouc.apps.googleusercontent.com";

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("outreach_token") || "");
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("outreach_user") || "null");
    } catch {
      return null;
    }
  });
  const [authLoading, setAuthLoading] = useState(!!token && !user);
  const [authError, setAuthError] = useState("");

  const [contacts, setContacts] = useState([]);
  const [activePage, setActivePage] = useState("sms");
  const [message, setMessage] = useState("Hi {{name}}, this is a message from our team!");
  const [emailBody, setEmailBody] = useState("");
  const [emailSubject, setEmailSubject] = useState("A digital solution for your business");
  const [rejectedCount, setRejectedCount] = useState(0);
  const [results, setResults] = useState([]);
  const [emailResults, setEmailResults] = useState([]);
  const [status, setStatus] = useState(""); // "", "uploading", "sending", "sending-email"
  const [error, setError] = useState("");

  const googleBtnRef = useRef(null);

  // Validate existing token on mount
  useEffect(() => {
    if (!token) return;
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Session expired");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        localStorage.setItem("outreach_user", JSON.stringify(data.user));
      })
      .catch(() => {
        handleLogout();
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, [token]);

  // Initialize Google Identity Services
  useEffect(() => {
    if (user || !window.google) return;

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
      });

      if (googleBtnRef.current) {
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: "filled_blue",
          size: "large",
          shape: "rectangular",
          text: "signin_with",
          width: 280,
        });
      }
    } catch (err) {
      console.warn("Google GIS init error:", err);
    }
  }, [user]);

  async function handleGoogleResponse(response) {
    setAuthError("");
    setAuthLoading(true);

    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Google authentication failed");
      }

      setToken(data.token);
      setUser(data.user);
      localStorage.setItem("outreach_token", data.token);
      localStorage.setItem("outreach_user", JSON.stringify(data.user));
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    setToken("");
    setUser(null);
    localStorage.removeItem("outreach_token");
    localStorage.removeItem("outreach_user");
  }

  function normalizeIndianMobile(value) {
    const phone = String(value || "").trim().replace(/[\s()-]/g, "");
    const mobile = phone.match(/^(?:\+91)?([6-9]\d{9})$/);
    return mobile ? `+91${mobile[1]}` : null;
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setError("");
    setStatus("uploading");
    setResults([]);
    setEmailResults([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-csv", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
        setRejectedCount(data.rejected || 0);
        if (data.contacts?.[0]?.smsBody) setMessage(data.contacts[0].smsBody);
        if (data.contacts?.[0]?.emailBody) setEmailBody(data.contacts[0].emailBody);
        return;
      }

      // Fallback: client-side CSV parsing if server upload failed
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) throw new Error("CSV file is empty");

      const parsed = [];
      let rejected = 0;

      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.replace(/^"|"$/g, "").trim());
        const name = parts[0] || "";
        const rawPhone = parts[1] || "";
        const normPhone = normalizeIndianMobile(rawPhone);
        const email = parts.length >= 5 ? parts[2] : "";
        const smsBody = parts.length >= 5 ? parts[3] : parts[2] || "";
        const htmlBody = parts.length >= 5 ? parts[4] : parts[3] || "";

        if (normPhone) {
          parsed.push({
            id: i,
            name,
            phone: normPhone,
            email,
            smsBody,
            emailBody: htmlBody,
          });
        } else {
          rejected++;
        }
      }

      setContacts(parsed);
      setRejectedCount(rejected);
      if (parsed[0]?.smsBody) setMessage(parsed[0].smsBody);
      if (parsed[0]?.emailBody) setEmailBody(parsed[0].emailBody);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("");
    }
  }

  async function handleSend() {
    setError("");
    setStatus("sending");
    setResults([]);

    try {
      const res = await fetch("/api/send-sms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contacts, message }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "SMS send failed");

      setResults(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("");
    }
  }

  async function handleSendEmail() {
    setError("");
    setStatus("sending-email");
    setEmailResults([]);

    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ contacts, subject: emailSubject, emailBody }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Email send failed");

      setEmailResults(data.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setStatus("");
    }
  }

  // If not logged in, render Google Login Screen
  if (!user) {
    return (
      <div className="container auth-container">
        <div className="card auth-card">
          <div className="brand-badge">INFOSKILLS OUTREACH</div>
          <h1>Admin Sign In</h1>
          <p className="subtitle">
            Secure multi-channel outreach engine powered by AWS SES &amp; Twilio.
          </p>

          {authError && <p className="error">{authError}</p>}
          {authLoading && <p className="muted">Authenticating with Google...</p>}

          <div className="google-btn-wrapper">
            <div ref={googleBtnRef} id="google-btn"></div>
          </div>

          <p className="auth-hint">
            Access is restricted to authorized administrators (<code>skbhati199@gmail.com</code>).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="app-header">
        <div>
          <h1>InfoSkills Outreach</h1>
          <p className="subtitle">SMS &amp; Email Marketing Campaign Engine</p>
        </div>
        <div className="user-profile">
          {user.picture && <img src={user.picture} alt={user.name} className="avatar" />}
          <div className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-email">{user.email}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign Out">
            Sign Out
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Outreach channels">
        <button
          className={activePage === "sms" ? "active" : "secondary"}
          onClick={() => setActivePage("sms")}
        >
          📱 SMS Campaign
        </button>
        <button
          className={activePage === "email" ? "active" : "secondary"}
          onClick={() => setActivePage("email")}
        >
          ✉️ Email Campaign
        </button>
      </nav>

      <section className="card">
        <h2>1. Upload Contacts (CSV)</h2>
        <input type="file" accept=".csv" onChange={handleFileChange} />
        {status === "uploading" && <p className="muted">Parsing contacts...</p>}
        {contacts.length > 0 && (
          <p className="ok">{contacts.length} contact(s) ready for outreach.</p>
        )}
        {rejectedCount > 0 && (
          <p className="error">
            {rejectedCount} row(s) excluded (only valid 10-digit Indian numbers accepted).
          </p>
        )}
      </section>

      {contacts.length > 0 && (
        <section className="card">
          <h2>2. Preview Contacts</h2>
          <p className="muted">Review imported contacts before triggering dispatch.</p>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>SMS Preview</th>
                <th>Email Preview</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr key={i}>
                  <td><strong>{c.name || "(No name)"}</strong></td>
                  <td><code>{c.phone}</code></td>
                  <td>
                    <details className="message-details">
                      <summary>{c.smsBody ? "View SMS" : "Fallback"}</summary>
                      <p className="sms-preview">{c.smsBody || message}</p>
                    </details>
                  </td>
                  <td>
                    <details className="message-details">
                      <summary>{c.email ? (c.emailBody ? "HTML Preview" : c.email) : "No Email"}</summary>
                      {c.emailBody ? (
                        <iframe
                          className="email-preview"
                          title={`Email preview for ${c.name}`}
                          srcDoc={c.emailBody}
                          sandbox=""
                        />
                      ) : (
                        <p className="muted">{c.email || "No email"}</p>
                      )}
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {activePage === "sms" && contacts.length > 0 && (
        <section className="card">
          <h2>3. Compose &amp; Send SMS</h2>
          <p className="muted">
            Personalize using <code>{"{{name}}"}</code>. Dispatched via Twilio Messaging Service.
          </p>
          <label htmlFor="sms-message">Default Message Template</label>
          <textarea
            id="sms-message"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button onClick={handleSend} disabled={status === "sending"}>
            {status === "sending" ? "Sending via Twilio..." : `Send SMS to ${contacts.length} Contact(s)`}
          </button>
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <section className="card">
          <h2>SMS Dispatch Results</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.phone}</td>
                  <td className={r.status === "sent" ? "ok" : "fail"}>{r.status}</td>
                  <td>{r.sid || r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {activePage === "email" && contacts.length > 0 && (
        <section className="card">
          <h2>3. Compose &amp; Send Email</h2>
          <p className="muted">
            Sent via <strong>contact@update.infoskillstechnology.com</strong> (AWS SES verified with DKIM).
          </p>
          <label htmlFor="email-subject">Subject Line</label>
          <input
            id="email-subject"
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
          />
          <label htmlFor="email-body">Default HTML Body</label>
          <textarea
            id="email-body"
            rows={12}
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="<html><body>...</body></html>"
          />
          <button onClick={handleSendEmail} disabled={status === "sending-email"}>
            {status === "sending-email" ? "Sending via AWS SES..." : `Send Email to Contacts`}
          </button>
        </section>
      )}

      {activePage === "email" && emailResults.length > 0 && (
        <section className="card">
          <h2>Email Dispatch Results</h2>
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Status</th>
                <th>Message ID</th>
              </tr>
            </thead>
            <tbody>
              {emailResults.map((result, index) => (
                <tr key={index}>
                  <td>{result.name}</td>
                  <td>{result.email}</td>
                  <td className={result.status === "sent" ? "ok" : "fail"}>{result.status}</td>
                  <td><code>{result.id || result.error}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
