import { api } from '../utils.js';
import { API_URL } from '../config.js';

// Local State
let state = {
    fields: [],
    selectedId: null,
    bgImage: null,
    scale: 1,
    targetType: null,
    targetId: null,
    pendingBlobUrl: null // Store local preview URL to revoke later
};

// IndexedDB Helpers
const DB_NAME = 'CertDesignerDB';
const STORE_NAME = 'pendingImages';
let dbPromise = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }
    return dbPromise;
}

async function setPendingImage(key, blob) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(blob, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

async function getPendingImage(key) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function clearPendingImage(key) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// Available Variables
const AVAILABLE_VARS = [
    { key: 'name', label: 'User Full Name' },
    { key: 'event_name', label: 'Event Name' },
    { key: 'date', label: 'Event Date' },
    { key: 'venue', label: 'Location/Venue' },
    { key: 'certificate_link', label: 'Certificate URL' },
    { key: 'certificate_id', label: 'Certificate ID' }
];

export async function renderCertificateDesigner(type, id, communityId = null) {
    state.targetType = type;
    state.targetId = id;
    state.communityId = communityId;
    state.fields = []; 
    state.bgImage = null;
    state.scale = 1;
    state.selectedId = null;
    
    const container = document.getElementById('app');
    
    // Inject Styles
    const styleId = 'cert-designer-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #cert-root { display: flex; flex-direction: column; md-flex-direction: row; min-height: calc(100vh - 120px); background: #fafafa; border: 2px solid #0b0b0b; box-shadow: 8px 8px 0 0 #0b0b0b; font-family: 'JetBrains Mono', monospace; }
            @media (min-width: 768px) { #cert-root { flex-direction: row; } }
            #sidebar { width: 100%; md-width: 360px; background: #ffffff; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; border-bottom: 2px solid #0b0b0b; border-right: none; }
            @media (min-width: 768px) { #sidebar { width: 360px; border-bottom: none; border-right: 2px solid #0b0b0b; } }
            #workspace { flex: 1; display: flex; justify-content: center; align-items: center; position: relative; overflow: auto; background: #f0f0f0; padding: 24px; min-height: 480px; }
            #canvas-area { position: relative; border: 2px solid #0b0b0b; box-shadow: 6px 6px 0 0 #0b0b0b; background: #ffffff; background-size: contain; background-repeat: no-repeat; transition: all 0.1s ease; }
            
            .field-el { position: absolute; border: 2px dashed #0b0b0b; background: rgba(92, 225, 230, 0.15); cursor: move; display: flex; align-items: center; justify-content: center; color: #0b0b0b; font-size: 12px; font-weight: bold; overflow: hidden; white-space: nowrap; user-select: none; }
            .field-el:hover { border-color: #5ce1e6; background: rgba(92, 225, 230, 0.3); }
            .field-el.selected { border: 2px solid #00e676; background: rgba(0, 230, 118, 0.2); z-index: 100; box-shadow: 2px 2px 0 0 #0b0b0b; }
            
            .resize-handle { width: 14px; height: 14px; background: #00e676; border: 2px solid #0b0b0b; position: absolute; bottom: -7px; right: -7px; cursor: se-resize; z-index: 101; display: none; }
            .field-el.selected .resize-handle { display: block; }
            
            .var-tag { display: inline-block; padding: 3px 8px; background: #fafafa; border: 2px solid #0b0b0b; font-size: 10px; font-weight: bold; text-transform: uppercase; margin: 2px; cursor: pointer; box-shadow: 2px 2px 0 0 #0b0b0b; transition: all 0.05s; }
            .var-tag:hover { background: #5ce1e6; transform: translate(1px, 1px); box-shadow: 1px 1px 0 0 #0b0b0b; }
            .var-tag:active { transform: translate(2px, 2px); box-shadow: none; }
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = `
        <div id="cert-root">
            <div id="sidebar">
                <div class="flex justify-between items-center pb-3 border-b-2 border-ink">
                    <h2 class="font-black text-lg text-ink uppercase tracking-tight">Cert Designer</h2>
                    <div class="flex gap-2">
                        <button id="btn-preview" class="btn-secondary !text-xs !px-3 !py-1.5">Preview</button>
                        <button id="btn-save" class="btn-primary !text-xs !px-3 !py-1.5">Save</button>
                    </div>
                </div>

                <div class="bg-cyan/20 border-2 border-ink p-2 text-[10px] font-bold text-ink uppercase shadow-[1px_1px_0_0_#0b0b0b]">
                    <i class="fas fa-info-circle mr-1"></i> Policy: Certificates are valid &amp; stored for 2 years from issue date.
                </div>
                
                <!-- Background Image Section -->
                <div class="p-4 bg-canvas border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b]">
                    <label class="label mb-2">1. Background Image</label>
                    <div class="flex gap-2 mb-3">
                        <input type="text" id="bgUrlInput" placeholder="https://... URL or S3 link" class="input !p-2 text-xs flex-1">
                        <button id="btn-load-bg" class="btn-secondary !text-xs !px-3 !py-2">Load</button>
                    </div>
                    <div class="text-[10px] text-neutral-600 text-center font-bold uppercase mb-2">[ OR CHOOSE LOCAL IMAGE ]</div>
                    <div>
                        <input type="file" id="bgUploadInput" accept="image/png, image/jpeg" class="hidden">
                        <button id="btn-upload-bg" class="btn-primary w-full !text-xs !py-2">
                            <i class="fas fa-upload mr-1"></i> Upload Image
                        </button>
                        <div id="upload-status" class="text-[11px] font-bold text-ink text-center mt-2 hidden"></div>
                    </div>
                </div>

                <!-- Add Elements Section -->
                <div class="p-4 bg-white border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b]">
                    <label class="label mb-2">2. Add Elements</label>
                    <div class="grid grid-cols-2 gap-2 mb-2">
                        <button id="btn-add-text" class="btn-secondary !text-xs !py-2">+ Static Text</button>
                        <button id="btn-add-var" class="btn-primary !text-xs !py-2">+ Variable</button>
                    </div>
                    <div class="grid grid-cols-2 gap-2">
                        <button id="btn-add-qr" class="btn-secondary !text-xs !py-2">+ QR Code</button>
                        <button id="btn-add-img" class="btn-secondary !text-xs !py-2">+ User Avatar</button>
                    </div>
                </div>

                <!-- Properties Panel -->
                <div id="propertiesPanel" style="display:none;" class="p-4 bg-white border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b] animate-in fade-in duration-75">
                    <div class="flex justify-between items-center mb-3 border-b-2 border-ink pb-2">
                        <h3 class="font-black text-xs uppercase text-ink">Element Properties</h3>
                        <button id="btn-delete" class="btn-danger !text-[10px] !px-2 !py-0.5">Delete</button>
                    </div>
                    
                    <div class="mb-3">
                        <label class="label">Data Key / Text Content</label>
                        <input type="text" id="propKey" placeholder="e.g. name" class="input !p-2 text-xs">
                        <div class="mt-2 flex flex-wrap" id="var-list"></div>
                    </div>

                    <div id="textProps" class="space-y-3">
                        <div class="grid grid-cols-2 gap-2">
                            <div>
                                <label class="label">Font Size (px)</label>
                                <input type="number" id="propSize" class="input !p-2 text-xs">
                            </div>
                            <div>
                                <label class="label">Font Color</label>
                                <input type="color" id="propColor" class="input !p-1 h-[38px] cursor-pointer">
                            </div>
                        </div>
                        <div>
                            <label class="label">Text Alignment</label>
                            <select id="propAlignX" class="input bg-white !p-2 text-xs">
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                            </select>
                        </div>
                        <div>
                            <label class="label">Font Weight</label>
                            <select id="propFontPath" class="input bg-white !p-2 text-xs">
                                 <option value="">Regular</option>
                                 <option value="Bold">Bold</option>
                            </select>
                        </div>
                    </div>

                    <div id="imgProps" style="display:none;" class="space-y-3">
                         <div>
                             <label class="label">Corner Radius (px)</label>
                             <input type="number" id="propRadius" class="input !p-2 text-xs">
                         </div>
                         <label class="flex items-center gap-2 cursor-pointer font-bold text-xs uppercase">
                            <input type="checkbox" id="propCircle" class="w-4 h-4 accent-cyan border-2 border-ink"> Circular Mask
                         </label>
                    </div>
                </div>
                
                <div class="mt-auto pt-3 border-t-2 border-ink">
                    <button onclick="history.back()" class="btn-secondary w-full">
                        <i class="fas fa-arrow-left mr-1"></i> Exit Designer
                    </button>
                </div>
            </div>
            
            <div id="workspace">
                <div id="canvas-area">
                    <img id="templateImage" style="visibility:hidden; max-width:100%; pointer-events: none;">
                </div>
            </div>
        </div>
    `;

    // Render Variable Helpers
    const varList = document.getElementById('var-list');
    AVAILABLE_VARS.forEach(v => {
        const tag = document.createElement('span');
        tag.className = 'var-tag';
        tag.innerText = v.key;
        tag.title = v.label;
        tag.onclick = () => {
            const input = document.getElementById('propKey');
            input.value = v.key;
            input.dispatchEvent(new Event('input'));
        };
        varList.appendChild(tag);
    });

    setupListeners();
    loadTemplateData(type, id);
}

function setupListeners() {
    const templateImage = document.getElementById('templateImage');
    const canvasArea = document.getElementById('canvas-area');

    // 1. Image URL Load
    document.getElementById('btn-load-bg').addEventListener('click', () => {
        const url = document.getElementById('bgUrlInput').value.trim();
        if(!url) return;
        state.bgImage = url;
        templateImage.crossOrigin = "Anonymous";
        
        let srcUrl = state.bgImage;
        if (srcUrl.startsWith('s3://')) {
            srcUrl = (window.EVENTS_API_URL || API_URL.replace('admin', 'events')) + '/api/events/proxy?url=' + encodeURIComponent(srcUrl);
        }
        
        templateImage.src = srcUrl;
        templateImage.onload = () => {
            const ws = document.getElementById('workspace');
            const aspect = templateImage.naturalWidth / templateImage.naturalHeight;
            let w = ws.clientWidth - 60;
            let h = w / aspect;
            
            if (h > ws.clientHeight - 60) {
                h = ws.clientHeight - 60;
                w = h * aspect;
            }
            
            canvasArea.style.width = w + 'px';
            canvasArea.style.height = h + 'px';
            canvasArea.style.backgroundImage = `url(${srcUrl})`;
            state.scale = w / templateImage.naturalWidth;
        };
        templateImage.onerror = () => {
            alert("Failed to load image from URL. It might be blocked by CORS or the URL is invalid.");
        };
    });

    const uploadBtn = document.getElementById('btn-upload-bg');
    const uploadInput = document.getElementById('bgUploadInput');
    const uploadStatus = document.getElementById('upload-status');

    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => uploadInput.click());
        
        uploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                uploadBtn.disabled = true;
                uploadStatus.style.display = 'block';
                uploadStatus.innerText = 'Compressing image...';
                uploadStatus.className = 'text-[11px] font-bold text-ink text-center mt-2';

                // 1. Compress Image (Lossless/Minimal Loss)
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 2000,
                    useWebWorker: true,
                    initialQuality: 0.9 
                };
                const compressedFile = await imageCompression(file, options);
                
                uploadStatus.innerText = 'Saving locally...';
                
                // 2. Save to IndexedDB for persistence
                const dbKey = `pending_bg_${state.targetType}_${state.targetId}`;
                await setPendingImage(dbKey, compressedFile);
                
                // 3. Generate Local Blob URL
                if (state.pendingBlobUrl) URL.revokeObjectURL(state.pendingBlobUrl);
                state.pendingBlobUrl = URL.createObjectURL(compressedFile);

                // 4. Update UI
                uploadStatus.innerText = 'Previewing (Unsaved)';
                
                document.getElementById('bgUrlInput').value = state.pendingBlobUrl;
                document.getElementById('btn-load-bg').click();

            } catch (err) {
                console.error(err);
                uploadStatus.innerText = err.message || 'Processing failed.';
                uploadStatus.className = 'text-[11px] font-bold text-danger text-center mt-2';
            } finally {
                uploadBtn.disabled = false;
                uploadInput.value = '';
                setTimeout(() => { if(uploadStatus.innerText.includes('Previewing')) uploadStatus.style.display = 'none'; }, 3000);
            }
        });
    }

    // 2. Tools
    document.getElementById('btn-add-text').onclick = () => addField('box', 'Static Text');
    document.getElementById('btn-add-var').onclick = () => addField('box', 'name');
    document.getElementById('btn-add-img').onclick = () => addField('image', 'user_avatar');
    document.getElementById('btn-add-qr').onclick = () => addField('qrcode', 'certificate_link');
    
    document.getElementById('btn-save').onclick = saveTemplate;
    document.getElementById('btn-preview').onclick = previewTemplate; 
    document.getElementById('btn-delete').onclick = deleteSelected;

    // 3. Properties
    const update = () => updateFieldData();
    ['propKey', 'propSize', 'propColor', 'propAlignX', 'propRadius', 'propCircle', 'propFontPath'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.oninput = update; el.onchange = update; }
    });
}

function addField(type, defaultKey) {
    if(!state.bgImage) return alert("Please load a background image URL first.");
    
    const id = Date.now().toString();
    const field = {
        id, type,
        key: defaultKey,
        x: 50, y: 50, w: type === 'box' ? 200 : 100, h: type === 'box' ? 50 : 100,
        fontSize: 30, color: '#000000', alignX: 'left',
        cornerRadius: 0, isCircle: false,
        boldFont: null
    };
    
    state.fields.push(field);
    renderElement(field);
    selectField(id);
}

function renderElement(field) {
    const el = document.createElement('div');
    el.id = field.id;
    el.className = 'field-el';
    updateElementVisuals(el, field);
    
    // Resize Handle
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    el.appendChild(handle);

    // Selection Logic
    el.addEventListener('mousedown', (e) => {
        selectField(field.id); 
        if(e.target === handle) initResize(e, field, el);
        else initDrag(e, field, el);
    });

    document.getElementById('canvas-area').appendChild(el);
}

function updateElementVisuals(el, field) {
    el.style.left = field.x + 'px';
    el.style.top = field.y + 'px';
    el.style.width = field.w + 'px';
    el.style.height = field.h + 'px';
    
    if (field.type === 'box') {
         el.innerText = `{{${field.key}}}`;
         el.style.fontSize = (field.fontSize * state.scale) + 'px'; 
         el.style.color = field.color;
         el.style.textAlign = field.alignX;
         el.style.background = 'rgba(92, 225, 230, 0.15)';
         el.style.fontWeight = field.boldFont ? 'bold' : 'normal';
    } else if (field.type === 'qrcode') {
         el.innerText = 'QR: ' + field.key;
         el.style.background = 'rgba(255,255,255,0.9)';
         el.style.color = '#0b0b0b';
         el.style.border = '2px solid #0b0b0b';
         el.style.fontSize = '12px';
         el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
    } else {
         el.innerText = 'IMG: ' + field.key;
         el.style.background = 'rgba(255,235,59,0.3)';
         el.style.fontSize = '12px';
         el.style.color = '#0b0b0b';
         el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
    }
}

function selectField(id) {
    state.selectedId = id;
    document.querySelectorAll('.field-el').forEach(e => e.classList.remove('selected'));
    const el = document.getElementById(id);
    if(el) el.classList.add('selected');
    
    const f = state.fields.find(i => i.id === id);
    if (!f) return;

    const panel = document.getElementById('propertiesPanel');
    panel.style.display = 'block';
    
    document.getElementById('propKey').value = f.key;
    
    if (f.type === 'box') {
        document.getElementById('textProps').style.display = 'block';
        document.getElementById('imgProps').style.display = 'none';
        document.getElementById('propSize').value = f.fontSize;
        document.getElementById('propColor').value = f.color;
        document.getElementById('propAlignX').value = f.alignX;
        document.getElementById('propFontPath').value = f.boldFont ? 'Bold' : '';
    } else {
        document.getElementById('textProps').style.display = 'none';
        document.getElementById('imgProps').style.display = 'block';
        document.getElementById('propRadius').value = f.cornerRadius;
        document.getElementById('propCircle').checked = f.isCircle;
    }
}

function updateFieldData() {
    if (!state.selectedId) return;
    const f = state.fields.find(i => i.id === state.selectedId);
    const el = document.getElementById(f.id);
    
    f.key = document.getElementById('propKey').value;
    
    if (f.type === 'box') {
        f.fontSize = parseInt(document.getElementById('propSize').value) || 30;
        f.color = document.getElementById('propColor').value;
        f.alignX = document.getElementById('propAlignX').value;
        const fontVal = document.getElementById('propFontPath').value;
        f.boldFont = fontVal === 'Bold' ? 'Roboto-Bold.ttf' : null;
    } else {
        f.cornerRadius = parseInt(document.getElementById('propRadius').value) || 0;
        f.isCircle = document.getElementById('propCircle').checked;
    }
    
    updateElementVisuals(el, f);
}

function deleteSelected() {
    if(!state.selectedId) return;
    const el = document.getElementById(state.selectedId);
    el.remove();
    state.fields = state.fields.filter(f => f.id !== state.selectedId);
    state.selectedId = null;
    document.getElementById('propertiesPanel').style.display = 'none';
}

function initDrag(e, field, el) {
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = parseInt(el.style.left);
    const startTop = parseInt(el.style.top);
    
    const onMove = (mv) => {
        const dx = mv.clientX - startX;
        const dy = mv.clientY - startY;
        el.style.left = (startLeft + dx) + 'px';
        el.style.top = (startTop + dy) + 'px';
        field.x = startLeft + dx;
        field.y = startTop + dy;
    };
    
    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function initResize(e, field, el) {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = parseInt(el.style.width);
    const startH = parseInt(el.style.height);
    
    const onMove = (mv) => {
        const dx = mv.clientX - startX;
        const dy = mv.clientY - startY;
        el.style.width = Math.max(20, startW + dx) + 'px';
        el.style.height = Math.max(20, startH + dy) + 'px';
        field.w = Math.max(20, startW + dx);
        field.h = Math.max(20, startH + dy);
        updateElementVisuals(el, field);
    };
    
    const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

// Build the template object from state
function buildTemplate() {
    const scale = state.scale;
    return {
        backgroundImage: state.bgImage,
        textFields: state.fields.map(f => ({
            key: f.key,
            type: f.type,
            fontSize: f.fontSize,
            color: f.color,
            alignmentX: f.alignX,
            boldFont: f.boldFont,
            rect: {
                x1: Math.round(f.x / scale),
                y1: Math.round(f.y / scale),
                x2: Math.round((f.x + f.w) / scale),
                y2: Math.round((f.y + f.h) / scale)
            },
            cornerRadius: f.cornerRadius,
            isCircle: f.isCircle
        }))
    };
}

async function previewTemplate() {
    if(!state.bgImage) return alert("Canvas is empty. Load a background image first.");
    
    const btn = document.getElementById('btn-preview');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Generating...";
    btn.disabled = true;

    try {
        const template = buildTemplate();
        
        // Dummy Data for Preview
        const dummyData = {
            name: "John Doe",
            event_name: "CyberSecurity Summit 2026",
            date: new Date().toISOString().split('T')[0],
            venue: "Tech Convention Center",
            certificate_id: "DEMO-123-ABC",
            certificate_link: "https://haxnation.com/certificate/demo",
            qr_code: "https://haxnation.com/certificate/demo",
            user_avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random" 
        };

        const generator = new CertificateGenerator();
        generator.corsProxyUrl = 'https://api.haxnation.org/events/api/events/proxy?url=';
        const dataUrl = await generator.generate(template, dummyData);
        
        showPreviewModal(dataUrl);
    } catch(e) {
        alert("Preview Error: " + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

function showPreviewModal(base64Img) {
    let modal = document.getElementById('preview-modal');
    if(!modal) {
        modal = document.createElement('div');
        modal.id = 'preview-modal';
        modal.className = 'fixed inset-0 bg-ink/75 backdrop-blur-xs z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white border-2 border-ink shadow-[8px_8px_0_0_#0b0b0b] max-w-4xl w-full p-6 relative max-h-[90vh] overflow-y-auto font-mono">
                <button id="close-prev" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center font-mono font-black text-sm bg-white hover:bg-danger hover:text-white border-2 border-ink shadow-[2px_2px_0_0_#0b0b0b] cursor-pointer">&times;</button>
                <div class="flex items-center gap-2 border-b-2 border-ink pb-3 mb-4">
                    <div class="w-2.5 h-2.5 bg-cyan border border-ink"></div>
                    <h3 class="font-black text-base uppercase text-ink">Certificate Live Preview</h3>
                </div>
                <div class="border-2 border-ink shadow-[4px_4px_0_0_#0b0b0b] bg-canvas p-2 flex justify-center">
                    <img id="prev-img-el" class="max-w-full max-h-[60vh] object-contain">
                </div>
                <p class="text-xs text-neutral-600 font-bold uppercase text-center mt-4">[ RENDERED ON CLIENT WITH MOCK DATA ]</p>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#close-prev').onclick = () => modal.style.display = 'none';
        modal.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; };
    }
    
    document.getElementById('prev-img-el').src = base64Img;
    modal.style.display = 'flex';
}

async function saveTemplate() {
    const templateObj = buildTemplate();
    
    // Check if there is an unsaved background image in IndexedDB
    const dbKey = `pending_bg_${state.targetType}_${state.targetId}`;
    let pendingBlob = null;
    try {
        pendingBlob = await getPendingImage(dbKey);
    } catch(e) {
        console.warn("Could not read pending image", e);
    }
    
    if (pendingBlob) {
        let progModal = document.getElementById('upload-progress-modal');
        if (!progModal) {
            progModal = document.createElement('div');
            progModal.id = 'upload-progress-modal';
            progModal.className = 'fixed inset-0 bg-ink/75 backdrop-blur-xs z-50 flex items-center justify-center p-4';
            progModal.innerHTML = `
                <div class="bg-white border-2 border-ink shadow-[8px_8px_0_0_#0b0b0b] p-6 w-80 text-center font-mono">
                    <h3 class="font-black text-sm uppercase text-ink mb-4">Uploading Background</h3>
                    <div class="w-full bg-canvas border-2 border-ink h-4 overflow-hidden mb-2">
                        <div id="upload-progress-bar" class="w-0 h-full bg-cyan transition-all duration-100"></div>
                    </div>
                    <p id="upload-progress-text" class="text-xs font-bold text-neutral-700">0%</p>
                </div>
            `;
            document.body.appendChild(progModal);
        }
        const progBar = progModal.querySelector('#upload-progress-bar');
        const progText = progModal.querySelector('#upload-progress-text');
        progModal.style.display = 'flex';
        progBar.style.width = '0%';
        progText.innerText = '0%';

        try {
            progText.innerText = 'Requesting credentials...';
            const endpoint = state.targetType === 'community'
                ? `/community/${state.targetId}/certificate-template/upload-url`
                : `/event/${state.targetId}/certificate-template/upload-url`;
            
            const response = await api(endpoint, 'POST', { contentType: pendingBlob.type });
            if (!response || !response.data || !response.data.url) throw new Error("Could not get upload credentials");
            const res = response.data;
            
            // Perform XHR Upload
            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open(res.method, res.url);
                
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        progBar.style.width = percent + '%';
                        progText.innerText = percent + '%';
                    }
                };
                
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        reject(new Error("S3 Upload Failed: " + xhr.responseText));
                    }
                };
                xhr.onerror = () => reject(new Error("Network Error during S3 Upload"));
                
                if (res.method === 'PUT') {
                    xhr.setRequestHeader('Content-Type', pendingBlob.type);
                    xhr.send(pendingBlob);
                } else {
                    const formData = new FormData();
                    Object.keys(res.fields).forEach(key => formData.append(key, res.fields[key]));
                    if (!res.fields['Content-Type']) formData.append('Content-Type', pendingBlob.type);
                    formData.append('file', pendingBlob);
                    xhr.send(formData);
                }
            });
            
            templateObj.backgroundImage = res.s3Url;
            state.bgImage = res.s3Url; 
            
        } catch (e) {
            progModal.style.display = 'none';
            alert("Error uploading image: " + e.message);
            return;
        } finally {
            progModal.style.display = 'none';
        }
    }

    const template = JSON.stringify(templateObj);
    
    let endpoint = "";
    let body = {};
    if (state.targetType === 'community') {
        endpoint = `/community/${state.targetId}/certificate-template`;
        body = { template };
    } else {
        endpoint = `/event/${state.targetId}/certificate-settings`;
        body = { template, enabled: true };
    }

    localStorage.setItem('cert_backup_' + state.targetId, template);

    try {
        await api(endpoint, 'PUT', body);
        localStorage.removeItem('cert_backup_' + state.targetId);
        
        try {
            await clearPendingImage(`pending_bg_${state.targetType}_${state.targetId}`);
        } catch(e) {
            console.warn("Failed to clear pending image from IndexedDB", e);
        }
        
        let modal = document.getElementById('save-success-modal');
        if(!modal) {
            modal = document.createElement('div');
            modal.id = 'save-success-modal';
            modal.className = 'fixed inset-0 bg-ink/75 backdrop-blur-xs z-50 flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white border-2 border-ink shadow-[8px_8px_0_0_#0b0b0b] p-6 max-w-sm w-full text-center font-mono">
                    <div class="w-12 h-12 bg-success text-ink border-2 border-ink flex items-center justify-center text-xl font-black mx-auto mb-4 shadow-[2px_2px_0_0_#0b0b0b]">✓</div>
                    <h3 class="font-black text-lg uppercase text-ink mb-2">Template Saved!</h3>
                    <p class="text-xs text-neutral-700 font-bold mb-6">Certificate design specification successfully committed to cloud storage.</p>
                    <div class="flex gap-3 justify-center">
                        <button id="btn-ss-back" class="btn-secondary flex-1">Back</button>
                        <button id="btn-ss-stay" class="btn-primary flex-1">Keep Editing</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            modal.querySelector('#btn-ss-back').onclick = () => {
                modal.style.display = 'none';
                window.history.back();
            };
            modal.querySelector('#btn-ss-stay').onclick = () => {
                modal.style.display = 'none';
            };
        }
        modal.style.display = 'flex';
    } catch(e) {
        alert("Error saving: " + e.message + "\n\nLocal backup retained.");
    }
}

