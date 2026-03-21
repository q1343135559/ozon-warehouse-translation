let mapping = {};
let isTranslated = false;

// 加载映射数据
async function loadMapping() {
    try {
        const url = chrome.runtime.getURL('mapping.json');
        const response = await fetch(url);
        mapping = await response.json();
        init();
    } catch (e) { console.error("加载失败", e); }
}

// 安全的文本替换函数：不使用 innerHTML
function safeReplace(node) {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent;
    if (!text.trim()) return;

    const sortedKeys = Object.keys(mapping).sort((a, b) => b.length - a.length);

    // 检查这个文本节点是否包含任何 Key
    let matchedKey = sortedKeys.find(key => text.includes(key));
    if (!matchedKey) return;

    // 创建片段来替换原始文本节点
    const fragment = document.createDocumentFragment();
    const parts = text.split(matchedKey);

    parts.forEach((part, index) => {
        if (part) fragment.appendChild(document.createTextNode(part));
        if (index < parts.length - 1) {
            const span = document.createElement('span');
            span.className = 'translated-text-marker';
            span.setAttribute('data-orig', matchedKey);
            span.setAttribute('data-trans', mapping[matchedKey]);
            // 根据当前开关状态决定显示什么内容
            span.textContent = isTranslated ? mapping[matchedKey] : matchedKey;
            fragment.appendChild(span);
        }
    });

    node.parentNode.replaceChild(fragment, node);
}

// 深度遍历
function walk(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        // 跳过脚本、样式和已经处理过的区域
        if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(node.tagName) ||
            node.classList.contains('translated-text-marker')) return;
    }

    let child = node.firstChild;
    while (child) {
        let next = child.nextSibling; // 提前保存，防止替换节点导致遍历中断
        if (child.nodeType === Node.TEXT_NODE) {
            safeReplace(child);
        } else {
            walk(child);
        }
        child = next;
    }
}

function init() {
    walk(document.body);

    // 监听动态加载的内容
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => m.addedNodes.forEach(node => walk(node)));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    createBtn();
}

function createBtn() {
    if (document.getElementById('translation-toggle-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'translation-toggle-btn';
    btn.textContent = "显示中文";
    btn.onclick = () => {
        isTranslated = !isTranslated;
        document.querySelectorAll('.translated-text-marker').forEach(el => {
            el.textContent = isTranslated ? el.getAttribute('data-trans') : el.getAttribute('data-orig');
        });
        btn.textContent = isTranslated ? "显示原文" : "显示中文";
        btn.style.backgroundColor = isTranslated ? "#4caf50" : "#005bff";
    };
    document.documentElement.appendChild(btn);
}

loadMapping();