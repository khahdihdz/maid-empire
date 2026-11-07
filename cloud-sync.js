(() => {
  const CLIENT_ID = "654545046885-qpli58rerh6d2b4t8f5bhijr10ibeu4v.apps.googleusercontent.com";
  // Set this after deploying worker/maid-empire-api.
  const API_BASE = (window.MAID_EMPIRE_API_URL || "https://maid-empire-api.khahdihdz.workers.dev").replace(/\/+$/, "");
  let idToken = "";
  let profile = null;
  const SESSION_KEY = "maidEmpireGoogleSession";
  let cloudReady = false;
  let lastSerialized = "";
  let syncTimer = 0;
  let syncing = false;
  const $ = id => document.getElementById(id);
  const status = message => {
    ["googleSyncStatus", "googleStartStatus"].forEach(id => { const el = $(id); if (el) el.textContent = message; });
  };
  const showAccount = () => {
    const label = profile ? "Đã đăng nhập: " + (profile.name || profile.email) : "Chưa kết nối tài khoản Google";
    ["googleAccount", "googleStartAccount"].forEach(id => { const el = $(id); if (el) el.textContent = label; });
    ["googleLogout", "googleStartLogout"].forEach(id => { const el = $(id); if (el) el.hidden = !profile; });
    ["googleLoginGame", "googleLoginStart"].forEach(id => { const el = $(id); if (el) el.hidden = !!profile; });
    ["startContinue", "startNew"].forEach(id => {
      const el = $(id);
      if (el) {
        el.disabled = !profile || !cloudReady;
        el.setAttribute("aria-disabled", String(!profile || !cloudReady));
      }
    });
    const gate = $("googleRequiredNotice");
    if (gate) gate.textContent = !profile
      ? "Vui lòng đăng nhập Google để bắt đầu hoặc tiếp tục. Tiến trình của bạn sẽ được đồng bộ tự động."
      : cloudReady ? "Đã kết nối và tải tiến trình thành công. Bạn có thể vào chơi." : "Đang xác thực tài khoản và đồng bộ dữ liệu trò chơi…";
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
    status("Đã lưu tiến trình · " + new Date(result.updatedAt).toLocaleString("vi-VN"));
  }
  async function syncOnLogin() {
    cloudReady = false;
    showAccount();
    if (!API_BASE) throw new Error("Không thể kết nối dịch vụ đồng bộ. Vui lòng thử lại sau.");
    status("Đang xác thực và tải tiến trình…");
    const cloud = await api("/api/load");
    if (cloud.save) {
      window.maidEmpire.load(cloud.save);
      lastSerialized = JSON.stringify(cloud.save);
      status("Đã tải tiến trình thành công.");
    } else {
      window.maidEmpire.reset();
      await uploadCloud();
      status("Đã tạo tiến trình mới thành công.");
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
    catch (error) { status("Chưa thể lưu tiến trình: " + error.message); }
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
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: idToken, profile: { name: data.name || data.given_name || "Người chơi", email: data.email || "" } })); } catch {}
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
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    cloudReady = false;
    lastSerialized = "";
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    showAccount();
    const menu = $("startMenu");
    if (menu) menu.hidden = false;
    // Signing out locks the session; progress remains only in the cloud account.
    if (typeof clockPaused !== "undefined") clockPaused = true;
    if (typeof updateClock === "function") updateClock();
    status("Đã đăng xuất. Đăng nhập lại để tiếp tục trò chơi.");
  }
  document.addEventListener("click", event => {
    const target = event.target;
    if (!target || !target.closest) return;
    if (target.closest("#googleLogout, #googleStartLogout")) { signOut(); return; }
    if (target.closest("#startContinue, #startNew") && !idToken) {
      event.preventDefault();
      event.stopImmediatePropagation();
      status("Hãy đăng nhập Google và chờ tải tiến trình hoàn tất trước khi vào trò chơi.");
      return;
    }
    if (target.closest("#menuSave, #save")) scheduleSync(true);
  });
  window.addEventListener("maid-empire-refresh", () => scheduleSync(false));
  window.addEventListener("maid-empire-save", () => scheduleSync(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") scheduleSync(true); });
  async function restoreSession() {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch {}
    if (!saved?.token) { showAccount(); return; }
    const claims = decodePayload(saved.token);
    if (!claims.exp || Number(claims.exp) * 1000 <= Date.now() + 30000) {
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
      showAccount();
      status("Phiên đăng nhập Google đã hết hạn. Vui lòng đăng nhập lại để tải tiến trình.");
      return;
    }
    idToken = saved.token;
    profile = saved.profile || { name: claims.name || claims.email || "Người chơi", email: claims.email || "" };
    cloudReady = false;
    showAccount();
    status("Đang khôi phục phiên Google và tải tiến trình…");
    try {
      await syncOnLogin();
    } catch (error) {
      idToken = "";
      profile = null;
      cloudReady = false;
      try { sessionStorage.removeItem(SESSION_KEY); } catch {}
      showAccount();
      status("Phiên đăng nhập cần xác thực lại: " + error.message);
    }
  }
  showAccount();
  restoreSession();
  let attempts = 0;
  const wait = setInterval(() => {
    attempts++;
    if (initGoogle() || attempts > 40) clearInterval(wait);
  }, 250);
  if (!API_BASE) status("Dịch vụ đồng bộ chưa sẵn sàng. Vui lòng thử lại sau.");
  const requiredNotice = $("googleRequiredNotice");
  if (requiredNotice) requiredNotice.textContent = "BẮT BUỘC ĐĂNG NHẬP GOOGLE ĐỂ VÀO TRÒ CHƠI";
  window.maidEmpireCloud = { signOut, syncNow, request: api, configured: !!API_BASE, get ready() { return cloudReady; }, get profile() { return profile; } };
})();