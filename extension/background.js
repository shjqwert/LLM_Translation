/**
 * Background Service Worker
 * 管理右键菜单和翻译请求队列
 */

const API_BASE = 'http://localhost:8000';

// 安装或更新时创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
    // 先清除旧菜单再创建，确保更新后也能正确注册
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: 'translate-selection',
            title: '翻译选中文本',
            contexts: ['selection'],
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('[LLM Translator] 菜单创建失败:', chrome.runtime.lastError);
            } else {
                console.log('[LLM Translator] 右键菜单已注册');
            }
        });
    });
});

// 右键菜单点击处理
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    console.log('[LLM Translator] 菜单点击:', info.menuItemId, info.selectionText?.substring(0, 50));
    if (info.menuItemId === 'translate-selection' && info.selectionText) {
        const { direction = 'auto' } = await chrome.storage.local.get('direction');
        try {
            console.log('[LLM Translator] 发送翻译请求...');
            const resp = await fetch(`${API_BASE}/api/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: info.selectionText,
                    direction,
                }),
            });
            const data = await resp.json();
            console.log('[LLM Translator] 翻译结果:', data.translation?.substring(0, 50));
            // 发送翻译结果到content script
            chrome.tabs.sendMessage(tab.id, {
                type: 'SHOW_TRANSLATION',
                source: info.selectionText,
                translation: data.translation,
            });
        } catch (err) {
            console.error('[LLM Translator] 翻译出错:', err);
            chrome.tabs.sendMessage(tab.id, {
                type: 'SHOW_ERROR',
                message: '翻译失败，请检查Ollama服务是否启动',
            });
        }
    }
});

// 接收来自popup或content script的消息
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'TRANSLATE') {
        translateText(msg.text, msg.direction).then(sendResponse);
        return true; // 异步响应
    }

    if (msg.type === 'TRANSLATE_PAGE') {
        // 转发给content script
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'START_PAGE_TRANSLATE',
                    direction: msg.direction,
                });
            }
        });
    }
});

async function translateText(text, direction = 'auto') {
    try {
        const resp = await fetch(`${API_BASE}/api/translate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, direction }),
        });
        return await resp.json();
    } catch (err) {
        return { error: err.message };
    }
}
