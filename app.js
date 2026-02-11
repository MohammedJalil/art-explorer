(() => {
    // Lock scrolling while hero is visible
    document.body.classList.add('no-scroll');

    // ================================================================
    // DOM Elements
    // ================================================================
    const hero = document.getElementById('hero');
    const heroDiscoverBtn = document.getElementById('hero-discover-btn');
    const artworkView = document.getElementById('artwork-view');
    const discoverBtn = document.getElementById('discover-btn');
    const keyboardHint = document.getElementById('keyboard-hint');

    const loadingSpinner = document.getElementById('loading-spinner');
    const artworkImage = document.getElementById('artwork-image');
    const imagePlaceholder = document.getElementById('image-placeholder');

    const artworkTitle = document.getElementById('artwork-title');
    const artworkArtist = document.getElementById('artwork-artist');
    const artworkDate = document.getElementById('artwork-date');
    const artworkMedium = document.getElementById('artwork-medium');
    const artworkDimensions = document.getElementById('artwork-dimensions');
    const artworkMovement = document.getElementById('artwork-movement');
    const artworkCounter = document.getElementById('artwork-counter');

    const aboutContent = document.getElementById('about-content');
    const analysisContent = document.getElementById('analysis-content');
    const factsContent = document.getElementById('facts-content');

    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    // Progress bar
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');

    // Lightbox
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxClose = document.getElementById('lightbox-close');

    // ================================================================
    // State
    // ================================================================
    const IIIF_BASE = 'https://www.artic.edu/iiif/2';
    let lastIndex = -1;
    let isLoading = false;
    let navHistory = [];       // stack of viewed indices
    let historyPos = -1;       // current position in history
    let viewCount = 0;
    let preloadedImage = null;
    let preloadedIndex = -1;
    const seenArtworks = new Set();  // track unique artworks seen

    // ================================================================
    // Utilities
    // ================================================================

    function getRandomIndex() {
        if (ARTWORKS.length <= 1) return 0;
        let index;
        do {
            index = Math.floor(Math.random() * ARTWORKS.length);
        } while (index === lastIndex);
        return index;
    }

    function getImageUrl(artwork) {
        if (artwork.imageUrl) return artwork.imageUrl;
        return `${IIIF_BASE}/${artwork.imageId}/full/843,/0/default.jpg`;
    }

    function textToParagraphs(text) {
        return text
            .split('\n')
            .filter(p => p.trim())
            .map(p => `<p>${p.trim()}</p>`)
            .join('');
    }

    // ================================================================
    // Tab Switching
    // ================================================================

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            // Update buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update panels
            tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `tab-${targetTab}`) {
                    panel.classList.add('active');
                }
            });
        });
    });

    // ================================================================
    // Render Artwork Data
    // ================================================================

    function updateProgress() {
        const pct = Math.min((seenArtworks.size / ARTWORKS.length) * 100, 100);
        progressFill.style.width = `${pct}%`;
    }

    function renderArtwork(artwork, artworkIndex) {
        artworkTitle.textContent = artwork.title;
        artworkArtist.textContent = `${artwork.artist} (${artwork.artistLife})`;
        artworkDate.textContent = artwork.date;
        artworkMedium.textContent = artwork.medium;
        artworkDimensions.textContent = artwork.dimensions;
        artworkMovement.textContent = artwork.movement || '';

        // Track seen artworks
        seenArtworks.add(artworkIndex);
        artworkCounter.textContent = `${seenArtworks.size} of ${ARTWORKS.length} seen`;
        updateProgress();

        // Content panels
        aboutContent.innerHTML = textToParagraphs(artwork.about);
        analysisContent.innerHTML = textToParagraphs(artwork.analysis);

        factsContent.innerHTML = '';
        artwork.funFacts.forEach(fact => {
            const li = document.createElement('li');
            li.textContent = fact;
            factsContent.appendChild(li);
        });

        // Reset to "About" tab
        tabBtns.forEach(b => b.classList.remove('active'));
        tabPanels.forEach(p => p.classList.remove('active'));
        tabBtns[0].classList.add('active');
        tabPanels[0].classList.add('active');
    }

    // ================================================================
    // Image Loading
    // ================================================================

    function loadImage(artwork) {
        return new Promise((resolve) => {
            // Reset state
            loadingSpinner.classList.remove('hidden');
            artworkImage.classList.remove('visible', 'ken-burns');
            artworkImage.classList.add('loading-state');
            imagePlaceholder.classList.add('hidden');
            artworkView.classList.remove('info-visible');

            const url = getImageUrl(artwork);

            // Use preloaded image if available
            if (preloadedImage && preloadedImage.src === url && preloadedImage.complete && preloadedImage.naturalWidth > 0) {
                finishLoad(url, artwork);
                resolve(true);
                return;
            }

            const img = new Image();
            img.src = url;

            img.onload = () => {
                finishLoad(url, artwork);
                resolve(true);
            };

            img.onerror = () => {
                showImageError(artwork, 'Could not load image');
                resolve(false);
            };

            // Timeout
            setTimeout(() => {
                if (artworkImage.classList.contains('loading-state')) {
                    img.src = '';
                    showImageError(artwork, 'Image took too long to load');
                    resolve(false);
                }
            }, 15000);
        });
    }

    function showImageError(artwork, reason) {
        artworkImage.classList.remove('loading-state');
        loadingSpinner.classList.add('hidden');
        imagePlaceholder.classList.remove('hidden');
        imagePlaceholder.querySelector('.placeholder-title').textContent =
            `"${artwork.title}"`;
        imagePlaceholder.querySelector('.placeholder-sub').textContent =
            `${reason} — artwork details are still available below`;
        artworkView.classList.add('info-visible');
    }

    function finishLoad(url, artwork) {
        artworkImage.src = url;
        artworkImage.alt = `${artwork.title} by ${artwork.artist}`;
        artworkImage.classList.remove('loading-state');
        loadingSpinner.classList.add('hidden');

        // Trigger cinematic reveal
        requestAnimationFrame(() => {
            artworkImage.classList.add('visible');
            // Start Ken Burns after initial reveal
            setTimeout(() => {
                artworkImage.classList.add('ken-burns');
            }, 800);
            // Stagger in the info
            setTimeout(() => {
                artworkView.classList.add('info-visible');
            }, 400);
        });
    }

    // ================================================================
    // Lightbox
    // ================================================================

    function openLightbox() {
        if (!artworkImage.src || !artworkImage.classList.contains('visible')) return;
        lightboxImg.src = artworkImage.src;
        lightboxImg.alt = artworkImage.alt;
        lightbox.classList.remove('hidden');
        requestAnimationFrame(() => {
            lightbox.classList.add('visible');
        });
        document.body.classList.add('no-scroll');
    }

    function closeLightbox() {
        lightbox.classList.remove('visible');
        setTimeout(() => {
            lightbox.classList.add('hidden');
            lightboxImg.src = '';
            // Only re-enable scroll if hero is already gone
            if (hero.classList.contains('hero-hidden')) {
                document.body.classList.remove('no-scroll');
            }
        }, 350);
    }

    // ================================================================
    // Image Preloading
    // ================================================================

    function preloadNext() {
        const nextIndex = getRandomIndex();
        preloadedIndex = nextIndex;
        const artwork = ARTWORKS[nextIndex];
        preloadedImage = new Image();
        preloadedImage.src = getImageUrl(artwork);
    }

    // ================================================================
    // Transitions
    // ================================================================

    function fadeOutView() {
        return new Promise((resolve) => {
            artworkView.classList.add('fade-out');
            artworkView.classList.remove('fade-in');
            setTimeout(resolve, 500);
        });
    }

    function fadeInView() {
        artworkView.classList.remove('fade-out');
        artworkView.classList.add('fade-in');
    }

    // ================================================================
    // Main: Discover Art
    // ================================================================

    async function discoverArt(direction) {
        if (isLoading) return;
        isLoading = true;
        discoverBtn.disabled = true;

        let artworkIndex;

        if (direction === 'back' && historyPos > 0) {
            historyPos--;
            artworkIndex = navHistory[historyPos];
        } else if (direction === 'forward' && historyPos < navHistory.length - 1) {
            historyPos++;
            artworkIndex = navHistory[historyPos];
        } else {
            // New random (use preloaded if available)
            if (preloadedIndex >= 0 && preloadedIndex !== lastIndex) {
                artworkIndex = preloadedIndex;
            } else {
                artworkIndex = getRandomIndex();
            }
            // Trim forward history if we went back and now go new
            navHistory = navHistory.slice(0, historyPos + 1);
            navHistory.push(artworkIndex);
            historyPos = navHistory.length - 1;
        }

        lastIndex = artworkIndex;
        viewCount++;

        const artwork = ARTWORKS[artworkIndex];

        // First time: hide hero, show artwork view
        if (!hero.classList.contains('hero-hidden')) {
            hero.classList.add('hero-hidden');
            document.body.classList.remove('no-scroll');
            artworkView.classList.remove('hidden');
            discoverBtn.classList.remove('hidden');
            keyboardHint.classList.remove('hidden');
            progressBar.classList.remove('hidden');
            // Brief delay then show hint
            setTimeout(() => keyboardHint.classList.add('visible'), 2000);
            // Hide hint after a while
            setTimeout(() => keyboardHint.classList.remove('visible'), 8000);
        } else {
            // Subsequent: crossfade
            await fadeOutView();
        }

        // Render data
        renderArtwork(artwork, artworkIndex);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Load image
        await loadImage(artwork);

        // Fade in
        fadeInView();

        // Preload next
        preloadedIndex = -1;
        preloadedImage = null;
        setTimeout(preloadNext, 1500);

        isLoading = false;
        discoverBtn.disabled = false;
    }

    // ================================================================
    // Event Listeners
    // ================================================================

    // Hero button
    heroDiscoverBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        discoverArt();
    });

    // Clicking anywhere on the hero also triggers
    hero.addEventListener('click', () => {
        if (!hero.classList.contains('hero-hidden')) {
            discoverArt();
        }
    });

    // Scrolling down on the hero triggers the first artwork
    let heroScrollTriggered = false;
    window.addEventListener('wheel', (e) => {
        if (!hero.classList.contains('hero-hidden') && !heroScrollTriggered && e.deltaY > 0) {
            heroScrollTriggered = true;
            discoverArt();
        }
    }, { passive: true });

    // Floating button
    discoverBtn.addEventListener('click', () => discoverArt());

    // Artwork image click → open lightbox
    artworkImage.addEventListener('click', () => {
        if (artworkImage.classList.contains('visible')) {
            openLightbox();
        }
    });

    // Lightbox close handlers
    lightboxClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeLightbox();
    });
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    // ================================================================
    // Touch / Swipe Support
    // ================================================================
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    document.addEventListener('touchstart', (e) => {
        // Don't track if lightbox is open
        if (lightbox.classList.contains('visible')) return;
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
        touchStartTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (lightbox.classList.contains('visible')) return;
        if (hero && !hero.classList.contains('hero-hidden')) return;

        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const dt = Date.now() - touchStartTime;

        // Must be a horizontal swipe: >70px horizontal, less vertical, within 400ms
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 400) {
            if (dx < 0) {
                // Swipe left → next artwork
                discoverArt();
            } else {
                // Swipe right → previous artwork
                discoverArt('back');
            }
        }
    }, { passive: true });

    // ================================================================
    // Keyboard
    // ================================================================
    document.addEventListener('keydown', (e) => {
        // Don't trigger if user is in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Escape closes lightbox
        if (e.code === 'Escape' && lightbox.classList.contains('visible')) {
            closeLightbox();
            return;
        }

        // Don't navigate while lightbox is open
        if (lightbox.classList.contains('visible')) return;

        if (e.code === 'Space') {
            e.preventDefault();
            discoverArt();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            discoverArt('forward');
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            discoverArt('back');
        } else if (e.code === 'Enter' && !hero.classList.contains('hero-hidden')) {
            e.preventDefault();
            discoverArt();
        }
    });

})();
