let translationsCache = {}; // Initialize translations cache
function setTranslations(translations) {
    translationsCache = translations; // Allow setting translations globally
}

function applyTranslations(translations) {
    // Function to apply translations to the DOM
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[key]) {
            element.innerHTML = translations[key];
        }
    });
}
function translateString(key) {
    // Function to translate a text string based on the loaded translations
    if (!translationsCache || !key) {
        log.debug('[dnx-lang] No translations available or invalid key:', key);
        return key; // Return the original key if no translation is found
    }
    return translationsCache[key] || key; // Return the translation or fallback to the key
}
function applyAdaptiveTextSize() {
    // Generate the selector dynamically from the adaptiveTextExemptions array
    const exemptionSelector = adaptiveTextExemptions.map(cls => `:not(.${cls})`).join('');

    // Function to adapt text size to fit within parent elements
    document.querySelectorAll(`[data-i18n]${exemptionSelector}`).forEach(element => {
        // Exclude elements with the specified classes
        const parent = element.parentElement || element; // Use parent or fallback to self if no parent
        if (parent) {
            adjustTextSize(element, parent);
        }
    });
}
function adjustTextSize(element, parent) {
    // Function to adjust text size
    const maxFontSize = 16; // Set a maximum font size
    const minFontSize = 13; // Set a minimum font size
    let fontSize = maxFontSize;

    element.style.fontSize = `${fontSize}px`;
    while (
        (element.scrollWidth > parent.clientWidth || element.scrollHeight > parent.clientHeight) &&
        fontSize > minFontSize
    ) {
        fontSize--;
        element.style.fontSize = `${fontSize}px`;
    }
}
module.exports = {
    setTranslations,
    translateString,
	applyTranslations,
	applyAdaptiveTextSize
};