import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "message-reactions";
let reactionsDB = {};
let currentTab = 'likes'; // ค่าเริ่มต้นให้แสดงแท็บหัวใจ

function loadReactions() {
    const saved = localStorage.getItem(`${extensionName}_db`);
    if (saved) reactionsDB = JSON.parse(saved);
}

function saveReactions() {
    localStorage.setItem(`${extensionName}_db`, JSON.stringify(reactionsDB));
}

function injectUI() {
    if (document.getElementById('mr-modal') === null) {
        const uiContainer = document.createElement('div');
        uiContainer.id = "mr-extension-container";
        uiContainer.innerHTML = `
            <div id="mr-modal" style="display: none;">
                <div id="mr-modal-header">
                    <span>ความทรงจำ</span>
                    <i id="mr-close-btn" class="fa-solid fa-xmark" title="ปิด"></i>
                </div>
                <div class="mr-tabs">
                    <div class="mr-tab-btn active" data-tab="likes"><i class="fa-solid fa-heart"></i> ที่กดใจ</div>
                    <div class="mr-tab-btn" data-tab="comments"><i class="fa-solid fa-comment"></i> คอมเมนต์</div>
                </div>
                <div id="mr-modal-body"></div>
            </div>
        `;

        const targetContainer = document.getElementById('bg_layer') || document.body;
        targetContainer.appendChild(uiContainer);

        // ปิดหน้าต่าง
        $(document).on('click', '#mr-close-btn', function() {
            $('#mr-modal').hide();
        });

        // กดสลับแท็บ
        $(document).on('click', '.mr-tab-btn', function() {
            $('.mr-tab-btn').removeClass('active');
            $(this).addClass('active');
            currentTab = $(this).attr('data-tab');
            renderModal();
        });

        // กดดินสอเพื่อแก้ไขชื่อ
        $(document).on('click', '.mr-edit-title-icon', function() {
            const container = $(this).closest('.mr-fav-item');
            container.find('.mr-custom-title').hide();
            container.find('.mr-title-edit-container').css('display', 'flex');
        });

        // กดเซฟชื่อ (เครื่องหมายถูก)
        $(document).on('click', '.mr-save-title-btn', function() {
            const container = $(this).closest('.mr-fav-item');
            const key = $(this).attr('data-key');
            const newTitle = container.find('.mr-fav-title-input').val();

            if(reactionsDB[key]) {
                reactionsDB[key].customTitle = newTitle;
                saveReactions();
            }
            renderModal();
        });

        console.log(`[${extensionName}] UI Injected (Tabs & Modal).`);
    }
}

function renderModal() {
    const context = getContext();
    const charId = context.characterId;
    const body = $('#mr-modal-body');
    body.empty();

    // กรองข้อมูลตามแท็บ (ตอนนี้มีแค่ข้อมูลการกดหัวใจ)
    const items = Object.keys(reactionsDB)
        .filter(k => k.startsWith(charId + '_') && reactionsDB[k].is_favorited)
        .map(k => reactionsDB[k]);

    if (items.length === 0) {
        body.append('<p style="text-align:center; opacity:0.5; margin-top: 20px;">ยังไม่มีข้อมูลในหมวดนี้</p>');
    } else {
        items.forEach(item => {
            const dateObj = new Date(item.saveTime);
            // แสดงวันที่และเวลาให้ชัดเจน
            const dateStr = dateObj.toLocaleDateString('th-TH', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });

            const titleDisplay = item.customTitle
                ? `<span class="mr-custom-title">${item.customTitle}</span>`
                : '';

            const html = `
                <div class="mr-fav-item" data-key="${item.key}" data-mesid="${item.mesIndex}">
                    <div class="mr-item-top">
                        <div class="mr-fav-header">ข้อความที่ ${item.mesIndex} • ${dateStr}</div>
                        <div class="mr-item-actions">
                            <i class="fa-solid fa-pencil mr-edit-title-icon" title="แก้ไขชื่อ"></i>
                        </div>
                    </div>
                    ${titleDisplay}
                    <div class="mr-title-edit-container">
                        <input type="text" class="mr-fav-title-input" value="${item.customTitle || ''}" placeholder="ตั้งชื่อความทรงจำ...">
                        <i class="fa-solid fa-check mr-save-title-btn" data-key="${item.key}"></i>
                    </div>
                    <div class="mr-fav-snippet">"${item.snippet}"</div>
                </div>
            `;
            body.append(html);
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
            <div class="reaction-btn view-fav-btn" title="ดูความทรงจำ">
                <i class="fa-solid fa-book-bookmark"></i>
            </div>
        </div>
    `;

    msgElement.find('.mes_text').after(btnHtml);
}

function processAllMessages() {
    const context = getContext();
    if (!context.chat) return;
    for (let i = 0; i < context.chat.length; i++) processMessage(i);
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading... (Stage 5 Full: UI & Tabs)`);

    loadReactions();

    setTimeout(() => {
        injectUI();
    }, 1000);

    eventSource.on(event_types.CHAT_CHANGED, () => {
        processAllMessages();
    });

    eventSource.on(event_types.MESSAGE_RECEIVED, (mesId) => {
        setTimeout(() => { processMessage(mesId); }, 100);
    });

    eventSource.on(event_types.MESSAGE_UPDATED, (mesId) => {
        setTimeout(() => processMessage(mesId), 100);
    });

    // ระบบกดหัวใจ
    $(document).on('click', '.heart-btn', function() {
        const icon = $(this).find('i');
        const uniqueKey = $(this).attr('data-key');
        const mesId = $(this).attr('data-mesid');

        const context = getContext();
        const msgText = context.chat[mesId].mes;
        // เก็บข้อความย่อมาแสดง
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
    });

    // กดปุ่มรูปสมุดเพื่อเปิดหน้าต่าง
    $(document).on('click', '.view-fav-btn', function() {
        renderModal();
    });
});
