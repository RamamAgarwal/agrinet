// Utils
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

// State & I18N
let currentLanguage = localStorage.getItem('agrinet_language') || 'en';
let advisoryRequestId = 0;
let dxRequestId = 0;

let pin = null;
let currentAnalysisResponse = null;
let currentFieldState = null;
let currentAdvisory = null;
let lastDxResult = null; // store to know if dx exists
let advisoryAbortController = null;
let dxAbortController = null;

window.localizeEnum = function(val, category) {
    if (val === undefined || val === null) return '';
    if (typeof val === 'boolean') return window.t('enum_bool_' + String(val)) || String(val);
    const key = `enum_${category}_${String(val).toLowerCase()}`;
    const result = window.t(key);
    return result !== key ? result : String(val);
};

window.t = function(key, params = {}) {
    const lang = currentLanguage || 'en';
    const dictionary = UI_TRANSLATIONS[lang] || UI_TRANSLATIONS.en;
    let enVal = UI_TRANSLATIONS.en[key] ?? key;
    let localVal = dictionary[key] ?? enVal;

    if (typeof enVal !== 'string') enVal = String(enVal);
    if (typeof localVal !== 'string') localVal = String(localVal);

    for (const [param, replacement] of Object.entries(params)) {
        enVal = enVal.replaceAll(`{${param}}`, String(replacement));
        localVal = localVal.replaceAll(`{${param}}`, String(replacement));
    }

    if (lang === 'en') return enVal;
    
    // Some keys might return identical in English (untranslated). If it's untranslated, just return English.
    if (localVal === key) return enVal;
    return localVal;
};

const LOCATION_TRANSLATIONS = {
    "Sambalpur": { "en": "Sambalpur", "hi": "संबलपुर", "ta": "சம்பல்பூர்", "te": "సంబల్పూర్", "bn": "সম্বলপুর", "mr": "संबलपूर", "pa": "ਸੰਬਲਪੁਰ", "gu": "સંબલપુર", "kn": "ಸಂಬಲ್ಪುರ", "ml": "സംബൽപൂർ" },
    "Odisha": { "en": "Odisha", "hi": "ओडिशा", "ta": "ஒடிசா", "te": "ఒడిశా", "bn": "ওড়িশা", "mr": "ओडिशा", "pa": "ਓਡੀਸ਼ਾ", "gu": "ઓડિશા", "kn": "ಒಡಿಶಾ", "ml": "ഒഡീഷ" },
    "Agra": { "en": "Agra", "hi": "आगरा", "ta": "ஆக்ரா", "te": "ఆగ్రా", "bn": "আগ্রা", "mr": "आग्रा", "pa": "ਆਗਰਾ", "gu": "આગરા", "kn": "ಆಗ್ರಾ", "ml": "ആഗ്ര" },
    "Uttar Pradesh": { "en": "Uttar Pradesh", "hi": "उत्तर प्रदेश", "ta": "உத்தரப் பிரதேசம்", "te": "ఉత్తర ప్రదేశ్", "bn": "উত্তরপ্রদেশ", "mr": "उत्तर प्रदेश", "pa": "ਉੱਤਰ ਪ੍ਰਦੇਸ਼", "gu": "ઉત્તર પ્રદેશ", "kn": "ಉತ್ತರ ಪ್ರದೇಶ", "ml": "ഉത്തർപ്രദേശ്" },
    "Ludhiana": { "en": "Ludhiana", "hi": "लुधियाना", "ta": "லுதியானா", "te": "లుధియానా", "bn": "লুধিয়ানা", "mr": "लुधियाना", "pa": "ਲੁਧਿਆਣਾ", "gu": "લુધિયાણા", "kn": "ಲುಧಿಯಾನಾ", "ml": "ലുധിയാന" },
    "Punjab": { "en": "Punjab", "hi": "पंजाब", "ta": "பஞ்சாப்", "te": "పంజాబ్", "bn": "পাঞ্জাব", "mr": "पंजाब", "pa": "ਪੰਜਾਬ", "gu": "પંજાબ", "kn": "ಪಂಜಾಬ್", "ml": "പഞ്ചാബ്" },
    "Nashik": { "en": "Nashik", "hi": "नाशिक", "ta": "நாசிக்", "te": "నాసిక్", "bn": "নাশিক", "mr": "नाशिक", "pa": "ਨਾਸਿਕ", "gu": "નાશિક", "kn": "ನಾಸಿಕ್", "ml": "നാസിക്" },
    "Maharashtra": { "en": "Maharashtra", "hi": "महाराष्ट्र", "ta": "மகாராஷ்டிரா", "te": "మహారాష్ట్ర", "bn": "মহারাষ্ট্র", "mr": "महाराष्ट्र", "pa": "ਮਹਾਰਾਸ਼ਟਰ", "gu": "મહારાષ્ટ્ર", "kn": "ಮಹಾರಾಷ್ಟ್ರ", "ml": "മഹാരാഷ്ട്ര" },
    "Guntur": { "en": "Guntur", "hi": "गुंटूर", "ta": "குண்டூர்", "te": "గుంటూరు", "bn": "গুন্টুর", "mr": "गुंटूर", "pa": "ਗੁੰਟੂਰ", "gu": "ગુંટુર", "kn": "ಗುಂಟೂರು", "ml": "ഗുണ്ടൂർ" },
    "Andhra Pradesh": { "en": "Andhra Pradesh", "hi": "आंध्र प्रदेश", "ta": "ஆந்திரப் பிரதேசம்", "te": "ఆంధ్రప్రదేశ్", "bn": "অন্ধ্রপ্রদেশ", "mr": "आंध्र प्रदेश", "pa": "ਆਂਧરા ਪ੍ਰਦੇਸ਼", "gu": "આંધ્ર પ્રદેશ", "kn": "ಆಂಧ್ರ ಪ್ರದೇಶ", "ml": "ആന്ധ്രാപ്രദേശ്" },
    "Villupuram": { "en": "Villupuram", "hi": "विल्लुपुरम", "ta": "விழுப்புரம்", "te": "విళ్ళుపురం", "bn": "ভিন্নুপুরম", "mr": "विल्लुपुरम", "pa": "ਵਿਲੁਪੁਰਮ", "gu": "વિલ્લુપુરમ", "kn": "ವಿழுப்புರಂ", "ml": "വിഴുപ്പുറം" },
    "Tamil Nadu": { "en": "Tamil Nadu", "hi": "तमिलनाडु", "ta": "தமிழ்நாடு", "te": "తమిళనాడు", "bn": "তামিলনাড়ু", "mr": "तमिळनाडू", "pa": "ਤਮਿਲਨਾਡੂ", "gu": "તમિલનાડુ", "kn": "ತಮಿಳುನಾಡು", "ml": "തമിഴ്നാട്" },
    "Wheat": { "en": "Wheat", "hi": "गेहूँ", "ta": "கோதுமை", "te": "గోధుమ", "bn": "গম", "mr": "गहू", "pa": "ਕਣਕ", "gu": "ઘઉં", "kn": "ಗೋಧಿ", "ml": "ഗോതമ്പ്" },
    "Rice": { "en": "Rice", "hi": "चावल", "ta": "அரிசி", "te": "వరి", "bn": "চাল", "mr": "तांदूळ", "pa": "ਚੌਲ", "gu": "ચોખા", "kn": "ಅಕ್ಕಿ", "ml": "അരി" },
    "Cotton": { "en": "Cotton", "hi": "कपास", "ta": "பருத்தி", "te": "పత్తి", "bn": "তুলা", "mr": "कापूस", "pa": "ਕਪਾਹ", "gu": "કપાસ", "kn": "ಹತ್ತಿ", "ml": "പരുത്തി" },
    "Groundnut": { "en": "Groundnut", "hi": "मूंगफली", "ta": "நிலக்கடலை", "te": "వేరుశెనగ", "bn": "চিনাবাদাম", "mr": "भुईमूग", "pa": "ਮੂੰਗਫਲੀ", "gu": "મગફળી", "kn": "ಕಡಲೆಕಾಯಿ", "ml": "നിലക്കടല" },
    "Sorghum": { "en": "Sorghum", "hi": "ज्वार", "ta": "சோளம்", "te": "జొన్న", "bn": "জোয়ার", "mr": "ज्वारी", "pa": "ਜਵਾਰ", "gu": "જુવાર", "kn": "ಜೋಳ", "ml": "ചോളം" }
};
const NO_LAND_TEXT = {
  en: ['No land detected', 'AI advisory is unavailable for water bodies.'],
  hi: ['भूमि नहीं मिली', 'जल निकायों के लिए AI सलाह उपलब्ध नहीं है।'],
  ta: ['நிலம் கண்டறியப்படவில்லை', 'நீர்நிலைகளுக்கு AI ஆலோசனை கிடைக்காது.'],
  te: ['భూమి గుర్తించబడలేదు', 'నీటి వనరులకు AI సలహా అందుబాటులో లేదు.'],
  bn: ['কোনও জমি শনাক্ত হয়নি', 'জলাশয়ের জন্য AI পরামর্শ উপলভ্য নয়।'],
  mr: ['जमीन आढळली नाही', 'जलाशयांसाठी AI सल्ला उपलब्ध नाही.'],
  pa: ['ਕੋਈ ਜ਼ਮੀਨ ਨਹੀਂ ਮਿਲੀ', 'ਜਲ ਸਰੋਤਾਂ ਲਈ AI ਸਲਾਹ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।'],
  gu: ['જમીન મળી નથી', 'જળાશયો માટે AI સલાહ ઉપલબ્ધ નથી.'],
  kn: ['ಭೂಮಿ ಪತ್ತೆಯಾಗಿಲ್ಲ', 'ಜಲಮೂಲಗಳಿಗೆ AI ಸಲಹೆ ಲಭ್ಯವಿಲ್ಲ.'],
  ml: ['കര കണ്ടെത്തിയില്ല', 'ജലാശയങ്ങൾക്ക് AI ഉപദേശം ലഭ്യമല്ല.']
};
const noLandText = i => (NO_LAND_TEXT[currentLanguage] || NO_LAND_TEXT.en)[i];

// Status / error strings used by the async flows (lang.js still carries English placeholders for several of these).
const UI_EXTRA_KEYS = ['updatingAdvisory', 'updatingDx', 'stop', 'noVoice', 'timeout', 'failed', 'tapMapFirst', 'choosePhoto', 'noSatellite'];
const UI_EXTRA = {
  en: ['Updating advisory in the selected language…', 'Updating diagnosis in the selected language…', '⏹ Stop', 'No voice for this language is installed on this device; playback may be silent or use another voice.', 'The request took too long. Please try again.', 'Request failed:', 'Tap the map to place a pin first.', 'Choose a photo first.', 'Satellite land-cover data could not be fetched for this location, so a health score cannot be computed safely.'],
  hi: ['चुनी गई भाषा में सलाह अपडेट हो रही है…', 'चुनी गई भाषा में निदान अपडेट हो रहा है…', '⏹ रोकें', 'इस डिवाइस पर इस भाषा की आवाज़ इंस्टॉल नहीं है; ऑडियो शांत रह सकता है या दूसरी आवाज़ में चल सकता है।', 'अनुरोध में बहुत समय लगा। कृपया फिर से प्रयास करें।', 'अनुरोध विफल:', 'पहले नक्शे पर टैप करके पिन लगाएँ।', 'पहले फ़ोटो चुनें।', 'इस स्थान के लिए उपग्रह भूमि-आवरण डेटा नहीं मिल सका, इसलिए स्वास्थ्य स्कोर सुरक्षित रूप से नहीं निकाला जा सकता।'],
  ta: ['தேர்ந்தெடுத்த மொழியில் ஆலோசனை புதுப்பிக்கப்படுகிறது…', 'தேர்ந்தெடுத்த மொழியில் நோயறிதல் புதுப்பிக்கப்படுகிறது…', '⏹ நிறுத்து', 'இந்த சாதனத்தில் இந்த மொழிக்கான குரல் நிறுவப்படவில்லை; ஒலி வராமல் போகலாம் அல்லது வேறு குரலில் ஒலிக்கலாம்.', 'கோரிக்கைக்கு அதிக நேரம் ஆனது. மீண்டும் முயலவும்.', 'கோரிக்கை தோல்வியடைந்தது:', 'முதலில் வரைபடத்தில் தட்டி பின் வைக்கவும்.', 'முதலில் புகைப்படத்தைத் தேர்ந்தெடுக்கவும்.', 'இந்த இடத்திற்கான செயற்கைக்கோள் நில-மூடல் தரவைப் பெற முடியவில்லை, எனவே ஆரோக்கிய மதிப்பெண்ணைக் கணக்கிட முடியாது.'],
  te: ['ఎంచుకున్న భాషలో సలహా నవీకరించబడుతోంది…', 'ఎంచుకున్న భాషలో నిర్ధారణ నవీకరించబడుతోంది…', '⏹ ఆపు', 'ఈ పరికరంలో ఈ భాషకు వాయిస్ ఇన్‌స్టాల్ కాలేదు; ఆడియో వినిపించకపోవచ్చు లేదా వేరే వాయిస్‌లో రావచ్చు.', 'అభ్యర్థనకు చాలా సమయం పట్టింది. దయచేసి మళ్లీ ప్రయత్నించండి.', 'అభ్యర్థన విఫలమైంది:', 'ముందుగా మ్యాప్‌పై నొక్కి పిన్ ఉంచండి.', 'ముందుగా ఫోటోను ఎంచుకోండి.', 'ఈ ప్రదేశానికి ఉపగ్రహ భూ-కవరేజ్ డేటా పొందలేకపోయాం, కాబట్టి ఆరోగ్య స్కోర్‌ను సురక్షితంగా లెక్కించలేము.'],
  bn: ['নির্বাচিত ভাষায় পরামর্শ হালনাগাদ হচ্ছে…', 'নির্বাচিত ভাষায় রোগনির্ণয় হালনাগাদ হচ্ছে…', '⏹ থামান', 'এই ডিভাইসে এই ভাষার কণ্ঠস্বর ইনস্টল করা নেই; অডিও নীরব থাকতে পারে বা অন্য কণ্ঠে বাজতে পারে।', 'অনুরোধে অনেক সময় লেগেছে। আবার চেষ্টা করুন।', 'অনুরোধ ব্যর্থ হয়েছে:', 'প্রথমে মানচিত্রে ট্যাপ করে পিন বসান।', 'প্রথমে একটি ছবি বেছে নিন।', 'এই স্থানের উপগ্রহ ভূমি-আচ্ছাদন তথ্য পাওয়া যায়নি, তাই স্বাস্থ্য স্কোর নিরাপদে গণনা করা যাচ্ছে না।'],
  mr: ['निवडलेल्या भाषेत सल्ला अद्ययावत होत आहे…', 'निवडलेल्या भाषेत निदान अद्ययावत होत आहे…', '⏹ थांबवा', 'या डिव्हाइसवर या भाषेचा आवाज इंस्टॉल नाही; ऑडिओ शांत राहू शकतो किंवा दुसऱ्या आवाजात वाजू शकतो.', 'विनंतीला खूप वेळ लागला. कृपया पुन्हा प्रयत्न करा.', 'विनंती अयशस्वी:', 'आधी नकाशावर टॅप करून पिन लावा.', 'आधी फोटो निवडा.', 'या ठिकाणासाठी उपग्रह भू-आच्छादन डेटा मिळू शकला नाही, त्यामुळे आरोग्य गुण सुरक्षितपणे काढता येत नाहीत.'],
  pa: ['ਚੁਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਸਲਾਹ ਅੱਪਡੇਟ ਹੋ ਰਹੀ ਹੈ…', 'ਚੁਣੀ ਭਾਸ਼ਾ ਵਿੱਚ ਨਿਦਾਨ ਅੱਪਡੇਟ ਹੋ ਰਿਹਾ ਹੈ…', '⏹ ਰੋਕੋ', "ਇਸ ਡਿਵਾਈਸ 'ਤੇ ਇਸ ਭਾਸ਼ਾ ਦੀ ਆਵਾਜ਼ ਇੰਸਟਾਲ ਨਹੀਂ ਹੈ; ਆਡੀਓ ਚੁੱਪ ਰਹਿ ਸਕਦਾ ਹੈ ਜਾਂ ਹੋਰ ਆਵਾਜ਼ ਵਿੱਚ ਚੱਲ ਸਕਦਾ ਹੈ।", 'ਬੇਨਤੀ ਨੂੰ ਬਹੁਤ ਸਮਾਂ ਲੱਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਮੁੜ ਕੋਸ਼ਿਸ਼ ਕਰੋ।', 'ਬੇਨਤੀ ਅਸਫਲ:', "ਪਹਿਲਾਂ ਨਕਸ਼ੇ 'ਤੇ ਟੈਪ ਕਰਕੇ ਪਿੰਨ ਲਗਾਓ।", 'ਪਹਿਲਾਂ ਫੋਟੋ ਚੁਣੋ।', 'ਇਸ ਥਾਂ ਲਈ ਸੈਟੇਲਾਈਟ ਜ਼ਮੀਨ-ਕਵਰ ਡਾਟਾ ਨਹੀਂ ਮਿਲ ਸਕਿਆ, ਇਸ ਲਈ ਸਿਹਤ ਸਕੋਰ ਸੁਰੱਖਿਅਤ ਢੰਗ ਨਾਲ ਨਹੀਂ ਕੱਢਿਆ ਜਾ ਸਕਦਾ।'],
  gu: ['પસંદ કરેલી ભાષામાં સલાહ અપડેટ થઈ રહી છે…', 'પસંદ કરેલી ભાષામાં નિદાન અપડેટ થઈ રહ્યું છે…', '⏹ રોકો', 'આ ઉપકરણ પર આ ભાષાનો અવાજ ઇન્સ્ટોલ નથી; ઑડિયો શાંત રહી શકે અથવા બીજા અવાજમાં વાગી શકે.', 'વિનંતીમાં ઘણો સમય લાગ્યો. કૃપા કરીને ફરી પ્રયાસ કરો.', 'વિનંતી નિષ્ફળ:', 'પહેલા નકશા પર ટૅપ કરીને પિન મૂકો.', 'પહેલા ફોટો પસંદ કરો.', 'આ સ્થાન માટે ઉપગ્રહ જમીન-આવરણ ડેટા મળી શક્યો નથી, તેથી આરોગ્ય સ્કોર સુરક્ષિત રીતે ગણી શકાતો નથી.'],
  kn: ['ಆಯ್ಕೆ ಮಾಡಿದ ಭಾಷೆಯಲ್ಲಿ ಸಲಹೆ ನವೀಕರಿಸಲಾಗುತ್ತಿದೆ…', 'ಆಯ್ಕೆ ಮಾಡಿದ ಭಾಷೆಯಲ್ಲಿ ರೋಗನಿರ್ಣಯ ನವೀಕರಿಸಲಾಗುತ್ತಿದೆ…', '⏹ ನಿಲ್ಲಿಸಿ', 'ಈ ಸಾಧನದಲ್ಲಿ ಈ ಭಾಷೆಯ ಧ್ವನಿ ಸ್ಥಾಪಿಸಲಾಗಿಲ್ಲ; ಆಡಿಯೋ ಮೌನವಾಗಿರಬಹುದು ಅಥವಾ ಬೇರೆ ಧ್ವನಿಯಲ್ಲಿ ಕೇಳಬಹುದು.', 'ವಿನಂತಿಗೆ ತುಂಬಾ ಸಮಯ ಹಿಡಿಯಿತು. ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.', 'ವಿನಂತಿ ವಿಫಲವಾಗಿದೆ:', 'ಮೊದಲು ನಕ್ಷೆಯ ಮೇಲೆ ಟ್ಯಾಪ್ ಮಾಡಿ ಪಿನ್ ಇರಿಸಿ.', 'ಮೊದಲು ಫೋಟೋ ಆಯ್ಕೆಮಾಡಿ.', 'ಈ ಸ್ಥಳಕ್ಕೆ ಉಪಗ್ರಹ ಭೂ-ಹೊದಿಕೆ ಡೇಟಾ ಪಡೆಯಲಾಗಲಿಲ್ಲ, ಆದ್ದರಿಂದ ಆರೋಗ್ಯ ಅಂಕವನ್ನು ಸುರಕ್ಷಿತವಾಗಿ ಲೆಕ್ಕಹಾಕಲಾಗುವುದಿಲ್ಲ.'],
  ml: ['തിരഞ്ഞെടുത്ത ഭാഷയിൽ ഉപദേശം പുതുക്കുന്നു…', 'തിരഞ്ഞെടുത്ത ഭാഷയിൽ രോഗനിർണയം പുതുക്കുന്നു…', '⏹ നിർത്തുക', 'ഈ ഉപകരണത്തിൽ ഈ ഭാഷയുടെ ശബ്ദം ഇൻസ്റ്റാൾ ചെയ്തിട്ടില്ല; ഓഡിയോ കേൾക്കാതിരിക്കാം അല്ലെങ്കിൽ മറ്റൊരു ശബ്ദത്തിൽ കേൾക്കാം.', 'അഭ്യർത്ഥനയ്ക്ക് വളരെ സമയമെടുത്തു. വീണ്ടും ശ്രമിക്കുക.', 'അഭ്യർത്ഥന പരാജയപ്പെട്ടു:', 'ആദ്യം മാപ്പിൽ ടാപ്പ് ചെയ്ത് പിൻ ഇടുക.', 'ആദ്യം ഒരു ഫോട്ടോ തിരഞ്ഞെടുക്കുക.', 'ഈ സ്ഥലത്തിനായുള്ള ഉപഗ്രഹ ഭൂ-ആവരണ ഡാറ്റ ലഭിച്ചില്ല, അതിനാൽ ആരോഗ്യ സ്കോർ സുരക്ഷിതമായി കണക്കാക്കാൻ കഴിയില്ല.']
};
const uiText = key => {
  const i = UI_EXTRA_KEYS.indexOf(key);
  return (UI_EXTRA[currentLanguage] || UI_EXTRA.en)[i] ?? UI_EXTRA.en[i];
};

