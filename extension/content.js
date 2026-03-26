/**
 * Content Script
 * DOM文本提取与翻译注入
 */

const API_BASE = 'http://localhost:8000';

// 持续追踪鼠标位置（右键菜单关闭后selection会被清空）
let lastMouseX = 0;
let lastMouseY = 0;
document.addEventListener('mousedown', (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

// 忽略的标签
const IGNORED_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT',
    'EMBED', 'APPLET', 'CODE', 'PRE', 'SVG', 'MATH',
    'INPUT', 'TEXTAREA', 'SELECT',
]);

// 收集页面中的可翻译文本节点
function collectTextNodes(root = document.body) {
    const nodes = [];
    const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (IGNORED_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
                if (parent.closest('[data-llm-translated]')) return NodeFilter.FILTER_REJECT;
                if (parent.classList.contains('llm-translation')) return NodeFilter.FILTER_REJECT;

                const text = node.textContent.trim();
                // 至少3个字符，且包含字母
                if (text.length < 3 || !/[a-zA-Z\u4e00-\u9fff]/.test(text)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    while (walker.nextNode()) {
        nodes.push(walker.currentNode);
    }
    return nodes;
}

// 将文本节点按段落分组
function groupTextNodes(nodes, maxChars = 500) {
    const groups = [];
    let current = [];
    let currentLen = 0;

    for (const node of nodes) {
        const text = node.textContent.trim();
        if (currentLen + text.length > maxChars && current.length > 0) {
            groups.push([...current]);
            current = [];
            currentLen = 0;
        }
        current.push(node);
        currentLen += text.length;
    }

    if (current.length > 0) groups.push(current);
    return groups;
}

// 在元素下方插入翻译
function insertTranslation(node, translation) {
    const parent = node.parentElement;
    if (!parent || parent.getAttribute('data-llm-translated')) return;

    const translationEl = document.createElement('span');
    translationEl.className = 'llm-translation';
    translationEl.textContent = translation;
    parent.setAttribute('data-llm-translated', 'true');

    // 插入到父元素末尾
    parent.appendChild(document.createElement('br'));
    parent.appendChild(translationEl);
}

// 翻译单个文本
async function translateSingle(text, direction = 'auto') {
    const resp = await fetch(`${API_BASE}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, direction }),
    });
    const data = await resp.json();
    return data.translation;
}

// 整页翻译
async function translatePage(direction = 'auto') {
    const nodes = collectTextNodes();
    if (nodes.length === 0) return;

    // 显示翻译进度提示
    showProgressIndicator(nodes.length);

    let translated = 0;
    // 逐段翻译，避免同时发太多请求
    const concurrency = 2;
    const queue = [...nodes];

    async function processNode() {
        while (queue.length > 0) {
            const node = queue.shift();
            const text = node.textContent.trim();
            if (text.length < 3) continue;

            try {
                const translation = await translateSingle(text, direction);
                if (translation && translation !== text) {
                    insertTranslation(node, translation);
                }
            } catch { /* skip failed */ }

            translated++;
            updateProgress(translated, nodes.length);
        }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
        workers.push(processNode());
    }
    await Promise.all(workers);

    removeProgressIndicator();
}

// 移除所有翻译
function removeTranslations() {
    document.querySelectorAll('.llm-translation').forEach(el => {
        const br = el.previousElementSibling;
        if (br && br.tagName === 'BR') br.remove();
        el.remove();
    });
    document.querySelectorAll('[data-llm-translated]').forEach(el => {
        el.removeAttribute('data-llm-translated');
    });
}

// 进度指示器
function showProgressIndicator(total) {
    let indicator = document.getElementById('llm-progress');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'llm-progress';
        indicator.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <div class="llm-spinner"></div>
                <span>翻译中... <span id="llm-progress-text">0/${total}</span></span>
            </div>
        `;
        document.body.appendChild(indicator);
    }
}

function updateProgress(current, total) {
    const el = document.getElementById('llm-progress-text');
    if (el) el.textContent = `${current}/${total}`;
}

function removeProgressIndicator() {
    const el = document.getElementById('llm-progress');
    if (el) {
        el.textContent = '✅ 翻译完成';
        setTimeout(() => el.remove(), 2000);
    }
}

// 显示选中翻译弹窗
function showSelectionPopup(source, translation) {
    // 移除已有弹窗
    document.querySelectorAll('.llm-popup').forEach(el => el.remove());

    // 尝试用selection定位，失败则退回到鼠标位置
    let posX = lastMouseX;
    let posY = lastMouseY + 8;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0) {
            posX = rect.left;
            posY = rect.bottom + 8;
        }
    }

    const popup = document.createElement('div');
    popup.className = 'llm-popup';
    popup.innerHTML = `
        <div class="llm-popup-content">${escapeHtml(translation)}</div>
        <button class="llm-popup-copy" title="复制">📋</button>
    `;
    popup.style.top = `${window.scrollY + posY}px`;
    popup.style.left = `${window.scrollX + posX}px`;

    popup.querySelector('.llm-popup-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(translation);
        popup.remove();
    });

    document.body.appendChild(popup);

    // 确保弹窗不超出视口右侧
    const popupRect = popup.getBoundingClientRect();
    if (popupRect.right > window.innerWidth) {
        popup.style.left = `${window.scrollX + window.innerWidth - popupRect.width - 16}px`;
    }

    // 点击其他地方关闭
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', handler);
            }
        });
    }, 100);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========== Message Handling ==========
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'START_PAGE_TRANSLATE') {
        translatePage(msg.direction);
    }

    if (msg.type === 'REMOVE_TRANSLATIONS') {
        removeTranslations();
    }

    if (msg.type === 'SHOW_TRANSLATION') {
        showSelectionPopup(msg.source, msg.translation);
    }

    if (msg.type === 'SHOW_ERROR') {
        showSelectionPopup('Error', msg.message);
    }
});
