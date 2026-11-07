# MAID EMPIRE: THE DARK BUSINESS

**MAID EMPIRE: THE DARK BUSINESS** là game mô phỏng quản lý đế chế giải trí cao cấp trong một thế giới ngầm hoàn toàn hư cấu. Người chơi vào vai nhà điều hành, bắt đầu với nguồn vốn ban đầu và từng bước xây dựng thương hiệu, tuyển dụng – phát triển đội ngũ, nhận cơ hội hợp tác, vận hành chương trình, mở rộng cơ sở và kiểm soát tài chính. Đằng sau những hợp đồng giá trị là cạnh tranh quyền lực, giao dịch bí mật, tai tiếng, vi phạm và áp lực điều tra ngày càng tăng. Mỗi quyết định đều tác động đến dòng tiền, danh tiếng và tương lai của đế chế.

Trò chơi dành cho người từ **18 tuổi trở lên**. Tất cả nhân vật đều là người trưởng thành và các hoạt động nhạy cảm/phi pháp chỉ được mô phỏng bằng chỉ số, lựa chọn và hệ quả chiến lược; không có mô tả tình dục trực diện hay hướng dẫn phạm tội ngoài đời.

## Công nghệ
- HTML5, CSS3, Vanilla JavaScript; không framework, không asset ngoài.
- PWA với Web App Manifest và Service Worker.
- Bắt buộc đăng nhập Google; tiến trình chỉ lưu trên Google Sheets qua Cloudflare Worker, không lưu LocalStorage/IndexedDB.
- Responsive cho Web và Android.

## Chạy local
Mở `index.html` hoặc chạy `python3 -m http.server 8080`, sau đó truy cập localhost:8080. PWA yêu cầu HTTPS hoặc localhost.

## Gameplay
Dashboard điều hành; tuyển dụng nhân vật 18+ với hồ sơ, kỹ năng, tâm trạng, lòng trung thành và lương; đào tạo và thưởng; cơ hội hợp tác có thời hạn chạy theo đồng hồ game; hợp đồng và tiến trình thực hiện; chương trình giải trí người trưởng thành; mạng lưới ngầm với rủi ro, vi phạm và áp lực điều tra; nâng cấp cơ sở; sổ cái tài chính, nhật ký sự kiện và chu kỳ ngày tự động. Chiến dịch cốt truyện 4 chương có lựa chọn phân nhánh, hệ quả tài chính/danh tiếng/điều tra và nhiều kết cục. Có tính năng nạp tiền trong game qua QR với các gói 50.000–1.000.000 VND, tỷ lệ quy đổi 1:1.000 (ví dụ 50.000 VND nhận 50.000.000 VND tiền game); tính năng này chỉ hoạt động sau khi cấu hình và kiểm thử hệ thống thanh toán.

## Cài đặt PWA

- **Android (Chrome):** mở trang GitHub Pages, nhấn **CÀI ĐẶT ỨNG DỤNG** trong game và xác nhận. Nếu không xuất hiện lời nhắc, mở menu ⋮ → **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính**.
- **iPhone/iPad (Safari):** nhấn Chia sẻ → **Thêm vào màn hình chính** → **Thêm**.
- **Máy tính (Chrome/Edge):** dùng biểu tượng cài đặt trên thanh địa chỉ hoặc menu trình duyệt → **Install MAID EMPIRE**.
- PWA cần HTTPS hoặc localhost. Sau khi cài, ứng dụng mở ở chế độ độc lập; Service Worker chỉ lưu tài nguyên giao diện; để chơi và lưu tiến trình bắt buộc phải có mạng, đăng nhập Google và kết nối Cloudflare Worker. Tiến trình game không lưu trên thiết bị; người chơi phải đăng nhập Google và kết nối Cloudflare Worker để tải/lưu tiến trình.

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

Worker tự tạo các tab \`Players\`, \`GameSaves\`, \`SaveHistory\` và tiêu đề cột khi có người dùng đăng nhập lần đầu. Mỗi save được định danh bằng Google account \`sub\`, không dùng email làm khóa. Không có chế độ lưu cục bộ hoặc chơi ngoại tuyến. Người chơi chỉ được vào game sau khi đăng nhập Google và Worker tải/tạo tiến trình thành công.

### API
- \`GET /health\`: kiểm tra Worker.
- \`GET /api/load\`: đọc save của tài khoản Google đang đăng nhập.
- \`POST /api/save\`: ghi save và lịch sử đồng bộ.


## Nạp tiền qua QR VietQR / SePay

Giao diện có các gói nạp cố định 50.000 / 100.000 / 200.000 / 500.000 / 1.000.000 VND. Tỷ lệ quy đổi là **1:1.000**: mỗi 1 VND thanh toán được cộng 1.000 VND tiền game. Ví dụ gói 50.000 VND nhận 50.000.000 VND tiền game. Mỗi yêu cầu có mã chuyển khoản riêng, QR điền sẵn số tiền thật cần chuyển và nội dung. Backend chỉ cộng tiền game theo tỷ lệ 1:1.000 khi nhận webhook tiền vào đúng tài khoản, đúng mã và đúng số tiền.

### Cấu hình trước khi bật nhận tiền thật

Worker cần các biến:
- `PAY_BANK_ACCOUNT`: số tài khoản nhận tiền.
- `PAY_BANK_CODE`: mã ngân hàng theo chuẩn VietQR (ví dụ VCB, MB, TCB...).
- `PAY_BANK_NAME`: tên ngân hàng (chỉ dùng cho quản trị nếu cần).

Worker Secret:
- `SEPAY_WEBHOOK_API_KEY`: API Key dùng xác thực webhook; không đưa vào mã nguồn hoặc frontend.

Tạo webhook trong SePay: URL `https://maid-empire-api.khahdihdz.workers.dev/api/sepay/webhook`, sự kiện chỉ tiền vào, định dạng JSON, xác thực API Key. Header SePay gửi phải là `Authorization: Apikey <API_KEY>`. Sau khi cấu hình, kiểm tra bằng giao dịch thử trước khi mở cho người chơi.

API dành cho phiên Google đã xác thực: `POST /api/topup/create`, `GET /api/topup/status`, `GET /api/topup/history`. Endpoint webhook nhận callback SePay không yêu cầu Google login nhưng bắt buộc API Key.

**Lưu ý an toàn:** phiên bản hiện tại ghi đơn nạp, giao dịch và save vào Google Sheets. Sheets không có giao dịch nguyên tử hoặc ràng buộc UNIQUE; vì vậy không nên mở nạp tiền thật quy mô lớn trước khi chuyển sổ cái thanh toán sang Cloudflare D1 (unique transaction ID + atomic update) và kiểm thử webhook đồng thời/retry. Không nhập API Key hay khóa bí mật vào chat hoặc commit Git.
