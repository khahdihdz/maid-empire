(() => {
  const CLIENT_ID = "654545046885-qpli58rerh6d2b4t8f5bhijr10ibeu4v.apps.googleusercontent.com";
  // Set this after deploying worker/maid-empire-api.
  const API_BASE = (window.MAID_EMPIRE_API_URL || "").replace(/\/+$/, "");
  let idToken = "";
  let profile = null;
  let cloudReady = false;
  let lastSerialized = "";
  let syncTimer = 0;
  let syncing = false;
  const $ = id => document.getElementById(id);
  const status = message => {
    ["googleSyncStatus", "googleStartStatus"].forEach(id => { const el = $(id); if (el) el.textContent = message; });
  };
  const showAccount = () => {
    const label = profile ? "Đã đăng nhập: " + (profile.name || profile.email) : "Chưa đăng nhập Google";
    ["googleAccount", "googleStartAccount"].forEach(id => { const el = $(id); if (el) el.textContent = label; });
    ["googleLogout", "googleStartLogout"].forEach(id => { const el = $(id); if (el) el.hidden = !profile; });
    ["googleLoginGame", "googleLoginStart"].forEach(id => { const el = $(id); if (el) el.hidden = !!profile; });
    ["startContinue", "startNew"].forEach(id => {
      const el = $(id);
      if (el) {
        el.disabled = !profile || !cloudReady;
        el.setAttribute("aria-disabled", String(!profile));
      }
    });
    const gate = $("googleRequiredNotice");
    if (gate) gate.textContent = profile
      ? "Đã xác thực tài khoản. Bạn có thể bắt đầu hoặc tiếp tục trò chơi."
      : "BẮT BUỘC ĐĂNG NHẬP GOOGLE ĐỂ VÀO TRÒ CHƠI";
  };
  const decodePayload = token => {
    try { return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); }
    catch { return {}; }
  };
  async function api(path, method = "GET", body) {
    if (!API_BASE) throw new Error("Chưa cấu hình địa chỉ Cloudflare Worker.");
    const response = await fetch(API_BASE + path, {
      method,
      headers: { authorization: "Bearer " + idToken, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) throw new Error(result.error || "Máy chủ lưu game phản hồi lỗi " + response.status);
    return result;
  }
  async function uploadCloud() {
    if (!window.maidEmpire?.state) throw new Error("Game chưa sẵn sàng.");
    const save = window.maidEmpire.state();
    const result = await api("/api/save", "POST", { save });
    lastSerialized = JSON.stringify(save);
    status("Đã lưu tiến trình lên Google Sheet · " + new Date(result.updatedAt).toLocaleString("vi-VN"));
  }
  async function syncOnLogin() {
    cloudReady = false;
    showAccount();
    if (!API_BASE) throw new Error("Chưa cấu hình Cloudflare Worker. Không thể vào chơi khi chưa bật lưu đám mây.");
    status("Đang xác thực máy chủ và tải tiến trình Google Sheet…");
    const cloud = await api("/api/load");
    if (cloud.save) {
      window.maidEmpire.load(cloud.save);
      lastSerialized = JSON.stringify(cloud.save);
      status("Đã tải tiến trình từ Google Sheet.");
    } else {
      window.maidEmpire.reset();
      await uploadCloud();
      status("Đã tạo tiến trình mới và lưu trên Google Sheet.");
    }
    cloudReady = true;
    showAccount();
  }
  async function syncNow() {
    if (!idToken || !cloudReady || !API_BASE || syncing) return;
    const raw = JSON.stringify(window.maidEmpire?.state?.() || null);
    if (!raw || raw === lastSerialized) return;
    syncing = true;
    try { await uploadCloud(); }
    catch (error) { status("Lưu đám mây chưa thành công: " + error.message); }
    finally { syncing = false; }
  }
  function scheduleSync(immediate = false) {
    if (!idToken || !cloudReady || !API_BASE) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, immediate ? 300 : 5000);
  }
  function onCredential(response) {
    idToken = response.credential || "";
    const data = decodePayload(idToken);
    profile = { name: data.name || data.given_name || "Người chơi", email: data.email || "" };
    cloudReady = false;
    showAccount();
    status("Đã xác thực Google. Đang tải tiến trình từ máy chủ…");
    syncOnLogin().catch(error => { cloudReady = false; showAccount(); status("Chưa thể vào chơi: " + error.message); });
  }
  function initGoogle() {
    if (!window.google?.accounts?.id) return false;
    window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential, auto_select: false });
    ["googleLoginGame", "googleLoginStart"].forEach(id => {
      const target = $(id);
      if (target) window.google.accounts.id.renderButton(target, { type: "standard", theme: "filled_black", size: "large", text: "signin_with", shape: "pill", locale: "vi", width: 250 });
    });
    return true;
  }
  function signOut() {
    idToken = "";
    profile = null;
    cloudReady = false;
    lastSerialized = "";
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    showAccount();
    const menu = $("startMenu");
    if (menu) menu.hidden = false;
    // Signing out locks the session; progress remains only in the cloud account.
    if (typeof clockPaused !== "undefined") clockPaused = true;
    if (typeof updateClock === "function") updateClock();
    status("Đã đăng xuất. Bạn cần đăng nhập Google lại để tiếp tục chơi.");
  }
  document.addEventListener("click", event => {
    const target = event.target;
    if (!target || !target.closest) return;
    if (target.closest("#googleLogout, #googleStartLogout")) { signOut(); return; }
    if (target.closest("#startContinue, #startNew") && !idToken) {
      event.preventDefault();
      event.stopImmediatePropagation();
      status("Bạn phải đăng nhập Google trước khi bắt đầu hoặc tiếp tục trò chơi.");
      return;
    }
    if (target.closest("#menuSave, #save")) scheduleSync(true);
  });
  window.addEventListener("maid-empire-refresh", () => scheduleSync(false));
  window.addEventListener("maid-empire-save", () => scheduleSync(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") scheduleSync(true); });
  showAccount();
  let attempts = 0;
  const wait = setInterval(() => {
    attempts++;
    if (initGoogle() || attempts > 40) clearInterval(wait);
  }, 250);
  if (!API_BASE) status("Chưa cấu hình máy chủ lưu đám mây. Bạn sẽ chưa thể vào chơi.");
  const requiredNotice = $("googleRequiredNotice");
  if (requiredNotice) requiredNotice.textContent = "BẮT BUỘC ĐĂNG NHẬP GOOGLE ĐỂ VÀO TRÒ CHƠI";
  window.maidEmpireCloud = { signOut, syncNow, configured: !!API_BASE, get ready() { return cloudReady; } };
})();