import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "message-reactions";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

const defaultSettings = {
    enabled: false
};

async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};

    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }

    $("#mr_enable_checkbox").prop("checked", extension_settings[extensionName].enabled);
}

function onCheckboxChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].enabled = value;
    // เซฟอัตโนมัติแบบเดิม
    saveSettingsDebounced();
}

// เพิ่ม: ฟังก์ชันสำหรับปุ่มบังคับเซฟ
function onForceSaveClick() {
    // บังคับเซฟทันทีโดยไม่รอ
    const value = Boolean($("#mr_enable_checkbox").prop("checked"));
    extension_settings[extensionName].enabled = value;

    // เรียกใช้ saveSettings ของระบบหลัก (ถ้ามี) หรือใช้ debounced
    if (typeof window.saveSettings === 'function') {
        window.saveSettings();
    } else {
        saveSettingsDebounced();
    }

    // แจ้งเตือนบนหน้าจอให้รู้ว่ากดติดแล้ว
    toastr.success("บันทึกการตั้งค่าแล้ว! ลองรีเฟรชดูครับ", "Message Reactions");
}

jQuery(async () => {
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings2").append(settingsHtml);

        $("#mr_enable_checkbox").on("input", onCheckboxChange);
        // เพิ่ม: ผูกปุ่มเข้ากับฟังก์ชัน
        $("#mr_force_save_btn").on("click", onForceSaveClick);

        loadSettings();
    } catch (error) {
        console.error(`[${extensionName}] Failed to load:`, error);
    }
});
