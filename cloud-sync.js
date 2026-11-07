(() => {
  const CLIENT_ID = "654545046885-qpli58rerh6d2b4t8f5bhijr10ibeu4v.apps.googleusercontent.com";
  // Set this after deploying worker/maid-empire-api.
  const API_BASE = (window.MAID_EMPIRE_API_URL || "").replace(/\/+$/, "");
  let idToken = "";
  let profile = null;
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
  async function uploadLocal() {
    const raw = localStorage.getItem("maidEmpireSave");
    if (!raw) throw new Error("Thiết bị chưa có tiến trình để lưu.");
    const result = await api("/api/save", "POST", { save: JSON.parse(raw) });
    lastSerialized = raw;
    status("Đã đồng bộ lên Google Sheet · " + new Date(result.updatedAt).toLocaleString("vi-VN"));
  }
  async function syncOnLogin() {
    if (!API_BASE) {
      status("Đã đăng nhập Google. Worker chưa được triển khai/cấu hình nên chưa thể đồng bộ Sheet.");
      return;
    }
    status("Đang kiểm tra tiến trình trên Google Sheet…");
    const cloud = await api("/api/load");
    if (cloud.save) {
      const stamp = cloud.updatedAt ? new Date(cloud.updatedAt).toLocaleString("vi-VN") : "không rõ thời điểm";
      if (confirm("Tìm thấy tiến trình Google Sheet cập nhật lúc " + stamp + ". Bạn muốn tải tiến trình này về thiết bị?")) {
        localStorage.setItem("maidEmpireSave", JSON.stringify(cloud.save));
        lastSerialized = JSON.stringify(cloud.save);
        status("Đã tải tiến trình. Đang khởi động lại game…");
        location.reload();
        return;
      }
      status("Giữ tiến trình trên thiết bị. Dữ liệu Google Sheet chưa bị ghi đè.");
      return;
    }
    status("Chưa có save trên Sheet. Đang sao lưu tiến trình hiện tại…");
    await uploadLocal();
  }
  async function syncNow() {
    if (!idToken || !API_BASE || syncing) return;
    const raw = localStorage.getItem("maidEmpireSave");
    if (!raw || raw === lastSerialized) return;
    syncing = true;
    try { await uploadLocal(); }
    catch (error) { status("Lưu đám mây chưa thành công: " + error.message); }
    finally { syncing = false; }
  }
  function scheduleSync(immediate = false) {
    if (!idToken || !API_BASE) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncNow, immediate ? 300 : 12000);
  }
  function onCredential(response) {
    idToken = response.credential || "";
    const data = decodePayload(idToken);
    profile = { name: data.name || data.given_name || "Người chơi", email: data.email || "" };
    showAccount();
    status("Đã xác thực Google. Đang kết nối dịch vụ lưu game…");
    syncOnLogin().catch(error => status("Đăng nhập thành công nhưng đồng bộ lỗi: " + error.message));
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
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    showAccount();
    status("Đã đăng xuất Google. Save cục bộ vẫn được giữ nguyên.");
  }
  document.addEventListener("click", event => {
    const target = event.target;
    if (target.closest("#googleLogout, #googleStartLogout")) { signOut(); return; }
    if (target.closest("#menuSave, #save")) scheduleSync(true);
    if (target.closest("#startNew")) setTimeout(() => { lastSerialized = ""; scheduleSync(true); }, 500);
  });
  window.addEventListener("maid-empire-refresh", () => scheduleSync(false));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") scheduleSync(true); });
  showAccount();
  let attempts = 0;
  const wait = setInterval(() => {
    attempts++;
    if (initGoogle() || attempts > 40) clearInterval(wait);
  }, 250);
  if (!API_BASE) status("Đăng nhập Google sẵn sàng. Cần triển khai Worker để bật lưu Google Sheet.");
  window.maidEmpireCloud = { signOut, syncNow, configured: !!API_BASE };
})();