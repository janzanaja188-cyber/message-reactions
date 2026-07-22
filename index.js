const extensionName = "message-reactions";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// สร้างคีย์เฉพาะสำหรับบันทึกข้อมูล
const storageKey = `SillyTavern_Ext_${extensionName}`;

function loadSettings() {
    // ดึงข้อมูลจากหน่วยความจำเบราว์เซอร์โดยตรง
    const savedData = localStorage.getItem(storageKey);
    let isEnabled = false;

    if (savedData) {
        try {
            const parsed = JSON.parse(savedData);
            isEnabled = parsed.enabled;
        } catch (e) {
            console.error("Failed to parse saved settings");
        }
    }

    $("#mr_enable_checkbox").prop("checked", isEnabled);
}

function onCheckboxChange(event) {
    const value = Boolean($(event.target).prop("checked"));

    // บันทึกลงหน่วยความจำเบราว์เซอร์ทันที
    const dataToSave = { enabled: value };
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
}

function onForceSaveClick() {
    const value = Boolean($("#mr_enable_checkbox").prop("checked"));

    // บังคับเขียนลง LocalStorage อีกรอบเพื่อความชัวร์
    localStorage.setItem(storageKey, JSON.stringify({ enabled: value }));

    toastr.success("บันทึกลงหน่วยความจำดิบแล้ว!", "Message Reactions");
}

jQuery(async () => {
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings2").append(settingsHtml);

        $("#mr_enable_checkbox").on("input", onCheckboxChange);
        $("#mr_force_save_btn").on("click", onForceSaveClick);

        loadSettings();
    } catch (error) {
        console.error(`[${extensionName}] Failed to load:`, error);
    }
});
