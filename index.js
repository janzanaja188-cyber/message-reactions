import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "message-reactions";
let reactionsDB = {};
let currentAvatarUrl = "";

function loadReactions() {
    const saved = localStorage.getItem(`${extensionName}_db`);
    if (saved) reactionsDB = JSON.parse(saved);
}

function saveReactions() {
    localStorage.setItem(`${extensionName}_db`, JSON.stringify(reactionsDB));
}

function updateFloatingBtn() {
    const context = getContext();
    if (!context.chatId) {
        $('#mr-floating-btn').hide();
        return;
    }

    $('#mr-floating-btn').show();

    if (context.characterId && context.characters[context.characterId]) {
        currentAvatarUrl = `/characters/${context.characters[context.characterId].avatar}`;
        $('#mr-floating-btn').css('background-image', `url('${currentAvatarUrl}')`);
    }

    const charId = context.characterId;
    let count = Object.keys(reactionsDB).filter(k => k.startsWith(charId + '_') && reactionsDB[k].is_favorited).length;

    if (count > 0) {
        $('#mr-badge').text(count).show();
    } else {
        $('#mr-badge').hide();
    }
}

function injectUI() {
    if (document.getElementById('mr-floating-btn') === null) {
        const uiContainer = document.createElement('div');
        uiContainer.id = "mr-extension-container";
        uiContainer.innerHTML = `
            <div id="mr-floating-btn" style="display: none;">
                <div id="mr-badge" style="display: none;">0</div>
            </div>
            <div id="mr-modal" style="display: none;">
                <div id="mr-modal-header">
                    <span>รายการโปรด</span>
                    <i id="mr-close-btn" class="fa-solid fa-xmark" style="cursor: pointer;"></i>
                </div>
                <div id="mr-modal-body"></div>
            </div>
        `;

        const targetContainer = document.getElementById('bg_layer') || document.body;
        targetContainer.appendChild(uiContainer);

        setupDraggable();

        $(document).on('click', '#mr-floating-btn', function(e) {
            if (!$(this).hasClass('is-dragging')) {
                renderModal();
            }
        });

        $(document).on('click', '#mr-close-btn', function() {
            $('#mr-modal').hide();
        });

        console.log(`[${extensionName}] UI Injected into ${targetContainer.id || 'body'}`);
    }
}

function setupDraggable() {
    const btn = document.getElementById('mr-floating-btn');
    let isDragging = false;
    let startX, startY, initialX, initialY;
    let moved = false;

    const startDrag = (e) => {
        isDragging = true;
        moved = false;
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        startX = clientX;
        startY = clientY;
        initialX = btn.offsetLeft;
        initialY = btn.offsetTop;
        btn.style.transition = 'none';
    };

    const doDrag = (e) => {
        if (!isDragging) return;
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        const dx = clientX - startX;
        const dy = clientY - startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            moved = true;
            $(btn).addClass('is-dragging');
        }

        let newX = initialX + dx;
        let newY = initialY + dy;

        const maxX = window.innerWidth - btn.offsetWidth;
        const maxY = window.innerHeight - btn.offsetHeight;
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));

        btn.style.left = newX + 'px';
        btn.style.top = newY + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
    };

    const stopDrag = (e) => {
        isDragging = false;
        btn.style.transition = 'all 0.2s';
        setTimeout(() => $(btn).removeClass('is-dragging'), 50);
    };

    btn.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);

    btn.addEventListener('touchstart', startDrag, {passive: true});
    document.addEventListener('touchmove', doDrag, {passive: false});
    document.addEventListener('touchend', stopDrag);
}

function renderModal() {
    const context = getContext();
    const charId = context.characterId;
    const body = $('#mr-modal-body');
    body.empty();

    const favs = Object.keys(reactionsDB)
        .filter(k => k.startsWith(charId + '_') && reactionsDB[k].is_favorited)
        .map(k => reactionsDB[k]);

    if (favs.length === 0) {
        body.append('<p style="text-align:center; opacity:0.5;">ยังไม่มีข้อความโปรด</p>');
    } else {
        favs.forEach(fav => {
            const html = `
                <div class="mr-fav-item">
                    <div class="mr-fav-header">ข้อความที่ ${fav.mesIndex} • ${new Date(fav.saveTime).toLocaleString()}</div>
                    <input type="text" class="mr-fav-title-input" data-key="${fav.key}" placeholder="ตั้งชื่อความทรงจำ..." value="${fav.customTitle || ''}">
                    <div class="mr-fav-snippet">"${fav.snippet}"</div>
                </div>
            `;
            body.append(html);
        });

        $('.mr-fav-title-input').on('input', function() {
            const key = $(this).attr('data-key');
            reactionsDB[key].customTitle = $(this).val();
            saveReactions();
        });
    }

    $('#mr-modal').css('display', 'flex');
}

function processMessage(mesId) {
    const context = getContext();
    const chatData = context.chat;
    if (!chatData || !chatData[mesId]) return;
    if (chatData[mesId].is_user) return;

    const msgElement = $(`.mes[mesid="${mesId}"]`);
    if (msgElement.find('.msg-reaction-container').length > 0) return;

    const characterId = context.characterId || "unknown";
    const uniqueKey = `${characterId}_${mesId}`;

    const isFavorited = reactionsDB[uniqueKey]?.is_favorited || false;
    const heartClass = isFavorited ? 'fa-solid active-heart' : 'fa-regular';

    const btnHtml = `
        <div class="msg-reaction-container" style="display: flex; gap: 8px; margin-top: 5px; padding-left: 10px;">
            <div class="reaction-btn heart-btn" title="Like" data-key="${uniqueKey}" data-mesid="${mesId}">
                <i class="fa-heart ${heartClass}"></i>
            </div>
        </div>
    `;

    msgElement.find('.mes_text').after(btnHtml);
}

function processAllMessages() {
    const context = getContext();
    if (!context.chat) return;
    for (let i = 0; i < context.chat.length; i++) processMessage(i);
    updateFloatingBtn();
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading... (Final Version)`);

    loadReactions();

    setTimeout(() => {
        injectUI();
        updateFloatingBtn();
    }, 1000);

    eventSource.on(event_types.CHAT_CHANGED, () => {
        processAllMessages();
        setTimeout(updateFloatingBtn, 500);
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, (mesId) => {
        setTimeout(() => { processMessage(mesId); updateFloatingBtn(); }, 100);
    });

    eventSource.on(event_types.MESSAGE_UPDATED, (mesId) => {
        setTimeout(() => processMessage(mesId), 100);
    });

    $(document).on('click', '.heart-btn', function() {
        const icon = $(this).find('i');
        const uniqueKey = $(this).attr('data-key');
        const mesId = $(this).attr('data-mesid');

        const context = getContext();
        const msgText = context.chat[mesId].mes;
        const snippet = msgText.replace(/<[^>]*>?/gm, '').substring(0, 50) + "...";

        if (!reactionsDB[uniqueKey]) {
            reactionsDB[uniqueKey] = {
                key: uniqueKey,
                mesIndex: mesId,
                snippet: snippet,
                saveTime: Date.now(),
                customTitle: ""
            };
        }

        if (icon.hasClass('fa-regular')) {
            icon.removeClass('fa-regular').addClass('fa-solid active-heart');
            $(this).addClass('pop-anim');
            setTimeout(() => $(this).removeClass('pop-anim'), 300);
            reactionsDB[uniqueKey].is_favorited = true;
        } else {
            icon.removeClass('fa-solid active-heart').addClass('fa-regular');
            reactionsDB[uniqueKey].is_favorited = false;
        }

        saveReactions();
        updateFloatingBtn();
    });
});
