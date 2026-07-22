import { getContext } from "../../../extensions.js";
import { eventSource, event_types } from "../../../../script.js";

const extensionName = "message-reactions";

function addReactionButtons() {
    // หาข้อความที่ยังไม่มีปุ่ม และ **ไม่ใช่ข้อความของ User**
    // ใน ST ข้อความ user จะมีแอตทริบิวต์ is_user="true" หรืออยู่ใน <div class="mes" ...>
    // เราจะกรองเอาเฉพาะอันที่ไม่มีแอตทริบิวต์ is_user
    const messages = $('.mes:not(.has-reaction-btn):not([is_user="true"])');

    messages.each(function() {
        const msg = $(this);

        const btnHtml = `
            <div class="msg-reaction-container" style="display: flex; gap: 8px; margin-top: 5px; padding-left: 10px;">
                <div class="reaction-btn heart-btn" title="Like">
                    <i class="fa-regular fa-heart"></i>
                </div>
                <div class="reaction-btn comment-btn" title="Comment">
                    <i class="fa-regular fa-comment"></i>
                </div>
            </div>
        `;

        msg.find('.mes_text').after(btnHtml);
        msg.addClass('has-reaction-btn');
    });
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading... (Filtered + Cute Mode)`);

    addReactionButtons();

    eventSource.on(event_types.CHAT_CHANGED, addReactionButtons);
    eventSource.on(event_types.MESSAGE_RECEIVED, addReactionButtons);
    eventSource.on(event_types.MESSAGE_UPDATED, addReactionButtons);

    // เพิ่มลูกเล่น: เวลากดปุ่มหัวใจให้เปลี่ยนไอคอนและสลับคลาส
    $(document).on('click', '.heart-btn', function() {
        const icon = $(this).find('i');

        // สลับระหว่างหัวใจโปร่ง กับหัวใจทึบ
        if (icon.hasClass('fa-regular')) {
            icon.removeClass('fa-regular').addClass('fa-solid active-heart');
            // ใส่แอนิเมชันเด้งดึ๋ง
            $(this).addClass('pop-anim');
            setTimeout(() => $(this).removeClass('pop-anim'), 300); // เอาคลาสออกหลังเล่นแอนิเมชันจบ
        } else {
            icon.removeClass('fa-solid active-heart').addClass('fa-regular');
        }
    });
});
