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
  const wanted = ["Players", "GameSaves", "SaveHistory", "PaymentOrders", "PaymentTransactions"];
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
    { range: "SaveHistory!A1:E1", values: [["Thời gian", "Google Sub", "Email", "Thao tác", "Kích thước save"]] },
    { range: "PaymentOrders!A1:L1", values: [["Mã đơn", "Google Sub", "Email", "Số tiền thanh toán", "Nội dung", "Trạng thái", "Tạo lúc", "Hết hạn", "Mã giao dịch SePay", "Tiền game cơ bản", "Thưởng khuyến mãi", "Tên ưu đãi"]] },
    { range: "PaymentTransactions!A1:F1", values: [["Mã giao dịch SePay", "Mã đơn", "Số tiền", "Mã tham chiếu", "Nội dung", "Thời gian nhận"]] }
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
async function deleteMyData(env, profile) {
  const [players, saves, history, orders, transactions, meta] = await Promise.all([
    readRows(env, "Players!A2:D"),
    readRows(env, "GameSaves!A2:E"),
    readRows(env, "SaveHistory!A2:E"),
    readRows(env, "PaymentOrders!A2:L"),
    readRows(env, "PaymentTransactions!A2:F"),
    sheetsRequest(env, "?fields=sheets.properties(sheetId,title)")
  ]);
  const ownedOrders = new Set(orders.filter(r => r[1] === profile.sub).map(r => r[0]).filter(Boolean));
  const targets = [
    { title: "Players", rows: players, match: r => r[0] === profile.sub },
    { title: "GameSaves", rows: saves, match: r => r[0] === profile.sub },
    { title: "SaveHistory", rows: history, match: r => r[1] === profile.sub },
    { title: "PaymentOrders", rows: orders, match: r => r[1] === profile.sub },
    { title: "PaymentTransactions", rows: transactions, match: r => ownedOrders.has(r[1]) }
  ];
  const sheetIds = new Map((meta.sheets || []).map(s => [s.properties.title, s.properties.sheetId]));
  const requests = [];
  const counts = {};
  for (const target of targets) {
    const sheetId = sheetIds.get(target.title);
    if (sheetId === undefined) continue;
    const rowIndexes = [];
    target.rows.forEach((row, index) => { if (target.match(row)) rowIndexes.push(index + 1); });
    counts[target.title] = rowIndexes.length;
    rowIndexes.sort((a, b) => b - a).forEach(index => requests.push({
      deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: index, endIndex: index + 1 } }
    }));
  }
  if (requests.length) await sheetsRequest(env, ":batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
  return { deleted: counts, total: Object.values(counts).reduce((sum, n) => sum + n, 0) };
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

const TOPUP_PACKAGES = [50000,100000,200000,500000,1000000];
const TOPUP_RATE = 1000; // 1 VND thanh toán = 1.000 tiền trong game
const TOPUP_BONUS = {50000:5,100000:8,200000:12,500000:18,1000000:25};
function makePaymentCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let out="ME";for(let i=0;i<10;i++)out+=chars[Math.floor(Math.random()*chars.length)];return out;}
async function createTopup(env,profile,amount){
 amount=Number(amount);
 if(!TOPUP_PACKAGES.includes(amount))throw new Error("Gói nạp không hợp lệ.");
 if(!env.PAY_BANK_ACCOUNT||!env.PAY_BANK_CODE)throw new Error("Chức năng nạp tiền chưa được cấu hình đầy đủ.");
 const orderId="ME"+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,6).toUpperCase();
 const code=makePaymentCode(),now=Date.now(),expires=new Date(now+15*60*1000).toISOString();
 const creditAmount=amount*TOPUP_RATE;
 const bonusPercent=TOPUP_BONUS[amount]||0,bonusAmount=Math.floor(creditAmount*bonusPercent/100);
 const promoLabel=bonusPercent?"Ưu đãi nạp "+bonusPercent+"%":"Không có ưu đãi";
 await appendRow(env,"PaymentOrders!A:L",[orderId,profile.sub,profile.email,String(amount),code,"PENDING",new Date(now).toISOString(),expires,"",String(creditAmount),String(bonusAmount),promoLabel]);
 const qrUrl="https://vietqr.app/img?"+new URLSearchParams({acc:env.PAY_BANK_ACCOUNT,bank:env.PAY_BANK_CODE,amount:String(amount),des:code}).toString();
 return {orderId,amount,creditAmount,bonusAmount,bonusPercent,totalCredit:creditAmount+bonusAmount,promoLabel,rate:TOPUP_RATE,code,expiresAt:expires,qrUrl};
}
async function getTopupHistory(env,profile){
 const rows=await readRows(env,"PaymentOrders!A2:L");
 return rows.filter(r=>r[1]===profile.sub).slice(-30).reverse().map(r=>({orderId:r[0],amount:Number(r[3]),creditAmount:Number(r[9])||Number(r[3])*TOPUP_RATE,bonusAmount:Number(r[10])||0,promoLabel:r[11]||"",totalCredit:(Number(r[9])||Number(r[3])*TOPUP_RATE)+(Number(r[10])||0),code:r[4],status:r[5],createdAt:r[6],expiresAt:r[7]}));
}
async function handleSePayWebhook(request,env){
 if(!env.SEPAY_WEBHOOK_API_KEY)return json({success:false,error:"Webhook not configured"},503);
 if((request.headers.get("Authorization")||"")!=="Apikey "+env.SEPAY_WEBHOOK_API_KEY)return json({success:false,error:"Unauthorized"},401);
 let body;try{body=await request.json()}catch{return json({success:false,error:"Invalid JSON"},400)}
 const txId=String(body.id||""),amount=Number(body.transferAmount),direction=String(body.transferType||"").toLowerCase();
 if(!txId||!Number.isSafeInteger(amount)||amount<=0||direction!=="in")return json({success:false,error:"Invalid transaction"},400);
 if(env.PAY_BANK_ACCOUNT&&String(body.accountNumber||"")!==String(env.PAY_BANK_ACCOUNT))return json({success:false,error:"Wrong receiving account"},400);
 const searchable=(String(body.code||"")+" "+String(body.content||"")).toUpperCase();
 const orders=await readRows(env,"PaymentOrders!A2:L");
 const idx=orders.findIndex(r=>r[4]&&searchable.includes(String(r[4]).toUpperCase()));
 if(idx<0)return json({success:true,ignored:true});
 const order=orders[idx],rowNo=idx+2;
 if(order[5]==="PAID")return json({success:true,duplicate:true});
 if(order[5]!=="PENDING"||Date.now()>Date.parse(order[7]))return json({success:true,ignored:true});
 if(Number(order[3])!==amount)return json({success:false,error:"Amount mismatch"},400);
 const transactions=await readRows(env,"PaymentTransactions!A2:F");
 if(transactions.some(r=>String(r[0])===txId))return json({success:true,duplicate:true});
 const saves=await readRows(env,"GameSaves!A2:E"),saveIdx=saves.findIndex(r=>r[0]===order[1]);
 if(saveIdx<0||!saves[saveIdx][3])return json({success:false,error:"Player save not found"},500);
 let save;try{save=JSON.parse(saves[saveIdx][3])}catch{return json({success:false,error:"Invalid player save"},500)}
 const creditAmount=Number(order[9])||amount*TOPUP_RATE;
 const bonusAmount=Number(order[10])||0,totalCredit=creditAmount+bonusAmount;
 save.cash=(Number(save.cash)||0)+totalCredit;
 if(!Array.isArray(save.ledger))save.ledger=[];
 save.ledger.unshift({name:"Nạp tiền qua QR",n:totalCredit,income:true,day:Number(save.day)||1,time:"",external:true});
 if(!Array.isArray(save.journal))save.journal=[];
 save.journal.unshift("Nạp tiền thành công · +"+new Intl.NumberFormat("vi-VN").format(creditAmount)+" tiền game"+(bonusAmount?" · Thưởng ưu đãi +"+new Intl.NumberFormat("vi-VN").format(bonusAmount):""));
 save.journal=save.journal.slice(0,300);
 const now=new Date().toISOString();
 await updateRow(env,"GameSaves!A"+(saveIdx+2)+":E"+(saveIdx+2),[order[1],saves[saveIdx][1],saves[saveIdx][2],JSON.stringify(save),now]);
 await updateRow(env,"PaymentOrders!A"+rowNo+":J"+rowNo,[...order.slice(0,5),"PAID",order[6],order[7],txId,String(creditAmount),String(bonusAmount),order[11]||""]);
 await appendRow(env,"PaymentTransactions!A:F",[txId,order[0],String(amount),String(body.referenceCode||""),String(body.content||""),now]);
 await appendRow(env,"SaveHistory!A:E",[now,order[1],order[2],"TOPUP "+amount+" => "+totalCredit+" (base "+creditAmount+", bonus "+bonusAmount+"),txId]);
 return json({success:true});
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
    if(url.pathname==="/api/sepay/webhook"&&request.method==="POST")return handleSePayWebhook(request,env);
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
      if (url.pathname === "/api/account/delete-data" && request.method === "POST") {
        const result = await deleteMyData(env, profile);
        return json({ ok: true, ...result }, 200, allowed);
      }
      if (url.pathname === "/api/save" && request.method === "POST") {
        const body = await request.json();
        if (!body.save || typeof body.save !== "object" || Array.isArray(body.save)) return json({ ok: false, error: "Save không hợp lệ." }, 400, allowed);
        const result = await saveGame(env, profile, body.save);
        return json({ ok: true, ...result }, 200, allowed);
      }
      if (url.pathname === "/api/topup/create" && request.method === "POST") {
        const body = await request.json();
        const result = await createTopup(env, profile, body.amount);
        return json({ ok: true, ...result }, 200, allowed);
      }
      if (url.pathname === "/api/topup/history" && request.method === "GET") {
        const result = await getTopupHistory(env, profile);
        const current = await loadSave(env, profile);
        return json({ ok: true, orders: result, cashBalance: Number(current?.save?.cash) || 0 }, 200, allowed);
      }
      if (url.pathname === "/api/topup/status" && request.method === "GET") {
        const orderId = url.searchParams.get("orderId") || "";
        const rows = await readRows(env, "PaymentOrders!A2:L");
        const order = rows.find(r => r[0] === orderId && r[1] === profile.sub);
        if (!order) return json({ ok: false, error: "Không tìm thấy giao dịch." }, 404, allowed);
        if (order[5] === "PENDING" && Date.now() > Date.parse(order[7])) {
          const rowNo = rows.indexOf(order) + 2;
          await updateRow(env, "PaymentOrders!A" + rowNo + ":J" + rowNo, [...order.slice(0,5), "EXPIRED", ...order.slice(6)]);
          return json({ ok: true, status: "EXPIRED" }, 200, allowed);
        }
        return json({ ok: true, status: order[5], amount: Number(order[3]), creditAmount: Number(order[9]) || Number(order[3]) * TOPUP_RATE, bonusAmount: Number(order[10]) || 0, totalCredit: (Number(order[9]) || Number(order[3]) * TOPUP_RATE) + (Number(order[10]) || 0), promoLabel: order[11] || "" }, 200, allowed);
      }
      return json({ ok: false, error: "Not found" }, 404, allowed);
    } catch (error) {
      return json({ ok: false, error: error.message || "Lỗi máy chủ." }, 400, allowed);
    }
  }
};