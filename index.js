import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "message-reactions";

// ฟังก์ชันสร้างปุ่มรีแอคชัน
function addReactionButtons() {
    // หาข้อความทั้งหมดที่ยังไม่มีคลาส 'has-reaction-btn'
    const messages = $('.mes:not(.has-reaction-btn)');

    messages.each(function() {
        const msg = $(this);

        // สร้าง HTML ของปุ่ม (ใช้ไอคอนหัวใจของ FontAwesome ที่มีอยู่ในระบบ)
        const btnHtml = `
            <div class="msg-reaction-container" style="display: flex; gap: 5px; margin-top: 5px; padding-left: 10px;">
                <div class="reaction-btn heart-btn" title="Like">
                    <i class="fa-regular fa-heart"></i>
                </div>
                <div class="reaction-btn comment-btn" title="Comment">
                    <i class="fa-regular fa-comment"></i>
                </div>
            </div>
        `;

        // แทรกปุ่มไว้ใต้เนื้อหาข้อความ
        msg.find('.mes_text').after(btnHtml);

        // ทำเครื่องหมายว่าข้อความนี้ใส่ปุ่มไปแล้ว จะได้ไม่ใส่ซ้ำ
        msg.addClass('has-reaction-btn');
    });
}

// ผูกฟังก์ชันเข้ากับเหตุการณ์ของระบบ
jQuery(async () => {
    console.log(`[${extensionName}] Loading... (Plug & Play Mode)`);

    // แทรกปุ่มทันทีที่โหลดเสร็จ
    addReactionButtons();

    // แทรกปุ่มทุกครั้งที่มีการเปลี่ยนแชทหรือข้อความถูกวาดใหม่
    eventSource.on(event_types.CHAT_CHANGED, addReactionButtons);
    eventSource.on(event_types.MESSAGE_RECEIVED, addReactionButtons);
    eventSource.on(event_types.MESSAGE_UPDATED, addReactionButtons);
});
