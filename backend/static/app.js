/**
 * LLM Translator - 前端逻辑
 */

const API_BASE = window.location.origin;

// ========== DOM Elements ==========
const $sourceText = document.getElementById('source-text');
const $targetText = document.getElementById('target-text');
const $charCount = document.getElementById('char-count');
const $btnTranslate = document.getElementById('btn-translate');
const $btnClear = document.getElementById('btn-clear');
const $btnCopy = document.getElementById('btn-copy');
const $statusDot = document.getElementById('status-dot');
const $toastContainer = document.getElementById('toast-container');

// Tabs
const $tabText = document.getElementById('tab-text');
const $tabDocument = document.getElementById('tab-document');
const $textMode = document.getElementById('text-mode');
const $documentMode = document.getElementById('document-mode');

// Document
const $uploadBox = document.getElementById('upload-box');
const $fileInput = document.getElementById('file-input');
const $docUploadArea = document.getElementById('doc-upload-area');
const $docTranslateArea = document.getElementById('doc-translate-area');
const $docFilename = document.getElementById('doc-filename');
const $docSegments = document.getElementById('doc-segments');
const $btnDocTranslate = document.getElementById('btn-doc-translate');
const $btnDocReset = document.getElementById('btn-doc-reset');
const $progressBar = document.getElementById('progress-bar');
const $progressFill = document.getElementById('progress-fill');
const $docResults = document.getElementById('doc-results');

// Direction
const dirBtns = document.querySelectorAll('.dir-btn');

// ========== State ==========
let currentDirection = 'en2zh';
let currentDocTaskId = null;
let isTranslating = false;

// ========== Toast ==========
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    $toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ========== Health Check ==========
async function checkHealth() {
    try {
        const resp = await fetch(`${API_BASE}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '', direction: 'en2zh' }),
            signal: AbortSignal.timeout(3000),
        });
        // Even a 422 means the server is up
        $statusDot.className = 'status-dot online';
        $statusDot.title = 'Ollama 服务已连接';
    } catch {
        $statusDot.className = 'status-dot offline';
        $statusDot.title = 'Ollama 服务未连接';
    }
}

// ========== Tab Switching ==========
function switchTab(mode) {
    $tabText.classList.toggle('active', mode === 'text');
    $tabDocument.classList.toggle('active', mode === 'document');
    $textMode.classList.toggle('hidden', mode !== 'text');
    $documentMode.classList.toggle('hidden', mode !== 'document');
}

$tabText.addEventListener('click', () => switchTab('text'));
$tabDocument.addEventListener('click', () => switchTab('document'));

// ========== Direction Switching ==========
dirBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        dirBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDirection = btn.dataset.dir;
    });
});

// ========== Char Count ==========
$sourceText.addEventListener('input', () => {
    $charCount.textContent = `${$sourceText.value.length} 字符`;
});

// ========== Clear ==========
$btnClear.addEventListener('click', () => {
    $sourceText.value = '';
    $targetText.innerHTML = '<span class="placeholder-text">译文将显示在这里...</span>';
    $charCount.textContent = '0 字符';
});

// ========== Copy ==========
$btnCopy.addEventListener('click', () => {
    const text = $targetText.innerText;
    if (!text || text === '译文将显示在这里...') return;
    navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板', 'success'));
});

// ========== Text Translation (SSE) ==========
async function translateText() {
    const text = $sourceText.value.trim();
    if (!text) return;
    if (isTranslating) return;

    isTranslating = true;
    $btnTranslate.disabled = true;
    $targetText.innerHTML = '<span class="cursor"></span>';

    try {
        const resp = await fetch(`${API_BASE}/api/translate/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, direction: currentDirection }),
        });

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let result = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.text) {
                        result += data.text;
                        $targetText.innerHTML = result + '<span class="cursor"></span>';
                    }
                    if (data.done) {
                        $targetText.innerHTML = result || '<span class="placeholder-text">（无翻译结果）</span>';
                    }
                } catch { /* skip malformed SSE */ }
            }
        }

        if (!result) {
            $targetText.innerHTML = '<span class="placeholder-text">（无翻译结果）</span>';
        } else {
            $targetText.innerHTML = result;
        }
    } catch (err) {
        showToast(`翻译失败: ${err.message}`, 'error');
        $targetText.innerHTML = '<span class="placeholder-text">翻译出错，请检查Ollama服务</span>';
    } finally {
        isTranslating = false;
        $btnTranslate.disabled = false;
    }
}

$btnTranslate.addEventListener('click', translateText);

// Ctrl+Enter 快捷键
$sourceText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        translateText();
    }
});

// ========== Document Upload ==========
// Drag & Drop
$uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    $uploadBox.classList.add('drag-over');
});

$uploadBox.addEventListener('dragleave', () => {
    $uploadBox.classList.remove('drag-over');
});

$uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    $uploadBox.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
});

$uploadBox.addEventListener('click', () => $fileInput.click());
$fileInput.addEventListener('change', () => {
    if ($fileInput.files[0]) uploadFile($fileInput.files[0]);
});

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        showToast('正在解析文档...', 'info');
        const resp = await fetch(`${API_BASE}/api/document/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || 'Upload failed');
        }

        const data = await resp.json();
        currentDocTaskId = data.task_id;

        // Show translate area
        $docUploadArea.classList.add('hidden');
        $docTranslateArea.classList.remove('hidden');
        $docFilename.textContent = data.filename;
        $docSegments.textContent = `${data.total_segments} 段`;
        $docResults.innerHTML = '';
        $progressBar.classList.add('hidden');
        $progressFill.style.width = '0%';

        showToast(`文档解析完成: ${data.total_segments} 段`, 'success');
    } catch (err) {
        showToast(`上传失败: ${err.message}`, 'error');
    }
}

// ========== Document Translation ==========
$btnDocTranslate.addEventListener('click', async () => {
    if (!currentDocTaskId || isTranslating) return;

    isTranslating = true;
    $btnDocTranslate.disabled = true;
    $progressBar.classList.remove('hidden');
    $docResults.innerHTML = '';

    try {
        const resp = await fetch(`${API_BASE}/api/document/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                task_id: currentDocTaskId,
                direction: currentDirection,
            }),
        });

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                try {
                    const data = JSON.parse(line.slice(6));

                    if (data.done) {
                        showToast(`翻译完成！共 ${data.total} 段`, 'success');
                        continue;
                    }

                    // Update progress
                    $progressFill.style.width = `${(data.progress * 100).toFixed(1)}%`;

                    // Add result row
                    const row = document.createElement('div');
                    row.className = 'doc-row';
                    row.innerHTML = `
                        <div class="source-text">
                            <div class="page-badge">段落 ${data.index + 1} · 第${data.page}页</div>
                            ${escapeHtml(data.source)}
                        </div>
                        <div class="target-text">
                            ${escapeHtml(data.translation)}
                        </div>
                    `;
                    $docResults.appendChild(row);
                    row.scrollIntoView({ behavior: 'smooth', block: 'end' });
                } catch { /* skip */ }
            }
        }
    } catch (err) {
        showToast(`翻译失败: ${err.message}`, 'error');
    } finally {
        isTranslating = false;
        $btnDocTranslate.disabled = false;
    }
});

// ========== Document Reset ==========
$btnDocReset.addEventListener('click', () => {
    currentDocTaskId = null;
    $docUploadArea.classList.remove('hidden');
    $docTranslateArea.classList.add('hidden');
    $fileInput.value = '';
});

// ========== Util ==========
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========== Init ==========
checkHealth();
setInterval(checkHealth, 30000);
