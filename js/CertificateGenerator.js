/**
 * CertificateGenerator - Client-side Image Generation Engine
 * Replaces the AWS Lambda Python PIL implementation.
 *
 * Changes vs original JS:
 *  - **bold** inline markdown parsing (mirrors Python's parse_text_segments / draw_segment)
 *  - boldFont field property support
 *  - isCircle support on box-type text fields
 *  - Fallback blank canvas when no backgroundImage is provided
 */
class CertificateGenerator {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Main rendering function
     * @param {Object} template - The JSON template configuration
     * @param {Object} data     - The user data (name, qr_data, etc.)
     * @returns {Promise<string>} Base64 PNG Data URL
     */
    async generate(template, data) {
        if (!template) throw new Error("Template object is required");

        // Reset taint flag for this run
        this._canvasTainted = false;

        const bgUrl = template.backgroundImage;

        if (bgUrl) {
            // Normal path: draw background image and size canvas to match
            const bgImg = await this._loadImage(bgUrl);
            this.canvas.width  = bgImg.width;
            this.canvas.height = bgImg.height;
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
            this.ctx.drawImage(bgImg, 0, 0);
        } else {
            // Fallback: blank white canvas (mirrors Python behaviour)
            this.canvas.width  = template.width  || 1000;
            this.canvas.height = template.height || 800;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Ensure fonts declared in the page CSS are ready
        await document.fonts.ready;

        const defaultFontFam = template.font || 'Arial';

        for (const field of (template.textFields || [])) {
            const fieldType = field.type || 'box';
            const key       = field.key;

            // ── QR CODE ──────────────────────────────────────────────────────
            if (fieldType === 'qrcode') {
                const qrData = data[key];
                if (!qrData) continue;
                await this._drawQRCode(qrData, field.rect);
                continue;
            }

            // ── IMAGE (Avatar, etc.) ─────────────────────────────────────────
            if (fieldType === 'image') {
                const imgSource = data[key];
                if (!imgSource) continue;
                await this._drawImageCover(imgSource, field);
                continue;
            }

            // ── TEXT FIELDS ──────────────────────────────────────────────────
            let textContent = data[key];
            if (!textContent) continue;
            textContent = String(textContent).replace(/\\n/g, '\n');
            if (field.uppercase) textContent = textContent.toUpperCase();

            if (fieldType === 'box') {
                this._drawTextBox(textContent, field, defaultFontFam);
            } else if (fieldType === 'anchor') {
                this._drawTextAnchor(textContent, field, defaultFontFam);
            }
        }

        if (this._canvasTainted) {
            throw new Error(
                "Cannot export certificate: one or more images were blocked by CORS or could not be loaded. " +
                "This could be a missing file (404/403) or a CORS issue. " +
                "Set generator.corsProxyUrl to a CORS proxy and try again."
            );
        }
        return this.canvas.toDataURL("image/png", 1.0);
    }

    // ─── BOLD TEXT HELPERS ───────────────────────────────────────────────────

    /**
     * Parse text containing **bold** markers into segments.
     * Mirrors Python's parse_text_segments().
     * @returns {Array<{text: string, bold: boolean}>}
     */
    _parseTextSegments(text) {
        if (!text) return [];
        const segments = [];
        let pos = 0;

        while (pos < text.length) {
            const boldStart = text.indexOf('**', pos);
            if (boldStart === -1) {
                if (pos < text.length) segments.push({ text: text.slice(pos), bold: false });
                break;
            }
            if (boldStart > pos) {
                segments.push({ text: text.slice(pos, boldStart), bold: false });
            }
            const boldEnd = text.indexOf('**', boldStart + 2);
            if (boldEnd === -1) {
                segments.push({ text: text.slice(boldStart), bold: false });
                break;
            }
            segments.push({ text: text.slice(boldStart + 2, boldEnd), bold: true });
            pos = boldEnd + 2;
        }
        return segments;
    }

    /**
     * Build the CSS font string for a given family and size,
     * applying bold weight when requested.
     */
    _fontStr(bold, size, family) {
        return `${bold ? 'bold ' : ''}${size}px "${family}"`;
    }

    /**
     * Measure the pixel width of a single segment, respecting letter-spacing.
     */
    _segmentWidth(segment, size, fontFam, boldFontFam, letterSpacing) {
        this.ctx.font = this._fontStr(segment.bold, size, segment.bold ? (boldFontFam || fontFam) : fontFam);
        if (letterSpacing === 0) {
            return this.ctx.measureText(segment.text).width;
        }
        let total = 0;
        for (const ch of segment.text) {
            total += this.ctx.measureText(ch).width;
        }
        if (segment.text.length > 1) total += (segment.text.length - 1) * letterSpacing;
        return total;
    }

    /**
     * Draw a single segment at (x, y) and return the width consumed.
     */
    _drawSegment(segment, x, y, size, fontFam, boldFontFam, color, letterSpacing) {
        this.ctx.font      = this._fontStr(segment.bold, size, segment.bold ? (boldFontFam || fontFam) : fontFam);
        this.ctx.fillStyle = color;

        if (letterSpacing === 0) {
            this.ctx.fillText(segment.text, x, y);
            return this.ctx.measureText(segment.text).width;
        }

        let curX = x;
        for (const ch of segment.text) {
            this.ctx.fillText(ch, curX, y);
            curX += this.ctx.measureText(ch).width + letterSpacing;
        }
        return curX - x;
    }

    /**
     * Word-wrap text that may contain **bold** markers.
     * Returns an array of lines; each line is an array of segments.
     * Mirrors Python's wrap_text_with_formatting().
     */
    _wrapTextFormatted(text, maxWidth, size, fontFam, boldFontFam, letterSpacing) {
        const lines = [];

        for (const paragraph of text.split('\n')) {
            const segments        = this._parseTextSegments(paragraph);
            let   lineSegs        = [];
            let   lineW           = 0;

            for (const seg of segments) {
                const words = seg.text.split(' ');
                for (let i = 0; i < words.length; i++) {
                    const wordSeg   = { text: words[i], bold: seg.bold };
                    const wordW     = this._segmentWidth(wordSeg, size, fontFam, boldFontFam, letterSpacing);
                    const spaceSeg  = { text: ' ', bold: seg.bold };
                    const spaceW    = lineSegs.length ? this._segmentWidth(spaceSeg, size, fontFam, boldFontFam, letterSpacing) : 0;

                    if (!lineSegs.length || lineW + spaceW + wordW <= maxWidth) {
                        if (lineSegs.length) {
                            lineSegs.push(spaceSeg);
                            lineW += spaceW;
                        }
                        lineSegs.push(wordSeg);
                        lineW += wordW;
                    } else {
                        lines.push(lineSegs);
                        lineSegs = [wordSeg];
                        lineW    = wordW;
                    }
                }
            }
            lines.push(lineSegs);
        }
        return lines;
    }

    /** Measure the total pixel width of a wrapped line (array of segments). */
    _lineWidth(lineSegs, size, fontFam, boldFontFam, letterSpacing) {
        return lineSegs.reduce((sum, seg) => sum + this._segmentWidth(seg, size, fontFam, boldFontFam, letterSpacing), 0);
    }

    // ─── FIELD RENDERERS ─────────────────────────────────────────────────────

    /** Draw QR code into a rect. Requires qrcode.js (QRCode.toCanvas). */
    async _drawQRCode(data, rect) {
        if (typeof QRCode === 'undefined') {
            console.error("QRCode library not found. Skipping QR generation.");
            return;
        }
        const width  = rect.x2 - rect.x1;
        const height = rect.y2 - rect.y1;
        const temp   = document.createElement('canvas');
        await QRCode.toCanvas(temp, data, {
            width,
            margin: 0,
            color: { dark: '#000000', light: '#0000' },
        });
        this.ctx.drawImage(temp, rect.x1, rect.y1, width, height);
    }

    /** Draw an image in cover mode with optional rounded corners / border. */
    async _drawImageCover(src, field) {
        const img           = await this._loadImage(src);
        const rect          = field.rect;
        const borderPadding = (field.border?.enabled) ? (field.border.padding || 0) : 0;
        const boxW          = rect.x2 - rect.x1;
        const boxH          = rect.y2 - rect.y1;
        const contentW      = boxW - borderPadding * 2;
        const contentH      = boxH - borderPadding * 2;

        // Object-fit: cover
        const imgAspect = img.width / img.height;
        const boxAspect = contentW / contentH;
        let sW, sH, sX, sY;
        if (imgAspect > boxAspect) {
            sH = img.height; sW = sH * boxAspect;
            sX = (img.width - sW) / 2; sY = 0;
        } else {
            sW = img.width; sH = sW / boxAspect;
            sX = 0; sY = (img.height - sH) / 2;
        }

        this.ctx.save();

        let cr = field.cornerRadius || 0;
        if (field.isCircle) cr = Math.min(boxW, boxH) / 2;
        if (!Array.isArray(cr)) cr = [cr, cr, cr, cr];

        if (field.border?.enabled) {
            this.ctx.beginPath();
            this.ctx.roundRect(rect.x1, rect.y1, boxW, boxH, cr);
            this.ctx.fillStyle   = field.backgroundColor || 'transparent';
            this.ctx.fill();
            this.ctx.lineWidth   = field.border.width || 2;
            this.ctx.strokeStyle = field.border.color || '#000000';
            this.ctx.stroke();
        }

        this.ctx.beginPath();
        this.ctx.roundRect(rect.x1 + borderPadding, rect.y1 + borderPadding, contentW, contentH, cr);
        this.ctx.clip();
        this.ctx.drawImage(img, sX, sY, sW, sH,
            rect.x1 + borderPadding, rect.y1 + borderPadding, contentW, contentH);

        this.ctx.restore();
    }

    /**
     * Draw a text box with auto font-sizing, alignment, background,
     * bold-markdown support, and isCircle clipping.
     */
    _drawTextBox(text, field, defaultFont) {
        const rect        = field.rect;
        const boxW        = rect.x2 - rect.x1;
        const boxH        = rect.y2 - rect.y1;
        const fontFam     = field.font     || defaultFont;
        const boldFontFam = field.boldFont || null;   // NEW: separate bold face
        const color       = field.color    || '#000000';
        const letterSpacing = field.letterSpacing || 0;
        const lineSpacing   = field.lineSpacing   || 0;

        this.ctx.letterSpacing = `${letterSpacing}px`;

        // ── Corner radius / isCircle (text boxes) ────────────────────────────
        let cr = field.cornerRadius || 0;
        if (field.isCircle) cr = Math.min(boxW, boxH) / 2;   // NEW
        if (!Array.isArray(cr)) cr = [cr, cr, cr, cr];

        // ── Background ───────────────────────────────────────────────────────
        if (field.backgroundColor) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.roundRect(rect.x1, rect.y1, boxW, boxH, cr);
            this.ctx.fillStyle = field.backgroundColor;
            this.ctx.fill();
            this.ctx.restore();
        }

        // ── Auto font-size: binary search ────────────────────────────────────
        let minSize = 10;
        let maxSize = field.fontSize || boxH;
        let bestSize  = minSize;
        let bestLines = [];

        while (minSize <= maxSize) {
            const midSize   = Math.floor((minSize + maxSize) / 2);
            const lines     = this._wrapTextFormatted(text, boxW, midSize, fontFam, boldFontFam, letterSpacing);
            const totalH    = lines.length * midSize + (lines.length - 1) * lineSpacing;

            if (totalH <= boxH) {
                bestSize  = midSize;
                bestLines = lines;
                minSize   = midSize + 1;
            } else {
                maxSize = midSize - 1;
            }
        }

        const finalSize = field.fontSize || bestSize;
        if (field.fontSize) {
            bestLines = this._wrapTextFormatted(text, boxW, finalSize, fontFam, boldFontFam, letterSpacing);
        }

        const totalH = bestLines.length * finalSize + (bestLines.length - 1) * lineSpacing;

        // ── Vertical alignment ───────────────────────────────────────────────
        const alignY = field.alignmentY || 'top';
        let curY = rect.y1;
        if      (alignY === 'middle') curY += (boxH - totalH) / 2;
        else if (alignY === 'bottom') curY += (boxH - totalH);

        // ── Draw each line ───────────────────────────────────────────────────
        const alignX = field.alignmentX || 'left';
        this.ctx.textBaseline = 'top';

        for (const lineSegs of bestLines) {
            const lineW = this._lineWidth(lineSegs, finalSize, fontFam, boldFontFam, letterSpacing);
            let lineX = rect.x1;
            if      (alignX === 'center') lineX += (boxW - lineW) / 2;
            else if (alignX === 'right')  lineX += (boxW - lineW);

            let curX = lineX;
            for (const seg of lineSegs) {
                curX += this._drawSegment(seg, curX, curY, finalSize, fontFam, boldFontFam, color, letterSpacing);
            }
            curY += finalSize + lineSpacing;
        }
    }