// Non-blocking notice; replaces alert(), whose modal dialog froze the page while requests were still in flight.
function showNotice(message, kind = 'error') {
  let box = $('app-notice');
  if (!box) {
    box = document.createElement('div');
    box.id = 'app-notice';
    box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:min(560px,calc(100% - 32px));padding:12px 16px;border-radius:8px;font-size:14px;box-shadow:0 6px 24px rgba(0,0,0,.18);z-index:9999;display:none;';
    document.body.appendChild(box);
  }
  box.style.background = kind === 'error' ? '#fef2f2' : '#eff6ff';
  box.style.color = kind === 'error' ? '#991b1b' : '#1e3a8a';
  box.style.border = `1px solid ${kind === 'error' ? '#fecaca' : '#bfdbfe'}`;
  box.textContent = message;
  box.style.display = 'block';
  clearTimeout(showNotice.timer);
  showNotice.timer = setTimeout(() => { box.style.display = 'none'; }, 6000);
}

function isNoLand(fs) {
  return fs?.health?.status === 'no_land_detected'
    || ['water', 'water body', 'water bodies'].includes(String(fs?.land_cover?.class || '').toLowerCase().replaceAll('_', ' '));
}

// Accessible, user-initiated voice workflow using the browser's native speech APIs;
// no audio is sent to AgriNet or retained by this feature.
let voiceSessionId = null;
let voiceLastReply = '';
let voiceRecognizer = null;
let voiceBusy = false;
let voiceLastQuality = null;
let voiceVoiceMode = false;
let voicePendingTurns = [];
let voiceWorkflowStage = null;
let voicePendingDeviceLocation = null;
let voiceRecognitionRestartTimer = null;
let voiceRecognitionRetryAllowed = false;
let voiceRecognizerStopRequested = false;
let voiceAutoDiagnosePhoto = false;
let voicePhotoAssessing = false;
let voiceContextNeedsRefresh = false;
let voiceBrowserMicDenied = false;
let voiceAbortedRestarts = 0;

function newVoiceSessionId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

function voiceStatus(message) {
  const target = $('voice-status');
  if (target) target.textContent = message;
}

function voiceTranscript(who, message) {
  const row = document.createElement('div');
  row.className = 'vt-row ' + (who === 'You' ? 'vt-you' : 'vt-bot');
  const label = document.createElement('strong');
  label.textContent = who + ': ';
  const content = document.createElement('span');
  content.textContent = message;
  row.append(label, content);
  $('voice-transcript').appendChild(row);
  $('voice-transcript').scrollTop = $('voice-transcript').scrollHeight;
}

function voiceSpeak(text) {
  voiceLastReply = text || '';
  if (!voiceLastReply) return;
  if (!('speechSynthesis' in window)) {
    voiceScheduleListeningRestart(0);
    return;
  }
  voicePauseNativeRecognition();
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(voiceLastReply);
  utterance.lang = currentLanguage === 'hi' ? 'hi-IN' : 'en-IN';
  utterance.rate = 0.92;
  utterance.onend = () => {
    voiceScheduleListeningRestart(250);
  };
  utterance.onerror = () => {
    voiceScheduleListeningRestart(250);
  };
  window.speechSynthesis.speak(utterance);
}

function voicePauseNativeRecognition() {
  if (!voiceRecognizer) return;
  voiceRecognizerStopRequested = true;
  voiceRecognitionRetryAllowed = false;
  try { voiceRecognizer.stop(); }
  catch (_) { voiceRecognizerStopRequested = false; }
}

function voiceSetLocationActions(show) {
  $('voice-location-actions').style.display = show ? 'flex' : 'none';
  $('voice-location-search').style.display = show ? 'flex' : 'none';
}

