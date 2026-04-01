/**
 * Background Service Worker
 * 管理右键菜单和翻译请求队列
 */

const API_BASE = 'http://localhost:50060';

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
            
            // 发送翻译结果到content script，如果失败则用notifications API
            try {
                await chrome.tabs.sendMessage(tab.id, {
                    type: 'SHOW_TRANSLATION',
                    source: info.selectionText,
                    translation: data.translation,
                });
            } catch (notifyErr) {
                console.warn('[LLM Translator] 无法显示popup，使用notifications:', notifyErr);
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'LLM Translator',
                    message: data.translation || '翻译完成',
                });
            }
        } catch (err) {
            console.error('[LLM Translator] 翻译出错:', err);
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'LLM Translator',
                message: '翻译失败: ' + err.message,
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
            console.log('[LLM Translator] 查询标签页:', tabs);
            if (tabs[0]) {
                console.log('[LLM Translator] 发送消息到标签页:', tabs[0].id);
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'START_PAGE_TRANSLATE',
                    direction: msg.direction,
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[LLM Translator] 发送失败:', chrome.runtime.lastError.message);
                    } else {
                        console.log('[LLM Translator] 发送成功:', response);
                    }
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
