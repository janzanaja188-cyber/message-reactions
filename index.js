// path: public/scripts/extensions/third-party/st-message-memory/index.js

const MODULE_NAME = "stMessageMemory";
let memoryData = {};

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

function getRecordId(mesId) {
    const context = SillyTavern.getContext();
    const charId = context.characterId || 'group';
    const chatId = context.chatId || 'no_chat';
    return `${charId}_${chatId}_${mesId}`;
}

function createNewRecord(mesId) {
    const context = SillyTavern.getContext();
    const chat = context.chat;
    const mes = chat[mesId];
    
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

function injectModals() {
    if (document.getElementById('st-mm-main-modal')) return;

    const modalsHTML = `
        <div id="st-mm-main-modal" class="st-mm-modal-overlay" style="display: none;">
            <div class="st-mm-modal-content st-ios-panel">
                <div class="st-mm-modal-header">
                    <h2><i class="fa-solid fa-book-bookmark"></i> Memory Vault</h2>
                    <button class="st-mm-close-btn" id="st-mm-close-main"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="st-mm-tabs">
                    <button class="st-mm-tab active" data-tab="hearts"><i class="fa-solid fa-heart"></i> Favorites</button>
                    <button class="st-mm-tab" data-tab="comments"><i class="fa-solid fa-comment-dots"></i> Comments</button>
                </div>
                <div class="st-mm-list-container ios-scroll" id="st-mm-list-container"></div>
            </div>
        </div>

        <div id="st-mm-comment-modal" class="st-mm-modal-overlay" style="display: none;">
            <div class="st-mm-modal-content st-mm-comment-box st-ios-panel">
                <div class="st-mm-modal-header">
                    <h2><i class="fa-solid fa-pen-nib"></i> Add Comment</h2>
                </div>
                <div class="st-mm-modal-body">
                    <input type="text" id="st-mm-comment-title" class="st-ios-input" placeholder="Title (Optional)" autocomplete="off" />
                    <textarea id="st-mm-comment-detail" class="st-ios-input ios-scroll" placeholder="Write your thoughts here..." rows="4"></textarea>
                    <input type="hidden" id="st-mm-comment-mesid" />
                </div>
                <div class="st-mm-modal-footer">
                    <button id="st-mm-comment-cancel" class="st-mm-btn-ios-secondary">Cancel</button>
                    <button id="st-mm-comment-save" class="st-mm-btn-ios-primary">Save</button>
                </div>
            </div>
        </div>
    `;
    $('body').append(modalsHTML);
}

function injectButtons(mesId) {
    const context = SillyTavern.getContext();
    const chat = context.chat;
    
    if (!chat || !chat[mesId]) return;
    const mes = chat[mesId];

    if (mes.is_user || mes.is_system) return;

    const mesBlock = document.querySelector(`.mes[mesid="${mesId}"] .mes_block`);
    if (!mesBlock) return;

    if (mesBlock.querySelector('.st-mm-button-container')) {
        updateSingleButtonUI(mesId);
        return;
    }

    const container = document.createElement('div');
    container.className = 'st-mm-button-container';

    container.innerHTML = `
        <button class="st-mm-btn st-mm-heart" data-mesid="${mesId}" title="Like"><i class="fa-solid fa-heart"></i></button>
        <button class="st-mm-btn st-mm-comment" data-mesid="${mesId}" title="Comment"><i class="fa-solid fa-comment"></i></button>
        <button class="st-mm-btn st-mm-book" data-mesid="${mesId}" title="Memory Vault"><i class="fa-solid fa-book"></i></button>
    `;

    const mesText = mesBlock.querySelector('.mes_text');
    if (mesText) {
        mesText.insertAdjacentElement('afterend', container);
    } else {
        mesBlock.appendChild(container);
    }

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

function renderMemoryList(activeTab) {
    const context = SillyTavern.getContext();
    const currentChatId = context.chatId || 'no_chat';
    const container = $('#st-mm-list-container');
    container.empty();

    const records = Object.values(memoryData).filter(r => r.chatId === currentChatId);
    
    const filtered = records.filter(r => {
        if (activeTab === 'hearts') return r.isHeart;
        if (activeTab === 'comments') return r.comment && r.comment.trim() !== "";
        return false;
    });

    if (filtered.length === 0) {
        container.append(`
            <div class="st-mm-empty">
                <i class="fa-solid fa-box-open"></i>
                <span>No records found in this category.</span>
            </div>
        `);
        return;
    }

    filtered.sort((a, b) => b.timestamp - a.timestamp);

    filtered.forEach(r => {
        const dateStr = new Date(r.timestamp).toLocaleString('th-TH', { 
            day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' 
        });
        
        const displayTitle = r.title ? DOMPurify.sanitize(r.title) : `Message #${r.mesId}`;
        const safeSnippet = DOMPurify.sanitize(r.snippet);
        const safeComment = r.comment ? DOMPurify.sanitize(r.comment) : '';
        const hasCommentHTML = r.comment ? `<div class="st-mm-item-comment-text"><i class="fa-solid fa-comment-dots"></i> ${safeComment}</div>` : '';

        const itemHtml = `
            <div class="st-mm-list-item ios-card">
                <div class="st-mm-item-header">
                    <div class="st-mm-item-title-group">
                        <span class="st-mm-item-title">${displayTitle}</span>
                        <span class="st-mm-item-date">${dateStr}</span>
                    </div>
                    <div class="st-mm-item-actions">
                        <button class="st-mm-action-btn st-mm-edit-btn" data-id="${r.id}" title="Edit Title"><i class="fa-solid fa-pencil"></i></button>
                        <button class="st-mm-action-btn st-mm-warp-btn" data-mesid="${r.mesId}" title="Jump to Message"><i class="fa-solid fa-location-arrow"></i></button>
                        <button class="st-mm-action-btn st-mm-delete-btn" data-id="${r.id}" data-mesid="${r.mesId}" title="Delete"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
                <div class="st-mm-item-snippet">"${safeSnippet}"</div>
                ${activeTab === 'comments' ? hasCommentHTML : ''}
            </div>
        `;
        container.append(itemHtml);
    });
}

function attachModalListeners() {
    const context = SillyTavern.getContext();

    $('#st-mm-comment-title, #st-mm-comment-detail').on('keydown keyup keypress', function(e) {
        e.stopPropagation();
    });

    $('#chat').on('click', '.st-mm-heart', function() {
        const mesId = $(this).data('mesid');
        const recordId = getRecordId(mesId);
        
        if (!memoryData[recordId]) memoryData[recordId] = createNewRecord(mesId);
        
        const record = memoryData[recordId];
        record.isHeart = !record.isHeart; 
        
        if (!record.isHeart && !record.comment) delete memoryData[recordId];
        
        saveStorage();
        updateSingleButtonUI(mesId);
        
        $(this).addClass('pop-anim');
        setTimeout(() => $(this).removeClass('pop-anim'), 300);
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
        
        $('#st-mm-comment-modal').css('display', 'flex').hide().fadeIn(250);
        $('#st-mm-comment-detail').focus();
    });

    $('#chat').on('click', '.st-mm-book', function() {
        $('.st-mm-tab').removeClass('active');
        $('.st-mm-tab[data-tab="hearts"]').addClass('active');
        renderMemoryList('hearts');
        $('#st-mm-main-modal').css('display', 'flex').hide().fadeIn(250);
    });

    $('#st-mm-close-comment, #st-mm-comment-cancel').on('click', function() {
        $('#st-mm-comment-modal').fadeOut(250);
    });

    $('#st-mm-comment-save').on('click', function() {
        const mesId = $('#st-mm-comment-mesid').val();
        const detail = $('#st-mm-comment-detail').val().trim();
        const title = $('#st-mm-comment-title').val().trim();
        
        if (!detail) {
            toastr.warning("Please enter comment details.");
            return;
        }

        const recordId = getRecordId(mesId);
        if (!memoryData[recordId]) memoryData[recordId] = createNewRecord(mesId);
        
        memoryData[recordId].comment = detail;
        memoryData[recordId].title = title;
        
        saveStorage();
        updateSingleButtonUI(mesId);
        $('#st-mm-comment-modal').fadeOut(250);
        toastr.success("Comment saved successfully.");
    });

    $('#st-mm-close-main').on('click', function() {
        $('#st-mm-main-modal').fadeOut(250);
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

        const newTitle = await context.Popup.show.input("Enter new title:", record.title);
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
            $('#st-mm-main-modal').fadeOut(250);
            target[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.addClass('ios-blink');
            setTimeout(() => target.removeClass('ios-blink'), 2000);
        } else {
            toastr.warning("Message not found or out of current DOM view range.");
        }
    });

    $('#st-mm-list-container').on('click', '.st-mm-delete-btn', async function() {
        const id = $(this).data('id');
        const mesId = $(this).data('mesid');
        
        const confirmStr = await context.Popup.show.confirm("Delete Memory", "Are you sure you want to remove this record?");
        if (confirmStr) {
            delete memoryData[id];
            saveStorage();
            renderMemoryList($('.st-mm-tab.active').data('tab'));
            updateSingleButtonUI(mesId);
            toastr.success("Record deleted.");
        }
    });
}

jQuery(async function () {
    const context = SillyTavern.getContext();
    
    context.eventSource.on(context.event_types.APP_READY, () => {
        initStorage();
        injectModals();
        attachModalListeners();
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
