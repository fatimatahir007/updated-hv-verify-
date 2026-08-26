import { createContext, useContext, useState, useCallback } from "react";

export const LANGUAGES = {
  en: { label: "English", dir: "ltr", code: "en-US" },
  ur: { label: "اردو",    dir: "rtl", code: "ur-PK" },
  ps: { label: "پښتو",   dir: "rtl", code: "ps"    },
};

export const T = {
  en: {
    // Navbar
    home: "Home", register: "Register", activate: "Activate Account", vote: "Vote",
    verify: "Verify", results: "Results", admin: "Admin", adminLogin: "Admin Login",
    // Register page
    registerTitle: "Voter Registration",
    registerSubtitle: "Create your secure voting identity with official CNIC details.",
    registerEyebrow: "Verified registration",
    fullName: "Full name", fullNamePlaceholder: "As printed on CNIC", fullNameHelper: "Use your official CNIC spelling.",
    cnic: "CNIC number", cnicPlaceholder: "00000-0000000-0", cnicHelper: "Format will be applied automatically.",
    phone: "Phone number", phonePlaceholder: "03XXXXXXXXX", phoneHelper: "Used for secure voter notifications only.",
    constituency: "Constituency", constituencyPlaceholder: "Lahore", constituencyHelper: "Enter the constituency shown on your CNIC.",
    createVoterId: "Create voter ID", registering: "Registering...",
    formHint: "A unique voter ID will be issued after verification.",
    regComplete: "Registration complete", regCompleteSub: "Save your voter ID for secure access to the ballot.",
    copyVoterId: "Copy voter ID", copying: "Copying...", copied: "Copied! Redirecting...",
    copyHint: "Copy the ID to proceed to the voting booth.",
    // Liveness
    livenessTitle: "Liveness Verification",
    livenessSubtitle: "Complete AI-powered verification to receive your voter ID.",
    step1: "Allow camera access", step2: "Center your face", step3: "Blink once",
    step4: "Turn head left", step5: "Turn head right", step6: "Raise one hand",
    instructions: {
      1: "Center your face in the frame and hold still.",
      2: "Blink once naturally.",
      3: "Slowly turn your head to the LEFT.",
      4: "Now turn your head to the RIGHT.",
      5: "Raise one hand above your shoulder.",
    },
    detected: "✓ Detected! Moving to next step…",
    aiLoading: "Loading AI detection models…",
    scanning: "Scanning your face…", starting: "Starting camera…",
    faceAlready: "This face is already registered.",
    // Vote page
    voteTitle: "Secure ballot", voteSubtitle: "Enter your voter ID to access the ballot.",
    voteEyebrow: "Verified voting",
    voterIdLabel: "Voter ID", voterIdPlaceholder: "Enter your voter ID",
    voterIdHelper: "The ID issued during registration.",
    accessBallot: "Access ballot", verifying: "Verifying...",
    castVote: "Cast vote", casting: "Casting...",
    voteSuccess: "Vote recorded", voteSuccessSub: "Your vote has been cast and recorded on the blockchain.",
    receiptLabel: "Your receipt code", receiptHelper: "Save this code to verify your vote.",
    verifyVote: "Verify my vote", copyReceipt: "Copy receipt",
    alreadyVoted: "You have already voted.",
    // Verify page
    verifyTitle: "Verify a vote receipt",
    verifySubtitle: "Confirm your receipt exists on the public ledger.",
    verifyEyebrow: "Public verification",
    receiptCode: "Receipt code", receiptCodePlaceholder: "RCPT-XXXXXXXX",
    receiptCodeHelper: "Enter the receipt issued immediately after voting.",
    verifyBtn: "Verify receipt", verifyingBtn: "Verifying...",
    receiptVerified: "Receipt verified", receiptNotFound: "Receipt not found",
    receiptConfirmed: "Your receipt is confirmed on the public ledger.",
    blockchainHash: "Blockchain hash",
  },

  ur: {
    home: "ہوم", register: "رجسٹر", activate: "تصدیق و فعال سازی", vote: "ووٹ",
    verify: "تصدیق", results: "نتائج", admin: "ایڈمن", adminLogin: "ایڈمن لاگ ان",
    registerTitle: "ووٹر رجسٹریشن",
    registerSubtitle: "اپنے سرکاری شناختی کارڈ کی تفصیلات کے ساتھ اپنی محفوظ ووٹنگ شناخت بنائیں۔",
    registerEyebrow: "تصدیق شدہ رجسٹریشن",
    fullName: "Poora naam - Full name", fullNamePlaceholder: "جیسا شناختی کارڈ پر درج ہے", fullNameHelper: "سرکاری شناختی کارڈ کی ہجے استعمال کریں۔",
    cnic: "Shanakhti card number - CNIC", cnicPlaceholder: "00000-0000000-0", cnicHelper: "فارمیٹ خود بخود لگ جائے گا۔",
    phone: "Phone number - فون نمبر", phonePlaceholder: "03XXXXXXXXX", phoneHelper: "صرف محفوظ ووٹر اطلاعات کے لیے استعمال ہوگا۔",
    constituency: "Halqa - Constituency", constituencyPlaceholder: "لاہور", constituencyHelper: "اپنے شناختی کارڈ پر درج حلقہ درج کریں۔",
    createVoterId: "ووٹر آئی ڈی بنائیں", registering: "رجسٹر ہو رہا ہے...",
    formHint: "تصدیق کے بعد ایک منفرد ووٹر آئی ڈی جاری کی جائے گی۔",
    regComplete: "رجسٹریشن مکمل", regCompleteSub: "بیلٹ تک محفوظ رسائی کے لیے اپنی ووٹر آئی ڈی محفوظ کریں۔",
    copyVoterId: "ووٹر آئی ڈی کاپی کریں", copying: "کاپی ہو رہی ہے...", copied: "کاپی ہوگئی! ری ڈائریکٹ ہو رہا ہے...",
    copyHint: "ووٹنگ بوتھ پر جانے کے لیے آئی ڈی کاپی کریں۔",
    livenessTitle: "زندگی کی تصدیق",
    livenessSubtitle: "اپنا ووٹر آئی ڈی حاصل کرنے کے لیے AI تصدیق مکمل کریں۔",
    step1: "کیمرہ اجازت دیں", step2: "اپنا چہرہ درست کریں", step3: "ایک بار پلک جھپکائیں",
    step4: "سر بائیں موڑیں", step5: "سر دائیں موڑیں", step6: "ایک ہاتھ اوپر اٹھائیں",
    instructions: {
      1: "اپنا چہرہ کیمرے کے سامنے رکھیں اور بالکل سیدھے رہیں۔",
      2: "قدرتی طور پر ایک بار پلک جھپکائیں۔",
      3: "آہستہ آہستہ اپنا سر بائیں طرف موڑیں۔",
      4: "اب اپنا سر دائیں طرف موڑیں۔",
      5: "ایک ہاتھ کندھے سے اوپر اٹھائیں۔",
    },
    detected: "✓ تصدیق ہوگئی! اگلے مرحلے پر جا رہے ہیں…",
    aiLoading: "AI ماڈل لوڈ ہو رہا ہے…",
    scanning: "چہرہ اسکین ہو رہا ہے…", starting: "کیمرہ شروع ہو رہا ہے…",
    faceAlready: "یہ چہرہ پہلے سے رجسٹر ہے۔",
    voteTitle: "محفوظ بیلٹ", voteSubtitle: "بیلٹ تک رسائی کے لیے اپنا ووٹر آئی ڈی درج کریں۔",
    voteEyebrow: "تصدیق شدہ ووٹنگ",
    voterIdLabel: "Voter ID - ووٹر آئی ڈی", voterIdPlaceholder: "اپنا ووٹر آئی ڈی درج کریں",
    voterIdHelper: "رجسٹریشن کے دوران جاری کردہ آئی ڈی۔",
    accessBallot: "بیلٹ تک رسائی", verifying: "تصدیق ہو رہی ہے...",
    castVote: "ووٹ دیں", casting: "ووٹ دیا جا رہا ہے...",
    voteSuccess: "ووٹ درج ہوگیا", voteSuccessSub: "آپ کا ووٹ بلاک چین پر درج ہوگیا ہے۔",
    receiptLabel: "آپ کا رسید کوڈ", receiptHelper: "اپنے ووٹ کی تصدیق کے لیے یہ کوڈ محفوظ کریں۔",
    verifyVote: "میرا ووٹ تصدیق کریں", copyReceipt: "رسید کاپی کریں",
    alreadyVoted: "آپ پہلے ہی ووٹ دے چکے ہیں۔",
    verifyTitle: "ووٹ رسید کی تصدیق",
    verifySubtitle: "تصدیق کریں کہ آپ کی رسید عوامی لیجر پر موجود ہے۔",
    verifyEyebrow: "عوامی تصدیق",
    receiptCode: "Receipt code - رسید کوڈ", receiptCodePlaceholder: "RCPT-XXXXXXXX",
    receiptCodeHelper: "ووٹنگ کے فوراً بعد جاری کردہ رسید درج کریں۔",
    verifyBtn: "رسید تصدیق کریں", verifyingBtn: "تصدیق ہو رہی ہے...",
    receiptVerified: "رسید تصدیق شدہ", receiptNotFound: "رسید نہیں ملی",
    receiptConfirmed: "آپ کی رسید عوامی لیجر پر تصدیق شدہ ہے۔",
    blockchainHash: "بلاک چین ہیش",
  },

  ps: {
    home: "کور", register: "راجستر", activate: "د حساب فعالول", vote: "رای",
    verify: "تایید", results: "پایلې", admin: "اداره", adminLogin: "د اداری ننوتل",
    registerTitle: "د رایې ورکوونکي راجستر",
    registerSubtitle: "د خپل رسمي تذکرې سره خپل خوندي د رایې ورکولو هویت جوړ کړئ.",
    registerEyebrow: "تایید شوې راجستریشن",
    fullName: "Beshpar noom - Full name", fullNamePlaceholder: "لکه چې تذکره کې لیکل شوی", fullNameHelper: "د رسمي تذکرې سمه لیک وکاروئ.",
    cnic: "Tazkara number - CNIC", cnicPlaceholder: "00000-0000000-0", cnicHelper: "فارمیټ به خپله پلي شي.",
    phone: "Phone number - د تلیفون شمیره", phonePlaceholder: "03XXXXXXXXX", phoneHelper: "یوازې د خوندي خبرتیا لپاره کارول کیږي.",
    constituency: "Hawza - Constituency", constituencyPlaceholder: "پیښور", constituencyHelper: "د خپل تذکرې حوزه ولیکئ.",
    createVoterId: "د رایې ورکوونکي ID جوړ کړئ", registering: "راجستریږي...",
    formHint: "د تایید وروسته به یو ځانګړی ID ورکول شي.",
    regComplete: "راجستریشن بشپړ شو", regCompleteSub: "د خپل ID خوندي کړئ.",
    copyVoterId: "ID کاپي کړئ", copying: "کاپي کیږي...", copied: "کاپي شو! لیږدول کیږي...",
    copyHint: "د رایې ورکولو لپاره ID کاپي کړئ.",
    livenessTitle: "د ژوند تایید",
    livenessSubtitle: "د خپل ID ترلاسه کولو لپاره AI تایید بشپړ کړئ.",
    step1: "کامره اجازت ورکړئ", step2: "خپل مخ سم کړئ", step3: "یو ځل وپرخیږئ",
    step4: "سر کیڼ لوري واړوئ", step5: "سر ښي لوري واړوئ", step6: "یوه لاس پورته کړئ",
    instructions: {
      1: "خپل مخ د کامرې مخې ته کیږدئ او ولاړ اوسئ.",
      2: "یو ځل طبیعي ډول وپرخیږئ.",
      3: "ورو ورو خپل سر کیڼ لوري ته واړوئ.",
      4: "اوس خپل سر ښي لوري ته واړوئ.",
      5: "یوه لاس د اوږې پورته پورته کړئ.",
    },
    detected: "✓ تایید شو! بل ګام ته ځو…",
    aiLoading: "AI ماډل بار کیږي…",
    scanning: "مخ سکین کیږي…", starting: "کمره پیل کیږي…",
    faceAlready: "دا مخ مخکې راجستر دی.",
    voteTitle: "خوندي بیلټ", voteSubtitle: "د بیلټ لاسرسي لپاره خپل ID ولیکئ.",
    voteEyebrow: "تایید شوې رای ورکول",
    voterIdLabel: "Voter ID - د رایې ورکوونکي", voterIdPlaceholder: "خپل ID ولیکئ",
    voterIdHelper: "د راجستریشن پر مهال ورکړل شوی ID.",
    accessBallot: "بیلټ ته لاسرسی", verifying: "تاییدیږي...",
    castVote: "رای ورکړئ", casting: "رای ورکول کیږي...",
    voteSuccess: "رای ثبت شوه", voteSuccessSub: "ستاسو رای بلاک چین کې ثبت شوه.",
    receiptLabel: "ستاسو رسید کوډ", receiptHelper: "د خپلې رایې تایید لپاره دا کوډ وساتئ.",
    verifyVote: "زما رای تایید کړئ", copyReceipt: "رسید کاپي کړئ",
    alreadyVoted: "تاسو مخکې رای ورکړې.",
    verifyTitle: "د رایې رسید تایید",
    verifySubtitle: "تایید کړئ چې ستاسو رسید عامه لیجر کې شته.",
    verifyEyebrow: "عامه تایید",
    receiptCode: "Receipt code - رسید کوډ", receiptCodePlaceholder: "RCPT-XXXXXXXX",
    receiptCodeHelper: "د رای ورکولو سمدلاسه ورکړل شوی رسید ولیکئ.",
    verifyBtn: "رسید تایید کړئ", verifyingBtn: "تاییدیږي...",
    receiptVerified: "رسید تایید شو", receiptNotFound: "رسید ونه موندل شو",
    receiptConfirmed: "ستاسو رسید عامه لیجر کې تایید شوی.",
    blockchainHash: "بلاک چین هیش",
  },
};


const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState("en");
  const t = T[lang];
  const langMeta = LANGUAGES[lang];

  const switchLang = useCallback((code) => {
    setLang(code);
    document.documentElement.dir = LANGUAGES[code].dir;
    document.documentElement.lang = code;
  }, []);

  return (
    <LangContext.Provider value={{ lang, t, langMeta, switchLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
