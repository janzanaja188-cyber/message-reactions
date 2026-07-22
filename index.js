import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// ต้องตรงกับชื่อโฟลเดอร์เป๊ะๆ
const extensionName = "message-reactions";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);

    try {
        // โหลด HTML
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);

        // แทรกลงในแผงตั้งค่าด้านขวา
        $("#extensions_settings2").append(settingsHtml);

        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
    }
});
