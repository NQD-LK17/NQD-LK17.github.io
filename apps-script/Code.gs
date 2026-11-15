/**
 * ==============================================================================
 * HỆ THỐNG LƯU TRỮ HÌNH ẢNH & SỰ KIỆN LK17 (3 NĂM CẤP 3) — BACKEND APPS SCRIPT
 * ==============================================================================
 * Vai trò: 
 *   - Quét thư mục Google Drive của lớp để tạo manifest.json và report.txt
 *   - Cung cấp API Web App (doGet) phục vụ manifest và luồng tải ảnh an toàn
 *   - Tự động chạy định kỳ mỗi 6 giờ qua Trigger
 * 
 * Yêu cầu:
 *   - Google Apps Script Standalone trong tài khoản lớp
 *   - Đã bật Advanced Service: Drive API v3 (Resources/Services -> Drive API v3)
 *   - Deploy Web app: Execute as: Me, Who has access: Anyone
 * ==============================================================================
 */

// --- CÁC HẰNG SỐ CẤU HÌNH HỆ THỐNG ---
const ROOT_FOLDER_ID = "1itrEy4aHXXmybt_SlQ3j7zy6VIrZuua6"; // ID thư mục NQD-LK17-backup
const SYSTEM_FOLDER_NAME = "_SYSTEM";
const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024; // 10MB
const API_VERSION = "1";
const SITE_TITLE = "LK17 — Lưu Trữ Sự Kiện & Hình Ảnh";
const SITE_SUBTITLE = "Kho lưu trữ hình ảnh & video 3 năm cấp 3 · THPT Chuyên Nguyễn Quang Diêu";

/**
 * 1. HÀM CHÍNH: buildManifest()
 * Quét toàn bộ các thư mục sự kiện trong ROOT_FOLDER_ID, tạo manifest.json và report.txt vào _SYSTEM.
 */
