/**
 * MODULE: CZHskApp - TRỢ LÝ AI LUYỆN THI HSK CHUẨN QUỐC TẾ (CHINESEZ298)
 */
const CZHskApp = window.CZHskApp = {
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
    currentAuth: null,
    lessonsDB: [],
    selectedLessonIds: [],
    pickerFilter: 'all',
    uploadedFile: null,

    // Cấu hình đề thi
    genMode: 'source', // 'source' (bám sát bài học/tài liệu) | 'ai_standard' (AI soạn chuẩn HSK 1-6)
    selectedHskLevel: 1, // 1..6
    examDurationMinutes: 15,

    // Trạng thái phòng thi
    currentExam: null,
    userAnswers: {}, // { qIndex: answer }
    listenCounts: {}, // { qIndex: count }
    isExamSubmitted: false,
    examScore: 0,
    timerInterval: null,
    remainingSeconds: 0,
    timeSpentSeconds: 0,

    // Chế độ Xem lại đề
    reviewShowPinyin: true,
    reviewShowMeaning: true,
    isReviewMode: false,

    // Lịch sử thi
    hskHistoryList: [],
    activeTab: 'setup',

    THEMES: [
        { key: 'lavender', label: 'Lavender', dot: '#7c3aed' },
        { key: 'nordic', label: 'Nordic Blue', dot: '#0284c7' },
        { key: 'sage', label: 'Sage Green', dot: '#059669' },
        { key: 'warm', label: 'Warm Sand', dot: '#d97706' },
        { key: 'midnight', label: 'Midnight Dark', dot: '#f43f5e' }
    ],

    async init() {
        // 1. Kiểm tra đăng nhập đồng bộ từ index.html
        try {
            const rawAuth = sessionStorage.getItem('chinesez_session_user');
            if (!rawAuth) {
                window.location.replace('./index.html');
                return;
            }
            this.currentAuth = JSON.parse(rawAuth);
            if (!this.currentAuth || !this.currentAuth.username) {
                window.location.replace('./index.html');
                return;
            }
        } catch (e) {
            window.location.replace('./index.html');
            return;
        }

        // 2. Kế thừa Theme từ index.html
        const savedTheme = localStorage.getItem('chinesez_theme') || 'lavender';
        const foundT = this.THEMES.find(t => t.key === savedTheme) || this.THEMES[0];
        this.applyTheme(foundT.key, foundT.label);
        this.renderThemeDropdown();

        const btnTheme = document.getElementById('btn-hsk-theme-menu');
        if (btnTheme) {
            btnTheme.addEventListener('click', (e) => {
                e.stopPropagation();
                document.getElementById('hsk-theme-menu').classList.toggle('hidden');
            });
        }

        const badge = document.getElementById('hsk-user-badge');
        if (badge) badge.innerText = `${this.currentAuth.fullname} (${this.currentAuth.role})`;

        // 3. Khởi tạo Firebase Firestore
        try {
            if (!firebase.apps.length) firebase.initializeApp(this.firebaseConfig);
            this.db = firebase.firestore();
        } catch (e) { console.warn('Firebase init:', e); }

        // 4. Nạp danh sách bài học từ localStorage + Firestore (system_lessons & user_lessons)
        try {
            this.lessonsDB = JSON.parse(localStorage.getItem('chinesez_lessons')) || [];
        } catch (e) { this.lessonsDB = []; }

        if (this.db) {
            try {
                const [sysSnap, userSnap] = await Promise.all([
                    this.db.collection("system_lessons").get(),
                    this.db.collection("user_lessons").get()
                ]);
                const cloudLessons = [];
                if (!sysSnap.empty) sysSnap.forEach(doc => cloudLessons.push(doc.data()));
                if (!userSnap.empty) userSnap.forEach(doc => cloudLessons.push(doc.data()));
                if (cloudLessons.length > 0) {
                    cloudLessons.sort((a, b) => (parseInt(b.id, 10) || 0) - (parseInt(a.id, 10) || 0));
                    this.lessonsDB = cloudLessons;
                    localStorage.setItem('chinesez_lessons', JSON.stringify(this.lessonsDB));
                }
            } catch (err) {
                console.warn("Lỗi đồng bộ bài học từ Firestore:", err);
            }
        }

        this.switchTab('setup');
    },

    renderThemeDropdown() {
        const menu = document.getElementById('hsk-theme-menu');
        if (!menu) return;
        menu.innerHTML = this.THEMES.map(t => `
            <button onclick="window.CZHskApp.applyTheme('${t.key}', '${t.label}')" class="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center space-x-2 font-semibold cursor-pointer">
                <span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${t.dot}"></span>
                <span>${t.label}</span>
            </button>
        `).join('');
    },

    applyTheme(key, lbl) {
        document.documentElement.setAttribute('data-theme', key);
        localStorage.setItem('chinesez_theme', key);
        const lblEl = document.getElementById('hsk-theme-lbl');
        if (lblEl) lblEl.innerText = lbl;
        const menu = document.getElementById('hsk-theme-menu');
        if (menu) menu.classList.add('hidden');
    },

    saveApiKey() {
        const val = (document.getElementById('hsk-popup-api-key').value || '').trim();
        if (val.length < 15) {
            alert("Vui lòng dán đúng chuỗi Gemini API Key!");
            return;
        }
        localStorage.setItem('user_gemini_api_key', val);
        document.getElementById('hsk-api-modal').classList.add('hidden');
        alert("✅ Đã lưu API Key thành công!");
    },

    switchTab(tab) {
        this.activeTab = tab;
        ['setup', 'exam', 'history'].forEach(t => {
            const btn = document.getElementById(`hsk-nav-${t}`);
            if (btn) {
                if (t === tab) {
                    btn.classList.add('btn-3d');
                    btn.classList.remove('opacity-75');
                } else {
                    btn.classList.remove('btn-3d');
                    btn.classList.add('opacity-75');
                }
            }
        });

        const vp = document.getElementById('hsk-main-viewport');
        if (!vp) return;

        if (tab === 'setup') {
            this.renderSetupView(vp);
        } else if (tab === 'exam') {
            this.renderExamView(vp);
        } else if (tab === 'history') {
            this.renderHistoryView(vp);
        }
    },

    // ==========================================
    // 1. GIAO DIỆN THIẾT LẬP & TẠO ĐỀ THI HSK
    // ==========================================
    renderSetupView(vp) {
        const selectedTitles = this.lessonsDB
            .filter(l => this.selectedLessonIds.includes(String(l.id)))
            .map(l => l.title);

        vp.innerHTML = `
            <div class="w-full max-w-2xl mx-auto h-full flex flex-col justify-between overflow-y-auto pr-1 text-left space-y-3 py-1">
                <div class="flex items-center justify-between border-b pb-2 border-slate-500/10 shrink-0">
                    <div>
                        <h1 class="text-base sm:text-lg font-black text-rose-600 flex items-center space-x-2">
                            <i class="fa-solid fa-graduation-cap"></i>
                            <span>Luyện Đề Chuẩn HSK Cùng AI</span>
                        </h1>
                        <p class="text-[11px] opacity-75">Tạo đề thi Nghe - Đọc - Viết từ bài học, tài liệu hoặc theo cấp độ HSK 1–6</p>
                    </div>
                    <button onclick="document.getElementById('hsk-api-modal').classList.remove('hidden')" class="px-2.5 py-1 rounded-xl theme-card border text-[11px] font-bold hover:border-rose-500 cursor-pointer shrink-0">
                        <i class="fa-solid fa-key text-rose-500 mr-1"></i>API Key
                    </button>
                </div>

                <!-- BƯỚC 1: CHỌN PHƯƠNG THỨC TẠO ĐỀ -->
                <div class="space-y-2">
                    <label class="block text-[11px] font-black uppercase text-rose-600">1. Chọn chế độ ra đề</label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div onclick="window.CZHskApp.setGenMode('source')" class="p-3 rounded-2xl border-2 cursor-pointer transition ${this.genMode === 'source' ? 'border-rose-500 bg-rose-500/10 shadow-xs' : 'theme-card opacity-80 hover:opacity-100'}">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-black text-rose-600"><i class="fa-solid fa-book-open-reader mr-1.5"></i>Bám sát bài học / tài liệu</span>
                                <i class="fa-solid ${this.genMode === 'source' ? 'fa-circle-check text-rose-600' : 'fa-circle opacity-30'}"></i>
                            </div>
                            <p class="text-[10.5px] opacity-75 mt-1">AI tự động đánh giá độ khó từ vựng/ngữ pháp trong nguồn dữ liệu bạn cung cấp để ra đề chuẩn HSK.</p>
                        </div>

                        <div onclick="window.CZHskApp.setGenMode('ai_standard')" class="p-3 rounded-2xl border-2 cursor-pointer transition ${this.genMode === 'ai_standard' ? 'border-rose-500 bg-rose-500/10 shadow-xs' : 'theme-card opacity-80 hover:opacity-100'}">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-black text-rose-600"><i class="fa-solid fa-wand-magic-sparkles mr-1.5"></i>AI soạn đề chuẩn HSK</span>
                                <i class="fa-solid ${this.genMode === 'ai_standard' ? 'fa-circle-check text-rose-600' : 'fa-circle opacity-30'}"></i>
                            </div>
                            <p class="text-[10.5px] opacity-75 mt-1">Chọn trực tiếp cấp độ từ HSK 1 đến HSK 6 (có thể kèm chủ đề gợi ý hoặc chọn thêm bài học).</p>
                        </div>
                    </div>
                </div>

                <!-- CHỌN CẤP ĐỘ HSK 1-6 (HIỂN THỊ KHI CHỌN AI SOẠN ĐỀ HSK) -->
                ${this.genMode === 'ai_standard' ? `
                <div class="p-3 rounded-2xl theme-card border border-rose-500/20 space-y-2">
                    <label class="block text-[11px] font-black uppercase text-rose-600">Chọn cấp độ kỳ thi HSK</label>
                    <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        ${[1, 2, 3, 4, 5, 6].map(lvl => `
                            <button type="button" onclick="window.CZHskApp.setHskLevel(${lvl})" class="py-2 rounded-xl text-xs font-black transition cursor-pointer ${this.selectedHskLevel === lvl ? 'btn-3d' : 'theme-card border hover:border-rose-500'}">
                                HSK ${lvl}
                            </button>
                        `).join('')}
                    </div>
                    <p class="text-[10.5px] opacity-75 italic">
                        ${this.selectedHskLevel >= 3 ? '✓ Bao gồm đầy đủ 3 kỹ năng: Nghe (听力) + Đọc hiểu (阅读) + Viết/Sắp xếp câu (书写).' : '✓ Cấp độ HSK 1–2 gồm 2 kỹ năng chuẩn: Nghe (听力) + Đọc hiểu (阅读).'}
                    </p>
                </div>
                ` : ''}

                <!-- BƯỚC 2: NGUỒN DỮ LIỆU ĐẦU VÀO (THIẾT KẾ ĐỒNG BỘ TAB TẠO BÀI) -->
                <div class="space-y-2.5 p-3 rounded-2xl theme-card border border-slate-500/15">
                    <label class="block text-[11px] font-black uppercase text-rose-600">
                        2. Nguồn dữ liệu biên soạn đề ${this.genMode === 'ai_standard' ? '(Tùy chọn bổ sung)' : '(Chọn ít nhất 1 nguồn)'}
                    </label>

                    <!-- Nguồn A: Chọn từ danh sách bài học -->
                    <div class="space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="text-[11px] font-bold opacity-85"><i class="fa-solid fa-list-check text-rose-500 mr-1"></i>Từ danh sách bài học có sẵn:</span>
                            <button type="button" onclick="window.CZHskApp.openLessonPickerModal()" class="px-3 py-1 rounded-xl btn-theme-sec text-xs font-bold cursor-pointer shadow-xs">
                                <i class="fa-solid fa-folder-plus mr-1"></i>Chọn bài học (${this.selectedLessonIds.length})
                            </button>
                        </div>
                        ${selectedTitles.length > 0 ? `
                            <div class="flex flex-wrap gap-1 pt-1">
                                ${selectedTitles.map(t => `<span class="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[10.5px] font-bold truncate max-w-[220px] font-chinese">${t}</span>`).join('')}
                            </div>
                        ` : `<p class="text-[10.5px] opacity-55 italic">Chưa chọn bài học nào từ thư viện.</p>`}
                    </div>

                    <!-- Nguồn B: Dán link Drive / tài liệu -->
                    <div class="pt-1 border-t border-slate-500/10">
                        <label class="block text-[10.5px] font-bold opacity-80 mb-1">Dán link drive tài liệu (pdf/word) hoặc link bài đọc:</label>
                        <div class="flex items-center gap-1.5">
                            <input type="text" id="hsk-in-link" placeholder="Link ở dạng chia sẻ mức độ xem..." class="flex-1 custom-input rounded-xl px-3 py-1.5 text-xs focus:outline-none">
                            <button type="button" onclick="window.CZHskApp.addExtraLinkInput()" class="w-8 h-8 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center shrink-0 shadow-sm hover:scale-105 cursor-pointer transition" title="Thêm ô link tiếp theo">
                                <i class="fa-solid fa-plus text-xs"></i>
                            </button>
                        </div>
                        <div id="hsk-extra-links-container"></div>
                    </div>

                    <!-- Nguồn C: Tải lên ảnh / PDF / TXT -->
                    <div class="pt-1 border-t border-slate-500/10 flex items-center justify-between flex-wrap gap-2">
                        <div class="flex items-center gap-2 flex-wrap">
                            <input type="file" id="hsk-file-upload" onchange="window.CZHskApp.onFileSelected(event)" accept="image/*,.pdf,.txt,.doc,.docx" class="hidden">
                            <button type="button" onclick="document.getElementById('hsk-file-upload').click()" class="px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-300/80 bg-white dark:bg-slate-800 hover:bg-rose-50 text-rose-600 flex items-center space-x-1.5 cursor-pointer transition shadow-xs">
                                <i class="fa-solid fa-cloud-arrow-up"></i>
                                <span>Tải lên ảnh/file tài liệu</span>
                            </button>
                            <div id="hsk-uploaded-badge" class="${this.uploadedFile ? 'flex' : 'hidden'} items-center space-x-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded-xl border border-emerald-500/30 text-[11px] font-bold max-w-[200px]">
                                <i class="fa-regular fa-file-lines text-xs"></i>
                                <span id="hsk-uploaded-name" class="truncate">${this.uploadedFile ? this.uploadedFile.name : ''}</span>
                                <button type="button" onclick="window.CZHskApp.removeUploadedFile()" class="text-rose-600 ml-1 font-black cursor-pointer">✕</button>
                            </div>
                        </div>

                        <div class="flex items-center space-x-1.5">
                            <label class="text-[10.5px] font-bold opacity-80">Thời gian:</label>
                            <select id="hsk-duration-select" onchange="window.CZHskApp.examDurationMinutes = parseInt(this.value, 10)" class="custom-input rounded-xl px-2 py-1 text-xs font-bold">
                                <option value="10" ${this.examDurationMinutes === 10 ? 'selected' : ''}>10 phút</option>
                                <option value="15" ${this.examDurationMinutes === 15 ? 'selected' : ''}>15 phút</option>
                                <option value="20" ${this.examDurationMinutes === 20 ? 'selected' : ''}>20 phút</option>
                                <option value="30" ${this.examDurationMinutes === 30 ? 'selected' : ''}>30 phút</option>
                            </select>
                        </div>
                    </div>

                    <!-- Ghi chú / Chủ đề bổ sung -->
                    <div>
                        <input type="text" id="hsk-custom-topic" placeholder="Chủ đề hoặc yêu cầu trọng tâm (tùy chọn, VD: Giao tiếp sân bay, Ngữ pháp chữ 把...)" class="w-full custom-input rounded-xl px-3 py-1.5 text-xs focus:outline-none">
                    </div>
                </div>

                <!-- TRẠNG THÁI & NÚT TẠO ĐỀ -->
                <div id="hsk-generating-status" class="hidden p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 font-bold text-xs text-center animate-pulse">
                    🤖 AI đang biên soạn đề thi chuẩn HSK (Nghe - Đọc - Viết) kèm Pinyin & giải thích chi tiết... Vui lòng đợi!
                </div>

                <div class="pt-1 shrink-0">
                    <button id="btn-generate-hsk" onclick="window.CZHskApp.generateHskExam()" class="w-full py-3 btn-3d font-black text-xs sm:text-sm rounded-2xl cursor-pointer shadow-md flex items-center justify-center space-x-2">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>Bắt đầu tạo đề thi HSK & Vào phòng thi</span>
                    </button>
                </div>
            </div>
        `;
    },

    setGenMode(mode) {
        this.genMode = mode;
        this.renderSetupView(document.getElementById('hsk-main-viewport'));
    },

    setHskLevel(lvl) {
        this.selectedHskLevel = lvl;
        this.renderSetupView(document.getElementById('hsk-main-viewport'));
    },

    addExtraLinkInput() {
        const mainInput = document.getElementById('hsk-in-link');
        const container = document.getElementById('hsk-extra-links-container');
        if (!mainInput || !container) return;
        const val = mainInput.value.trim();
        if (!val) {
            alert("Vui lòng dán link vào ô trước khi bấm dấu +!");
            mainInput.focus();
            return;
        }
        const div = document.createElement('div');
        div.className = "flex items-center gap-1.5 mt-1.5";
        div.innerHTML = `
            <input type="text" value="${val}" readonly class="hsk-extra-link flex-1 custom-input rounded-xl px-3 py-1.5 text-xs opacity-90 truncate cursor-default">
            <button type="button" onclick="this.parentElement.remove()" class="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0 cursor-pointer">
                <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
        `;
        container.appendChild(div);
        mainInput.value = '';
    },

    onFileSelected(e) {
        const f = e.target.files[0];
        if (!f) return;
        this.uploadedFile = f;
        const badge = document.getElementById('hsk-uploaded-badge');
        const nameEl = document.getElementById('hsk-uploaded-name');
        if (badge && nameEl) {
            nameEl.innerText = f.name;
            badge.classList.remove('hidden');
            badge.classList.add('flex');
        }
    },

    removeUploadedFile() {
        this.uploadedFile = null;
        const inp = document.getElementById('hsk-file-upload');
        if (inp) inp.value = '';
        const badge = document.getElementById('hsk-uploaded-badge');
        if (badge) {
            badge.classList.add('hidden');
            badge.classList.remove('flex');
        }
    },

    // ==========================================
    // POPUP CHỌN BÀI HỌC TỪ THƯ VIỆN
    // ==========================================
    openLessonPickerModal() {
        this.pickerFilter = 'all';
        this.renderPickerList();
        document.getElementById('hsk-lesson-picker-modal').classList.remove('hidden');
    },

    closeLessonPickerModal() {
        document.getElementById('hsk-lesson-picker-modal').classList.add('hidden');
    },

    setPickerFilter(filter) {
        this.pickerFilter = filter;
        ['all', 'sample', 'user'].forEach(f => {
            const btn = document.getElementById(`picker-tab-${f}`);
            if (btn) {
                btn.className = (f === filter)
                    ? "flex-1 py-1.5 rounded-xl text-xs font-bold btn-3d cursor-pointer"
                    : "flex-1 py-1.5 rounded-xl text-xs font-bold theme-card border cursor-pointer";
            }
        });
        this.renderPickerList();
    },

    renderPickerList() {
        const listEl = document.getElementById('hsk-picker-list');
        const countEl = document.getElementById('hsk-picker-count');
        if (!listEl) return;

        let filtered = this.lessonsDB;
        if (this.pickerFilter === 'sample') filtered = this.lessonsDB.filter(l => l.isSystem);
        else if (this.pickerFilter === 'user') filtered = this.lessonsDB.filter(l => !l.isSystem);

        if (filtered.length === 0) {
            listEl.innerHTML = `<div class="p-6 text-center text-xs opacity-60">Không có bài học nào trong mục này.</div>`;
        } else {
            listEl.innerHTML = filtered.map(l => {
                const isChecked = this.selectedLessonIds.includes(String(l.id));
                return `
                    <label class="p-2.5 theme-card rounded-2xl border flex items-center justify-between cursor-pointer hover:border-rose-500 transition shadow-xs">
                        <div class="flex items-center space-x-2.5 truncate mr-2">
                            <input type="checkbox" onchange="window.CZHskApp.toggleLessonSelection('${l.id}', this.checked)" ${isChecked ? 'checked' : ''} class="w-4 h-4 rounded text-rose-600 cursor-pointer shrink-0">
                            <div class="truncate">
                                <p class="text-xs font-bold truncate font-chinese">${l.title}</p>
                                <p class="text-[10px] opacity-60">${l.isSystem ? 'Bài mẫu' : 'Của bạn'} • ${l.vocabs ? l.vocabs.length : 0} từ vựng</p>
                            </div>
                        </div>
                        <span class="text-[10px] px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 font-bold shrink-0">${l.date || ''}</span>
                    </label>
                `;
            }).join('');
        }
        if (countEl) countEl.innerText = `Đã chọn: ${this.selectedLessonIds.length} bài`;
    },

    toggleLessonSelection(id, checked) {
        const sid = String(id);
        if (checked) {
            if (!this.selectedLessonIds.includes(sid)) this.selectedLessonIds.push(sid);
        } else {
            this.selectedLessonIds = this.selectedLessonIds.filter(x => x !== sid);
        }
        const countEl = document.getElementById('hsk-picker-count');
        if (countEl) countEl.innerText = `Đã chọn: ${this.selectedLessonIds.length} bài`;
    },

    clearSelectedLessons() {
        this.selectedLessonIds = [];
        this.renderPickerList();
    },

    confirmLessonPicker() {
        this.closeLessonPickerModal();
        this.renderSetupView(document.getElementById('hsk-main-viewport'));
    },

    // ==========================================
    // GỌI GEMINI AI TẠO ĐỀ THI HSK CHUẨN
    // ==========================================
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

    async callGeminiAPI(promptParts) {
        const userKey = (localStorage.getItem('user_gemini_api_key') || "").trim();
        if (!userKey) throw new Error("NO_API_KEY");

        const candidateModels = [
            'gemini-3.5-flash-lite',
            'gemini-3.8-flash',
            'gemini-3.1-pro',
            'gemini-2.5-flash'
        ];

        let lastError = "";
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
                    lastError = errJson.error?.message || `HTTP ${resp.status}`;
                }
            } catch (e) {
                lastError = e.message;
            }
        }
        throw new Error(lastError || "Không thể kết nối Gemini API.");
    },

    extractJSON(rawText) {
        let clean = rawText.trim().replace(/```json/gi, '').replace(/```/g, '').trim();
        try {
            return JSON.parse(clean);
        } catch (e) {
            const first = clean.search(/[\[\{]/);
            const last = Math.max(clean.lastIndexOf(']'), clean.lastIndexOf('}'));
            if (first !== -1 && last !== -1 && last > first) {
                return JSON.parse(clean.substring(first, last + 1));
            }
            throw e;
        }
    },

    async generateHskExam() {
        const userKey = (localStorage.getItem('user_gemini_api_key') || "").trim();
        if (!userKey) {
            document.getElementById('hsk-api-modal').classList.remove('hidden');
            return;
        }

        const mainLink = (document.getElementById('hsk-in-link')?.value || '').trim();
        const extraLinks = Array.from(document.querySelectorAll('.hsk-extra-link')).map(el => el.value.trim()).filter(Boolean);
        const allLinks = [mainLink, ...extraLinks].filter(Boolean);
        const customTopic = (document.getElementById('hsk-custom-topic')?.value || '').trim();

        const chosenLessons = this.lessonsDB.filter(l => this.selectedLessonIds.includes(String(l.id)));

        if (this.genMode === 'source' && chosenLessons.length === 0 && allLinks.length === 0 && !this.uploadedFile && !customTopic) {
            alert("Vui lòng chọn ít nhất 1 bài học, tải lên tài liệu hoặc dán link để AI tạo đề!");
            return;
        }

        const statusEl = document.getElementById('hsk-generating-status');
        const btnEl = document.getElementById('btn-generate-hsk');
        if (statusEl) statusEl.classList.remove('hidden');
        if (btnEl) btnEl.classList.add('opacity-50', 'pointer-events-none');

        try {
            let promptParts = [];
            let fileText = "";

            if (this.uploadedFile) {
                const file = this.uploadedFile;
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
                const isImage = file.type.startsWith('image/');
                if (isImage || isPdf) {
                    const b64 = await this.fileToBase64(file);
                    promptParts.push({ inlineData: { mimeType: isPdf ? 'application/pdf' : file.type, data: b64 } });
                } else {
                    fileText = await this.fileToText(file);
                }
            }

            // Tổng hợp từ vựng & ngữ pháp từ các bài học đã chọn
            let lessonsContext = "";
            if (chosenLessons.length > 0) {
                lessonsContext = chosenLessons.map(l => {
                    const vStr = (l.vocabs || []).map(v => `${v.hanzi}(${v.pinyin}): ${v.meaning}`).join('; ');
                    const gStr = (l.grammar || []).map(g => `${g.pattern} [${g.formula}]`).join('; ');
                    return `- Bài "${l.title}": Từ vựng: [${vStr}]. Ngữ pháp: [${gStr}].`;
                }).join('
');
            }

            const levelInstruction = (this.genMode === 'ai_standard')
                ? `Cấp độ bắt buộc: HSK ${this.selectedHskLevel}. ${this.selectedHskLevel >= 3 ? 'Đề thi BẮT BUỘC có đủ 3 phần: Phần 1 Nghe (4 câu), Phần 2 Đọc hiểu (4 câu), Phần 3 Viết/Sắp xếp câu (3 câu).' : 'Đề thi gồm 2 phần chuẩn HSK 1-2: Phần 1 Nghe (5 câu), Phần 2 Đọc hiểu (5 câu).'}`
                : `Tự động đánh giá độ khó từ vựng & ngữ pháp trong tài liệu/bài học được cung cấp để xác định cấp độ HSK tương ứng (từ HSK 1 đến HSK 6). Tạo đề thi chuẩn HSK gồm: Phần 1 Nghe (4 câu), Phần 2 Đọc hiểu (4 câu), và nếu độ khó tương đương HSK 3 trở lên thì thêm Phần 3 Viết/Sắp xếp câu (2-3 câu).`;

            const promptText = `
Bạn là Hội đồng ra đề thi HSK quốc tế (Hanban/CTI) chuyên nghiệp. Hãy biên soạn một đề thi thử HSK chất lượng cao bằng tiếng Trung giản thể.

THÔNG TIN ĐẦU VÀO:
- Chế độ: ${this.genMode === 'ai_standard' ? `Soạn đề chuẩn HSK ${this.selectedHskLevel}` : 'Bám sát nội dung bài học/tài liệu'}
- ${levelInstruction}
- Chủ đề / Yêu cầu thêm: "${customTopic || 'Tổng hợp chuẩn HSK'}"
- Các bài học đã chọn:
${lessonsContext || '(Không có)'}
- Link tài liệu tham khảo: ${allLinks.join(' ; ') || '(Không có)'}
- Nội dung file văn bản đính kèm: ${fileText.substring(0, 4000) || '(Không có)'}

YÊU CẦU CẤU TRÚC ĐỀ THI JSON:
Trả về duy nhất 1 object JSON có cấu trúc chính xác như sau:
{
  "examTitle": "Tên đề thi (VD: Đề thi thử HSK 3 - Tổng hợp Bài 1 & 2)",
  "detectedLevel": 3,
  "sourceSummary": "Tóm tắt ngắn gọn nguồn tạo đề",
  "questions": [
    {
      "id": 1,
      "section": "listening",
      "type": "listening_dialogue",
      "instruction": "Nghe đoạn hội thoại và chọn đáp án đúng",
      "audioLines": [
        {"speaker": "A", "zh": "请问，去火车站怎么走？", "pinyin": "Qǐngwèn, qù huǒchēzhàn zěnme zǒu?", "vi": "Xin hỏi, đi đến ga tàu hỏa đi như thế nào?"},
        {"speaker": "B", "zh": "往前走，第二个路口往右拐就到了。", "pinyin": "Wǎng qián zǒu, dì èr gè lùkǒu wǎng yòu guǎi jiù dào le.", "vi": "Đi thẳng về phía trước, ngã tư thứ hai rẽ phải là tới."}
      ],
      "questionZh": "女的要去哪里？",
      "questionPinyin": "Nǚ de yào qù nǎlǐ?",
      "questionVi": "Người nữ muốn đi đâu?",
      "options": [
        {"key": "A", "zh": "火车站", "pinyin": "huǒchēzhàn", "vi": "Ga tàu hỏa"},
        {"key": "B", "zh": "飞机场", "pinyin": "fēijīchǎng", "vi": "Sân bay"},
        {"key": "C", "zh": "图书馆", "pinyin": "túshūguǎn", "vi": "Thư viện"},
        {"key": "D", "zh": "医院", "pinyin": "yīyuàn", "vi": "Bệnh viện"}
      ],
      "correctAnswer": "A",
      "explanationVi": "Giải thích chi tiết bằng tiếng Việt vì sao chọn A dựa trên lời thoại."
    },
    {
      "id": 5,
      "section": "reading",
      "type": "reading_choice",
      "instruction": "Đọc câu/đoạn văn và chọn từ hoặc đáp án đúng nhất",
      "passageZh": "今天天气真好，我们一起去公园散步吧。",
      "passagePinyin": "Jīntiān tiānqì zhēn hǎo, wǒmen yīqǐ qù gōngyuán sànbù ba.",
      "passageVi": "Thời tiết hôm nay thật đẹp, chúng ta cùng đi công viên tản bộ nhé.",
      "questionZh": "他们打算去做什么？",
      "questionPinyin": "Tāmen dǎsuàn qù zuò shénme?",
      "questionVi": "Họ dự định đi làm gì?",
      "options": [
        {"key": "A", "zh": "去散步", "pinyin": "qù sànbù", "vi": "Đi tản bộ"},
        {"key": "B", "zh": "去买东西", "pinyin": "qù mǎi dōngxi", "vi": "Đi mua đồ"},
        {"key": "C", "zh": "去看电影", "pinyin": "qù kàn diànyǐng", "vi": "Đi xem phim"},
        {"key": "D", "zh": "在家里休息", "pinyin": "zài jiālǐ xiūxi", "vi": "Nghỉ ngơi ở nhà"}
      ],
      "correctAnswer": "A",
      "explanationVi": "Trong câu có cụm '去公园散步' (đi công viên tản bộ)."
    },
    {
      "id": 9,
      "section": "writing",
      "type": "writing_reorder",
      "instruction": "Sắp xếp các từ/cụm từ sau thành câu hoàn chỉnh đúng ngữ pháp",
      "wordBank": ["把", "我", "作业", "做完了"],
      "wordBankPinyin": ["bǎ", "wǒ", "zuòyè", "zuò wán le"],
      "correctSentenceZh": "我把作业做完了",
      "correctSentencePinyin": "Wǒ bǎ zuòyè zuò wán le.",
      "correctSentenceVi": "Tôi đã làm xong bài tập về nhà rồi.",
      "explanationVi": "Cấu trúc câu chữ 把: Chủ ngữ (我) + 把 + Tân ngữ (作业) + Động từ + Bổ ngữ kết quả (做完了)."
    }
  ]
}

QUY TẮC QUAN TRỌNG:
- Mọi câu tiếng Trung đều PHẢI có đầy đủ trường Pinyin chuẩn thanh điệu và nghĩa tiếng Việt (vi) để phục vụ chức năng Ẩn/Hiện Pinyin và Ẩn/Hiện Nghĩa khi xem lại bài thi.
- Với phần "listening": dùng "audioLines" (có thể 1 câu độc thoại hoặc 2-3 câu hội thoại A-B).
- Với phần "reading": dùng "passageZh", "passagePinyin", "passageVi" và "questionZh", "questionPinyin", "questionVi" cùng 4 lựa chọn A, B, C, D.
- Với phần "writing": dùng "wordBank" (mảng 4-6 từ/cụm từ tiếng Trung bị xáo trộn thứ tự) và "correctSentenceZh" (chuỗi ghép liền không khoảng trắng giữa chữ Hán, không dấu câu cuối).
- Không xuất bất kỳ văn bản nào ngoài JSON.`;

            promptParts.push({ text: promptText });
            const rawResp = await this.callGeminiAPI(promptParts);
            const examData = this.extractJSON(rawResp);

            if (!examData || !Array.isArray(examData.questions) || examData.questions.length === 0) {
                throw new Error("Dữ liệu đề thi trả về chưa hợp lệ. Vui lòng thử lại!");
            }

            // Chuẩn hóa dữ liệu đề thi
            examData.createdAt = new Date().toISOString();
            examData.sourceLabel = chosenLessons.length > 0
                ? chosenLessons.map(l => l.title).join(', ')
                : (this.uploadedFile ? this.uploadedFile.name : (allLinks[0] || customTopic || `HSK ${this.selectedHskLevel}`));

            this.startExamSession(examData);

        } catch (err) {
            console.error("Lỗi tạo đề HSK:", err);
            alert("❌ Không thể tạo đề thi: " + (err.message || "Vui lòng kiểm tra lại API Key hoặc mạng."));
        } finally {
            if (statusEl) statusEl.classList.add('hidden');
            if (btnEl) btnEl.classList.remove('opacity-50', 'pointer-events-none');
        }
    },

    // ==========================================
    // 2. PHÒNG THI HSK & CHẾ ĐỘ XEM LẠI ĐỀ
    // ==========================================
    startExamSession(examData) {
        this.currentExam = examData;
        this.userAnswers = {};
        this.listenCounts = {};
        this.isExamSubmitted = false;
        this.isReviewMode = false;
        this.examScore = 0;

        // Khởi tạo mảng rỗng cho các câu sắp xếp từ
        examData.questions.forEach((q, idx) => {
            if (q.section === 'writing' || q.type === 'writing_reorder') {
                this.userAnswers[idx] = [];
            }
        });

        this.remainingSeconds = (this.examDurationMinutes || 15) * 60;
        this.timeSpentSeconds = 0;
        this.startTimer();
        this.switchTab('exam');
    },

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.isExamSubmitted) {
                clearInterval(this.timerInterval);
                return;
            }
            this.remainingSeconds--;
            this.timeSpentSeconds++;
            const timerEl = document.getElementById('hsk-timer-display');
            if (timerEl) {
                timerEl.innerText = this.formatTime(this.remainingSeconds);
                if (this.remainingSeconds <= 60) {
                    timerEl.classList.add('text-rose-600', 'animate-pulse');
                }
            }
            if (this.remainingSeconds <= 0) {
                clearInterval(this.timerInterval);
                alert("⏰ Đã hết thời gian làm bài! Hệ thống tự động nộp bài của bạn.");
                this.submitHskExam(true);
            }
        }, 1000);
    },

    formatTime(sec) {
        const s = Math.max(0, sec);
        const m = Math.floor(s / 60);
        const r = s % 60;
        return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
    },

    // Phát âm tiếng Trung (tách nhịp hội thoại A - B)
    speakAudioLines(qIdx) {
        if (!('speechSynthesis' in window)) {
            alert("Trình duyệt của bạn không hỗ trợ phát âm tự động.");
            return;
        }
        const q = this.currentExam?.questions?.[qIdx];
        if (!q || !Array.isArray(q.audioLines)) return;

        // Khi đang thi thật: giới hạn tối đa 2 lần nghe/câu
        if (!this.isExamSubmitted && !this.isReviewMode) {
            const count = this.listenCounts[qIdx] || 0;
            if (count >= 2) {
                alert("Quy chế thi HSK: Mỗi câu nghe chỉ được nghe tối đa 2 lần!");
                return;
            }
            this.listenCounts[qIdx] = count + 1;
            const badge = document.getElementById(`listen-count-${qIdx}`);
            if (badge) badge.innerText = `${this.listenCounts[qIdx]}/2 lượt`;
        }

        window.speechSynthesis.cancel();
        let delay = 50;
        q.audioLines.forEach((line, i) => {
            const cleanText = (line.zh || '').replace(/[^一-龥㐀-䶿，。！？、]/g, ' ').trim();
            if (!cleanText) return;
            setTimeout(() => {
                const u = new SpeechSynthesisUtterance(cleanText);
                u.lang = 'zh-CN';
                u.rate = 0.85;
                u.pitch = (i % 2 === 1) ? 1.12 : 0.95; // Tạo khác biệt nhẹ giữa giọng Nam/Nữ
                window.speechSynthesis.speak(u);
            }, delay);
            delay += Math.max(1800, cleanText.length * 260 + 450);
        });
    },

    speakSingleZh(text) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const clean = (text || '').replace(/[^一-龥㐀-䶿，。！？、]/g, ' ').trim();
        if (!clean) return;
        setTimeout(() => {
            const u = new SpeechSynthesisUtterance(clean);
            u.lang = 'zh-CN';
            u.rate = 0.85;
            window.speechSynthesis.speak(u);
        }, 50);
    },

    selectMcqOption(qIdx, optKey) {
        if (this.isExamSubmitted || this.isReviewMode) return;
        this.userAnswers[qIdx] = optKey;
        this.renderExamView(document.getElementById('hsk-main-viewport'));
    },

    // Thao tác chạm để xếp từ (Tap-to-order) cho phần Viết
    pickWritingWord(qIdx, wordIdx) {
        if (this.isExamSubmitted || this.isReviewMode) return;
        const arr = Array.isArray(this.userAnswers[qIdx]) ? [...this.userAnswers[qIdx]] : [];
        if (!arr.includes(wordIdx)) {
            arr.push(wordIdx);
            this.userAnswers[qIdx] = arr;
            this.renderExamView(document.getElementById('hsk-main-viewport'));
        }
    },

    unpickWritingWord(qIdx, posInAnswer) {
        if (this.isExamSubmitted || this.isReviewMode) return;
        const arr = Array.isArray(this.userAnswers[qIdx]) ? [...this.userAnswers[qIdx]] : [];
        arr.splice(posInAnswer, 1);
        this.userAnswers[qIdx] = arr;
        this.renderExamView(document.getElementById('hsk-main-viewport'));
    },

    renderExamView(vp) {
        if (!this.currentExam) {
            vp.innerHTML = `
                <div class="my-auto text-center space-y-3 p-4">
                    <div class="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 mx-auto flex items-center justify-center text-2xl">
                        <i class="fa-solid fa-file-circle-question"></i>
                    </div>
                    <h3 class="text-base font-black">Chưa có đề thi đang mở</h3>
                    <p class="text-xs opacity-75 max-w-xs mx-auto">Hãy sang mục <b>Tạo đề HSK</b> để AI biên soạn đề thi mới hoặc mở lại đề từ <b>Lịch sử thi</b>.</p>
                    <button onclick="window.CZHskApp.switchTab('setup')" class="px-5 py-2 btn-3d text-xs font-bold rounded-xl cursor-pointer">Tạo đề thi ngay</button>
                </div>
            `;
            return;
        }

        const exam = this.currentExam;
        const questions = exam.questions || [];
        const showControls = this.isExamSubmitted || this.isReviewMode;

        let questionsHtml = questions.map((q, idx) => {
            const isListening = (q.section === 'listening');
            const isWriting = (q.section === 'writing' || q.type === 'writing_reorder');
            const sectionLabel = isListening ? '🎧 Phần Nghe (听力)' : (isWriting ? '✍️ Phần Viết (书写)' : '📖 Phần Đọc hiểu (阅读)');
            const sectionColor = isListening ? 'bg-blue-500/10 text-blue-600' : (isWriting ? 'bg-purple-500/10 text-purple-600' : 'bg-emerald-500/10 text-emerald-600');

            // Đánh giá đúng/sai khi đã nộp bài hoặc xem lại
            let isCorrect = false;
            if (showControls) {
                if (isWriting) {
                    const pickedIndices = this.userAnswers[idx] || [];
                    const userStr = pickedIndices.map(wi => (q.wordBank || [])[wi] || '').join('').replace(/\s+/g, '');
                    const targetStr = (q.correctSentenceZh || '').replace(/[。！？，、\s]/g, '');
                    isCorrect = (userStr === targetStr && userStr.length > 0);
                } else {
                    isCorrect = (this.userAnswers[idx] === q.correctAnswer);
                }
            }

            let bodyHtml = '';

            if (isListening) {
                const usedCount = this.listenCounts[idx] || 0;
                bodyHtml += `
                    <div class="p-3 rounded-2xl bg-slate-500/5 border border-slate-500/10 flex items-center justify-between gap-2">
                        <div class="flex items-center space-x-2.5">
                            <button type="button" onclick="window.CZHskApp.speakAudioLines(${idx})" class="w-10 h-10 rounded-full btn-3d flex items-center justify-center shrink-0 cursor-pointer shadow">
                                <i class="fa-solid fa-volume-high text-sm"></i>
                            </button>
                            <div class="text-left">
                                <p class="text-xs font-bold">${q.instruction || 'Nghe và chọn đáp án đúng'}</p>
                                <p id="listen-count-${idx}" class="text-[10.5px] font-semibold text-rose-600">
                                    ${showControls ? 'Đã mở khóa nghe không giới hạn' : `${usedCount}/2 lượt nghe`}
                                </p>
                            </div>
                        </div>
                    </div>
                `;

                // Khi Xem lại đề: hiện transcript lời thoại kèm Pinyin / Nghĩa tùy nút gạt
                if (showControls && Array.isArray(q.audioLines)) {
                    bodyHtml += `
                        <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1.5 text-left">
                            <p class="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">📜 Nội dung băng nghe (Script):</p>
                            ${q.audioLines.map(line => `
                                <div class="text-xs border-b border-amber-500/10 pb-1 last:border-none last:pb-0">
                                    <div class="flex items-center justify-between">
                                        <span class="font-bold font-chinese"><b>${line.speaker}:</b> ${line.zh}</span>
                                        <button type="button" onclick="window.CZHskApp.speakSingleZh('${(line.zh || '').replace(/'/g, "\'")}')" class="text-rose-600 hover:scale-110 cursor-pointer ml-2"><i class="fa-solid fa-volume-high text-[11px]"></i></button>
                                    </div>
                                    ${this.reviewShowPinyin && line.pinyin ? `<p class="text-[11px] text-rose-600 font-semibold">🔊 ${line.pinyin}</p>` : ''}
                                    ${this.reviewShowMeaning && line.vi ? `<p class="text-[11px] opacity-85">🇻🇳 ${line.vi}</p>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
            } else if (!isWriting && q.passageZh) {
                // Đoạn đọc hiểu
                bodyHtml += `
                    <div class="p-3 rounded-2xl bg-slate-500/5 border border-slate-500/10 text-left space-y-1">
                        <div class="flex justify-between items-start gap-2">
                            <p class="text-sm sm:text-base font-bold font-chinese leading-relaxed">${q.passageZh}</p>
                            ${showControls ? `<button type="button" onclick="window.CZHskApp.speakSingleZh('${(q.passageZh || '').replace(/'/g, "\'")}')" class="text-rose-600 hover:scale-110 cursor-pointer shrink-0 pt-0.5"><i class="fa-solid fa-volume-high text-xs"></i></button>` : ''}
                        </div>
                        ${showControls && this.reviewShowPinyin && q.passagePinyin ? `<p class="text-xs text-rose-600 font-semibold">🔊 ${q.passagePinyin}</p>` : ''}
                        ${showControls && this.reviewShowMeaning && q.passageVi ? `<p class="text-xs opacity-85">🇻🇳 ${q.passageVi}</p>` : ''}
                    </div>
                `;
            }

            // Câu hỏi & Lựa chọn A/B/C/D (cho Nghe & Đọc)
            if (!isWriting) {
                if (q.questionZh) {
                    bodyHtml += `
                        <div class="text-left space-y-0.5 pt-1">
                            <div class="flex items-center justify-between">
                                <p class="text-xs sm:text-sm font-black font-chinese text-rose-600">${q.questionZh}</p>
                                ${showControls ? `<button type="button" onclick="window.CZHskApp.speakSingleZh('${(q.questionZh || '').replace(/'/g, "\'")}')" class="text-rose-600 hover:scale-110 cursor-pointer ml-2"><i class="fa-solid fa-volume-high text-xs"></i></button>` : ''}
                            </div>
                            ${showControls && this.reviewShowPinyin && q.questionPinyin ? `<p class="text-[11px] text-rose-500 font-semibold">🔊 ${q.questionPinyin}</p>` : ''}
                            ${showControls && this.reviewShowMeaning && q.questionVi ? `<p class="text-[11px] opacity-80">🇻🇳 ${q.questionVi}</p>` : ''}
                        </div>
                    `;
                }

                const optionsHtml = (q.options || []).map(opt => {
                    const isPicked = (this.userAnswers[idx] === opt.key);
                    const isRightOpt = (q.correctAnswer === opt.key);

                    let optStyle = 'theme-card border hover:border-rose-400';
                    if (!showControls && isPicked) {
                        optStyle = 'border-2 border-rose-500 bg-rose-500/10 shadow-xs';
                    } else if (showControls) {
                        if (isRightOpt) optStyle = 'border-2 border-emerald-500 bg-emerald-500/15';
                        else if (isPicked && !isRightOpt) optStyle = 'border-2 border-rose-500 bg-rose-500/15';
                        else optStyle = 'theme-card border opacity-75';
                    }

                    return `
                        <div onclick="window.CZHskApp.selectMcqOption(${idx}, '${opt.key}')" class="p-2.5 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition ${optStyle}">
                            <div class="flex items-center space-x-2.5 text-left min-w-0">
                                <span class="w-6 h-6 rounded-full ${isPicked || (showControls && isRightOpt) ? 'bg-rose-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'} font-black text-xs flex items-center justify-center shrink-0">${opt.key}</span>
                                <div class="min-w-0">
                                    <p class="text-xs sm:text-sm font-bold font-chinese truncate">${opt.zh}</p>
                                    ${showControls && this.reviewShowPinyin && opt.pinyin ? `<p class="text-[10.5px] text-rose-600 font-semibold">${opt.pinyin}</p>` : ''}
                                    ${showControls && this.reviewShowMeaning && opt.vi ? `<p class="text-[10.5px] opacity-80">${opt.vi}</p>` : ''}
                                </div>
                            </div>
                            ${showControls ? `
                                <button type="button" onclick="event.stopPropagation(); window.CZHskApp.speakSingleZh('${(opt.zh || '').replace(/'/g, "\'")}')" class="text-rose-500 hover:scale-110 cursor-pointer shrink-0 px-1">
                                    <i class="fa-solid fa-volume-high text-xs"></i>
                                </button>
                            ` : ''}
                        </div>
                    `;
                }).join('');

                bodyHtml += `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">${optionsHtml}</div>`;
            } else {
                // Phần Viết: Sắp xếp từ (Tap-to-order)
                const wordBank = q.wordBank || [];
                const pickedIndices = Array.isArray(this.userAnswers[idx]) ? this.userAnswers[idx] : [];

                const answerSlotsHtml = pickedIndices.length > 0
                    ? pickedIndices.map((wi, pos) => `
                        <button type="button" onclick="window.CZHskApp.unpickWritingWord(${idx}, ${pos})" class="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-black text-sm font-chinese shadow-xs cursor-pointer hover:scale-105 transition">
                            ${wordBank[wi]}
                        </button>
                    `).join('')
                    : `<span class="text-xs opacity-50 italic">Chạm vào các thẻ từ bên dưới để xếp thành câu...</span>`;

                const bankHtml = wordBank.map((w, wi) => {
                    const alreadyUsed = pickedIndices.includes(wi);
                    const py = (q.wordBankPinyin || [])[wi] || '';
                    return `
                        <button type="button" onclick="window.CZHskApp.pickWritingWord(${idx}, ${wi})" ${alreadyUsed ? 'disabled' : ''} class="px-3 py-1.5 rounded-xl border text-sm font-bold font-chinese transition ${alreadyUsed ? 'opacity-30 border-dashed cursor-not-allowed' : 'theme-card hover:border-rose-500 cursor-pointer shadow-xs'}">
                            <span>${w}</span>
                            ${showControls && this.reviewShowPinyin && py ? `<span class="block text-[10px] text-rose-500 font-sans">${py}</span>` : ''}
                        </button>
                    `;
                }).join('');

                bodyHtml += `
                    <div class="space-y-2 text-left">
                        <p class="text-xs font-bold opacity-85">${q.instruction || 'Sắp xếp các từ sau thành câu hoàn chỉnh:'}</p>
                        <div class="min-h-[46px] p-2.5 rounded-2xl border-2 border-dashed border-rose-500/40 bg-rose-500/5 flex flex-wrap items-center gap-1.5">
                            ${answerSlotsHtml}
                        </div>
                        <div class="flex flex-wrap gap-2 pt-1">${bankHtml}</div>
                    </div>
                `;
            }

            // Hộp giải thích chi tiết khi Xem lại đề / sau khi nộp bài
            let reviewBoxHtml = '';
            if (showControls) {
                reviewBoxHtml = `
                    <div class="mt-2 p-3 rounded-2xl border text-left text-xs space-y-1 ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}">
                        <div class="flex items-center justify-between">
                            <span class="font-black ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}">
                                ${isCorrect ? '✓ Chính xác!' : '✗ Chưa chính xác'}
                            </span>
                            ${isWriting && q.correctSentenceZh ? `
                                <button type="button" onclick="window.CZHskApp.speakSingleZh('${q.correctSentenceZh.replace(/'/g, "\'")}')" class="text-rose-600 font-bold hover:underline cursor-pointer flex items-center space-x-1">
                                    <i class="fa-solid fa-volume-high"></i><span>Nghe câu đúng</span>
                                </button>
                            ` : ''}
                        </div>
                        ${isWriting ? `
                            <p class="font-black font-chinese text-sm text-emerald-700 dark:text-emerald-400">Đáp án chuẩn: ${q.correctSentenceZh || ''}</p>
                            ${this.reviewShowPinyin && q.correctSentencePinyin ? `<p class="text-[11px] text-rose-600 font-semibold">🔊 ${q.correctSentencePinyin}</p>` : ''}
                            ${this.reviewShowMeaning && q.correctSentenceVi ? `<p class="text-[11px] opacity-85">🇻🇳 ${q.correctSentenceVi}</p>` : ''}
                        ` : `
                            <p class="font-bold">Đáp án đúng: <span class="text-emerald-600 font-black">${q.correctAnswer}</span></p>
                        `}
                        <p class="text-[11.5px] leading-relaxed pt-1 border-t border-slate-500/10">
                            <b class="text-rose-600">💡 Giải thích:</b> ${q.explanationVi || ''}
                        </p>
                    </div>
                `;
            }

            return `
                <div class="p-3.5 rounded-2xl theme-card border border-slate-500/15 space-y-2 shadow-xs">
                    <div class="flex items-center justify-between border-b pb-1.5 border-slate-500/10">
                        <span class="text-xs font-black text-rose-600">Câu ${idx + 1} / ${questions.length}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-lg ${sectionColor}">${sectionLabel}</span>
                    </div>
                    ${bodyHtml}
                    ${reviewBoxHtml}
                </div>
            `;
        }).join('');

        // Thanh công cụ trên cùng của phòng thi
        let topBarHtml = '';
        if (!showControls) {
            topBarHtml = `
                <div class="shrink-0 flex items-center justify-between p-2.5 rounded-2xl theme-card border border-rose-500/20 shadow-xs gap-2">
                    <div class="truncate text-left">
                        <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-600 text-white">HSK ${exam.detectedLevel || this.selectedHskLevel}</span>
                        <h2 class="text-xs sm:text-sm font-black truncate mt-0.5 font-chinese">${exam.examTitle}</h2>
                    </div>
                    <div class="flex items-center space-x-2 shrink-0">
                        <div class="px-3 py-1.5 rounded-xl bg-slate-500/10 font-mono font-black text-xs sm:text-sm flex items-center space-x-1.5">
                            <i class="fa-regular fa-clock text-rose-600"></i>
                            <span id="hsk-timer-display">${this.formatTime(this.remainingSeconds)}</span>
                        </div>
                        <button type="button" onclick="window.CZHskApp.submitHskExam(false)" class="px-4 py-2 btn-3d font-bold text-xs rounded-xl cursor-pointer shadow">
                            Nộp bài
                        </button>
                    </div>
                </div>
            `;
        } else {
            // Thanh kết quả + Nút Xem lại đề (Ẩn/Hiện Pinyin, Ẩn/Hiện Nghĩa)
            const totalQ = questions.length;
            const score100 = Math.round((this.examScore / Math.max(1, totalQ)) * 100);
            topBarHtml = `
                <div class="shrink-0 p-2.5 sm:p-3 rounded-2xl theme-card border-2 border-emerald-500/40 bg-emerald-500/5 space-y-2 shadow-xs">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div class="text-left">
                            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-600 text-white">KẾT QUẢ BÀI THI HSK ${exam.detectedLevel || ''}</span>
                            <p class="text-sm sm:text-base font-black mt-0.5">
                                Điểm số: <span class="text-rose-600 text-lg">${score100}/100</span>
                                <span class="text-xs font-bold opacity-75 ml-1">(Đúng ${this.examScore}/${totalQ} câu)</span>
                            </p>
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5">
                            <button type="button" onclick="window.CZHskApp.toggleReviewPinyin()" class="px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${this.reviewShowPinyin ? 'bg-rose-600 text-white border-rose-600' : 'theme-card'}">
                                ${this.reviewShowPinyin ? 'Ẩn Pinyin' : 'Hiện Pinyin'}
                            </button>
                            <button type="button" onclick="window.CZHskApp.toggleReviewMeaning()" class="px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${this.reviewShowMeaning ? 'bg-rose-600 text-white border-rose-600' : 'theme-card'}">
                                ${this.reviewShowMeaning ? 'Ẩn Nghĩa' : 'Hiện Nghĩa'}
                            </button>
                            <button type="button" onclick="window.CZHskApp.switchTab('setup')" class="px-3 py-1.5 btn-3d text-[11px] font-bold rounded-xl cursor-pointer">
                                + Đề mới
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        vp.innerHTML = `
            <div class="w-full max-w-3xl mx-auto h-full flex flex-col justify-between space-y-2 min-h-0">
                ${topBarHtml}
                <div class="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 py-0.5">
                    ${questionsHtml}
                </div>
            </div>
        `;
    },

    toggleReviewPinyin() {
        this.reviewShowPinyin = !this.reviewShowPinyin;
        this.renderExamView(document.getElementById('hsk-main-viewport'));
    },

    toggleReviewMeaning() {
        this.reviewShowMeaning = !this.reviewShowMeaning;
        this.renderExamView(document.getElementById('hsk-main-viewport'));
    },

    async submitHskExam(isAuto) {
        if (!this.currentExam || this.isExamSubmitted) return;
        if (!isAuto && !confirm("Bạn có chắc chắn muốn nộp bài thi HSK này không?")) return;

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.isExamSubmitted = true;
        this.isReviewMode = true;
        this.reviewShowPinyin = true;
        this.reviewShowMeaning = true;

        const questions = this.currentExam.questions || [];
        let correctCount = 0;

        questions.forEach((q, idx) => {
            const isWriting = (q.section === 'writing' || q.type === 'writing_reorder');
            if (isWriting) {
                const pickedIndices = this.userAnswers[idx] || [];
                const userStr = pickedIndices.map(wi => (q.wordBank || [])[wi] || '').join('').replace(/\s+/g, '');
                const targetStr = (q.correctSentenceZh || '').replace(/[。！？，、\s]/g, '');
                if (userStr === targetStr && userStr.length > 0) correctCount++;
            } else {
                if (this.userAnswers[idx] === q.correctAnswer) correctCount++;
            }
        });

        this.examScore = correctCount;
        const totalQ = questions.length;
        const score100 = Math.round((correctCount / Math.max(1, totalQ)) * 100);

        // Lưu kết quả lên Firestore (collection: hsk_results) & localStorage
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const resultId = `hsk_${Date.now()}`;

        const record = {
            id: resultId,
            username: this.currentAuth.username,
            fullname: this.currentAuth.fullname,
            job: this.currentAuth.job || '',
            className: this.currentAuth.className || '',
            examTitle: this.currentExam.examTitle,
            hskLevel: this.currentExam.detectedLevel || this.selectedHskLevel,
            sourceLabel: this.currentExam.sourceLabel || '',
            score100: score100,
            correctCount: correctCount,
            totalQuestions: totalQ,
            timeSpent: this.formatTime(this.timeSpentSeconds),
            submittedAt: dateStr,
            timestamp: Date.now(),
            examSnapshot: this.currentExam,
            userAnswersSnapshot: this.userAnswers
        };

        // Lưu localStorage dự phòng
        try {
            const localHist = JSON.parse(localStorage.getItem('chinesez_hsk_history')) || [];
            localHist.unshift(record);
            localStorage.setItem('chinesez_hsk_history', JSON.stringify(localHist.slice(0, 30)));
        } catch (e) {}

        // Lưu lên Cloud Firestore
        if (this.db) {
            try {
                await this.db.collection("hsk_results").doc(resultId).set(record);
            } catch (e) {
                console.warn("Lỗi lưu kết quả HSK lên Firestore:", e);
            }
        }

        this.renderExamView(document.getElementById('hsk-main-viewport'));
    },

    // ==========================================
    // 3. LỊCH SỬ LUYỆN ĐỀ HSK CỦA NGƯỜI DÙNG
    // ==========================================
    async renderHistoryView(vp) {
        vp.innerHTML = `<div class="my-auto text-center text-xs opacity-70"><i class="fa-solid fa-spinner fa-spin text-rose-600 mr-1.5"></i>Đang tải lịch sử luyện đề HSK...</div>`;

        let records = [];
        try {
            const localHist = JSON.parse(localStorage.getItem('chinesez_hsk_history')) || [];
            records = localHist.filter(r => r.username === this.currentAuth.username);
        } catch (e) {}

        if (this.db) {
            try {
                const snap = await this.db.collection("hsk_results")
                    .where("username", "==", this.currentAuth.username)
                    .get();
                if (!snap.empty) {
                    const cloudRecs = [];
                    snap.forEach(doc => cloudRecs.push(doc.data()));
                    cloudRecs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                    records = cloudRecs;
                }
            } catch (e) {
                console.warn("Lỗi tải lịch sử HSK từ Firestore:", e);
            }
        }

        this.hskHistoryList = records;

        if (records.length === 0) {
            vp.innerHTML = `
                <div class="my-auto text-center space-y-3 p-4">
                    <div class="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 mx-auto flex items-center justify-center text-2xl">
                        <i class="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <h3 class="text-base font-black">Chưa có lịch sử luyện đề</h3>
                    <p class="text-xs opacity-75">Hoàn thành bài thi đầu tiên để theo dõi tiến bộ của bạn nhé!</p>
                    <button onclick="window.CZHskApp.switchTab('setup')" class="px-5 py-2 btn-3d text-xs font-bold rounded-xl cursor-pointer">Tạo đề thi ngay</button>
                </div>
            `;
            return;
        }

        const listHtml = records.map((r, i) => `
            <div class="p-3 rounded-2xl theme-card border border-slate-500/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left shadow-xs">
                <div class="space-y-0.5 min-w-0 flex-1">
                    <div class="flex items-center space-x-2">
                        <span class="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black shrink-0">HSK ${r.hskLevel}</span>
                        <h4 class="text-xs sm:text-sm font-black truncate font-chinese">${r.examTitle}</h4>
                    </div>
                    <p class="text-[10.5px] opacity-70 truncate">Nguồn: ${r.sourceLabel || 'Tự chọn'} • Ngày: ${r.submittedAt}</p>
                </div>
                <div class="flex items-center justify-between sm:justify-end space-x-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-none border-slate-500/10">
                    <div class="text-left sm:text-right">
                        <span class="text-sm font-black text-rose-600">${r.score100}/100 điểm</span>
                        <span class="block text-[10px] opacity-70">Đúng ${r.correctCount}/${r.totalQuestions} • ${r.timeSpent || ''}</span>
                    </div>
                    ${r.examSnapshot ? `
                        <button type="button" onclick="window.CZHskApp.openSavedExamReview(${i})" class="px-3 py-1.5 btn-theme-sec text-xs font-bold rounded-xl cursor-pointer shadow-xs">
                            <i class="fa-solid fa-eye mr-1"></i>Xem lại đề
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        vp.innerHTML = `
            <div class="w-full max-w-3xl mx-auto h-full flex flex-col space-y-2.5 min-h-0">
                <div class="flex items-center justify-between border-b pb-2 border-slate-500/10 shrink-0">
                    <h2 class="text-sm sm:text-base font-black text-rose-600"><i class="fa-solid fa-trophy mr-1.5"></i>Lịch sử luyện đề HSK (${records.length} bài)</h2>
                    <button onclick="window.CZHskApp.switchTab('setup')" class="px-3 py-1 btn-3d text-xs font-bold rounded-xl cursor-pointer">+ Tạo đề mới</button>
                </div>
                <div class="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                    ${listHtml}
                </div>
            </div>
        `;
    },

    openSavedExamReview(recordIdx) {
        const rec = this.hskHistoryList[recordIdx];
        if (!rec || !rec.examSnapshot) return;
        this.currentExam = rec.examSnapshot;
        this.userAnswers = rec.userAnswersSnapshot || {};
        this.examScore = rec.correctCount || 0;
        this.isExamSubmitted = true;
        this.isReviewMode = true;
        this.reviewShowPinyin = true;
        this.reviewShowMeaning = true;
        this.switchTab('exam');
    }
};

window.CZHskApp = CZHskApp;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.CZHskApp.init());
} else {
    window.CZHskApp.init();
}
