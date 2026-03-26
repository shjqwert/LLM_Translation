/**
 * Popup Logic
 */

const $statusDot = document.getElementById('status-dot');
const $btnTranslatePage = document.getElementById('btn-translate-page');
const $btnRemove = document.getElementById('btn-remove');
const $quickInput = document.getElementById('quick-input');
const $quickOutput = document.getElementById('quick-output');
const $apiUrl = document.getElementById('api-url');
const dirBtns = document.querySelectorAll('.dir-btn');

let currentDirection = 'en2zh';

// Load saved settings
chrome.storage.local.get(['direction', 'apiUrl'], (data) => {
    if (data.direction) {
        currentDirection = data.direction;
        dirBtns.forEach(b => b.classList.toggle('active', b.dataset.dir === currentDirection));
    }
    if (data.apiUrl) {
        $apiUrl.value = data.apiUrl;
    }
});

// Direction switching
dirBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        dirBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDirection = btn.dataset.dir;
        chrome.storage.local.set({ direction: currentDirection });
    });
});

// Save API URL
$apiUrl.addEventListener('change', () => {
    chrome.storage.local.set({ apiUrl: $apiUrl.value.trim() });
});

// Health check
async function checkHealth() {
    try {
        const resp = await fetch(`${$apiUrl.value}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: '', direction: 'en2zh' }),
            signal: AbortSignal.timeout(2000),
        });
        $statusDot.className = 'status-dot online';
    } catch {
        $statusDot.className = 'status-dot offline';
    }
}
checkHealth();

// Translate page
$btnTranslatePage.addEventListener('click', () => {
    chrome.runtime.sendMessage({
        type: 'TRANSLATE_PAGE',
        direction: currentDirection,
    });
    window.close();
});

// Remove translations
$btnRemove.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'REMOVE_TRANSLATIONS' });
        }
    });
    window.close();
});

// Quick translate
let quickTimer = null;
$quickInput.addEventListener('input', () => {
    clearTimeout(quickTimer);
    quickTimer = setTimeout(async () => {
        const text = $quickInput.value.trim();
        if (!text) {
            $quickOutput.textContent = '';
            return;
        }
        $quickOutput.textContent = '翻译中...';
        try {
            const resp = await fetch(`${$apiUrl.value}/api/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, direction: currentDirection }),
            });
            const data = await resp.json();
            $quickOutput.textContent = data.translation || '(无结果)';
        } catch (err) {
            $quickOutput.textContent = `错误: ${err.message}`;
        }
    }, 500);
});

$quickInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        clearTimeout(quickTimer);
        $quickInput.dispatchEvent(new Event('input'));
    }
});