    /** Draw text at a fixed anchor point with bold-markdown support. */
    _drawTextAnchor(text, field, defaultFont) {
        const anchor      = field.anchor;
        const fontSize    = field.fontSize    || 32;
        const fontFam     = field.font        || defaultFont;
        const boldFontFam = field.boldFont    || null;
        const color       = field.color       || '#000000';
        const letterSpacing = field.letterSpacing || 0;

        this.ctx.textBaseline  = 'bottom';
        this.ctx.letterSpacing = `${letterSpacing}px`;

        const segments = this._parseTextSegments(text);
        let curX = anchor.x;
        for (const seg of segments) {
            curX += this._drawSegment(seg, curX, anchor.y, fontSize, fontFam, boldFontFam, color, letterSpacing);
        }
    }

    // ─── UTILITY ─────────────────────────────────────────────────────────────

    /**
     * Load an image for use on a canvas.
     *
     * CORS behaviour
     * ──────────────
     * crossOrigin = "Anonymous" tells the browser to request the image with an
     * Origin header.  If the server responds with a matching
     * Access-Control-Allow-Origin header the canvas stays clean and toDataURL()
     * works.  If the server sends NO CORS headers the browser blocks the load
     * entirely (onerror fires) — the canvas never gets tainted, but the image
     * is simply missing.
     *
     * Fallback strategy
     * ─────────────────
     * 1. Try with crossOrigin = "Anonymous"  →  clean canvas, full export.
     * 2. If that fails AND a proxyUrl is configured, reload the image through
     *    the proxy (which adds the required CORS headers server-side).
     * 3. If no proxy is configured, re-attempt WITHOUT crossOrigin so the image
     *    at least renders visually, then mark the canvas as tainted so callers
     *    can decide how to handle export failure gracefully instead of crashing.
     *
     * Configure a proxy by setting:
     *   generator.corsProxyUrl = 'https://your-proxy.example.com/?url=';
     * The proxy URL will be prepended to the original src.
     */
    _loadImage(src) {
        // Skip CORS handling entirely for data: URLs — they are never cross-origin.
        if (src.startsWith('data:')) {
            return new Promise((resolve, reject) => {
                const img  = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Failed to load data URL`));
                img.src    = src;
            });
        }

        const tryLoad = (url, withCors) => new Promise((resolve, reject) => {
            const img = new Image();
            if (withCors) img.crossOrigin = "Anonymous";
            img.onload  = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            // Cache-bust only on the CORS attempt to avoid a stale opaque response
            // from a previous no-cors load being served from the browser cache.
            img.src = withCors ? `${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}` : url;
        });

        return tryLoad(src, true).catch(async () => {
            // Attempt 1 failed (no CORS headers from server)
            if (this.corsProxyUrl) {
                // Attempt 2: route through proxy
                console.warn(`[CertificateGenerator] CORS blocked for ${src}. Retrying via proxy.`);
                return tryLoad(`${this.corsProxyUrl}${encodeURIComponent(src)}`, true);
            }

            // Attempt 3: load without crossOrigin — renders fine but taints the canvas.
            // toDataURL() will throw; we flag it so generate() can surface a clear error.
            console.warn(
                `[CertificateGenerator] CORS blocked for ${src} and no corsProxyUrl set. ` +
                `Canvas will be tainted — PNG export will fail. ` +
                `Set generator.corsProxyUrl to fix this.`
            );
            this._canvasTainted = true;
            return tryLoad(src, false);
        });
    }
}
