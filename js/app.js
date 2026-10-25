/**
 * Interactive Museum Exhibit - Main Application
 * Vanilla JavaScript, no dependencies
 */

(function() {
  'use strict';

  // ===== STATE =====
  const state = {
    currentSide: 'front',
    activeHotspot: null,
    isFlipping: false,
    editMode: false,
    editPoints: []
  };

  // ===== DOM REFERENCES =====
  let cardInner, flipButton, curatorContent;
  let frontOverlay, backOverlay;
  let contactModal, contactForm;

  // ===== INITIALIZATION =====
  function init() {
    // Check for edit mode
    state.editMode = new URLSearchParams(window.location.search).has('edit');
    
    // Cache DOM elements
    cardInner = document.querySelector('.card-inner');
    flipButton = document.getElementById('flip-button');
    curatorContent = document.getElementById('curator-content');
    frontOverlay = document.getElementById('front-overlay');
    backOverlay = document.getElementById('back-overlay');
    contactModal = document.getElementById('contact-modal');
    contactForm = document.getElementById('contact-form');

    // Initialize hotspots
    renderHotspots();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize edit mode if enabled
    if (state.editMode) {
      initEditMode();
    }

    // Show initial placeholder
    showPlaceholder();
  }

  // ===== HOTSPOT RENDERING =====
  function renderHotspots() {
    // Clear existing hotspots
    clearHotspots(frontOverlay);
    clearHotspots(backOverlay);

    // Render hotspots for each side
    hotspots.forEach(hotspot => {
      const overlay = hotspot.side === 'front' ? frontOverlay : backOverlay;
      const polygon = createHotspotPolygon(hotspot);
      overlay.appendChild(polygon);
    });
  }

  function clearHotspots(overlay) {
    const polygons = overlay.querySelectorAll('.hotspot-polygon');
    polygons.forEach(p => p.remove());
  }

  function createHotspotPolygon(hotspot) {
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    
    // Convert polygon points to SVG format
    const points = hotspot.polygon.map(p => p.join(',')).join(' ');
    polygon.setAttribute('points', points);
    polygon.setAttribute('class', 'hotspot-polygon');
    polygon.setAttribute('data-hotspot-id', hotspot.id);
    
    // Accessibility attributes
    polygon.setAttribute('tabindex', '0');
    polygon.setAttribute('role', 'button');
    polygon.setAttribute('aria-label', hotspot.title);
    
    // Event listeners
    polygon.addEventListener('mouseenter', () => handleHotspotHover(hotspot));
    polygon.addEventListener('mouseleave', handleHotspotLeave);
    polygon.addEventListener('click', () => handleHotspotClick(hotspot));
    polygon.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleHotspotClick(hotspot);
      }
    });
    polygon.addEventListener('focus', () => handleHotspotHover(hotspot));
    polygon.addEventListener('blur', handleHotspotLeave);

    return polygon;
  }

  // ===== HOTSPOT INTERACTIONS =====
  function handleHotspotHover(hotspot) {
    if (state.isFlipping) return;
    updateCuratorPanel(hotspot);
    highlightHotspot(hotspot.id);
  }

  function handleHotspotLeave() {
    if (state.activeHotspot) {
      // Keep showing active hotspot info
      updateCuratorPanel(state.activeHotspot);
      highlightHotspot(state.activeHotspot.id);
    } else {
      showPlaceholder();
      clearHighlights();
    }
  }

  function handleHotspotClick(hotspot) {
    if (state.isFlipping) return;
    
    // Toggle active state
    if (state.activeHotspot && state.activeHotspot.id === hotspot.id) {
      state.activeHotspot = null;
      showPlaceholder();
      clearHighlights();
    } else {
      state.activeHotspot = hotspot;
      updateCuratorPanel(hotspot);
      highlightHotspot(hotspot.id, true);
    }
  }

  function highlightHotspot(id, isActive = false) {
    clearHighlights();
    const polygon = document.querySelector(`[data-hotspot-id="${id}"]`);
    if (polygon) {
      polygon.classList.add('active');
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.hotspot-polygon.active').forEach(p => {
      p.classList.remove('active');
    });
  }

  // ===== CURATOR PANEL =====
  function updateCuratorPanel(hotspot) {
    curatorContent.innerHTML = `
      <div class="hotspot-detail">
        <h3>${escapeHtml(hotspot.title)}</h3>
        <div class="hotspot-narrative">
          ${hotspot.narrative}
        </div>
        <a href="${escapeHtml(hotspot.link.url)}" 
           target="_blank" 
           rel="noopener noreferrer" 
           class="hotspot-link">
          ${escapeHtml(hotspot.link.label)}
        </a>
      </div>
    `;
  }

  function showPlaceholder() {
    curatorContent.innerHTML = `
      <div class="panel-placeholder">
        <div class="panel-placeholder-icon" aria-hidden="true">🏛️</div>
        <p>Hover over or click any highlighted region on the artifact to explore its history.</p>
        <p style="margin-top: var(--spacing-md); font-size: 0.875rem;">
          Use the flip button to examine both sides of the cabinet card.
        </p>
      </div>
    `;
  }

  // ===== CARD FLIP =====
  function setupFlipButton() {
    flipButton.addEventListener('click', flipCard);
    flipButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        flipCard();
      }
    });
  }

  function flipCard() {
    if (state.isFlipping) return;
    
    state.isFlipping = true;
    state.activeHotspot = null;
    clearHighlights();
    showPlaceholder();

    // Toggle flip state
    const isFlipped = cardInner.classList.toggle('flipped');
    state.currentSide = isFlipped ? 'reverse' : 'front';
    
    // Update button state
    flipButton.setAttribute('aria-pressed', isFlipped);
    flipButton.querySelector('.flip-label').textContent = 
      isFlipped ? 'View Front' : 'View Reverse';

    // Re-enable interactions after animation
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = prefersReducedMotion ? 50 : 800;
    
    setTimeout(() => {
      state.isFlipping = false;
    }, delay);
  }

  // ===== CONTACT MODAL =====
  function setupContactModal() {
    const contactButton = document.getElementById('contact-button');
    const closeButton = document.getElementById('modal-close');
    const overlay = contactModal;

    contactButton.addEventListener('click', openModal);
    closeButton.addEventListener('click', closeModal);
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('visible')) {
        closeModal();
      }
    });

    // Handle form submission
    contactForm.addEventListener('submit', handleContactSubmit);
  }

  function openModal() {
    contactModal.classList.add('visible');
    contactModal.setAttribute('aria-hidden', 'false');
    document.getElementById('contact-name').focus();
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    contactModal.classList.remove('visible');
    contactModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.getElementById('contact-button').focus();
  }

  function handleContactSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('contact-name').value.trim();
    const email = document.getElementById('contact-email').value.trim();
    const message = document.getElementById('contact-message').value.trim();

    // Build mailto link
    const subject = encodeURIComponent('Museum Exhibit Inquiry');
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    );
    
    // Open email client
    window.location.href = `mailto:curator@example.com?subject=${subject}&body=${body}`;
    
    // Close modal
    closeModal();
    
    // Reset form
    contactForm.reset();
  }

  // ===== EDIT MODE =====
  function initEditMode() {
    document.body.classList.add('edit-mode');
    
    // Add edit mode banner
    const banner = document.createElement('div');
    banner.className = 'edit-mode-banner';
    banner.innerHTML = `
      <strong>Edit Mode Active</strong> — Click on the image to add polygon points. 
      Press <code>C</code> to copy coordinates, <code>R</code> to reset.
    `;
    document.body.prepend(banner);

    // Add click handlers to card faces
    const cardFront = document.querySelector('.card-front');
    const cardBack = document.querySelector('.card-back');
    
    cardFront.addEventListener('click', handleEditClick);
    cardBack.addEventListener('click', handleEditClick);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleEditKeydown);

    console.log('%c🎨 Edit Mode Active', 'font-size: 16px; font-weight: bold;');
    console.log('Click on the image to add polygon points.');
    console.log('Press C to copy coordinates as array, R to reset points.');
  }

  function handleEditClick(e) {
    // Get click position relative to the overlay
    const overlay = state.currentSide === 'front' ? frontOverlay : backOverlay;
    const rect = overlay.getBoundingClientRect();
    
    // Calculate position in viewBox coordinates
    const viewBox = overlay.viewBox.baseVal;
    const scaleX = viewBox.width / rect.width;
    const scaleY = viewBox.height / rect.height;
    
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    state.editPoints.push([x, y]);
    
    // Log to console
    console.log(`Point added: [${x}, ${y}]`);
    console.log(`Current polygon: [${state.editPoints.map(p => `[${p.join(', ')}]`).join(', ')}]`);
    
    // Draw visual indicator
    drawEditPoint(overlay, x, y);
  }

  function drawEditPoint(overlay, x, y) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '8');
    circle.setAttribute('fill', '#dc3545');
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('class', 'edit-point');
    overlay.appendChild(circle);

    // Draw connecting line if we have multiple points
    if (state.editPoints.length > 1) {
      const prev = state.editPoints[state.editPoints.length - 2];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', prev[0]);
      line.setAttribute('y1', prev[1]);
      line.setAttribute('x2', x);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', '#dc3545');
      line.setAttribute('stroke-width', '2');
      line.setAttribute('class', 'edit-line');
      overlay.appendChild(line);
    }
  }

  function handleEditKeydown(e) {
    if (e.key.toLowerCase() === 'c') {
      // Copy to clipboard
      const polygonStr = JSON.stringify(state.editPoints);
      navigator.clipboard.writeText(polygonStr).then(() => {
        console.log('%c✓ Polygon copied to clipboard!', 'color: green; font-weight: bold;');
        console.log(polygonStr);
      }).catch(() => {
        console.log('%c✗ Could not copy. Here\'s the polygon:', 'color: red;');
        console.log(polygonStr);
      });
    } else if (e.key.toLowerCase() === 'r') {
      // Reset points
      state.editPoints = [];
      
      // Remove visual indicators
      document.querySelectorAll('.edit-point, .edit-line').forEach(el => el.remove());
      
      console.log('%c✓ Points reset', 'color: blue; font-weight: bold;');
    }
  }

  // ===== UTILITY FUNCTIONS =====
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ===== EVENT LISTENERS SETUP =====
  function setupEventListeners() {
    setupFlipButton();
    setupContactModal();

    // Handle window resize for responsive hotspot positioning
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Hotspots use viewBox so they scale automatically
        // This is here for any future resize-dependent logic
      }, 100);
    });
  }

  // ===== START APPLICATION =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
