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

// ฝังปุ่มลงในแถบเมนูด้านบนของ ST
function injectTopMenuButton() {
    // เช็คว่ามีปุ่มเราอยู่หรือยัง
    if ($('#mr-top-menu-btn').length === 0) {

        // สร้างปุ่มรูปหัวใจ (ใช้คลาสมาตรฐานของ ST ให้ดูกลมกลืน)
        const topBtnHtml = `
            <div id="mr-top-menu-btn" class="menu_button" title="รายการโปรด (Reactions)" style="display: flex; align-items: center; justify-content: center; position: relative;">
                <i class="fa-solid fa-heart" style="color: #ff4b4b;"></i>
                <div id="mr-top-badge" style="position: absolute; top: -5px; right: -5px; background: white; color: #ff4b4b; border-radius: 50%; padding: 2px 4px; font-size: 9px; font-weight: bold; display: none;">0</div>
            </div>
        `;

        // แปะเข้าไปในแถบเมนูขวาบน (ข้างๆ ปุ่มสามขีด)
        if ($('#rm_button_group').length) {
            $('#rm_button_group').prepend(topBtnHtml);
        } else if ($('#top-bar').length) {
            $('#top-bar').append(topBtnHtml);
        }

        // โครงสร้างหน้าต่างรายการโปรด (Modal)
        const modalHtml = `
            <div id="mr-modal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 400px; max-height: 80vh; background: rgba(20, 20, 25, 0.95); backdrop-filter: blur(10px); border: 1px solid #444; border-radius: 10px; z-index: 99999; display: none; flex-direction: column; color: white; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
                <div style="padding: 15px; border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-weight: bold; font-size: 1.1em;"><i class="fa-solid fa-heart" style="color:#ff4b4b;"></i> ความทรงจำที่บันทึกไว้</span>
                    <i id="mr-close-btn" class="fa-solid fa-xmark" style="cursor: pointer; color: #aaa; font-size: 1.2em;"></i>
                </div>
                <div id="mr-modal-body" style="padding: 15px; overflow-y: auto; flex-grow: 1;"></div>
            </div>
        `;

        $('body').append(modalHtml);

        // ผูก Event เปิด/ปิด หน้าต่าง
        $(document).on('click', '#mr-top-menu-btn', renderModal);
        $(document).on('click', '#mr-close-btn', () => $('#mr-modal').hide());

        console.log(`[${extensionName}] Top Menu Button Injected.`);
    }
}

// อัปเดตตัวเลขแจ้งเตือนบนปุ่มแถบเมนู
function updateTopBadge() {
    const context = getContext();
    if (!context.chatId) return;

    const charId = context.characterId;
    let count = Object.keys(reactionsDB).filter(k => k.startsWith(charId + '_') && reactionsDB[k].is_favorited).length;

    if (count > 0) {
        $('#mr-top-badge').text(count).show();
    } else {
        $('#mr-top-badge').hide();
    }
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
        body.append('<p style="text-align:center; opacity:0.5; margin-top: 20px;">ยังไม่ได้บันทึกข้อความใดๆ ในแชทนี้</p>');
    } else {
        favs.forEach(fav => {
            const html = `
                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; margin-bottom: 12px; border-left: 3px solid #ff4b4b;">
                    <div style="font-size: 0.75em; opacity: 0.6; margin-bottom: 8px;">ข้อความที่ ${fav.mesIndex} • ${new Date(fav.saveTime).toLocaleString()}</div>
                    <input type="text" class="mr-fav-title-input" data-key="${fav.key}" placeholder="ตั้งชื่อให้ข้อความนี้..." value="${fav.customTitle || ''}" style="width: 100%; background: transparent; border: none; border-bottom: 1px solid #666; color: #fff; margin-bottom: 8px; outline: none; font-weight: bold; padding-bottom: 4px;">
                    <div style="font-size: 0.9em; font-style: italic; opacity: 0.8; line-height: 1.4;">"${fav.snippet}"</div>
                </div>
            `;
            body.append(html);
        });

        // ระบบเซฟชื่อ
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
    if (!chatData || !chatData[mesId] || chatData[mesId].is_user) return;

    const msgElement = $(`.mes[mesid="${mesId}"]`);
    if (msgElement.find('.msg-reaction-container').length > 0) return;

    const characterId = context.characterId || "unknown";
    const uniqueKey = `${characterId}_${mesId}`;

    const isFavorited = reactionsDB[uniqueKey]?.is_favorited || false;
    const heartClass = isFavorited ? 'fa-solid active-heart' : 'fa-regular';

    const btnHtml = `
        <div class="msg-reaction-container" style="display: flex; gap: 8px; margin-top: 5px; padding-left: 10px; opacity: 0.8;">
            <div class="reaction-btn heart-btn" title="บันทึกข้อความ" data-key="${uniqueKey}" data-mesid="${mesId}" style="cursor: pointer;">
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
    updateTopBadge();
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading... (Stage 5: Top Menu Integration)`);

    loadReactions();

    // รอแป๊บนึงให้แถบเมนูด้านบนของ ST โหลดเสร็จก่อน
    setTimeout(() => {
        injectTopMenuButton();
        updateTopBadge();
    }, 1500);

    eventSource.on(event_types.CHAT_CHANGED, processAllMessages);
    eventSource.on(event_types.MESSAGE_RECEIVED, (mesId) => { setTimeout(() => { processMessage(mesId); updateTopBadge(); }, 100); });
    eventSource.on(event_types.MESSAGE_UPDATED, (mesId) => { setTimeout(() => processMessage(mesId), 100); });

    $(document).on('click', '.heart-btn', function() {
        const icon = $(this).find('i');
        const uniqueKey = $(this).attr('data-key');
        const mesId = $(this).attr('data-mesid');

        const context = getContext();
        const msgText = context.chat[mesId].mes;
        const snippet = msgText.replace(/<[^>]*>?/gm, '').substring(0, 60) + "...";

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
            icon.css('color', '#ff4b4b');
            reactionsDB[uniqueKey].is_favorited = true;
        } else {
            icon.removeClass('fa-solid active-heart').addClass('fa-regular');
            icon.css('color', '');
            reactionsDB[uniqueKey].is_favorited = false;
        }

        saveReactions();
        updateTopBadge();
    });
});
is_favorited = false;
        }

        saveReactions();
        updateFloatingBtn();
    });
});
