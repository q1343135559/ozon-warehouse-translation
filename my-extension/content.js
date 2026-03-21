let mapping = {};
let isTranslated = false;

// 1. 加载映射数据
async function loadMapping() {
    try {
        const url = chrome.runtime.getURL('mapping.json');
        const response = await fetch(url);
        mapping = await response.json();
        init();
    } catch (e) {
        console.error("加载映射表失败:", e);
    }
}

// 2. 安全的文本替换函数：通过拆分节点避免破坏 HTML 结构
function safeReplace(node) {
    if (node.nodeType !== Node.TEXT_NODE) return;
    const text = node.textContent;
    if (!text.trim()) return;

    const sortedKeys = Object.keys(mapping).sort((a, b) => b.length - a.length);

    // 查找当前文本节点是否包含任何 Key
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
            // 根据当前开关状态决定显示内容
            span.textContent = isTranslated ? mapping[matchedKey] : matchedKey;
            fragment.appendChild(span);
        }
    });

    if (node.parentNode) {
        node.parentNode.replaceChild(fragment, node);
    }
}

// 3. 深度遍历 DOM 树
function walk(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        // 跳过脚本、样式和输入区域
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

// 4. 初始化逻辑：扫描页面、启动监听并创建按钮
function init() {
    walk(document.body);

    // 监听动态加载的内容（如滚动加载、异步刷新）
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => m.addedNodes.forEach(node => walk(node)));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    createBtn();
}

// 5. 创建可拖拽的悬浮按钮
function createBtn() {
    if (document.getElementById('translation-toggle-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'translation-toggle-btn';
    btn.textContent = "显示中文";

    // 设置初始位置
    btn.style.left = (window.innerWidth - 140) + 'px';
    btn.style.top = (window.innerHeight - 80) + 'px';
    btn.style.position = 'fixed';

    let isDragging = false;
    let dragThreshold = 5; // 位移超过5像素才判定为拖拽
    let startX, startY, initialLeft, initialTop;

    // 鼠标按下：开始监听移动
    btn.onmousedown = (e) => {
        isDragging = false;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = btn.offsetLeft;
        initialTop = btn.offsetTop;

        const onMouseMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            // 判断是否为拖拽行为
            if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
                isDragging = true;

                let newLeft = initialLeft + dx;
                let newTop = initialTop + dy;

                // 边界限制：防止按钮超出屏幕
                const padding = 10;
                newLeft = Math.max(padding, Math.min(newLeft, window.innerWidth - btn.offsetWidth - padding));
                newTop = Math.max(padding, Math.min(newTop, window.innerHeight - btn.offsetHeight - padding));

                btn.style.left = newLeft + 'px';
                btn.style.top = newTop + 'px';
                btn.style.bottom = 'auto';
                btn.style.right = 'auto';
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // 点击事件：仅在非拖拽状态下切换翻译
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