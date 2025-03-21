import { extension_settings, loadExtensionSettings } from "../../../extensions.js";
import { eventSource, event_types, saveSettingsDebounced } from "../../../../script.js";

// Extension name - should match the folder name
const extensionName = "prompt-debugger";

// Default settings
const defaultSettings = {
    enabled: true,
    verboseLogging: false,
    logToFile: false,
    logFilePath: "",
    filterOutEmptyFields: true
};

/**
 * Load extension settings
 */
function loadSettings() {
    // Initialize settings with defaults if needed
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    
    // Update UI to reflect current settings
    $('#prompt_debugger_enabled').prop('checked', extension_settings[extensionName].enabled);
    $('#prompt_debugger_verbose').prop('checked', extension_settings[extensionName].verboseLogging);
    $('#prompt_debugger_filter_empty').prop('checked', extension_settings[extensionName].filterOutEmptyFields);
}

/**
 * Save settings when they're changed
 */
function saveSettings() {
    saveSettingsDebounced();
}

/**
 * Recursively remove empty fields from an object (arrays with no elements, objects with no properties, etc.)
 * @param {Object} obj - Object to clean
 * @returns {Object} - Cleaned object
 */
function cleanObject(obj) {
    if (!extension_settings[extensionName].filterOutEmptyFields) {
        return obj;
    }
    
    if (obj === null || obj === undefined) {
        return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
        const newArray = obj.filter(item => {
            if (item === null || item === undefined) return false;
            if (typeof item === 'object' && Object.keys(cleanObject(item)).length === 0) return false;
            if (Array.isArray(item) && item.length === 0) return false;
            return true;
        }).map(item => {
            if (typeof item === 'object') {
                return cleanObject(item);
            }
            return item;
        });
        return newArray;
    }

    // Handle objects
    if (typeof obj === 'object') {
        const newObj = {};
        for (const key in obj) {
            if (obj[key] === null || obj[key] === undefined) continue;
            if (typeof obj[key] === 'object') {
                const cleaned = cleanObject(obj[key]);
                if (Object.keys(cleaned).length > 0 || Array.isArray(cleaned) && cleaned.length > 0) {
                    newObj[key] = cleaned;
                }
            } else if (obj[key] !== '') {
                newObj[key] = obj[key];
            }
        }
        return newObj;
    }

    return obj;
}

/**
 * Log the prompt structure to the console
 * @param {Object} promptStruct - The prompt structure to log
 */
function logPromptStruct(promptStruct, chatId) {
    try {
        if (!extension_settings[extensionName].enabled) {
            return;
        }

        // Create a deep copy to prevent modifying the original
        const promptStructCopy = JSON.parse(JSON.stringify(promptStruct));
        
        // Clean the object if filtering is enabled
        const cleanedPromptStruct = cleanObject(promptStructCopy);
        
        // Create a group in the console for better visualization
        console.group(`%cPrompt Structure (Chat ID: ${chatId})`, 'color: #4CAF50; font-weight: bold; font-size: 16px;');
        
        // Log timestamp
        console.log(`%cTimestamp: ${new Date().toISOString()}`, 'color: #999999;');
        
        // Log the main structure
        console.log('Full Prompt Structure:', cleanedPromptStruct);
        
        // If verbose logging is enabled, log individual components
        if (extension_settings[extensionName].verboseLogging) {
            // Log prompt sections separately
            if (cleanedPromptStruct.char_prompt) {
                console.group('%cCharacter Prompt', 'color: #2196F3; font-weight: bold;');
                console.log('Text Components:', cleanedPromptStruct.char_prompt.text);
                console.log('Additional Chat Log:', cleanedPromptStruct.char_prompt.additional_chat_log);
                console.log('Extensions:', cleanedPromptStruct.char_prompt.extension);
                console.groupEnd();
            }
            
            if (cleanedPromptStruct.user_prompt) {
                console.group('%cUser Prompt', 'color: #FF9800; font-weight: bold;');
                console.log('Text Components:', cleanedPromptStruct.user_prompt.text);
                console.log('Additional Chat Log:', cleanedPromptStruct.user_prompt.additional_chat_log);
                console.log('Extensions:', cleanedPromptStruct.user_prompt.extension);
                console.groupEnd();
            }
            
            if (cleanedPromptStruct.world_prompt) {
                console.group('%cWorld Prompt', 'color: #9C27B0; font-weight: bold;');
                console.log('Text Components:', cleanedPromptStruct.world_prompt.text);
                console.log('Additional Chat Log:', cleanedPromptStruct.world_prompt.additional_chat_log);
                console.log('Extensions:', cleanedPromptStruct.world_prompt.extension);
                console.groupEnd();
            }
            
            if (Object.keys(cleanedPromptStruct.other_chars_prompt || {}).length > 0) {
                console.group('%cOther Characters Prompts', 'color: #E91E63; font-weight: bold;');
                for (const charId in cleanedPromptStruct.other_chars_prompt) {
                    console.group(`Character ID: ${charId}`);
                    console.log('Text Components:', cleanedPromptStruct.other_chars_prompt[charId].text);
                    console.log('Additional Chat Log:', cleanedPromptStruct.other_chars_prompt[charId].additional_chat_log);
                    console.log('Extensions:', cleanedPromptStruct.other_chars_prompt[charId].extension);
                    console.groupEnd();
                }
                console.groupEnd();
            }
            
            if (Object.keys(cleanedPromptStruct.plugin_prompts || {}).length > 0) {
                console.group('%cPlugin Prompts', 'color: #00BCD4; font-weight: bold;');
                for (const pluginId in cleanedPromptStruct.plugin_prompts) {
                    console.group(`Plugin ID: ${pluginId}`);
                    console.log('Text Components:', cleanedPromptStruct.plugin_prompts[pluginId].text);
                    console.log('Additional Chat Log:', cleanedPromptStruct.plugin_prompts[pluginId].additional_chat_log);
                    console.log('Extensions:', cleanedPromptStruct.plugin_prompts[pluginId].extension);
                    console.groupEnd();
                }
                console.groupEnd();
            }
            
            if (cleanedPromptStruct.chat_log) {
                console.group('%cChat Log', 'color: #795548; font-weight: bold;');
                console.log('Entries:', cleanedPromptStruct.chat_log);
                console.groupEnd();
            }
        }
        
        console.groupEnd();
        
    } catch (error) {
        console.error('Error in Prompt Debugger plugin:', error);
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    try {
        // Listen for when a prompt is ready to be sent
        eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (payload) => {
            if (!extension_settings[extensionName].enabled) {
                return;
            }
            
            try {
                const { prompt_struct, chat_id } = payload;
                
                // Log the prompt structure
                if (prompt_struct) {
                    console.log(`%cPrompt Debugger: Captured prompt for chat ID ${chat_id}`, 'color: #4CAF50;');
                    logPromptStruct(prompt_struct, chat_id);
                } else {
                    console.warn('Prompt Debugger: No prompt structure available in the payload');
                }
            } catch (err) {
                console.error('Prompt Debugger: Error processing CHAT_COMPLETION_PROMPT_READY event', err);
            }
        });
        
        console.log('Prompt Debugger: Event listeners registered successfully');
    } catch (error) {
        console.error('Prompt Debugger: Failed to setup event listeners', error);
    }
}

