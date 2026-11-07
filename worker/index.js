const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
let cachedAccessToken = null;
let cachedAccessUntil = 0;
const verifiedTokens = new Map();

function b64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function pemBytes(pem) {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const raw = atob(body);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}
function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
      "vary": "Origin",
      "cache-control": "no-store"
    }
  });
}
async function googleAccessToken(env) {
  if (cachedAccessToken && Date.now() < cachedAccessUntil - 60000) return cachedAccessToken;
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) throw new Error("Thiếu cấu hình Service Account trên Worker.");
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemBytes(env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = unsigned + "." + b64url(new Uint8Array(signature));
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error("Google không cấp quyền Sheets: " + (result.error_description || result.error || response.status));
  cachedAccessToken = result.access_token;
  cachedAccessUntil = Date.now() + (Number(result.expires_in) || 3600) * 1000;
  return cachedAccessToken;
}
async function sheetsRequest(env, path, options = {}) {
  const token = await googleAccessToken(env);
  const response = await fetch(SHEETS_API + "/" + env.SPREADSHEET_ID + path, {
    ...options,
    headers: {
      authorization: "Bearer " + token,
      "content-type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message || "Google Sheets API lỗi " + response.status);
  return body;
}
async function ensureTabs(env) {
  const info = await sheetsRequest(env, "?fields=sheets.properties.title");
  const names = new Set((info.sheets || []).map(x => x.properties.title));
  const wanted = ["Players", "GameSaves", "SaveHistory"];
  const missing = wanted.filter(x => !names.has(x));
  if (missing.length) {
    await sheetsRequest(env, ":batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: missing.map(title => ({ addSheet: { properties: { title } } })) })
    });
  }
  const headers = [
    { range: "Players!A1:D1", values: [["Google Sub", "Email", "Tên hiển thị", "Lần đăng nhập cuối"]] },
    { range: "GameSaves!A1:E1", values: [["Google Sub", "Email", "Tên hiển thị", "Save JSON", "Cập nhật lúc"]] },
    { range: "SaveHistory!A1:E1", values: [["Thời gian", "Google Sub", "Email", "Thao tác", "Kích thước save"]] }
  ];
  await Promise.all(headers.map(x => sheetsRequest(env, "/values/" + encodeURIComponent(x.range) + "?valueInputOption=RAW", {
    method: "PUT", body: JSON.stringify({ values: x.values })
  })));
}
async function verifyGoogleToken(idToken, env) {
  if (!idToken) throw new Error("Bạn chưa đăng nhập Google.");
  const cached = verifiedTokens.get(idToken);
  if (cached && cached.exp > Date.now()) return cached.profile;
  const response = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken));
  const info = await response.json();
  if (!response.ok || info.aud !== env.GOOGLE_CLIENT_ID) throw new Error("Google ID token không hợp lệ hoặc sai Client ID.");
  if (!info.sub || Number(info.exp) * 1000 <= Date.now()) throw new Error("Phiên đăng nhập Google đã hết hạn.");
  if (!["accounts.google.com", "https://accounts.google.com"].includes(info.iss)) throw new Error("Nguồn xác thực Google không hợp lệ.");
  if (info.email_verified !== "true") throw new Error("Tài khoản Google chưa xác minh email.");
  const profile = { sub: info.sub, email: info.email || "", name: info.name || info.email || "Người chơi" };
  verifiedTokens.set(idToken, { profile, exp: Math.min(Number(info.exp) * 1000, Date.now() + 300000) });
  return profile;
}
async function readRows(env, range) {
  const data = await sheetsRequest(env, "/values/" + encodeURIComponent(range));
  return data.values || [];
}
async function appendRow(env, range, values) {
  return sheetsRequest(env, "/values/" + encodeURIComponent(range) + ":append?valueInputOption=RAW&insertDataOption=INSERT_ROWS", {
    method: "POST", body: JSON.stringify({ values: [values] })
  });
}
async function updateRow(env, range, values) {
  return sheetsRequest(env, "/values/" + encodeURIComponent(range) + "?valueInputOption=RAW", {
    method: "PUT", body: JSON.stringify({ values: [values] })
  });
}
async function touchPlayer(env, profile) {
  const rows = await readRows(env, "Players!A2:D");
  const index = rows.findIndex(row => row[0] === profile.sub);
  const values = [profile.sub, profile.email, profile.name, new Date().toISOString()];
  if (index >= 0) await updateRow(env, "Players!A" + (index + 2) + ":D" + (index + 2), values);
  else await appendRow(env, "Players!A:D", values);
}
async function loadSave(env, profile) {
  const rows = await readRows(env, "GameSaves!A2:E");
  const index = rows.findIndex(row => row[0] === profile.sub);
  if (index < 0 || !rows[index][3]) return null;
  let save;
  try { save = JSON.parse(rows[index][3]); } catch { throw new Error("Dữ liệu save trên Sheet bị lỗi định dạng."); }
  return { save, updatedAt: rows[index][4] || null };
}
async function saveGame(env, profile, save) {
  const serialized = JSON.stringify(save);
  if (serialized.length > 45000) throw new Error("Save quá lớn cho một ô Google Sheets (tối đa 45.000 ký tự).");
  const rows = await readRows(env, "GameSaves!A2:E");
  const index = rows.findIndex(row => row[0] === profile.sub);
  const now = new Date().toISOString();
  const values = [profile.sub, profile.email, profile.name, serialized, now];
  if (index >= 0) await updateRow(env, "GameSaves!A" + (index + 2) + ":E" + (index + 2), values);
  else await appendRow(env, "GameSaves!A:E", values);
  await appendRow(env, "SaveHistory!A:E", [now, profile.sub, profile.email, "SAVE", String(serialized.length)]);
  return { updatedAt: now, size: serialized.length };
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "https://khahdihdz.github.io";
    if (origin && origin !== allowed) return new Response("Origin not allowed", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": allowed,
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type,authorization",
        "access-control-max-age": "86400",
        "vary": "Origin"
      }
    });
    const url = new URL(request.url);
    if (url.pathname === "/health") return json({ ok: true, service: "maid-empire-api" }, 200, allowed);
    try {
      if (!env.SPREADSHEET_ID || !env.GOOGLE_CLIENT_ID) throw new Error("Thiếu cấu hình SPREADSHEET_ID hoặc GOOGLE_CLIENT_ID.");
      const authorization = request.headers.get("Authorization") || "";
      const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
      const profile = await verifyGoogleToken(idToken, env);
      await ensureTabs(env);
      await touchPlayer(env, profile);
      if (url.pathname === "/api/load" && request.method === "GET") {
        const result = await loadSave(env, profile);
        return json({ ok: true, profile, ...result }, 200, allowed);
      }
      if (url.pathname === "/api/save" && request.method === "POST") {
        const body = await request.json();
        if (!body.save || typeof body.save !== "object" || Array.isArray(body.save)) return json({ ok: false, error: "Save không hợp lệ." }, 400, allowed);
        const result = await saveGame(env, profile, body.save);
        return json({ ok: true, ...result }, 200, allowed);
      }
      return json({ ok: false, error: "Not found" }, 404, allowed);
    } catch (error) {
      return json({ ok: false, error: error.message || "Lỗi máy chủ." }, 400, allowed);
    }
  }
};