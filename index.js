import { getContext } from "../../../extensions.js";
import { eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";

const extensionName = "message-reactions";
let reactionsDB = {};

function loadReactions() {
    const saved = localStorage.getItem(`${extensionName}_db`);
    if (saved) {
        reactionsDB = JSON.parse(saved);
    }
}

function saveReactions() {
    localStorage.setItem(`${extensionName}_db`, JSON.stringify(reactionsDB));
}

// ฟังก์ชันสร้างรหัสเฉพาะให้แต่ละข้อความ
function generateUniqueId(msgElement) {
    const context = getContext();
    const characterId = context.characterId || "unknown_char";
    const mesId = msgElement.attr('mesid');
    const sendTime = msgElement.attr('send_date') || "no_time";

    // รวมชื่อแชท, ลำดับ, และเวลาเข้าด้วยกัน จะได้ไม่ซ้ำกันเด็ดขาด
    return `${characterId}_${mesId}_${sendTime}`;
}

function addReactionButtons() {
    // แก้บั๊กฝั่ง User: ใช้ Selector ที่เจาะจงเฉพาะข้อความฝั่งตรงข้าม
    // ข้อความฝั่งเราปกติจะมีคลาส mes_you หรือไม่ก็ถูกห่อในโครงสร้างอื่น
    const messages = $('.mes:not(.has-reaction-btn)');

    messages.each(function() {
        const msg = $(this);
        const chName = msg.attr('ch_name');

        // ตัวกรองขั้นสูงสุด: ตรวจสอบหลายเงื่อนไข
        const isUserMessage =
            msg.attr('is_user') === 'true' ||
            msg.hasClass('mes_you') ||
            chName === 'You' ||
            msg.find('.name_text').text().trim() === 'You' ||
            msg.find('.avatar-container img').attr('src')?.includes('user');

        if (isUserMessage) {
            return; // เจอฝั่งคุณ ข้ามทิ้งทันที!
        }

        // สร้างรหัสเฉพาะของข้อความนี้
        const uniqueMsgId = generateUniqueId(msg);
        const isFavorited = reactionsDB[uniqueMsgId]?.is_favorited || false;
        const heartClass = isFavorited ? 'fa-solid active-heart' : 'fa-regular';

        const btnHtml = `
            <div class="msg-reaction-container" style="display: flex; gap: 8px; margin-top: 5px; padding-left: 10px;">
                <div class="reaction-btn heart-btn" title="Like" data-uniquekey="${uniqueMsgId}">
                    <i class="fa-heart ${heartClass}"></i>
                </div>
                <div class="reaction-btn comment-btn" title="Comment" data-uniquekey="${uniqueMsgId}">
                    <i class="fa-regular fa-comment"></i>
                </div>
            </div>
        `;

        msg.find('.mes_text').after(btnHtml);
        msg.addClass('has-reaction-btn');
    });
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading... (Bug Fixes: Anti-Sync & Strict User Filter)`);

    loadReactions();
    addReactionButtons();

    eventSource.on(event_types.CHAT_CHANGED, addReactionButtons);
    eventSource.on(event_types.MESSAGE_RECEIVED, addReactionButtons);
    eventSource.on(event_types.MESSAGE_UPDATED, addReactionButtons);

    // ระบบบันทึกที่อิงจาก Unique Key
    $(document).on('click', '.heart-btn', function() {
        const icon = $(this).find('i');
        const uniqueKey = $(this).attr('data-uniquekey'); // ดึงรหัสเฉพาะมาใช้

        if (!reactionsDB[uniqueKey]) reactionsDB[uniqueKey] = {};

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
});
