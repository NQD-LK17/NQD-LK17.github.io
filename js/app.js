/**
 * ==============================================================================
 * BỘ ĐIỀU KHIỂN CHÍNH (APP) — KHO LƯU TRỮ HÌNH ẢNH & SỰ KIỆN LK17
 * ==============================================================================
 * Giao diện phong cách Tạp chí Ký ức / Scrapbook & Timeline Dòng thời gian
 * Tích hợp Hash Routing, Modal thư viện ảnh theo lô, Lightbox vuốt cảm ứng & Tải ảnh 2 bước.
 */

(function() {
  "use strict";

  // --- TRẠNG THÁI TOÀN CỤC ---
  const state = {
    manifest: null,
    currentEvent: null,
    currentTab: "p",
    currentItems: [],
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
    // Images
    heroImg: document.getElementById("hero-img"),
    polaroidImg: document.getElementById("polaroid-img"),
    letterImg: document.getElementById("letter-img"),
    statMemories: document.getElementById("stat-memories"),
    footerUpdated: document.getElementById("footer-updated"),
    zaloBanner: document.getElementById("zalo-banner"),
    zaloClose: document.getElementById("zalo-close"),
    // Timeline
    timelineList: document.getElementById("timeline-list"),
    // Modal Thư viện ảnh sự kiện
    eventModal: document.getElementById("event-modal"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    modalClose: document.getElementById("modal-close"),
    modalTag: document.getElementById("modal-tag"),
    modalDate: document.getElementById("modal-date"),
    modalTitle: document.getElementById("modal-title"),
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
    // Video
    videoOverlay: document.getElementById("video-overlay"),
    videoContainer: document.getElementById("video-container"),
    videoClose: document.getElementById("video-close"),
    videoDriveLink: document.getElementById("video-drive-link"),
    toastContainer: document.getElementById("toast-container")
  };

  // Danh ngôn thanh xuân ngẫu nhiên cho các thẻ sự kiện
  const MEMORY_QUOTES = [
    "“Từ những người xa lạ, chúng ta đã thành một gia đình.”",
    "“Đi đâu không quan trọng, miễn là chúng ta đi cùng nhau.”",
    "“Hóa ra thanh xuân là những ngày ta từng mong trôi qua thật nhanh.”",
    "“Những ngày bình thường bên nhau hóa ra lại là những ngày đẹp nhất.”",
    "“Thời gian có thể trôi, nhưng nụ cười của chúng ta ở lại mãi mãi.”",
    "“Gặp nhau là duyên phận, cùng nhau lớn lên là điều tuyệt vời nhất.”"
  ];

  // --- 1. KHỞI CHẠY HỆ THỐNG ---
  function init() {
    setupZaloBanner();
    setupEventListeners();
    checkInitialDeepLink();
    loadManifestData();
  }

  function setupZaloBanner() {
    const isZalo = /Zalo/i.test(navigator.userAgent);
    if (isZalo && dom.zaloBanner) {
      dom.zaloBanner.style.display = "flex";
      dom.zaloClose.addEventListener("click", function() {
        dom.zaloBanner.style.display = "none";
      });
    }
  }

  function setupEventListeners() {
    window.addEventListener("hashchange", handleHashChange);

    // Đóng Modal Thư viện sự kiện
    dom.modalClose.addEventListener("click", closeModal);
    dom.modalBackdrop.addEventListener("click", closeModal);

    // Chuyển Tab Ảnh / Video trong Modal
    dom.tabPhoto.addEventListener("click", () => switchTab("p"));
    dom.tabVideo.addEventListener("click", () => switchTab("v"));

    // Nút Xem thêm lô ảnh
    dom.btnLoadMore.addEventListener("click", renderNextBatch);

    // Lightbox
    dom.lightboxClose.addEventListener("click", closeLightbox);
    dom.lightboxPrev.addEventListener("click", () => navigateLightbox(-1));
    dom.lightboxNext.addEventListener("click", () => navigateLightbox(1));

    // Bàn phím điều hướng
    window.addEventListener("keydown", function(e) {
      if (dom.lightbox.style.display === "flex") {
        if (e.key === "ArrowLeft") navigateLightbox(-1);
        if (e.key === "ArrowRight") navigateLightbox(1);
        if (e.key === "Escape") closeLightbox();
      } else if (dom.eventModal.style.display === "flex") {
        if (e.key === "Escape") closeModal();
      }
      if (dom.videoOverlay.style.display === "flex") {
        if (e.key === "Escape") closeVideo();
      }
    });

    // Vuốt màn hình Lightbox ({ passive: true } bảo vệ touch gốc)
    setupLightboxSwipe();

    // Tải ảnh 2 bước
    dom.btnDownload.addEventListener("click", handleDownloadButtonClick);

    // Đóng video
    dom.videoClose.addEventListener("click", closeVideo);
  }

  function checkInitialDeepLink() {
    const hash = window.location.hash || "";
    const match = hash.match(/^#\/e\/([^/]+)\/([pv])\/([^/]+)$/);
    if (match) {
      state.isInitialDeepLink = true;
      const slug = match[1];
      history.replaceState(null, "", "#/e/" + slug);
      location.hash = hash;
    }
  }

  // --- 2. TẢI DỮ LIỆU TỪ MANIFEST ---
  function loadManifestData() {
    fetch("data/manifest.json?t=" + Date.now())
      .then(res => {
        if (!res.ok) throw new Error("Static manifest not found");
        return res.json();
      })
      .then(data => {
        applyManifest(data, true);
        checkLiveManifestUpdate(data.generatedAt);
      })
      .catch(() => {
        if (window.KY_CONFIG.API_URL) {
          fetchLiveManifest(true);
        } else {
          showLoadError();
        }
      });
  }

  function checkLiveManifestUpdate(currentGeneratedAt) {
    if (!window.KY_CONFIG.LIVE_MANIFEST || !window.KY_CONFIG.API_URL) return;

    fetch(window.KY_CONFIG.API_URL + "?action=manifest")
      .then(res => res.json())
      .then(liveData => {
        if (liveData && liveData.generatedAt && liveData.generatedAt > currentGeneratedAt) {
          const hash = window.location.hash || "";
          if (hash === "" || hash === "#/" || hash === "#top") {
            applyManifest(liveData, false);
          } else {
            state.pendingManifest = liveData;
          }
        }
      })
      .catch(() => {});
  }

  function fetchLiveManifest(isInitial) {
    fetch(window.KY_CONFIG.API_URL + "?action=manifest")
      .then(res => res.json())
      .then(data => applyManifest(data, isInitial))
      .catch(() => showLoadError());
  }

  function showLoadError() {
    dom.timelineList.innerHTML = `
      <div style="text-align: center; padding: 40px 16px; color: var(--gold-light);">
        <p style="font-size: 16px; margin-bottom: 12px; color: #ef4444;">⚠️ Không tải được dữ liệu sự kiện</p>
        <button id="btn-retry" class="btn-load-more">Thử lại</button>
      </div>
    `;
    const btn = document.getElementById("btn-retry");
    if (btn) btn.addEventListener("click", () => location.reload());
  }

  function applyManifest(data, isInitial) {
    state.manifest = data;

    // Cập nhật ngày đồng bộ
    if (data.generatedAt) {
      const genDate = new Date(data.generatedAt);
      dom.footerUpdated.textContent = "Dữ liệu được cập nhật ngày: " + formatDateVN(genDate);
    }

    // Cập nhật số lượng kỷ niệm
    let totalMedia = 0;
    (data.events || []).forEach(e => {
      totalMedia += (e.np || 0) + (e.nv || 0);
    });
    if (totalMedia > 0 && dom.statMemories) {
      dom.statMemories.textContent = `${totalMedia}+`;
    }

    // Render Timeline Dòng thời gian
    renderTimeline(data.events || []);

    // Điều hướng theo URL
    handleHashChange();
  }

  // --- 3. RENDER TIMELINE DÒNG THỜI GIAN THEO PHONG CÁCH FIGMA ---
  function renderTimeline(events) {
    dom.timelineList.innerHTML = "";

    if (!events || events.length === 0) {
      dom.timelineList.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--text-light-sub);">
          Chưa có sự kiện nào trong dòng thời gian.
        </div>
      `;
      return;
    }

    const frag = document.createDocumentFragment();
    let currentYear = null;

    events.forEach((ev, idx) => {
      // Trích xuất năm để tạo Year Node nếu sang năm mới
      const evYear = ev.date ? ev.date.split("-")[0] : "";
      if (evYear && evYear !== currentYear) {
        currentYear = evYear;
        const yearNode = document.createElement("div");
        yearNode.className = "timeline-year-node";
        yearNode.textContent = currentYear;
        frag.appendChild(yearNode);
      }

      // Vị trí so le: chẵn bên trái, lẻ bên phải
      const side = idx % 2 === 0 ? "left" : "right";
      const itemEl = document.createElement("div");
      itemEl.className = `timeline-item ${side}`;

      const coverSrc = window.KY_MEDIA.thumbUrl(ev.cover, window.KY_CONFIG.COVER_WIDTH);
      const displayDate = formatDisplayDate(ev.date);
      const quote = MEMORY_QUOTES[idx % MEMORY_QUOTES.length];

      itemEl.innerHTML = `
        <div class="timeline-dot"></div>
        <article class="milestone-card">
          <div class="milestone-cover-box">
            <img class="milestone-cover" 
                 src="${coverSrc}" 
                 loading="lazy" 
                 decoding="async" 
                 referrerpolicy="no-referrer"
                 alt="${escapeHtml(ev.title)}"
                 onerror="window.KY_MEDIA.handleImgError(this, '${ev.cover}', ${window.KY_CONFIG.COVER_WIDTH})">
            <div class="milestone-photo-badge">
              <span>📷 ${ev.np || 0} ảnh${ev.nv ? " · " + ev.nv + " video" : ""}</span>
            </div>
          </div>
          <div class="milestone-body">
            <div class="milestone-tag-row">
              <span>Kỷ niệm</span>
              <span class="milestone-dot-sep">·</span>
              <span>${displayDate}</span>
            </div>
            <h3 class="milestone-title">${escapeHtml(ev.title)}</h3>
            <div class="milestone-quote">${quote}</div>
            <a href="#/e/${ev.slug}" class="milestone-btn">
              <span>Xem thêm ảnh</span>
              <span>↗</span>
            </a>
          </div>
        </article>
      `;

      frag.appendChild(itemEl);
    });

    dom.timelineList.appendChild(frag);
  }

  // --- 4. ĐIỀU HƯỚNG ROUTING (Hash) ---
  function handleHashChange() {
    if (!state.manifest) return;

    if (state.pendingManifest && (location.hash === "" || location.hash === "#/" || location.hash === "#top")) {
      state.manifest = state.pendingManifest;
      state.pendingManifest = null;
      renderTimeline(state.manifest.events || []);
    }

    const hash = window.location.hash || "#/";

    // 1. Màn hình chính Timeline
    if (hash === "" || hash === "#/" || hash === "#top" || hash.startsWith("#our-story") || hash.startsWith("#timeline") || hash.startsWith("#letter")) {
      closeModalView();
      return;
    }

    // 2. Mở Modal Sự kiện (#/e/<slug>)
    const eventMatch = hash.match(/^#\/e\/([^/]+)$/);
    if (eventMatch) {
      const slug = eventMatch[1];
      openEventModal(slug);
      return;
    }

    // 3. Mở Lightbox ảnh (#/e/<slug>/p/<fileId>)
    const photoMatch = hash.match(/^#\/e\/([^/]+)\/p\/([^/]+)$/);
    if (photoMatch) {
      const slug = photoMatch[1];
      const fileId = photoMatch[2];
      openLightboxBySlugAndId(slug, fileId);
      return;
    }

    // 4. Mở Video (#/e/<slug>/v/<fileId>)
    const videoMatch = hash.match(/^#\/e\/([^/]+)\/v\/([^/]+)$/);
    if (videoMatch) {
      const slug = videoMatch[1];
      const fileId = videoMatch[2];
      openVideoBySlugAndId(slug, fileId);
      return;
    }

    showToast("Đường dẫn không tồn tại");
    location.hash = "#/";
  }

  // --- 5. GIAO DIỆN MODAL SỰ KIỆN ---
  function openEventModal(slug) {
    const event = findEventBySlug(slug);
    if (!event) {
      showToast("Không tìm thấy sự kiện");
      location.hash = "#/";
      return;
    }

    // Đóng các overlay xem ảnh/video nếu có
    dom.lightbox.style.display = "none";
    dom.videoOverlay.style.display = "none";
    dom.videoContainer.innerHTML = "";

    state.currentEvent = event;
    state.hasNavigatedInternally = true;

    // Điền tiêu đề & ngày
    dom.modalTitle.textContent = event.title;
    dom.modalDate.textContent = formatDisplayDate(event.date);

    // Cập nhật tab
    const np = event.np || 0;
    const nv = event.nv || 0;
    dom.tabPhoto.textContent = `Ảnh (${np})`;
    dom.tabVideo.textContent = `Video (${nv})`;
    dom.tabPhoto.style.display = np > 0 ? "block" : "none";
    dom.tabVideo.style.display = nv > 0 ? "block" : "none";

    switchTab(np > 0 ? "p" : "v", true);

    // Hiện modal
    dom.eventModal.style.display = "flex";
    document.body.style.overflow = "hidden"; // Khóa cuộn trang nền
  }

  function closeModal() {
    closeModalView();
    location.hash = "#timeline";
  }

  function closeModalView() {
    dom.eventModal.style.display = "none";
    dom.lightbox.style.display = "none";
    dom.videoOverlay.style.display = "none";
    dom.videoContainer.innerHTML = "";
    document.body.style.overflow = ""; // Khôi phục cuộn trang nền
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

    dom.mediaGrid.innerHTML = "";
    state.renderedCount = 0;
    renderNextBatch();
    setupIntersectionObserver();
  }

  function renderNextBatch() {
    const items = state.currentItems;
    const total = items.length;
    if (state.renderedCount >= total) {
      dom.btnLoadMore.style.display = "none";
      return;
    }

    const nextBatch = items.slice(state.renderedCount, state.renderedCount + window.KY_CONFIG.BATCH_SIZE);
    const frag = document.createDocumentFragment();

    nextBatch.forEach((item, idx) => {
      const globalIndex = state.renderedCount + idx;
      const el = document.createElement("div");
      el.className = "gallery-item";

      const thumb = window.KY_MEDIA.thumbUrl(item.id, window.KY_CONFIG.GRID_WIDTH);

      if (item.t === "p") {
        el.innerHTML = `
          <img class="gallery-img" 
               src="${thumb}" 
               loading="lazy" 
               decoding="async" 
               referrerpolicy="no-referrer"
               alt="Ảnh ${globalIndex + 1} – ${escapeHtml(state.currentEvent.title)}"
               onerror="window.KY_MEDIA.handleImgError(this, '${item.id}', ${window.KY_CONFIG.GRID_WIDTH})">
          <div class="gallery-item-index">${String(globalIndex + 1).padStart(2, "0")}</div>
        `;
        el.addEventListener("click", () => {
          location.hash = "#/e/" + state.currentEvent.slug + "/p/" + item.id;
        });
      } else {
        const durText = item.d ? formatVideoDuration(item.d) : "";
        el.innerHTML = `
          <img class="gallery-img" 
               src="${thumb}" 
               loading="lazy" 
               decoding="async" 
               referrerpolicy="no-referrer"
               alt="Video ${globalIndex + 1} – ${escapeHtml(state.currentEvent.title)}"
               onerror="window.KY_MEDIA.handleImgError(this, '${item.id}', ${window.KY_CONFIG.GRID_WIDTH})">
          <div class="gallery-item-index">${String(globalIndex + 1).padStart(2, "0")}</div>
          <div class="video-badge">
            <div class="video-play-icon">▶</div>
            ${durText ? `<span class="video-duration">${durText}</span>` : ""}
          </div>
        `;
        el.addEventListener("click", () => {
          location.hash = "#/e/" + state.currentEvent.slug + "/v/" + item.id;
        });
      }

      frag.appendChild(el);
    });

    dom.mediaGrid.appendChild(frag);
    state.renderedCount += nextBatch.length;

    if (state.renderedCount >= total) {
      dom.btnLoadMore.style.display = "none";
      if (dom.sentinel) dom.sentinel.style.display = "none";
    } else {
      if (dom.sentinel) dom.sentinel.style.display = "block";
    }
  }

  function setupIntersectionObserver() {
    if (state.observer) state.observer.disconnect();

    if ("IntersectionObserver" in window) {
      dom.btnLoadMore.style.display = "none";
      state.observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          renderNextBatch();
        }
      }, { rootMargin: "800px" });
      state.observer.observe(dom.sentinel);
    } else {
      dom.btnLoadMore.style.display = "block";
    }
  }

  // --- 6. LIGHTBOX ẢNH & BẢO VỆ NHẤN GIỮ ---
  function openLightboxBySlugAndId(slug, fileId) {
    if (!state.currentEvent || state.currentEvent.slug !== slug) {
      openEventModal(slug);
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

    dom.lightboxCounter.textContent = `${index + 1} / ${total}`;
    resetDownloadButton();

    const lowResUrl = window.KY_MEDIA.thumbUrl(item.id, window.KY_CONFIG.GRID_WIDTH);
    const highResUrl = window.KY_MEDIA.thumbUrl(item.id, window.KY_CONFIG.LARGE_WIDTH);

    dom.lightboxImg.src = lowResUrl;
    dom.lightboxImg.alt = `Ảnh ${index + 1} – ${state.currentEvent.title}`;
    dom.lightboxImg.onerror = () => {
      window.KY_MEDIA.handleImgError(dom.lightboxImg, item.id, window.KY_CONFIG.LARGE_WIDTH);
    };

    const fullImg = new Image();
    fullImg.referrerPolicy = "no-referrer";
    fullImg.decoding = "async";
    fullImg.onload = () => {
      if (state.lightboxIndex === index) {
        dom.lightboxImg.src = highResUrl;
      }
    };
    fullImg.src = highResUrl;

    // Prefetch ảnh trước & sau
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
    history.replaceState(null, "", "#/e/" + state.currentEvent.slug + "/p/" + targetItem.id);
    renderLightboxPhoto(newIndex, photos);
  }

  function closeLightbox() {
    if (state.hasNavigatedInternally && window.history.length > 1) {
      history.back();
    } else {
      location.hash = "#/e/" + state.currentEvent.slug;
    }
  }

  function setupLightboxSwipe() {
    let touchStartX = 0;
    let touchStartY = 0;

    dom.lightbox.addEventListener("touchstart", e => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    dom.lightbox.addEventListener("touchend", e => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;

        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
          if (deltaX < 0) navigateLightbox(1);
          else navigateLightbox(-1);
        }
      }
    }, { passive: true });
  }

  // --- 7. NÚT TẢI ẢNH 2 BƯỚC ---
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

    if (state.lightboxFileBlob) {
      triggerSaveFile(state.lightboxFileBlob, state.lightboxFileName);
      return;
    }

    if (!window.KY_CONFIG.API_URL) {
      showToast("Không tải tự động được. Hãy nhấn giữ ảnh để lưu.");
      return;
    }

    dom.btnDownload.disabled = true;
    dom.btnDownload.innerHTML = `<span>⏳ Đang chuẩn bị…</span>`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    fetch(window.KY_CONFIG.API_URL + "?action=download&id=" + item.id, { signal: controller.signal })
      .then(res => {
        clearTimeout(timeoutId);
        return res.json();
      })
      .then(data => {
        if (!data || !data.ok) throw new Error();
        state.lightboxFileBlob = b64toBlob(data.b64, data.mime || "image/jpeg");
        state.lightboxFileName = data.name || `photo_${item.id}.jpg`;

        dom.btnDownload.disabled = false;
        dom.btnDownload.classList.add("is-ready");
        dom.btnDownload.innerHTML = `<span>💾 Lưu vào máy</span>`;
      })
      .catch(() => {
        dom.btnDownload.disabled = false;
        dom.btnDownload.innerHTML = `<span>⬇️ Tải ảnh</span>`;
        showToast("Không tải tự động được. Hãy nhấn giữ ảnh để lưu.");
      });
  }

  function triggerSaveFile(blob, filename) {
    try {
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: filename })
          .catch(err => {
            if (err.name !== "AbortError") downloadViaLink(blob, filename);
          });
      } else {
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

  // --- 8. VIDEO OVERLAY ---
  function openVideoBySlugAndId(slug, fileId) {
    if (!state.currentEvent || state.currentEvent.slug !== slug) {
      openEventModal(slug);
    }

    const videos = (state.currentEvent.items || []).filter(item => item.t === "v");
    const video = videos.find(item => item.id === fileId);
    if (!video) {
      showToast("Không tìm thấy video");
      location.hash = "#/e/" + slug;
      return;
    }

    dom.videoContainer.innerHTML = `
      <iframe class="video-iframe" 
              src="${window.KY_MEDIA.videoEmbed(video.id)}" 
              allow="autoplay; fullscreen" 
              allowfullscreen>
      </iframe>
    `;
    dom.videoDriveLink.href = window.KY_MEDIA.videoOpen(video.id);
    dom.videoOverlay.style.display = "flex";
  }

  function closeVideo() {
    dom.videoContainer.innerHTML = "";
    dom.videoOverlay.style.display = "none";
    if (state.hasNavigatedInternally && window.history.length > 1) {
      history.back();
    } else {
      location.hash = "#/e/" + state.currentEvent.slug;
    }
  }

  // --- 9. HÀM TIỆN ÍCH ---
  function findEventBySlug(slug) {
    if (!state.manifest || !state.manifest.events) return null;
    return state.manifest.events.find(ev => ev.slug === slug);
  }

  function formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
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
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: contentType });
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