async function voiceAdvance(answer = '', location = null) {
  if (!voiceSessionId) return;
  if (voiceBusy) {
    if ((answer || location) && voicePendingTurns.length < 5) voicePendingTurns.push({answer, location});
    return;
  }
  voiceBusy = true;
  try {
    const intent = answer ? voiceIntent(answer) : null;
    if (intent) {
      voiceTranscript('You', answer);
      await voiceHandleIntent(intent);
      return;
    }
    if (answer && voiceIsQuestion(answer)) {
      voiceTranscript('You', answer);
      if (currentAnalysisResponse && !voiceContextNeedsRefresh) {
        const response = await apiPost('/api/v1/follow-up', {
          field_state: currentAnalysisResponse.field_state,
          evidence: currentAnalysisResponse.evidence,
          question: answer,
          lang: currentLanguage
        });
        voiceTranscript('AgriNet', response.answer);
        voiceSpeak(response.answer);
      } else {
        const response = currentLanguage === 'hi'
          ? 'मैं इसका जवाब खेत की जानकारी जाँचने के बाद दे पाऊँगा। आप चाहें तो अभी फोटो माँगें या मेरे अगले सवाल का जवाब दें।'
          : 'I can answer that after checking your field information. You can ask for a photo assessment now or answer my current question.';
        voiceTranscript('AgriNet', response);
        voiceSpeak(response);
      }
      return;
    }
    if (answer && voiceWorkflowStage === 'location' && voiceIsDeviceLocationRequest(answer)) {
      voiceTranscript('You', answer);
      await voiceGetDeviceLocationForVoice();
      return;
    }
    let confirmedLocation = location;
    if (!confirmedLocation && answer && voiceWorkflowStage === 'location' && voicePendingDeviceLocation) {
      if (voiceIsLocationConfirmation(answer)) {
        confirmedLocation = voicePendingDeviceLocation;
        voicePendingDeviceLocation = null;
      } else if (voiceIsLocationRejection(answer)) {
        voicePendingDeviceLocation = null;
        if (pin) { map.removeLayer(pin); pin = null; }
      }
    }
    if (confirmedLocation && currentFieldState?.field
      && (Number(confirmedLocation.lat) !== Number(currentFieldState.field.lat)
        || Number(confirmedLocation.lon) !== Number(currentFieldState.field.lon))) voiceContextNeedsRefresh = true;
    if (answer && voiceWorkflowStage === 'crop' && !/^(skip|unknown|don't know|do not know|छोड़ें|पता नहीं)$/i.test(answer.trim())
      && currentFieldState?.field?.crop?.toLowerCase() !== answer.trim().toLowerCase()) voiceContextNeedsRefresh = true;
    if (answer && ['symptoms', 'irrigation'].includes(voiceWorkflowStage)) voiceContextNeedsRefresh = true;
    const result = await apiPost('/api/v1/conversation', {
      session_id: voiceSessionId,
      lang: currentLanguage,
      answer,
      location: confirmedLocation
    });
    voiceWorkflowStage = result.stage;
    if (answer) voiceTranscript('You', answer);
    if (answer && result.stage === 'ready' && currentAnalysisResponse && !voiceContextNeedsRefresh) {
      const response = await apiPost('/api/v1/follow-up', {
        field_state: currentAnalysisResponse.field_state,
        evidence: currentAnalysisResponse.evidence,
        question: answer,
        lang: currentLanguage
      });
      voiceTranscript('AgriNet', response.answer);
      voiceSpeak(response.answer);
      voiceStatus('You can ask another question or use the repeat control.');
      return;
    }
    voiceSetLocationActions(Boolean(result.needs_location));
    if (result.error) voiceStatus(result.error);
    else if (result.language_fallback) voiceStatus('The guided conversation is currently available in English and Hindi. This session will use English; other advisory translations remain available.');
    else voiceStatus(result.field_ready ? 'Checking current field evidence…' : 'You can answer by voice or by typing below.');
    const prompt = result.field_ready ? result.prompt : `${result.prompt} ${currentLanguage === 'hi' ? 'आप कभी भी मदद, पिछला चरण, फसल बदलने या फोटो जाँच के लिए कह सकते हैं।' : 'At any time, say help, go back, change the crop, or ask for a photo check.'}`;
    voiceTranscript('AgriNet', prompt);
    voiceSpeak(prompt);
    if (result.field_ready) await voiceRunFieldCheck(result.field || {});
  } catch (error) {
    voiceStatus('Could not continue the conversation. Your typed and map-based options are still available. ' + error.message);
  } finally {
    voiceBusy = false;
    if (voicePendingTurns.length) {
      const next = voicePendingTurns.shift();
      setTimeout(() => void voiceAdvance(next.answer, next.location), 0);
    } else voiceScheduleListeningRestart(250);
  }
}

function voiceIntent(text) {
  const value = text.trim().toLowerCase();
  if (/\b(repeat (the )?(step|question)|repeat this step|repeat question)\b/.test(value)) return {action: 'repeat'};
  if (/\b(repeat|say that again|say it again|repeat that|repeat last answer|repeat the advisory)\b|दोहराओ|जवाब दोहराओ|पिछला जवाब|फिर से बोल|फिर सुनाएं|फिर सुनाएँ/.test(value)) return {action: 'repeat_last'};
  if (/\b(cancel|never mind|stop photo)\b|रद्द करें|रहने दें/.test(value)) return {action: 'cancel_photo'};
  if (/\b(stop speaking|stop voice|turn voice off)\b|बोलना रोक|आवाज़ बंद|माइक बंद/.test(value)) return {action: 'stop_voice'};
  if (/\b(help|what can i say|what can i do|options|commands)\b|मदद|क्या कहूँ|क्या कर/.test(value)) return {action: 'help'};
  if (/\b(photo|picture|camera|take a picture|take a photo|crop doctor|diagnos(e|is) (my )?crop)\b|फोटो|तस्वीर|चित्र|कैमरा/.test(value)) return {action: 'photo'};
  if (/\b(start over|restart|begin again|new field)\b|फिर से शुरू|नई शुरुआत|शुरुआत से शुरू/.test(value)) return {action: 'start_over'};
  if (/\b(analyze now|analyse now|give me advice now|check the field now|continue to analysis)\b|अब जाँच|अभी सलाह|विश्लेषण करें/.test(value)) return {action: 'analyze_now'};
  if (/\b(change|edit|update|correct)\b.*\b(location|field location|place)\b|\b(location|field location|place)\b.*\b(change|edit|update)\b|जगह बदल|स्थान बदल|खेत की जगह बदल|दूसरी जगह/.test(value)) return {action: 'edit_location'};
  if (/\b(change|edit|update|correct)\b.*\b(crop|plant)\b|\b(crop|plant)\b.*\b(change|edit|update)\b|फसल बदल/.test(value)) return {action: 'edit_crop'};
  if (/\b(change|edit|update)\b.*\b(symptom|problem|condition)\b|लक्षण बदल|समस्या बदल/.test(value)) return {action: 'edit_symptoms'};
  if (/\b(change|edit|update)\b.*\b(irrigation|watering|watered)\b|सिंचाई बदल/.test(value)) return {action: 'edit_irrigation'};
  if (/\b(go back|previous step|back one step|go to previous)\b|पीछे जाएँ|पिछला सवाल|पिछले चरण/.test(value)) return {action: 'back'};
  if (/\b(open|show|go to)\b.*\b(map|field view|field analysis)\b|नक्शा खोल/.test(value)) return {action: 'show_field'};
  if (/\b(open|show|go to)\b.*\b(advisory|advice)\b|सलाह दिख|सलाह खोल|सलाह पर जाए/.test(value)) return {action: 'show_advisory'};
  if (/\b(open|show|go to)\b.*\b(dashboard|home)\b|डैशबोर्ड खोल/.test(value)) return {action: 'show_dashboard'};
  if (/\b(open|show|go to)\b.*\b(network|api)\b|नेटवर्क खोल/.test(value)) return {action: 'show_network'};
  if (/\b(switch|change)\b.*\b(to )?hindi\b|हिंदी में|हिन्दी में/.test(value)) return {action: 'language_hi'};
  if (/\b(switch|change)\b.*\b(to )?english\b|अंग्रेज़ी में|अंग्रेजी में/.test(value)) return {action: 'language_en'};
  if (/भाषा बदल|भाषा चुन|language change/.test(value)) return {action: currentLanguage === 'hi' ? 'language_en' : 'language_hi'};
  if (/\b(next step|what should i do next|what now|what do i do first)\b|अगला कदम|अब क्या करना|पहले क्या कर/.test(value)) return {action: 'next_step'};
  if (/\b(field details|field information|crop details|show my field)\b|खेत की जानकारी|फसल की जानकारी|खेत का विवरण/.test(value)) return {action: 'field_details'};
  const clickMatch = value.match(/^(?:click|press|select|activate)\s+(.+?)(?:\s+button)?$|^(?:बटन दबाएं|क्लिक करें)\s+(.+)$/i);
  if (clickMatch) return {action: 'click_ui', label: (clickMatch[1] || clickMatch[2]).trim()};
  return null;
}

function voiceIsQuestion(text) {
  return /^(what|why|how|when|where|which|who|can you|could you|should i|do i|is it|is my|tell me|explain)\b|^(क्या|क्यों|कैसे|कब|कहाँ|कौन|बताइए|समझाइए)/i.test(text.trim());
}

async function voiceHandleIntent(intent) {
  if (intent.action === 'stop_voice') {
    clearTimeout(voiceRecognitionRestartTimer);
    voiceVoiceMode = false;
    voicePendingTurns = [];
    window.speechSynthesis?.cancel();
    try { voiceRecognizer?.stop(); } catch (_) { /* already stopped */ }
    voiceStatus(currentLanguage === 'hi' ? 'आवाज़ बंद है। लिखकर जवाब दे सकते हैं या फिर से बोलना शुरू करें।' : 'Voice is off. You can type, or start voice again when ready.');
    return;
  }
  if (intent.action === 'next_step') {
    const text = voiceLocalNextStep();
    voiceTranscript('AgriNet', text);
    voiceSpeak(text);
    return;
  }
  if (intent.action === 'field_details') {
    const text = voiceLocalFieldDetails();
    document.querySelector('[data-target="view-field"]').click();
    voiceTranscript('AgriNet', text);
    voiceSpeak(text);
    return;
  }
  if (intent.action === 'click_ui') {
    voiceClickUi(intent.label);
    return;
  }
  if (intent.action === 'repeat_last') {
    if (voiceLastReply) voiceSpeak(voiceLastReply);
    else voiceSpeak(currentLanguage === 'hi' ? 'अभी दोहराने के लिए कोई जवाब नहीं है।' : 'There is no previous reply to repeat yet.');
    return;
  }
  if (intent.action === 'cancel_photo') {
    voiceAutoDiagnosePhoto = false;
    const text = currentLanguage === 'hi' ? 'ठीक है, फोटो जाँच रद्द है। आप अपनी बात जारी रख सकते हैं।' : 'Okay, photo assessment cancelled. You can continue our conversation.';
    voiceTranscript('AgriNet', text);
    voiceSpeak(text);
    return;
  }
  if (intent.action === 'help') {
    const text = currentLanguage === 'hi'
      ? 'आप कभी भी कह सकते हैं: फिर से बोलें, पिछला चरण, जगह बदलें, फसल बदलें, फोटो लें, अभी जाँच करें, या शुरुआत से शुरू करें। आप अपना जवाब लिख भी सकते हैं।'
      : 'At any time, say repeat, go back, change location, change crop, take a photo, analyze now, or start over. You can also ask me a question or type your reply.';
    voiceTranscript('AgriNet', text);
    voiceSpeak(text);
    return;
  }
  if (intent.action === 'photo') {
    voiceAutoDiagnosePhoto = true;
    document.querySelector('[data-target="view-doctor"]').click();
    if (currentFieldState?.field?.crop) $('dx-crop').value = currentFieldState.field.crop;
    const text = currentLanguage === 'hi'
      ? 'फसल डॉक्टर खुल गया है। अब कैमरे से फोटो लें या तस्वीर चुनें। फोटो मिलते ही मैं जाँच शुरू करूँगा।'
      : 'Crop Doctor is open. Take a photo or choose an image; I will start its assessment as soon as it is selected.';
    voiceStatus(text);
    voiceTranscript('AgriNet', text);
    voiceSpeak(text);
    try { $('dx-file').click(); }
    catch (_) { $('dx-file').focus(); }
    return;
  }
  if (intent.action === 'show_field' || intent.action === 'show_advisory') {
    document.querySelector(`[data-target="${intent.action === 'show_field' ? 'view-field' : 'view-advisory'}"]`).click();
    const text = intent.action === 'show_field' ? 'Opening your field analysis.' : 'Opening your field advisory.';
    voiceStatus(text);
    voiceSpeak(text);
    return;
  }
  if (intent.action === 'show_dashboard' || intent.action === 'show_network') {
    document.querySelector(`[data-target="${intent.action === 'show_dashboard' ? 'view-dashboard' : 'view-network'}"]`).click();
    const text = intent.action === 'show_dashboard' ? 'Opening the dashboard.' : 'Opening the network and API view.';
    voiceStatus(text);
    voiceSpeak(text);
    return;
  }
  if (intent.action === 'language_hi' || intent.action === 'language_en') {
    const nextLanguage = intent.action === 'language_hi' ? 'hi' : 'en';
    $('lang').value = nextLanguage;
    await changeLanguage(nextLanguage);
    const text = nextLanguage === 'hi' ? 'अब हम हिंदी में बात करेंगे।' : 'We will continue in English.';
    voiceTranscript('AgriNet', text);
    voiceSpeak(text);
    return;
  }
  if (!voiceSessionId) {
    voiceSessionId = newVoiceSessionId();
    voiceWorkflowStage = null;
    voicePendingDeviceLocation = null;
    await voiceAdvance();
  }
  try {
    const controlAction = intent.action === 'back' && voiceWorkflowStage === 'crop' ? 'edit_location' : intent.action;
    const result = await apiPost('/api/v1/conversation/control', {
      session_id: voiceSessionId, lang: currentLanguage, action: controlAction
    });
    if (result.error) {
      voiceStatus(result.error);
      voiceSpeak(result.error);
      return;
    }
    voiceWorkflowStage = result.stage;
    voiceSetLocationActions(Boolean(result.needs_location));
    if (controlAction === 'edit_location' || controlAction === 'start_over') {
      voiceContextNeedsRefresh = true;
      voicePendingDeviceLocation = null;
      if (pin) { map.removeLayer(pin); pin = null; }
    }
    if (['edit_crop', 'edit_symptoms', 'edit_irrigation'].includes(controlAction)) voiceContextNeedsRefresh = true;
    if (['back', 'edit_location', 'edit_crop', 'edit_symptoms', 'edit_irrigation', 'start_over'].includes(controlAction)) {
      document.querySelector('[data-target="view-dashboard"]').click();
    }
    const prompt = intent.action === 'repeat'
      ? result.prompt
      : `${result.prompt} ${currentLanguage === 'hi' ? 'आप किसी भी समय मदद, फोटो जाँच, पिछला चरण, या जवाब बदलने के लिए कह सकते हैं।' : 'At any time, ask for help, a photo check, the previous step, or to change an answer.'}`;
    voiceTranscript('AgriNet', prompt);
    voiceStatus(result.field_ready ? 'Checking the field now.' : prompt);
    voiceSpeak(prompt);
    if (result.field_ready) await voiceRunFieldCheck(result.field || {});
  } catch (error) {
    voiceStatus('I could not change that step. You can try again or type your reply. ' + error.message);
  }
}

function voiceClickUi(requestedLabel) {
  const normalize = value => String(value || '').toLowerCase().replace(/[\u200b-\u200d]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const wanted = normalize(requestedLabel);
  const targets = [...document.querySelectorAll('button, [role="button"], .nav-btn, a[href], input[type="button"], input[type="submit"]')]
    .filter(element => element.getClientRects().length && !element.disabled)
    .map(element => ({element, label: normalize(element.getAttribute('aria-label') || element.title || element.innerText || element.value)}))
    .filter(target => target.label && (target.label === wanted || target.label.includes(wanted) || wanted.includes(target.label)));
  if (targets.length === 1) {
    targets[0].element.click();
    const message = `Activated ${targets[0].element.innerText?.trim() || requestedLabel}.`;
    voiceStatus(message);
    voiceSpeak(message);
  } else if (targets.length > 1) {
    const choices = targets.slice(0, 5).map(target => target.element.innerText?.trim()).filter(Boolean).join(', ');
    const message = currentLanguage === 'hi' ? `कई बटन मिल रहे हैं: ${choices}। कृपया पूरा नाम बोलें।` : `I found several matching controls: ${choices}. Please say the full button label.`;
    voiceStatus(message);
    voiceSpeak(message);
  } else {
    const message = currentLanguage === 'hi' ? `${requestedLabel} नाम का कोई खुला बटन नहीं मिला। मदद कहकर उपलब्ध काम सुनें।` : `I could not find a visible control called ${requestedLabel}. Say help for available actions.`;
    voiceStatus(message);
    voiceSpeak(message);
  }
}

function voiceLocalNextStep() {
  const recommendations = currentAdvisory?.recommendations;
  if (Array.isArray(recommendations) && recommendations.length) {
    const recommendation = recommendations.slice(0, 2).join('. ');
    return currentLanguage === 'hi' ? `उपलब्ध सलाह में अगला कदम है: ${recommendation}` : `The available advisory says the next step is: ${recommendation}`;
  }
  return currentLanguage === 'hi'
    ? 'अभी AI सलाह उपलब्ध नहीं है, इसलिए मैं कोई खास उपचार नहीं बताऊँगा। खेत में फसल और मिट्टी की स्थिति देखें। समस्या दिखे तो साफ़ फोटो लें या स्थानीय कृषि विशेषज्ञ से जाँच कराएँ।'
    : 'The AI advisory is unavailable, so I cannot give a field-specific treatment. Inspect the crop and soil in the field. If you see a problem, take a clear photo or ask a local agricultural expert to check it.';
}

function voiceLocalFieldDetails() {
  const field = currentAnalysisResponse?.field_state?.field || currentFieldState?.field || {};
  const crop = field.crop || $('crop-input')?.value || (currentLanguage === 'hi' ? 'अभी नहीं बताया' : 'not provided');
  const location = Number.isFinite(field.lat) && Number.isFinite(field.lon) ? `${field.lat.toFixed(3)}, ${field.lon.toFixed(3)}` : (currentLanguage === 'hi' ? 'पुष्टि नहीं हुई' : 'not confirmed');
  return currentLanguage === 'hi'
    ? `इस खेत के लिए फसल ${crop} दर्ज है। पुष्टि की गई जगह ${location} है। विस्तृत प्रमाण खेत विश्लेषण स्क्रीन पर देखें।`
    : `The crop recorded for this field is ${crop}. The confirmed location is ${location}. Open field analysis to review the detailed evidence.`;
}

function voiceIsDeviceLocationRequest(text) {
  return /\b(use|continue with|use my|current|device|phone)\b.*\b(location|place|position)\b|\b(location|place|position)\b.*\b(current|device|phone)\b|मौजूदा जगह|वर्तमान जगह|डिवाइस की जगह|फोन की जगह|मेरी जगह|इसी जगह से/i.test(text);
}

function voiceIsLocationConfirmation(text) {
  return /\b(yes|yeah|yep|correct|right|it is my field|this is my field|same place|confirm)\b|हाँ|हां|जी हाँ|सही|यही|मेरा खेत|खेत यही/i.test(text);
}

function voiceIsLocationRejection(text) {
  return /\b(no|nope|wrong|not my field|another place|different place)\b|नहीं|गलत|दूसरी जगह|मेरा खेत नहीं/i.test(text);
}

function voiceGetDeviceLocationForVoice() {
  return new Promise(resolve => {
    if (!navigator.geolocation) {
      voiceStatus('This browser cannot provide device location. Say your village name, or choose the field on the map.');
      voiceTranscript('AgriNet', 'Device location is unavailable. You can say your village name or choose the field on the map.');
      voiceSpeak(currentLanguage === 'hi'
        ? 'डिवाइस की जगह उपलब्ध नहीं है। अपना गाँव बताइए या नक्शे पर खेत चुनिए।'
        : 'Device location is unavailable. Say your village name or choose the field on the map.');
      resolve();
      return;
    }
    voiceStatus('Requesting device location because you asked to use it.');
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lon = normalizeLongitude(position.coords.longitude);
      if (lat < 6 || lat > 38 || lon < 67 || lon > 98) {
        voiceStatus('That device location is outside the supported India area. Say your village name or choose the field on the map.');
        voiceSpeak(currentLanguage === 'hi'
          ? 'यह डिवाइस की जगह भारत के समर्थित क्षेत्र से बाहर है। अपना गाँव बताइए या नक्शे पर खेत चुनिए।'
          : 'That device location is outside the supported India area. Say your village name or choose the field on the map.');
        resolve();
        return;
      }
      voicePendingDeviceLocation = {lat, lon};
      place(lat, lon);
      map.setView([lat, lon], 10);
      const prompt = currentLanguage === 'hi'
        ? 'डिवाइस की जगह नक्शे पर मिल गई। क्या यही आपका खेत है? हाँ कहें तो मैं जाँच आगे शुरू करूँगा। फोन की जगह खेत न हो तो नहीं कहें।'
        : 'I found your device location. Is this your field? Say yes and I will continue the field check. Say no if your field is somewhere else.';
      voiceStatus(prompt);
      voiceTranscript('AgriNet', prompt);
      voiceSpeak(prompt);
      resolve();
    }, error => {
      const detail = error.code === 1 ? 'Location permission was denied.' : error.code === 3 ? 'The location request timed out.' : 'Device location is unavailable.';
      const prompt = currentLanguage === 'hi'
        ? 'डिवाइस की जगह नहीं मिल सकी। आप गाँव का नाम बोल सकते हैं या नक्शे पर खेत चुन सकते हैं।'
        : `${detail} Say your village name or choose the field on the map.`;
      voiceStatus(prompt);
      voiceTranscript('AgriNet', prompt);
      voiceSpeak(prompt);
      resolve();
    }, {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000});
  });
}

