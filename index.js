// path: public/scripts/extensions/third-party/st-message-memory/index.js

const MODULE_NAME = "stMessageMemory";
let memoryData = {};

/**
 * 1. Initialization & Storage
 */
function initStorage() {
    const context = SillyTavern.getContext();
    if (!context.extensionSettings[MODULE_NAME]) {
        context.extensionSettings[MODULE_NAME] = {};
    }
    memoryData = context.extensionSettings[MODULE_NAME];
}

function saveStorage() {
    SillyTavern.getContext().saveSettingsDebounced();
}

// สร้าง Unique ID จากตัวละคร + Chat + Message ID
function getRecordId(mesId) {
    const context = SillyTavern.getContext();
    const charId = context.characterId || 'group';
    const chatId = context.chatId || 'no_chat';
    return `${charId}_${chatId}_${mesId}`;
}

// สร้าง Record ใหม่
function createNewRecord(mesId) {
    const context = SillyTavern.getContext();
    const chat = context.chat;
    const mes = chat[mesId];
    
    // สร้าง Snippet โดยลบ HTML tags ออกเพื่อความสะอาด
    let snippet = mes.mes.replace(/<[^>]*>?/gm, '').trim();
    snippet = snippet.length > 80 ? snippet.substring(0, 80) + '...' : snippet;

    return {
        id: getRecordId(mesId),
        mesId: mesId,
        chatId: context.chatId || 'no_chat',
        charId: context.characterId || 'group',
        timestamp: Date.now(),
        snippet: snippet,
        isHeart: false,
        title: "",
        comment: ""
    };
}

/**
 * 2. DOM Injection (แทรกปุ่ม)
 */
function injectButtons(mesId) {
    const context = SillyTavern.getContext();
    const chat = context.chat;
    
    if (!chat || !chat[mesId]) return;
    const mes = chat[mesId];

    // ข้อกำหนด: แทรกเฉพาะข้อความของ NPC ห้ามแทรกข้อความ User หรือ System
    if (mes.is_user || mes.is_system) return;

    // หา DOM Block
    const mesBlock = document.querySelector(`.mes[mesid="${mesId}"] .mes_block`);
    if (!mesBlock) return;

    // ถ้ามีปุ่มอยู่แล้ว ไม่ต้องแทรกซ้ำ
    if (mesBlock.querySelector('.st-mm-button-container')) {
        updateSingleButtonUI(mesId);
        return;
    }

    const container = document.createElement('div');
    container.className = 'st-mm-button-container';

    container.innerHTML = `
        <div class="st-mm-btn st-mm-heart" data-mesid="${mesId}" title="ถูกใจ">
            <i class="fa-solid fa-heart"></i>
        </div>
        <div class="st-mm-btn st-mm-comment" data-mesid="${mesId}" title="คอมเมนต์">
            <i class="fa-solid fa-comment"></i>
        </div>
        <div class="st-mm-btn st-mm-book" data-mesid="${mesId}" title="สมุดความจำ">
            <i class="fa-solid fa-book"></i>
        </div>
    `;

    // แทรกต่อท้ายกล่องข้อความ
    const mesText = mesBlock.querySelector('.mes_text');
    if (mesText) {
        mesText.insertAdjacentElement('afterend', container);
    } else {
        mesBlock.appendChild(container);
    }

    // อัปเดตสถานะสีปุ่ม
    updateSingleButtonUI(mesId);
}

function injectAllMessages() {
    const context = SillyTavern.getContext();
    if (!context.chat) return;
    context.chat.forEach((mes, index) => {
        injectButtons(index);
    });
}

function updateSingleButtonUI(mesId) {
    const recordId = getRecordId(mesId);
    const record = memoryData[recordId];
    const heartBtn = document.querySelector(`.st-mm-heart[data-mesid="${mesId}"]`);
    const commentBtn = document.querySelector(`.st-mm-comment[data-mesid="${mesId}"]`);
    
    if (heartBtn) {
        if (record && record.isHeart) heartBtn.classList.add('active-heart');
        else heartBtn.classList.remove('active-heart');
    }
    
    if (commentBtn) {
        if (record && record.comment) commentBtn.classList.add('active-comment');
        else commentBtn.classList.remove('active-comment');
    }
}