/**
 * Handle extension setting changes
 */
function onEnabledChanged() {
    extension_settings[extensionName].enabled = $('#prompt_debugger_enabled').prop('checked');
    saveSettings();
    
    const status = extension_settings[extensionName].enabled ? 'enabled' : 'disabled';
    console.log(`Prompt Debugger: ${status}`);
}

function onVerboseLoggingChanged() {
    extension_settings[extensionName].verboseLogging = $('#prompt_debugger_verbose').prop('checked');
    saveSettings();
    
    const status = extension_settings[extensionName].verboseLogging ? 'enabled' : 'disabled';
    console.log(`Prompt Debugger: Verbose logging ${status}`);
}

function onFilterEmptyChanged() {
    extension_settings[extensionName].filterOutEmptyFields = $('#prompt_debugger_filter_empty').prop('checked');
    saveSettings();
    
    const status = extension_settings[extensionName].filterOutEmptyFields ? 'enabled' : 'disabled';
    console.log(`Prompt Debugger: Filtering empty fields ${status}`);
}

/**
 * Initialize the extension
 */
jQuery(async () => {
    try {
        console.log('Initializing Prompt Debugger plugin...');
        
        // Create the settings UI
        const settingsHtml = `
            <div id="prompt_debugger_settings" class="extension_settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>Prompt Debugger</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <div class="prompt_debugger_block">
                            <label class="checkbox_label">
                                <input type="checkbox" id="prompt_debugger_enabled" />
                                <span>Enable Prompt Debugging</span>
                            </label>
                            <label class="checkbox_label">
                                <input type="checkbox" id="prompt_debugger_verbose" />
                                <span>Verbose Logging</span>
                            </label>
                            <label class="checkbox_label">
                                <input type="checkbox" id="prompt_debugger_filter_empty" />
                                <span>Filter Out Empty Fields</span>
                            </label>
                            <div class="prompt_debugger_info">
                                <p><i class="fa-solid fa-info-circle"></i> When enabled, this plugin captures and logs the full prompt structure to the browser console.</p>
                                <p>To view logs:</p>
                                <ol>
                                    <li>Open your browser's Developer Tools (F12 or Ctrl+Shift+I)</li>
                                    <li>Go to the "Console" tab</li>
                                    <li>Generate a message to see the prompt structure</li>
                                </ol>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add the settings HTML to the extensions settings panel
        $('#extensions_settings').append(settingsHtml);
        
        // Setup event handlers for the settings controls
        $('#prompt_debugger_enabled').on('change', onEnabledChanged);
        $('#prompt_debugger_verbose').on('change', onVerboseLoggingChanged);
        $('#prompt_debugger_filter_empty').on('change', onFilterEmptyChanged);
        
        // Load saved settings
        loadSettings();
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('Prompt Debugger plugin initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Prompt Debugger plugin:', error);
    }
});
