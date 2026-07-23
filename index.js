import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "message-reactions";
let reactionsDB = {};
let currentTab = 'likes';

// ==========================================
// 1. ระบบฐานข้อมูล (Database)
// ==========================================
function loadReactions() {
    const saved = localStorage.getItem(`${extensionName}_db`);
    if (saved) reactionsDB = JSON.parse(saved);
}

function saveReactions() {
    localStorage.setItem(`${extensionName}_db`, JSON.stringify(reactionsDB));
}

// ==========================================
// 2. ระบบสร้างหน้าต่าง UI (Modal)
// ==========================================
function injectUI() {
    if (document.getElementById('mr-modal') === null) {
        const uiContainer = document.createElement('div');
        uiContainer.id = "mr-extension-container";
        uiContainer.innerHTML = `
            <div id="mr-modal" style="display: none;">
                <div id="mr-modal-header">
                    <span>รายการที่บันทึกไว้</span>
                    <i id="mr-close-btn" class="fa-solid fa-xmark" title="ปิด"></i>
                </div>
                <div class="mr-tabs">
                    <div class="mr-tab-btn active" data-tab="likes"><i class="fa-solid fa-heart"></i> ที่กดใจ</div>
                    <div class="mr-tab-btn" data-tab="comments"><i class="fa-solid fa-comment"></i> คอมเมนต์</div>
                </div>
                <div id="mr-modal-body"></div>
            </div>
        `;

        // แปะลงในหน้าเว็บ
        const targetContainer = document.getElementById('bg_layer') || document.body;
        targetContainer.appendChild(uiContainer);

        // ระบบปิดหน้าต่าง
        $(document).on('click', '#mr-close-btn', () => $('#mr-modal').hide());

        // ระบบสลับแท็บ
        $(document).on('click', '.mr-tab-btn', function() {
            $('.mr-tab-btn').removeClass('active');
            $(this).addClass('active');
            currentTab = $(this).attr('data-tab');
            renderModal();
        });

        // ระบบเปิดช่องแก้ไขชื่อ
        $(document).on('click', '.mr-edit-title-icon', function() {
            const container = $(this).closest('.mr-fav-item');
            container.find('.mr-custom-title').hide();
            container.find('.mr-title-edit-container').css('display', 'flex');
        });

        // ระบบบันทึกชื่อที่แก้ไข
        $(document).on('click', '.mr-save-title-btn', function() {
            const container = $(this).closest('.mr-fav-item');
            const key = $(this).attr('data-key');
            if(reactionsDB[key]) {
                reactionsDB[key].customTitle = container.find('.mr-fav-title-input').val();
                saveReactions();
            }
            renderModal();
        });

        // ระบบวาร์ปกลับไปที่ข้อความ
        $(document).on('click', '.mr-warp-btn', function() {
            const mesId = $(this).attr('data-mesid');
            const targetElement = $(`.mes[mesid="${mesId}"]`);

            if (targetElement.length > 0) {
                $('#mr-modal').hide();
                targetElement[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetElement.css('transition', 'background 0.5s').css('background', 'rgba(255, 75, 75, 0.2)');
                setTimeout(() => targetElement.css('background', ''), 1000);
            } else {
                alert("ไม่พบข้อความนี้ในหน้าจอ (อาจจะอยู่ไกลเกินไป หรือโดนลบไปแล้ว)");
            }
        });

        // ระบบลบข้อความที่บันทึกไว้
        $(document).on('click', '.mr-delete-btn', function() {
            if(confirm("แน่ใจนะว่าจะลบความทรงจำนี้?")) {
                const key = $(this).attr('data-key');
                const mesId = reactionsDB[key].mesIndex;

                delete reactionsDB[key];
                saveReactions();

                const heartIcon = $(`.heart-btn[data-mesid="${mesId}"] i`);
                heartIcon.removeClass('fa-solid active-heart').addClass('fa-regular');

                renderModal();
            }
        });
    }
}

// ==========================================
// 3. ระบบวาดข้อมูลลงในหน้าต่าง (แก้ไขบั๊ก)
// ==========================================
function renderModal() {
    const context = getContext();
    const charId = context.characterId;
    const body = $('#mr-modal-body');
    body.empty();

    let items = [];
    if (currentTab === 'likes') {
        // เพิ่มการตรวจสอบให้แน่ใจว่า reactionsDB มีค่าและดึงข้อมูลได้จริง
        if (reactionsDB) {
             items = Object.keys(reactionsDB).filter(k => {
                 return k.startsWith(charId + '_') && reactionsDB[k] && reactionsDB[k].is_favorited === true;
             }).map(k => reactionsDB[k]);
        }
    } else {
        body.append('<p style="text-align:center; opacity:0.5; margin-top: 20px;">ระบบคอมเมนต์กำลังก่อสร้าง...</p>');
        return;
    }

    if (!items || items.length === 0) {
        body.append('<p style="text-align:center; opacity:0.5; margin-top: 20px;">ยังไม่มีข้อมูล</p>');
    } else {
        items.sort((a,b) => b.saveTime - a.saveTime).forEach(item => {
            try {
                // ป้องกันบั๊กกรณีข้อมูลวันหรือเวลาพัง
                const saveTimeValue = item.saveTime || Date.now();
                const dateStr = new Date(saveTimeValue).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const titleDisplay = item.customTitle ? `<span class="mr-custom-title">${item.customTitle}</span>` : '';
                const snippetText = item.snippet || "ไม่สามารถแสดงข้อความได้";

                const html = `
                    <div class="mr-fav-item" data-key="${item.key}" data-mesid="${item.mesIndex}">
                        <div class="mr-item-top">
                            <div class="mr-fav-header">ข้อความที่ ${item.mesIndex} • ${dateStr}</div>
                            <div class="mr-item-actions">
                                <i class="fa-solid fa-rocket mr-warp-btn" data-mesid="${item.mesIndex}" title="วาร์ปไปข้อความนี้"></i>
                                <i class="fa-solid fa-pencil mr-edit-title-icon" title="แก้ไขชื่อ"></i>
                                <i class="fa-solid fa-trash-can mr-delete-btn" data-key="${item.key}" title="ลบ"></i>
                            </div>
                        </div>
                        ${titleDisplay}
                        <div class="mr-title-edit-container">
                            <input type="text" class="mr-fav-title-input" value="${item.customTitle || ''}" placeholder="ตั้งชื่อความทรงจำ...">
                            <i class="fa-solid fa-check mr-save-title-btn" data-key="${item.key}"></i>
                        </div>
                        <div class="mr-fav-snippet">"${snippetText}"</div>
                    </div>
                `;
                body.append(html);
            } catch (err) {
                console.error("[Message Reactions] Error rendering item:", item, err);
            }
        });
    }
}

// ==========================================
// 4. ระบบแทรกปุ่มลงในแชท
// ==========================================
function processMessage(mesId) {
    const context = getContext();
    const chatData = context.chat;
    if (!chatData || !chatData[mesId] || chatData[mesId].is_user) return;

    const msgElement = $(`.mes[mesid="${mesId}"]`);
    if (msgElement.find('.msg-reaction-container').length > 0) return;

    const uniqueKey = `${context.characterId || "unknown"}_${mesId}`;
    const isFavorited = reactionsDB[uniqueKey]?.is_favorited || false;
    const heartClass = isFavorited ? 'fa-solid active-heart' : 'fa-regular';

    const btnHtml = `
        <div class="msg-reaction-container" style="display: flex; gap: 8px; margin-top: 5px; padding-left: 10px;">
            <div class="reaction-btn heart-btn" title="Like" data-key="${uniqueKey}" data-mesid="${mesId}">
                <i class="fa-heart ${heartClass}"></i>
            </div>
            <div class="reaction-btn comment-btn" title="Comment" data-key="${uniqueKey}" data-mesid="${mesId}">
                <i class="fa-regular fa-comment"></i>
            </div>
            <div class="reaction-btn view-fav-btn" title="ดูรายการที่บันทึกไว้">
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

// ==========================================
// 5. การทำงานหลัก (Main Initialization) - เพิ่มปุ่มคอมเมนต์
// ==========================================
jQuery(async () => {
    console.log(`[${extensionName}] Loading... (Stage 6.1: Bug Fixes)`);
    loadReactions();
    setTimeout(injectUI, 1000);

    eventSource.on(event_types.CHAT_CHANGED, processAllMessages);
    eventSource.on(event_types.MESSAGE_RECEIVED, (mesId) => setTimeout(() => processMessage(mesId), 100));
    eventSource.on(event_types.MESSAGE_UPDATED, (mesId) => setTimeout(() => processMessage(mesId), 100));

    // ระบบตรวจจับการกดหัวใจ
    $(document).on('click', '.heart-btn', function() {
        const icon = $(this).find('i');
        const uniqueKey = $(this).attr('data-key');
        const mesId = $(this).attr('data-mesid');
        const chatData = getContext().chat[mesId];

        // ป้องกันบั๊กกรณีดึงข้อความไม่ได้
        if(!chatData || !chatData.mes) return;

        const snippet = chatData.mes.replace(/<[^>]*>?/gm, '').substring(0, 50) + "...";

        if (!reactionsDB[uniqueKey]) {
            reactionsDB[uniqueKey] = { key: uniqueKey, mesIndex: mesId, snippet: snippet, saveTime: Date.now(), customTitle: "" };
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

        if ($('#mr-modal').is(':visible') && currentTab === 'likes') renderModal();
    });

    // ระบบตรวจจับการกดปุ่มคอมเมนต์ (เพิ่มใหม่)
    $(document).on('click', '.comment-btn', function() {
        const mesId = $(this).attr('data-mesid');
        // ตอนนี้ใส่แค่ให้มันแจ้งเตือนก่อนว่ากดติด
        toastr.info(`ปุ่มคอมเมนต์ของข้อความที่ ${mesId} ทำงานแล้ว! กำลังสร้างระบบเต็มรูปแบบ...`, "Message Reactions");
    });

    // ระบบตรวจจับการกดปุ่มดูรายการโปรด
    $(document).on('click', '.view-fav-btn', () => {
        currentTab = 'likes';
        $('.mr-tab-btn').removeClass('active');
        $('.mr-tab-btn[data-tab="likes"]').addClass('active');
        $('#mr-modal').css('display', 'flex');
        renderModal();
    });
});