async function voiceRunFieldCheck(field) {
  if (!Number.isFinite(field.lat) || !Number.isFinite(field.lon)) {
    voiceStatus('Please select and confirm the field on the map.');
    voiceSetLocationActions(true);
    return;
  }
  $('crop-input').value = field.crop || '';
  place(field.lat, field.lon);
  await analyzeField({lat: field.lat, lon: field.lon, crop: field.crop || '', lang: currentLanguage});
  if (!currentAnalysisResponse) return;
  const analyzedField = currentAnalysisResponse.field_state?.field || {};
  if (Number(analyzedField.lat) !== Number(field.lat) || Number(analyzedField.lon) !== Number(field.lon)
    || String(analyzedField.crop || '').toLowerCase() !== String(field.crop || '').toLowerCase()) {
    voiceStatus('The new field details were not analyzed. I am keeping the previous evidence separate; please try the analysis again.');
    return;
  }
  voiceContextNeedsRefresh = false;
  document.querySelector('[data-target="view-dashboard"]').click();
  currentAnalysisResponse.field_state.field.farmer_report = {
    symptoms: field.symptoms || null,
    last_irrigation: field.last_irrigation || null,
    location_confirmed_by_farmer: Boolean(field.location_confirmed)
  };
  try {
    voiceLastQuality = await apiPost('/api/v1/evidence-quality', {field_state: currentAnalysisResponse.field_state});
    currentAnalysisResponse.field_state.evidence_quality = voiceLastQuality;
    const satellite = voiceLastQuality.satellite;
    const weather = voiceLastQuality.weather;
    const soil = voiceLastQuality.soil;
    const ndvi = voiceLastQuality.vegetation_index;
    const note = !ndvi.available
      ? ndvi.limitation
      : !ndvi.fresh
        ? `The latest satellite observation is ${satellite.age_days ?? 'undated'} days old. Treat it as historical context, not a current diagnosis.`
        : `The latest satellite observation is from ${satellite.observation_date}. NDVI shows vegetation greenness; it cannot identify a disease by itself.`;
    const evidence = $('voice-evidence');
    evidence.innerHTML = `<details><summary>Evidence quality and sources</summary><p>${esc(note)}</p><ul><li>Satellite: ${satellite.available ? 'available' : 'unavailable'}; ${esc(satellite.observation_date || 'no observation date')}.</li><li>Weather: ${weather.available ? 'available' : 'unavailable'}${weather.retrieved_at ? `; ${esc(weather.retrieved_at)}` : ''}. Forecasts do not prove field conditions.</li><li>Soil: ${soil.available ? 'available' : 'unavailable'}; SoilGrids is gridded information, not a field test.</li></ul></details>`;
    evidence.style.display = 'block';
  } catch (error) {
    voiceStatus('Field analysis completed; evidence freshness details could not be loaded. ' + error.message);
  }
  await regenerateAdvisory();
  if (currentAdvisory?.summary) {
    const nextStep = currentLanguage === 'hi'
      ? 'अब आप सवाल पूछ सकते हैं, फोटो जाँच माँग सकते हैं, कोई जवाब बदल सकते हैं, या अगला कदम पूछ सकते हैं।'
      : 'What would you like to do next? Ask a question, request a photo check, change an answer, or ask what to do first.';
    const spokenAdvice = `${currentAdvisory.summary} ${nextStep}`;
    voiceTranscript('AgriNet', spokenAdvice);
    voiceSpeak(spokenAdvice);
    voiceStatus('Field advice is ready. You can continue by voice or typing.');
  } else {
    voiceStatus('Field analysis is ready. The advisory service did not return a spoken summary; use the visible field results.');
  }
}

function voiceStartListening() {
  if (!voiceVoiceMode) return;
  if (voiceRecognizer || voiceBusy || window.speechSynthesis?.speaking) return;
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceStatus(!window.isSecureContext
      ? 'Browser voice needs HTTPS (or localhost). Open the secure site, or type your answer below.'
      : 'This browser does not provide speech recognition. Try another browser such as Chrome, or type your answer below.');
    return;
  }
  if (voiceBrowserMicDenied) {
    voiceStatus(currentLanguage === 'hi'
      ? 'माइक्रोफ़ोन की अनुमति बंद है। ब्राउज़र की साइट सेटिंग में माइक्रोफ़ोन चालू करें, या नीचे जवाब लिखें।'
      : 'Microphone access is blocked. Allow it in this site’s browser settings, then press Start voice again, or type your answer below.');
    return;
  }
  try { voiceRecognizer = new SpeechRecognition(); }
  catch (error) {
    voiceStatus(`Could not create speech recognition (${error.name || 'browser error'}). You can type your answer instead.`);
    return;
  }
  const recognizer = voiceRecognizer;
  let stoppedAfterFinalResult = false;
  recognizer.lang = currentLanguage === 'hi' ? 'hi-IN' : 'en-IN';
  recognizer.interimResults = false;
  // Single-utterance recognition is considerably more reliable across browsers.
  // We restart after its result or a silence timeout, so the conversation still
  // remains ready for another reply without holding one recognition session open.
  recognizer.continuous = false;
  recognizer.maxAlternatives = 1;
  recognizer.onstart = () => voiceStatus(voicePendingDeviceLocation
    ? (currentLanguage === 'hi' ? 'मैं सुन रहा हूँ। खेत की पुष्टि के लिए “हाँ” कहें, या नीचे जवाब लिखें।' : 'Listening for your field confirmation. Say yes, or type your reply below.')
    : (currentLanguage === 'hi' ? 'मैं सुन रहा हूँ। बोलकर जवाब दें या नीचे लिखें।' : 'Listening. Speak naturally, or type your answer below.'));
  recognizer.onresult = event => {
    const said = event.results?.[0]?.[0]?.transcript?.trim();
    if (said) {
      stoppedAfterFinalResult = true;
      voiceRecognitionRetryAllowed = false;
      voiceAbortedRestarts = 0;
      void voiceAdvance(said);
    }
  };
  recognizer.onerror = event => {
    if (event.error === 'aborted' && (stoppedAfterFinalResult || voiceRecognizerStopRequested || voiceBusy || !voiceVoiceMode)) return;
    if (event.error === 'aborted') {
      voiceAbortedRestarts += 1;
      if (voiceAbortedRestarts > 3) {
        voiceRecognitionRetryAllowed = false;
        voiceStatus(currentLanguage === 'hi'
          ? 'ब्राउज़र की आवाज़ पहचान बार-बार बंद हो रही है। साइट की माइक्रोफ़ोन अनुमति जाँचें या नीचे जवाब लिखें।'
          : 'Browser speech recognition keeps aborting. Check this site’s microphone permission, or type your answer below.');
        return;
      }
      voiceRecognitionRetryAllowed = true;
      return;
    }
    const messages = {
      'not-allowed': currentLanguage === 'hi' ? 'माइक्रोफ़ोन की अनुमति नहीं मिली। साइट सेटिंग में अनुमति दें या नीचे जवाब लिखें।' : 'Microphone permission was denied. Allow it in the site settings and press Start voice again, or type your answer.',
      'service-not-allowed': currentLanguage === 'hi' ? 'इस ब्राउज़र की आवाज़ पहचान सेवा उपलब्ध नहीं है। नीचे जवाब लिखें।' : 'This browser’s speech service is blocked. You can type your answer instead.',
      'audio-capture': currentLanguage === 'hi' ? 'माइक्रोफ़ोन नहीं मिल रहा। उसे जोड़ें या चालू करें, फिर कोशिश करें।' : 'No microphone was found. Connect or enable one, then try again.',
      'language-not-supported': currentLanguage === 'hi' ? 'इस भाषा की आवाज़ पहचान इस ब्राउज़र में उपलब्ध नहीं है। लिखकर जवाब दें।' : 'Speech recognition for this language is unavailable in this browser. You can type your answer instead.',
      'no-speech': currentLanguage === 'hi' ? 'अभी जवाब सुनाई नहीं दिया। माइक्रोफ़ोन फिर सुन रहा है; आप नीचे लिख भी सकते हैं।' : 'I did not hear you yet. I will keep listening; you can also type your reply below.',
      'network': currentLanguage === 'hi' ? 'आवाज़ पहचान को नेटवर्क कनेक्शन चाहिए। इंटरनेट जाँचें या जवाब लिखें।' : 'Browser speech recognition needs a network connection. Check your internet, or type your answer.'
    };
    voiceStatus(messages[event.error] || `Speech recognition error (${event.error}). You can type your answer instead.`);
    if (['not-allowed', 'service-not-allowed', 'audio-capture'].includes(event.error)) voiceBrowserMicDenied = event.error === 'not-allowed' || event.error === 'audio-capture';
    if (!['no-speech', 'aborted'].includes(event.error)) voiceRecognitionRetryAllowed = false;
  };
  recognizer.onaudiostart = () => voiceStatus(currentLanguage === 'hi' ? 'माइक्रोफ़ोन चालू है। अब बोलें।' : 'Microphone is active. You can speak now.');
  recognizer.onspeechstart = () => voiceStatus(currentLanguage === 'hi' ? 'आपकी आवाज़ सुनाई दे रही है…' : 'I can hear you…');
  recognizer.onnomatch = () => voiceStatus(currentLanguage === 'hi' ? 'बात समझ नहीं आई। थोड़ा साफ़ बोलें या जवाब लिखें।' : 'I could not understand that. Speak a little more clearly or type your reply.');
  recognizer.onend = () => {
    if (voiceRecognizer === recognizer) voiceRecognizer = null;
    const expectedStop = stoppedAfterFinalResult || voiceRecognizerStopRequested;
    voiceRecognizerStopRequested = false;
    if (expectedStop) voiceRecognitionRetryAllowed = true;
    if (voiceRecognitionRetryAllowed) voiceScheduleListeningRestart(500);
  };
  voiceRecognitionRetryAllowed = true;
  try { recognizer.start(); }
  catch (error) {
    voiceRecognizer = null;
    voiceRecognitionRetryAllowed = false;
    const detail = error.name === 'NotAllowedError' || error.name === 'SecurityError'
      ? 'Allow microphone access and use HTTPS (or localhost)'
      : error.name === 'InvalidStateError' ? 'The microphone is already starting; wait a moment and try again'
      : `Could not start microphone (${error.name || 'browser error'})`;
    voiceStatus(`${detail}. You can also type your reply below.`);
    if (error.name === 'AbortError' && ++voiceAbortedRestarts <= 3) {
      voiceRecognitionRetryAllowed = true;
      voiceScheduleListeningRestart(1000 * voiceAbortedRestarts);
    }
  }
}

function voiceScheduleListeningRestart(delay = 500) {
  clearTimeout(voiceRecognitionRestartTimer);
  if (!voiceVoiceMode || voiceBusy || voicePhotoAssessing || window.speechSynthesis?.speaking) return;
  voiceRecognitionRestartTimer = setTimeout(() => {
    if (voiceVoiceMode && !voiceBusy && !voicePhotoAssessing && !voiceRecognizer) voiceStartListening();
  }, delay);
}

document.addEventListener('DOMContentLoaded', () => {
  $('voice-start').addEventListener('click', async () => {
    voiceVoiceMode = true;
    voiceAbortedRestarts = 0;
    voiceRecognitionRetryAllowed = true;
    voiceBrowserMicDenied = false;
    if (!voiceSessionId) {
      // Start recognition synchronously from the farmer's click. Some browsers
      // abort recognition if it is first started after the async greeting request.
      voiceStartListening();
      voiceSessionId = newVoiceSessionId();
      voiceWorkflowStage = null;
      voicePendingDeviceLocation = null;
      $('voice-transcript').replaceChildren();
      $('voice-evidence').style.display = 'none';
      await voiceAdvance();
      return;
    }
    voiceStartListening();
  });
  $('voice-stop').addEventListener('click', () => {
    clearTimeout(voiceRecognitionRestartTimer);
    voiceVoiceMode = false;
    voicePendingTurns = [];
    window.speechSynthesis?.cancel();
    try { voiceRecognizer?.stop(); } catch (_) { /* already stopped */ }
    voiceStatus(window.t('voice_stopped'));
  });
  $('voice-repeat').addEventListener('click', () => voiceSpeak(voiceLastReply));
  $('voice-reset').addEventListener('click', () => {
    clearTimeout(voiceRecognitionRestartTimer);
    window.speechSynthesis?.cancel();
    try { voiceRecognizer?.stop(); } catch (_) { /* already stopped */ }
    voiceSessionId = null;
    voiceWorkflowStage = null;
    voicePendingDeviceLocation = null;
    voiceVoiceMode = false;
    voicePendingTurns = [];
    voiceSetLocationActions(false);
    $('voice-transcript').replaceChildren();
    voiceStatus(window.t('voice_cleared'));
  });
  $('voice-geolocate').addEventListener('click', () => {
    if (!navigator.geolocation) return voiceStatus('This browser cannot provide device location. Tap your field on the map instead.');
    voiceStatus('Requesting device location after your action. Please confirm that the pin is your field.');
    navigator.geolocation.getCurrentPosition(position => {
      const {latitude: lat, longitude} = position.coords;
      const lon = normalizeLongitude(longitude);
      if (lat < 6 || lat > 38 || lon < 67 || lon > 98) return voiceStatus('That device location is outside the supported India area. Choose the field manually on the map.');
      place(lat, lon);
      map.setView([lat, lon], 10);
      voiceStatus('Device location placed on the map. Confirm it only if it is your field; otherwise move the map pin.');
    }, error => {
      const reason = error.code === 1 ? 'Location permission was denied.' : error.code === 3 ? 'The location request timed out.' : 'Device location is unavailable.';
      voiceStatus(reason + ' Tap your field on the map or enter coordinates manually.');
    }, {enableHighAccuracy: false, timeout: 10000, maximumAge: 60000});
  });
  $('voice-location-search').addEventListener('submit', async event => {
    event.preventDefault();
    const query = $('voice-place').value.trim();
    if (query.length < 2) return voiceStatus('Enter at least two letters for a village or place.');
    voiceStatus('Searching actual place names…');
    $('voice-location-results').replaceChildren();
    try {
      const response = await apiGet(`/api/v1/locations?q=${encodeURIComponent(query)}`);
      if (!response.locations?.length) return voiceStatus(response.available ? 'No matching Indian places were found. Try a nearby town or use the map.' : 'Place search is unavailable. Use the map or enter coordinates.');
      for (const location of response.locations) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-secondary';
        button.setAttribute('role', 'listitem');
        button.textContent = [location.name, location.admin1].filter(Boolean).join(', ');
        button.addEventListener('click', () => {
          place(location.lat, location.lon);
          map.setView([location.lat, location.lon], 10);
          voiceStatus('Place pin set. Confirm that this is your field; move the pin if needed.');
        });
        $('voice-location-results').appendChild(button);
      }
      voiceStatus('Choose the matching village, then confirm that it is your field.');
    } catch (error) {
      voiceStatus('Place search failed. Use the map or enter coordinates. ' + error.message);
    }
  });
  $('voice-photo').addEventListener('click', () => {
    void voiceHandleIntent({action: 'photo'});
  });
  $('voice-confirm-location').addEventListener('click', () => {
    if (pin) {
      const {lat, lng} = pin.getLatLng();
      void voiceAdvance('', {lat, lon: normalizeLongitude(lng)});
      return;
    }
    const lat = Number($('lat-input').value), lon = Number($('lon-input').value);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return voiceStatus('Tap the map or enter field coordinates first.');
    place(lat, lon);
    void voiceAdvance('', {lat, lon});
  });
  $('voice-text-form').addEventListener('submit', event => {
    event.preventDefault();
    const value = $('voice-text').value.trim();
    if (!value) return;
    $('voice-text').value = '';
    clearTimeout(voiceRecognitionRestartTimer);
    try { voiceRecognizer?.stop(); } catch (_) { /* already stopped */ }
    if (!voiceSessionId) {
      voiceSessionId = newVoiceSessionId();
      voiceWorkflowStage = null;
      voicePendingDeviceLocation = null;
      void voiceAdvance().then(() => {
        if (pin) {
          const {lat, lng} = pin.getLatLng();
          void voiceAdvance(value, {lat, lon: normalizeLongitude(lng)});
        } else voiceStatus('Choose your field on the map before we continue. Your answer is ready to send after location confirmation.');
      });
    } else {
      void voiceAdvance(value);
    }
  });
});

