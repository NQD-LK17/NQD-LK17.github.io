/**
 * ==============================================================================
 * CẤU HÌNH HỆ THỐNG LƯU TRỮ HÌNH ẢNH & SỰ KIỆN LK17
 * ==============================================================================
 * File này chứa toàn bộ các hằng số cấu hình của ứng dụng web.
 */

window.KY_CONFIG = {
  // Đường dẫn Web App Apps Script (để trống "" nếu muốn tắt tính năng tải qua API)
  API_URL: "https://script.google.com/macros/s/AKfycbxn1yUIcnE4nj6wREc0xp3O-aSwJlUxrJP3HZQ2RyMeFxITAwcskjnojrP2iaZCqALl/exec",
  
  // Tự động kiểm tra bản cập nhật mới nhất từ Apps Script ngầm khi mở web
  // Đặt false sau khi chốt sổ 3 năm cấp 3
  LIVE_MANIFEST: true,
  
  // Số lượng ảnh hiển thị mỗi đợt khi cuộn trang
  BATCH_SIZE: 24,
  
  // Chiều rộng ảnh tải trong lưới (thumbnails)
  GRID_WIDTH: 360,
  
  // Chiều rộng ảnh lớn khi mở xem chi tiết (lightbox)
  LARGE_WIDTH: 2048,
  
  // Chiều rộng ảnh bìa sự kiện tại trang chủ
  COVER_WIDTH: 640
};
