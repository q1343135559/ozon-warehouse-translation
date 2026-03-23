let mapping = {};
let isTranslated = false;
let regex = null; // 新增：用于存储全局匹配的正则表达式

// 1. 加载映射数据
async function loadMapping() {
    try {
        const url = chrome.runtime.getURL('mapping.json');
        const response = await fetch(url);
        mapping = await response.json();

        // 生成正则表达式：按长度降序排列 Key（防止短词覆盖长词），并进行正则转义
        const sortedKeys = Object.keys(mapping).sort((a, b) => b.length - a.length);
        const pattern = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        regex = new RegExp(`(${pattern})`, 'g');

        init();
    } catch (e) {
        console.error("加载映射表失败:", e);
    }
}

// 2. 改进后的替换函数：支持单行多个关键词
function safeReplace(node) {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent;
    if (!text.trim() || !regex) return;

    // 使用正则拆分文本，保留分隔符（匹配到的 Key）
    const parts = text.split(regex);
    if (parts.length <= 1) return; // 如果没有匹配到任何 Key，直接跳过

    const fragment = document.createDocumentFragment();

    parts.forEach((part) => {
        if (mapping[part]) {
            // 如果这一部分是映射表中的 Key
            const span = document.createElement('span');
            span.className = 'translated-text-marker';
            span.setAttribute('data-orig', part);
            span.setAttribute('data-trans', mapping[part]);
            span.textContent = isTranslated ? mapping[part] : part;
            fragment.appendChild(span);
        } else if (part) {
            // 如果是普通的文本（如 " → "）
            fragment.appendChild(document.createTextNode(part));
        }
    });

    if (node.parentNode) {
        node.parentNode.replaceChild(fragment, node);
    }
}

// 3. 深度遍历 DOM 树 (无需修改)
function walk(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        if (['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(node.tagName) ||
            node.classList.contains('translated-text-marker')) return;
    }

    let child = node.firstChild;
    while (child) {
        let next = child.nextSibling;
        if (child.nodeType === Node.TEXT_NODE) {
            safeReplace(child);
        } else {
            walk(child);
        }
        child = next;
    }
}

// 4. 初始化逻辑 (无需修改)
function init() {
    walk(document.body);
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => m.addedNodes.forEach(node => walk(node)));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    createBtn();
}

// 5. 创建按钮逻辑 (无需修改，保持你原来的代码即可)
function createBtn() {
    // ... 保持你之前的 createBtn 代码不变 ...
    if (document.getElementById('translation-toggle-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'translation-toggle-btn';
    btn.textContent = "显示中文";

    btn.style.left = (window.innerWidth - 140) + 'px';
    btn.style.top = (window.innerHeight - 80) + 'px';
    btn.style.position = 'fixed';

    let isDragging = false;
    let dragThreshold = 5;
    let startX, startY, initialLeft, initialTop;

    btn.onmousedown = (e) => {
        isDragging = false;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = btn.offsetLeft;
        initialTop = btn.offsetTop;

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
                isDragging = true;
                let newLeft = initialLeft + dx;
                let newTop = initialTop + dy;
                const padding = 10;
                newLeft = Math.max(padding, Math.min(newLeft, window.innerWidth - btn.offsetWidth - padding));
                newTop = Math.max(padding, Math.min(newTop, window.innerHeight - btn.offsetHeight - padding));
                btn.style.left = newLeft + 'px';
                btn.style.top = newTop + 'px';
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    btn.onclick = (e) => {
        if (isDragging) {
            e.preventDefault();
            return;
        }
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