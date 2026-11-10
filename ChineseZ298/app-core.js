/**
 * MODULE 2: CZAppCore - HẠ TẦNG ỨNG DỤNG, FIREBASE, REALTIME CHAT, ADMIN
 */
const CZAppCore = {
    firebaseConfig: { 
        apiKey: "AIzaSyAMj0Jf-GCdRCS9jawLmnqSqlGFubpe-Ps", 
        authDomain: "chinesez298.firebaseapp.com", 
        projectId: "chinesez298", 
        storageBucket: "chinesez298.firebasestorage.app", 
        messagingSenderId: "983534326817", 
        appId: "1:983534326817:web:61d9f80a71e7bea8a93f60", 
        measurementId: "G-PJEFS1G2DG" 
    },
    db: null,
    audioCtx: null,

    // Cắt tỉa: Chỉ giữ lại Bài 1 làm khung cấu trúc fallback offline
    initialLessonsData: [
        { 
            id: 1, 
            isSystem: true, 
            title: 'Bài 1: Chào hỏi & Làm quen cơ bản', 
            vocabs: [
                { hanzi: "你好", pinyin: "nǐ hǎo", meaning: "Xin chào", example_cn: "你好！很高兴认识你。", example_py: "Nǐ hǎo! Hěn gāoxìng rènshí nǐ.", example_vi: "Xin chào! Rất vui được gặp bạn." }, 
                { hanzi: "谢谢", pinyin: "xiè xie", meaning: "Cảm ơn", example_cn: "谢谢你的热情帮助。", example_py: "Xièxie nǐ de rèqíng bāngzhù.", example_vi: "Cảm ơn sự giúp đỡ nhiệt tình của bạn." }, 
                { hanzi: "再见", pinyin: "zài jiàn", meaning: "Tạm biệt", example_cn: "明天学校见，再见！", example_py: "Míngtiān xuéxiào jiàn, zàijiàn!", example_vi: "Ngày mai gặp ở trường, tạm biệt!" }, 
                { hanzi: "名字", pinyin: "míng zi", meaning: "Tên", example_cn: "你叫什么名字？", example_py: "Nǐ jiào shénme míngzi?", example_vi: "Bạn tên là gì?" }, 
                { hanzi: "认识", pinyin: "rèn shi", meaning: "Quen biết", example_cn: "认识你我也很高兴。", example_py: "Rènshi nǐ wǒ yě hěn gāoxìng.", example_vi: "Quen biết bạn tôi cũng rất vui." }
            ], 
            cloze: [
                { sentenceBefore: "请问你叫什么 ", sentenceAfter: " ？", correctAnswer: "名字", choices: [{ word: "你好" }, { word: "名字" }, { word: "谢谢" }, { word: "再见" }], pinyin: "Qǐngwèn nǐ jiào shénme míngzi?", meaning: "Xin hỏi bạn tên là gì?" },
                { sentenceBefore: "很 ", sentenceAfter: " 认识你。", correctAnswer: "高兴", choices: [{ word: "高兴" }, { word: "再见" }, { word: "谢谢" }, { word: "名字" }], pinyin: "Hěn gāoxìng rènshí nǐ.", meaning: "Rất vui được quen biết bạn." },
                { sentenceBefore: "明天见，", sentenceAfter: " ！", correctAnswer: "再见", choices: [{ word: "你好" }, { word: "名字" }, { word: "再见" }, { word: "老师" }], pinyin: "Míngtiān jiàn, zàijiàn!", meaning: "Ngày mai gặp lại, tạm biệt!" },
                { sentenceBefore: "非常 ", sentenceAfter: " 你的帮助！", correctAnswer: "感谢", choices: [{ word: "感谢" }, { word: "名字" }, { word: "再见" }, { word: "你好" }], pinyin: "Fēicháng gǎnxiè nǐ de bāngzhù!", meaning: "Vô cùng cảm ơn sự giúp đỡ của bạn!" }
            ], 
            grammar: [{ 
                pattern: "Mẫu câu chữ 是", 
                formula: "[Chủ ngữ] + 是 + [Tân ngữ]",
                challenge: "Sắp xếp: 我 / 越南人 / 是", 
                zh: "我是越南人。",
                pinyin: "Wǒ狂 shì Yuènán rén.", 
                meaning: "Tôi là người Việt Nam.", 
                exercises: [
                    { zh: "我是学生。", pinyin: "Wǒ shì xuésheng.", vi: "Tôi là học sinh.", isCorrect: true, correction: "" },
                    { zh: "他是不老师。", pinyin: "Tā shì bù lǎoshī.", vi: "Anh ấy không phải là thầy giáo.", isCorrect: false, correction: "他不是老师。 (Phủ định dùng 不是)" },
                    { zh: "他们是朋友。", pinyin: "Tāmen shì péngyou.", vi: "Họ là bạn bè.", isCorrect: true, correction: "" }
                ]
            }], 
            dialogues: [
                { speaker: "A", zh: "你好！请问你叫什么名字？", pinyin: "Nǐ hǎo! Qǐngwèn nǐ jiào shénme míngzi?", vi: "Xin chào! Xin hỏi bạn tên là gì?" }, 
                { speaker: "B", zh: "你好！我叫王明，是汉语老师。", pinyin: "Nǐ hǎo! Wǒ jiào Wáng Míng, shì hànyǔ lǎoshī.", vi: "Xin chào! Tôi tên là Vương Minh, là giáo viên tiếng Trung." }
            ] 
        }
    ],

    lessonsDB: [],
    lastCreatedId: null,
    currentRoomCategory: 'sample',
    currentRoomPage: 1,
    LESSONS_PER_PAGE: 4,

    currentAuth: null,
    isRegistrationEnabled: true,
    usersDB: [],
    uploadedLessonFile: null,
    translateDirection: "VI_ZH",

    activeChatTargetUser: null,
    chatUnsubscribe: null,
    unreadChatUsers: {},

    // Tinh chỉnh hàm init(): Đọc localStorage tức thì + Tải trực tiếp collection system_lessons từ Firestore
    async init() {
        try {
            if (!firebase.apps.length) firebase.initializeApp(this.firebaseConfig);
            this.db = firebase.firestore();
        } catch(e) {}

        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // 1. Đọc dữ liệu từ localStorage để hiển thị tức thì
        let stored = JSON.parse(localStorage.getItem('chinesez_lessons')) || [];
        if (stored.length === 0) {
            stored = [...this.initialLessonsData];
        }
        this.lessonsDB = stored;

        // 2. Tải trực tiếp collection system_lessons từ Firestore để cập nhật bài học mẫu mới nhất
        if (this.db) {
            this.db.collection("system_lessons").get().then(snap => {
                if (!snap.empty) {
                    const cloudSystemLessons = [];
                    snap.forEach(doc => cloudSystemLessons.push(doc.data()));
                    
                    // Sắp xếp bài mẫu theo ID
                    cloudSystemLessons.sort((a, b) => (parseInt(a.id, 10) || 0) - (parseInt(b.id, 10) || 0));

                    // Lọc giữ lại bài cá nhân của người dùng và hợp nhất với bài mẫu mới nhất từ mây
                    const userLessons = this.lessonsDB.filter(l => !l.isSystem);
                    this.lessonsDB = [...cloudSystemLessons, ...userLessons];
                    localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));

                    // Cập nhật lại giao diện phòng học nếu đang mở
                    const vp = document.getElementById('main-viewport');
                    if (vp && !document.getElementById('main-app-screen').classList.contains('hidden')) {
                        const roomBtn = document.getElementById('tbtn-room');
                        if (roomBtn && roomBtn.classList.contains('btn-3d')) {
                            this.renderRoomCategoryView(vp);
                        }
                    }
                }
            }).catch(err => {
                console.warn("Lỗi tải bài học mẫu từ Firestore:", err);
            });
        }

        this.isRegistrationEnabled = localStorage.getItem('cz_reg_enabled') !== 'false';
        this.usersDB = JSON.parse(localStorage.getItem('chinesez_users')) || [
            { id: 1, username: 'admin298', pass: 'ADMjn298', role: 'admin', fullname: 'Quản Trị Viên', job: 'Giáo viên', className: '', phone4: '2980', createdAt: '01/01/2026' }
        ];

        document.addEventListener('click', (e) => {
            const chatWin = document.getElementById('support-chat-window');
            const chatBtn = document.getElementById('floating-chat-btn');
            if (chatWin && !chatWin.classList.contains('hidden')) {
                if (!chatWin.contains(e.target) && (!chatBtn || !chatBtn.contains(e.target))) {
                    this.closeSupportChat();
                }
            }
        });
    },

    playSfx(isWin) {
        try {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const o = this.audioCtx.createOscillator(), g = this.audioCtx.createGain();
            o.connect(g); g.connect(this.audioCtx.destination);
            if (isWin) {
                o.frequency.setValueAtTime(523.25, this.audioCtx.currentTime);
                o.frequency.exponentialRampToValueAtTime(659.25, this.audioCtx.currentTime + 0.15);
                g.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
                o.start(); o.stop(this.audioCtx.currentTime + 0.3);
            } else {
                o.type = 'sawtooth';
                o.frequency.setValueAtTime(220, this.audioCtx.currentTime);
                o.frequency.exponentialRampToValueAtTime(140, this.audioCtx.currentTime + 0.2);
                g.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
                g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.25);
                o.start(); o.stop(this.audioCtx.currentTime + 0.25);
            }
        } catch(e) {}
    },

    toggleThemeMenu() { document.getElementById('theme-menu').classList.toggle('hidden'); },
    applyTheme(key, lbl) {
        document.documentElement.setAttribute('data-theme', key);
        localStorage.setItem('chinesez_theme', key);
        document.getElementById('theme-lbl').innerText = lbl;
        document.getElementById('theme-menu').classList.add('hidden');
    },

    async callGeminiAPI(promptParts) {
        const userKey = (localStorage.getItem('user_gemini_api_key') || "").trim();
        if (!userKey) throw new Error("Chưa cài đặt Gemini API Key cá nhân. Vui lòng bấm vào thẻ Thông tin tài khoản để cài đặt API Key!");

        const candidateModels = [
            'gemini-3.5-flash-lite',
            'gemini-3.8-flash',
            'gemini-3.1-pro',
            'gemini-4-argon'
        ];
        
        let lastErrorMessage = "";

        for (const model of candidateModels) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(userKey)}`;
                const resp = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        contents: [{ parts: promptParts }],
                        generationConfig: { responseMimeType: "application/json" }
                    })
                });

                if (resp.ok) {
                    const data = await resp.json();
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return text;
                } else {
                    const errJson = await resp.json().catch(() => ({}));
                    lastErrorMessage = errJson.error?.message || `Lỗi HTTP ${resp.status}`;
                }
            } catch (e) {
                lastErrorMessage = e.message;
            }
        }
        throw new Error(`Tài khoản chưa hỗ trợ phiên bản API hiện tại hoặc API Key không hợp lệ. (Chi tiết: ${lastErrorMessage})`);
    },

    extractJSON(rawText) {
        let clean = rawText.trim();
        clean = clean.replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch (e) {
            const first = clean.search(/[\[\{]/);
            const last = Math.max(clean.lastIndexOf(']'), clean.lastIndexOf('}'));
            if (first !== -1 && last !== -1 && last > first) {
                const sub = clean.substring(first, last + 1);
                return JSON.parse(sub);
            }
            throw e;
        }
    },

    togglePassVisibility(inputId, iconId) { 
        const p = document.getElementById(inputId), i = document.getElementById(iconId); 
        if (!p || !i) return;
        if (p.type === 'password') { p.type = 'text'; i.className = 'fa-solid fa-eye-slash'; } 
        else { p.type = 'password'; i.className = 'fa-solid fa-eye'; } 
    },

    handleLogin() {
        const u = document.getElementById('login-username').value.trim(), p = document.getElementById('login-password').value.trim();
        if (!u || !p) { alert("Vui lòng điền đủ thông tin!"); return; }
        if (u === 'admin298' && (p === 'ADMjn298' || p === 'admin298')) { 
            this.proceedLoginSuccess({ id: 1, username: 'admin298', role: 'admin', fullname: 'Quản Trị Viên', job: 'Giáo viên', className: '', phone4: '2980', createdAt: '01/01/2026' }); 
            return; 
        }
        const user = this.usersDB.find(x => x.username === u && x.pass === p);
        if (user) this.proceedLoginSuccess(user); else alert("Thông tin đăng nhập không chính xác.");
    },

    proceedLoginSuccess(user) {
        this.currentAuth = user; 

        const now = new Date();
        const nowStr = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

        user.loginCount = (parseInt(user.loginCount, 10) || 0) + 1;
        if (!Array.isArray(user.loginHistory)) user.loginHistory = [];
        user.loginHistory.unshift(nowStr);
        user.lastLogin = nowStr;

        const uIdx = this.usersDB.
