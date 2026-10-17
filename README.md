# WaterMark - DCKK — Image Watermark Studio

A lightweight, professional, browser-based image watermarking utility built primarily for **DCKK JEWELERS**. Designed to protect luxury jewelry photography, certificates, and product catalogs with an authentic repeating diagonal proof watermark pattern.

---

## Overview

**WaterMark - DCKK** runs 100% locally in the user's browser using modern HTML5, CSS3, and Vanilla JavaScript. It delivers instant real-time customization, an interactive before-and-after comparison slider, and full-resolution export (PNG or JPEG) without uploading images to any external server or cloud service.

---

## Key Features

- **Repeating Diagonal Proof Watermark**:
  - Genuine repeating diagonal grid covering 100% of the image, including all corners and edges.
  - Alternating staggered brick rows to mimic authentic stock-photo proof overlays.
  - Configurable rotation (-60° to +60°, default `-35°`).
- **Real-Time Visual Customization**:
  - **Watermark Text**: Default `DCKK JEWELERS` with dynamic character counting and validation.
  - **Opacity Control**: 5% to 70% (default `25%`) with instant live preview.
  - **Watermark Spacing**: Continuous slider with Dense, Balanced, and Wide anchors.
  - **Text Size**: Intelligent Auto-scaling based on image dimensions, or manual fine-tuning.
  - **Font Weight**: Regular (400), Medium (500), Semibold (600), and Bold (700).
  - **Text Color**: White, Black, and Custom Native Color Picker.
  - **Reset to Defaults**: Restores standard settings in one click without clearing the loaded image.
- **Interactive Verification & Comparison**:
  - `Original` mode: View unmodified original photo.
  - `Watermarked` mode: View live watermarked result.
  - `Compare` mode: Interactive before/after split slider with pointer capture and keyboard arrow navigation.
  - `Fit`: Reset and center view within preview viewport.
- **High-Resolution Export**:
  - Preview runs on a lightweight cached canvas for silky 60fps interaction during rapid slider adjustments.
  - Final export executes on full natural image dimensions (e.g. 24MP product photos).
  - Supports lossless **PNG** (preserves transparency) and high-quality **JPEG** (with customizable compression and white background flattening).
  - Sanitized filename output: `[original-name]-watermarked.[png/jpg]`.
- **Integrated Test Samples**:
  - Includes 5 built-in synthetic jewelry test images (Landscape Ring, Portrait Sapphire Earrings, Transparent PNG Emerald Pendant, Dark Velvet Chronometer, and High-Key Pearl Strand) for instant demonstration without searching for local files.
- **Privacy & Security**:
  - Zero server calls, zero cookies, zero analytics, zero external network dependencies.
  - Complete memory lifecycle management (`URL.revokeObjectURL()`).

---

## Local-Only Image Processing Approach

All image manipulation and rendering take place on client-side CPU/GPU using the standard **HTML5 Canvas 2D API** and **File API**:
1. When an image is dragged and dropped or chosen via file picker, a local blob URL (`blob:...`) is created.
2. The image is drawn directly to an in-memory Canvas element.
3. Rotation, trigonometric bounding box calculations, and text stamping are executed locally.
4. Export utilizes `HTMLCanvasElement.toBlob()`, creating an instant local download link.
5. No photo bytes leave your device at any point.

---

## How to Run Locally

Because the project uses purely standard web technologies without Node.js, npm, or build tools, running it is simple:

### Option 1: Direct File Opening
Double-click `index.html` in your file explorer, or right-click and choose **Open with... > Google Chrome / Microsoft Edge / Mozilla Firefox / Safari**.

### Option 2: Local HTTP Server (Optional)
If you prefer running through a local development server:
```bash
# Using Python 3
python -m http.server 8000

# Or using Node.js npx serve
npx serve .
```
Then navigate to `http://localhost:8000` in your browser.

---

## How to Publish to GitHub Pages

The repository is structured to be deployed immediately to GitHub Pages with zero build step:

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of WaterMark - DCKK"
   git branch -M main
   git remote add origin https://github.com/<your-username>/watermark-dckk.git
   git push -u origin main
   ```
2. In your GitHub repository, navigate to **Settings > Pages**.
3. Under **Build and deployment**:
   - **Source**: Select `Deploy from a branch`.
   - **Branch**: Select `main` and folder `/ (root)`.
4. Click **Save**.
5. Within 1–2 minutes, your site will be live at `https://<your-username>.github.io/watermark-dckk/`.

*Note: All assets and links use relative paths, guaranteeing seamless operation when hosted under a GitHub repository subpath.*

---

## Browser Compatibility & Technical Details

- **Supported Browsers**:
  - Google Chrome / Chromium-based browsers (Edge, Brave, Opera, Vivaldi)
  - Mozilla Firefox
  - Apple Safari (macOS & iOS)
- **Supported Formats**:
  - Input: `.jpg`, `.jpeg`, `.png`, `.webp`
  - Output: `.png` (Lossless, alpha transparent), `.jpeg` (Adjustable quality)
- **Memory & Limits**:
  - Standard browsers support canvas dimensions up to 16,384 × 16,384 pixels.
  - Very large images (over 30 megapixels) may require a few seconds during export on lower-powered devices.

---

## Brand Guidelines & Identity

- **Brand**: DCKK JEWELERS
- **Utility**: WaterMark - DCKK — Image Watermark Studio
- **Accent Color**: `#B59A63` (Muted Warm Gold)
- **Primary Surface**: `#FFFFFF`
- **Background**: `#F7F8FA`
