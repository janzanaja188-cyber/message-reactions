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

// อัปเดตข้อมูลปุ่มลอย
function updateFloatingBtn() {
    const context = getContext();

    // ถ้ายังไม่มีการคุย หรือแชทว่าง ให้ซ่อนปุ่ม
    if (!context.chatId || !context.chat || context.chat.length === 0) {
        $('#mr-floating-btn').hide();
        return;
    }

    // ถ้ามีแชท ให้โชว์ปุ่มขึ้นมาเลย!
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

// ฉีด UI ลงในเลเยอร์ที่ปลอดภัยที่สุดของ ST
function forceInjectUI() {
    if ($('#mr-floating-btn').length === 0) {

        // ลบ display: none ออก ให้มันเกิดมาพร้อมโชว์เลยถ้า css ไม่บัง
        const uiHtml = `
            <div id="mr-floating-btn" style="position: fixed; bottom: 20px; right: 20px; width: 50px; height: 50px; border-radius: 50%; background-color: rgba(255,255,255,0.2); z-index: 2147483647; cursor: grab; background-size: cover; background-position: center; border: 2px solid white; display: none;">
                <div id="mr-badge" style="position: absolute; top: -5px; right: -5px; background: #ff4b4b; color: white; border-radius: 50%; padding: 2px 6px; font-size: 10px; font-weight: bold; display: none;">0</div>
            </div>

            <div id="mr-modal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 400px; max-height: 80vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); border: 1px solid #555; border-radius: 10px; z-index: 2147483647; display: none; flex-direction: column; color: white;">
                <div id="mr-modal-header" style="padding: 15px; border-bottom: 1px solid #555; display: flex; justify-content: space-between; align-items: center; font-weight: bold;">
                    <span>รายการโปรด</span>
                    <span id="mr-close-btn" style="cursor: pointer; color: #ff4b4b; font-size: 1.2em;">✖</span>
                </div>
                <div id="mr-modal-body" style="padding: 15px; overflow-y: auto; flex-grow: 1;"></div>
            </div>
        `;

        // แปะลงใน #bg_content หรือ body ถ้าหาไม่เจอ
        if ($('#bg_content').length) {
            $('#bg_content').append(uiHtml);
        } else {
            $('body').append(uiHtml);
        }

        setupDraggable();

        // ใช้ Event Delegation เพื่อความชัวร์
        $(document).on('click', '#mr-floating-btn', function(e) {
            if (!$(this).hasClass('is-dragging')) {
                renderModal();
            }
        });

        $(document).on('click', '#mr-close-btn', function() {
            $('#mr-modal').hide();
        });

        console.log(`[${extensionName}] BRUTE FORCE UI INJECTED.`);
    }
}

function setupDraggable() {
    const btn = document.getElementById('mr-floating-btn');
    if(!btn) return;

    let isDragging = false;
    let moved = false;
    let startX, startY, initialX, initialY;

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
        $(btn).addClass('is-dragging'); // แปะป้ายบอกว่ากำลังลากอยู่
    };

    const doDrag = (e) => {
        if (!isDragging) return;
        const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

        const dx = clientX - startX;
        const dy = clientY - startY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;

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

        // ถ้าขยับไม่เยอะ ถือว่าไม่ได้ลาก ให้เอาป้ายออก
        if (!moved) {
            setTimeout(() => $(btn).removeClass('is-dragging'), 50);
        }
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
                <div class="mr-fav-item" style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="font-size: 0.8em; opacity: 0.7; margin-bottom: 5px;">ข้อความที่ ${fav.mesIndex} • ${new Date(fav.saveTime).toLocaleString()}</div>
                    <input type="text" class="mr-fav-title-input" data-key="${fav.key}" placeholder="ตั้งชื่อความทรงจำ..." value="${fav.customTitle || ''}" style="width: 100%; background: transparent; border: none; border-bottom: 1px dashed #aaa; color: white; margin-bottom: 5px; outline: none;">
                    <div style="font-size: 0.9em; font-style: italic; opacity: 0.8;">"${fav.snippet}"</div>
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
        <div class="msg-reaction-container" style="display: flex; gap: 8px; margin-top: 5px; padding-left: 10px; opacity: 0.8;">
            <div class="reaction-btn heart-btn" title="Like" data-key="${uniqueKey}" data-mesid="${mesId}" style="cursor: pointer;">
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
    console.log(`[${extensionName}] Loading... (Stage 4.2: Maximum Overdrive)`);

    loadReactions();

    // ฉีด UI ทันที ไม่ต้องรอ
    forceInjectUI();

    eventSource.on(event_types.CHAT_CHANGED, processAllMessages);
    eventSource.on(event_types.MESSAGE_RECEIVED, (mesId) => { setTimeout(() => { processMessage(mesId); updateFloatingBtn(); }, 100); });
    eventSource.on(event_types.MESSAGE_UPDATED, (mesId) => { setTimeout(() => processMessage(mesId), 100); });

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
            icon.css('color', '#ff4b4b'); // บังคับเปลี่ยนสีตรงนี้เลย
            reactionsDB[uniqueKey].is_favorited = true;
        } else {
            icon.removeClass('fa-solid active-heart').addClass('fa-regular');
            icon.css('color', '');
            reactionsDB[uniqueKey].is_favorited = false;
        }

        saveReactions();
        updateFloatingBtn();
    });
});