window.localizePlace = function(name, language = currentLanguage) {
    if(!name) return "";
    const enStr = LOCATION_TRANSLATIONS[name]?.en || name;
    if (language === 'en') return enStr;
    const localStr = LOCATION_TRANSLATIONS[name]?.[language] || enStr;
    return localStr;
};

// Also redefine localizeLocation to handle structured "City, State"
window.localizeLocation = function(locStr) {
    if(!locStr) return "";
    let parts = locStr.split(',').map(s => s.trim());
    if (parts.length === 2) {
         return `${window.localizePlace(parts[0])}, ${window.localizePlace(parts[1])}`;
    }
    return window.localizePlace(locStr);
};


// Init Map
const map = L.map('map').setView([22.5, 79], 4.6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

function place(lat, lon) {
  if(pin) map.removeLayer(pin);
  pin = L.marker([lat, lon], {draggable: true}).addTo(map);
  pin.on('dragend', () => {
    const moved = pin.getLatLng();
    const normalized = normalizeLongitude(moved.lng);
    if (moved.lat < 6 || moved.lat > 38 || normalized < 67 || normalized > 98) {
      showNotice('The field marker must remain within the supported India area.');
      place(lat, lon);
      return;
    }
    place(moved.lat, normalized);
    if (voiceSessionId) voiceStatus('Map pin moved. Confirm the location if it is your field.');
  });
  $('pin-coords').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  if ($('lat-input')) $('lat-input').value = lat.toFixed(4);
  if ($('lon-input')) $('lon-input').value = lon.toFixed(4);
}
function normalizeLongitude(lon) {
    return ((Number(lon) + 180) % 360 + 360) % 360 - 180;
}

const indiaBounds = L.latLngBounds([6, 67], [38, 98]);
map.setMaxBounds(indiaBounds.pad(0.08));
map.on('click', e => {
    const lat = Number(e.latlng.lat);
    const lon = normalizeLongitude(e.latlng.lng);
    if (lat < 6 || lat > 38 || lon < 67 || lon > 98) return;
    place(lat, lon);
});

// Init and I18N wiring
document.addEventListener('DOMContentLoaded', () => {
  $('lang').value = currentLanguage;
  updateUI();
  
  $('lang').addEventListener('change', (e) => {
    changeLanguage(e.target.value);
  });
  
  init();
  initInteroperability();
});




let currentScenarios = null;

function renderScenarios() {
  if (!currentScenarios) return;
  $('scenario-list').innerHTML = currentScenarios.scenarios.map(s => `
      <div class="scenario-btn" onclick="runScenario('${s.key}', ${s.lat}, ${s.lon})">
        <span class="badge badge-demo" style="margin-bottom:8px">${window.t('demoBadge') || 'DEMO'}</span>
        <div class="sb-title">${esc(window.localizeLocation(s.name))}</div>
        <div class="sb-sub">${esc(window.localizePlace(s.crop))}</div>
      </div>
    `).join('');
}

function updateUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    let translated = window.t(key);
    if (translated !== key) {
      if (el.children.length === 0) {
         el.textContent = translated;
      } else {
         el.innerHTML = translated;
      }
    }
  });
  
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    let translated = window.t(key);
    if (translated !== key) el.placeholder = translated;
  });

  updateVoiceLabels();

  renderScenarios();

  
  // Contextual Dynamic UIs
  if (currentFieldState && currentFieldState.field.crop) {
    $('f-crop').textContent = `${window.t('declaredCrop') || 'Declared Crop: '} ${window.localizePlace(currentFieldState.field.crop)}`;
  } else if (currentFieldState) {
     $('f-crop').textContent = window.t('unknownCrop') || 'Unknown Crop';
  }
  
  // Re-render Dynamic field contents and badging (health, evidence, badging if present)
  if (currentAnalysisResponse) {
    renderField(currentAnalysisResponse); 
  }
  
  // Re-render Advisory
  if (currentAdvisory) {
    renderAdvisory(currentAdvisory);
  } else if (isNoLand(currentFieldState) && $('adv-empty').style.display !== 'none' && !$('adv-empty').querySelector('[data-i18n]')) {
    $('adv-empty').textContent = `${noLandText(0)} — ${noLandText(1)}`;
  }

  // Re-render Dx
  if (lastDxResult) {
     renderDx(lastDxResult);
  }
}

// Voice card copy lives in lang.js (voice_* keys) so every UI language is covered.
function updateVoiceLabels() {
  const t = window.t;
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
  setText('voice-title', t('voice_title'));
  const card = $('voice-advisor');
  if (!card) return;
  const subtitle = card.querySelector('#voice-title + p');
  if (subtitle) subtitle.textContent = t('voice_desc');
  setText('voice-start', t('voice_start'));
  setText('voice-stop', t('voice_stop'));
  setText('voice-geolocate', t('voice_locate'));
  setText('voice-confirm-location', t('voice_confirm'));
  const note = $('voice-confirm-location')?.nextElementSibling;
  if (note) note.textContent = t('voice_map_note');
  $('voice-text').placeholder = t('voice_placeholder');
  $('voice-place').placeholder = t('voice_place');
  $('voice-location-search').querySelector('button').textContent = t('voice_search');
  setText('voice-privacy', t('voice_privacy'));
  $('voice-text-form').querySelector('button').textContent = t('voice_send');
  setText('voice-photo', t('voice_photo'));
  setText('voice-repeat', t('voice_repeat'));
  setText('voice-reset', t('voice_reset'));
  if (!voiceSessionId && !$('voice-transcript').childElementCount) voiceStatus(t('voice_initial'));
  $('voice-text').labels[0]?.replaceChildren(document.createTextNode(t('voice_label')));
}

// Results are cached per field/photo and language, so switching back to a language is instant
// and the previous content stays on screen (dimmed) while a new translation loads.
const advisoryCache = new Map();
const dxCache = new Map();
let analysisId = 0;
let dxImageId = 0;
let advisoryLang = null;
let langRefreshTimer = null;
const advisoryKey = (lang = currentLanguage) => `${analysisId}|${lang}`;
const dxKey = (lang = currentLanguage) => `${dxImageId}|${$('dx-crop').value}|${lang}`;
const cacheResult = (cache, key, value) => {
  cache.set(key, value);
  if (cache.size > 40) cache.delete(cache.keys().next().value);
};

async function changeLanguage(lang) {
  const refreshAdvisory = Boolean(currentAdvisory) || $('adv-loading').style.display !== 'none';
  const refreshDiagnosis = Boolean(lastDxResult) || $('dx-loading').style.display !== 'none';
  // Invalidate in-flight requests so a late response in the old language is never rendered.
  ++advisoryRequestId;
  ++dxRequestId;
  advisoryAbortController?.abort();
  dxAbortController?.abort();
  currentLanguage = lang;
  document.documentElement.lang = lang;
  try { localStorage.setItem('agrinet_language', lang); } catch (e) { /* storage may be blocked */ }
  stopSpeech();
  updateUI(); // Immediately shift static UI; existing advisory/diagnosis stay visible until replaced.

  // Debounce so flicking through several languages only fetches the one the user settles on.
  clearTimeout(langRefreshTimer);
  langRefreshTimer = setTimeout(() => {
    if (refreshAdvisory && currentFieldState) void regenerateAdvisory();
    if (refreshDiagnosis && $('dx-file').files[0]) void regenerateDx();
  }, 350);
}


// Navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const target = e.currentTarget;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(s => s.classList.remove('active'));
    target.classList.add('active');
    $(target.dataset.target).classList.add('active');
    // Each view opens at its top (e.g. Field Intelligence on the health score) rather than
    // inheriting the scroll offset of the previous view.
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
});

// API Helpers
async function apiPost(url, body, isForm=false, signal=null) {
  const controller = new AbortController();
  const abortRequest = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', abortRequest, { once: true });
  }
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
  const opts = { method: 'POST', body: isForm ? body : JSON.stringify(body), signal: controller.signal };
  if(!isForm) opts.headers = { 'Content-Type': 'application/json' };
  try {
    const r = await fetch(url, opts);
    let j = null;
    try { j = await r.json(); } catch (parseError) { /* non-JSON error page */ }
    if(!r.ok || !j) throw new Error(`${uiText('failed')} ${j?.detail || r.statusText || r.status}`);
    return j;
  } catch (e) {
    if (timedOut) throw new Error(uiText('timeout'));
    throw e;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortRequest);
  }
}

async function apiGet(url) {
  const r = await fetch(url);
  return await r.json();
}

let interopDashboard = null;
let interopCurrentPage = 1;
let interopPageCount = 1;
let interopLastRequest = null;
let interopLoading = false;

async function interopRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? {'Content-Type': 'application/json'} : {}), ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || `Request failed (${response.status})`);
  return body;
}

function interopSetStatus(ok, title, detail) {
  const target = $('interop-health');
  target.classList.toggle('is-error', !ok);
  target.querySelector('strong').textContent = title;
  target.querySelector('small').textContent = detail;
}

function interopOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

function interopResetValidation() {
  $('interop-run').disabled = true;
  $('interop-record-rejection').hidden = true;
  $('interop-validation').hidden = true;
  $('interop-exchange-result').hidden = true;
  $('interop-record-preview').hidden = true;
  interopLastRequest = null;
}

async function interopLoadSourceRecords() {
  interopResetValidation();
  const source = interopDashboard?.participants.find(item => item.id === $('interop-source').value);
  if (!source) return;
  const select = $('interop-record-select');
  select.replaceChildren(interopOption('', 'Loading records…'));
  try {
    const response = await interopRequest(`/api/v1/interoperability/records?state=${encodeURIComponent(source.name)}&page_size=50`);
    const records = response.items.filter(item => item.origin.participant_id === source.id && !item.exchange_id
      && item.resource_type === $('interop-type-select').value);
    records.sort((left, right) => {
      const rank = item => item.record_id === 'obs-pb-draft-002' ? 2 : item.resource_type === 'practice' ? 0 : 1;
      return rank(left) - rank(right);
    });
    select.replaceChildren(...records.map(record => interopOption(record.record_id,
      `${record.resource_type === 'practice' ? 'Practice' : 'Observation'} · ${record.record_id}${record.record_id === 'obs-pb-draft-002' ? ' · intentionally incomplete' : ''}`)));
    if (!records.length) select.replaceChildren(interopOption('', 'No source records available'));
    else await interopShowPreview();
  } catch (error) {
    select.replaceChildren(interopOption('', 'Could not load source records'));
    interopShowPageError(error.message);
  }
}

async function interopShowPreview() {
  interopResetValidation();
  const recordId = $('interop-record-select').value;
  if (!recordId) return;
  try {
    const record = await interopRequest(`/api/v1/interoperability/records/${encodeURIComponent(recordId)}`);
    const payload = record.payload || {};
    const isPractice = record.resource_type === 'practice';
    const body = isPractice ? payload.description : `Indicator: ${payload.evidence?.indicator || '—'} · Value: ${payload.evidence?.value ?? '—'} ${payload.evidence?.unit || ''}`;
    const sourceName = interopDashboard.participants.find(item => item.id === record.origin.participant_id)?.name || record.origin.participant_id;
    $('interop-record-preview').innerHTML = `<h3>Record preview <span class="interop-badge interop-badge-demo">SYNTHETIC</span></h3><div class="interop-preview-meta"><span class="interop-chip">${esc(record.schema_version)} schema</span><span class="interop-chip">${esc(record.resource_type)}</span><span class="interop-chip">Origin: ${esc(sourceName)} · ${esc(record.origin.district)}</span><span class="interop-chip">Created ${esc(record.created_at)}</span></div><p class="interop-preview-body"><strong>${esc(isPractice ? payload.title : payload.evidence?.indicator || 'Observation')}</strong><br>${esc(body)}<br>Source: ${esc(record.provenance?.[0]?.source || 'Missing')} · Record date: ${esc(isPractice ? 'knowledge record' : payload.evidence?.date || 'missing')} · ${esc(record.crop || 'crop unspecified')}</p><details class="interop-mapping-details"><summary>Inspect source payload and provenance</summary><pre class="interop-code">${esc(JSON.stringify(record, null, 2))}</pre></details>`;
    $('interop-record-preview').hidden = false;
  } catch (error) {
    interopShowPageError(error.message);
  }
}

function interopRenderValidation(result) {
  const target = $('interop-validation');
  target.className = `interop-validation ${result.accepted ? 'interop-result-good' : 'interop-result-bad'}`;
  const issues = result.issues?.length ? `<ul class="interop-issue-list">${result.issues.map(issue => `<li>${esc(issue.field ? `${issue.field}: ` : '')}${esc(issue.message)}</li>`).join('')}</ul>` : '<p>No required fields are missing. The shared envelope and source attribution are preserved.</p>';
  const warnings = result.warnings?.length ? `<ul class="interop-warning-list">${result.warnings.map(item => `<li>${esc(item.message)}</li>`).join('')}</ul>` : '';
  const mapping = result.mapping?.length ? `<details class="interop-mapping-details"><summary>Inspect ${result.mapping.length} preserved field mappings</summary><ul>${result.mapping.map(item => `<li><code>${esc(item.source_field)}</code> → <code>${esc(item.destination_field)}</code> (${esc(item.action)})</li>`).join('')}</ul></details>` : '';
  target.innerHTML = `<h3>${result.accepted ? '✓ Schema validation passed' : '⚠ Record needs correction'}</h3>${issues}${warnings}${mapping}`;
  target.hidden = false;
  $('interop-run').disabled = !result.accepted;
  $('interop-record-rejection').hidden = result.accepted;
  $('interop-result-json').textContent = JSON.stringify(result, null, 2);
}

function interopShowPageError(message) {
  const target = $('interop-page-error');
  target.textContent = message;
  target.hidden = false;
  interopSetStatus(false, 'Network data unavailable', 'The backend did not return a successful response.');
}

function interopRenderParticipants(participants) {
  $('interop-participants-list').innerHTML = participants.map(participant => `<article class="interop-participant"><span class="interop-participant-mark">${esc(participant.code)}</span><div><strong>${esc(participant.name)}</strong><small>${esc(participant.sample_city)} · ${esc(participant.agro_zone)}</small></div><span class="interop-status-off">NOT CONNECTED</span></article>`).join('');
  const source = $('interop-source'), destination = $('interop-destination');
  const selectedSource = source.value || 'punjab';
  const selectedDestination = destination.value || 'uttarakhand';
  source.replaceChildren(...participants.map(item => interopOption(item.id, `${item.name} · demo participant`)));
  destination.replaceChildren(...participants.map(item => interopOption(item.id, `${item.name} · demo participant`)));
  source.value = participants.some(item => item.id === selectedSource) ? selectedSource : participants[0]?.id;
  destination.value = participants.some(item => item.id === selectedDestination) ? selectedDestination : participants[1]?.id;
  if (source.value === destination.value && participants.length > 1) destination.value = participants.find(item => item.id !== source.value)?.id;
  const stateFilter = $('interop-filter-state');
  const stateSelected = stateFilter.value;
  stateFilter.replaceChildren(interopOption('', 'All states'), ...participants.map(item => interopOption(item.name, item.name)));
  stateFilter.value = stateSelected;
}

function interopRenderActivity(items) {
  if (!items.length) {
    $('interop-activity').innerHTML = '<li class="interop-empty">No activity yet. Validate a record to begin the exchange walkthrough.</li>';
    return;
  }
  $('interop-activity').innerHTML = items.map(item => `<li class="interop-activity-item"><span class="interop-activity-tag">${esc(item.event_type)} · ${esc(item.status)}</span><strong>${esc(item.summary)}</strong><small>${esc(new Date(item.created_at).toLocaleString())}${item.status === 'demo' ? ' · fixture' : ''}</small></li>`).join('');
}