/**
 * 3. Modal Logic & Rendering
 */
async function loadModals() {
    const context = SillyTavern.getContext();
    // โหลด Template ที่เราสร้างไว้มาต่อท้าย body
    const mainModalHtml = await context.renderExtensionTemplateAsync('third-party/st-message-memory', 'main-modal', {});
    const commentModalHtml = await context.renderExtensionTemplateAsync('third-party/st-message-memory', 'comment-modal', {});
    
    $('body').append(mainModalHtml);
    $('body').append(commentModalHtml);

    attachModalListeners();
}

function renderMemoryList(activeTab) {
    const context = SillyTavern.getContext();
    const currentChatId = context.chatId || 'no_chat';
    const container = $('#st-mm-list-container');
    container.empty();

    // ดึงข้อมูลเฉพาะแชทปัจจุบัน
    const records = Object.values(memoryData).filter(r => r.chatId === currentChatId);
    
    // กรองตาม Tab
    const filtered = records.filter(r => {
        if (activeTab === 'hearts') return r.isHeart;
        if (activeTab === 'comments') return r.comment && r.comment.trim() !== "";
        return false;
    });

    if (filtered.length === 0) {
        container.append(`<div class="st-mm-empty">ไม่มีรายการในหมวดหมู่นี้</div>`);
        return;
    }

    // เรียงจากใหม่ไปเก่า
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    filtered.forEach(r => {
        const dateStr = new Date(r.timestamp).toLocaleString('th-TH', { 
            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
        
        const displayTitle = r.title ? DOMPurify.sanitize(r.title) : `ข้อความที่ ${r.mesId}`;
        const safeSnippet = DOMPurify.sanitize(r.snippet);
        const safeComment = r.comment ? DOMPurify.sanitize(r.comment) : '';
        const hasCommentHTML = r.comment ? `<div class="st-mm-item-comment-text">💬 ${safeComment}</div>` : '';

        const itemHtml = `
            <div class="st-mm-list-item">
                <div class="st-mm-item-header">
                    <div class="st-mm-item-title-group">
                        <span class="st-mm-item-title">${displayTitle}</span>
                        <span class="st-mm-item-date">${dateStr}</span>
                    </div>
                    <div class="st-mm-item-actions">
                        <button class="st-mm-action-btn st-mm-edit-btn" data-id="${r.id}" title="แก้ไขหัวข้อ"><i class="fa-solid fa-pencil"></i></button>
                        <button class="st-mm-action-btn st-mm-warp-btn" data-mesid="${r.mesId}" title="ไปที่ข้อความ"><i class="fa-solid fa-rocket"></i></button>
                        <button class="st-mm-action-btn st-mm-delete-btn" data-id="${r.id}" data-mesid="${r.mesId}" title="ลบรายการ"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                <div class="st-mm-item-snippet">"${safeSnippet}"</div>
                ${activeTab === 'comments' ? hasCommentHTML : ''}
            </div>
        `;
        container.append(itemHtml);
    });
}

/**
 * 4. Event Listeners
 */
function attachModalListeners() {
    const context = SillyTavern.getContext();

    // -- Chat Screen Buttons --
    $('#chat').on('click', '.st-mm-heart', function() {
        const mesId = $(this).data('mesid');
        const recordId = getRecordId(mesId);
        
        if (!memoryData[recordId]) {
            memoryData[recordId] = createNewRecord(mesId);
        }
        
        const record = memoryData[recordId];
        record.isHeart = !record.isHeart; 
        
        // ถ้าเอาหัวใจออกและไม่มีคอมเมนต์ ลบทิ้งเพื่อประหยัดพื้นที่
        if (!record.isHeart && !record.comment) {
            delete memoryData[recordId];
        }
        
        saveStorage();
        updateSingleButtonUI(mesId);
    });

    $('#chat').on('click', '.st-mm-comment', function() {
        const mesId = $(this).data('mesid');
        const recordId = getRecordId(mesId);
        
        $('#st-mm-comment-mesid').val(mesId);
        if (memoryData[recordId]) {
            $('#st-mm-comment-title').val(memoryData[recordId].title || "");
            $('#st-mm-comment-detail').val(memoryData[recordId].comment || "");
        } else {
            $('#st-mm-comment-title').val("");
            $('#st-mm-comment-detail').val("");
        }
        
        $('#st-mm-comment-modal').fadeIn(200);
    });

    $('#chat').on('click', '.st-mm-book', function() {
        $('.st-mm-tab').removeClass('active');
        $('.st-mm-tab[data-tab="hearts"]').addClass('active');
        renderMemoryList('hearts');
        $('#st-mm-main-modal').fadeIn(200);
    });

    // -- Comment Modal --
    $('#st-mm-close-comment, #st-mm-comment-cancel').on('click', function() {
        $('#st-mm-comment-modal').fadeOut(200);
    });

    $('#st-mm-comment-save').on('click', function() {
        const mesId = $('#st-mm-comment-mesid').val();
        const detail = $('#st-mm-comment-detail').val().trim();
        const title = $('#st-mm-comment-title').val().trim();
        
        if (!detail) {
            toastr.warning("กรุณากรอกรายละเอียดคอมเมนต์");
            return;
        }

        const recordId = getRecordId(mesId);
        if (!memoryData[recordId]) {
            memoryData[recordId] = createNewRecord(mesId);
        }
        
        memoryData[recordId].comment = detail;
        memoryData[recordId].title = title;
        
        saveStorage();
        updateSingleButtonUI(mesId);
        $('#st-mm-comment-modal').fadeOut(200);
        toastr.success("บันทึกคอมเมนต์สำเร็จ");
    });

    // -- Main Modal --
    $('#st-mm-close-main').on('click', function() {
        $('#st-mm-main-modal').fadeOut(200);
    });

    $('.st-mm-tab').on('click', function() {
        $('.st-mm-tab').removeClass('active');
        $(this).addClass('active');
        renderMemoryList($(this).data('tab'));
    });

    $('#st-mm-list-container').on('click', '.st-mm-edit-btn', async function() {
        const id = $(this).data('id');
        const record = memoryData[id];
        if (!record) return;

        const newTitle = await context.Popup.show.input("ตั้งชื่อหัวข้อความทรงจำ:", record.title);
        if (newTitle !== null) {
            record.title = newTitle;
            saveStorage();
            renderMemoryList($('.st-mm-tab.active').data('tab'));
        }
    });

    $('#st-mm-list-container').on('click', '.st-mm-warp-btn', function() {
        const mesId = $(this).data('mesid');
        const target = $(`.mes[mesid="${mesId}"]`);
        
        if (target.length) {
            $('#st-mm-main-modal').fadeOut(200);
            target[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            const originalBg = target.css('backgroundColor');
            target.css('backgroundColor', 'var(--SmartThemeQuoteColor)');
            setTimeout(() => {
                target.css('backgroundColor', originalBg);
            }, 1500);
        } else {
            toastr.warning("โหลดข้อความไม่ถึง หรือข้อความถูกลบไปแล้ว");
        }
    });

    $('#st-mm-list-container').on('click', '.st-mm-delete-btn', async function() {
        const id = $(this).data('id');
        const mesId = $(this).data('mesid');
        
        const confirmStr = await context.Popup.show.confirm("ยืนยันการลบ", "คุณต้องการลบรายการนี้ใช่หรือไม่?");
        if (confirmStr) {
            delete memoryData[id];
            saveStorage();
            renderMemoryList($('.st-mm-tab.active').data('tab'));
            updateSingleButtonUI(mesId);
            toastr.success("ลบรายการสำเร็จ");
        }
    });
}

/**
 * 5. Lifecycle Hooks
 */
jQuery(async function () {
    const context = SillyTavern.getContext();
    
    context.eventSource.on(context.event_types.APP_READY, async () => {
        initStorage();
        await loadModals();
        injectAllMessages();
    });

    context.eventSource.on(context.event_types.CHAT_CHANGED, () => {
        injectAllMessages();
    });

    context.eventSource.on(context.event_types.CHARACTER_MESSAGE_RENDERED, (mesId) => {
        injectButtons(mesId);
    });
    
    context.eventSource.on(context.event_types.MESSAGE_UPDATED, (mesId) => {
        injectButtons(mesId);
    });
});
