/**
 * ==============================================================================
 * QUẢN LÝ ĐƯỜNG DẪN ĐA PHƯƠNG TIỆN (MEDIA) LK17
 * ==============================================================================
 * Nơi DUY NHẤT sinh các URL hình ảnh và video của toàn bộ dự án.
 * Tuân thủ nguyên tắc suy thoái an toàn: nếu Google đổi đường dẫn, chỉ sửa file này.
 */

window.KY_MEDIA = {
  /**
   * Sinh URL thumbnail từ Google Drive
   */
  thumbUrl: function(id, w) {
    if (!id) return "";
    return "https://drive.google.com/thumbnail?id=" + id + "&sz=w" + (w || window.KY_CONFIG.GRID_WIDTH);
  },

  /**
   * URL dự phòng (lớp thứ 2) qua Google UserContent
   */
  altUrl: function(id, w) {
    if (!id) return "";
    return "https://lh3.googleusercontent.com/d/" + id + "=w" + (w || window.KY_CONFIG.GRID_WIDTH);
  },

  /**
   * Khung nhúng phát video trực tiếp trên web
   */
  videoEmbed: function(id) {
    if (!id) return "";
    return "https://drive.google.com/file/d/" + id + "/preview";
  },

  /**
   * Đường dẫn mở video trực tiếp trên Google Drive
   */
  videoOpen: function(id) {
    if (!id) return "";
    return "https://drive.google.com/file/d/" + id + "/view";
  },

  /**
   * Xử lý lỗi tải ảnh theo 2 bậc an toàn:
   * Lỗi lần 1: Đổi sang altUrl
   * Lỗi lần 2: Đánh dấu ảnh hỏng, hiển thị ô xám biểu tượng
   */
  handleImgError: function(img, id, w) {
    if (!img.dataset.altTried) {
      img.dataset.altTried = "true";
      img.src = window.KY_MEDIA.altUrl(id, w);
    } else {
      img.onerror = null;
      img.classList.add("img-broken");
      if (img.parentElement) {
        img.parentElement.classList.add("has-broken-img");
      }
    }
  }
};
