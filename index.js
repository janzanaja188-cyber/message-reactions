import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "message-reactions";
let reactionsDB = {};

function loadReactions() {
    const saved = localStorage.getItem(`${extensionName}_db`);
    if (saved) reactionsDB = JSON.parse(saved);
}

function saveReactions() {
    localStorage.setItem(`${extensionName}_db`, JSON.stringify(reactionsDB));
}

// สร้างแค่ Modal ซ่อนไว้
function injectUI() {
    if (document.getElementById('mr-modal') === null) {
        const uiContainer = document.createElement('div');
        uiContainer.id = "mr-extension-container";
        uiContainer.innerHTML = `
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

        $(document).on('click', '#mr-close-btn', function() {
            $('#mr-modal').hide();
        });

        console.log(`[${extensionName}] Modal Injected.`);
    }
}

// วาดรายการโปรด
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

// แทรกปุ่มหัวใจ + ปุ่มดูรายการโปรด
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
            <div class="reaction-btn view-fav-btn" title="ดูรายการโปรด">
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
    console.log(`[${extensionName}] Loading... (Inline Button Mode)`);

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

    // กดหัวใจ
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
    });

    // กดปุ่มดูรายการโปรด (ปุ่มใหม่ข้างๆ หัวใจ)
    $(document).on('click', '.view-fav-btn', function() {
        renderModal();
    });
});