function interopRenderDashboard(data, health) {
  interopDashboard = data;
  $('interop-page-error').hidden = true;
  const healthy = Boolean(health?.ok && data.system_health?.status === 'operational');
  interopSetStatus(healthy, healthy ? 'AgriNet API online' : 'AgriNet API unavailable',
    `${data.participant_counts.verified_connected} verified external connections · ${data.participant_counts.demo_not_connected} demo participants`);
  $('interop-stat-participants').textContent = data.participant_counts.total;
  $('interop-stat-connected').textContent = `${data.participant_counts.verified_connected} verified · ${data.participant_counts.demo_not_connected} demo only`;
  $('interop-stat-schemas').textContent = data.schema_versions.length;
  $('interop-stat-records').textContent = data.exchangeable_records;
  $('interop-stat-exchanges').textContent = data.exchanges;
  $('interop-stat-accepted').textContent = `Accepted exchanges: ${data.accepted_exchanges}`;
  interopRenderParticipants(data.participants);
  interopRenderActivity(data.recent_activity);
  $('interop-schema-list').innerHTML = data.schema_versions.map(version => `<span class="interop-chip">AgriNet exchange ${esc(version)}</span>`).join('');
  const endpoints = [
    ['GET', '/api/v1/interoperability/dashboard', 'Backend counts and participant state'],
    ['GET', '/api/v1/interoperability/records', 'Filters and pagination'],
    ['GET', '/api/v1/interoperability/records/{record_id}', 'Record detail and provenance'],
    ['GET', '/api/v1/interoperability/practices', 'Shared knowledge discovery'],
    ['POST', '/api/v1/interoperability/validate', 'Schema validation and audit'],
    ['POST', '/api/v1/interoperability/exchanges', 'Validated, recorded exchange'],
    ['POST', '/api/v1/interoperability/reset', 'Clear synthetic demo history']
  ];
  $('interop-endpoints').innerHTML = endpoints.map(item => `<li><span class="interop-method">${item[0]}</span><span><code>${esc(item[1])}</code> — ${esc(item[2])}</span></li>`).join('');
  $('interop-request-example').textContent = JSON.stringify({source_participant_id: 'punjab', destination_participant_id: 'uttarakhand', record_id: 'practice-pb-cover-001', resource_type: 'practice'}, null, 2);
  const cropFilter = $('interop-filter-crop');
  const selectedCrop = cropFilter.value;
  const crops = [...new Set(data.participants.flatMap(item => item.crops))].sort();
  cropFilter.replaceChildren(interopOption('', 'All crops'), ...crops.map(crop => interopOption(crop, crop)));
  cropFilter.value = selectedCrop;
  $('interop-record-select').onchange = () => void interopShowPreview();
  $('interop-source').onchange = () => void interopLoadSourceRecords();
  $('interop-destination').onchange = interopResetValidation;
  if (!$('interop-record-select').value) void interopLoadSourceRecords();
}

async function interopLoadDashboard() {
  try {
    const [data, health] = await Promise.all([
      interopRequest('/api/v1/interoperability/dashboard'),
      interopRequest('/api/health')
    ]);
    interopRenderDashboard(data, health);
    await Promise.all([interopLoadRecords(1), interopLoadPractices(), interopLoadOpenApi()]);
  } catch (error) {
    interopShowPageError(`Could not load interoperability data: ${error.message}`);
    $('interop-participants-list').innerHTML = '<div class="interop-empty">Participant data is unavailable because the backend request failed.</div>';
    $('interop-record-rows').innerHTML = '<tr><td colspan="8" class="interop-empty">Catalogue unavailable. No records are being shown as live.</td></tr>';
  }
}

function interopFiltersQuery(page) {
  const query = new URLSearchParams({page: String(page), page_size: '8'});
  const fields = {q: 'interop-q', state: 'interop-filter-state', district: 'interop-filter-district', crop: 'interop-filter-crop', resource_type: 'interop-filter-type', date_from: 'interop-date-from', date_to: 'interop-date-to'};
  for (const [key, id] of Object.entries(fields)) if ($(id).value.trim()) query.set(key, $(id).value.trim());
  return query.toString();
}

async function interopLoadRecords(page = interopCurrentPage) {
  interopCurrentPage = page;
  try {
    const data = await interopRequest(`/api/v1/interoperability/records?${interopFiltersQuery(page)}`);
    interopPageCount = Math.max(data.pages, 1);
    $('interop-record-count').textContent = data.total ? `Showing ${((page - 1) * data.page_size) + 1}–${Math.min(page * data.page_size, data.total)} of ${data.total} resources` : 'No resources match these filters';
    $('interop-prev').disabled = page <= 1;
    $('interop-next').disabled = page >= data.pages;
    if (!data.items.length) {
      $('interop-record-rows').innerHTML = '<tr><td colspan="8" class="interop-empty">No matching records. Clear a filter or try another search.</td></tr>';
      return;
    }
    $('interop-record-rows').innerHTML = data.items.map(record => {
      const state = record.exchange_status === 'accepted' ? 'EXCHANGED' : record.validation_status === 'needs_validation' ? 'NEEDS VALIDATION' : 'DEMO · READY';
      const badgeClass = record.exchange_status === 'accepted' || record.validation_status === 'ready_for_demo_validation' ? 'interop-badge-neutral' : 'interop-badge-warning';
      const date = record.freshness?.observation_date ? ` · ${esc(record.freshness.observation_date)}` : '';
      return `<tr><td><button type="button" class="interop-record-open" data-record-id="${esc(record.record_id)}">${esc(record.resource_type === 'practice' ? record.payload.title : record.payload.evidence?.indicator || record.record_id)}</button><small style="display:block;color:#89958c;font-size:9px">${esc(record.record_id)}</small></td><td>${esc(record.origin.state)} / ${esc(record.origin.district)}${record.shared_with ? `<small style="display:block;color:#35764d">Shared to ${esc(record.shared_with.name)}</small>` : ''}</td><td>${esc(record.crop || '—')}</td><td>${esc(record.resource_type)}</td><td>${esc(record.source || 'Not attributed')}</td><td>${esc(record.freshness?.label || 'Not reported')}${date}</td><td><span class="interop-chip">${esc(record.schema_version)}</span></td><td><span class="interop-badge ${badgeClass}">${state}</span></td></tr>`;
    }).join('');
    $('interop-record-rows').querySelectorAll('[data-record-id]').forEach(button => button.addEventListener('click', () => void interopOpenRecord(button.dataset.recordId)));
  } catch (error) {
    $('interop-record-count').textContent = `Catalogue error: ${error.message}`;
    $('interop-record-rows').innerHTML = '<tr><td colspan="8" class="interop-empty">Could not load resources. The backend reported an error.</td></tr>';
  }
}

async function interopLoadPractices() {
  try {
    const result = await interopRequest('/api/v1/interoperability/practices');
    $('interop-practices-list').innerHTML = result.items.map(item => `<article class="interop-practice-card"><span class="interop-badge interop-badge-demo">DEMO · POTENTIALLY RELEVANT</span><h3>${esc(item.title)}</h3><p>${esc(item.description)}</p><dl><dt>Origin</dt><dd>${esc(item.origin.state)} · ${esc(item.origin.district)}</dd><dt>Applicable crops</dt><dd>${esc(item.applicable_crops.join(', '))}</dd><dt>Conditions</dt><dd>${esc(item.conditions.join('; '))}</dd><dt>Evidence</dt><dd>${esc(item.supporting_evidence.join('; '))}</dd><dt>Source</dt><dd>${esc(item.source)}</dd><dt>Limitations</dt><dd>${esc(item.limitations.join('; '))}</dd></dl><p><strong>Local status:</strong> Not validated in another state. Check with local extension staff before applying.</p><button class="interop-button interop-button-secondary" type="button" data-practice-id="${esc(item.record_id)}" data-practice-source="${esc(item.origin.participant_id)}">Review for exchange destination</button></article>`).join('');
    $('interop-practices-list').querySelectorAll('[data-practice-id]').forEach(button => button.addEventListener('click', async () => {
      const sourceId = button.dataset.practiceSource;
      if ($('interop-destination').value === sourceId) {
        const other = interopDashboard.participants.find(item => item.id !== sourceId);
        if (other) $('interop-destination').value = other.id;
      }
      $('interop-source').value = sourceId;
      $('interop-type-select').value = 'practice';
      await interopLoadSourceRecords();
      $('interop-record-select').value = button.dataset.practiceId;
      await interopShowPreview();
      interopSelectTab($('interop-tab-records'));
      $('interop-exchange').scrollIntoView({behavior: 'smooth', block: 'center'});
      $('interop-preview').focus();
    }));
  } catch (error) {
    $('interop-practices-list').innerHTML = `<div class="interop-empty">Could not load practice catalogue: ${esc(error.message)}</div>`;
  }
}

async function interopLoadOpenApi() {
  try {
    const spec = await interopRequest('/openapi.json');
    const paths = Object.entries(spec.paths || {}).filter(([path]) => path.startsWith('/api/v1/interoperability/'));
    $('interop-openapi-preview').textContent = JSON.stringify(Object.fromEntries(paths), null, 2);
  } catch (error) {
    $('interop-openapi-preview').textContent = `OpenAPI contract unavailable: ${error.message}`;
  }
}

async function interopOpenRecord(recordId) {
  const dialog = $('interop-record-dialog');
  try {
    const record = await interopRequest(`/api/v1/interoperability/records/${encodeURIComponent(recordId)}`);
    $('interop-dialog-title').textContent = record.resource_type === 'practice' ? record.payload.title : `${record.payload.evidence?.indicator || 'Observation'} · ${record.record_id}`;
    const fields = [['Record identifier', record.record_id], ['Schema version', record.schema_version], ['Resource type', record.resource_type], ['State / district', `${record.origin.state} / ${record.origin.district}`], ['Crop', record.crop], ['Created at', record.created_at], ['Source', record.provenance?.[0]?.source], ['Freshness', record.resource_type === 'observation' ? `Observation date ${record.payload.evidence?.date || 'not provided'}; demo fixture, not a live observation` : 'Knowledge record; no current measurement'], ['Sharing basis', record.sharing?.basis], ['Exchange status', record.exchange_status || 'Source fixture']];
    $('interop-record-detail').innerHTML = `<div class="interop-detail-grid">${fields.map(([label, value]) => `<div class="interop-detail-field"><small>${esc(label)}</small><strong>${esc(value || 'Not supplied')}</strong></div>`).join('')}</div><h3>Provenance</h3><pre class="interop-code">${esc(JSON.stringify(record.provenance, null, 2))}</pre><details class="interop-mapping-details"><summary>View structured record JSON</summary><pre class="interop-code">${esc(JSON.stringify(record, null, 2))}</pre></details>`;
    if (!dialog.open) dialog.showModal();
  } catch (error) {
    interopShowPageError(`Record detail unavailable: ${error.message}`);
  }
}

function initInteroperability() {
  $('interop-jump-exchange').addEventListener('click', () => $('interop-exchange').scrollIntoView({behavior: 'smooth', block: 'center'}));
  $('interop-preview').addEventListener('click', async () => {
    const request = {source_participant_id: $('interop-source').value, destination_participant_id: $('interop-destination').value, resource_type: $('interop-type-select').value, record_id: $('interop-record-select').value};
    if (!request.record_id) return;
    interopLastRequest = request;
    $('interop-preview').disabled = true;
    $('interop-preview').textContent = 'Validating…';
    try {
      const result = await interopRequest('/api/v1/interoperability/validate', {method: 'POST', body: JSON.stringify(request)});
      interopRenderValidation(result);
      await interopRefreshActivity();
    } catch (error) {
      interopShowPageError(`Validation failed: ${error.message}`);
    } finally {
      $('interop-preview').disabled = false;
      $('interop-preview').textContent = 'Preview & validate';
    }
  });
  $('interop-run').addEventListener('click', async () => {
    if (!interopLastRequest || $('interop-run').disabled || interopLoading) return;
    interopLoading = true;
    $('interop-run').disabled = true;
    $('interop-run').textContent = 'Recording exchange…';
    try {
      const result = await interopRequest('/api/v1/interoperability/exchanges', {method: 'POST', body: JSON.stringify(interopLastRequest)});
      $('interop-result-json').textContent = JSON.stringify(result, null, 2);
      const target = $('interop-exchange-result');
      target.className = `interop-exchange-result ${result.accepted ? 'interop-result-good' : 'interop-result-bad'}`;
      target.innerHTML = result.accepted ? `<h3>✓ Exchange recorded</h3><p>${esc(result.source.name)} → ${esc(result.destination.name)}</p><p>Destination record: <code>${esc(result.exchange_record_id)}</code></p><p>Source attribution preserved: ${result.provenance_preserved ? 'Yes' : 'No'}</p>${result.warnings?.length ? `<ul class="interop-warning-list">${result.warnings.map(item => `<li>${esc(item.message)}</li>`).join('')}</ul>` : ''}` : `<h3>Exchange rejected</h3><ul class="interop-issue-list">${result.issues.map(item => `<li>${esc(item.message)}</li>`).join('')}</ul>`;
      target.hidden = false;
      interopSetStatus(true, 'AgriNet API online', result.accepted ? 'Demo exchange was recorded by the backend.' : 'The backend rejected this invalid record.');
      await interopReloadAll();
    } catch (error) {
      const target = $('interop-exchange-result');
      target.className = 'interop-exchange-result interop-result-bad';
      target.textContent = `Exchange was not reported as successful: ${error.message}`;
      target.hidden = false;
      interopSetStatus(false, 'Exchange failed', error.message);
    } finally {
      interopLoading = false;
      $('interop-run').textContent = 'Start exchange';
      $('interop-run').disabled = !interopLastRequest;
    }
  });
  $('interop-record-rejection').addEventListener('click', async () => {
    if (!interopLastRequest || interopLoading) return;
    interopLoading = true;
    $('interop-record-rejection').disabled = true;
    try {
      const result = await interopRequest('/api/v1/interoperability/exchanges', {method: 'POST', body: JSON.stringify(interopLastRequest)});
      $('interop-result-json').textContent = JSON.stringify(result, null, 2);
      const target = $('interop-exchange-result');
      target.className = 'interop-exchange-result interop-result-bad';
      target.innerHTML = `<h3>Backend rejected this exchange</h3><p>Attempt ${esc(result.exchange_id)} was recorded as rejected. No destination record was created.</p><ul class="interop-issue-list">${(result.issues || []).map(item => `<li>${esc(item.message)}</li>`).join('')}</ul>`;
      target.hidden = false;
      await interopReloadAll();
      $('interop-exchange-result').className = 'interop-exchange-result interop-result-bad';
      $('interop-exchange-result').innerHTML = `<h3>Backend rejected this exchange</h3><p>Attempt ${esc(result.exchange_id)} was recorded as rejected. No destination record was created.</p><ul class="interop-issue-list">${(result.issues || []).map(item => `<li>${esc(item.message)}</li>`).join('')}</ul>`;
      $('interop-exchange-result').hidden = false;
    } catch (error) {
      const target = $('interop-exchange-result');
      target.className = 'interop-exchange-result interop-result-bad';
      target.textContent = `Rejected attempt could not be recorded: ${error.message}`;
      target.hidden = false;
    } finally {
      interopLoading = false;
      $('interop-record-rejection').disabled = false;
    }
  });
  $('interop-filter-form').addEventListener('submit', event => { event.preventDefault(); void interopLoadRecords(1); });
  $('interop-prev').addEventListener('click', () => { if (interopCurrentPage > 1) void interopLoadRecords(interopCurrentPage - 1); });
  $('interop-next').addEventListener('click', () => { if (interopCurrentPage < interopPageCount) void interopLoadRecords(interopCurrentPage + 1); });
  $('interop-reset').addEventListener('click', async () => {
    if (!window.confirm('Reset the synthetic demonstration exchange history? This does not affect farmer or field data.')) return;
    try {
      await interopRequest('/api/v1/interoperability/reset', {method: 'POST', body: JSON.stringify({confirmation: 'RESET DEMO'})});
      interopResetValidation();
      $('interop-exchange-result').hidden = true;
      await interopReloadAll();
    } catch (error) { interopShowPageError(`Demo reset failed: ${error.message}`); }
  });
  $('interop-dialog-close').addEventListener('click', () => $('interop-record-dialog').close());
  $('interop-record-dialog').addEventListener('click', event => { if (event.target === $('interop-record-dialog')) $('interop-record-dialog').close(); });
  document.querySelectorAll('.interop-tab').forEach((tab, index, tabs) => {
    tab.addEventListener('click', () => interopSelectTab(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      tabs[next].focus();
      interopSelectTab(tabs[next]);
    });
  });
  $('interop-source').addEventListener('change', interopResetValidation);
  $('interop-destination').addEventListener('change', interopResetValidation);
  $('interop-record-select').addEventListener('change', interopResetValidation);
  $('interop-type-select').addEventListener('change', () => void interopLoadSourceRecords());
  void interopLoadDashboard();
}

