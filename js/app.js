/**
 * Interactive Museum Exhibit - Main Application
 * Vanilla JavaScript, no dependencies
 */

(function() {
  'use strict';

  // ===== CONFIGURATION =====
  // Contact email address - change this to your actual email
  const CONTACT_EMAIL = 'curator@example.com';
  
  // Padding around dynamically computed hotspot polygons (pixels in viewBox space)
  const HOTSPOT_PADDING = 3;
  
  // ViewBox dimensions for coordinate conversion
  const VIEWBOX_WIDTH = 807;
  const VIEWBOX_HEIGHT = 1024;

  // ===== STATE =====
  const state = {
    currentSide: 'front',
    activeHotspot: null,
    isFlipping: false,
    editMode: false,
    editPoints: [],
    modalOpen: false,
    dynamicPolygonsReady: false
  };

  // ===== DOM REFERENCES =====
  let cardInner, flipButton, curatorContent;
  let frontOverlay, backOverlay;
  let contactModal, contactForm;
  let reverseContent, reverseWrapper;

  // ===== INITIALIZATION =====
  function init() {
    // Check for edit mode
    state.editMode = new URLSearchParams(window.location.search).has('edit');
    
    // Cache DOM elements
    cardInner = document.getElementById('card-inner');
    flipButton = document.getElementById('flip-button');
    curatorContent = document.getElementById('curator-content');
    frontOverlay = document.getElementById('front-overlay');
    backOverlay = document.getElementById('back-overlay');
    contactModal = document.getElementById('contact-modal');
    contactForm = document.getElementById('contact-form');
    reverseContent = document.getElementById('reverse-content');
    reverseWrapper = document.querySelector('.reverse-scale-wrapper');

    // Initialize reverse side scaling
    initReverseScaling();
    
    // Initial render with static fallback polygons
    renderHotspots();
    
    // Set initial visibility (hide back hotspots from tab order)
    updateHotspotVisibility();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize edit mode if enabled
    if (state.editMode) {
      initEditMode();
    }

    // Show initial placeholder
    showPlaceholder();
    
    // Initialize dynamic polygon computation after fonts load
    initDynamicPolygons();
  }

  // ===== REVERSE SIDE SCALING =====
  function initReverseScaling() {
    // Scale the fixed-size reverse content to fit its container
    scaleReverseContent();
    
    // Re-scale on resize
    window.addEventListener('resize', debounce(scaleReverseContent, 100));
  }

  function scaleReverseContent() {
    if (!reverseContent || !reverseWrapper) return;
    
    const wrapperRect = reverseWrapper.getBoundingClientRect();
    const contentWidth = VIEWBOX_WIDTH;
    const contentHeight = VIEWBOX_HEIGHT;
    
    // Calculate scale to fit
    const scaleX = wrapperRect.width / contentWidth;
    const scaleY = wrapperRect.height / contentHeight;
    const scale = Math.min(scaleX, scaleY);
    
    reverseContent.style.transform = `scale(${scale})`;
  }
  
  // ===== DYNAMIC POLYGON COMPUTATION =====
  // Computes hotspot polygons at runtime from actual text positions
  // This ensures hotspots align regardless of which font renders
  
  function initDynamicPolygons() {
    // Compute after fonts are ready, but only if reverse is visible
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (state.currentSide === 'reverse') {
          computeDynamicPolygons();
        }
      });
    }
    
    // Recompute when fonts finish loading (catches late-loading fonts)
    if (document.fonts) {
      document.fonts.addEventListener('loadingdone', () => {
        if (state.currentSide === 'reverse') {
          computeDynamicPolygons();
        }
      });
    }
    
    // Recompute on resize (debounced), only if reverse is visible
    window.addEventListener('resize', debounce(() => {
      if (state.currentSide === 'reverse') {
        computeDynamicPolygons();
      }
    }, 150));
  }
  
  function computeDynamicPolygons() {
    // Only compute when reverse side is visible to ensure accurate measurements
    // (text must be rendered without 180° rotation to get correct coordinates)
    if (state.currentSide !== 'reverse') {
      return;
    }
    
    // Only compute for reverse-side hotspots (front side uses static image coordinates)
    const reverseHotspots = hotspots.filter(h => h.side === 'reverse');
    
    reverseHotspots.forEach(hotspot => {
      const polygon = computePolygonFromTextSpan(hotspot.id);
      if (polygon && polygon.length >= 3) {
        updateHotspotPolygon(hotspot.id, polygon);
      }
    });
    
    state.dynamicPolygonsReady = true;
  }
  
  function computePolygonFromTextSpan(hotspotId) {
    // Find the text span with data-hotspot attribute
    const span = document.querySelector(`[data-hotspot="${hotspotId}"]`);
    if (!span || !reverseContent) return null;
    
    // Get all client rects (handles multi-line text)
    const rects = span.getClientRects();
    if (rects.length === 0) return null;
    
    // Get the reverse content container rect for coordinate conversion
    const containerRect = reverseContent.getBoundingClientRect();
    
    // Get the current scale factor
    const transform = getComputedStyle(reverseContent).transform;
    let scale = 1;
    if (transform && transform !== 'none') {
      const match = transform.match(/matrix\(([^,]+)/);
      if (match) scale = parseFloat(match[1]);
    }
    
    // Collect all rect bounds in viewBox coordinates
    const allBounds = [];
    for (const rect of rects) {
      // Convert from screen coordinates to 807x1024 viewBox coordinates
      const left = (rect.left - containerRect.left) / scale;
      const right = (rect.right - containerRect.left) / scale;
      const top = (rect.top - containerRect.top) / scale;
      const bottom = (rect.bottom - containerRect.top) / scale;
      
      allBounds.push({ left, right, top, bottom });
    }
    
    // Build polygon covering all rects with padding
    // For single-line text: simple rectangle
    // For multi-line text: create a polygon covering all lines
    
    if (allBounds.length === 1) {
      // Single line - create a padded rectangle
      const b = allBounds[0];
      return [
        [Math.round(b.left - HOTSPOT_PADDING), Math.round(b.top - HOTSPOT_PADDING)],
        [Math.round(b.right + HOTSPOT_PADDING), Math.round(b.top - HOTSPOT_PADDING)],
        [Math.round(b.right + HOTSPOT_PADDING), Math.round(b.bottom + HOTSPOT_PADDING)],
        [Math.round(b.left - HOTSPOT_PADDING), Math.round(b.bottom + HOTSPOT_PADDING)]
      ];
    }
    
    // Multi-line text - create a polygon that covers all lines
    // Sort by vertical position
    allBounds.sort((a, b) => a.top - b.top);
    
    // Build a complex polygon: go down the left side, then up the right side
    const polygon = [];
    
    // Left side (top to bottom)
    for (const b of allBounds) {
      polygon.push([Math.round(b.left - HOTSPOT_PADDING), Math.round(b.top - HOTSPOT_PADDING)]);
      polygon.push([Math.round(b.left - HOTSPOT_PADDING), Math.round(b.bottom + HOTSPOT_PADDING)]);
    }
    
    // Right side (bottom to top)
    for (let i = allBounds.length - 1; i >= 0; i--) {
      const b = allBounds[i];
      polygon.push([Math.round(b.right + HOTSPOT_PADDING), Math.round(b.bottom + HOTSPOT_PADDING)]);
      polygon.push([Math.round(b.right + HOTSPOT_PADDING), Math.round(b.top - HOTSPOT_PADDING)]);
    }
    
    return polygon;
  }
  
  function updateHotspotPolygon(hotspotId, polygon) {
    const polygonEl = backOverlay.querySelector(`[data-hotspot-id="${hotspotId}"]`);
    if (!polygonEl) return;
    
    // Convert polygon array to SVG points string
    const points = polygon.map(p => p.join(',')).join(' ');
    polygonEl.setAttribute('points', points);
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
    if (!overlay) return;
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
    polygon.setAttribute('data-hotspot-side', hotspot.side);
    
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

  // ===== HOTSPOT VISIBILITY =====
  function updateHotspotVisibility() {
    // Make hidden face's hotspots non-focusable and non-interactive
    const frontHotspots = frontOverlay.querySelectorAll('.hotspot-polygon');
    const backHotspots = backOverlay.querySelectorAll('.hotspot-polygon');
    
    if (state.currentSide === 'front') {
      frontHotspots.forEach(h => {
        h.setAttribute('tabindex', '0');
        h.style.pointerEvents = 'auto';
      });
      backHotspots.forEach(h => {
        h.setAttribute('tabindex', '-1');
        h.style.pointerEvents = 'none';
      });
    } else {
      frontHotspots.forEach(h => {
        h.setAttribute('tabindex', '-1');
        h.style.pointerEvents = 'none';
      });
      backHotspots.forEach(h => {
        h.setAttribute('tabindex', '0');
        h.style.pointerEvents = 'auto';
      });
    }
  }

  // ===== HOTSPOT INTERACTIONS =====
  function handleHotspotHover(hotspot) {
    if (state.isFlipping) return;
    // Only respond if this hotspot is on the visible side
    if (hotspot.side !== state.currentSide) return;
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
    // Only respond if this hotspot is on the visible side
    if (hotspot.side !== state.currentSide) return;
    
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

    // Update hotspot visibility after flip animation
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const delay = prefersReducedMotion ? 50 : 800;
    
    setTimeout(() => {
      state.isFlipping = false;
      updateHotspotVisibility();
      // Re-scale reverse content after flip
      if (state.currentSide === 'reverse') {
        scaleReverseContent();
        // Recompute dynamic polygons when reverse side becomes visible
        computeDynamicPolygons();
      }
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
      if (e.key === 'Escape' && state.modalOpen) {
        closeModal();
      }
    });

    // Handle form submission
    contactForm.addEventListener('submit', handleContactSubmit);
    
    // Focus trap
    contactModal.addEventListener('keydown', handleModalKeydown);
  }

  function openModal() {
    state.modalOpen = true;
    contactModal.classList.add('visible');
    contactModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Focus first input after animation
    setTimeout(() => {
      document.getElementById('contact-name').focus();
    }, 100);
  }

  function closeModal() {
    state.modalOpen = false;
    contactModal.classList.remove('visible');
    contactModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.getElementById('contact-button').focus();
  }

  function handleModalKeydown(e) {
    if (e.key !== 'Tab' || !state.modalOpen) return;
    
    // Get all focusable elements in the modal
    const focusableElements = contactModal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    // Trap focus within the modal
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
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
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    
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
    const overlay = state.currentSide === 'front' ? frontOverlay : reverseContent;
    const rect = overlay.getBoundingClientRect();
    
    let x, y;
    
    if (state.currentSide === 'front') {
      // Front side: calculate position in viewBox coordinates
      const viewBox = frontOverlay.viewBox.baseVal;
      const scaleX = viewBox.width / rect.width;
      const scaleY = viewBox.height / rect.height;
      x = Math.round((e.clientX - rect.left) * scaleX);
      y = Math.round((e.clientY - rect.top) * scaleY);
    } else {
      // Reverse side: get position in the fixed 807x1024 space
      const scale = parseFloat(reverseContent.style.transform.match(/scale\(([\d.]+)\)/)?.[1] || 1);
      const contentRect = reverseContent.getBoundingClientRect();
      x = Math.round((e.clientX - contentRect.left) / scale);
      y = Math.round((e.clientY - contentRect.top) / scale);
    }
    
    state.editPoints.push([x, y]);
    
    // Log to console
    console.log(`Point added: [${x}, ${y}]`);
    console.log(`Current polygon: [${state.editPoints.map(p => `[${p.join(', ')}]`).join(', ')}]`);
    
    // Draw visual indicator
    drawEditPoint(state.currentSide === 'front' ? frontOverlay : backOverlay, x, y);
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

  function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // ===== EVENT LISTENERS SETUP =====
  function setupEventListeners() {
    setupFlipButton();
    setupContactModal();

    // Handle window resize
    window.addEventListener('resize', debounce(() => {
      scaleReverseContent();
    }, 100));
  }

  // ===== START APPLICATION =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