function buildManifest() {
  const startTime = new Date();
  const warnings = [];
  const events = [];
  let totalPhotos = 0;
  let totalVideos = 0;

  // Lấy hoặc tạo thư mục _SYSTEM
  const systemFolderId = getOrCreateSystemFolder(ROOT_FOLDER_ID);

  // Liệt kê các thư mục con trực tiếp trong ROOT_FOLDER_ID
  let childFolders = [];
  let pageToken = null;
  do {
    const res = Drive.Files.list({
      q: `'${ROOT_FOLDER_ID}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
      pageSize: 1000,
      pageToken: pageToken,
      fields: "nextPageToken, files(id, name)"
    });
    if (res.files && res.files.length > 0) {
      childFolders = childFolders.concat(res.files);
    }
    pageToken = res.nextPageToken;
  } while (pageToken);

  for (let f = 0; f < childFolders.length; f++) {
    const folder = childFolders[f];
    const folderName = folder.name;

    // Bỏ qua thư mục bắt đầu bằng dấu _
    if (folderName.indexOf("_") === 0) {
      continue;
    }

    // Nhận diện định dạng ngày:
    // Hỗ trợ cả 2 dạng:
    // 1. YYYY-MM-DD_Tên hoặc YYYY-MM-DD
    // 2. DD-MM-YYYY_Tên hoặc DD-MM-YYYY (hoặc D-M-YYYY)
    let parsedDate = null; // YYYY-MM-DD
    let eventTitle = "";
    
    const isoMatch = folderName.match(/^(\d{4})-(\d{2})-(\d{2})(?:_(.+))?$/);
    const vnMatch = folderName.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:_(.+))?$/);

    if (isoMatch) {
      parsedDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      eventTitle = isoMatch[4] ? isoMatch[4].trim() : `Ngày ${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
    } else if (vnMatch) {
      const day = vnMatch[1].padStart(2, "0");
      const month = vnMatch[2].padStart(2, "0");
      const year = vnMatch[3];
      parsedDate = `${year}-${month}-${day}`;
      eventTitle = vnMatch[4] ? vnMatch[4].trim() : `Ngày ${day}/${month}/${year}`;
    } else {
      // Không đúng mẫu ngày tháng -> Bỏ qua và ghi báo cáo
      warnings.push(`[THƯ MỤC BỎ QUA] "${folderName}" không khớp định dạng ngày (YYYY-MM-DD hoặc DD-MM-YYYY).`);
      continue;
    }

    // Quét các file trong thư mục sự kiện
    let filesInFolder = [];
    let filePageToken = null;
    do {
      const fileRes = Drive.Files.list({
        q: `'${folder.id}' in parents and trashed = false`,
        pageSize: 1000,
        pageToken: filePageToken,
        fields: "nextPageToken, files(id, name, mimeType, size, createdTime, ownedByMe, imageMediaMetadata(width, height, time), videoMediaMetadata(durationMillis))"
      });
      if (fileRes.files && fileRes.files.length > 0) {
        filesInFolder = filesInFolder.concat(fileRes.files);
      }
      filePageToken = fileRes.nextPageToken;
    } while (filePageToken);

    const items = [];
    let coverId = null;
    let np = 0;
    let nv = 0;

    for (let i = 0; i < filesInFolder.length; i++) {
      const file = filesInFolder[i];
      const mime = file.mimeType || "";

      // Kiểm tra sở hữu file
      if (file.ownedByMe === false) {
        warnings.push(`[CẢNH BÁO SỞ HỮU] File "${file.name}" (ID: ${file.id}) trong "${folderName}" không thuộc sở hữu tài khoản lớp.`);
      }

      if (mime.indexOf("image/") === 0) {
        // Phân loại: Ảnh
        np++;
        const item = {
          id: file.id,
          t: "p",
          name: file.name,
          time: (file.imageMediaMetadata && file.imageMediaMetadata.time) || file.createdTime || "",
          createdTime: file.createdTime || ""
        };
        if (file.imageMediaMetadata && file.imageMediaMetadata.width && file.imageMediaMetadata.height) {
          item.w = file.imageMediaMetadata.width;
          item.h = file.imageMediaMetadata.height;
        }

        // Kiểm tra file bìa (tên bắt đầu bằng cover, không phân biệt hoa thường)
        if (!coverId && /^cover/i.test(file.name)) {
          coverId = file.id;
        }

        items.push(item);
      } else if (mime.indexOf("video/") === 0) {
        // Phân loại: Video
        nv++;
        const item = {
          id: file.id,
          t: "v",
          name: file.name,
          time: file.createdTime || "",
          createdTime: file.createdTime || ""
        };
        if (file.videoMediaMetadata && file.videoMediaMetadata.durationMillis) {
          item.d = Math.round(file.videoMediaMetadata.durationMillis / 1000);
        }
        items.push(item);
      } else {
        // Bỏ qua thư mục con, shortcut hoặc định dạng file khác
        warnings.push(`[FILE BỎ QUA] "${file.name}" (MIME: ${mime}) trong "${folderName}" không phải ảnh/video.`);
      }
    }

    // Sắp xếp items theo thứ tự: imageMediaMetadata.time -> createdTime -> tên file
    items.sort(function(a, b) {
      if (a.time && b.time && a.time !== b.time) {
        return a.time.localeCompare(b.time);
      }
      if (a.createdTime && b.createdTime && a.createdTime !== b.createdTime) {
        return a.createdTime.localeCompare(b.createdTime);
      }
      return a.name.localeCompare(b.name);
    });

    // Làm sạch items để chỉ giữ đúng các trường theo đặc tả manifest
    const cleanItems = items.map(function(item) {
      const clean = { id: item.id, t: item.t };
      if (item.t === "p") {
        if (item.w) clean.w = item.w;
        if (item.h) clean.h = item.h;
      } else if (item.t === "v") {
        if (item.d !== undefined) clean.d = item.d;
      }
      return clean;
    });

    // Nếu không có cover.jpg, lấy ảnh đầu tiên làm bìa
    if (!coverId) {
      for (let k = 0; k < cleanItems.length; k++) {
        if (cleanItems[k].t === "p") {
          coverId = cleanItems[k].id;
          break;
        }
      }
    }

    // Tạo slug từ ngày và tiêu đề
    const slug = toSlug(`${parsedDate}-${eventTitle}`);

    events.push({
      slug: slug,
      date: parsedDate,
      title: eventTitle,
      cover: coverId || "",
      np: np,
      nv: nv,
      items: cleanItems
    });

    totalPhotos += np;
    totalVideos += nv;
  }

  // Sắp xếp sự kiện theo date tăng dần
  events.sort(function(a, b) {
    return a.date.localeCompare(b.date);
  });

  // Tạo đối tượng manifest
  const manifestData = {
    v: parseInt(API_VERSION, 10),
    generatedAt: new Date().toISOString(),
    title: SITE_TITLE,
    subtitle: SITE_SUBTITLE,
    events: events
  };

  const manifestJsonString = JSON.stringify(manifestData, null, 2);

  // Tạo nội dung report.txt
  const durationSec = ((new Date().getTime() - startTime.getTime()) / 1000).toFixed(1);
  let reportText = `====================================================\n`;
  reportText += `BÁO CÁO ĐỒNG BỘ DỮ LIỆU HÌNH ẢNH LK17\n`;
  reportText += `Thời điểm chạy: ${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}\n`;
  reportText += `Thời gian thực thi: ${durationSec} giây\n`;
  reportText += `----------------------------------------------------\n`;
  reportText += `Tổng số sự kiện: ${events.length}\n`;
  reportText += `Tổng số ảnh    : ${totalPhotos}\n`;
  reportText += `Tổng số video  : ${totalVideos}\n`;
  reportText += `====================================================\n`;
  if (warnings.length > 0) {
    reportText += `DANH SÁCH CẢNH BÁO (${warnings.length} mục):\n`;
    for (let w = 0; w < warnings.length; w++) {
      reportText += `${w + 1}. ${warnings[w]}\n`;
    }
  } else {
    reportText += `Không có cảnh báo nào. Mọi file và thư mục đều hoàn hảo!\n`;
  }

  // Lưu manifest.json và report.txt vào _SYSTEM
  saveFileInSystem(systemFolderId, "manifest.json", manifestJsonString, "application/json");
  saveFileInSystem(systemFolderId, "report.txt", reportText, "text/plain");

  Logger.log(`Hoàn thành buildManifest! Sự kiện: ${events.length}, Ảnh: ${totalPhotos}, Video: ${totalVideos}`);
  return { ok: true, events: events.length, photos: totalPhotos, videos: totalVideos };
}

/**
 * 2. HÀM ĐIỀU PHỐI API: doGet(e)
 * Xử lý các request từ web frontend:
 *   ?action=ping
 *   ?action=manifest
 *   ?action=download&id=X
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action;

    if (action === "ping") {
      const manifestInfo = getManifestDateFromSystem();
      return jsonResponse({
        ok: true,
        version: API_VERSION,
        manifestAt: manifestInfo ? manifestInfo.generatedAt : null
      });
    }

    if (action === "manifest") {
      const systemFolderId = getOrCreateSystemFolder(ROOT_FOLDER_ID);
      const manifestStr = readSystemFileString(systemFolderId, "manifest.json");
      if (!manifestStr) {
        return jsonResponse({ ok: false, code: "NOT_FOUND", msg: "Chưa có manifest.json. Hãy chạy buildManifest() trước." });
      }
      return ContentService.createTextOutput(manifestStr).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "download") {
      return handleDownloadAction(params.id);
    }

    return jsonResponse({ ok: false, code: "BAD_ACTION", msg: "Hành động không hợp lệ" });
  } catch (err) {
    return jsonResponse({ ok: false, code: "INTERNAL", msg: err.toString() });
  }
}

/**
 * 3. XỬ LÝ DOWNLOAD KÈM KIỂM TRA BẢO MẬT (Mục 3.5)
 */
function handleDownloadAction(id) {
  // 1. Kiểm tra định dạng ID
  if (!id || !/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    return jsonResponse({ ok: false, code: "BAD_ID", msg: "ID file không hợp lệ" });
  }

  // Lấy thông tin file qua Drive API v3
  let file;
  try {
    file = Drive.Files.get(id, { fields: "id, name, mimeType, size, parents, thumbnailLink" });
  } catch (err) {
    return jsonResponse({ ok: false, code: "BAD_ID", msg: "Không tìm thấy file" });
  }

  // 2. Kiểm tra thư mục cha của file (Bảo mật: ngăn tải trộm file ngoài dự án)
  if (!file.parents || file.parents.length === 0) {
    return jsonResponse({ ok: false, code: "NOT_ALLOWED", msg: "File không có thư mục cha hợp lệ" });
  }

  const parentFolderId = file.parents[0];
  let parentFolder;
  try {
    parentFolder = Drive.Files.get(parentFolderId, { fields: "id, name, parents" });
  } catch (err) {
    return jsonResponse({ ok: false, code: "NOT_ALLOWED", msg: "Không thể xác minh thư mục cha" });
  }

  // Thư mục cha không được bắt đầu bằng _ và phải là con trực tiếp của ROOT_FOLDER_ID
  if (!parentFolder.name || parentFolder.name.indexOf("_") === 0) {
    return jsonResponse({ ok: false, code: "NOT_ALLOWED", msg: "Truy cập bị từ chối: Thư mục cha không hợp lệ" });
  }
  if (!parentFolder.parents || parentFolder.parents.indexOf(ROOT_FOLDER_ID) === -1) {
    return jsonResponse({ ok: false, code: "NOT_ALLOWED", msg: "Truy cập bị từ chối: File không nằm trong thư mục sự kiện" });
  }

  // 3. Kiểm tra định dạng ảnh
  const mime = (file.mimeType || "").toLowerCase();
  if (mime.indexOf("image/") !== 0) {
    return jsonResponse({ ok: false, code: "NOT_IMAGE", msg: "Chỉ được phép tải hình ảnh" });
  }

  const size = parseInt(file.size || "0", 10);
  const isStandardFormat = (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp");

  // 4. Chọn nội dung trả về
  if (isStandardFormat && size <= MAX_ORIGINAL_BYTES) {
    // Trường hợp 1: Trả file gốc
    try {
      const blob = DriveApp.getFileById(id).getBlob();
      const b64 = Utilities.base64Encode(blob.getBytes());
      return jsonResponse({
        ok: true,
        name: file.name,
        mime: file.mimeType,
        b64: b64
      });
    } catch (err) {
      return jsonResponse({ ok: false, code: "INTERNAL", msg: "Lỗi đọc file gốc: " + err.toString() });
    }
  } else {
    // Trường hợp 2: HEIC hoặc ảnh quá lớn (>10MB) -> chuyển đổi sang JPEG 2048px
    try {
      let thumbUrl = file.thumbnailLink;
      if (!thumbUrl) {
        thumbUrl = `https://drive.google.com/thumbnail?id=${id}`;
      }
      // Thay đổi tham số kích thước thành s2048
      let largeThumbUrl = thumbUrl.replace(/=s\d+.*$/, "=s2048");
      if (largeThumbUrl.indexOf("=s2048") === -1) {
        largeThumbUrl += (largeThumbUrl.indexOf("?") === -1 ? "?" : "&") + "sz=w2048";
      }

      const response = UrlFetchApp.fetch(largeThumbUrl, {
        headers: {
          Authorization: `Bearer ${ScriptApp.getOAuthToken()}`
        },
        muteHttpExceptions: true
      });

      if (response.getResponseCode() !== 200) {
        return jsonResponse({ ok: false, code: "INTERNAL", msg: "Không thể trích xuất thumbnail kích thước lớn" });
      }

      const fetchedBlob = response.getBlob();
      const b64 = Utilities.base64Encode(fetchedBlob.getBytes());
      const baseName = file.name.replace(/\.[^/.]+$/, "");

      return jsonResponse({
        ok: true,
        name: `${baseName}.jpg`,
        mime: "image/jpeg",
        b64: b64
      });
    } catch (err) {
      return jsonResponse({ ok: false, code: "INTERNAL", msg: "Lỗi chuyển đổi ảnh lớn/HEIC: " + err.toString() });
    }
  }
}

/**
 * 4. CÀI ĐẶT & XÓA TRIGGER TỰ ĐỘNG MỖI 6 GIỜ
 */
function installTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildManifest") {
      Logger.log("Trigger buildManifest đã tồn tại từ trước.");
      return;
    }
  }
  ScriptApp.newTrigger("buildManifest")
    .timeBased()
    .everyHours(6)
    .create();
  Logger.log("Đã cài đặt thành công trigger buildManifest mỗi 6 giờ.");
}

function removeTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "buildManifest") {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  Logger.log(`Đã xóa ${count} trigger buildManifest.`);
}

/**
 * 5. CÁC HÀM TIỆN ÍCH HỖ TRỢ
 */

// Lấy hoặc tạo thư mục _SYSTEM
function getOrCreateSystemFolder(rootId) {
  const res = Drive.Files.list({
    q: `'${rootId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${SYSTEM_FOLDER_NAME}'`,
    pageSize: 1,
    fields: "files(id, name)"
  });
  if (res.files && res.files.length > 0) {
    return res.files[0].id;
  }
  const folderMetadata = {
    name: SYSTEM_FOLDER_NAME,
    mimeType: "application/vnd.google-apps.folder",
    parents: [rootId]
  };
  // Khi tạo thư mục trong Apps Script không truyền tham số mediaData
  const created = Drive.Files.create(folderMetadata);
  return created.id;
}

// Lưu hoặc cập nhật file trong thư mục _SYSTEM
function saveFileInSystem(systemFolderId, fileName, contentStr, mimeType) {
  const res = Drive.Files.list({
    q: `'${systemFolderId}' in parents and trashed = false and name = '${fileName}'`,
    pageSize: 1,
    fields: "files(id, name)"
  });
  if (res.files && res.files.length > 0) {
    DriveApp.getFileById(res.files[0].id).setContent(contentStr);
  } else {
    DriveApp.getFolderById(systemFolderId).createFile(fileName, contentStr, mimeType);
  }
}

// Đọc nội dung file dạng string trong _SYSTEM
function readSystemFileString(systemFolderId, fileName) {
  const res = Drive.Files.list({
    q: `'${systemFolderId}' in parents and trashed = false and name = '${fileName}'`,
    pageSize: 1,
    fields: "files(id)"
  });
  if (!res.files || res.files.length === 0) {
    return null;
  }
  return DriveApp.getFileById(res.files[0].id).getBlob().getDataAsString("UTF-8");
}

// Lấy ngày tạo manifest từ _SYSTEM
function getManifestDateFromSystem() {
  try {
    const systemFolderId = getOrCreateSystemFolder(ROOT_FOLDER_ID);
    const content = readSystemFileString(systemFolderId, "manifest.json");
    if (content) {
      return JSON.parse(content);
    }
  } catch (e) {}
  return null;
}

// Chuẩn hóa slug tiếng Việt
function toSlug(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Helper trả JSON response chuẩn cho doGet
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
