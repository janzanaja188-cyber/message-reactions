import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

const extensionName = "message-reactions";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// เพิ่ม: ค่าเริ่มต้น
const defaultSettings = {
    enabled: false
};

// เพิ่ม: ฟังก์ชันโหลดการตั้งค่า
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};

    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }

    $("#mr_enable_checkbox").prop("checked", extension_settings[extensionName].enabled);
}

// เพิ่ม: ฟังก์ชันเมื่อมีการคลิก Checkbox
function onCheckboxChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].enabled = value;
    saveSettingsDebounced();
    console.log(`[${extensionName}] Setting saved:`, value);
}

jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);

    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
        $("#extensions_settings2").append(settingsHtml);

        // เพิ่ม: ผูกเหตุการณ์คลิกกับ Checkbox
        $("#mr_enable_checkbox").on("input", onCheckboxChange);

        // เพิ่ม: โหลดการตั้งค่าเมื่อเปิดขึ้นมา
        loadSettings();

        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
    }
});
