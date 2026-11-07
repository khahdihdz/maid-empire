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
