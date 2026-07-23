import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

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

// ฟังก์ชันหลักที่ทำงานร่วมกับระบบเรนเดอร์ของ ST
function processMessage(mesId) {
    const context = getContext();
    // ดึงข้อมูลข้อความจาก Array ของแชทปัจจุบันโดยตรง
    const chatData = context.chat;

    if (!chatData || !chatData[mesId]) return;

    const msgData = chatData[mesId];

    // เช็คจากระดับข้อมูล: ถ้าเป็นข้อความฝั่งผู้ใช้ (is_user เป็น true) ให้หยุดทำงานทันที!
    if (msgData.is_user) {
        return;
    }

    // หา DOM element ของข้อความนี้
    const msgElement = $(`.mes[mesid="${mesId}"]`);

    // ถ้ามีปุ่มอยู่แล้ว ไม่ต้องใส่ซ้ำ
    if (msgElement.find('.msg-reaction-container').length > 0) return;

    // สร้าง Unique Key จาก ID ตัวละคร + ลำดับข้อความ + เวลาที่ส่ง (ระดับมิลลิวินาที)
    const characterId = context.characterId || "unknown";
    const sendTime = msgData.send_date || Date.now();
    const uniqueKey = `${characterId}_${mesId}_${sendTime}`;

    const isFavorited = reactionsDB[uniqueKey]?.is_favorited || false;
    const heartClass = isFavorited ? 'fa-solid active-heart' : 'fa-regular';

    const btnHtml = `
        <div class="msg-reaction-container" style="display: flex; gap: 8px; margin-top: 5px; padding-left: 10px;">
            <div class="reaction-btn heart-btn" title="Like" data-uniquekey="${uniqueKey}">
                <i class="fa-heart ${heartClass}"></i>
            </div>
            <div class="reaction-btn comment-btn" title="Comment" data-uniquekey="${uniqueKey}">
                <i class="fa-regular fa-comment"></i>
            </div>
        </div>
    `;

    msgElement.find('.mes_text').after(btnHtml);
}

// ฟังก์ชันกวาดข้อความทั้งหมดเมื่อโหลดแชทใหม่
function processAllMessages() {
    const context = getContext();
    if (!context.chat) return;

    // วนลูปตามจำนวนข้อความที่มีในข้อมูลแชท
    for (let i = 0; i < context.chat.length; i++) {
        processMessage(i);
    }
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading... (Data-Level Injection)`);

    loadReactions();

    // ทำงานเมื่อโหลดแชทเสร็จ
    eventSource.on(event_types.CHAT_CHANGED, processAllMessages);

    // ทำงานเมื่อมีข้อความใหม่เข้ามา
    eventSource.on(event_types.MESSAGE_RECEIVED, (mesId) => {
        // หน่วงเวลาเล็กน้อยให้ DOM เรนเดอร์เสร็จก่อน
        setTimeout(() => processMessage(mesId), 100);
    });

    // ทำงานเมื่อข้อความถูกแก้ไข (ปัดขวา/แก้ไขข้อความ)
    eventSource.on(event_types.MESSAGE_UPDATED, (mesId) => {
        setTimeout(() => processMessage(mesId), 100);
    });

    // ระบบบันทึก
    $(document).on('click', '.heart-btn', function() {
        const icon = $(this).find('i');
        const uniqueKey = $(this).attr('data-uniquekey');

        if (!uniqueKey) return;

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
