import { getContext } from "../../../extensions.js";
import { eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";

const extensionName = "message-reactions";

// สร้างที่เก็บความจำ (Database จำลอง)
let reactionsDB = {};

// โหลดความจำตอนเปิดระบบ
function loadReactions() {
    const saved = localStorage.getItem(`${extensionName}_db`);
    if (saved) {
        reactionsDB = JSON.parse(saved);
    }
}

// เซฟความจำ
function saveReactions() {
    localStorage.setItem(`${extensionName}_db`, JSON.stringify(reactionsDB));
}

function addReactionButtons() {
    // แก้บั๊กตัวกรอง: ค้นหาข้อความทั้งหมดก่อน
    const messages = $('.mes:not(.has-reaction-btn)');

    messages.each(function() {
        const msg = $(this);
        const mesId = msg.attr('mesid'); // เอา ID ของข้อความมาใช้เป็นรหัสอ้างอิง
        const chName = msg.attr('ch_name'); // ชื่อคนส่ง

        // ตัวกรองขั้นเด็ดขาด: เช็คทั้ง attribute และลักษณะของ DOM
        // ถ้าเป็นชื่อ 'You' หรือมีแอตทริบิวต์ is_user หรือ avatar เป็นฝั่งขวา ให้ข้ามไปเลย
        if (msg.attr('is_user') === 'true' || chName === 'You' || msg.find('.avatar-container').hasClass('user-avatar')) {
            return; // ออกจากการวนลูปนี้ทันที ไม่ใส่ปุ่ม
        }

        // ตรวจสอบว่าข้อความนี้เคยถูกกดหัวใจไว้ในความจำหรือเปล่า
        const isFavorited = reactionsDB[mesId]?.is_favorited || false;
        const heartClass = isFavorited ? 'fa-solid active-heart' : 'fa-regular';

        const btnHtml = `
            <div class="msg-reaction-container" style="display: flex; gap: 8px; margin-top: 5px; padding-left: 10px;">
                <div class="reaction-btn heart-btn" title="Like" data-mesid="${mesId}">
                    <i class="fa-heart ${heartClass}"></i>
                </div>
                <div class="reaction-btn comment-btn" title="Comment" data-mesid="${mesId}">
                    <i class="fa-regular fa-comment"></i>
                </div>
            </div>
        `;

        msg.find('.mes_text').after(btnHtml);
        msg.addClass('has-reaction-btn');
    });
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading... (Memory System Enabled)`);

    loadReactions();
    addReactionButtons();

    eventSource.on(event_types.CHAT_CHANGED, addReactionButtons);
    eventSource.on(event_types.MESSAGE_RECEIVED, addReactionButtons);
    eventSource.on(event_types.MESSAGE_UPDATED, addReactionButtons);

    // ระบบบันทึกเมื่อกดหัวใจ
    $(document).on('click', '.heart-btn', function() {
        const icon = $(this).find('i');
        const mesId = $(this).attr('data-mesid'); // ดึง ID ข้อความมา

        // สร้างพื้นที่เก็บข้อมูลให้ข้อความนี้ถ้ายังไม่มี
        if (!reactionsDB[mesId]) reactionsDB[mesId] = {};

        if (icon.hasClass('fa-regular')) {
            // โหมดกดหัวใจ
            icon.removeClass('fa-regular').addClass('fa-solid active-heart');
            $(this).addClass('pop-anim');
            setTimeout(() => $(this).removeClass('pop-anim'), 300);

            reactionsDB[mesId].is_favorited = true; // บันทึกลงสมอง
            console.log(`[${extensionName}] Saved Favorite: Msg ${mesId}`);
        } else {
            // โหมดเอาหัวใจออก
            icon.removeClass('fa-solid active-heart').addClass('fa-regular');
            reactionsDB[mesId].is_favorited = false; // ลบออกจากสมอง
            console.log(`[${extensionName}] Removed Favorite: Msg ${mesId}`);
        }

        saveReactions(); // สั่งให้จำ!
    });
});
