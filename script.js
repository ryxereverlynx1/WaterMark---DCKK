/**
 * WaterMark - DCKK: Professional Browser-Based Image Watermark Utility
 * Primary use: DCKK JEWELERS
 * Architecture: 100% Client-side, Vanilla JS, HTML5 Canvas 2D
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Default Configuration & Application State
  // ---------------------------------------------------------------------------
  const DEFAULTS = {
    text: 'DCKK JEWELERS',
    opacity: 25,          // 5% - 70%
    spacing: 2.0,         // 1.0 (Dense), 2.0 (Balanced), 3.0 (Wide)
    isAutoFontSize: true,
    fontSizeFactor: 1.0,  // Manual multiplier relative to auto
    fontWeight: '500',    // '400' | '500' | '600' | '700'
    colorMode: 'white',   // 'white' | 'black' | 'custom'
    textColor: '#FFFFFF',
    customColor: '#B59A63',
    rotation: -35,        // -60° to +60°
    exportFormat: 'image/png', // 'image/png' | 'image/jpeg'
    jpegQuality: 0.92     // 0.60 - 1.00
  };

  const state = {
    originalImage: null,  // HTMLImageElement
    originalFile: null,   // File object or synthetic sample descriptor
    objectUrl: null,      // String URL created with URL.createObjectURL
    previewImage: null,   // Scaled down HTMLCanvasElement or Image for fast 60fps preview
    previewScale: 1.0,    // Ratio of preview width to original width
    viewMode: 'watermarked', // 'original' | 'watermarked' | 'compare'
    comparePosition: 50,  // Percentage (0 - 100)
    isDraggingCompare: false,
    isExporting: false,
    renderPending: false, // For requestAnimationFrame batching
    settings: { ...DEFAULTS }
  };

  // ---------------------------------------------------------------------------
  // DOM Elements
  // ---------------------------------------------------------------------------
  const DOM = {
    // Dropzone & File Input
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    browseBtn: document.getElementById('browse-btn'),
    sampleButtons: document.querySelectorAll('.sample-pill-btn'),

    // Preview Workspace & Toolbar
    previewWorkspace: document.getElementById('preview-workspace'),
    previewStage: document.getElementById('preview-stage'),
    modeOriginalBtn: document.getElementById('mode-original-btn'),
    modeWatermarkedBtn: document.getElementById('mode-watermarked-btn'),
    modeCompareBtn: document.getElementById('mode-compare-btn'),
    fitViewBtn: document.getElementById('fit-view-btn'),
    replaceImageBtn: document.getElementById('replace-image-btn'),
    clearImageBtn: document.getElementById('clear-image-btn'),

    // Canvas elements
    canvasWrapper: document.getElementById('canvas-wrapper'),
    previewCanvas: document.getElementById('preview-canvas'),
    exportCanvas: document.getElementById('export-canvas'),

    // Comparison Split View
    compareContainer: document.getElementById('compare-container'),
    compareBaseCanvas: document.getElementById('compare-base-canvas'),
    compareWatermarkedCanvas: document.getElementById('compare-watermarked-canvas'),
    compareClippedLayer: document.getElementById('compare-clipped-layer'),
    compareDivider: document.getElementById('compare-divider'),

    // Metadata Bar
    metaFilename: document.getElementById('meta-filename'),
    metaDimensions: document.getElementById('meta-dimensions'),
    metaFilesize: document.getElementById('meta-filesize'),
    metaZoom: document.getElementById('meta-zoom'),

    // Settings Controls
    resetSettingsBtn: document.getElementById('reset-settings-btn'),
    textInput: document.getElementById('watermark-text-input'),
    textCharCount: document.getElementById('text-char-count'),
    textError: document.getElementById('text-error'),

    opacitySlider: document.getElementById('opacity-slider'),
    opacityVal: document.getElementById('opacity-val'),

    spacingSlider: document.getElementById('spacing-slider'),
    spacingVal: document.getElementById('spacing-val'),

    autoSizeToggle: document.getElementById('auto-size-toggle'),
    sizeSlider: document.getElementById('size-slider'),
    sizeVal: document.getElementById('size-val'),

    weightButtons: document.querySelectorAll('.pill-option[data-weight]'),
    colorButtons: document.querySelectorAll('.color-swatch-btn[data-color]'),
    customColorInput: document.getElementById('custom-color-input'),
    customColorPreview: document.getElementById('custom-color-preview'),
    customColorLabel: document.getElementById('custom-color-label'),

    rotationSlider: document.getElementById('rotation-slider'),
    rotationVal: document.getElementById('rotation-val'),

    // Export Controls
    exportFormatSelect: document.getElementById('export-format-select'),
    jpegQualityGroup: document.getElementById('jpeg-quality-group'),
    jpegQualitySlider: document.getElementById('jpeg-quality-slider'),
    jpegQualityVal: document.getElementById('jpeg-quality-val'),
    exportResText: document.getElementById('export-res-text'),
    downloadBtn: document.getElementById('download-btn'),
    btnText: document.querySelector('.download-btn .btn-text'),
    btnSpinner: document.querySelector('.download-btn .btn-spinner'),
    exportToast: document.getElementById('export-status-toast'),
    exportStatusMsg: document.getElementById('export-status-msg'),

    // Dialog & Live region
    openPrivacyBtn: document.getElementById('open-privacy-btn'),
    privacyDialog: document.getElementById('privacy-dialog'),
    closeDialogBtn: document.getElementById('close-dialog-btn'),
    dialogGotItBtn: document.getElementById('dialog-got-it-btn'),
    srAnnouncements: document.getElementById('sr-announcements')
  };

  // ---------------------------------------------------------------------------
  // Accessibility Live Announcements
  // ---------------------------------------------------------------------------
  function announce(message) {
    if (DOM.srAnnouncements) {
      DOM.srAnnouncements.textContent = '';
      setTimeout(() => {
        DOM.srAnnouncements.textContent = message;
      }, 50);
    }
  }

  // ---------------------------------------------------------------------------
  // File Format & Helper Utilities
  // ---------------------------------------------------------------------------
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function sanitizeFilename(name) {
    return (name || 'image')
      .replace(/\.[^/.]+$/, '') // remove extension
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
  }

  // ---------------------------------------------------------------------------
  // Image Loading & Validation
  // ---------------------------------------------------------------------------
  function validateFile(file) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!file) return { valid: false, error: 'No file selected.' };
    if (!validTypes.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported format "${file.type || 'unknown'}". Please select JPG, PNG, or WebP.`
      };
    }
    return { valid: true };
  }

  function handleFileSelection(file) {
    const validation = validateFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    // Cleanup previous object URL
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
    }

    state.originalFile = file;
    state.objectUrl = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
      state.originalImage = img;
      onImageLoaded(file.name, file.size);
    };
    img.onerror = () => {
      alert('Unable to load image. The file may be corrupted.');
      clearCurrentImage();
    };
    img.src = state.objectUrl;
  }

  function onImageLoaded(filename, filesize) {
    const origW = state.originalImage.naturalWidth;
    const origH = state.originalImage.naturalHeight;

    // Create a scaled preview canvas for performance with very large files
    // If image > 1800px on any side, scale preview for smooth 60fps slider drags
    const maxPreviewDim = 1800;
    if (origW > maxPreviewDim || origH > maxPreviewDim) {
      state.previewScale = Math.min(maxPreviewDim / origW, maxPreviewDim / origH);
    } else {
      state.previewScale = 1.0;
    }

    const previewW = Math.round(origW * state.previewScale);
    const previewH = Math.round(origH * state.previewScale);

    // Create offscreen preview buffer
    const offscreen = document.createElement('canvas');
    offscreen.width = previewW;
    offscreen.height = previewH;
    const offCtx = offscreen.getContext('2d');
    offCtx.drawImage(state.originalImage, 0, 0, previewW, previewH);
    state.previewImage = offscreen;

    // Update metadata readouts
    DOM.metaFilename.textContent = filename;
    DOM.metaFilename.title = filename;
    DOM.metaDimensions.textContent = `${origW.toLocaleString()} × ${origH.toLocaleString()} px`;
    DOM.metaFilesize.textContent = formatBytes(filesize);
    DOM.exportResText.textContent = `Full Resolution: ${origW} × ${origH} px`;

    // Toggle views
    DOM.dropZone.classList.add('hidden');
    DOM.previewWorkspace.classList.remove('hidden');
    DOM.downloadBtn.disabled = !isTextValid();

    // Default to watermarked view
    setViewMode('watermarked');
    updateFontSizeDisplay();
    requestRender();

    announce(`Loaded image ${filename}, ${origW} by ${origH} pixels.`);
  }

  function clearCurrentImage() {
    if (state.objectUrl) {
      URL.revokeObjectURL(state.objectUrl);
      state.objectUrl = null;
    }
    state.originalImage = null;
    state.originalFile = null;
    state.previewImage = null;
    state.viewMode = 'watermarked';

    DOM.previewWorkspace.classList.add('hidden');
    DOM.dropZone.classList.remove('hidden');
    DOM.fileInput.value = '';
    DOM.downloadBtn.disabled = true;

    announce('Image cleared. Returned to upload screen.');
  }

  // ---------------------------------------------------------------------------
  // Watermark Drawing Engine (Core Algorithm)
  // ---------------------------------------------------------------------------
  /**
   * Draws repeating diagonal watermark pattern onto the specified context.
   * Uses original image coordinate system scaled by `renderScale`.
   * 
   * @param {CanvasRenderingContext2D} ctx - Target 2D canvas context
   * @param {number} width - Target canvas width
   * @param {number} height - Target canvas height
   * @param {object} settings - Watermark settings configuration
   * @param {number} renderScale - Ratio relative to original image size
   */
  function drawWatermarkPattern(ctx, width, height, settings, renderScale) {
    const text = (settings.text || '').trim();
    if (!text) return;

    // 1. Calculate Font Size
    // Auto scale: ~3.8% of min(width, height) at 1:1, scaled by fontSizeFactor
    let baseFontSize;
    if (settings.isAutoFontSize) {
      const minDimension = Math.min(width, height);
      baseFontSize = Math.max(14, Math.round(minDimension * 0.038));
    } else {
      // Manual scaling anchored to reference
      const minDimension = Math.min(width, height);
      baseFontSize = Math.max(12, Math.round(minDimension * 0.038 * settings.fontSizeFactor));
    }

    // 2. Configure Text Styles on Canvas
    ctx.save();
    ctx.font = `${settings.fontWeight} ${baseFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = Math.max(0.05, Math.min(0.70, settings.opacity / 100));

    // Resolve color
    let fillColor = settings.textColor;
    if (settings.colorMode === 'white') fillColor = '#FFFFFF';
    else if (settings.colorMode === 'black') fillColor = '#17191D';
    else if (settings.colorMode === 'custom') fillColor = settings.customColor;
    ctx.fillStyle = fillColor;

    // Optional crisp text rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 3. Measure Text for Dynamic Spacing
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;

    // 4. Calculate Grid Interval based on Spacing setting
    // spacing: 1 (Dense) -> 0.75x gap, 2 (Balanced) -> 1.35x gap, 3 (Wide) -> 2.2x gap
    let spacingMultiplier = 1.35;
    if (settings.spacing < 2.0) {
      // Interpolate between Dense (0.75) and Balanced (1.35)
      spacingMultiplier = 0.75 + (settings.spacing - 1.0) * (1.35 - 0.75);
    } else {
      // Interpolate between Balanced (1.35) and Wide (2.2)
      spacingMultiplier = 1.35 + (settings.spacing - 2.0) * (2.2 - 1.35);
    }

    const stepX = textWidth + (baseFontSize * 4.2 * spacingMultiplier);
    const stepY = baseFontSize * 3.4 * spacingMultiplier;

    // 5. Rotation Math & Rotated Bounding Box
    const rad = (settings.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));

    // Bounding box of rotated canvas
    const boundW = width * cos + height * sin;
    const boundH = width * sin + height * cos;

    // Translate coordinate origin to center of canvas and rotate
    ctx.translate(width / 2, height / 2);
    ctx.rotate(rad);

    // 6. Draw Grid with Row Staggering (Brick proof pattern)
    // Expand bounds by 1 step in all directions to prevent edge clipping
    const startX = -boundW / 2 - stepX * 1.5;
    const endX = boundW / 2 + stepX * 1.5;
    const startY = -boundH / 2 - stepY * 1.5;
    const endY = boundH / 2 + stepY * 1.5;

    let rowIndex = 0;
    for (let y = startY; y <= endY; y += stepY) {
      // Alternating row offset creates professional diagonal proof flow
      const rowOffset = (rowIndex % 2 === 0) ? 0 : stepX / 2;
      for (let x = startX; x <= endX; x += stepX) {
        ctx.fillText(text, x + rowOffset, y);
      }
      rowIndex++;
    }

    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Preview Rendering
  // ---------------------------------------------------------------------------
  function requestRender() {
    if (!state.originalImage) return;
    if (state.renderPending) return;

    state.renderPending = true;
    requestAnimationFrame(() => {
      state.renderPending = false;
      renderCurrentView();
    });
  }

  function renderCurrentView() {
    if (!state.originalImage || !state.previewImage) return;

    const pw = state.previewImage.width;
    const ph = state.previewImage.height;

    if (state.viewMode === 'original') {
      DOM.canvasWrapper.classList.remove('hidden');
      DOM.compareContainer.classList.add('hidden');

      DOM.previewCanvas.width = pw;
      DOM.previewCanvas.height = ph;
      const ctx = DOM.previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, pw, ph);
      ctx.drawImage(state.previewImage, 0, 0);

    } else if (state.viewMode === 'watermarked') {
      DOM.canvasWrapper.classList.remove('hidden');
      DOM.compareContainer.classList.add('hidden');

      DOM.previewCanvas.width = pw;
      DOM.previewCanvas.height = ph;
      const ctx = DOM.previewCanvas.getContext('2d');
      ctx.clearRect(0, 0, pw, ph);
      ctx.drawImage(state.previewImage, 0, 0);

      // Apply watermark pattern
      drawWatermarkPattern(ctx, pw, ph, state.settings, state.previewScale);

    } else if (state.viewMode === 'compare') {
      DOM.canvasWrapper.classList.add('hidden');
      DOM.compareContainer.classList.remove('hidden');

      // Base canvas: Original Image
      DOM.compareBaseCanvas.width = pw;
      DOM.compareBaseCanvas.height = ph;
      const baseCtx = DOM.compareBaseCanvas.getContext('2d');
      baseCtx.clearRect(0, 0, pw, ph);
      baseCtx.drawImage(state.previewImage, 0, 0);

      // Clipped top canvas: Watermarked Image
      DOM.compareWatermarkedCanvas.width = pw;
      DOM.compareWatermarkedCanvas.height = ph;
      const wmCtx = DOM.compareWatermarkedCanvas.getContext('2d');
      wmCtx.clearRect(0, 0, pw, ph);
      wmCtx.drawImage(state.previewImage, 0, 0);
      drawWatermarkPattern(wmCtx, pw, ph, state.settings, state.previewScale);

      updateCompareDivider();
    }
  }

  function setViewMode(mode) {
    state.viewMode = mode;

    DOM.modeOriginalBtn.classList.toggle('active', mode === 'original');
    DOM.modeOriginalBtn.setAttribute('aria-checked', mode === 'original');

    DOM.modeWatermarkedBtn.classList.toggle('active', mode === 'watermarked');
    DOM.modeWatermarkedBtn.setAttribute('aria-checked', mode === 'watermarked');

    DOM.modeCompareBtn.classList.toggle('active', mode === 'compare');
    DOM.modeCompareBtn.setAttribute('aria-checked', mode === 'compare');

    requestRender();
    announce(`Switched to ${mode} preview mode.`);
  }

  // ---------------------------------------------------------------------------
  // Comparison Split Slider Interactions
  // ---------------------------------------------------------------------------
  function updateCompareDivider() {
    const pos = Math.max(0, Math.min(100, state.comparePosition));
    DOM.compareDivider.style.left = `${pos}%`;
    DOM.compareDivider.setAttribute('aria-valuenow', Math.round(pos));

    // Right side reveals watermarked image
    DOM.compareClippedLayer.style.clipPath = `inset(0 0 0 ${pos}%)`;
  }

  function setupComparisonInteractions() {
    const divider = DOM.compareDivider;
    const container = DOM.compareContainer;

    function handlePointerMove(clientX) {
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;
      let percent = ((clientX - rect.left) / rect.width) * 100;
      percent = Math.max(0, Math.min(100, percent));
      state.comparePosition = percent;
      updateCompareDivider();
    }

    divider.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      state.isDraggingCompare = true;
      divider.classList.add('dragging');
      divider.setPointerCapture(e.pointerId);
      handlePointerMove(e.clientX);
      e.preventDefault();
    });

    divider.addEventListener('pointermove', (e) => {
      if (!state.isDraggingCompare) return;
      handlePointerMove(e.clientX);
    });

    divider.addEventListener('pointerup', (e) => {
      if (state.isDraggingCompare) {
        state.isDraggingCompare = false;
        divider.classList.remove('dragging');
        try { divider.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    });

    divider.addEventListener('pointercancel', (e) => {
      state.isDraggingCompare = false;
      divider.classList.remove('dragging');
    });

    // Also support clicking anywhere on compare container to move divider
    container.addEventListener('pointerdown', (e) => {
      if (e.target === divider || divider.contains(e.target)) return;
      handlePointerMove(e.clientX);
    });

    // Keyboard support for accessibility
    divider.addEventListener('keydown', (e) => {
      let step = 0;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        step = -3;
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        step = 3;
      } else if (e.key === 'PageDown') {
        step = -10;
      } else if (e.key === 'PageUp') {
        step = 10;
      } else if (e.key === 'Home') {
        state.comparePosition = 0;
        updateCompareDivider();
        e.preventDefault();
        return;
      } else if (e.key === 'End') {
        state.comparePosition = 100;
        updateCompareDivider();
        e.preventDefault();
        return;
      }

      if (step !== 0) {
        state.comparePosition = Math.max(0, Math.min(100, state.comparePosition + step));
        updateCompareDivider();
        e.preventDefault();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Watermark Settings Form Binding
  // ---------------------------------------------------------------------------
  function isTextValid() {
    return (state.settings.text || '').trim().length > 0;
  }

  function validateText() {
    const valid = isTextValid();
    if (!valid) {
      DOM.textError.classList.remove('hidden');
      DOM.textInput.setAttribute('aria-invalid', 'true');
      DOM.downloadBtn.disabled = true;
    } else {
      DOM.textError.classList.add('hidden');
      DOM.textInput.removeAttribute('aria-invalid');
      if (state.originalImage) {
        DOM.downloadBtn.disabled = false;
      }
    }
    return valid;
  }

  function updateFontSizeDisplay() {
    if (!state.originalImage) {
      DOM.sizeVal.textContent = 'Auto';
      return;
    }
    const minDim = Math.min(state.originalImage.naturalWidth, state.originalImage.naturalHeight);
    let pxSize;
    if (state.settings.isAutoFontSize) {
      pxSize = Math.max(14, Math.round(minDim * 0.038));
      DOM.sizeVal.textContent = `Auto (~${pxSize}px)`;
    } else {
      pxSize = Math.max(12, Math.round(minDim * 0.038 * state.settings.fontSizeFactor));
      DOM.sizeVal.textContent = `${pxSize}px`;
    }
  }

  function setupSettingsControls() {
    // 1. Watermark Text Input
    DOM.textInput.addEventListener('input', (e) => {
      const val = e.target.value;
      state.settings.text = val;
      DOM.textCharCount.textContent = `${val.length} / 100`;
      validateText();
      requestRender();
    });

    // 2. Opacity Slider
    DOM.opacitySlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.settings.opacity = val;
      DOM.opacityVal.textContent = `${val}%`;
      requestRender();
    });

    // 3. Spacing Slider
    DOM.spacingSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.settings.spacing = val;
      let label = 'Balanced';
      if (val < 1.45) label = 'Dense';
      else if (val > 2.55) label = 'Wide';
      DOM.spacingVal.textContent = label;
      requestRender();
    });

    // 4. Font Size Auto Toggle & Slider
    DOM.autoSizeToggle.addEventListener('click', () => {
      state.settings.isAutoFontSize = !state.settings.isAutoFontSize;
      DOM.autoSizeToggle.classList.toggle('active', state.settings.isAutoFontSize);
      DOM.autoSizeToggle.setAttribute('aria-pressed', state.settings.isAutoFontSize);

      if (state.settings.isAutoFontSize) {
        state.settings.fontSizeFactor = 1.0;
        DOM.sizeSlider.value = 1.0;
      }
      updateFontSizeDisplay();
      requestRender();
    });

    DOM.sizeSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.settings.fontSizeFactor = val;
      if (state.settings.isAutoFontSize) {
        state.settings.isAutoFontSize = false;
        DOM.autoSizeToggle.classList.remove('active');
        DOM.autoSizeToggle.setAttribute('aria-pressed', 'false');
      }
      updateFontSizeDisplay();
      requestRender();
    });

    // 5. Font Weight Selector
    DOM.weightButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        DOM.weightButtons.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        state.settings.fontWeight = btn.dataset.weight;
        requestRender();
      });
    });

    // 6. Text Color Selector
    DOM.colorButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        DOM.colorButtons.forEach((b) => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        DOM.customColorLabel.classList.remove('active');

        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        const color = btn.dataset.color;
        state.settings.colorMode = color === '#FFFFFF' ? 'white' : 'black';
        state.settings.textColor = color;
        requestRender();
      });
    });

    DOM.customColorInput.addEventListener('input', (e) => {
      const hex = e.target.value;
      state.settings.customColor = hex;
      state.settings.colorMode = 'custom';
      state.settings.textColor = hex;
      DOM.customColorPreview.style.backgroundColor = hex;

      DOM.colorButtons.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      DOM.customColorLabel.classList.add('active');
      requestRender();
    });

    // 7. Rotation Slider
    DOM.rotationSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      state.settings.rotation = val;
      DOM.rotationVal.textContent = `${val}°`;
      requestRender();
    });

    // 8. Reset to Defaults
    DOM.resetSettingsBtn.addEventListener('click', () => {
      resetSettingsToDefaults();
    });

    // 9. Export Format & Quality
    DOM.exportFormatSelect.addEventListener('change', (e) => {
      state.settings.exportFormat = e.target.value;
      if (e.target.value === 'image/jpeg') {
        DOM.jpegQualityGroup.classList.remove('hidden');
      } else {
        DOM.jpegQualityGroup.classList.add('hidden');
      }
    });

    DOM.jpegQualitySlider.addEventListener('input', (e) => {
      const quality = parseInt(e.target.value, 10);
      state.settings.jpegQuality = quality / 100;
      DOM.jpegQualityVal.textContent = `${quality}%`;
    });
  }

  function resetSettingsToDefaults() {
    state.settings = { ...DEFAULTS };

    // Update UI controls
    DOM.textInput.value = DEFAULTS.text;
    DOM.textCharCount.textContent = `${DEFAULTS.text.length} / 100`;
    validateText();

    DOM.opacitySlider.value = DEFAULTS.opacity;
    DOM.opacityVal.textContent = `${DEFAULTS.opacity}%`;

    DOM.spacingSlider.value = DEFAULTS.spacing;
    DOM.spacingVal.textContent = 'Balanced';

    DOM.autoSizeToggle.classList.add('active');
    DOM.autoSizeToggle.setAttribute('aria-pressed', 'true');
    DOM.sizeSlider.value = 1.0;
    updateFontSizeDisplay();

    DOM.weightButtons.forEach((b) => {
      const isActive = b.dataset.weight === DEFAULTS.fontWeight;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-checked', isActive);
    });

    DOM.colorButtons.forEach((b) => {
      const isActive = b.dataset.color === '#FFFFFF';
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-checked', isActive);
    });
    DOM.customColorLabel.classList.remove('active');
    DOM.customColorPreview.style.backgroundColor = DEFAULTS.customColor;
    DOM.customColorInput.value = DEFAULTS.customColor;

    DOM.rotationSlider.value = DEFAULTS.rotation;
    DOM.rotationVal.textContent = `${DEFAULTS.rotation}°`;

    DOM.exportFormatSelect.value = DEFAULTS.exportFormat;
    DOM.jpegQualityGroup.classList.add('hidden');
    DOM.jpegQualitySlider.value = Math.round(DEFAULTS.jpegQuality * 100);
    DOM.jpegQualityVal.textContent = `${Math.round(DEFAULTS.jpegQuality * 100)}%`;

    requestRender();
    announce('Settings reset to defaults.');
  }

  // ---------------------------------------------------------------------------
  // Full-Resolution Export & Download
  // ---------------------------------------------------------------------------
  function exportAndDownload() {
    if (!state.originalImage || state.isExporting) return;
    if (!validateText()) return;

    state.isExporting = true;
    DOM.downloadBtn.disabled = true;
    DOM.btnText.textContent = 'Generating Full Resolution...';
    DOM.btnSpinner.classList.remove('hidden');

    // Allow UI to paint spinner before running canvas export
    setTimeout(() => {
      try {
        const origW = state.originalImage.naturalWidth;
        const origH = state.originalImage.naturalHeight;

        const canvas = DOM.exportCanvas;
        canvas.width = origW;
        canvas.height = origH;
        const ctx = canvas.getContext('2d');

        const isJpeg = state.settings.exportFormat === 'image/jpeg';

        // For JPEG, fill with clean white background to avoid black transparency
        if (isJpeg) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, origW, origH);
        } else {
          ctx.clearRect(0, 0, origW, origH);
        }

        // Draw original full-size photo
        ctx.drawImage(state.originalImage, 0, 0, origW, origH);

        // Draw watermark pattern at full resolution (renderScale = 1)
        drawWatermarkPattern(ctx, origW, origH, state.settings, 1.0);

        // Export to Blob
        const format = state.settings.exportFormat;
        const quality = isJpeg ? state.settings.jpegQuality : undefined;

        canvas.toBlob((blob) => {
          if (!blob) {
            throw new Error('Canvas export failed to produce blob.');
          }

          const baseName = sanitizeFilename(state.originalFile ? state.originalFile.name : 'watermark_dckk');
          const ext = isJpeg ? 'jpg' : 'png';
          const downloadFilename = `${baseName}-watermarked.${ext}`;

          const downloadUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = downloadUrl;
          link.download = downloadFilename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setTimeout(() => {
            URL.revokeObjectURL(downloadUrl);
          }, 4000);

          // Reset button and show toast
          state.isExporting = false;
          DOM.downloadBtn.disabled = false;
          DOM.btnText.textContent = 'Download Watermarked Image';
          DOM.btnSpinner.classList.add('hidden');

          showExportToast(`Downloaded ${downloadFilename} (${formatBytes(blob.size)})`);
          announce(`Export completed. Downloaded ${downloadFilename}.`);

        }, format, quality);

      } catch (err) {
        console.error('Export Error:', err);
        alert('An error occurred during image export. Please try again.');
        state.isExporting = false;
        DOM.downloadBtn.disabled = false;
        DOM.btnText.textContent = 'Download Watermarked Image';
        DOM.btnSpinner.classList.add('hidden');
      }
    }, 40);
  }

  function showExportToast(message) {
    DOM.exportStatusMsg.textContent = message;
    DOM.exportToast.classList.remove('hidden');
    setTimeout(() => {
      DOM.exportToast.classList.add('hidden');
    }, 4000);
  }

  // ---------------------------------------------------------------------------
  // Synthetic Jewelry Samples for Instant Testing
  // ---------------------------------------------------------------------------
  function generateSampleImage(type) {
    const canvas = document.createElement('canvas');
    let width = 1600;
    let height = 1100;
    let filename = 'jewelry_sample.png';

    if (type === 'ring-landscape') {
      width = 1800;
      height = 1200;
      filename = 'dckk_diamond_ring_landscape.jpg';
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Soft luxury warm satin backdrop
      const grad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width * 0.65);
      grad.addColorStop(0, '#EDE8DF');
      grad.addColorStop(0.5, '#D5CDBC');
      grad.addColorStop(1, '#948873');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Ring shadow
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2 + 160, 260, 45, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(25, 20, 15, 0.45)';
      ctx.filter = 'blur(16px)';
      ctx.fill();
      ctx.filter = 'none';

      // Golden band ring
      ctx.lineWidth = 42;
      ctx.strokeStyle = '#D4AF37';
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2 + 40, 200, 150, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Band highlight
      ctx.lineWidth = 14;
      ctx.strokeStyle = '#FFF6D1';
      ctx.beginPath();
      ctx.ellipse(width / 2, height / 2 + 35, 190, 142, 0, -Math.PI * 0.4, Math.PI * 0.1);
      ctx.stroke();

      // Diamond stone at crown
      drawSparklingDiamond(ctx, width / 2, height / 2 - 120, 120);

      // Label
      drawSampleLabel(ctx, 'DCKK Fine Jewelry Collection • 18K Solitaire Ring', width / 2, height - 70);

    } else if (type === 'earrings-portrait') {
      width = 1100;
      height = 1600;
      filename = 'dckk_sapphire_earrings_portrait.jpg';
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Elegant moody portrait background
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#262930');
      grad.addColorStop(0.5, '#1A1C22');
      grad.addColorStop(1, '#0F1014');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Left and right earrings
      [width * 0.38, width * 0.62].forEach((x) => {
        // Drop chain
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, height * 0.28);
        ctx.lineTo(x, height * 0.52);
        ctx.stroke();

        // Sapphire gem
        drawFacetedGem(ctx, x, height * 0.58, 80, '#1E40AF', '#60A5FA');
      });

      drawSampleLabel(ctx, 'DCKK Royale Sapphire Drop Earrings', width / 2, height - 80, '#9CA3AF');

    } else if (type === 'necklace-transparent') {
      width = 1200;
      height = 1200;
      filename = 'dckk_emerald_pendant_transparent.png';
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      // Completely transparent background!
      ctx.clearRect(0, 0, width, height);

      // Gold chain loop
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(width / 2, height * 0.35, 240, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();

      // Emerald pendant
      drawFacetedGem(ctx, width / 2, height * 0.60, 110, '#047857', '#34D399');
      drawSampleLabel(ctx, 'DCKK Emerald Solitaire Pendant (Transparent Alpha)', width / 2, height - 60, '#6B7280');

    } else if (type === 'watch-dark') {
      width = 1600;
      height = 1200;
      filename = 'dckk_chronograph_dark_velvet.jpg';
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // Deep dark velvet
      ctx.fillStyle = '#0B0D11';
      ctx.fillRect(0, 0, width, height);

      // Watch bezel
      const cx = width / 2;
      const cy = height / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 210, 0, Math.PI * 2);
      ctx.fillStyle = '#171923';
      ctx.fill();
      ctx.lineWidth = 22;
      ctx.strokeStyle = '#C9A84E';
      ctx.stroke();

      // Dial marks
      for (let i = 0; i < 12; i++) {
        const ang = (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * 165, cy + Math.sin(ang) * 165);
        ctx.lineTo(cx + Math.cos(ang) * 185, cy + Math.sin(ang) * 185);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#E2E8F0';
        ctx.stroke();
      }

      // Hands
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#C9A84E';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 80, cy - 60);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy - 130);
      ctx.stroke();

      drawSampleLabel(ctx, 'DCKK Perpetual Chronometer • Dark Edition', width / 2, height - 70, '#718096');

    } else if (type === 'pearl-bright') {
      width = 1500;
      height = 1000;
      filename = 'dckk_pearl_highkey.jpg';
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      // High-key bright marble white
      ctx.fillStyle = '#F9FAFB';
      ctx.fillRect(0, 0, width, height);

      // Light marble veins
      ctx.strokeStyle = '#E5E7EB';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height * 0.2);
      ctx.bezierCurveTo(width * 0.3, height * 0.4, width * 0.7, height * 0.1, width, height * 0.3);
      ctx.stroke();

      // Pearl strand
      const pearlCount = 14;
      const spacing = 70;
      const startX = width / 2 - (pearlCount * spacing) / 2;
      for (let i = 0; i < pearlCount; i++) {
        const px = startX + i * spacing;
        const py = height / 2 + Math.sin(i * 0.4) * 40;

        // Shadow
        ctx.beginPath();
        ctx.arc(px, py + 18, 28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fill();

        // Pearl sphere
        const pGrad = ctx.createRadialGradient(px - 8, py - 8, 4, px, py, 28);
        pGrad.addColorStop(0, '#FFFFFF');
        pGrad.addColorStop(0.7, '#F3F4F6');
        pGrad.addColorStop(1, '#D1D5DB');
        ctx.beginPath();
        ctx.arc(px, py, 28, 0, Math.PI * 2);
        ctx.fillStyle = pGrad;
        ctx.fill();
      }

      drawSampleLabel(ctx, 'DCKK Akoya Pearl Strand • High-Key Studio', width / 2, height - 60, '#6B7280');
    }

    // Convert canvas to synthetic file object
    canvas.toBlob((blob) => {
      const syntheticFile = new File([blob], filename, { type: blob.type });
      handleFileSelection(syntheticFile);
    }, 'image/png');
  }

  function drawSparklingDiamond(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);

    // Crown facets
    ctx.beginPath();
    ctx.moveTo(-size / 2, 0);
    ctx.lineTo(-size / 3, -size / 2.5);
    ctx.lineTo(size / 3, -size / 2.5);
    ctx.lineTo(size / 2, 0);
    ctx.lineTo(0, size / 1.5);
    ctx.closePath();
    ctx.fillStyle = '#E0F2FE';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#38BDF8';
    ctx.stroke();

    // Internal facet lines
    ctx.beginPath();
    ctx.moveTo(-size / 3, -size / 2.5);
    ctx.lineTo(0, size / 1.5);
    ctx.lineTo(size / 3, -size / 2.5);
    ctx.stroke();

    // Glint sparkle
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-size / 6, -size / 5, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawFacetedGem(ctx, x, y, size, colorBase, colorHighlight) {
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath();
    ctx.moveTo(0, -size / 2);
    ctx.lineTo(size / 2, 0);
    ctx.lineTo(0, size / 1.4);
    ctx.lineTo(-size / 2, 0);
    ctx.closePath();
    ctx.fillStyle = colorBase;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = colorHighlight;
    ctx.stroke();

    // Internal facet
    ctx.beginPath();
    ctx.moveTo(0, -size / 2);
    ctx.lineTo(0, size / 1.4);
    ctx.stroke();

    ctx.restore();
  }

  function drawSampleLabel(ctx, label, x, y, color = '#374151') {
    ctx.save();
    ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // Drag & Drop and Event Handlers
  // ---------------------------------------------------------------------------
  function setupDragAndDrop() {
    const dropZone = DOM.dropZone;

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-active');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-active');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        handleFileSelection(dt.files[0]);
      }
    });

    // Dropzone click opens file picker
    dropZone.addEventListener('click', (e) => {
      // Don't trigger if user clicked sample buttons
      if (e.target.closest('.sample-pill-btn')) return;
      DOM.fileInput.click();
    });

    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        DOM.fileInput.click();
      }
    });

    DOM.browseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.fileInput.click();
    });

    DOM.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileSelection(e.target.files[0]);
      }
    });

    // Sample buttons in dropzone
    DOM.sampleButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sampleType = btn.dataset.sample;
        generateSampleImage(sampleType);
      });
    });
  }

  function setupToolbar() {
    DOM.modeOriginalBtn.addEventListener('click', () => setViewMode('original'));
    DOM.modeWatermarkedBtn.addEventListener('click', () => setViewMode('watermarked'));
    DOM.modeCompareBtn.addEventListener('click', () => setViewMode('compare'));

    DOM.fitViewBtn.addEventListener('click', () => {
      const stage = DOM.previewStage;
      const scrollLeft = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
      const scrollTop = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
      stage.scrollTo({ top: scrollTop, left: scrollLeft, behavior: 'smooth' });
      announce('Centered and fitted image preview.');
    });

    DOM.replaceImageBtn.addEventListener('click', () => {
      DOM.fileInput.click();
    });

    DOM.clearImageBtn.addEventListener('click', () => {
      if (confirm('Clear the current image and return to the upload screen?')) {
        clearCurrentImage();
      }
    });
  }

  function setupPrivacyDialog() {
    DOM.openPrivacyBtn.addEventListener('click', () => {
      if (DOM.privacyDialog.showModal) {
        DOM.privacyDialog.showModal();
      } else {
        DOM.privacyDialog.setAttribute('open', '');
      }
    });

    const closeDialog = () => {
      if (DOM.privacyDialog.close) {
        DOM.privacyDialog.close();
      } else {
        DOM.privacyDialog.removeAttribute('open');
      }
    };

    DOM.closeDialogBtn.addEventListener('click', closeDialog);
    DOM.dialogGotItBtn.addEventListener('click', closeDialog);

    DOM.privacyDialog.addEventListener('click', (e) => {
      // Light dismiss if clicked outside dialog-content
      if (e.target === DOM.privacyDialog) {
        closeDialog();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Application Initialization
  // ---------------------------------------------------------------------------
  function init() {
    setupDragAndDrop();
    setupToolbar();
    setupComparisonInteractions();
    setupSettingsControls();
    setupPrivacyDialog();

    DOM.downloadBtn.addEventListener('click', exportAndDownload);

    // Responsive resize & orientation listeners
    const handleViewportChange = () => {
      if (state.originalImage) {
        requestRender();
      }
    };

    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', () => {
      setTimeout(handleViewportChange, 120);
    });

    announce('WaterMark - DCKK Studio ready. Please upload an image.');
  }

  // Run on DOM content loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
