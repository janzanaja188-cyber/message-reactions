import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "message-reactions";
let reactionsDB = {};
let currentTab = 'likes';

// โหลดฐานข้อมูล
function loadDB() {
    const saved = localStorage.getItem(`${extensionName}_db`);
    if (saved) reactionsDB = JSON.parse(saved);
}
function saveDB() { localStorage.setItem(`${extensionName}_db`, JSON.stringify(reactionsDB)); }

// ==========================================
// 1. สร้าง UI โครงสร้างหลัก (ฝังระดับ Body ให้ชัวร์)
// ==========================================
function injectUI() {
    if ($('#mr-overlay-fav').length === 0) {
        const uiHtml = `
            <!-- หน้าต่างรายการโปรด -->
            <div id="mr-overlay-fav" class="mr-fullscreen-overlay">
                <div class="mr-modal-box">
                    <div class="mr-modal-header">
                        <span>รายการที่บันทึกไว้</span>
                        <div id="mr-close-fav" class="mr-close-btn"><i class="fa-solid fa-xmark"></i> ปิด</div>
                    </div>
                    <div class="mr-tabs">
                        <div class="mr-tab-btn active" data-tab="likes"><i class="fa-solid fa-heart"></i> ที่กดใจ</div>
                        <div class="mr-tab-btn" data-tab="comments"><i class="fa-solid fa-comment"></i> คอมเมนต์</div>
                    </div>
                    <div id="mr-content-fav" class="mr-modal-content"></div>
                </div>
            </div>

            <!-- หน้าต่างเขียนคอมเมนต์ -->
            <div id="mr-overlay-comment" class="mr-fullscreen-overlay">
                <div class="mr-modal-box" style="height: 60vh;">
                    <div class="mr-modal-header">
                        <span>เขียนคอมเมนต์</span>
                    </div>
                    <div class="mr-modal-content">
                        <div class="mr-comment-form">
                            <input type="hidden" id="mr-comment-target-key">
                            <input type="hidden" id="mr-comment-target-mesid">

                            <label class="mr-comment-label">หัวข้อ (ไม่ใส่ก็ได้):</label>
                            <input type="text" id="mr-comment-title" class="mr-input-style" placeholder="ตั้งชื่อหัวข้อ...">

                            <label class="mr-comment-label">รายละเอียด:</label>
                            <textarea id="mr-comment-text" class="mr-comment-textarea" placeholder="พิมพ์ความรู้สึกของคุณที่นี่..."></textarea>

                            <div class="mr-comment-actions">
                                <button id="mr-cancel-comment" class="mr-btn mr-btn-cancel">ยกเลิก</button>
                                <button id="mr-save-comment" class="mr-btn mr-btn-save">บันทึก</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('body').append(uiHtml); // ฝังที่ body ตรงๆ บังเลเยอร์ ST มิดแน่นอน

        // ผูก Event ปิดหน้าต่าง
        $('#mr-close-fav').on('click', () => $('#mr-overlay-fav').hide());
        $('#mr-cancel-comment').on('click', () => $('#mr-overlay-comment').hide());

        // ผูก Event สลับแท็บ
        $(document).on('click', '.mr-tab-btn', function() {
            $('.mr-tab-btn').removeClass('active');
            $(this).addClass('active');
            currentTab = $(this).attr('data-tab');
            renderFavs();
        });
    }
}

// ==========================================
// 2. ระบบวาดรายการโปรด
// ==========================================
function renderFavs() {
    const charId = getContext().characterId;
    const box = $('#mr-content-fav');
    box.empty();

    let items = [];
    if (currentTab === 'likes') {
        items = Object.keys(reactionsDB).filter(k => k.startsWith(charId + '_') && reactionsDB[k].is_favorited).map(k => reactionsDB[k]);
    } else {
        items = Object.keys(reactionsDB).filter(k => k.startsWith(charId + '_') && reactionsDB[k].commentText).map(k => reactionsDB[k]);
    }

    if (items.length === 0) {
        box.append('<div style="text-align:center; opacity:0.5; padding: 20px;">ไม่มีข้อมูลในหมวดนี้</div>');
        return;
    }

    items.sort((a,b) => b.saveTime - a.saveTime).forEach(item => {
        const dStr = new Date(item.saveTime).toLocaleString('th-TH');

        let contentHtml = '';
        if (currentTab === 'likes') {
            // โชว์หัวข้อที่ตั้งเอง (ถ้ามี) + ข้อความย่อ
            const titleHtml = item.customTitle ? `<div class="mr-custom-title">${item.customTitle}</div>` : '';
            contentHtml = `
                ${titleHtml}
                <div class="mr-title-edit-box">
                    <input type="text" class="mr-input-style mr-edit-input" value="${item.customTitle || ''}" placeholder="ตั้งชื่อหัวข้อ...">
                    <i class="fa-solid fa-check mr-save-icon" data-key="${item.key}" data-type="like"></i>
                </div>
                <div class="mr-fav-snippet">"${item.snippet}"</div>
            `;
        } else {
            // โชว์หัวข้อคอมเมนต์ + เนื้อหาคอมเมนต์
            const titleHtml = item.commentTitle ? `<div class="mr-custom-title">${item.commentTitle}</div>` : '';
            contentHtml = `
                ${titleHtml}
                <div class="mr-title-edit-box">
                    <input type="text" class="mr-input-style mr-edit-input" value="${item.commentTitle || ''}" placeholder="แก้ไขหัวข้อ...">
                    <i class="fa-solid fa-check mr-save-icon" data-key="${item.key}" data-type="comment"></i>
                </div>
                <div style="padding: 10px; background: rgba(0,0,0,0.5); border-radius: 5px; margin-top: 5px;">${item.commentText.replace(/\n/g, '<br>')}</div>
            `;
        }

        box.append(`
            <div class="mr-fav-item">
                <div class="mr-item-top">
                    <div class="mr-fav-header">ข้อความที่ ${item.mesIndex} • ${dStr}</div>
                    <div class="mr-item-actions">
                        <i class="fa-solid fa-rocket mr-warp-btn" data-mesid="${item.mesIndex}" title="วาร์ป"></i>
                        <i class="fa-solid fa-pencil mr-edit-btn" title="แก้ไขหัวข้อ"></i>
                        <i class="fa-solid fa-trash-can mr-delete-btn" data-key="${item.key}" data-tab="${currentTab}" title="ลบ"></i>
                    </div>
                </div>
                ${contentHtml}
            </div>
        `);
    });
}

// ==========================================
// 3. แทรกปุ่มในแชท
// ==========================================
function processMsg(mesId) {
    const chat = getContext().chat;
    if (!chat || !chat[mesId] || chat[mesId].is_user) return;

    const el = $(`.mes[mesid="${mesId}"]`);
    if (el.find('.msg-reaction-container').length > 0) return;

    const key = `${getContext().characterId}_${mesId}`;
    const isFav = reactionsDB[key]?.is_favorited;
    const hClass = isFav ? 'fa-solid active-heart' : 'fa-regular';

    // เช็คว่ามีคอมเมนต์ไหม จะได้โชว์ไอคอนเขียวๆ
    const hasComment = reactionsDB[key]?.commentText ? 'fa-solid' : 'fa-regular';

    el.find('.mes_text').after(`
        <div class="msg-reaction-container" style="display: flex; gap: 10px; margin-top: 5px;">
            <div class="reaction-btn heart-btn" data-key="${key}" data-mesid="${mesId}"><i class="fa-heart ${hClass}"></i></div>
            <div class="reaction-btn comment-btn" data-key="${key}" data-mesid="${mesId}"><i class="fa-comment ${hasComment}"></i></div>
            <div class="reaction-btn view-fav-btn"><i class="fa-solid fa-book-bookmark"></i></div>
        </div>
    `);
}

function scanChat() {
    const chat = getContext().chat;
    if (chat) for (let i=0; i<chat.length; i++) processMsg(i);
}

// ==========================================
// 4. การทำงานหลัก (Events)
// ==========================================
jQuery(async () => {
    loadDB();
    setTimeout(injectUI, 1000);

    eventSource.on(event_types.CHAT_CHANGED, scanChat);
    eventSource.on(event_types.MESSAGE_RECEIVED, (id) => setTimeout(() => processMsg(id), 100));
    eventSource.on(event_types.MESSAGE_UPDATED, (id) => setTimeout(() => processMsg(id), 100));

    // --- กดหัวใจ ---
    $(document).on('click', '.heart-btn', function() {
        const key = $(this).attr('data-key');
        const mesId = $(this).attr('data-mesid');
        const snip = getContext().chat[mesId].mes.replace(/<[^>]*>?/gm, '').substring(0, 50);

        if (!reactionsDB[key]) reactionsDB[key] = { key, mesIndex: mesId, snippet: snip, saveTime: Date.now() };

        const icon = $(this).find('i');
        if (icon.hasClass('fa-regular')) {
            icon.removeClass('fa-regular').addClass('fa-solid active-heart');
            reactionsDB[key].is_favorited = true;
        } else {
            icon.removeClass('fa-solid active-heart').addClass('fa-regular');
            reactionsDB[key].is_favorited = false;
        }
        saveDB();
    });

    // --- กดดูสมุด (เปิดเต็มจอ) ---
    $(document).on('click', '.view-fav-btn', () => {
        $('#mr-overlay-fav').css('display', 'flex');
        renderFavs();
    });

    // --- กดคอมเมนต์ (เปิดกล่องเขียน) ---
    $(document).on('click', '.comment-btn', function() {
        const key = $(this).attr('data-key');
        const mesId = $(this).attr('data-mesid');
        const dbItem = reactionsDB[key] || {};

        $('#mr-comment-target-key').val(key);
        $('#mr-comment-target-mesid').val(mesId);
        $('#mr-comment-title').val(dbItem.commentTitle || "");
        $('#mr-comment-text').val(dbItem.commentText || "");

        $('#mr-overlay-comment').css('display', 'flex');
    });

    // --- เซฟคอมเมนต์ ---
    $('#mr-save-comment').on('click', () => {
        const key = $('#mr-comment-target-key').val();
        const mesId = $('#mr-comment-target-mesid').val();
        const title = $('#mr-comment-title').val();
        const text = $('#mr-comment-text').val();
        const snip = getContext().chat[mesId].mes.replace(/<[^>]*>?/gm, '').substring(0, 50);

        if (!text) { alert('กรุณาใส่รายละเอียดคอมเมนต์!'); return; }

        if (!reactionsDB[key]) reactionsDB[key] = { key, mesIndex: mesId, snippet: snip, saveTime: Date.now() };
        reactionsDB[key].commentTitle = title;
        reactionsDB[key].commentText = text;
        saveDB();

        $(`.comment-btn[data-key="${key}"] i`).removeClass('fa-regular').addClass('fa-solid');
        $('#mr-overlay-comment').hide();
        if ($('#mr-overlay-fav').is(':visible')) renderFavs();
    });

    // --- ระบบวาร์ป, ดินสอ, เซฟชื่อ, ลบ ---
    $(document).on('click', '.mr-warp-btn', function() {
        const el = $(`.mes[mesid="${$(this).attr('data-mesid')}"]`);
        if (el.length > 0) {
            $('#mr-overlay-fav').hide();
            el[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.css('background', 'rgba(255,75,75,0.2)');
            setTimeout(() => el.css('background', ''), 1000);
        }
    });

    $(document).on('click', '.mr-edit-btn', function() {
        const box = $(this).closest('.mr-fav-item');
        box.find('.mr-custom-title').hide();
        box.find('.mr-title-edit-box').css('display', 'flex');
    });

    $(document).on('click', '.mr-save-icon', function() {
        const key = $(this).attr('data-key');
        const type = $(this).attr('data-type');
        const val = $(this).siblings('.mr-edit-input').val();

        if (type === 'like') reactionsDB[key].customTitle = val;
        if (type === 'comment') reactionsDB[key].commentTitle = val;

        saveDB();
        renderFavs();
    });

    $(document).on('click', '.mr-delete-btn', function() {
        if(confirm("ลบรายการนี้?")) {
            const key = $(this).attr('data-key');
            const tab = $(this).attr('data-tab');

            if (tab === 'likes') {
                reactionsDB[key].is_favorited = false;
                $(`.heart-btn[data-key="${key}"] i`).removeClass('fa-solid active-heart').addClass('fa-regular');
            } else {
                reactionsDB[key].commentText = "";
                reactionsDB[key].commentTitle = "";
                $(`.comment-btn[data-key="${key}"] i`).removeClass('fa-solid').addClass('fa-regular');
            }

            // ถ้าว่างทั้งคู่ ค่อยลบทิ้ง
            if (!reactionsDB[key].is_favorited && !reactionsDB[key].commentText) delete reactionsDB[key];

            saveDB();
            renderFavs();
        }
    });
});
'fa-solid active-heart');
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
