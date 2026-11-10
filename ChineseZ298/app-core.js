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
        const uIdx = this.usersDB.findIndex(x => x.username === user.username);
                if (uIdx >= 0) {
                    this.usersDB[uIdx].loginCount = user.loginCount;
                    this.usersDB[uIdx].loginHistory = user.loginHistory;
                    this.usersDB[uIdx].lastLogin = user.lastLogin;
                    localStorage.setItem('chinesez_users', JSON.stringify(this.usersDB));
                }

                if (this.db) {
                    this.db.collection("users").doc(user.username).update({
                        loginCount: firebase.firestore.FieldValue.increment(1),
                        lastLogin: nowStr,
                        loginHistory: firebase.firestore.FieldValue.arrayUnion(nowStr)
                    }).catch(() => {});
                }

                sessionStorage.setItem('chinesez_session_user', JSON.stringify(user));
                document.getElementById('auth-screen').classList.add('hidden'); 
                document.getElementById('main-app-screen').classList.remove('hidden');
                document.getElementById('user-role-badge').innerText = `${user.fullname} (${user.role})`;
                
                const isAdmin = (user.role === 'admin' || user.username === 'admin298');
                document.getElementById('admin-box').classList.toggle('hidden', !isAdmin);
                
                const chatFloatingBtn = document.getElementById('floating-chat-btn');
                if (chatFloatingBtn) chatFloatingBtn.classList.remove('hidden');

                this.setTab('home'); 

                const k = (localStorage.getItem('user_gemini_api_key') || "").trim();
                if (!k) {
                    setTimeout(() => this.openApiSetupModal(true), 300);
                }

                if (!isAdmin) {
                    this.initUserChatListener();
                } else {
                    this.initAdminChatGlobalListener();
                }
            },

            handleLogout() { 
                if (this.chatUnsubscribe) { this.chatUnsubscribe(); this.chatUnsubscribe = null; }
                this.currentAuth = null; 
                sessionStorage.removeItem('chinesez_session_user'); 
                document.getElementById('main-app-screen').classList.add('hidden'); 
                document.getElementById('auth-screen').classList.remove('hidden'); 
            },

            onRegJobChanged(val) {
                const needsSchool = ['Học sinh', 'Sinh viên', 'Giáo viên'].includes(val);
                const needsClass = ['HS VTS', 'Học sinh'].includes(val);
                
                const schoolInp = document.getElementById('reg-school');
                const classInp = document.getElementById('reg-class');
                const otherInp = document.getElementById('reg-job-other');
                const selectEl = document.getElementById('reg-job-select');
                
                // Đổi màu select nếu chưa chọn nghề cụ thể
                if (selectEl) {
                    if (val === '') selectEl.classList.add('text-slate-400', 'opacity-60');
                    else selectEl.classList.remove('text-slate-400', 'opacity-60');
                }
                
                if (schoolInp) schoolInp.classList.toggle('hidden', !needsSchool);
                if (classInp) classInp.classList.toggle('hidden', !needsClass);
                if (otherInp) otherInp.classList.toggle('hidden', val !== 'Khác');
            },

            openRegisterModal() {
                if (!this.isRegistrationEnabled && (!this.currentAuth || this.currentAuth.role !== 'admin')) { alert("Hệ thống đang tạm khóa đăng ký, vui lòng liên hệ Admin!"); return; }
                document.getElementById('register-modal').classList.remove('hidden');
                const jobSel = document.getElementById('reg-job-select');
                if (jobSel) {
                    jobSel.value = "";
                    jobSel.classList.add('text-slate-400', 'opacity-60');
                }
                this.onRegJobChanged("");
            },
            closeRegisterModal() { document.getElementById('register-modal').classList.add('hidden'); },

            async handleRegister() {
                const f = document.getElementById('reg-fullname').value.trim();
                const ph = document.getElementById('reg-phone4').value.trim();
                const u = document.getElementById('reg-username').value.trim();
                const p = document.getElementById('reg-password').value.trim();
                const cp = document.getElementById('reg-confirm-password').value.trim();
                const jobSel = document.getElementById('reg-job-select').value;
                const jobOther = document.getElementById('reg-job-other').value.trim();
                const cls = document.getElementById('reg-class').value.trim();
                if (!jobSel) return alert("Vui lòng chọn Nghề nghiệp!");
                const school = document.getElementById('reg-school') ? document.getElementById('reg-school').value.trim() : '';
                const finalJob = (jobSel === 'Khác' && jobOther) ? jobOther : jobSel;

                if (!f) return alert("Vui lòng nhập Họ và tên!");
                if (!ph || ph.length !== 4) return alert("Vui lòng nhập đúng 4 số cuối điện thoại!");
                if (['Học sinh', 'Sinh viên', 'Giáo viên'].includes(jobSel) && !school) {
                    return alert("Vui lòng nhập Trường của bạn!");
                }
                if (['HS VTS', 'Học sinh'].includes(jobSel) && !cls) {
                    return alert("Vui lòng nhập Lớp của bạn!");
                }
                if (!u) return alert("Vui lòng nhập Tên đăng nhập!");
                if (/\s/.test(u)) return alert("Tên đăng nhập không được chứa khoảng trắng!");
                if (!p) return alert("Vui lòng nhập Mật khẩu!");
                if (p !== cp) return alert("Mật khẩu xác nhận không khớp!");

                // Quét kiểm tra trùng tài khoản và tìm MAX ID trực tiếp từ Firestore
                let serverMaxId = 0;
                if (this.db) {
                    try {
                        const snap = await this.db.collection("users").get();
                        snap.forEach(doc => {
                            const ud = doc.data();
                            if (ud.username && ud.username.toLowerCase() === u.toLowerCase()) {
                                throw new Error("EXISTS");
                            }
                            const nid = parseInt(ud.id, 10);
                            if (!isNaN(nid) && nid > serverMaxId) serverMaxId = nid;
                        });
                    } catch(err) {
                        if (err.message === "EXISTS") return alert("Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác!");
                        console.warn("Lỗi kiểm tra Firestore:", err);
                    }
                }

                if (this.usersDB.some(x => x.username.toLowerCase() === u.toLowerCase())) {
                    return alert("Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác!");
                }
                this.usersDB.forEach(x => {
                    const nid = parseInt(x.id, 10);
                    if (!isNaN(nid) && nid > serverMaxId) serverMaxId = nid;
                });

                const nextId = serverMaxId + 1;
                const d = new Date();
                const createdAtStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;

                const newUser = { 
                    id: nextId, 
                    username: u, 
                    pass: p, 
                    fullname: f, 
                    role: 'member', 
                    job: finalJob, 
                    schoolName: school,
                    className: cls, 
                    phone4: ph,
                    createdAt: createdAtStr 
                };

                this.usersDB.push(newUser);
                localStorage.setItem('chinesez_users', JSON.stringify(this.usersDB));
                if (this.db) { 
                    try {
                        await this.db.collection("users").doc(u).set(newUser);
                    } catch(e) { console.warn("Lỗi lưu user Firestore:", e); }
                }
                alert("Đăng ký thành công!"); 
                this.closeRegisterModal(); 
                this.proceedLoginSuccess(newUser);
            },

            openForgotModal() { document.getElementById('forgot-modal').classList.remove('hidden'); },
            closeForgotModal() { document.getElementById('forgot-modal').classList.add('hidden'); },
            handleForgotSubmit() { alert("Thông tin đã được gửi. Bạn vui lòng liên hệ Admin để khôi phục mật khẩu."); this.closeForgotModal(); },

            // ==========================================
            // THẺ "THÔNG TIN TÀI KHOẢN" (PHẦN B)
            // ==========================================
            renderProfileView(vp) {
                const u = this.currentAuth || { fullname: "Khách", username: "guest", job: "Học sinh", className: "", createdAt: "2026-11-01" };
                const hasKey = !!(localStorage.getItem('user_gemini_api_key') || "").trim();

                vp.innerHTML = `
                    <div class="space-y-4 max-w-md w-full my-auto px-2 text-left">
                        <div class="flex items-center space-x-3 pb-3 border-b border-slate-500/10">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-600 to-purple-600 text-white font-black flex items-center justify-center text-xl shadow-md">
                                <i class="fa-solid fa-user-check"></i>
                            </div>
                            <div>
                                <h2 class="text-base sm:text-lg font-black text-rose-600">Thông tin tài khoản</h2>
                                <p class="text-xs opacity-70">Quản lý hồ sơ cá nhân và khóa API AI</p>
                            </div>
                        </div>

                        <div class="theme-card p-4 rounded-2xl border space-y-2.5 shadow-xs text-xs">
                            <div class="flex justify-between py-1 border-b border-slate-500/10">
                                <span class="opacity-70 font-semibold">Họ và tên:</span>
                                <span class="font-black text-slate-800 dark:text-slate-100">${u.fullname}</span>
                            </div>
                            <div class="flex justify-between py-1 border-b border-slate-500/10">
                                <span class="opacity-70 font-semibold">Tên tài khoản:</span>
                                <span class="font-mono font-bold text-rose-600">${u.username}</span>
                            </div>
                            <div class="flex justify-between py-1 border-b border-slate-500/10">
                                <span class="opacity-70 font-semibold">Nghề nghiệp:</span>
                                <span class="font-bold">${u.job || 'Học sinh'} ${u.className ? `(Lớp: ${u.className})` : ''}</span>
                            </div>
                            <div class="flex justify-between py-1 border-b border-slate-500/10">
                                <span class="opacity-70 font-semibold">Ngày tham gia:</span>
                                <span class="font-semibold">${u.createdAt || '2026-11-01'}</span>
                            </div>
                            <div class="flex justify-between items-center py-1">
                                <span class="opacity-70 font-semibold">Trạng thái API Key:</span>
                                <span class="px-2 py-0.5 rounded-lg text-[10px] font-black ${hasKey ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'}">
                                    ${hasKey ? '✓ Đã cài đặt' : '✗ Chưa cài đặt'}
                                </span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-2.5 pt-1">
                            <button onclick="CZAppCore.openChangePasswordModal()" class="py-2.5 px-3 theme-card border hover:border-rose-500 text-xs font-bold rounded-2xl shadow-xs transition cursor-pointer flex items-center justify-center space-x-1.5">
                                <i class="fa-solid fa-key text-rose-500"></i>
                                <span>Đổi mật khẩu</span>
                            </button>
                            <button onclick="CZAppCore.openApiSetupModal(false)" class="py-2.5 px-3 btn-3d text-xs font-bold rounded-2xl cursor-pointer shadow-xs flex items-center justify-center space-x-1.5">
                                <i class="fa-solid fa-microchip"></i>
                                <span>Cài đặt API Key</span>
                            </button>
                        </div>
                    </div>
                `;
            },

            openChangePasswordModal() {
                document.getElementById('cp-current').value = '';
                document.getElementById('cp-new').value = '';
                document.getElementById('cp-confirm').value = '';
                document.getElementById('change-pass-modal').classList.remove('hidden');
            },

            async submitChangePassword() {
                const cur = document.getElementById('cp-current').value.trim();
                const np = document.getElementById('cp-new').value.trim();
                const cnp = document.getElementById('cp-confirm').value.trim();

                if (!cur || !np || !cnp) return alert("Vui lòng điền đủ thông tin!");
                if (cur !== this.currentAuth.pass) return alert("Mật khẩu hiện tại không đúng!");
                if (np !== cnp) return alert("Mật khẩu mới không trùng khớp!");
                if (np.length < 4) return alert("Mật khẩu mới nên từ 4 ký tự trở lên!");

                this.currentAuth.pass = np;
                const idx = this.usersDB.findIndex(x => x.username === this.currentAuth.username);
                if (idx >= 0) this.usersDB[idx].pass = np;
                localStorage.setItem('chinesez_users', JSON.stringify(this.usersDB));
                sessionStorage.setItem('chinesez_session_user', JSON.stringify(this.currentAuth));

                if (this.db) {
                    try {
                        await this.db.collection("users").doc(this.currentAuth.username).update({ pass: np });
                    } catch(e) { console.warn(e); }
                }

                alert("Đổi mật khẩu thành công!");
                document.getElementById('change-pass-modal').classList.add('hidden');
            },

            // ==========================================
            // HỆ THỐNG CHAT 2 CHIỀU "LIÊN HỆ ADMIN" REALTIME (ẢNH 2, 4)
            // ==========================================
            toggleSupportChat(e) {
                if (e) e.stopPropagation();
                const w = document.getElementById('support-chat-window');
                if (w.classList.contains('hidden')) {
                    w.classList.remove('hidden');
                    // Xóa thông báo chữ "Mới" khi người dùng mở ô chat
                    const badge = document.getElementById('chat-new-badge');
                    if (badge) badge.classList.add('hidden');
                    this.loadChatSession();
                } else {
                    this.closeSupportChat();
                }
            },

            closeSupportChat() {
                const w = document.getElementById('support-chat-window');
                if (w) w.classList.add('hidden');
                this.activeChatTargetUser = null;
            },

            // Mở chat từ bảng Admin khi click vào tên đăng nhập người dùng
            openAdminChatWithUser(targetUsername) {
                this.activeChatTargetUser = targetUsername;
                delete this.unreadChatUsers[targetUsername];
                this.renderAdminUsersTableRowsOnly();

                const w = document.getElementById('support-chat-window');
                w.classList.remove('hidden');
                document.getElementById('support-chat-header-title').innerText = `Liên hệ với ${targetUsername}`;
                this.loadChatSession();
            },

            getChatDocRef() {
                if (!this.db) return null;
                const isAdmin = (this.currentAuth && (this.currentAuth.role === 'admin' || this.currentAuth.username === 'admin298'));
                const sessionUser = isAdmin ? this.activeChatTargetUser : (this.currentAuth ? this.currentAuth.username : 'guest');
                if (!sessionUser) return null;
                return this.db.collection("support_chats").doc(sessionUser);
            },

            loadChatSession() {
                const docRef = this.getChatDocRef();
                const listEl = document.getElementById('chat-msg-list');
                const endConfirmBox = document.getElementById('chat-end-confirm-box');
                if (endConfirmBox) endConfirmBox.classList.add('hidden');

                if (!docRef) {
                    listEl.innerHTML = `<div class="p-4 text-center opacity-60">Chưa kết nối máy chủ chat.</div>`;
                    return;
                }

                if (this.chatUnsubscribe) this.chatUnsubscribe();

                this.chatUnsubscribe = docRef.onSnapshot(doc => {
                    if (!doc.exists) {
                        listEl.innerHTML = `
                            <div class="p-3 theme-card rounded-2xl border text-left space-y-1">
                                <p class="font-bold text-rose-600">Xin chào ${this.currentAuth ? this.currentAuth.fullname : ''}!</p>
                                <p class="opacity-80">Bạn có thể nhắn tin trực tiếp để admin hỗ trợ nhé.</p>
                            </div>
                        `;
                        return;
                    }

                    const data = doc.data() || {};
                    const messages = data.messages || [];

                    const isAdmin = (this.currentAuth && (this.currentAuth.role === 'admin' || this.currentAuth.username === 'admin298'));
                    
                    // Kiểm tra lệnh "End"
                    const lastMsg = messages[messages.length - 1];
                    if (!isAdmin && lastMsg && lastMsg.senderRole === 'admin' && lastMsg.text && lastMsg.text.trim().toLowerCase() === 'end') {
                        if (endConfirmBox) endConfirmBox.classList.remove('hidden');
                    } else {
                        if (endConfirmBox) endConfirmBox.classList.add('hidden');
                    }

                    listEl.innerHTML = messages.map((m, idx) => {
                        const isMe = (m.sender === (this.currentAuth ? this.currentAuth.username : ''));
                        let actionButtonsHtml = '';
                        if (m.type === 'sample_proposal' && !isAdmin && !m.responded) {
                            actionButtonsHtml = `
                                <div class="flex gap-2 pt-2 border-t border-slate-500/10 mt-1.5">
                                    <button onclick="CZAppCore.respondSampleProposal('${m.lessonId}', true, ${idx})" class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition">Đồng ý</button>
                                    <button onclick="CZAppCore.respondSampleProposal('${m.lessonId}', false, ${idx})" class="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition">Không đồng ý</button>
                                </div>
                            `;
                        }

                        return `
                            <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                                <div class="max-w-[85%] p-2.5 rounded-2xl text-left shadow-xs ${isMe ? 'btn-3d text-white rounded-tr-none' : 'theme-card border rounded-tl-none'}">
                                    <p class="text-[9.5px] opacity-75 font-semibold">${m.senderName} (${m.time})</p>
                                    <div class="font-medium text-xs break-words mt-0.5 leading-relaxed">${m.text}</div>
                                    ${actionButtonsHtml}
                                </div>
                            </div>
                        `;
                    }).join('');
                    listEl.scrollTop = listEl.scrollHeight;
                });
            },

            async handleChatSubmit() {
                const inp = document.getElementById('chat-input-txt');
                const text = inp.value.trim();
                if (!text) return;
                inp.value = '';

                const docRef = this.getChatDocRef();
                if (!docRef) return;

                const isAdmin = (this.currentAuth && (this.currentAuth.role === 'admin' || this.currentAuth.username === 'admin298'));
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

                const newMsg = {
                    sender: this.currentAuth ? this.currentAuth.username : 'guest',
                    senderName: this.currentAuth ? this.currentAuth.fullname : 'Khách',
                    senderRole: isAdmin ? 'admin' : 'user',
                    text: text,
                    time: timeStr,
                    timestamp: Date.now()
                };

                try {
                    await docRef.set({
                        targetUser: isAdmin ? this.activeChatTargetUser : this.currentAuth.username,
                        lastUpdated: Date.now(),
                        lastSenderRole: isAdmin ? 'admin' : 'user',
                        messages: firebase.firestore.FieldValue.arrayUnion(newMsg)
                    }, { merge: true });
                } catch(e) {
                    console.error("Lỗi gửi tin nhắn:", e);
                }
            },

            // Lắng nghe thông báo "Mới" cho người dùng thường
            initUserChatListener() {
                if (!this.db || !this.currentAuth) return;
                this.db.collection("support_chats").doc(this.currentAuth.username)
                    .onSnapshot(doc => {
                        if (!doc.exists) return;
                        const data = doc.data() || {};
                        const chatWin = document.getElementById('support-chat-window');
                        const isWinOpen = chatWin && !chatWin.classList.contains('hidden');
                        if (!isWinOpen && data.lastSenderRole === 'admin') {
                            const badge = document.getElementById('chat-new-badge');
                            if (badge) badge.classList.remove('hidden');
                        }
                    });
            },

            // Lắng nghe thông báo đổi màu ở bảng Admin khi có tin nhắn từ user
            initAdminChatGlobalListener() {
                if (!this.db || !this.currentAuth || this.currentAuth.role !== 'admin') return;
                this.db.collection("support_chats")
                    .where("lastSenderRole", "==", "user")
                    .onSnapshot(snapshot => {
                        this.unreadChatUsers = {};
                        snapshot.forEach(doc => {
                            this.unreadChatUsers[doc.id] = true;
                        });
                        this.renderAdminUsersTableRowsOnly();
                    });
            },

            // Khi người dùng bấm Đồng ý hoặc Tiếp tục với lệnh "End"
            async confirmEndChat(isAgree) {
                const docRef = this.getChatDocRef();
                const endConfirmBox = document.getElementById('chat-end-confirm-box');
                if (endConfirmBox) endConfirmBox.classList.add('hidden');

                if (isAgree && docRef) {
                    try {
                        await docRef.update({ isClosed: true });
                        alert("Đã kết thúc phiên hỗ trợ. Lịch sử trao đổi được lưu trữ an toàn.");
                        this.closeSupportChat();
                    } catch(e) { console.warn(e); }
                } else if (!isAgree && docRef) {
                    const now = new Date();
                    const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
                    await docRef.set({
                        isClosed: false,
                        lastSenderRole: 'user',
                        messages: firebase.firestore.FieldValue.arrayUnion({
                            sender: this.currentAuth.username,
                            senderName: this.currentAuth.fullname,
                            senderRole: 'user',
                            text: 'Em muốn tiếp tục trao đổi ạ.',
                            time: timeStr,
                            timestamp: Date.now()
                        })
                    }, { merge: true });
                }
            },

            // ==========================================
            // QUẢN TRỊ ADMIN VỚI ID TĂNG DẦN & TAB BÀI HỌC NGƯỜI DÙNG (ẢNH 3)
            // ==========================================
            async switchAdminTab(tab) {
                ['users', 'userlessons', 'support'].forEach(t => {
                    const b = document.getElementById(`tab-btn-${t}`);
                    const v = document.getElementById(`admin-view-${t}`);
                    if (b) {
                        b.className = (t === tab) 
                            ? "flex-1 py-1.5 bg-white rounded-lg shadow-sm font-bold text-[11px] text-rose-600 transition cursor-pointer"
                            : "flex-1 py-1.5 rounded-lg font-bold text-[11px] text-slate-600 hover:text-rose-600 transition cursor-pointer";
                    }
                    if (v) v.classList.toggle('hidden', t !== tab);
                });

                if (tab === 'users') this.renderAdminUsersTable();
                else if (tab === 'userlessons') this.renderAdminUserLessonsTable();
                else if (tab === 'support') this.renderAdminSupportTable();
            },

            renderAdminPanel(vp) {
                vp.innerHTML = `
                    <div class="w-full h-full flex flex-col space-y-3">
                        <div class="flex justify-between items-center shrink-0 border-b pb-2 border-slate-500/10">
                            <h3 class="font-black text-sm text-slate-800 flex items-center"><span class="w-6 h-6 rounded bg-amber-500 text-white flex items-center justify-center mr-2"><i class="fa-solid fa-user-shield text-[10px]"></i></span> Quản trị Hệ thống</h3>
                        </div>
                        <!-- BỔ SUNG THẺ "BÀI HỌC CỦA NGƯỜI DÙNG" Ở GIỮA -->
                        <div class="flex space-x-1 shrink-0 bg-slate-100 p-1 rounded-xl w-full sm:w-96">
                            <button id="tab-btn-users" onclick="CZAppCore.switchAdminTab('users')" class="flex-1 py-1.5 bg-white rounded-lg shadow-sm font-bold text-[11px] text-rose-600 transition cursor-pointer">Tài khoản</button>
                            <button id="tab-btn-userlessons" onclick="CZAppCore.switchAdminTab('userlessons')" class="flex-1 py-1.5 rounded-lg font-bold text-[11px] text-slate-600 hover:text-rose-600 transition cursor-pointer">Bài học người dùng</button>
                            <button id="tab-btn-support" onclick="CZAppCore.switchAdminTab('support')" class="flex-1 py-1.5 rounded-lg font-bold text-[11px] text-slate-600 hover:text-rose-600 transition relative cursor-pointer">Hỗ trợ <span id="admin-support-badge-in-tab" class="hidden bg-rose-600 text-white px-1.5 py-0.5 rounded-full text-[9px] ml-1">0</span></button>
                        </div>
                        <div id="admin-view-users" class="flex-1 flex flex-col min-h-0 w-full"></div>
                        <div id="admin-view-userlessons" class="hidden flex-1 flex flex-col min-h-0 w-full"></div>
                        <div id="admin-view-support" class="hidden flex-1 flex flex-col min-h-0 w-full"></div>
                    </div>
                `;
                setTimeout(() => this.switchAdminTab('users'), 50);
            },

            async renderAdminUsersTable() {
                const box = document.getElementById('admin-view-users');
                if (!box) return;

                box.innerHTML = `<div class="p-6 text-center text-xs opacity-70"><i class="fa-solid fa-spinner fa-spin mr-2 text-rose-600 text-sm"></i>Đang đồng bộ danh sách thành viên từ Firebase...</div>`;

                if (this.db) {
                    try {
                        const snapshot = await this.db.collection("users").get();
                        const cloudUsers = [];
                        snapshot.forEach(doc => { cloudUsers.push(doc.data()); });

                        cloudUsers.forEach(u => {
                            const idx = this.usersDB.findIndex(x => x.username === u.username);
                            if (idx >= 0) this.usersDB[idx] = u;
                            else this.usersDB.push(u);
                        });

                        // Tự động chuẩn hóa và khử trùng lặp ID
                        let usedIds = new Set();
                        this.usersDB.sort((a, b) => {
                            const parseD = (s) => {
                                if (!s) return 0;
                                const p = s.split('/');
                                return p.length === 3 ? new Date(`${p[2]}-${p[1]}-${p[0]}`).getTime() : 0;
                            };
                            return parseD(a.createdAt) - parseD(b.createdAt);
                        });

                        let curAutoId = 1;
                        this.usersDB.forEach(u => {
                            if (u.username === 'admin298') { u.id = 1; usedIds.add(1); return; }
                            let nid = parseInt(u.id, 10);
                            if (isNaN(nid) || nid <= 0 || usedIds.has(nid)) {
                                while (usedIds.has(curAutoId)) { curAutoId++; }
                                u.id = curAutoId;
                                usedIds.add(curAutoId);
                                if (this.db) {
                                    this.db.collection("users").doc(u.username).update({ id: u.id }).catch(() => {});
                                }
                            } else {
                                usedIds.add(nid);
                            }
                        });

                        localStorage.setItem('chinesez_users', JSON.stringify(this.usersDB));
                    } catch (err) {
                        console.error("Lỗi đồng bộ users từ Firestore:", err);
                    }
                }

                box.innerHTML = `
                    <div class="flex items-center justify-between p-2.5 border border-amber-500/20 rounded-xl mb-2 shrink-0 bg-amber-50/50">
                        <span class="text-xs font-bold text-amber-700">Cho phép Đăng ký mới</span>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="admin-reg-toggle-main" onchange="CZAppCore.toggleRegistrationAdmin(this.checked)" ${this.isRegistrationEnabled ? 'checked' : ''} class="sr-only peer">
                            <div class="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    <div class="py-2 px-3 bg-slate-50 rounded-xl mb-2 flex justify-between items-center text-xs shrink-0 border border-slate-200">
                        <div class="flex items-center space-x-2">
                            <label class="flex items-center space-x-1.5 font-bold cursor-pointer"><input type="checkbox" id="admin-check-all" onchange="CZAppCore.toggleSelectAllUsers(this.checked)" class="w-4 h-4 rounded text-rose-600"><span>Tất cả</span></label>
                            <button onclick="CZAppCore.deleteSelectedUsers()" class="px-2.5 py-1 bg-rose-600 text-white font-bold text-[10px] rounded-lg shadow-sm hover:bg-rose-700 cursor-pointer"><i class="fa-solid fa-trash-can mr-1"></i>Xóa chọn</button>
                        </div>
                        <button onclick="CZAppCore.exportAdminDataCSV()" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg shadow-sm flex items-center space-x-1 cursor-pointer transition">
                            <i class="fa-solid fa-file-csv text-xs"></i><span>Tải dữ liệu (CSV)</span>
                        </button>
                    </div>
                    <div class="admin-table-container rounded-xl border border-slate-200 bg-white shadow-sm flex-1 overflow-y-auto">
                        <table class="admin-table w-full text-left text-xs">
                            <thead class="bg-slate-100/80 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th class="p-2 w-8"></th>
                                    <th class="p-2 font-bold w-12 text-center">ID</th>
                                    <th class="p-2 font-bold">Họ tên</th>
                                    <th class="p-2 font-bold">Tài khoản</th>
                                    <th class="p-2 font-bold">Nghề nghiệp</th>
                                    <th class="p-2 font-bold text-center">Gia nhập</th>
                                    <th class="p-2 font-bold text-center">Lượt truy cập</th>
                                    <th class="p-2 font-bold text-center">Bài tạo</th>
                                    <th class="p-2 font-bold text-center">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody id="admin-users-tbody"></tbody>
                        </table>
                    </div>
                `;

                this.renderAdminUsersTableRowsOnly();
            },

            // Cập nhật riêng các hàng để đổi màu khi có tin nhắn mới hoặc sau khi xóa/sửa
            renderAdminUsersTableRowsOnly() {
                const tbody = document.getElementById('admin-users-tbody');
                if (!tbody) return;

                const list = this.usersDB.filter(u => u.username !== 'admin298');

                // SẮP XẾP THEO ID GIẢM DẦN (MỚI Ở TRÊN, CŨ Ở DƯỚI)
                list.sort((a, b) => (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0));

                if (list.length === 0) {
                    tbody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-xs opacity-50">Chưa có tài khoản nào.</td></tr>`;
                    return;
                }

                tbody.innerHTML = list.map(u => {
                    const lessonCount = this.countLessonsByOwner(u.username);
                    const hasUnread = !!this.unreadChatUsers[u.username];
                    
                    let joinDays = 0;
                    if (u.createdAt) {
                        const parts = u.createdAt.split('/');
                        if (parts.length === 3) {
                            const joinDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                            const diffTime = Math.abs(new Date() - joinDate);
                            joinDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        }
                    }

                    return `
                        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                            <td class="p-2"><input type="checkbox" value="${u.username}" class="user-row-chk w-4 h-4 rounded text-rose-600"></td>
                            <td class="p-2 font-mono font-bold text-center text-slate-500">${u.id || '-'}</td>
                            <td class="p-2 font-bold text-slate-800">${u.fullname}</td>
                            <td class="p-2">
                                <button onclick="CZAppCore.openAdminChatWithUser('${u.username}')" class="px-2 py-1 rounded-lg font-mono font-bold cursor-pointer transition ${hasUnread ? 'user-chat-alert' : 'text-rose-600 hover:bg-rose-50'}" title="Nhắn tin với ${u.username}">
                                    ${u.username} ${hasUnread ? '<span class="text-[9px] bg-red-600 text-white px-1 rounded ml-1">Tin mới</span>' : ''}
                                </button>
                            </td>
                            <td class="p-2"><span class="px-2 py-0.5 rounded-lg bg-purple-50 text-purple-700 font-semibold text-[11px] border border-purple-200">${u.job || 'Học sinh'} ${u.className ? `(${u.className})` : ''}</span></td>
                            <td class="p-2 text-center text-[10.5px]">
                                <div class="font-bold text-slate-700">${u.createdAt || 'N/A'}</div>
                                <div class="text-[9px] opacity-70">${joinDays} ngày</div>
                            </td>
                            <td class="p-2 text-center">
                                <button onclick="CZAppCore.showLoginHistoryPopup('${u.username}')" class="text-blue-600 font-bold hover:underline cursor-pointer" title="Bấm xem lịch sử các lần đăng nhập">
                                    ${u.loginCount || 1} lượt
                                </button>
                            </td>
                            <td class="p-2 font-bold text-center text-rose-600">${lessonCount}</td>
                            <td class="p-2 text-center space-x-1 whitespace-nowrap">
                                <button onclick="CZAppCore.openEditUserModal('${u.username}')" class="text-amber-600 p-1 hover:bg-amber-50 rounded cursor-pointer" title="Sửa thông tin thành viên">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button onclick="CZAppCore.deleteSingleUser('${u.username}')" class="text-rose-600 p-1 hover:bg-rose-50 rounded cursor-pointer" title="Xóa tài khoản">
                                    <i class="fa-solid fa-trash-can"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            },

            openEditUserModal(uName) {
                const u = this.usersDB.find(x => x.username === uName);
                if (!u) return;
                document.getElementById('eu-original-username').value = u.username;
                document.getElementById('eu-id').value = u.id || '';
                document.getElementById('eu-username').value = u.username;
                document.getElementById('eu-password').value = u.pass || '';
                document.getElementById('eu-fullname').value = u.fullname || '';
                document.getElementById('eu-job').value = u.job || '';
                document.getElementById('eu-class').value = u.className || '';
                document.getElementById('eu-phone').value = u.phone4 || '';
                document.getElementById('edit-user-modal').classList.remove('hidden');
            },

            async saveEditedUser() {
                const origUName = document.getElementById('eu-original-username').value;
                const newId = document.getElementById('eu-id').value.trim();
                const newUName = document.getElementById('eu-username').value.trim();
                const newPass = document.getElementById('eu-password').value.trim();
                const f = document.getElementById('eu-fullname').value.trim();
                const j = document.getElementById('eu-job').value.trim();
                const cls = document.getElementById('eu-class').value.trim();
                const ph = document.getElementById('eu-phone').value.trim();

                if (!newUName) return alert("Tên đăng nhập không được để trống!");
                if (/\s/.test(newUName)) return alert("Tên đăng nhập không được chứa khoảng trắng!");

                const u = this.usersDB.find(x => x.username === origUName);
                if (!u) return;

                // Kiểm tra nếu đổi username mà bị trùng với người khác
                if (newUName !== origUName && this.usersDB.some(x => x.username.toLowerCase() === newUName.toLowerCase())) {
                    return alert("Tên đăng nhập mới này đã tồn tại. Vui lòng chọn tên khác!");
                }

                u.id = newId;
                u.username = newUName;
                if (newPass) u.pass = newPass;
                u.fullname = f;
                u.job = j;
                u.className = cls;
                u.phone4 = ph;

                localStorage.setItem('chinesez_users', JSON.stringify(this.usersDB));
                
                if (this.db) {
                    try {
                        if (newUName !== origUName) {
                            // Cập nhật document bằng cách tạo doc mới và xóa doc cũ trên Cloud Firestore
                            await this.db.collection("users").doc(newUName).set(u);
                            await this.db.collection("users").doc(origUName).delete();
                            
                            // Cũng cần xóa bảng chat hỗ trợ (nếu có) để tránh rác
                            await this.db.collection("support_chats").doc(origUName).delete();
                        } else {
                            // Cập nhật thông thường
                            await this.db.collection("users").doc(origUName).update({
                                id: newId,
                                pass: u.pass,
                                fullname: f,
                                job: j,
                                className: cls,
                                phone4: ph
                            });
                        }
                    } catch(e) { console.warn(e); }
                }

                alert("Cập nhật thông tin thành viên thành công!");
                document.getElementById('edit-user-modal').classList.add('hidden');
                this.renderAdminUsersTableRowsOnly();
            },

            // ==========================================
            // TAB "BÀI HỌC CỦA NGƯỜI DÙNG" TRONG QUẢN TRỊ
            // ==========================================
            renderAdminUserLessonsTable() {
                const box = document.getElementById('admin-view-userlessons');
                if (!box) return;

                const list = this.usersDB.filter(u => u.username !== 'admin298');

                let rows = list.map(u => {
                    const uLessons = this.lessonsDB.filter(l => l.owner === u.username && !l.isSystem);

                    return `
                        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                            <td class="p-2 font-mono font-bold text-center text-slate-500">${u.id || '-'}</td>
                            <td class="p-2 font-mono font-bold text-rose-600">${u.username}</td>
                            <td class="p-2 font-bold text-slate-700">${uLessons.length} bài</td>
                            <td class="p-2">
                                <button onclick="CZAppCore.openUserLessonsPopup('${u.username}')" class="text-blue-600 font-bold hover:underline cursor-pointer">
                                    Xem (${uLessons.length})
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');

                box.innerHTML = `
                    <div class="admin-table-container rounded-xl border border-slate-200 bg-white shadow-sm flex-1 overflow-y-auto">
                        <table class="admin-table w-full text-left text-xs">
                            <thead class="bg-slate-100/80 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                                <tr>
                                    <th class="p-2 font-bold w-12 text-center">ID</th>
                                    <th class="p-2 font-bold">Tên đăng nhập</th>
                                    <th class="p-2 font-bold">Bài học</th>
                                    <th class="p-2 font-bold">Chi tiết</th>
                                </tr>
                            </thead>
                            <tbody>${list.length > 0 ? rows : `<tr><td colspan="4" class="text-center p-4 opacity-50">Chưa có dữ liệu bài học.</td></tr>`}</tbody>
                        </table>
                    </div>
                `;
            },

            openUserLessonsPopup(uName) {
                const uLessons = this.lessonsDB.filter(l => l.owner === uName);
                const titleEl = document.getElementById('user-lessons-modal-title');
                const listEl = document.getElementById('user-lessons-modal-list');

                titleEl.innerText = `Bài học của tài khoản: ${uName} (${uLessons.length} bài)`;

                if (uLessons.length === 0) {
                    listEl.innerHTML = `<div class="p-4 text-center text-xs opacity-50">Người dùng này chưa tạo bài học nào.</div>`;
                } else {
                    listEl.innerHTML = uLessons.map(l => {
                        let sampleControlHtml = '';
                        if (l.allowSample) {
                            sampleControlHtml = `
                                <label class="inline-flex items-center space-x-1 cursor-pointer">
                                    <input type="checkbox" onchange="CZAppCore.toggleSingleLessonAsSample('${l.id}', this.checked)" ${l.isSystem ? 'checked' : ''} class="w-4 h-4 rounded text-rose-600 cursor-pointer">
                                    <span class="text-[11px] text-emerald-600 font-bold">✓ Đồng ý</span>
                                </label>
                            `;
                        } else {
                            sampleControlHtml = `
                                <div class="flex items-center space-x-1">
                                    <input type="checkbox" disabled class="w-4 h-4 rounded opacity-40">
                                    <button type="button" onclick="CZAppCore.sendSampleProposalToUser('${uName}', '${l.id}', '${l.title.replace(/'/g, "\\'")}')" class="text-[11px] text-amber-600 font-bold underline hover:text-amber-700 cursor-pointer" title="Gửi đề xuất sử dụng làm bài học mẫu vào chat">
                                        Chưa, liên hệ
                                    </button>
                                </div>
                            `;
                        }

                        return `
                            <div class="p-2.5 theme-card rounded-2xl border flex justify-between items-center text-xs shadow-xs">
                                <div class="truncate mr-2 flex-1">
                                    <p class="font-bold truncate font-chinese">${l.title}</p>
                                    <p class="text-[9.5px] opacity-60">Ngày tạo: ${l.date || '2026-11-01'} | ${l.vocabs ? l.vocabs.length : 0} từ</p>
                                </div>
                                <div class="flex items-center space-x-2 shrink-0">
                                    <button onclick="CZAppCore.previewLessonInPopup('${l.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer">Xem thử</button>
                                    ${sampleControlHtml}
                                </div>
                            </div>
                        `;
                    }).join('');
                }

                document.getElementById('user-lessons-modal').classList.remove('hidden');
            },

            // XEM TRƯỚC BÀI HỌC THEO ĐÚNG GIAO DIỆN CHUẨN CỦA APP (ẢNH CUỐI GỬI)
            previewLessonInPopup(lessonId) {
                const lesson = this.lessonsDB.find(x => String(x.id) === String(lessonId));
                if (!lesson) return;

                document.getElementById('preview-lesson-title').innerText = lesson.title;
                const stage = document.getElementById('preview-lesson-stage');

                const vocabs = lesson.vocabs || [];
                const firstVocab = vocabs[0] || { hanzi: "你好", pinyin: "nǐ hǎo", meaning: "Xin chào" };

                stage.innerHTML = `
                    <div class="h-full flex flex-col justify-between py-1 space-y-2">
                        <div class="flex justify-between items-center px-1">
                            <span class="text-xs font-black text-rose-600 bg-rose-500/10 px-2.5 py-0.5 rounded-full">Từ #1/${vocabs.length}</span>
                            <span class="text-xs opacity-60 font-mono">${lesson.owner || 'user'}</span>
                        </div>
                        <div class="theme-card p-6 rounded-3xl border text-center shadow-xs my-auto">
                            <h2 class="text-6xl font-black text-rose-600 font-chinese mb-2">${firstVocab.hanzi}</h2>
                            <p class="text-2xl font-bold text-rose-500">${firstVocab.pinyin}</p>
                            <p class="text-base font-semibold mt-3 text-slate-700 dark:text-slate-200">${firstVocab.meaning}</p>
                        </div>
                        <div class="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border text-left text-xs space-y-1">
                            <p class="font-bold text-rose-600">📝 Câu ví dụ:</p>
                            <p class="font-chinese text-sm font-bold">${firstVocab.example_cn || firstVocab.example || firstVocab.hanzi}</p>
                            <p class="text-rose-500 font-semibold">${firstVocab.example_py || firstVocab.pinyin}</p>
                            <p class="opacity-80">${firstVocab.example_vi || firstVocab.meaning}</p>
                        </div>
                    </div>
                `;

                document.getElementById('preview-lesson-modal').classList.remove('hidden');
            },

            async promoteLessonToSampleDirect(lessonId) {
                const l = this.lessonsDB.find(x => String(x.id) === String(lessonId));
                if (!l) return;
                if (!confirm(`Bạn có chắc chắn muốn đưa bài học "${l.title}" lên làm Bài học mẫu không?`)) return;

                l.isSystem = true;
                localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));

                if (this.db) {
                    try {
                        await this.db.collection("system_lessons").doc(String(l.id)).set(l);
                        await this.db.collection("user_lessons").doc(String(l.id)).delete();
                    } catch(e) { console.warn("Lỗi Firestore:", e); }
                }

                alert(`Đã đưa bài "${l.title}" sang danh mục Bài học mẫu thành công!`);
                this.renderRoomCategoryView(document.getElementById('main-viewport'));
            },

            async demoteLessonFromSampleDirect(lessonId) {
                const l = this.lessonsDB.find(x => String(x.id) === String(lessonId));
                if (!l) return;
                if (!confirm(`Bạn có chắc muốn thu hồi bài học "${l.title}" về lại Bài học của bạn không?`)) return;

                l.isSystem = false;
                localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));

                if (this.db) {
                    try {
                        await this.db.collection("system_lessons").doc(String(l.id)).delete();
                        await this.db.collection("user_lessons").doc(String(l.id)).set(l);
                    } catch(e) { console.warn("Lỗi Firestore:", e); }
                }

                alert(`Đã thu hồi bài "${l.title}" về danh mục cá nhân thành công!`);
                this.renderRoomCategoryView(document.getElementById('main-viewport'));
            },

            async toggleSingleLessonAsSample(lessonId, isChecked) {
                const l = this.lessonsDB.find(x => String(x.id) === String(lessonId));
                if (!l) return;
                l.isSystem = isChecked;
                localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));
                if (this.db) {
                    try {
                        if (isChecked) {
                            await this.db.collection("system_lessons").doc(String(l.id)).set(l);
                        } else {
                            await this.db.collection("system_lessons").doc(String(l.id)).delete();
                        }
                    } catch(e) { console.warn(e); }
                }
                alert(isChecked ? `Đã đưa bài "${l.title}" vào Bài học mẫu!` : `Đã bỏ bài "${l.title}" khỏi Bài học mẫu!`);
            },

            async sendSampleProposalToUser(targetUsername, lessonId, lessonTitle) {
                if (!this.db) return alert("Chưa kết nối cơ sở dữ liệu Firebase!");
                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;

                const proposalMsg = {
                    sender: 'admin298',
                    senderName: 'Quản Trị Viên',
                    senderRole: 'admin',
                    type: 'sample_proposal',
                    lessonId: lessonId,
                    lessonTitle: lessonTitle,
                    responded: false,
                    text: `Admin đề xuất sử dụng bài học <b>${lessonTitle}</b> của bạn làm bài học mẫu. Bạn vui lòng cho biết ý kiến bên dưới.`,
                    time: timeStr,
                    timestamp: Date.now()
                };

                try {
                    await this.db.collection("support_chats").doc(targetUsername).set({
                        targetUser: targetUsername,
                        lastUpdated: Date.now(),
                        lastSenderRole: 'admin',
                        messages: firebase.firestore.FieldValue.arrayUnion(proposalMsg)
                    }, { merge: true });
                    alert(`Đã gửi tin nhắn đề xuất bài học đến học viên [${targetUsername}]!`);
                } catch(e) {
                    alert("Lỗi khi gửi đề xuất: " + e.message);
                }
            },

            async respondSampleProposal(lessonId, isAgree, msgIndex) {
                const docRef = this.getChatDocRef();
                if (!docRef) return;

                const l = this.lessonsDB.find(x => String(x.id) === String(lessonId));
                if (isAgree && l) {
                    l.allowSample = true;
                    localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));
                    if (this.db) {
                        this.db.collection("user_lessons").doc(String(lessonId)).update({ allowSample: true }).catch(() => {});
                    }
                }

                const now = new Date();
                const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
                const replyText = isAgree 
                    ? "Admin cảm ơn bạn đã đóng góp vì cộng đồng. Chúc bạn luôn vui vẻ và học tập tốt!" 
                    : "Admin cảm ơn đã phản hồi. Chúc bạn luôn vui vẻ và học tập tốt!";

                try {
                    const doc = await docRef.get();
                    if (doc.exists) {
                        const data = doc.data() || {};
                        const msgs = data.messages || [];
                        if (msgs[msgIndex]) {
                            msgs[msgIndex].responded = true;
                        }
                        msgs.push({
                            sender: 'admin298',
                            senderName: 'Quản Trị Viên',
                            senderRole: 'admin',
                            text: replyText,
                            time: timeStr,
                            timestamp: Date.now()
                        });
                        await docRef.set({ messages: msgs, lastSenderRole: 'admin', lastUpdated: Date.now() }, { merge: true });
                    }
                } catch(e) { console.warn(e); }
            },

            showDocInfoModal(lessonId) {
                const l = this.lessonsDB.find(x => String(x.id) === String(lessonId));
                if (!l) return;
                document.getElementById('doc-info-filename').innerText = l.link || 'Tệp ảnh tải lên';
                const btnStudy = document.getElementById('doc-info-btn-study');
                btnStudy.onclick = () => {
                    document.getElementById('doc-info-modal').classList.add('hidden');
                    CZCardEngine.openLessonStudy(l.id);
                };
                document.getElementById('doc-info-modal').classList.remove('hidden');
            },

            showLoginHistoryPopup(uName) {
                const u = this.usersDB.find(x => x.username === uName);
                if (!u) return;
                document.getElementById('login-history-title').innerText = `Lịch sử: ${u.fullname} (${u.username})`;
                document.getElementById('login-history-latest').innerText = u.lastLogin || (u.loginHistory && u.loginHistory[0]) || 'Chưa có thông tin';

                const listEl = document.getElementById('login-history-list');
                const hist = u.loginHistory || [];
                if (hist.length === 0) {
                    listEl.innerHTML = `<p class="text-xs opacity-50 italic">Chưa ghi nhận lượt đăng nhập trước đó.</p>`;
                } else {
                    listEl.innerHTML = hist.map((t, idx) => `
                        <div class="flex justify-between py-1 border-b border-slate-100 text-[11px]">
                            <span class="opacity-70 font-semibold">Lần ${hist.length - idx}:</span>
                            <span class="font-mono text-slate-700 dark:text-slate-300">${t}</span>
                        </div>
                    `).join('');
                }
                document.getElementById('login-history-modal').classList.remove('hidden');
            },

            openCreatorDiscussion(creatorName) {
                console.log("Liên kết diễn đàn forum với tác giả:", creatorName);
                this.openAdminChatWithUser(creatorName);
            },

            async toggleUserLessonsAsSample(uName, isChecked) {
                const uLessons = this.lessonsDB.filter(l => l.owner === uName);
                if (uLessons.length === 0) return;

                for (const l of uLessons) {
                    l.isSystem = isChecked;
                    if (this.db) {
                        try {
                            if (isChecked) {
                                await this.db.collection("system_lessons").doc(String(l.id)).set(l);
                            } else {
                                await this.db.collection("system_lessons").doc(String(l.id)).delete();
                            }
                        } catch(e) {}
                    }
                }

                localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));
                alert(isChecked ? `Đã đưa bài học của [${uName}] vào Bài học mẫu!` : `Đã bỏ bài học của [${uName}] khỏi Bài học mẫu!`);
            },

            // ==========================================
            // HỖ TRỢ TRỰC TUYẾN DÀNH CHO ADMIN
            // ==========================================
            async renderAdminSupportTable() {
                const box = document.getElementById('admin-view-support');
                if (!box) return;

                box.innerHTML = `<div class="p-6 text-center text-xs opacity-70"><i class="fa-solid fa-spinner fa-spin mr-2 text-rose-600 text-sm"></i>Đang đồng bộ tin nhắn hỗ trợ từ Firebase...</div>`;

                if (this.db) {
                    try {
                        const snapshot = await this.db.collection("support_chats").get();
                        const chatSessions = [];
                        snapshot.forEach(doc => {
                            chatSessions.push({ username: doc.id, ...doc.data() });
                        });

                        if (chatSessions.length === 0) {
                            box.innerHTML = `<div class="text-center p-4 text-xs opacity-60">Chưa có phiên chat hỗ trợ nào.</div>`;
                            return;
                        }

                        let rows = chatSessions.map(c => {
                            const lastMsg = (c.messages && c.messages[c.messages.length - 1]) || {};
                            return `
                                <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                                    <td class="p-2.5 font-mono font-bold text-rose-600">${c.username}</td>
                                    <td class="p-2.5 text-xs text-slate-500">${lastMsg.time || ''}</td>
                                    <td class="p-2.5 text-xs truncate max-w-[200px]">${lastMsg.text || '...'}</td>
                                    <td class="p-2.5 text-center">
                                        <button onclick="CZAppCore.openAdminChatWithUser('${c.username}')" class="px-3 py-1 btn-3d rounded-lg text-[11px] font-bold cursor-pointer">
                                            Vào chat
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('');

                        box.innerHTML = `
                            <div class="admin-table-container rounded-xl border border-slate-200 bg-white shadow-sm flex-1 overflow-y-auto">
                                <table class="admin-table w-full text-left text-xs">
                                    <thead class="bg-slate-100/80 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                                        <tr>
                                            <th class="p-2.5 font-bold">Tài khoản</th>
                                            <th class="p-2.5 font-bold">Thời gian</th>
                                            <th class="p-2.5 font-bold">Tin mới nhất</th>
                                            <th class="p-2.5 font-bold text-center">Hành động</th>
                                        </tr>
                                    </thead>
                                    <tbody>${rows}</tbody>
                                </table>
                            </div>
                        `;
                    } catch(e) {
                        box.innerHTML = `<div class="p-4 text-xs text-red-600">Lỗi kết nối máy chủ chat: ${e.message}</div>`;
                    }
                }
            },

            // Quản trị viên
            exportAdminDataCSV() {
                const list = this.usersDB.filter(u => u.username !== 'admin298');
                let jobStats = {};
                list.forEach(u => {
                    const j = u.job || "Chưa cập nhật";
                    jobStats[j] = (jobStats[j] || 0) + 1;
                });

                let csvContent = "\uFEFF";
                csvContent += "=== BẢNG DANH SÁCH THÀNH VIÊN ===\n";
                csvContent += "ID,Tên đăng nhập,Họ và tên,Nghề nghiệp,Lớp,Số bài đã tạo,Ngày đăng ký\n";
                list.forEach(u => {
                    const lessonCount = this.countLessonsByOwner(u.username);
                    csvContent += `"${u.id || ''}","${u.username}","${u.fullname}","${u.job || 'Học sinh'}","${u.className || ''}","${lessonCount}","${u.createdAt || ''}"\n`;
                });

                csvContent += "\n=== THỐNG KÊ THÀNH VIÊN THEO NGHỀ NGHIỆP ===\n";
                csvContent += "Nghề nghiệp,Số lượng thành viên\n";
                for (let [job, count] of Object.entries(jobStats)) {
                    csvContent += `"${job}","${count}"\n`;
                }

                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Danh_Sach_Thanh_Vien_ChineseZ298_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            },

            toggleRegistrationAdmin(val) { this.isRegistrationEnabled = val; localStorage.setItem('cz_reg_enabled', val); },
            toggleSelectAllUsers(isChecked) { document.querySelectorAll('.user-row-chk').forEach(c => c.checked = isChecked); },
            async deleteSingleUser(uName) {
                if (!confirm(`Bạn có chắc muốn xóa tài khoản [${uName}] không?`)) return;
                if (this.db) { try { await this.db.collection("users").doc(uName).delete(); } catch(e) {} }
                this.usersDB = this.usersDB.filter(x => x.username !== uName); 
                localStorage.setItem('chinesez_users', JSON.stringify(this.usersDB)); 
                this.renderAdminUsersTableRowsOnly();
            },
            async deleteSelectedUsers() {
                const checked = Array.from(document.querySelectorAll('.user-row-chk:checked')).map(c => c.value);
                if (checked.length === 0) { alert("Vui lòng chọn ít nhất 1 tài khoản!"); return; }
                if (!confirm(`Bạn có chắc muốn xóa ${checked.length} tài khoản không?`)) return;
                for (const uName of checked) { 
                    if (this.db) { try { await this.db.collection("users").doc(uName).delete(); } catch(e) {} } 
                    this.usersDB = this.usersDB.filter(x => x.username !== uName); 
                }
                localStorage.setItem('chinesez_users', JSON.stringify(this.usersDB)); 
                this.renderAdminUsersTableRowsOnly();
            },

            // Tab điều hướng Dashboard
            setTab(tab) {
                ['home', 'profile', 'create', 'room', 'chat', 'admin'].forEach(t => {
                    const b = document.getElementById(`tbtn-${t}`) || (t === 'admin' ? document.getElementById('admin-box') : null);
                    if (b) {
                        if (t === tab) b.classList.add('btn-3d');
                        else b.classList.remove('btn-3d');
                    }
                });
                const vp = document.getElementById('main-viewport');
                
                if (tab === 'home') {
                    const g = this.getGreeting();
                    vp.innerHTML = `
                        <div class="space-y-3 sm:space-y-4 max-w-lg w-full my-auto px-2">
                            <div class="home-zhong-icon w-16 h-16 bg-rose-600 rounded-3xl flex items-center justify-center mx-auto text-3xl font-black text-white shadow-lg shadow-rose-500/30 shrink-0">中</div>
                            <h1 class="home-welcome-title text-3xl sm:text-5xl title-3d-ruby uppercase leading-tight tracking-wider py-1">CHÀO MỪNG BẠN</h1>
                            <div class="home-card-greeting p-4 sm:p-5 rounded-2xl theme-card border shadow-xs flex items-center space-x-3 sm:space-x-4 text-left">
                                <img src="./logo.png" onerror="this.onerror=null; this.src='logo.png';" alt="Chú Kiến" class="w-16 h-16 sm:w-20 sm:h-20 object-contain ant-flipped-right shrink-0 drop-shadow-sm">
                                <div class="flex-1 space-y-1"><span class="text-2xl">${g.icon}</span><p class="text-xs sm:text-sm font-semibold opacity-90 leading-relaxed italic">"${g.text}"</p></div>
                            </div>
                            <div class="pt-1 sm:pt-2"><button onclick="CZAppCore.setTab('room')" class="px-8 py-3.5 btn-3d font-bold text-sm rounded-2xl cursor-pointer shadow-md"><i class="fa-solid fa-graduation-cap mr-2"></i> Bắt đầu ôn tập ngay</button></div>
                        </div>`;
                } else if (tab === 'profile') {
                    this.renderProfileView(vp);
                } else if (tab === 'create') {
                    this.renderCreateView(vp);
                } else if (tab === 'room') { 
                    this.renderRoomCategoryView(vp); 
                } else if (tab === 'chat') { 
                    this.renderChatInterface(vp); 
                } else if (tab === 'admin') {
                    this.renderAdminPanel(vp);
                }
            },

            renderCreateView(vp) {
                const isAdmin = this.currentAuth && (this.currentAuth.role === 'admin' || this.currentAuth.username === 'admin298');
                this.uploadedLessonFile = null;
                vp.innerHTML = `
                    <div class="w-full max-w-md space-y-2.5 text-left my-auto">
                        <div class="mb-0.5"><h3 class="text-sm sm:text-base font-bold text-rose-600">Tạo bài học mới</h3></div>
                        <div>
                            <label class="block text-[10px] font-bold opacity-80 uppercase mb-0.5">Tên bài học</label>
                            <input type="text" id="in-lesson-title" placeholder="Ví dụ: Bài 21: Giao tiếp đặt xe & Khách sạn" class="w-full custom-input rounded-xl px-3 py-1.5 text-xs focus:outline-none">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold opacity-80 uppercase mb-0.5">Dán link drive tài liệu (pdf/word)</label>
                            <div class="flex items-center gap-1.5">
                                <input type="text" id="in-lesson-link" placeholder="Link ở dạng chia sẻ mức độ xem" class="flex-1 custom-input rounded-xl px-3 py-1.5 text-xs focus:outline-none">
                                <button type="button" onclick="CZAppCore.addExtraDriveLinkInput()" class="w-8 h-8 rounded-xl bg-purple-500 text-white font-bold flex items-center justify-center shrink-0 shadow-sm hover:scale-105 cursor-pointer transition" title="Thêm ô link tiếp theo">
                                    <i class="fa-solid fa-plus text-xs"></i>
                                </button>
                            </div>
                            <div id="extra-links-container"></div>
                        </div>

                        <div class="pt-1">
                            <div class="flex items-center justify-center gap-2 mb-1.5 text-[10px] opacity-60 font-bold uppercase">
                                <span class="h-[1px] bg-slate-300 dark:bg-slate-700 flex-1"></span>
                                <span>Hay</span>
                                <span class="h-[1px] bg-slate-300 dark:bg-slate-700 flex-1"></span>
                            </div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <input type="file" id="file-lesson-upload" onchange="CZAppCore.onFileSelectedForLesson(event)" accept="image/*,.pdf,.txt,.doc,.docx" class="hidden">
                                <button type="button" onclick="document.getElementById('file-lesson-upload').click()" class="px-3.5 py-2 rounded-xl text-xs font-bold border border-rose-300/80 bg-white hover:bg-rose-50 text-rose-700 flex items-center space-x-1.5 cursor-pointer transition shadow-xs">
                                    <i class="fa-solid fa-cloud-arrow-up text-rose-600"></i>
                                    <span>Tải lên ảnh/file bài học</span>
                                </button>
                                <div id="uploaded-file-badge" class="hidden flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-[11px] font-semibold max-w-[200px] truncate shadow-xs">
                                    <i class="fa-regular fa-file-lines text-xs"></i>
                                    <span id="uploaded-file-name" class="truncate"></span>
                                    <button type="button" onclick="CZAppCore.removeUploadedLessonFile()" class="text-rose-500 hover:text-rose-700 ml-1 font-bold cursor-pointer">✕</button>
                                </div>
                            </div>
                        </div>

                        <div class="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-[11px] font-semibold flex items-start space-x-2 leading-relaxed" style="color: var(--text-main);">
                            <span class="not-italic shrink-0 text-base">💡</span>
                            <span>Mẹo: Tài liệu đưa lên rõ ràng hai mục từ vựng và ngữ pháp thì ứng dụng hỗ trợ càng tốt nhé!</span>
                        </div>

                        ${isAdmin ? `
                        <div class="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center space-x-2.5">
                            <input type="checkbox" id="in-is-system" class="w-4 h-4 rounded text-amber-600 cursor-pointer">
                            <label for="in-is-system" class="text-xs font-bold cursor-pointer" style="color: var(--text-main);">🌟 Đăng làm bài học mẫu</label>
                        </div>` : `
                        <div class="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center space-x-2.5">
                            <input type="checkbox" id="in-allow-sample" class="w-4 h-4 rounded text-emerald-600 cursor-pointer" checked>
                            <label for="in-allow-sample" class="text-xs font-bold cursor-pointer" style="color: var(--text-main);">🤝 Đồng ý để admin sử dụng làm tài liệu cho bài học mẫu</label>
                        </div>`}

                        <div id="ai-creating-status" class="hidden p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 font-bold text-xs text-center animate-pulse">
                            🤖 AI đang phân tích tài liệu và soạn bài tập... Vui lòng đợi trong giây lát!
                        </div>

                        <div id="create-action-buttons" class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                            <button onclick="CZAppCore.saveLesson(false)" class="py-2.5 px-2.5 btn-theme-sec font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center space-x-1">
                                <i class="fa-solid fa-cloud-arrow-up text-xs"></i> <span>Tạo từ tài liệu đính kèm</span>
                            </button>
                            <button onclick="CZAppCore.saveLesson(true)" class="py-2.5 px-2.5 btn-3d font-bold text-xs rounded-xl cursor-pointer flex items-center justify-center space-x-1">
                                <i class="fa-solid fa-wand-magic-sparkles text-xs"></i> <span>✨ Tôi nhập tên bài, AI tạo</span>
                            </button>
                        </div>
                    </div>
                `;
            },

            // Các chức năng hỗ trợ tạo bài
            countLessonsByOwner(username) {
                return this.lessonsDB.filter(l => l.owner === username).length;
            },

            openApiSetupModal(isFirstLogin = false) {
                let k = (localStorage.getItem('user_gemini_api_key') || "").trim();
                const statusText = document.getElementById('api-current-value');
                const lblInput = document.getElementById('lbl-api-input');
                document.getElementById('popup-gemini-key').value = "";
                
                if (k && k.length >= 10) {
                    statusText.className = "text-xs font-black px-2.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
                    statusText.innerText = "✓ Đã có";
                } else {
                    statusText.className = "text-xs font-black px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20";
                    statusText.innerText = "✗ Chưa có";
                }

                if (isFirstLogin && !k) {
                    lblInput.innerText = "DÁN API KEY VÀO ĐÂY";
                } else {
                    lblInput.innerText = "CẬP NHẬT API KEY MỚI:";
                }
                document.getElementById('api-setup-modal').classList.remove('hidden');
            },
            closeApiSetupModal() { document.getElementById('api-setup-modal').classList.add('hidden'); },
            saveApiKeyFromPopup() {
                const k = document.getElementById('popup-gemini-key').value.trim();
                if (!k) {
                    localStorage.removeItem('user_gemini_api_key');
                    alert("Đã xóa Key. Ứng dụng sẽ dùng chế độ offline.");
                    this.closeApiSetupModal();
                    if (this.currentAuth) this.setTab('profile');
                    return;
                }
                if (k.length < 15) {
                    alert("⚠️ Chuỗi API Key quá ngắn hoặc không hợp lệ. Vui lòng kiểm tra và dán đúng mã Key!");
                    return;
                }
                localStorage.setItem('user_gemini_api_key', k);
                alert("✅ Đã lưu Gemini API Key cá nhân thành công!");
                this.closeApiSetupModal();
                if (this.currentAuth) this.setTab('profile');
            },
            skipApiKeySetup() { this.closeApiSetupModal(); },

            getGreeting() {
                const h = new Date().getHours();
                if (h >= 5 && h < 11) return { text: "Chúc bạn một buổi sáng tràn đầy năng lượng và một buổi học thật hiệu quả! Bạn hãy chọn các thẻ chức năng để bắt đầu nhé!", icon: "☀️" };
                if (h >= 11 && h < 18) return { text: "Chúc bạn một buổi chiều thật thư thái và một buổi học thật hiệu quả! Bạn hãy chọn các thẻ chức năng để bắt đầu nhé!", icon: "🌤️" };
                return { text: "Chúc bạn một buổi tối an lành và một buổi học thật hiệu quả! Bạn hãy chọn các thẻ chức năng để bắt đầu nhé!", icon: "🌙" };
            },

            onFileSelectedForLesson(e) {
                const file = e.target.files[0];
                if (!file) return;
                this.uploadedLessonFile = file;
                const badge = document.getElementById('uploaded-file-badge');
                const nameEl = document.getElementById('uploaded-file-name');
                if (badge && nameEl) {
                    nameEl.innerText = file.name;
                    badge.classList.remove('hidden');
                }
            },
            removeUploadedLessonFile() {
                this.uploadedLessonFile = null;
                const input = document.getElementById('file-lesson-upload');
                if (input) input.value = '';
                const badge = document.getElementById('uploaded-file-badge');
                if (badge) badge.classList.add('hidden');
            },
            addExtraDriveLinkInput() {
                const mainInput = document.getElementById('in-lesson-link');
                const container = document.getElementById('extra-links-container');
                if (!mainInput || !container) return;
                
                const linkVal = mainInput.value.trim();
                if (!linkVal) {
                    alert("Vui lòng dán link drive vào ô trước khi bấm nút + nhé!");
                    mainInput.focus();
                    return;
                }

                const div = document.createElement('div');
                div.className = "flex items-center gap-1.5 mt-1.5";
                div.innerHTML = `
                    <input type="text" value="${linkVal}" readonly class="extra-drive-link flex-1 custom-input rounded-xl px-3 py-1.5 text-xs bg-slate-100 text-slate-800 opacity-95 truncate cursor-default focus:outline-none">
                    <button type="button" onclick="this.parentElement.remove()" class="w-8 h-8 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center shrink-0 cursor-pointer transition shadow-xs" title="Xóa link này">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                `;
                container.appendChild(div);
                mainInput.value = '';
                mainInput.focus();
            },

            switchRoomCategory(cat) { this.currentRoomCategory = cat; this.currentRoomPage = 1; this.renderRoomCategoryView(document.getElementById('main-viewport')); },
            changeRoomPage(delta) { this.currentRoomPage += delta; this.renderRoomCategoryView(document.getElementById('main-viewport')); },
            renderRoomCategoryView(vp) {
                const isSample = (this.currentRoomCategory === 'sample');
                const targetList = this.lessonsDB.filter(it => isSample ? it.isSystem : !it.isSystem);
                const isAdmin = this.currentAuth && (this.currentAuth.role === 'admin' || this.currentAuth.username === 'admin298');

                const totalPages = Math.ceil(targetList.length / this.LESSONS_PER_PAGE) || 1;
                if (this.currentRoomPage > totalPages) this.currentRoomPage = totalPages;
                if (this.currentRoomPage < 1) this.currentRoomPage = 1;

                const startIndex = (this.currentRoomPage - 1) * this.LESSONS_PER_PAGE;
                const pageItems = targetList.slice(startIndex, startIndex + this.LESSONS_PER_PAGE);

                let listHtml = '';
                if (pageItems.length === 0) {
                    listHtml = `
                        <div class="p-6 text-center space-y-2 my-auto opacity-70">
                            <i class="fa-regular fa-folder-open text-3xl text-rose-500 mb-1"></i>
                            <p class="text-xs font-semibold">Chưa có bài học nào trong danh mục này.</p>
                        </div>
                    `;
                } else {
                    listHtml = pageItems.map(it => {
                        let sourceLinkHtml = '';
                        if (isSample) {
                            if (it.owner === 'admin298' || (!it.owner && it.isSystem)) {
                                sourceLinkHtml = `<button type="button" onclick="CZAppCore.toggleSupportChat(event)" class="text-rose-500 underline font-bold cursor-pointer" title="Liên hệ Quản trị viên">Admin</button>`;
                            } else {
                                sourceLinkHtml = `<button type="button" onclick="CZAppCore.openCreatorDiscussion('${it.owner}')" class="text-rose-500 underline font-bold cursor-pointer" title="Trao đổi với người tạo bài học">Tạo bởi ${it.owner}</button>`;
                            }
                        } else {
                            const isOnline = it.link && (it.link.startsWith('http://') || it.link.startsWith('https://'));
                            if (isOnline) {
                                sourceLinkHtml = `<a href="${it.link}" target="_blank" class="text-rose-500 underline font-semibold">Tài liệu</a>`;
                            } else {
                                sourceLinkHtml = `<button type="button" onclick="CZAppCore.showDocInfoModal('${it.id}')" class="text-rose-500 underline font-semibold cursor-pointer">Tài liệu</button>`;
                            }
                        }

                        let adminActionBtn = '';
                        if (isAdmin) {
                            if (!isSample) {
                                adminActionBtn = `
                                    <button onclick="CZAppCore.promoteLessonToSampleDirect('${it.id}')" class="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shrink-0 cursor-pointer shadow-xs transition" title="Đưa bài này lên danh mục Bài học mẫu">
                                        ⭐ Đưa lên mẫu
                                    </button>
                                `;
                            } else {
                                adminActionBtn = `
                                    <button onclick="CZAppCore.demoteLessonFromSampleDirect('${it.id}')" class="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl shrink-0 cursor-pointer shadow-xs transition" title="Rút bài này về lại Bài học của bạn">
                                        ↩ Thu hồi
                                    </button>
                                `;
                            }
                        }

                        return `
                            <div class="p-2.5 theme-card rounded-2xl flex justify-between items-center text-left border border-slate-500/10 hover:border-rose-500/30 transition shadow-xs">
                                <div class="truncate mr-2 flex-1">
                                    <p class="text-xs sm:text-sm font-bold truncate font-chinese">${it.title}</p>
                                    <p class="text-[9px] opacity-60">Ngày: ${it.date || '2026-11-01'} | ${sourceLinkHtml}</p>
                                </div>
                                <div class="flex items-center space-x-1.5 shrink-0">
                                    ${adminActionBtn}
                                    <button onclick="CZCardEngine.openLessonStudy('${it.id}')" class="px-3.5 py-1.5 btn-3d text-xs font-bold rounded-xl cursor-pointer">Vào học</button>
                                </div>
                            </div>
                        `;
                    }).join('');
                }

                vp.innerHTML = `
                    <div class="w-full max-w-md space-y-2 text-left my-auto h-full flex flex-col justify-between py-1">
                        <div class="shrink-0 space-y-2">
                            <div class="flex justify-between items-center">
                                <h3 class="text-sm sm:text-base font-bold">Phòng học thông minh</h3>
                                <div class="space-x-2">
                                    ${!isSample ? `<button onclick="CZAppCore.openManageLessonsModal()" class="text-xs text-rose-600 font-bold hover:underline cursor-pointer"><i class="fa-solid fa-trash-can mr-1"></i>Xóa bài học</button>` : ''}
                                    <button onclick="CZAppCore.setTab('create')" class="text-xs text-rose-500 font-bold underline cursor-pointer">+ Thêm bài</button>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <button onclick="CZAppCore.switchRoomCategory('sample')" class="py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${isSample ? 'btn-3d' : 'theme-card border opacity-70 hover:opacity-100'}">
                                    <i class="fa-solid fa-book-bookmark text-xs"></i>
                                    <span>Bài học mẫu (${this.lessonsDB.filter(x => x.isSystem).length})</span>
                                </button>
                                <button onclick="CZAppCore.switchRoomCategory('user')" class="py-2 px-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${!isSample ? 'btn-3d' : 'theme-card border opacity-70 hover:opacity-100'}">
                                    <i class="fa-solid fa-user-pen text-xs"></i>
                                    <span>Bài học của bạn (${this.lessonsDB.filter(x => !x.isSystem).length})</span>
                                </button>
                            </div>
                        </div>

                        <div class="space-y-1.5 flex-1 min-h-0 flex flex-col justify-start">
                            ${listHtml}
                        </div>

                        <div class="shrink-0 flex justify-between items-center pt-1 border-t border-slate-500/10 text-xs font-bold">
                            <button onclick="CZAppCore.changeRoomPage(-1)" ${this.currentRoomPage <= 1 ? 'disabled class="px-3 py-1 rounded-xl theme-card opacity-40 cursor-not-allowed"' : 'class="px-3 py-1 rounded-xl theme-card border hover:border-rose-500 cursor-pointer"'}>
                                <i class="fa-solid fa-chevron-left mr-1"></i> Trang trước
                            </button>
                            <span class="opacity-75">Trang <b class="text-rose-600">${this.currentRoomPage}</b> / ${totalPages}</span>
                            <button onclick="CZAppCore.changeRoomPage(1)" ${this.currentRoomPage >= totalPages ? 'disabled class="px-3 py-1 rounded-xl theme-card opacity-40 cursor-not-allowed"' : 'class="px-3 py-1 rounded-xl theme-card border hover:border-rose-500 cursor-pointer"'}>
                                Trang sau <i class="fa-solid fa-chevron-right ml-1"></i>
                            </button>
                        </div>
                    </div>
                `;
            },

            openManageLessonsModal() {
                const modal = document.getElementById('manage-lessons-modal');
                const box = document.getElementById('manage-lessons-list-box');
                const checkAll = document.getElementById('manage-check-all-lessons');
                if (checkAll) checkAll.checked = false;
                
                const isAdmin = this.currentAuth && (this.currentAuth.role === 'admin' || this.currentAuth.username === 'admin298');
                let userLessons = this.lessonsDB.filter(it => !it.isSystem);
                if (!isAdmin) {
                    userLessons = userLessons.filter(it => it.owner === (this.currentAuth ? this.currentAuth.username : 'guest'));
                }
                userLessons.sort((a,b) => (b.id || 0) - (a.id || 0));

                if (userLessons.length === 0) {
                    box.innerHTML = `<div class="p-6 text-center text-xs opacity-50">Bạn chưa có bài học tự tạo nào để xóa.</div>`;
                } else {
                    box.innerHTML = userLessons.map(l => `
                        <div class="p-2.5 bg-white border border-slate-200 rounded-xl flex justify-between items-center text-xs shadow-sm">
                            <label class="flex items-center space-x-2.5 cursor-pointer truncate mr-2">
                                <input type="checkbox" value="${l.id}" class="manage-lesson-chk w-4 h-4 rounded text-rose-600 cursor-pointer">
                                <div class="truncate">
                                    <p class="font-bold text-slate-800 truncate">${l.title}</p>
                                    <p class="text-[9px] opacity-60">Ngày tạo: ${l.date || '2026-11-01'}</p>
                                </div>
                            </label>
                            <button onclick="CZAppCore.deleteSingleUserLesson('${l.id}')" class="text-rose-600 px-2 py-1 hover:bg-rose-50 rounded cursor-pointer" title="Xóa bài này">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    `).join('');
                }
                modal.classList.remove('hidden');
            },
            closeManageLessonsModal() { document.getElementById('manage-lessons-modal').classList.add('hidden'); },
            toggleSelectAllUserLessons(isChecked) { document.querySelectorAll('.manage-lesson-chk').forEach(c => c.checked = isChecked); },
            async deleteSingleUserLesson(id) {
                if (!confirm("Bạn có chắc chắn muốn xóa bài học này không?")) return;
                if (this.db) {
                    try {
                        await this.db.collection("user_lessons").doc(String(id)).delete();
                        await this.db.collection("system_lessons").doc(String(id)).delete();
                    } catch(e) {}
                }
                this.lessonsDB = this.lessonsDB.filter(x => x.id != id);
                localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));
                this.openManageLessonsModal();
                this.renderRoomCategoryView(document.getElementById('main-viewport'));
            },
            async deleteSelectedUserLessons() {
                const checked = Array.from(document.querySelectorAll('.manage-lesson-chk:checked')).map(c => c.value);
                if (checked.length === 0) { alert("Vui lòng chọn ít nhất 1 bài học cần xóa!"); return; }
                if (!confirm(`Bạn có chắc muốn xóa ${checked.length} bài học đã chọn không?`)) return;
                for (const id of checked) {
                    if (this.db) {
                        try {
                            await this.db.collection("user_lessons").doc(String(id)).delete();
                            await this.db.collection("system_lessons").doc(String(id)).delete();
                        } catch(e) {}
                    }
                    this.lessonsDB = this.lessonsDB.filter(x => x.id != id);
                }
                localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));
                this.openManageLessonsModal();
                this.renderRoomCategoryView(document.getElementById('main-viewport'));
            },

            fileToBase64(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = error => reject(error);
                });
            },
            fileToText(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsText(file);
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = error => reject(error);
                });
            },

            async saveLesson(isAIGen) {
                const title = document.getElementById('in-lesson-title').value.trim();
                const mainLink = document.getElementById('in-lesson-link').value.trim();
                const extraInputs = Array.from(document.querySelectorAll('.extra-drive-link')).map(i => i.value.trim()).filter(v => !!v);
                const allLinks = [mainLink, ...extraInputs].filter(v => !!v);
                const combinedLink = allLinks.join(' ; ') || (this.uploadedLessonFile ? this.uploadedLessonFile.name : 'https://drive.google.com/ai-gen');

                const chkSys = document.getElementById('in-is-system');
                const isSystem = (chkSys && chkSys.checked) ? true : false;
                const chkAllow = document.getElementById('in-allow-sample');
                const allowSample = isSystem ? true : (chkAllow ? chkAllow.checked : false);

                if (!title) { alert("Vui lòng nhập tên bài học."); return; }
                if (!isAIGen && !mainLink && !this.uploadedLessonFile) {
                    alert("Vui lòng dán link drive hoặc tải lên ảnh/file bài học."); return;
                }

                const statusEl = document.getElementById('ai-creating-status');
                const btnArea = document.getElementById('create-action-buttons');
                const userKey = (localStorage.getItem('user_gemini_api_key') || "").trim();

                if (isAIGen && !userKey) {
                    alert("⚠️ Bạn chưa cài đặt Gemini API Key. Vui lòng bấm vào thẻ Thông tin tài khoản để lưu API Key trước khi dùng AI tạo bài nhé!");
                    this.openApiSetupModal(false);
                    return;
                }

                if (userKey && (isAIGen || this.uploadedLessonFile || mainLink)) {
                    if (statusEl) statusEl.classList.remove('hidden');
                    if (btnArea) btnArea.classList.add('opacity-50', 'pointer-events-none');

                    try {
                        let promptParts = [];
                        let fileBase64 = null;
                        let fileText = "";

                        if (this.uploadedLessonFile) {
                            const file = this.uploadedLessonFile;
                            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                            const isImage = file.type.startsWith('image/');

                            if (isImage || isPdf) {
                                fileBase64 = await this.fileToBase64(file);
                                const actualMime = isPdf ? 'application/pdf' : file.type;
                                promptParts.push({ inlineData: { mimeType: actualMime, data: fileBase64 } });
                            } else {
                                fileText = await this.fileToText(file);
                            }
                        }

                        const promptText = `
Bạn là chuyên gia giáo dục tiếng Trung AI xuất sắc. Hãy phân tích tài liệu/ảnh sau:
Tên bài học/Chủ đề: "${title}"
Nội dung tài liệu đính kèm: "${fileText.substring(0, 4000)}"
Link tham khảo: "${combinedLink}"

QUY TẮC BẮT BUỘC VỀ TRÍCH XUẤT VÀ CHIA NHỎ:
1. QUÉT TOÀN BỘ CÁC TRANG CỦA TÀI LIỆU/PDF: Hãy trích xuất ĐẦY ĐỦ VÀ TOÀN BỘ 100% từ vựng có trong tài liệu (bao gồm tất cả slide/trang từ mới, tuyệt đối không được bỏ sót bất kỳ từ nào).
2. QUY ĐỊNH CHIA PHẦN BẮT BUỘC: Mỗi phần bài học CHỈ ĐƯỢC CHỨA TỐI ĐA 8 ĐẾN 10 TỪ VỰNG. Nếu tài liệu có nhiều từ (ví dụ 24 từ), bạn BẮT BUỘC PHẢI CHIA THÀNH NHIỀU PHẦN BÀI HỌC trong mảng JSON: "${title}_Phần 1", "${title}_Phần 2", "${title}_Phần 3"... theo thứ tự từ vựng.
3. Với mỗi phần bài học, hãy tạo kèm bộ câu hỏi điền từ (cloze), mẫu câu ngữ pháp (grammar) và đoạn hội thoại (dialogues) tương ứng với các từ vựng của phần đó.

YÊU CẦU CẤU TRÚC JSON:
[
  {
    "title": "${title}_Phần 1",
    "vocabs": [{"hanzi": "...", "pinyin": "...", "meaning": "...", "example_cn": "...", "example_py": "...", "example_vi": "..."}],
    "cloze": [
      {"sentenceBefore": "...", "sentenceAfter": "...", "correctAnswer": "...", "choices": [{"word": "..."}], "pinyin": "...", "meaning": "..."}
    ],
    "grammar": [{
      "pattern": "Tên điểm ngữ pháp",
      "challenge": "Sắp xếp: [Từ 1] / [Từ 2] / [Từ 3]",
      "zh": "Câu tiếng Trung hoàn chỉnh ghép từ đề bài",
      "pinyin": "Pinyin câu",
      "meaning": "Nghĩa tiếng Việt",
      "formula": "Cấu trúc ngữ pháp...",
      "exercises": [
        {"zh": "...", "pinyin": "...", "vi": "...", "isCorrect": true, "correction": ""}
      ]
    }],
    "dialogues": [
      {"speaker": "A", "zh": "...", "pinyin": "...", "vi": "..."},
      {"speaker": "B", "zh": "...", "pinyin": "...", "vi": "..."}
    ]
  }
]
Không thêm văn bản giải thích nào ngoài mảng JSON này.`;
                        promptParts.push({ text: promptText });
                        const rawResponse = await this.callGeminiAPI(promptParts);
                        let clean = this.extractJSON(rawResponse);
                        if (!Array.isArray(clean)) clean = [clean];

                        // BẢO HIỂM JS: Tự động cưỡng bức chia nhỏ nếu AI gom quá 10 từ vào 1 bài
                        let finalLessonsList = [];
                        clean.forEach((lessonData, lIdx) => {
                            const vocabs = lessonData.vocabs || [];
                            if (vocabs.length > 10) {
                                const chunkSize = 8;
                                const baseTitle = lessonData.title ? lessonData.title.replace(/_Phần\s*\d+/gi, '') : title;
                                for (let i = 0; i < vocabs.length; i += chunkSize) {
                                    const partNum = Math.floor(i / chunkSize) + 1;
                                    const chunkVocabs = vocabs.slice(i, i + chunkSize);
                                    finalLessonsList.push({
                                        ...lessonData,
                                        title: `${baseTitle}_Phần ${partNum}`,
                                        vocabs: chunkVocabs,
                                        cloze: lessonData.cloze ? lessonData.cloze.slice(0, 4) : [],
                                        grammar: lessonData.grammar || [],
                                        dialogues: lessonData.dialogues || []
                                    });
                                }
                            } else {
                                finalLessonsList.push(lessonData);
                            }
                        });
                        clean = finalLessonsList;

                        let firstCreatedId = null;
                        const collName = isSystem ? "system_lessons" : "user_lessons";
                        const ownerName = this.currentAuth ? this.currentAuth.username : 'guest';
                        const dateNow = new Date().toISOString().split('T')[0];

                        clean.reverse().forEach((lessonData, index) => {
                            const newId = Date.now() + index;
                            if (!firstCreatedId) firstCreatedId = newId;
                            const newLessonObj = {
                                id: newId,
                                isSystem: isSystem,
                                allowSample: allowSample,
                                owner: ownerName,
                                title: lessonData.title || `${title} (${index + 1})`,
                                link: combinedLink,
                                date: dateNow,
                                vocabs: lessonData.vocabs && lessonData.vocabs.length ? lessonData.vocabs : this.initialLessonsData[0].vocabs,
                                cloze: lessonData.cloze && lessonData.cloze.length ? lessonData.cloze : this.initialLessonsData[0].cloze,
                                grammar: lessonData.grammar && lessonData.grammar.length ? lessonData.grammar : this.initialLessonsData[0].grammar,
                                dialogues: lessonData.dialogues && lessonData.dialogues.length ? lessonData.dialogues : this.initialLessonsData[0].dialogues
                            };
                            this.lessonsDB.unshift(newLessonObj);
                            if (this.db) {
                                this.db.collection(collName).doc(String(newId)).set(newLessonObj).catch(e => console.error("Firestore:", e));
                            }
                        });

                        localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));
                        this.lastCreatedId = firstCreatedId || Date.now();
                        document.getElementById('decision-lesson-name').innerText = clean.length > 1 ? `${title} (Đã tách thành ${clean.length} phần bài học)` : title;
                        document.getElementById('create-decision-modal').classList.remove('hidden');
                        return; 

                    } catch (err) {
                        console.error("Lỗi AI tạo bài:", err);
                        alert("⚠️ " + (err.message || "Lỗi kết nối API.") + "\nỨng dụng sẽ lưu bài học bằng cấu trúc mặc định dự phòng.");
                    } finally {
                        if (statusEl) statusEl.classList.add('hidden');
                        if (btnArea) btnArea.classList.remove('opacity-50', 'pointer-events-none');
                    }
                }

                const newId = Date.now(); this.lastCreatedId = newId;
                const newLesson = { 
                    id: newId, 
                    isSystem: isSystem, 
                    allowSample: allowSample,
                    owner: this.currentAuth ? this.currentAuth.username : 'guest', 
                    title: title, 
                    link: combinedLink, 
                    date: new Date().toISOString().split('T')[0], 
                    vocabs: this.initialLessonsData[0].vocabs, 
                    cloze: this.initialLessonsData[0].cloze, 
                    grammar: this.initialLessonsData[0].grammar, 
                    dialogues: this.initialLessonsData[0].dialogues 
                };
                this.lessonsDB.unshift(newLesson);
                localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));
                if (this.db) { 
                    const collName = isSystem ? "system_lessons" : "user_lessons"; 
                    this.db.collection(collName).doc(String(newId)).set(newLesson).catch(e => console.error("Firestore:", e)); 
                }
                document.getElementById('decision-lesson-name').innerText = title;
                document.getElementById('create-decision-modal').classList.remove('hidden');
            },

            decisionCreateMore() { document.getElementById('create-decision-modal').classList.add('hidden'); this.setTab('create'); },
            decisionGoStudy() { document.getElementById('create-decision-modal').classList.add('hidden'); this.currentRoomCategory = 'user'; this.setTab('room'); setTimeout(() => CZCardEngine.openLessonStudy(this.lastCreatedId), 100); },

            toggleTranslateDirection() { this.translateDirection = this.translateDirection === "VI_ZH" ? "ZH_VI" : "VI_ZH"; this.renderChatInterface(document.getElementById('main-viewport')); },
            renderChatInterface(vp) {
                const isViZh = (this.translateDirection === "VI_ZH");
                vp.innerHTML = `
                    <div class="w-full max-w-5xl h-full flex flex-col p-2 space-y-2 relative">
                        <div class="flex items-center justify-start mb-1">
                            <button onclick="CZAppCore.toggleTranslateDirection()" class="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-sm rounded-xl border border-rose-200 transition cursor-pointer flex items-center space-x-2 shadow-sm" title="Click để đảo chiều dịch">
                                <span>${isViZh ? 'VN Việt ➔ CN Trung' : 'CN Trung ➔ VN Việt'}</span>
                                <i class="fa-solid fa-right-left text-[10px] opacity-70"></i>
                            </button>
                        </div>
                        
                        <div class="chat-tr-container w-full h-full pb-2">
                            <div class="chat-tr-col theme-card rounded-2xl p-4 flex flex-col shadow-sm border border-slate-500/10">
                                <textarea id="chat-tr-in" class="flex-1 w-full bg-transparent resize-none text-base font-semibold focus:outline-none" placeholder="${isViZh ? 'Nhập câu tiếng Việt cần dịch...' : 'Nhập Hán tự cần dịch...'}"></textarea>
                                <button onclick="CZAppCore.executeTranslateAction()" class="w-full py-3 mt-3 btn-3d font-bold rounded-xl cursor-pointer text-sm shadow-md"><i class="fa-solid fa-language mr-1.5"></i> Dịch bằng AI</button>
                            </div>
                            
                            <div class="chat-tr-col bg-slate-50 rounded-2xl p-4 flex flex-col shadow-inner border border-slate-200">
                                <div id="chat-tr-out" class="flex-1 overflow-y-auto text-left flex flex-col justify-center">
                                    <p class="text-xs opacity-50 italic text-center">Bản dịch AI sẽ hiển thị tại đây...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            },
            async executeTranslateAction() { 
                const txt = document.getElementById('chat-tr-in').value.trim(); 
                if (!txt) return; 
                const outEl = document.getElementById('chat-tr-out');
                const userKey = (localStorage.getItem('user_gemini_api_key') || "").trim();
                const isViZh = (this.translateDirection === "VI_ZH");

                if (!userKey) {
                    outEl.innerHTML = `
                        <div class="space-y-2 text-center p-3">
                            <p class="text-xs text-rose-600 font-bold">⚠️ Bạn chưa lưu Gemini API Key cá nhân.</p>
                            <p class="text-[11px] opacity-75">Vào thẻ Thông tin tài khoản để cài đặt API Key kích hoạt AI nhé!</p>
                        </div>
                    `;
                    return;
                }

                outEl.innerHTML = `<p class="text-xs opacity-70 animate-pulse font-bold text-center">🤖 Đang dịch thuật và phân tích cùng AI...</p>`;

                const prompt = isViZh 
                    ? `Bạn là chuyên gia dịch thuật Việt - Trung. Hãy dịch câu sau sang tiếng Trung: "${txt}". Trả về JSON duy nhất: {"hanzi": "chữ Hán", "pinyin": "pinyin có dấu", "meaning": "nghĩa tiếng Việt", "note": "giải thích thêm nếu cần"}.`
                    : `Bạn là chuyên gia dịch thuật Trung - Việt. Hãy dịch câu sau sang tiếng Việt: "${txt}". Trả về JSON duy nhất: {"hanzi": "chữ Hán gốc", "pinyin": "pinyin có dấu", "meaning": "nghĩa tiếng Việt", "note": "giải thích thêm nếu cần"}.`;

                try {
                    const raw = await this.callGeminiAPI([{ text: prompt }]);
                    const res = this.extractJSON(raw);
                    outEl.innerHTML = `
                        <div class="space-y-2.5">
                            <div class="flex justify-between items-start">
                                <p class="text-2xl sm:text-3xl text-rose-600 font-black leading-tight font-chinese select-text">${res.hanzi || txt}</p>
                                <button onclick="CZCardEngine.speakZh('${(res.hanzi || '').replace(/'/g, "\\'")}')" class="text-rose-500 hover:scale-110 cursor-pointer pt-1 shrink-0 ml-2" title="Phát âm tiếng Trung">
                                    <i class="fa-solid fa-volume-high text-lg"></i>
                                </button>
                            </div>
                            <p class="text-sm font-bold text-rose-500 select-text">🔊 ${res.pinyin || ''}</p>
                            <p class="text-xs sm:text-sm font-semibold opacity-90 border-t pt-2 border-slate-200 select-text">🇻🇳 ${res.meaning || ''}</p>
                            ${res.note ? `<p class="text-[11px] italic opacity-70 select-text">💡 ${res.note}</p>` : ''}
                        </div>
                    `;
                } catch (err) {
                    console.error("Lỗi Chat Dịch AI:", err);
                    outEl.innerHTML = `
                        <div class="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-left space-y-1">
                            <p class="font-bold">❌ Dịch thất bại:</p>
                            <p class="text-[11px] opacity-80">${err.message || 'Vui lòng kiểm tra lại kết nối mạng hoặc đổi API Key khác.'}</p>
                        </div>
                    `;
                }
            }
        };