async function loadTemplateData(type, id) {
    try {
        let template = null;
        
        if (type === 'community') {
            const res = await api(`/community/${id}`);
            template = res?.data?.community?.certificateTemplate;
        } else if (type === 'event') {
            const res = await api(`/event/${id}/certificate-settings`);
            template = res?.data?.certificateTemplate;
        }

        if (typeof template === 'string') {
            try {
                template = JSON.parse(template);
            } catch(e) {
                console.warn("Could not parse template string", e);
                template = null;
            }
        }

        const backupStr = localStorage.getItem('cert_backup_' + id);
        if (backupStr) {
            if (confirm("You have an unsaved backup of this template from a previous session. Do you want to restore it?")) {
                try {
                    template = JSON.parse(backupStr);
                } catch(e) {
                    console.warn("Could not parse backup string", e);
                }
            } else {
                localStorage.removeItem('cert_backup_' + id);
            }
        }

        const dbKey = `pending_bg_${type}_${id}`;
        try {
            const pendingBlob = await getPendingImage(dbKey);
            if (pendingBlob) {
                if (state.pendingBlobUrl) URL.revokeObjectURL(state.pendingBlobUrl);
                state.pendingBlobUrl = URL.createObjectURL(pendingBlob);
                if (!template) template = {};
                template.backgroundImage = state.pendingBlobUrl;
            }
        } catch(e) {
            console.warn("Failed to read pending image from IndexedDB", e);
        }

        if (template && template.backgroundImage) {
            state.bgImage = template.backgroundImage;
            
            const bgUrlInput = document.getElementById('bgUrlInput');
            if(bgUrlInput) bgUrlInput.value = state.bgImage;

            const templateImage = document.getElementById('templateImage');
            const canvasArea = document.getElementById('canvas-area');
            
            templateImage.crossOrigin = "Anonymous";
            
            let srcUrl = state.bgImage;
            if (srcUrl.startsWith('s3://')) {
                srcUrl = (window.EVENTS_API_URL || API_URL.replace('admin', 'events')) + '/api/events/proxy?url=' + encodeURIComponent(srcUrl);
            }
            
            templateImage.onload = () => {
                const ws = document.getElementById('workspace');
                const aspect = templateImage.naturalWidth / templateImage.naturalHeight;
                
                let w = ws.clientWidth - 60;
                let h = w / aspect;
                
                if (h > ws.clientHeight - 60) {
                    h = ws.clientHeight - 60;
                    w = h * aspect;
                }
                
                canvasArea.style.width = w + 'px';
                canvasArea.style.height = h + 'px';
                canvasArea.style.backgroundImage = `url(${srcUrl})`;
                
                state.scale = w / templateImage.naturalWidth;
                
                document.querySelectorAll('.field-el').forEach(e => e.remove());
                state.fields = [];

                if (template.textFields) {
                    template.textFields.forEach((tf, index) => {
                        const f = {
                            id: 'field_' + Date.now() + '_' + index,
                            type: tf.type || 'box',
                            key: tf.key,
                            x: tf.rect.x1 * state.scale,
                            y: tf.rect.y1 * state.scale,
                            w: (tf.rect.x2 - tf.rect.x1) * state.scale,
                            h: (tf.rect.y2 - tf.rect.y1) * state.scale,
                            fontSize: tf.fontSize || 30,
                            color: tf.color || '#000000',
                            alignX: tf.alignmentX || 'left',
                            boldFont: tf.boldFont || null,
                            cornerRadius: tf.cornerRadius || 0,
                            isCircle: tf.isCircle || false
                        };
                        state.fields.push(f);
                        renderElement(f);
                    });
                }
            };
            
            templateImage.onerror = () => {
                console.error("Failed to load background image:", srcUrl);
                alert("Failed to load background image. Please try again.");
            };
            
            templateImage.src = srcUrl + (srcUrl.includes('?') ? '&' : '?') + '_cb=' + Date.now();
        }
    } catch (e) {
        console.error("Error loading template data:", e);
    }
}