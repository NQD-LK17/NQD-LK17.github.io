/**
 * ==============================================================================
 * BỘ ĐIỀU KHIỂN CHÍNH (APP) — KHO LƯU TRỮ HÌNH ẢNH & SỰ KIỆN LK17
 * ==============================================================================
 * Điều hướng Hash Routing (#/, #/e/<slug>, #/e/<slug>/p/<id>, #/e/<slug>/v/<id>)
 * Hiển thị theo lô (IntersectionObserver), Lightbox vuốt ảnh, Tải ảnh 2 bước.
 * Tuân thủ chuẩn Vanilla JS (ES2018), bảo vệ thao tác "nhấn giữ để lưu".
 */

(function() {
  "use strict";

  // --- TRẠNG THÁI TOÀN CỤC (STATE) ---
  const state = {
    manifest: null,
    homeScrollY: 0,
    currentEvent: null,
    currentTab: "p", // "p" (ảnh) hoặc "v" (video)
    currentItems: [], // Danh sách item theo tab hiện tại
    renderedCount: 0,
    observer: null,
    lightboxIndex: -1,
    lightboxFileBlob: null,
    lightboxFileName: "",
    isInitialDeepLink: false,
    hasNavigatedInternally: false
  };

  // --- PHẦN TỬ DOM ---
  const dom = {
    app: document.getElementById("app"),
    homeView: document.getElementById("home-view"),
    eventView: document.getElementById("event-view"),
    siteTitle: document.getElementById("site-title"),
    siteSubtitle: document.getElementById("site-subtitle"),
    eventsGrid: document.getElementById("events-grid"),
    footerUpdated: document.getElementById("footer-updated"),
    zaloBanner: document.getElementById("zalo-banner"),
    zaloClose: document.getElementById("zalo-close"),
    // Trang sự kiện
    btnBack: document.getElementById("btn-back"),
    eventTitle: document.getElementById("event-title"),
    eventDate: document.getElementById("event-date"),
    tabPhoto: document.getElementById("tab-photo"),
    tabVideo: document.getElementById("tab-video"),
    mediaGrid: document.getElementById("media-grid"),
    sentinel: document.getElementById("sentinel"),
    btnLoadMore: document.getElementById("btn-load-more"),
    // Lightbox
    lightbox: document.getElementById("lightbox"),
    lightboxCounter: document.getElementById("lightbox-counter"),
    lightboxClose: document.getElementById("lightbox-close"),
    lightboxPrev: document.getElementById("lightbox-prev"),
    lightboxNext: document.getElementById("lightbox-next"),
    lightboxImg: document.getElementById("lightbox-img"),
    btnDownload: document.getElementById("btn-download"),
    // Video Overlay
    videoOverlay: document.getElementById("video-overlay"),
    videoContainer: document.getElementById("video-container"),
    videoClose: document.getElementById("video-close"),
    videoDriveLink: document.getElementById("video-drive-link"),
    // Toasts
    toastContainer: document.getElementById("toast-container")
  };

  // --- 1. KHỞI TẠO HỆ THỐNG ---
  function init() {
    setupZaloBanner();
    setupEventListeners();
    checkInitialDeepLink();
    loadManifestData();
  }

  // Banner Zalo
  function setupZaloBanner() {
    const isZalo = /Zalo/i.test(navigator.userAgent);
    if (isZalo && dom.zaloBanner) {
      dom.zaloBanner.style.display = "flex";
      dom.zaloClose.addEventListener("click", function() {
        dom.zaloBanner.style.display = "none";
      });
    }
  }

  // Bắt sự kiện
  function setupEventListeners() {
    window.addEventListener("hashchange", handleHashChange);

    // Nút quay lại trang chủ
    dom.btnBack.addEventListener("click", function() {
      location.hash = "#/";
    });

    // Chuyển tab ảnh/video
    dom.tabPhoto.addEventListener("click", function() {
      switchTab("p");
    });
    dom.tabVideo.addEventListener("click", function() {
      switchTab("v");
    });

    // Nút Xem thêm khi không hỗ trợ IntersectionObserver
    dom.btnLoadMore.addEventListener("click", function() {
      renderNextBatch();
    });

    // Đóng Lightbox
    dom.lightboxClose.addEventListener("click", closeLightbox);

    // Điều hướng Lightbox máy tính
    dom.lightboxPrev.addEventListener("click", function() {
      navigateLightbox(-1);
    });
    dom.lightboxNext.addEventListener("click", function() {
      navigateLightbox(1);
    });

    // Bàn phím điều hướng Lightbox
    window.addEventListener("keydown", function(e) {
      if (dom.lightbox.style.display === "flex") {
        if (e.key === "ArrowLeft") navigateLightbox(-1);
        if (e.key === "ArrowRight") navigateLightbox(1);
        if (e.key === "Escape") closeLightbox();
      }
      if (dom.videoOverlay.style.display === "flex") {
        if (e.key === "Escape") closeVideo();
      }
    });

    // Cử chỉ vuốt Lightbox trên điện thoại ({ passive: true } bảo vệ touch/nhấn giữ)
    setupLightboxSwipe();

    // Nút Tải ảnh 2 bước
    dom.btnDownload.addEventListener("click", handleDownloadButtonClick);

    // Đóng khung Video
    dom.videoClose.addEventListener("click", closeVideo);
  }

  // Kiểm tra deep link trực tiếp khi mới vào trang (Mục 4.5 - N4)
  function checkInitialDeepLink() {
    const hash = window.location.hash || "";
    // Định dạng: #/e/<slug>/p/<id> hoặc #/e/<slug>/v/<id>
    const match = hash.match(/^#\/e\/([^/]+)\/([pv])\/([^/]+)$/);
    if (match) {
      state.isInitialDeepLink = true;
      const slug = match[1];
      // Thay thế lịch sử hiện tại bằng URL sự kiện trước, để bấm Back không bị thoát web
      history.replaceState(null, "", "#/e/" + slug);
      // Mở tiếp hash ảnh như mục lịch sử mới
      location.hash = hash;
    }
  }

  // --- 2. TẢI DỮ LIỆU MANIFEST ---
  function loadManifestData() {
    // 1. Thử lấy từ cache tĩnh trước
    fetch("data/manifest.json?t=" + Date.now())
      .then(function(res) {
        if (!res.ok) throw new Error("Static manifest not found");
        return res.json();
      })
      .then(function(data) {
        applyManifest(data, true);
        checkLiveManifestUpdate(data.generatedAt);
      })
      .catch(function(err) {
        // Nếu static lỗi, thử lấy từ API
        if (window.KY_CONFIG.API_URL) {
          fetchLiveManifest(true);
        } else {
          showLoadError();
        }
      });
  }

  // Kiểm tra bản cập nhật mới từ Apps Script ngầm
  function checkLiveManifestUpdate(currentGeneratedAt) {
    if (!window.KY_CONFIG.LIVE_MANIFEST || !window.KY_CONFIG.API_URL) return;

    fetch(window.KY_CONFIG.API_URL + "?action=manifest")
      .then(function(res) { return res.json(); })
      .then(function(liveData) {
        if (liveData && liveData.generatedAt && liveData.generatedAt > currentGeneratedAt) {
          // Nếu đang ở trang chủ, render lại ngay
          const hash = window.location.hash || "";
          if (hash === "" || hash === "#/") {
            applyManifest(liveData, false);
          } else {
            // Đang ở sự kiện hoặc lightbox: chỉ lưu để dùng cho lần điều hướng sau
            state.pendingManifest = liveData;
          }
        }
      })
      .catch(function() {
        // Chạy ngầm lỗi thì âm thầm bỏ qua
      });
  }

  function fetchLiveManifest(isInitial) {
    fetch(window.KY_CONFIG.API_URL + "?action=manifest")
      .then(function(res) { return res.json(); })
      .then(function(data) {
        applyManifest(data, isInitial);
      })
      .catch(function() {
        showLoadError();
      });
  }

  function showLoadError() {
    dom.eventsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px 16px;">
        <p style="font-size: 16px; margin-bottom: 12px; color: #ef4444;">⚠️ Không tải được dữ liệu sự kiện</p>
        <button id="btn-retry" class="btn-load-more" style="margin: 0 auto;">Thử lại</button>
      </div>
    `;
    const btnRetry = document.getElementById("btn-retry");
    if (btnRetry) {
      btnRetry.addEventListener("click", function() {
        location.reload();
      });
    }
  }

  function applyManifest(data, isInitial) {
    state.manifest = data;

    // Tiêu đề trang
    if (data.title) {
      document.title = data.title;
      dom.siteTitle.textContent = data.title;
    }
    if (data.subtitle) {
      dom.siteSubtitle.textContent = data.subtitle;
    }
    if (data.generatedAt) {
      const genDate = new Date(data.generatedAt);
      dom.footerUpdated.textContent = "Cập nhật: " + formatDateVN(genDate);
    }

    // Render danh sách sự kiện ở trang chủ
    renderHomeEvents(data.events || []);

    // Điều hướng theo URL ban đầu
    handleHashChange();
  }

  // --- 3. ĐIỀU HƯỚNG ROUTING (Mục 4.5) ---
  function handleHashChange() {
    if (!state.manifest) return;

    // Nếu có bản manifest mới đang chờ và vừa quay về trang chủ
    if (state.pendingManifest && (location.hash === "" || location.hash === "#/")) {
      state.manifest = state.pendingManifest;
      state.pendingManifest = null;
      renderHomeEvents(state.manifest.events || []);
    }

    const hash = window.location.hash || "#/";

    // 1. Trang chủ (#/ hoặc rỗng)
    if (hash === "" || hash === "#/") {
      showHomeView();
      return;
    }

    // 2. Trang sự kiện (#/e/<slug>)
    const eventMatch = hash.match(/^#\/e\/([^/]+)$/);
    if (eventMatch) {
      const slug = eventMatch[1];
      showEventView(slug);
      return;
    }

    // 3. Xem ảnh Lightbox (#/e/<slug>/p/<fileId>)
    const photoMatch = hash.match(/^#\/e\/([^/]+)\/p\/([^/]+)$/);
    if (photoMatch) {
      const slug = photoMatch[1];
      const fileId = photoMatch[2];
      openLightboxBySlugAndId(slug, fileId);
      return;
    }

    // 4. Xem video (#/e/<slug>/v/<fileId>)
    const videoMatch = hash.match(/^#\/e\/([^/]+)\/v\/([^/]+)$/);
    if (videoMatch) {
      const slug = videoMatch[1];
      const fileId = videoMatch[2];
      openVideoBySlugAndId(slug, fileId);
      return;
    }

    // Hash lạ hoặc không tồn tại: về trang chủ
    showToast("Đường dẫn không hợp lệ");
    location.hash = "#/";
  }

  // --- 4. GIAO DIỆN TRANG CHỦ ---
  function renderHomeEvents(events) {
    dom.eventsGrid.innerHTML = "";

    if (!events || events.length === 0) {
      dom.eventsGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-sub);">
          Chưa có sự kiện nào được ghi nhận.
        </div>
      `;
      return;
    }

    const frag = document.createDocumentFragment();
    events.forEach(function(ev) {
      const card = document.createElement("a");
      card.className = "event-card";
      card.href = "#/e/" + ev.slug;

      const coverSrc = window.KY_MEDIA.thumbUrl(ev.cover, window.KY_CONFIG.COVER_WIDTH);

      card.innerHTML = `
        <div class="event-cover-wrapper">
          <img class="event-cover" 
               src="${coverSrc}" 
               loading="lazy" 
               decoding="async" 
               referrerpolicy="no-referrer"
               alt="${escapeHtml(ev.title)}"
               onerror="window.KY_MEDIA.handleImgError(this, '${ev.cover}', ${window.KY_CONFIG.COVER_WIDTH})">
        </div>
        <div class="event-info">
          <h3 class="event-title">${escapeHtml(ev.title)}</h3>
          <div class="event-meta">
            <span>${formatDisplayDate(ev.date)}</span>
            <span>${ev.np || 0} ảnh${ev.nv ? " · " + ev.nv + " video" : ""}</span>
          </div>
        </div>
      `;
      frag.appendChild(card);
    });

    dom.eventsGrid.appendChild(frag);
  }

  function showHomeView() {
    // Đóng mọi overlay
    dom.lightbox.style.display = "none";
    dom.videoOverlay.style.display = "none";
    dom.videoContainer.innerHTML = "";

    dom.eventView.classList.remove("active");
    dom.homeView.classList.add("active");

    // Khôi phục vị trí cuộn trang chủ cũ (N6)
    if (state.homeScrollY > 0) {
      window.scrollTo(0, state.homeScrollY);
    }
  }

  // --- 5. GIAO DIỆN TRANG SỰ KIỆN ---
  function showEventView(slug) {
    const event = findEventBySlug(slug);
    if (!event) {
      showToast("Không tìm thấy sự kiện");
      location.hash = "#/";
      return;
    }

    // Đóng overlay nếu có
    dom.lightbox.style.display = "none";
    dom.videoOverlay.style.display = "none";
    dom.videoContainer.innerHTML = "";

    // Lưu vị trí cuộn trang chủ nếu vừa từ trang chủ vào
    if (dom.homeView.classList.contains("active")) {
      state.homeScrollY = window.scrollY;
    }

    dom.homeView.classList.remove("active");
    dom.eventView.classList.add("active");

    // Nếu chuyển sang sự kiện mới, reset lưới và vị trí cuộn
    if (!state.currentEvent || state.currentEvent.slug !== slug) {
      state.currentEvent = event;
      state.hasNavigatedInternally = true;
      window.scrollTo(0, 0);

      dom.eventTitle.textContent = event.title;
      dom.eventDate.textContent = formatDisplayDate(event.date);

      // Cập nhật tab
      setupEventTabs(event);
      switchTab(event.np > 0 ? "p" : "v", true);
    }
  }

  function setupEventTabs(event) {
    const np = event.np || 0;
    const nv = event.nv || 0;

    // Cập nhật text số lượng
    dom.tabPhoto.textContent = `Ảnh (${np})`;
    dom.tabVideo.textContent = `Video (${nv})`;

    // Tab nào có 0 mục thì ẩn đi
    dom.tabPhoto.style.display = np > 0 ? "block" : "none";
    dom.tabVideo.style.display = nv > 0 ? "block" : "none";
  }

  function switchTab(tabType, force) {
    if (!force && state.currentTab === tabType) return;
    state.currentTab = tabType;

    if (tabType === "p") {
      dom.tabPhoto.classList.add("active");
      dom.tabVideo.classList.remove("active");
      state.currentItems = (state.currentEvent.items || []).filter(item => item.t === "p");
    } else {
      dom.tabVideo.classList.add("active");
      dom.tabPhoto.classList.remove("active");
      state.currentItems = (state.currentEvent.items || []).filter(item => item.t === "v");
    }

    // Reset lưới và render lô đầu tiên
    dom.mediaGrid.innerHTML = "";
    state.renderedCount = 0;
    renderNextBatch();
    setupIntersectionObserver();
  }

  // Hiển thị theo lô BATCH_SIZE (Mục 4.7)
  function renderNextBatch() {
    const items = state.currentItems;
    const total = items.length;
    if (state.renderedCount >= total) {
      dom.btnLoadMore.style.display = "none";
      return;
    }

    const nextBatch = items.slice(state.renderedCount, state.renderedCount + window.KY_CONFIG.BATCH_SIZE);
    const frag = document.createDocumentFragment();

    nextBatch.forEach(function(item, idx) {
      const globalIndex = state.renderedCount + idx;
      const el = document.createElement("div");
      el.className = "grid-item";

      const thumb = window.KY_MEDIA.thumbUrl(item.id, window.KY_CONFIG.GRID_WIDTH);

      if (item.t === "p") {
        el.innerHTML = `
          <img class="grid-img" 
               src="${thumb}" 
               loading="lazy" 
               decoding="async" 
               referrerpolicy="no-referrer"
               alt="Ảnh ${globalIndex + 1} – ${escapeHtml(state.currentEvent.title)}"
               onerror="window.KY_MEDIA.handleImgError(this, '${item.id}', ${window.KY_CONFIG.GRID_WIDTH})">
        `;
        el.addEventListener("click", function() {
          location.hash = "#/e/" + state.currentEvent.slug + "/p/" + item.id;
        });
      } else {
        // Video
        const durText = item.d ? formatVideoDuration(item.d) : "";
        el.innerHTML = `
          <img class="grid-img" 
               src="${thumb}" 
               loading="lazy" 
               decoding="async" 
               referrerpolicy="no-referrer"
               alt="Video ${globalIndex + 1} – ${escapeHtml(state.currentEvent.title)}"
               onerror="window.KY_MEDIA.handleImgError(this, '${item.id}', ${window.KY_CONFIG.GRID_WIDTH})">
          <div class="video-badge">
            <div class="video-play-icon">▶</div>
            ${durText ? `<span class="video-duration">${durText}</span>` : ""}
          </div>
        `;
        el.addEventListener("click", function() {
          location.hash = "#/e/" + state.currentEvent.slug + "/v/" + item.id;
        });
      }

      frag.appendChild(el);
    });

    dom.mediaGrid.appendChild(frag);
    state.renderedCount += nextBatch.length;

    // Ẩn sentinel/nút load more nếu đã hết
    if (state.renderedCount >= total) {
      dom.btnLoadMore.style.display = "none";
      if (dom.sentinel) dom.sentinel.style.display = "none";
    } else {
      if (dom.sentinel) dom.sentinel.style.display = "block";
    }
  }

  // Cuộn vô tận với IntersectionObserver (rootMargin 800px)
  function setupIntersectionObserver() {
    if (state.observer) {
      state.observer.disconnect();
    }

    if ("IntersectionObserver" in window) {
      dom.btnLoadMore.style.display = "none";
      state.observer = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) {
          renderNextBatch();
        }
      }, {
        rootMargin: "800px"
      });
      state.observer.observe(dom.sentinel);
    } else {
      // Trình duyệt cũ không hỗ trợ
      dom.btnLoadMore.style.display = "block";
    }
  }

  // --- 6. LIGHTBOX ẢNH & BẢO VỆ NHẤN GIỮ (Mục 4.8) ---
  function openLightboxBySlugAndId(slug, fileId) {
    // Đảm bảo trang sự kiện nền đang được dựng sẵn bên dưới
    if (!state.currentEvent || state.currentEvent.slug !== slug) {
      showEventView(slug);
    }

    const photos = (state.currentEvent.items || []).filter(item => item.t === "p");
    const index = photos.findIndex(item => item.id === fileId);

    if (index === -1) {
      showToast("Không tìm thấy hình ảnh này");
      location.hash = "#/e/" + slug;
      return;
    }

    state.lightboxIndex = index;
    renderLightboxPhoto(index, photos);
    dom.lightbox.style.display = "flex";
  }

  function renderLightboxPhoto(index, photos) {
    const item = photos[index];
    const total = photos.length;

    // Cập nhật bộ đếm
    dom.lightboxCounter.textContent = `${index + 1} / ${total}`;

    // Reset nút tải ảnh
    resetDownloadButton();

    // Hiện ảnh GRID_WIDTH trước (đã có trong cache), sau đó đổi sang LARGE_WIDTH khi tải xong
    const lowResUrl = window.KY_MEDIA.thumbUrl(item.id, window.KY_CONFIG.GRID_WIDTH);
    const highResUrl = window.KY_MEDIA.thumbUrl(item.id, window.KY_CONFIG.LARGE_WIDTH);

    dom.lightboxImg.src = lowResUrl;
    dom.lightboxImg.alt = `Ảnh ${index + 1} – ${state.currentEvent.title}`;
    dom.lightboxImg.onerror = function() {
      window.KY_MEDIA.handleImgError(dom.lightboxImg, item.id, window.KY_CONFIG.LARGE_WIDTH);
    };

    // Tải ảnh lớn
    const fullImg = new Image();
    fullImg.referrerPolicy = "no-referrer";
    fullImg.decoding = "async";
    fullImg.onload = function() {
      if (state.lightboxIndex === index) {
        dom.lightboxImg.src = highResUrl;
      }
    };
    fullImg.src = highResUrl;

    // Tải trước (prefetch) ảnh lớn của ảnh liền trước và ảnh kế tiếp
    if (index + 1 < total) {
      const nextImg = new Image();
      nextImg.referrerPolicy = "no-referrer";
      nextImg.src = window.KY_MEDIA.thumbUrl(photos[index + 1].id, window.KY_CONFIG.LARGE_WIDTH);
    }
    if (index - 1 >= 0) {
      const prevImg = new Image();
      prevImg.referrerPolicy = "no-referrer";
      prevImg.src = window.KY_MEDIA.thumbUrl(photos[index - 1].id, window.KY_CONFIG.LARGE_WIDTH);
    }
  }

  function navigateLightbox(step) {
    const photos = (state.currentEvent.items || []).filter(item => item.t === "p");
    const newIndex = state.lightboxIndex + step;

    if (newIndex < 0 || newIndex >= photos.length) return;

    state.lightboxIndex = newIndex;
    const targetItem = photos[newIndex];

    // Thay đổi hash bằng replaceState để không tạo lịch sử rác khi lướt ảnh (Mục 4.5 - N2)
    const newHash = "#/e/" + state.currentEvent.slug + "/p/" + targetItem.id;
    history.replaceState(null, "", newHash);

    renderLightboxPhoto(newIndex, photos);
  }

  function closeLightbox() {
    // Đóng lightbox (Mục 4.5 - N3)
    if (state.hasNavigatedInternally && window.history.length > 1) {
      history.back();
    } else {
      location.hash = "#/e/" + state.currentEvent.slug;
    }
  }

  // Cử chỉ vuốt ngang Lightbox
  function setupLightboxSwipe() {
    let touchStartX = 0;
    let touchStartY = 0;

    // Đăng ký passive: true để tuyệt đối không chặn tương tác chạm gốc và contextmenu lưu ảnh
    dom.lightbox.addEventListener("touchstart", function(e) {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    dom.lightbox.addEventListener("touchend", function(e) {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;

        // Ngưỡng vuốt ngang 50px và góc lệch không quá dốc
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
          if (deltaX < 0) {
            navigateLightbox(1); // Vuốt sang trái -> Ảnh sau
          } else {
            navigateLightbox(-1); // Vuốt sang phải -> Ảnh trước
          }
        }
      }
    }, { passive: true });
  }

  // --- 7. NÚT TẢI ẢNH 2 BƯỚC (Mục 4.9) ---
  function resetDownloadButton() {
    state.lightboxFileBlob = null;
    state.lightboxFileName = "";
    dom.btnDownload.disabled = false;
    dom.btnDownload.classList.remove("is-ready");
    dom.btnDownload.innerHTML = `<span>⬇️ Tải ảnh</span>`;
  }

  function handleDownloadButtonClick() {
    const photos = (state.currentEvent.items || []).filter(item => item.t === "p");
    const item = photos[state.lightboxIndex];
    if (!item) return;

    // Bước 2: Khi đã chuẩn bị xong file -> Lưu vào máy
    if (state.lightboxFileBlob) {
      triggerSaveFile(state.lightboxFileBlob, state.lightboxFileName);
      return;
    }

    // Bước 1: Chuẩn bị file từ Apps Script API
    if (!window.KY_CONFIG.API_URL) {
      showToast("Không tải tự động được. Hãy nhấn giữ ảnh để lưu.");
      return;
    }

    dom.btnDownload.disabled = true;
    dom.btnDownload.innerHTML = `<span>⏳ Đang chuẩn bị…</span>`;

    // Gọi API với timeout 30 giây
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const downloadUrl = window.KY_CONFIG.API_URL + "?action=download&id=" + item.id;
    fetch(downloadUrl, { signal: controller.signal })
      .then(function(res) {
        clearTimeout(timeoutId);
        return res.json();
      })
      .then(function(data) {
        if (!data || !data.ok) {
          throw new Error((data && data.msg) || "Lỗi tải ảnh");
        }

        // Chuyển base64 thành Blob
        const blob = b64toBlob(data.b64, data.mime || "image/jpeg");
        state.lightboxFileBlob = blob;
        state.lightboxFileName = data.name || `photo_${item.id}.jpg`;

        // Đổi nút thành "Lưu vào máy"
        dom.btnDownload.disabled = false;
        dom.btnDownload.classList.add("is-ready");
        dom.btnDownload.innerHTML = `<span>💾 Lưu vào máy</span>`;
      })
      .catch(function(err) {
        dom.btnDownload.disabled = false;
        dom.btnDownload.innerHTML = `<span>⬇️ Tải ảnh</span>`;
        showToast("Không tải tự động được. Hãy nhấn giữ ảnh để lưu.");
      });
  }

  function triggerSaveFile(blob, filename) {
    try {
      const file = new File([blob], filename, { type: blob.type });

      // iOS Web Share API
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: filename
        }).catch(function(err) {
          // Bỏ qua nếu người dùng tự bấm Hủy (AbortError)
          if (err.name !== "AbortError") {
            downloadViaLink(blob, filename);
          }
        });
      } else {
        // Trình duyệt máy tính hoặc Android không hỗ trợ canShare
        downloadViaLink(blob, filename);
      }
    } catch (e) {
      downloadViaLink(blob, filename);
    }
  }

  function downloadViaLink(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  // --- 8. XEM VIDEO (Mục 4.10) ---
  function openVideoBySlugAndId(slug, fileId) {
    if (!state.currentEvent || state.currentEvent.slug !== slug) {
      showEventView(slug);
    }

    const videos = (state.currentEvent.items || []).filter(item => item.t === "v");
    const video = videos.find(item => item.id === fileId);
    if (!video) {
      showToast("Không tìm thấy video");
      location.hash = "#/e/" + slug;
      return;
    }

    const embedUrl = window.KY_MEDIA.videoEmbed(video.id);
    const openUrl = window.KY_MEDIA.videoOpen(video.id);

    // Chèn iframe phát trực tiếp
    dom.videoContainer.innerHTML = `
      <iframe class="video-iframe" 
              src="${embedUrl}" 
              allow="autoplay; fullscreen" 
              allowfullscreen>
      </iframe>
    `;

    dom.videoDriveLink.href = openUrl;
    dom.videoOverlay.style.display = "flex";
  }

  function closeVideo() {
    // Xóa iframe khỏi DOM để tắt tiếng và dừng video ngay lập tức (Mục 4.10)
    dom.videoContainer.innerHTML = "";
    dom.videoOverlay.style.display = "none";

    if (state.hasNavigatedInternally && window.history.length > 1) {
      history.back();
    } else {
      location.hash = "#/e/" + state.currentEvent.slug;
    }
  }

  // --- 9. HÀM TIỆN ÍCH HỖ TRỢ ---
  function findEventBySlug(slug) {
    if (!state.manifest || !state.manifest.events) return null;
    return state.manifest.events.find(ev => ev.slug === slug);
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  function formatDateVN(d) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function formatVideoDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function escapeHtml(text) {
    if (!text) return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function b64toBlob(b64Data, contentType) {
    contentType = contentType || "";
    const sliceSize = 512;
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
  }

  // Toast thông báo tự ẩn sau 4 giây (không dùng alert())
  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);

    setTimeout(function() {
      toast.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Khởi động ứng dụng khi DOM sẵn sàng
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
