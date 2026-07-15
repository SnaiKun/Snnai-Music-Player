document.addEventListener('DOMContentLoaded', () => {
  // --- CAROUSEL SHOWCASE LOGIC ---
  const track = document.querySelector('.carousel-track');
  const slides = Array.from(document.querySelectorAll('.carousel-slide'));
  const nextBtn = document.querySelector('.next-btn');
  const prevBtn = document.querySelector('.prev-btn');
  const dotsContainer = document.querySelector('.carousel-dots');
  const dots = Array.from(document.querySelectorAll('.dot'));
  
  let currentIndex = 0;
  let autoplayInterval;

  const updateCarousel = (index) => {
    // Wrap around index
    if (index >= slides.length) currentIndex = 0;
    else if (index < 0) currentIndex = slides.length - 1;
    else currentIndex = index;

    // Shift track
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Update active class on slides
    slides.forEach((slide, idx) => {
      if (idx === currentIndex) slide.classList.add('active');
      else slide.classList.remove('active');
    });

    // Update dots
    dots.forEach((dot, idx) => {
      if (idx === currentIndex) dot.classList.add('active');
      else dot.classList.remove('active');
    });
  };

  const startAutoplay = () => {
    stopAutoplay();
    autoplayInterval = setInterval(() => {
      updateCarousel(currentIndex + 1);
    }, 4500);
  };

  const stopAutoplay = () => {
    if (autoplayInterval) clearInterval(autoplayInterval);
  };

  // Click Event Listeners
  nextBtn.addEventListener('click', () => {
    updateCarousel(currentIndex + 1);
    startAutoplay(); // Reset timer on manual click
  });

  prevBtn.addEventListener('click', () => {
    updateCarousel(currentIndex - 1);
    startAutoplay(); // Reset timer on manual click
  });

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => {
      updateCarousel(idx);
      startAutoplay(); // Reset timer on manual click
    });
  });

  // Start initial autoplay
  if (slides.length > 0) {
    startAutoplay();
  }

  // --- SCROLL ANIMATIONS / INTERSECTION OBSERVER ---
  // Elements to fade-in as user scrolls
  const fadeElements = document.querySelectorAll('.feature-card, .step, .download-box, .hero-mockup');

  // Add initial state class to elements
  fadeElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(25px)';
    el.style.transition = 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
  });

  const observerOptions = {
    root: null,
    threshold: 0.05,
    rootMargin: '0px 0px -20px 0px'
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = entry.target;
        target.style.opacity = '1';
        target.style.transform = 'translateY(0)';
        observer.unobserve(target); // Only trigger once
      }
    });
  }, observerOptions);

  fadeElements.forEach(el => observer.observe(el));

  // --- SMOOTH ANCHOR LINK INTERACTION ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        // Offset for sticky navbar
        const headerOffset = 80;
        const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        const elementPosition = targetElement.getBoundingClientRect().top + scrollTop;
        const offsetPosition = elementPosition - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    });
  });
});