function interopSelectTab(tab) {
  document.querySelectorAll('.interop-tab').forEach(item => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    $(item.getAttribute('aria-controls')).hidden = !selected;
  });
}

async function interopRefreshActivity() {
  const response = await interopRequest('/api/v1/interoperability/dashboard');
  interopDashboard = response;
  $('interop-stat-exchanges').textContent = response.exchanges;
  $('interop-stat-accepted').textContent = `Accepted exchanges: ${response.accepted_exchanges}`;
  interopRenderActivity(response.recent_activity);
}

async function interopReloadAll() {
  const [dashboard, health] = await Promise.all([interopRequest('/api/v1/interoperability/dashboard'), interopRequest('/api/health')]);
  interopRenderDashboard(dashboard, health);
  await Promise.all([interopLoadRecords(1), interopLoadPractices()]);
}

function buildWhy(r, btnText) {
  if(!r.evidence_ids || !r.evidence_ids.length) return '';
  return `
    <button class="why-toggle" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
      <span>${esc(btnText || 'WHY?')}</span> <span>▾</span>
    </button>
    <div class="why-content">
      ${esc(r.reason)}
      <div style="margin-top:8px">
        ${r.evidence_ids.map(id => `<span class="evidence-tag">${esc(id)}</span>`).join('')}
      </div>
    </div>
  `;
}

// App Initialization
async function init() {
  try {
        const hc = await apiGet('/api/health');
    $('sys-status').innerHTML = `
      <div style="width:8px;height:8px;border-radius:50%;background:var(--health-good)"></div>
      ${esc(window.t('apiOnline'))} | ${hc.ai_configured ? esc(window.t('aiConnected')) : esc(window.t('aiOffline'))}
    `;

    currentScenarios = await apiGet('/api/scenarios');
    renderScenarios();

  } catch (e) {
        $('sys-status').innerHTML = `<span style="color:var(--health-poor)">${window.t('sysError')} ${e.message}</span>`;
  }
}

// Run Analysis
async function runScenario(key, lat, lon) {
  place(lat, lon);
  map.setView([lat, lon], 10);
  await analyzeField({ lat, lon, scenario_key: key, is_demo: true });
}

$('btn-analyze').onclick = async () => {
  if(!pin) return showNotice(uiText('tapMapFirst'), 'info');
  const {lat, lng} = pin.getLatLng();
  const lon = normalizeLongitude(lng);
  await analyzeField({ lat, lon, crop: $('crop-input').value, is_demo: false });
};

async function analyzeField(req) {
  req.lang = currentLanguage;
  ++advisoryRequestId;
  advisoryAbortController?.abort();
  currentAdvisory = null;
  $('btn-analyze').disabled = true;
    $('btn-analyze').textContent = window.t('analyzingBtn');
  
  try {
    currentAnalysisResponse = await apiPost('/api/v1/analyze', req);
    currentFieldState = currentAnalysisResponse.field_state;
    // Wipe advisory on new field
    ++analysisId;
    currentAdvisory = null;
    advisoryLang = null;
    stopSpeech();
    $('adv-loading').style.display = 'none';
    $('adv-content').style.display = 'none';
    resetAdvisoryEmpty();

    renderField(currentAnalysisResponse);
    document.querySelector('[data-target="view-field"]').click();
  } catch(e) {
    showNotice(e.message);
  } finally {
    $('btn-analyze').disabled = false;
    $('btn-analyze').textContent = window.t('analyzeBtn');
  }
}

// Units that are English words get a language-neutral form; numeric units (mm, °C, g/kg) pass through.
const EVIDENCE_UNIT_DISPLAY = {'index (0–1)': '(0–1)', 'index (-1 to 1)': '(−1 – 1)', 'class': ''};

function localizeLandCover(value) {
  const key = `lc_class_${String(value ?? '').toLowerCase().replaceAll(' ', '_')}`;
  const result = window.t(key);
  return result !== key ? result : value;
}

function localizeDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try { return date.toLocaleDateString(`${currentLanguage}-IN`, {day: 'numeric', month: 'long', year: 'numeric'}); }
  catch (error) { return value; }
}

function renderField(res) {
    const fs = res.field_state;
  const evidence = res.evidence;
  const provenance = res.provenance;
  
  $('field-empty').style.display = 'none';
  $('field-content').style.display = 'block';
  if (!currentAdvisory) $('adv-empty').style.display = 'block';
  
  const v = provenance.satellite_badge;
  let bClass = v==='LIVE'?'badge-live':v==='MODEL'?'badge-model':v==='DEMO'?'badge-demo':'badge-err';
  $('f-badge-mode').className = `badge ${bClass}`;
  
  if (provenance.data_status === 'DEMO' && provenance.scenario_date) {
    $('f-badge-mode').textContent = `${window.t('demoBadge')} · ${window.t('historicalSnapshot') || 'Historical snapshot'} · ${localizeDate(provenance.scenario_date)}`;
  } else {
    $('f-badge-mode').textContent = String(v).toLowerCase() === 'precomputed' ? window.t('precomputedBadge') : window.t(String(v).toLowerCase() + 'Badge');
  }
  
  $('f-geohash').textContent = `${window.t('geohash')} ${fs.field.geohash}`;
  $('f-location').textContent = `${fs.field.lat.toFixed(4)}, ${fs.field.lon.toFixed(4)}`;
  $('f-crop').textContent = fs.field.crop ? `${window.t('declaredCrop')} ${window.localizePlace(fs.field.crop)}` : window.t('unknownCrop');

  const noLand = isNoLand(fs);
  $('btn-gen-adv').disabled = noLand;
  $('btn-gen-adv').title = noLand ? noLandText(1) : '';

  const h = fs.health;
  const ring = $('f-health-ring');
  // Drives the conic progress arc on the gauge (0 when there is no score).
  ring.style.setProperty('--score', !noLand && h.score !== null ? h.score : 0);
  if (noLand) {
    ring.dataset.status = 'no_land';
    $('f-health-score').textContent = '--';
    $('f-health-status').textContent = noLandText(0);
    $('f-health-status').style.color = 'var(--text-muted)';
    $('f-health-comps').innerHTML = `<p class="dp-label" style="text-align:center;">${esc(noLandText(1))}</p>`;
  } else if(h.score !== null) {
    ring.dataset.status = h.status;
    $('f-health-score').textContent = h.score;
    $('f-health-status').textContent = window.t('status_' + h.status) || h.status.toUpperCase();
    $('f-health-status').style.color = ring.dataset.status === 'healthy' ? 'var(--health-good)' : ring.dataset.status === 'watch' ? 'var(--health-watch)' : 'var(--health-poor)';
    
    $('f-health-comps').innerHTML = Object.entries(h.components).map(([k,val]) => `
      <div class="data-point">
        <span class="dp-label" style="text-transform:capitalize">${window.t('health_' + k) || k}</span>
        <span class="dp-val">${val ?? '--'}</span>
      </div>
    `).join('');
  } else {
    ring.dataset.status = 'unavailable';
    $('f-health-score').textContent = '--';
    $('f-health-status').textContent = window.t('status_unknown') || 'UNAVAILABLE';
    $('f-health-status').style.color = 'var(--text-muted)';
    $('f-health-comps').innerHTML = fs.land_cover?.source === 'none'
      ? `<p class="dp-label" style="text-align:center;">${esc(uiText('noSatellite'))}</p>` : '';
  }

  $('f-evidence-list').innerHTML = evidence.map(e => {
    const ebadge = e.badge || 'UNAVAILABLE';
    const bClass = ebadge==='LIVE'?'badge-live':ebadge==='MODEL'?'badge-model':ebadge==='DEMO'?'badge-demo':'badge-pre';
    let localBadge = String(ebadge).toLowerCase() === 'precomputed' ? window.t('precomputedBadge') : window.t(String(ebadge).toLowerCase() + 'Badge');
    
    let localIndicator = window.t(e.indicator_key) || e.indicator;
    // Display-only localization; the evidence record itself is left untouched.
    const localValue = e.unit === 'class' ? localizeLandCover(e.value) : e.value;
    const localUnit = EVIDENCE_UNIT_DISPLAY[e.unit] ?? e.unit;
    let localInterpretation = e.interpretation_key ? window.t(e.interpretation_key, {val: String(localValue)}) : e.interpretation;
    
    return `
    <div style="padding: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; margin-bottom: 8px;">
      <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
        <code style="font-size:11px; color:var(--text-muted);">${e.id}</code>
        <span class="badge ${bClass}">${localBadge}</span>
      </div>
      <div style="font-weight:600; font-size:14px;">${esc(localIndicator)}: ${esc(localValue)} ${esc(localUnit)}</div>
      <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">${esc(localInterpretation)}</div>
      <div style="font-size:11px; color:var(--text-light); margin-top:4px;">${window.t('source')} ${esc(e.source)}</div>
    </div>
  `}).join('');
}

// AI Advisory
$('btn-gen-adv').onclick = async () => {
  if(!currentFieldState) return;
  document.querySelector('[data-target="view-advisory"]').click();
  await regenerateAdvisory();
};

function resetAdvisoryEmpty() {
  $('adv-empty').innerHTML = `<span data-i18n="advEmpty">${esc(window.t('advEmpty'))}</span>`;
  $('adv-empty').style.display = 'block';
}

async function regenerateAdvisory() {
   if (isNoLand(currentFieldState)) {
     ++advisoryRequestId;
     advisoryAbortController?.abort();
     currentAdvisory = null;
     $('adv-loading').style.display = 'none';
     $('adv-empty').textContent = `${noLandText(0)} — ${noLandText(1)}`;
     $('adv-empty').style.display = 'block';
     $('adv-content').style.display = 'none';
     return;
   }
   const expectedReqId = ++advisoryRequestId;
   advisoryAbortController?.abort();
   advisoryAbortController = new AbortController();
   const requestLang = currentLanguage;
   const cacheKey = advisoryKey(requestLang);

   $('adv-empty').style.display = 'none';

   const cached = advisoryCache.get(cacheKey);
   if (cached) {
      currentAdvisory = cached;
      advisoryLang = requestLang;
      $('adv-loading').style.display = 'none';
      $('adv-content').style.opacity = '1';
      renderAdvisory(cached);
      return;
   }

   // Check if we are updating an existing advisory or generating new
   if (currentAdvisory) {
      $('adv-loading').innerHTML = `<div class="loader" style="width:40px;height:40px;margin-bottom:20px;"></div><p style="color:var(--text-muted); margin-top:8px;">${esc(uiText('updatingAdvisory'))}</p>`;
      $('adv-content').style.opacity = '0.5';
   } else {
      $('adv-loading').innerHTML = `<div class="loader" style="width:40px;height:40px;margin-bottom:20px;"></div><h3 style="font-family:var(--font-display);">${window.t('advLoadingTitle')}</h3><p style="color:var(--text-muted); margin-top:8px;">${window.t('advLoadingDesc')}</p>`;
      $('adv-content').style.display = 'none';
   }
   
   $('adv-loading').style.display = 'block';
   
   try {
    const adv = await apiPost('/api/v1/advisory', {
      field_state: currentAnalysisResponse.field_state,
      evidence: currentAnalysisResponse.evidence,
      lang: requestLang
    }, false, advisoryAbortController.signal);

    if (expectedReqId !== advisoryRequestId) return; // Stale protection
    // Only cache real advisories; offline/timeout fallbacks carry no structured sections.
    if (adv.field_status || adv.what_the_data_shows) cacheResult(advisoryCache, cacheKey, adv);
    currentAdvisory = adv;
    advisoryLang = requestLang;

    renderAdvisory(currentAdvisory);
  } catch(e) {
    if (expectedReqId !== advisoryRequestId) return;
    showNotice(e.message);
    if (!currentAdvisory) resetAdvisoryEmpty();
  } finally {
    if (expectedReqId === advisoryRequestId) {
       $('adv-loading').style.display = 'none';
       $('adv-content').style.opacity = '1';
    }
  }
}


