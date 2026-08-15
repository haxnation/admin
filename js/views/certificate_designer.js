import { api } from '../utils.js';

// Local State
let state = {
    fields: [],
    selectedId: null,
    bgImage: null,
    scale: 1,
    targetType: null,
    targetId: null
};

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

    // Ensure state is fully reset when opening the designer
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
            #cert-root { display: flex; height: calc(100vh - 80px); background: #1e1e1e; color: #ddd; }
            #sidebar { width: 320px; background: #2d2d2d; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; border-right: 1px solid #444; }
            #workspace { flex: 1; display: flex; justify-content: center; align-items: center; position: relative; overflow: auto; background: #333; }
            #canvas-area { position: relative; box-shadow: 0 0 30px rgba(0,0,0,0.8); background-size: contain; background-repeat: no-repeat; transition: all 0.2s; }
            
            .field-el { position: absolute; border: 1px dashed rgba(255,255,255,0.5); background: rgba(0, 123, 255, 0.1); cursor: move; display: flex; align-items: center; justify-content: center; color: white; text-shadow: 0 0 2px black; font-size: 12px; overflow: hidden; white-space: nowrap; user-select: none; }
            .field-el:hover { border-color: #007bff; }
            .field-el.selected { border: 2px solid #00C853; background: rgba(0, 200, 83, 0.1); z-index: 100; }
            
            .resize-handle { width: 12px; height: 12px; background: #00C853; border: 1px solid white; position: absolute; bottom: -6px; right: -6px; cursor: se-resize; z-index: 101; border-radius: 50%; display:none; }
            .field-el.selected .resize-handle { display: block; }
            
            .control-group label { display: block; font-weight: bold; font-size: 12px; margin-top: 12px; color: #aaa; }
            .control-group input, .control-group select { width: 100%; padding: 8px; font-size: 13px; background: #444; border: 1px solid #555; color: white; border-radius: 4px; margin-top: 4px; }
            .control-group input:focus { border-color: #007bff; outline: none; }
            
            .var-tag { display: inline-block; padding: 2px 6px; background: #444; border-radius: 4px; font-size: 10px; margin: 2px; cursor: pointer; border: 1px solid #555; }
            .var-tag:hover { background: #555; border-color: #888; }

            .btn-tool { padding: 8px; border-radius: 4px; font-size: 12px; cursor: pointer; border: none; font-weight: bold; flex: 1; transition: opacity 0.2s; }
            .btn-tool:hover { opacity: 0.9; }
        `;
        document.head.appendChild(style);
    }

    container.innerHTML = `
        <div id="cert-root">
            <div id="sidebar">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="font-bold text-lg text-white">Cert Designer</h2>
                    <div class="flex gap-2">
                        <button id="btn-preview" class="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 transition">👁️ Preview</button>
                        <button id="btn-save" class="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700 transition">Save</button>
                    </div>
                </div>
                
                <div class="p-3 bg-gray-800 rounded border border-gray-700">
                    <label class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">1. Background Image</label>
                    <div class="flex gap-2 mb-2">
                        <input type="text" id="bgUrlInput" placeholder="https://..." class="text-xs text-gray-800 w-full p-1.5 rounded outline-none focus:ring-2 focus:ring-blue-500">
                        <button id="btn-load-bg" class="bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 transition">Load</button>
                    </div>
                    <div class="text-xs text-gray-400 text-center mb-1">- OR -</div>
                    <div class="flex flex-col gap-2">
                        <input type="file" id="bgUploadInput" accept="image/png, image/jpeg" class="hidden">
                        <button id="btn-upload-bg" class="w-full bg-purple-600 text-white px-3 py-1.5 rounded text-xs hover:bg-purple-700 transition">📤 Upload to CDN</button>
                        <div id="upload-status" class="text-[10px] text-gray-400 text-center hidden"></div>
                    </div>
                </div>

                <div>
                    <label class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2 block">2. Add Elements</label>
                    <div class="flex gap-2 mb-2">
                        <button id="btn-add-text" class="btn-tool bg-blue-600 text-white">+ Text</button>
                        <button id="btn-add-var" class="btn-tool bg-purple-600 text-white">+ Variable</button>
                    </div>
                    <div class="flex gap-2">
                        <button id="btn-add-qr" class="btn-tool bg-gray-600 text-white">+ QR Code</button>
                        <button id="btn-add-img" class="btn-tool bg-orange-600 text-white">+ Image</button>
                    </div>
                </div>

                <div id="propertiesPanel" style="display:none;" class="border-t border-gray-600 pt-4 control-group animate-fade-in">
                    <h3 class="font-bold mb-2 text-white flex justify-between">
                        Properties 
                        <span class="text-xs font-normal text-red-400 cursor-pointer hover:underline" id="btn-delete">Delete</span>
                    </h3>
                    
                    <label>Data Key / Content</label>
                    <div class="flex gap-2">
                        <input type="text" id="propKey" placeholder="e.g. name">
                    </div>
                    <div class="mt-2 flex flex-wrap" id="var-list"></div>

                    <div id="textProps">
                        <div class="flex gap-2">
                            <div class="flex-1">
                                <label>Size (px)</label>
                                <input type="number" id="propSize">
                            </div>
                            <div class="flex-1">
                                <label>Color</label>
                                <input type="color" id="propColor" style="height: 38px; padding: 2px;">
                            </div>
                        </div>
                        <label>Alignment</label>
                        <select id="propAlignX">
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                        </select>
                        <label>Font Weight</label>
                        <select id="propFontPath">
                             <option value="">Regular</option>
                             <option value="Bold">Bold</option>
                        </select>
                    </div>

                    <div id="imgProps" style="display:none;">
                         <label>Corner Radius</label>
                         <input type="number" id="propRadius">
                         <label class="flex items-center gap-2 mt-3 cursor-pointer">
                            <input type="checkbox" id="propCircle" style="width:auto; margin:0;"> Circular Mask
                         </label>
                    </div>
                </div>
                
                <button onclick="history.back()" class="mt-auto bg-gray-700 text-white py-2 rounded hover:bg-gray-600">Exit Designer</button>
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
            input.dispatchEvent(new Event('input')); // Trigger update
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
        templateImage.src = state.bgImage;
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
            canvasArea.style.backgroundImage = `url(${state.bgImage})`;
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
                uploadStatus.style.color = '#a855f7'; // purple-500

                // 1. Compress Image (Lossless/Minimal Loss)
                const options = {
                    maxSizeMB: 1,
                    maxWidthOrHeight: 2000,
                    useWebWorker: true,
                    initialQuality: 0.9 
                };
                const compressedFile = await imageCompression(file, options);
                
                uploadStatus.innerText = 'Requesting secure upload link...';
                
                // 2. Get Presigned URL
                const endpoint = state.targetType === 'community'
                    ? `/community/${state.targetId}/certificate-template/upload-url`
                    : `/event/${state.targetId}/certificate-template/upload-url`;
                
                const response = await api(endpoint, 'POST', { contentType: compressedFile.type });
                
                if (!response || !response.data || !response.data.url || !response.data.fields) {
                    throw new Error("Could not get upload credentials");
                }

                const res = response.data;
                uploadStatus.innerText = 'Uploading to CDN...';

                // 3. Post to S3
                let uploadRes;
                if (res.method === 'PUT') {
                    uploadRes = await fetch(res.url, {
                        method: 'PUT',
                        headers: { 'Content-Type': compressedFile.type },
                        body: compressedFile
                    });
                } else {
                    const formData = new FormData();
                    Object.keys(res.fields).forEach(key => {
                        formData.append(key, res.fields[key]);
                    });
                    // Ensure Content-Type is present for policy validation before the file field
                    if (!res.fields['Content-Type']) {
                        formData.append('Content-Type', compressedFile.type);
                    }
                    formData.append('file', compressedFile);

                    uploadRes = await fetch(res.url, {
                        method: 'POST',
                        body: formData
                    });
                }

                if (!uploadRes.ok) {
                    const text = await uploadRes.text();
                    console.error("S3 Upload Failed:", text);
                    throw new Error("Upload to S3 failed. Ensure CORS is configured.");
                }

                // 4. Update UI
                uploadStatus.innerText = 'Success!';
                uploadStatus.style.color = '#22c55e'; // green-500
                
                document.getElementById('bgUrlInput').value = res.s3Url;
                document.getElementById('btn-load-bg').click();

            } catch (err) {
                console.error(err);
                uploadStatus.innerText = err.message || 'Upload failed.';
                uploadStatus.style.color = '#ef4444'; // red-500
            } finally {
                uploadBtn.disabled = false;
                uploadInput.value = ''; // reset
                setTimeout(() => { if(uploadStatus.innerText === 'Success!') uploadStatus.style.display = 'none'; }, 3000);
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
    // Initial render
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
         el.style.background = 'rgba(0,0,0,0.1)';
         el.style.fontWeight = field.boldFont ? 'bold' : 'normal';
    } else if (field.type === 'qrcode') {
         el.innerText = 'QR: ' + field.key;
         el.style.background = 'rgba(255,255,255,0.8)';
         el.style.color = 'black';
         el.style.border = '2px solid black';
         el.style.fontSize = '12px';
         el.style.display = 'flex'; el.style.alignItems = 'center'; el.style.justifyContent = 'center';
    } else {
         el.innerText = 'IMG: ' + field.key;
         el.style.background = 'rgba(255,165,0,0.3)';
         el.style.fontSize = '12px';
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
    if(!state.bgImage) return alert("Canvas is empty");
    
    const btn = document.getElementById('btn-preview');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Generating...";
    btn.disabled = true;

    try {
        const template = buildTemplate();
        
        // Dummy Data for Preview
        const dummyData = {
            name: "John Doe",
            event_name: "Sample Event 2024",
            date: new Date().toISOString().split('T')[0],
            venue: "Tech Convention Center",
            certificate_id: "DEMO-123-ABC",
            certificate_link: "https://haxnation.com/certificate/demo",
            qr_code: "https://haxnation.com/certificate/demo",
            user_avatar: "https://ui-avatars.com/api/?name=John+Doe&background=random" 
        };

        // Render purely via Frontend using the included JS Class
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
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;";
        modal.innerHTML = `
            <div style="background:#222; padding:10px; border-radius:8px; max-width:90%; max-height:90%; display:flex; flex-direction:column; position:relative;">
                <button id="close-prev" style="position:absolute; top:-15px; right:-15px; background:red; color:white; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer;">X</button>
                <img id="prev-img-el" style="max-width:100%; max-height:80vh; border:1px solid #444;">
                <p style="color:#aaa; text-align:center; margin-top:10px; font-size:12px;">This is a sample with dummy data generated on the frontend.</p>
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

    // Always backup locally before saving, in case of API failure (like 401)
    localStorage.setItem('cert_backup_' + state.targetId, template);

    try {
        await api(endpoint, 'PUT', body);
        // Clear backup on success
        localStorage.removeItem('cert_backup_' + state.targetId);
        
        let modal = document.getElementById('save-success-modal');
        if(!modal) {
            modal = document.createElement('div');
            modal.id = 'save-success-modal';
            modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;";
            modal.innerHTML = `
                <div style="background:#1f2937; padding:24px; border-radius:8px; max-width:400px; width:90%; text-align:center; color:white; border: 1px solid #374151; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);">
                    <div style="font-size:48px; margin-bottom:16px;">✅</div>
                    <h3 style="font-size:20px; font-weight:bold; margin-bottom:8px;">Template Saved!</h3>
                    <p style="color:#9ca3af; margin-bottom:24px; font-size:14px;">Your certificate template has been saved successfully to the cloud.</p>
                    <div style="display:flex; gap:12px; justify-content:center;">
                        <button id="btn-ss-back" style="padding:8px 16px; background:#4b5563; border-radius:6px; font-weight:bold; transition:background 0.2s;" onmouseover="this.style.background='#6b7280'" onmouseout="this.style.background='#4b5563'">Go Back</button>
                        <button id="btn-ss-stay" style="padding:8px 16px; background:#22c55e; border-radius:6px; font-weight:bold; transition:background 0.2s;" onmouseover="this.style.background='#16a34a'" onmouseout="this.style.background='#22c55e'">Keep Editing</button>
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
        alert("Error saving: " + e.message + "\n\nDon't worry, a local backup was saved. Refresh or login again and it will ask to restore.");
    }
}

async function loadTemplateData(type, id) {
    try {
        let template = null;
        
        // Fetch existing template
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

        // Check for local backup
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

        if (template && template.backgroundImage) {
            state.bgImage = template.backgroundImage;
            
            // Populate the input field
            const bgUrlInput = document.getElementById('bgUrlInput');
            if(bgUrlInput) bgUrlInput.value = state.bgImage;

            const templateImage = document.getElementById('templateImage');
            const canvasArea = document.getElementById('canvas-area');
            
            templateImage.crossOrigin = "Anonymous";
            templateImage.src = state.bgImage;
            
            // Once the background loads, calculate the scale and restore the fields
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
                canvasArea.style.backgroundImage = `url(${state.bgImage})`;
                
                // Calculate the scale ratio compared to the original image size
                state.scale = w / templateImage.naturalWidth;
                
                // Clear any existing fields and state
                document.querySelectorAll('.field-el').forEach(e => e.remove());
                state.fields = [];

                // Restore the saved fields
                if (template.textFields) {
                    template.textFields.forEach((tf, index) => {
                        const f = {
                            id: 'field_' + Date.now() + '_' + index,
                            type: tf.type || 'box',
                            key: tf.key,
                            // Convert saved absolute coordinates back to scaled canvas coordinates
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
                        renderElement(f); // Redraw onto canvas
                    });
                }
            };
        }
    } catch (e) {
        console.error("Error loading template data:", e);
    }
}