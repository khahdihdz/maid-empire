# MAID EMPIRE: THE DARK BUSINESS

Game mô phỏng quản lý đế chế dịch vụ giải trí cao cấp trong thế giới ngầm hư cấu. Tất cả nhân vật đều từ 18 tuổi. Nội dung tập trung vào chiến lược kinh doanh, nhân sự, hợp đồng, quyền lực và hệ quả; không có mô tả tình dục tường minh.

## Công nghệ
- HTML5, CSS3, Vanilla JavaScript; không framework, không asset ngoài.
- PWA với Web App Manifest và Service Worker.
- Lưu tiến trình cục bộ bằng LocalStorage.
- Responsive cho Web và Android.

## Chạy local
Mở `index.html` hoặc chạy `python3 -m http.server 8080`, sau đó truy cập localhost:8080. PWA yêu cầu HTTPS hoặc localhost.

## Gameplay
Dashboard; tuyển dụng nhân vật 18+; hồ sơ nhân sự chi tiết; đào tạo và thưởng; nhận hợp đồng, phân công và hoàn tất; mạng lưới ngầm với rủi ro trừu tượng; nâng cấp cơ sở; sổ cái tài chính; chu kỳ ngày và nhật ký. Bản mở rộng bổ sung chiến dịch cốt truyện 4 chương với lựa chọn phân nhánh, hệ quả tài chính/danh tiếng/điều tra và nhiều kết cục. Tiến trình chiến dịch được lưu riêng trong LocalStorage.

## Cài đặt PWA

- **Android (Chrome):** mở trang GitHub Pages, nhấn **CÀI ĐẶT ỨNG DỤNG** trong game và xác nhận. Nếu không xuất hiện lời nhắc, mở menu ⋮ → **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính**.
- **iPhone/iPad (Safari):** nhấn Chia sẻ → **Thêm vào màn hình chính** → **Thêm**.
- **Máy tính (Chrome/Edge):** dùng biểu tượng cài đặt trên thanh địa chỉ hoặc menu trình duyệt → **Install MAID EMPIRE**.
- PWA cần HTTPS hoặc localhost. Sau khi cài, ứng dụng mở ở chế độ độc lập; Service Worker lưu tài nguyên tĩnh để hỗ trợ truy cập ngoại tuyến. Tiến trình game được lưu riêng trên thiết bị bằng LocalStorage.

Biểu tượng ứng dụng: `icon.svg`. Tên ứng dụng, màu giao diện, phạm vi và chế độ hiển thị được khai báo trong `manifest.webmanifest`.

## GitHub Pages
Settings → Pages → Source: GitHub Actions. Workflow kiểm tra JavaScript/manifest và deploy nội dung tĩnh.

Các hoạt động phi pháp chỉ là cơ chế chiến lược hư cấu, không phải hướng dẫn ngoài đời. Không có cơ chế cưỡng ép, mua bán người hoặc bóc lột; nhân sự có quyền từ chối và nghỉ việc.


## Đăng nhập Google và lưu tiến trình lên Google Sheets

Bản tích hợp dùng Google Identity Services ở giao diện, Cloudflare Worker để xác thực ID token và Google Sheets API bằng Service Account. Khóa riêng tư của Service Account chỉ nằm trong Cloudflare Worker Secrets; không đưa vào GitHub.

### Chuẩn bị Google Cloud
1. Bật **Google Sheets API** trong cùng dự án Google Cloud.
2. Tạo Service Account, tạo khóa JSON và giữ file an toàn.
3. Chia sẻ bảng tính có ID \`10vCDKjK-ZHOIK5wMMZ-0Nq4Pf30wxoaqGMlI64mbLCU\` cho email Service Account với quyền **Editor**.
4. OAuth Client ID đã cấu hình trong \`cloud-sync.js\`. Trong Google Auth Platform, thêm origin \`https://khahdihdz.github.io\`.

### Triển khai Cloudflare Worker
1. Tạo Worker tên \`maid-empire-api\`, dùng mã trong \`worker/index.js\` (hoặc deploy từ thư mục này bằng Wrangler).
2. Đặt biến môi trường:
   - \`GOOGLE_CLIENT_ID\`: OAuth Client ID của MAID EMPIRE.
   - \`SPREADSHEET_ID\`: \`10vCDKjK-ZHOIK5wMMZ-0Nq4Pf30wxoaqGMlI64mbLCU\`.
   - \`ALLOWED_ORIGIN\`: \`https://khahdihdz.github.io\`.
3. Đặt hai Worker Secrets:
   - \`GOOGLE_SERVICE_ACCOUNT_EMAIL\`: email Service Account.
   - \`GOOGLE_PRIVATE_KEY\`: giá trị \`private_key\` trong file JSON; giữ nguyên PEM hoặc dùng chuỗi có \`\\n\`.
4. Sau khi Worker hoạt động, đặt URL Worker vào \`MAID_EMPIRE_API_URL\` trong đầu file \`cloud-sync.js\` (ví dụ URL workers.dev được Cloudflare cấp), rồi commit lại.

Worker tự tạo các tab \`Players\`, \`GameSaves\`, \`SaveHistory\` và tiêu đề cột khi có người dùng đăng nhập lần đầu. Mỗi save được định danh bằng Google account \`sub\`, không dùng email làm khóa. Game vẫn lưu LocalStorage khi chưa đăng nhập hoặc Worker chưa cấu hình.

### API
- \`GET /health\`: kiểm tra Worker.
- \`GET /api/load\`: đọc save của tài khoản Google đang đăng nhập.
- \`POST /api/save\`: ghi save và lịch sử đồng bộ.