function renderAdvisory(a) {
  $('adv-content').style.display = 'block';
  $('btn-speak').disabled = false;
  
  const buildSec = (titleKey, contentHtml, isCollapsible=false) => {
      if(!contentHtml) return '';
      const title = esc(window.t(titleKey));
      if(isCollapsible) {
         return `<details style="margin-bottom:12px; padding:12px; background:#f9fafb; border: 1px solid var(--border); border-radius:6px; cursor:pointer;">
           <summary style="font-weight:600; color:var(--primary); font-size:14px;">${title}</summary>
           <div style="margin-top:12px; font-size:14px;">${contentHtml}</div>
         </details>`;
      }
      return `<div style="margin-bottom:24px;">
         <h3 class="card-title" style="margin-bottom:12px; font-size:16px;">${title}</h3>
         ${contentHtml}
      </div>`;
  };

  const safeMap = (arr, fn) => {
      if(!arr || !arr.length) return `<p class="dp-label">${window.t('adv_no_data')}</p>`;
      return arr.map(fn).join('');
  };

  const evidMap = (arr) => arr?.length ? `<div style="margin-top:6px;">${arr.map(id => `<span class="evidence-tag" style="font-size:11px; margin-right:4px;">${id}</span>`).join('')}</div>` : '';

  let html = '';
  
  // Field Status
  html += buildSec('sec_field_status', `
     <p style="font-weight:600; margin-bottom:4px; font-size: 16px;">${esc(window.localizeEnum(a.field_status?.status, 'status') || '')}</p>
     <p>${esc(a.field_status?.explanation || '')}</p>
  `, false);
  
  // What Data Shows
  html += buildSec('sec_what_data_shows', safeMap(a.what_the_data_shows, r => `
    <div style="padding:12px; border-bottom:1px solid #eee;">
      <div style="font-weight:500;">${esc(r.observation)}</div>
      <div style="font-size:13px; color:#666; margin-top:2px;">${esc(r.importance)}</div>
      ${r.evidence_id ? evidMap([r.evidence_id]) : ''}
    </div>
  `));
  
  // Risks
  html += buildSec('sec_priority_risks', safeMap(a.priority_risks, r => `
    <div style="padding:12px; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; margin-bottom:8px;">
      <div style="font-weight:600; color:#991b1b; font-size:14px;">${esc(r.risk)} <span class="badge badge-err" style="float:right">${esc(window.localizeEnum(r.severity, 'severity'))}</span></div>
      <p style="margin-top:4px;">${esc(r.why_it_matters)}</p>
      ${evidMap(r.evidence_ids)}
    </div>
  `));
  
  // Immediate Actions
  html += buildSec('sec_immediate_actions', safeMap(a.immediate_actions, r => `
    <div style="padding:12px; background:var(--bg); border:1px solid var(--border); border-radius:6px; margin-bottom:8px; border-left: 4px solid var(--primary);">
       <div style="font-weight:600; font-size:14px;">${esc(r.action)} <span class="badge badge-live" style="float:right">${esc(window.localizeEnum(r.timing, "priority"))}</span></div>
       <p style="margin-top:8px;">${esc(r.reason)}</p>
    </div>
  `));
  
  // Weather Responses
  html += buildSec('sec_weather_response', safeMap(a.weather_response, r => `
    <div style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:8px;">
       <div style="font-weight:600;">${esc(r.condition)}</div>
       <div>${esc(r.action)} <span style="font-size:12px; color:#666;">(${esc(r.timing)})</span></div>
    </div>
  `), true);
  
  // Soil Management
  html += buildSec('sec_soil_management', safeMap(a.soil_management, r => `
    <div style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:8px;">
       <div style="font-weight:600;">${esc(r.action)}</div>
       <div>${esc(r.reason)} <span style="font-size:12px; color:#666;">(${esc(r.timing)})</span></div>
    </div>
  `), true);
  
  // Crop Management
  html += buildSec('sec_crop_management', safeMap(a.crop_management, r => `
    <div style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:8px;">
       <div style="font-weight:600;">${esc(r.action)}</div>
       <div>${esc(r.reason)}</div>
    </div>
  `), true);

  // Regen Actions
  html += buildSec('sec_regen_actions', safeMap(a.regenerative_actions, r => `
    <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #eee;">
       <div style="font-weight:600;">🌱 ${esc(r.practice)}</div>
       <p style="font-size: 13px; margin-top:2px;">${esc(r.how_to_apply)}</p>
       <div style="font-size:12px; color:#666; margin-top:2px;">${esc(window.t('adv_benefit'))}: ${esc(r.benefit)} | ${esc(window.t('adv_timing'))}: ${esc(r.timing)}</div>
    </div>
  `), true);

  // Crop Options
  html += buildSec('sec_crop_options', safeMap(a.crop_options, r => `
    <div style="margin-bottom:8px; border-bottom:1px solid #eee; padding-bottom:8px;">
       <div style="font-weight:600;">${esc(r.crop)} <span class="badge ${String(r.suitability).toLowerCase()==='high'?'badge-live':'badge-model'}">${esc(window.localizeEnum(r.suitability, 'suitability'))}</span></div>
       <div style="margin-top:2px; font-size:13px;">${esc(r.reason)}</div>
       <div style="font-size:12px; color:#666; margin-top:2px;">${esc(window.t('adv_conditions'))}: ${esc(r.conditions)}</div>
    </div>
  `), true);
  
  // Monitoring Plan
  html += buildSec('sec_monitoring_plan', safeMap(a.monitoring_plan, r => `
    <div style="margin-bottom:8px; padding-bottom:8px;">
       <div><strong style="color:var(--text-main)">${esc(r.indicator)}</strong>: ${esc(r.what_to_watch)}</div>
       <div style="font-size:12px; color:#666; margin-top:2px;">${esc(window.t('adv_check'))}: ${esc(r.when_to_check)}</div>
       <div style="font-size:13px; color:#991b1b; margin-top:2px;">${esc(window.t('adv_if_occurs'))}: ${esc(r.action_if_condition_occurs)}</div>
    </div>
  `), true);
  
  // Why this advice matches
  html += buildSec('sec_why_advice', safeMap(a.why_this_advice, r => `
    <div style="margin-bottom:8px; padding:12px; background:#f0f9ff; border:1px solid #bae6fd; border-radius:6px;">
       <div style="font-weight:500;">${esc(r.recommendation)}</div>
       <p style="margin-top:4px; font-size:13px;">${esc(r.reasoning)}</p>
       ${evidMap(r.evidence_ids)}
    </div>
  `), true);

  const container = $('adv-content');
  container.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 24px;">
        <h2 class="card-title" style="font-size: 22px; color: var(--primary);">${esc(window.t('localizedAdvisory'))}</h2>
        <button class="btn btn-secondary" id="btn-speak">${esc(window.t('listen'))}</button>
      </div>`;
  
  container.innerHTML += `<p style="font-size:16px; margin-bottom: 24px;">${esc(a.summary || '')}</p>`;
  
  const dynBox = document.createElement('div');
  dynBox.innerHTML = html;
  
  // Meta block
  const meta = document.createElement('div');
  meta.style.marginTop = '24px';
  meta.style.padding = '12px';
  meta.style.background = '#f3f4f6';
  meta.style.borderRadius = 'var(--radius-sm)';
  meta.style.fontSize = '13px';
  meta.innerHTML = `<strong style="color:#b45309;"><span data-i18n="sec_when_expert">${esc(window.t('sec_when_expert'))}</span>:</strong> <span>${esc(a.when_to_seek_expert_help || '')}</span><br>
  <strong style="color:var(--text-main); margin-top:8px; display:inline-block;"><span data-i18n="sec_confidence">${esc(window.t('sec_confidence'))}</span>:</strong> <span>${esc(a.confidence_note || '')}</span>`;
  
  dynBox.appendChild(meta);
  container.appendChild(dynBox);

  $('btn-speak').onclick = speakAdvisory;
  updateSpeakButton();
}

// Voice
const VOICE = {en:'en-IN',hi:'hi-IN',ta:'ta-IN',te:'te-IN',bn:'bn-IN',mr:'mr-IN',pa:'pa-IN',gu:'gu-IN',kn:'kn-IN',ml:'ml-IN'};
// Enum-like or ID fields that should not be read aloud (they are codes, not sentences).
const SILENT_ADVISORY_KEYS = new Set(['evidence_id', 'evidence_ids', 'severity', 'priority', 'suitability', 'status', '_raw']);
let speechSession = 0;

function updateSpeakButton() {
  const btn = $('btn-speak');
  if (!btn) return;
  btn.textContent = speechSession ? uiText('stop') : window.t('listen');
}

function stopSpeech() {
  speechSession = 0;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  updateSpeakButton();
}

// Chrome fills the voice list asynchronously; wait briefly for it instead of picking from an empty list.
function loadVoices() {
  const voices = speechSynthesis.getVoices();
  if (voices.length) return Promise.resolve(voices);
  return new Promise(resolve => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1200);
  });
}

async function speakAdvisory() {
  if (!('speechSynthesis' in window)) return;
  if (speechSession) return stopSpeech();
  if (!currentAdvisory) return;
  const collect = (value, key = '') => SILENT_ADVISORY_KEYS.has(key) ? []
    : Array.isArray(value) ? value.flatMap(v => collect(v))
    : value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => collect(v, k))
    : typeof value === 'string' && value.trim() ? [value.trim()] : [];
  const payload = collect(currentAdvisory).join('. ').trim();
  if (!payload) return;

  stopSpeech();
  const session = speechSession = Date.now();
  // Speak in the language the advisory was written in, even if a translation is still loading.
  const lang = advisoryLang || currentLanguage;
  const voices = await loadVoices();
  if (session !== speechSession) return;
  const voice = voices.find(v => v.lang.toLowerCase().replace('_', '-') === VOICE[lang]?.toLowerCase())
    || voices.find(v => v.lang.toLowerCase().startsWith(lang));
  if (!voice && lang !== 'en') showNotice(uiText('noVoice'), 'info');

  const chunks = payload.match(/[^.!?।]+[.!?।]*/g) || [payload];
  const parts = [];
  let pending = '';
  for (const sentence of chunks) {
    if (pending.length + sentence.length > 220 && pending) {
      parts.push(pending);
      pending = '';
    }
    pending += `${sentence} `;
  }
  if (pending.trim()) parts.push(pending);
  // Chrome can drop an utterance queued in the same tick as cancel(); give it a moment.
  setTimeout(() => {
    if (session !== speechSession) return;
    parts.forEach((text, i) => queueSpeech(text, voice, lang, session, i === parts.length - 1));
    updateSpeakButton();
  }, 60);
}

function queueSpeech(text, voice, lang, session, isLast) {
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = VOICE[lang] || 'en-IN';
  if (voice) utterance.voice = voice;
  const finish = () => {
    if (session === speechSession && (isLast || !speechSynthesis.speaking)) {
      speechSession = 0;
      updateSpeakButton();
    }
  };
  if (isLast) utterance.onend = finish;
  utterance.onerror = finish;
  speechSynthesis.speak(utterance);
}

// Crop Doctor
let optimizedDxImage = null; // { id, file } — re-encoded once per photo, reused on language switches
$('dx-drop').onclick = () => $('dx-file').click();
// The drop zone invites dropping an image; hand dropped files to the same input/change path as clicks.
$('dx-drop').addEventListener('dragover', e => { e.preventDefault(); $('dx-drop').classList.add('is-dragover'); });
$('dx-drop').addEventListener('dragleave', () => $('dx-drop').classList.remove('is-dragover'));
$('dx-drop').addEventListener('drop', e => {
  e.preventDefault();
  $('dx-drop').classList.remove('is-dragover');
  const file = [...(e.dataTransfer?.files || [])].find(item => item.type.startsWith('image/'));
  if (!file) return showNotice(uiText('choosePhoto'), 'info');
  const transfer = new DataTransfer();
  transfer.items.add(file);
  $('dx-file').files = transfer.files;
  $('dx-file').dispatchEvent(new Event('change'));
});
$('dx-file').onchange = (e) => {
  if(e.target.files[0]) {
    $('dx-preview').src = URL.createObjectURL(e.target.files[0]);
    $('dx-preview').style.display = 'block';
    // Remove previous result context when image changes
    ++dxImageId;
    ++dxRequestId;
    dxAbortController?.abort();
    optimizedDxImage = null;
    lastDxResult = null;
    $('dx-loading').style.display = 'none';
    $('btn-dx').disabled = false;
    $('dx-res').style.display = 'none';
    if (voiceAutoDiagnosePhoto) {
      voiceAutoDiagnosePhoto = false;
      voicePhotoAssessing = true;
      voiceTranscript('You', 'Crop photo selected');
      voiceStatus(currentLanguage === 'hi' ? 'फोटो मिल गई। जाँच शुरू हो रही है।' : 'Photo received. Starting the image assessment.');
      setTimeout(async () => {
        await regenerateDx();
        if (lastDxResult) {
          const d = lastDxResult;
          if (d._raw || /unavailable|could not|temporarily/i.test(String(d.diagnosis || ''))) {
            const unavailable = currentLanguage === 'hi'
              ? 'फोटो से कोई निष्कर्ष नहीं मिला क्योंकि फोटो विश्लेषण सेवा उपलब्ध नहीं है। यह फोटो की समस्या का प्रमाण नहीं है। कृपया फिर कोशिश करें या स्थानीय कृषि विशेषज्ञ से जाँच कराएँ।'
              : 'I could not assess this photo because the image diagnosis service is unavailable. This is not a finding about your crop. Please try again later or ask a local agricultural expert.';
            voiceTranscript('AgriNet', unavailable);
            voicePhotoAssessing = false;
            voiceSpeak(unavailable);
            return;
          }
          const spoken = currentLanguage === 'hi'
            ? `फोटो में ${d.likely_issue || d.diagnosis || 'एक संभावित समस्या'} दिख रही है। यह फोटो पर आधारित शुरुआती आकलन है, पक्की पुष्टि नहीं। अगला कदम: ${(d.recommended_action || []).join('. ') || d.expert_escalation || 'खेत में लक्षणों की जाँच करें।'}`
            : `The photo may show ${d.likely_issue || d.diagnosis || 'a crop issue'}. This is an image-based assessment, not a confirmed diagnosis. Next step: ${(d.recommended_action || []).join('. ') || d.expert_escalation || 'Inspect the crop in the field.'}`;
          voiceTranscript('AgriNet', spoken);
          voicePhotoAssessing = false;
          voiceSpeak(spoken);
        } else {
          const failed = currentLanguage === 'hi' ? 'फोटो का आकलन पूरा नहीं हुआ। कृपया फिर कोशिश करें या खेत विशेषज्ञ से दिखाएँ।' : 'The photo assessment did not complete. Please try again or ask a local field expert.';
          voiceTranscript('AgriNet', failed);
          voicePhotoAssessing = false;
          voiceSpeak(failed);
        }
      }, 0);
    }
  }
};

$('btn-dx').onclick = async () => {
  if(!$('dx-file').files[0]) return showNotice(uiText('choosePhoto'), 'info');
  await regenerateDx();
};

async function regenerateDx() {
  const expectedReqId = ++dxRequestId;
  dxAbortController?.abort();
  dxAbortController = new AbortController();
  const f = $('dx-file').files[0];
  const requestLang = currentLanguage;
  const cacheKey = dxKey(requestLang);

  $('dx-empty').style.display = 'none';
  const cached = dxCache.get(cacheKey);
  if (cached) {
    lastDxResult = cached;
    $('dx-loading').style.display = 'none';
    $('dx-res').style.opacity = '1';
    $('btn-dx').disabled = false;
    renderDx(cached);
    return;
  }

  if (lastDxResult) {
       $('dx-loading').innerHTML = `<div class="loader"></div><p style="margin-top:12px;">${esc(uiText('updatingDx'))}</p>`;
       $('dx-res').style.opacity = '0.5';
  } else {
       $('dx-loading').innerHTML = `<div class="loader"></div><p style="margin-top:12px;">${esc(window.t('dxLoading'))}</p>`;
       $('dx-res').style.display = 'none';
  }
  
  $('dx-loading').style.display = 'block';
  $('btn-dx').disabled = true;
  
  try {
    const fd = new FormData();
    const imageId = dxImageId;
    if (optimizedDxImage?.id !== imageId) optimizedDxImage = { id: imageId, file: await optimizeDiagnosisImage(f) };
    if (expectedReqId !== dxRequestId) return;
    fd.append('image', optimizedDxImage.file);
    fd.append('lang', requestLang);
    fd.append('crop', $('dx-crop').value);
    // Only the fields the diagnosis prompt uses; the full field state (series, evidence) just bloats the upload.
    if (currentFieldState) fd.append('field_context_json', JSON.stringify({
      land_cover: { class: currentFieldState.land_cover?.class, is_cropland: currentFieldState.land_cover?.is_cropland },
      vegetation: { ndvi: currentFieldState.vegetation?.ndvi, ndwi: currentFieldState.vegetation?.ndwi },
    }));
    const d = await apiPost('/api/v1/diagnose', fd, true, dxAbortController.signal);
    if (expectedReqId !== dxRequestId) return; 
    
    if (d.diagnosis && d.confidence && !d._raw) cacheResult(dxCache, cacheKey, d);
    lastDxResult = d;
    renderDx(d);
    
  } catch(e) {
    if (expectedReqId !== dxRequestId) return; 
    showNotice(e.message);
    if(!lastDxResult) $('dx-empty').style.display = 'block';
  } finally {
    if (expectedReqId === dxRequestId) {
       $('dx-loading').style.display = 'none';
       $('dx-res').style.opacity = '1';
       $('btn-dx').disabled = false;
    }
  }
}

// Phone photos are often 3–12 MB; a 1280 px JPEG is plenty for leaf symptoms and uploads and
// processes several times faster. Formats the browser cannot decode (e.g. HEIC on Chrome) are
// sent unchanged and identified server-side.
const DX_MAX_EDGE = 1280;
async function optimizeDiagnosisImage(file) {
  if (!window.createImageBitmap) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, DX_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000 && ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black as JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'crop-photo.jpg', { type: 'image/jpeg' }) : file;
  } catch (error) {
    return file;
  }
}

function renderDx(d) {
    $('dx-badge').className = `badge ${d.healthy ? 'badge-live' : 'badge-err'}`;
    $('dx-badge').textContent = d.healthy ? (window.t('status_healthy') || 'HEALTHY') : (window.t('status_issue') || 'ISSUE DETECTED');
    $('dx-conf').textContent = `${window.t('dx_conf') || 'Conf:'} ${window.localizeEnum(d.confidence, 'confidence').toUpperCase()}`;
    
    $('dx-issue').textContent = d.likely_issue;
    $('dx-diag').textContent = d.diagnosis;
    
    const list = (arr) => arr?.length ? arr.join(', ') : window.t('dx_none');
  $('dx-sym').textContent = list(d.observed_symptoms);
    $('dx-act').textContent = list(d.recommended_action);
    $('dx-exp').textContent = d.expert_escalation || (window.t('dx_monitor') || 'Monitor closely.');
    
    $('dx-res').style.display = 'block';
}


function handleManualCoord() {
    let lat = parseFloat($('lat-input').value);
    let lon = parseFloat($('lon-input').value);
    if (!isNaN(lat) && !isNaN(lon)) {
        lon = normalizeLongitude(lon);
        if(pin) map.removeLayer(pin);
        pin = L.marker([lat, lon]).addTo(map);
        $('pin-coords').textContent = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        map.setView([lat, lon]);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    if ($('lat-input')) $('lat-input').addEventListener('change', handleManualCoord);
    if ($('lon-input')) $('lon-input').addEventListener('change', handleManualCoord);
    // Bind Enter key as well
    if ($('lat-input')) $('lat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') handleManualCoord(); });
    if ($('lon-input')) $('lon-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') handleManualCoord(); });
});
