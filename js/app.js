/**
 * ==============================================================================
 * BỘ ĐIỀU KHIỂN CHÍNH — CHUYỂN THỂ 100% TỪ FIGMA MAKE APP
 * (https://erase-plain-54689013.figma.site/)
 * ==============================================================================
 */

(function () {
  "use strict";

  // Dữ liệu các cột mốc nguyên bản 100% từ Figma Prototype
  const MILESTONES = [
    {
      id: "first-day",
      year: "2022",
      date: "05.09.2022",
      label: "Khởi đầu",
      title: "Ngày đầu chúng ta gặp nhau",
      description: "Bốn mươi gương mặt xa lạ, bốn mươi câu chuyện khác nhau và một căn phòng mang số 12A1. Chẳng ai biết ngày hôm ấy lại là trang đầu của quãng thanh xuân đáng nhớ đến thế.",
      quote: "Từ những người lạ, chúng ta đã thành một gia đình.",
      image: "images/classroom.jpg",
      gallery: [
        "images/classroom.jpg",
        "images/friends.jpg",
        "images/classroom-alt.jpg",
        "images/friends-alt.jpg"
      ],
      position: "object-center"
    },
    {
      id: "first-trip",
      year: "2023",
      date: "18.03.2023",
      label: "Lần đầu đi xa",
      title: "Chuyến đi của tiếng cười",
      description: "Lần đầu cả lớp rời khỏi những tiết học quen thuộc để cùng chạy, cùng hát và cùng lưu lại hàng trăm tấm ảnh. Chuyến đi ngắn, nhưng câu chuyện thì được kể mãi.",
      quote: "Đi đâu không quan trọng, miễn là chúng ta đi cùng nhau.",
      image: "images/field.jpg",
      gallery: [
        "images/field.jpg",
        "images/trip.jpg",
        "images/play.jpg",
        "images/friends.jpg"
      ],
      position: "object-center"
    },
    {
      id: "growing-up",
      year: "2024",
      date: "20.11.2024",
      label: "Cùng trưởng thành",
      title: "Những ngày bình thường rất đẹp",
      description: "Có những buổi học căng thẳng, những lần trực nhật muộn, những trận cười không lý do và cả những lúc giận hờn. Chính những ngày rất đỗi bình thường ấy đã làm nên chúng ta.",
      quote: "Hóa ra thanh xuân là những ngày ta từng muốn trôi qua thật nhanh.",
      image: "images/classroom-alt.jpg",
      gallery: [
        "images/classroom-alt.jpg",
        "images/friends-alt.jpg",
        "images/classroom.jpg",
        "images/trip.jpg"
      ],
      position: "object-center"
    },
    {
      id: "graduation",
      year: "2025",
      date: "25.05.2025",
      label: "Ngày trưởng thành",
      title: "Một chương khép lại",
      description: "Ba năm gói lại trong một buổi chiều, vài cái ôm thật chặt và lời hứa sẽ gặp lại. Chúng ta rời lớp học này để đi về nhiều hướng, mang theo một phần tuổi trẻ của nhau.",
      quote: "Tạm biệt nhé, nhưng không phải là kết thúc.",
      image: "images/graduation.jpg",
      gallery: [
        "images/graduation.jpg",
        "images/graduation-alt.jpg",
        "images/hats.jpg",
        "images/field.jpg"
      ],
      position: "object-center"
    }
  ];

  // DOM Elements
  const scrollProgress = document.getElementById("scroll-progress");
  const scrollCueBtn = document.getElementById("scroll-cue-btn");
  const footerTopBtn = document.getElementById("footer-top-btn");
  const timelineMilestones = document.getElementById("timeline-milestones");
  const galleryModal = document.getElementById("gallery-modal");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalEyebrow = document.getElementById("modal-eyebrow");
  const modalTitle = document.getElementById("modal-title");
  const modalGalleryGrid = document.getElementById("modal-gallery-grid");

  // 1. Thanh tiến trình cuộn trang
  function updateScrollProgress() {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = totalHeight > 0 ? window.scrollY / totalHeight : 0;
    if (scrollProgress) {
      scrollProgress.style.transform = `scaleX(${progress})`;
    }
  }

  window.addEventListener("scroll", updateScrollProgress, { passive: true });

  // 2. Nút cuộn xuống
  if (scrollCueBtn) {
    scrollCueBtn.addEventListener("click", function () {
      const target = document.getElementById("our-story");
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  // 3. Nút về đầu trang
  if (footerTopBtn) {
    footerTopBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // 4. Render các cột mốc Timeline (So le trái / phải)
  function renderMilestones() {
    if (!timelineMilestones) return;
    timelineMilestones.innerHTML = "";

    const frag = document.createDocumentFragment();

    MILESTONES.forEach(function (m, idx) {
      const isLeft = idx % 2 === 0;
      const article = document.createElement("article");
      article.className = `milestone ${isLeft ? "milestone-left" : "milestone-right"}`;
      article.id = m.id;

      article.innerHTML = `
        <div class="year-marker">
          <span>${m.year}</span>
          <i></i>
        </div>
        <div class="milestone-card">
          <div class="milestone-image">
            <img src="${m.image}" alt="Kỷ niệm: ${m.title}" class="${m.position}">
            <span class="photo-count">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2"></rect>
                <circle cx="9" cy="10" r="2"></circle>
                <path d="m4 17 5-4 3 2 3-3 5 4"></path>
              </svg>
              ${m.gallery.length} ảnh
            </span>
          </div>
          <div class="milestone-content">
            <div class="milestone-meta">
              <span>${m.label}</span>
              <span>${m.date}</span>
            </div>
            <h3>${m.title}</h3>
            <p>${m.description}</p>
            <blockquote>${m.quote}</blockquote>
            <button type="button" class="gallery-button">
              <span>Xem thêm ảnh</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 17 17 7M8 7h9v9"></path>
              </svg>
            </button>
          </div>
        </div>
      `;

      // Bắt sự kiện bấm Xem thêm ảnh
      const btn = article.querySelector(".gallery-button");
      btn.addEventListener("click", function () {
        openGalleryModal(m);
      });

      frag.appendChild(article);
    });

    timelineMilestones.appendChild(frag);
  }

  // 5. Mở Modal Thư viện ảnh
  function openGalleryModal(milestone) {
    if (!galleryModal) return;

    modalEyebrow.textContent = `${milestone.year} · Album kỷ niệm`;
    modalTitle.textContent = milestone.title;
    modalGalleryGrid.innerHTML = "";

    const frag = document.createDocumentFragment();
    milestone.gallery.forEach(function (imgSrc, i) {
      const fig = document.createElement("figure");
      fig.innerHTML = `
        <img src="${imgSrc}" alt="${milestone.title} — ảnh ${i + 1}">
        <figcaption>${String(i + 1).padStart(2, "0")}</figcaption>
      `;
      frag.appendChild(fig);
    });

    modalGalleryGrid.appendChild(frag);
    galleryModal.style.display = "block";
    galleryModal.setAttribute("aria-label", `Thư viện ảnh ${milestone.title}`);
    document.body.style.overflow = "hidden";
  }

  // 6. Đóng Modal
  function closeGalleryModal() {
    if (!galleryModal) return;
    galleryModal.style.display = "none";
    document.body.style.overflow = "";
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener("click", closeGalleryModal);
  }

  if (galleryModal) {
    galleryModal.addEventListener("mousedown", function (e) {
      if (e.target === galleryModal) {
        closeGalleryModal();
      }
    });
  }

  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && galleryModal && galleryModal.style.display !== "none") {
      closeGalleryModal();
    }
  });

  // Khởi động
  renderMilestones();
  updateScrollProgress();
})();
