# 📸 LK17 — HỆ THỐNG LƯU TRỮ HÌNH ẢNH & SỰ KIỆN 3 NĂM CẤP 3
**THPT Chuyên Nguyễn Quang Diêu · Niên khóa 2024 – 2027**  
🌐 Trang web chính thức: [https://nqd-lk17.github.io](https://nqd-lk17.github.io)

---

## 📖 SỔ TAY VẬN HÀNH & BẢO TRÌ 6 NĂM

Tài liệu hướng dẫn vận hành cho Ban quản trị lớp. Hệ thống hoạt động hoàn toàn tự động, chi phí 0đ, lưu trữ ảnh/video trực tiếp trên Google Drive và triển khai tĩnh trên GitHub Pages.

---

### 1. Thêm ảnh và video mới trong năm học
1. Đăng nhập tài khoản Google của lớp, mở Google Drive vào thư mục lưu trữ `NQD-LK17-backup`.
2. Tạo thư mục sự kiện mới theo định dạng:
   - `YYYY-MM-DD_Tên sự kiện` (ví dụ: `2026-11-20_Tri ân Nhà giáo 20-11`)
   - Hoặc `DD-MM-YYYY_Tên sự kiện` (ví dụ: `20-11-2026_Tri ân Nhà giáo 20-11`)
3. Tải toàn bộ ảnh và video trực tiếp vào thư mục sự kiện đó (không chia thêm thư mục con).
4. Nếu muốn chọn ảnh bìa riêng, hãy đặt tên file ảnh đó bắt đầu bằng chữ `cover` (ví dụ: `cover.jpg`).
5. **Cập nhật dữ liệu:**
   - Hệ thống có Trigger tự động quét và cập nhật mỗi 6 giờ.
   - Nếu muốn web cập nhật ngay: Mở dự án `LK17-Media-API` trên `script.google.com`, chọn hàm `buildManifest` và bấm **Chạy (Run)**.
   - Định kỳ mỗi tháng: Tải file `manifest.json` trong thư mục `_SYSTEM` trên Drive về và đưa lên GitHub đè vào `data/manifest.json`.

---

### 2. Chốt sổ sau khi ra trường (Làm 1 lần duy nhất)
1. Mở file `_SYSTEM/report.txt` trên Drive, đảm bảo không còn file nào báo *"không thuộc sở hữu tài khoản lớp"*.
2. Chạy hàm `buildManifest` lần cuối để xuất dữ liệu trọn vẹn 3 năm.
3. Tải file `_SYSTEM/manifest.json` về và đưa lên GitHub đè vào file `data/manifest.json`.
4. Trong file `js/config.js`, đổi `LIVE_MANIFEST: false`. Tăng số phiên bản `?v=` trong `index.html` (ví dụ `?v=2`).
5. Mở Apps Script, chọn hàm `removeTrigger` và bấm **Chạy (Run)** để tắt trigger quét định kỳ. *(Giữ nguyên Web App Deployment để nút tải ảnh tiếp tục hoạt động).*
6. Dùng **Google Takeout** tải toàn bộ thư mục Drive về lưu vào 1–2 ổ cứng ngoài dự phòng.

---

### 3. Kiểm tra định kỳ mỗi 6 tháng
- [ ] Đăng nhập vào tài khoản Google của lớp (để Google không xóa tài khoản vì không hoạt động).
- [ ] Mở trang web [https://nqd-lk17.github.io](https://nqd-lk17.github.io), xem một sự kiện và tải thử 1 ảnh.
- [ ] Mở đường link API Web App kèm đuôi `?action=ping`, kiểm tra kết quả trả về có `"ok": true`.
- [ ] Kiểm tra dung lượng và hạn gói Google One nếu dung lượng ảnh vượt 15GB.

---

### 4. Hướng dẫn xử lý sự cố

| Hiện tượng | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **Ảnh trong lưới không hiển thị** | Google thay đổi cấu trúc link thumbnail | Chỉ cần mở file `js/media.js`, cập nhật lại hàm `thumbUrl` là web tự động chạy lại bình thường. |
| **Nút "Tải ảnh" báo lỗi** | Apps Script Web App gặp trục trặc | Kiểm tra link `?action=ping`. Nếu lỗi, vào `script.google.com` ➔ Triển khai ➔ Quản lý bản triển khai ➔ Chỉnh sửa ➔ Chọn **Phiên bản mới (New version)** và Lưu. *(Trong lúc đó, người dùng vẫn xem và lưu ảnh bình thường bằng cách nhấn giữ ảnh 1 giây).* |
| **Mất tài khoản Google Drive** | Sự cố bất khả kháng | Dùng bản sao lưu ngoài tải lên dịch vụ lưu trữ mới. Cập nhật lại đường dẫn trong `media.js` và `manifest.json`. URL web và mã QR in trên áo vẫn giữ nguyên vĩnh viễn! |

---

### ⚠️ 3 ĐIỀU CẤM TRONG SUỐT 6 NĂM
1. ❌ **Không đổi tên GitHub Organization** `nqd-lk17`.
2. ❌ **Không xóa hay đổi tên repository** `nqd-lk17.github.io`.
3. ❌ **Không xóa hoặc để mất tài khoản Google lớp**.
