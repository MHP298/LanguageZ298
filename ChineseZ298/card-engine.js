/**
 * MODULE 1: CZCardEngine - LÕI ĐIỀU PHỐI VÀ HIỂN THỊ CÁC THẺ HỌC
 */
const CZCardEngine = {
    STUDY_MODES: [
        { id: 'vocab', line1: '1. Từ', line2: 'vựng' },
        { id: 'cloze', line1: '2. Điền', line2: 'từ' },
        { id: 'grammar', line1: '3. Ngữ', line2: 'pháp' },
        { id: 'dialogue', line1: '4. Hội', line2: 'thoại' }
    ],

    activeLesson: null,
    curCardMode: 'vocab',
    curIdx: 0,
    subVocabMode: 'flashcard',

    clozeStarted: false,
    clozeLevel: 1,
    unlockedLevels: { 1: true, 2: false, 3: false },
    curClozeIdx: 0,
    levelQuestions: [],
    selectedChoice: null,
    selectedChoiceIndex: -1,
    isAnswerChecked: false,

    isGrammarPracticeMode: false,
    grammarUserChoices: {},
    grammarShowPinyin: false,
    grammarShowVi: false,
    isGrammarChecked: false,
    showPinyinDialogue: false,
    showViDialogue: false,

    memoryQuizData: [],
    memoryQuizScore: 0,
    qHanzi: "", qPinyin: "", qMeaning: "",
    gameSelectedHanzi: null,
    gameSelectedPinyin: null,
    gameMatchedCount: 0,
    randomizedGameHanzi: [],
    randomizedGamePinyin: [],

    speakZh(text) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        let cleanText = (text || "").replace(/[\/\+_\-]/g, '，');
        cleanText = cleanText.replace(/[^\u4e00-\u9fa5\u3400-\u4dbf，。！？、]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!cleanText) return;
        setTimeout(() => {
            const u = new SpeechSynthesisUtterance(cleanText);
            u.lang = 'zh-CN';
            u.rate = 0.85;
            window.speechSynthesis.speak(u);
        }, 60);
    },

    openLessonStudy(id) {
        this.activeLesson = CZAppCore.lessonsDB.find(x => x.id == id) || CZAppCore.lessonsDB[0];
        this.curCardMode = 'vocab';
        this.subVocabMode = 'flashcard';
        this.curIdx = 0;
        this.clozeStarted = false;
        this.clozeLevel = 1;
        this.unlockedLevels = { 1: true, 2: false, 3: false };
        this.curClozeIdx = 0;
        this.isGrammarPracticeMode = false;
        this.showPinyinDialogue = false;
        this.showViDialogue = false;
        this.grammarShowPinyin = false;
        this.grammarShowVi = false;
        this.initMemoryStore();
        this.initMatchingGameData();
        this.renderStudyStageView();
    },

    renderStudyStageView() {
        const vp = document.getElementById('main-viewport');
        const tabsHtml = this.STUDY_MODES.map(m => `
            <button onclick="CZCardEngine.switchModeBtn('${m.id}')" class="nav-study-btn-pill cursor-pointer ${this.curCardMode === m.id ? 'active' : ''}">
                <span>${m.line1}</span>
                <span>${m.line2}</span>
            </button>
        `).join('');

        vp.innerHTML = `
            <div class="w-full max-w-lg h-full flex flex-col justify-between py-1">
                <div class="shrink-0 flex items-center justify-between px-2 py-1 mb-1 theme-card rounded-xl border border-slate-500/10 shadow-xs">
                    <span class="text-[10px] font-black uppercase text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded-lg shrink-0">Đang học</span>
                    <h2 class="text-xs sm:text-sm font-black truncate mx-2 text-center flex-1 font-chinese" title="${this.activeLesson.title}">${this.activeLesson.title}</h2>
                    <span class="text-[9px] opacity-60 font-mono shrink-0">${this.activeLesson.vocabs ? this.activeLesson.vocabs.length : 0} từ</span>
                </div>

                <div class="theme-card p-1 rounded-2xl shrink-0 shadow-xs mb-1">
                    <div class="nav-study-tabs">
                        ${tabsHtml}
                        <button onclick="CZAppCore.setTab('room')" class="btn-theme-exit font-black px-3.5 py-2 rounded-full text-xs cursor-pointer shrink-0 ml-1 shadow-xs">Thoát</button>
                    </div>
                </div>
                <div id="study-stage-box" class="flex-1 flex flex-col justify-center min-h-0 py-1"></div>
            </div>
        `;
        this.renderSelectedCard();
    },

    switchModeBtn(m) {
        this.curCardMode = m;
        this.curIdx = 0;
        if (m === 'vocab') this.subVocabMode = 'flashcard';
        if (m === 'cloze') this.clozeStarted = false;
        this.isGrammarPracticeMode = false;
        this.showPinyinDialogue = false;
        this.showViDialogue = false;
        this.grammarShowPinyin = false;
        this.grammarShowVi = false;
        this.renderStudyStageView();
    },

    renderSelectedCard() {
        const stage = document.getElementById('study-stage-box');
        if (!stage) return;
        if (this.curCardMode === 'vocab') {
            this.renderVocabCompositeView(stage);
        } else if (this.curCardMode === 'cloze') {
            if (!this.clozeStarted) {
                this.renderClozeLevelSelectView(stage);
            } else {
                this.renderClozeLevelActiveView(stage);
            }
        } else if (this.curCardMode === 'grammar') {
            if (this.isGrammarPracticeMode) {
                this.renderGrammarPracticeView(stage);
            } else {
                this.renderGrammarNormalView(stage);
            }
        } else if (this.curCardMode === 'dialogue') {
            this.renderDialogueView(stage);
        }
    },

    switchSubVocab(sub) {
        this.subVocabMode = sub;
        if (sub === 'memory') this.initMemoryStore();
        if (sub === 'matching') this.initMatchingGameData();
        this.renderSelectedCard();
    },

    renderVocabCompositeView(stage) {
        const isFlash = (this.subVocabMode === 'flashcard');
        const isMem = (this.subVocabMode === 'memory');
        const isMatch = (this.subVocabMode === 'matching');

        stage.innerHTML = `
            <div class="theme-card rounded-2xl p-2.5 sm:p-3 flex flex-col justify-between h-full space-y-2">
                <div class="flex justify-between items-center shrink-0 border-b pb-1.5 border-slate-500/10">
                    <span class="text-xs font-bold text-rose-600 uppercase flex items-center space-x-1">
                        <i class="fa-solid fa-book-open text-xs"></i> <span>Học từ vựng</span>
                    </span>
                    <div class="flex space-x-1">
                        <button onclick="CZCardEngine.switchSubVocab('flashcard')" class="px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${isFlash ? 'btn-3d' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60'}">
                            Từ mới
                        </button>
                        <button onclick="CZCardEngine.switchSubVocab('memory')" class="px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${isMem ? 'btn-3d' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60'}">
                            Nhớ từ
                        </button>
                        <button onclick="CZCardEngine.switchSubVocab('matching')" class="px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${isMatch ? 'btn-3d' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/60'}">
                            Ghép từ
                        </button>
                    </div>
                </div>
                <div id="vocab-sub-stage" class="flex-1 min-h-0 flex flex-col justify-center"></div>
            </div>
        `;

        const subStage = document.getElementById('vocab-sub-stage');
        if (isFlash) this.renderSubFlashcard(subStage);
        else if (isMem) this.renderSubMemory(subStage);
        else if (isMatch) this.renderSubMatchingGame(subStage);
    },

    renderSubFlashcard(stage) {
        const vocabs = this.activeLesson.vocabs || [];
        const item = vocabs[this.curIdx] || { hanzi: "你好", pinyin: "nǐ hǎo", meaning: "Xin chào", example_cn: "你好！很高兴认识你。", example_py: "Nǐ hǎo! Hěn gāoxìng rènshí nǐ.", example_vi: "Xin chào! Rất vui được gặp bạn." };
        stage.innerHTML = `
            <div class="flex-1 flex flex-col justify-between min-h-0 space-y-1.5">
                <div class="flip-card-container card-stage w-full flex-1 min-h-[170px] max-h-[250px] cursor-pointer" onclick="CZCardEngine.flipCardBox(this)">
                    <div class="flip-card-inner">
                        <div class="card-front theme-card p-4 sm:p-5 flex flex-col justify-between shadow-xs border border-slate-500/10">
                            <div class="flex justify-between items-center">
                                <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600">Từ #${this.curIdx + 1}/${vocabs.length}</span>
                                <button onclick="event.stopPropagation(); CZCardEngine.speakZh('${item.hanzi}')" class="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center hover:scale-110 cursor-pointer">
                                    <i class="fa-solid fa-volume-high text-sm"></i>
                                </button>
                            </div>
                            <div class="text-center my-auto">
                                <h2 class="txt-hanzi text-5xl sm:text-6xl font-black text-rose-600 mb-2 leading-none font-chinese">${item.hanzi}</h2>
                                <p class="text-xl sm:text-2xl font-black opacity-90 text-rose-500">${item.pinyin}</p>
                            </div>
                            <div class="text-xs opacity-60"><i class="fa-solid fa-rotate mr-1"></i> Chạm lật xem câu ví dụ & dịch nghĩa</div>
                        </div>
                        <div class="card-back theme-card p-4 sm:p-5 flex flex-col justify-between shadow-xs border border-slate-500/10">
                            <div class="flex justify-between items-center">
                                <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">Nghĩa & Câu ví dụ</span>
                                <button onclick="event.stopPropagation(); CZCardEngine.speakZh('${item.example_cn || item.hanzi}')" class="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center hover:scale-110 cursor-pointer">
                                    <i class="fa-solid fa-volume-high text-sm"></i>
                                </button>
                            </div>
                            <div class="text-center my-auto space-y-2">
                                <h3 class="text-2xl sm:text-3xl font-black leading-tight" style="color: var(--text-main);">${item.meaning}</h3>
                                <div class="p-2.5 rounded-2xl theme-card border text-left space-y-1 bg-white/70 dark:bg-slate-800/80">
                                    <p class="font-black text-sm sm:text-base leading-snug font-chinese" style="color: var(--text-main);">${item.example_cn || item.example || item.hanzi}</p>
                                    <p class="text-xs text-rose-600 font-bold">🔊 ${item.example_py || item.pinyin}</p>
                                    <p class="text-xs font-semibold opacity-90" style="color: var(--text-main);">🇻🇳 ${item.example_vi || item.meaning}</p>
                                </div>
                            </div>
                            <div class="text-xs opacity-60">Chạm để lật lại mặt chữ Hán</div>
                        </div>
                    </div>
                </div>
                <div class="flex justify-between items-center shrink-0 pt-0.5">
                    <button onclick="CZCardEngine.prevVocab()" class="px-4 py-1.5 theme-card rounded-xl text-xs font-bold cursor-pointer">Trước</button>
                    <span class="text-xs font-bold opacity-60">Thẻ <span class="text-rose-600 font-bold">${this.curIdx + 1}</span> / ${vocabs.length}</span>
                    <button onclick="CZCardEngine.nextVocab()" class="px-4 py-1.5 btn-3d text-xs font-bold rounded-xl cursor-pointer">Tiếp</button>
                </div>
            </div>
        `;
    },

    renderSubMemory(stage) {
        if (this.memoryQuizData.length === 0) {
            stage.innerHTML = `
                <div class="theme-card rounded-2xl p-5 text-center space-y-2.5 my-auto">
                    <div class="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto text-xl">🎉</div>
                    <h3 class="text-lg font-black text-emerald-600">XUẤT SẮC! BẠN ĐÃ THUỘC TOÀN BỘ TỪ VỰNG!</h3>
                    <button onclick="CZCardEngine.initMemoryStore(); CZCardEngine.renderSelectedCard()" class="px-5 py-2 btn-3d text-xs font-bold rounded-xl cursor-pointer">Luyện lại</button>
                </div>
            `;
            return;
        }
        const hanzis = [...this.memoryQuizData].sort(() => Math.random() - 0.5);
        const pinyins = [...this.memoryQuizData].sort(() => Math.random() - 0.5);
        const meanings = [...this.memoryQuizData].sort(() => Math.random() - 0.5);

        let hOpts = hanzis.map(i => `<option value="${i.hanzi}" ${this.qHanzi === i.hanzi ? 'selected' : ''}>${i.hanzi}</option>`).join('');
        let pOpts = pinyins.map(i => `<option value="${i.pinyin}" ${this.qPinyin === i.pinyin ? 'selected' : ''}>${i.pinyin}</option>`).join('');
        let mOpts = meanings.map(i => `<option value="${i.meaning}" ${this.qMeaning === i.meaning ? 'selected' : ''}>${i.meaning}</option>`).join('');

        stage.innerHTML = `
            <div class="space-y-2.5 h-full flex flex-col justify-between">
                <div class="space-y-2">
                    <div class="flex justify-between items-center"><span class="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600">Kiểm tra nhớ từ</span><span class="text-xs font-bold text-emerald-600">Đã nhớ: ${this.memoryQuizScore}/${this.activeLesson.vocabs ? this.activeLesson.vocabs.length : 5}</span></div>
                    <p class="text-xs font-semibold opacity-80 text-left">👉 Chọn đúng chữ Hán, Pinyin và nghĩa tiếng Việt tương ứng:</p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <div><label class="block text-[10.5px] font-black uppercase text-rose-600 text-left mb-1">CHỮ HÁN</label><select id="sel-q-hanzi" onchange="CZCardEngine.qHanzi = this.value" class="w-full custom-input rounded-xl px-2.5 py-1.5 text-sm font-bold focus:outline-none"><option value="" class="text-slate-400">-- Chọn --</option>${hOpts}</select></div>
                        <div><label class="block text-[10.5px] font-black uppercase text-rose-600 text-left mb-1">PINYIN</label><select id="sel-q-pinyin" onchange="CZCardEngine.qPinyin = this.value" class="w-full custom-input rounded-xl px-2.5 py-1.5 text-sm font-bold focus:outline-none text-rose-500"><option value="" class="text-slate-400">-- Chọn --</option>${pOpts}</select></div>
                        <div><label class="block text-[10.5px] font-black uppercase text-rose-600 text-left mb-1">TIẾNG VIỆT</label><select id="sel-q-meaning" onchange="CZCardEngine.qMeaning = this.value" class="w-full custom-input rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"><option value="" class="text-slate-400">-- Chọn --</option>${mOpts}</select></div>
                    </div>
                    <div id="memory-msg-box" class="text-xs font-bold min-h-[16px]"></div>
                </div>
                <div class="flex justify-center pt-1 shrink-0"><button onclick="CZCardEngine.checkMemoryAnswerNow()" class="w-full sm:w-auto px-7 py-2 btn-3d text-xs font-bold rounded-xl cursor-pointer"><i class="fa-solid fa-circle-check mr-1.5"></i> Kiểm tra đáp án</button></div>
            </div>
        `;
    },

    renderSubMatchingGame(stage) {
        const vocabs = this.activeLesson.vocabs || [];
        let hanziCols = this.randomizedGameHanzi.map(item => `<div id="game-hz-${item.id}" onclick="CZCardEngine.onGameSelectHanzi('${item.id}')" class="game-cell min-h-[48px] h-[48px] rounded-2xl border-2 border-slate-300/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 flex items-center justify-center font-black text-2xl font-chinese text-slate-800 dark:text-slate-100 cursor-pointer shadow-xs transition select-none hover:scale-102 shrink-0">${item.val}</div>`).join('');
        let pinyinCols = this.randomizedGamePinyin.map(item => `<div id="game-py-${item.id}" onclick="CZCardEngine.onGameSelectPinyin('${item.id}', '${item.targetHanzi}')" class="game-cell min-h-[48px] h-[48px] rounded-2xl border-2 border-slate-300/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 flex items-center justify-center font-bold text-base text-rose-600 cursor-pointer shadow-xs transition select-none hover:scale-102 shrink-0">${item.val}</div>`).join('');

        stage.innerHTML = `
            <div class="h-full flex flex-col justify-between">
                <div class="flex justify-between items-center mb-1 shrink-0"><span class="text-xs font-black text-purple-600 bg-purple-500/10 px-2.5 py-0.5 rounded-full flex items-center space-x-1"><span>🎮</span> <span>Game Ghép Cặp</span></span><span id="game-progress-lbl" class="text-xs font-bold text-emerald-600">${this.gameMatchedCount} / ${vocabs.length} cặp</span></div>
                <div class="flex-1 flex gap-2.5 my-1 overflow-hidden min-h-0">
                    <div class="flex-1 flex flex-col gap-2 h-full overflow-y-auto pr-1">${hanziCols}</div>
                    <div class="flex-1 flex flex-col gap-2 h-full overflow-y-auto pr-1">${pinyinCols}</div>
                </div>
                <div class="flex justify-between items-center pt-1 border-t border-slate-500/10 shrink-0 text-xs">
                    <span class="opacity-60 text-[11px]">Bấm 1 chữ Hán và 1 Pinyin tương ứng</span>
                    <button onclick="CZCardEngine.initMatchingGameData(); CZCardEngine.renderSelectedCard()" class="text-rose-600 font-bold hover:underline cursor-pointer flex items-center space-x-1">
                        <i class="fa-solid fa-rotate-right mr-1"></i> <span>Chơi lại (Đổi vị trí)</span>
                    </button>
                </div>
            </div>
        `;
    },

    renderClozeLevelSelectView(stage) {
        stage.innerHTML = `
            <div class="theme-card rounded-2xl p-5 sm:p-6 text-center space-y-4 my-auto shadow-sm">
                <div class="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 mx-auto flex items-center justify-center text-2xl font-black shadow-xs">
                    <i class="fa-solid fa-layer-group"></i>
                </div>
                <div>
                    <h3 class="text-lg sm:text-xl font-black text-rose-600">Thử Thách Điền Từ Đa Cấp Độ</h3>
                    <p class="text-xs opacity-75 mt-1 font-semibold">Hoàn thành lần lượt từng cấp độ để mở khóa cấp tiếp theo</p>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-md mx-auto pt-1">
                    <div onclick="CZCardEngine.startClozeAtLevel(1)" class="p-3.5 rounded-2xl border-2 transition cursor-pointer text-left shadow-xs ${this.unlockedLevels[1] ? 'border-rose-500 bg-rose-500/5 hover:scale-102' : 'opacity-40 pointer-events-none border-slate-300'}">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-black text-rose-600">Cấp Độ 1</span>
                            <i class="fa-solid fa-unlock text-emerald-600 text-xs"></i>
                        </div>
                        <p class="text-[11px] font-semibold mt-1 opacity-80">Điền từ (chữ Hán + nút loa, bỏ Pinyin)</p>
                    </div>

                    <div onclick="${this.unlockedLevels[2] ? 'CZCardEngine.startClozeAtLevel(2)' : ''}" class="p-3.5 rounded-2xl border-2 transition text-left shadow-xs ${this.unlockedLevels[2] ? 'border-amber-500 bg-amber-500/5 hover:scale-102 cursor-pointer' : 'opacity-40 cursor-not-allowed border-slate-300 bg-slate-100 dark:bg-slate-800'}">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-black ${this.unlockedLevels[2] ? 'text-amber-600' : 'text-slate-500'}">Cấp Độ 2</span>
                            <i class="fa-solid ${this.unlockedLevels[2] ? 'fa-unlock text-emerald-600' : 'fa-lock text-slate-400'} text-xs"></i>
                        </div>
                        <p class="text-[11px] font-semibold mt-1 opacity-80">Thử thách (chữ Hán thuần, bỏ cả loa và Pinyin)</p>
                    </div>

                    <div onclick="${this.unlockedLevels[3] ? 'CZCardEngine.startClozeAtLevel(3)' : ''}" class="p-3.5 rounded-2xl border-2 transition text-left shadow-xs ${this.unlockedLevels[3] ? 'border-purple-500 bg-purple-500/5 hover:scale-102 cursor-pointer' : 'opacity-40 cursor-not-allowed border-slate-300 bg-slate-100 dark:bg-slate-800'}">
                        <div class="flex justify-between items-center">
                            <span class="text-xs font-black ${this.unlockedLevels[3] ? 'text-purple-600' : 'text-slate-500'}">Cấp Độ 3</span>
                            <i class="fa-solid ${this.unlockedLevels[3] ? 'fa-unlock text-emerald-600' : 'fa-lock text-slate-400'} text-xs"></i>
                        </div>
                        <p class="text-[11px] font-semibold mt-1 opacity-80">Luyện nghe (Nghe câu, chọn câu A/B/C/D đúng)</p>
                    </div>
                </div>

                <div class="pt-2">
                    <button onclick="CZCardEngine.startClozeAtLevel(1)" class="px-8 py-2.5 btn-3d font-bold text-xs rounded-xl shadow-md cursor-pointer">
                        <i class="fa-solid fa-play mr-1.5"></i> Bắt đầu thử thách
                    </button>
                </div>
            </div>
        `;
    },

    startClozeAtLevel(lvl) {
        if (!this.unlockedLevels[lvl]) {
            alert(`Vui lòng hoàn thành Cấp độ ${lvl - 1} trước nhé!`);
            return;
        }
        this.clozeLevel = lvl;
        this.clozeStarted = true;
        this.curClozeIdx = 0;
        this.selectedChoice = null;
        this.selectedChoiceIndex = -1;
        this.isAnswerChecked = false;

        let baseList = this.activeLesson.cloze || [];
        if (baseList.length < 4) {
            baseList = [...baseList, ...CZAppCore.initialLessonsData[0].cloze];
        }

        this.levelQuestions = [...baseList].sort(() => Math.random() - 0.5).slice(0, 10).map((q, qIdx) => {
            const correctW = q.correctAnswer;
            let choices = (q.choices || []).map(c => typeof c === 'string' ? c : (c.word || c.hanzi || ""));
            if (!choices.includes(correctW)) choices.unshift(correctW);
            choices = choices.sort(() => Math.random() - 0.5);
            return {
                ...q,
                questionNumber: qIdx + 1,
                randomizedChoices: choices
            };
        });

        this.renderSelectedCard();
    },

    renderClozeLevelActiveView(stage) {
        const totalQ = this.levelQuestions.length;
        if (this.curClozeIdx >= totalQ) {
            this.onLevelCompleted(stage);
            return;
        }

        const item = this.levelQuestions[this.curClozeIdx];
        const lvl = this.clozeLevel;

        let contentHtml = '';
        if (lvl === 1 || lvl === 2) {
            let choicesHtml = item.randomizedChoices.map((w, idx) => {
                if (idx === this.selectedChoiceIndex) {
                    return `<div class="p-2 sm:p-2.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 opacity-40 flex items-center justify-center min-w-[110px] flex-1 max-w-[180px]"><span class="text-xs font-bold">Đã chọn</span></div>`;
                }
                return `
                    <div class="p-2 sm:p-2.5 theme-card border hover:border-rose-500 rounded-2xl shadow-xs transition flex items-center justify-between min-w-[110px] flex-1 max-w-[180px] cursor-pointer bg-white/80 dark:bg-slate-800/80" onclick="CZCardEngine.pickClozeWord('${w}', ${idx})">
                        <span class="font-black text-lg sm:text-xl font-chinese text-rose-600 leading-tight">${w}</span>
                        ${lvl === 1 ? `
                            <button type="button" onclick="event.stopPropagation(); CZCardEngine.speakZh('${w}')" class="w-7 h-7 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center hover:scale-110 cursor-pointer shrink-0" title="Nghe từ này">
                                <i class="fa-solid fa-volume-high text-xs"></i>
                            </button>
                        ` : ''}
                    </div>
                `;
            }).join('');

            let slot = this.selectedChoice 
                ? `<span onclick="CZCardEngine.unpickClozeWord()" class="text-rose-600 font-black border-b-2 border-rose-500 px-3 cursor-pointer bg-rose-500/10 rounded-xl transition hover:scale-105 inline-block font-chinese">${this.selectedChoice}</span>` 
                : `<span class="inline-block w-20 border-b-2 border-dashed opacity-50 mx-1 text-center font-normal">( ? )</span>`;
            
            let fullSentence = `${item.sentenceBefore}${this.selectedChoice || item.correctAnswer}${item.sentenceAfter}`;

            contentHtml = `
                <div class="py-3 px-2 theme-card rounded-2xl text-center bg-white/70 dark:bg-slate-800/80 shadow-xs relative">
                    <div class="flex justify-between items-center">
                        <div class="flex-1 px-1">
                            <p class="text-xl sm:text-2xl font-black font-chinese leading-relaxed">${item.sentenceBefore} ${slot} ${item.sentenceAfter}</p>
                        </div>
                        <button onclick="CZCardEngine.speakZh('${fullSentence}')" class="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center hover:scale-110 cursor-pointer ml-1 shrink-0" title="Đọc câu đề bài">
                            <i class="fa-solid fa-volume-high text-sm"></i>
                        </button>
                    </div>
                </div>
                <div class="flex flex-wrap justify-center gap-2 pt-1">${choicesHtml}</div>
            `;
        } else if (lvl === 3) {
            const fullCorrectSentence = `${item.sentenceBefore}${item.correctAnswer}${item.sentenceAfter}`;
            const alphabet = ['A', 'B', 'C', 'D'];
            let sentenceOptions = item.randomizedChoices.slice(0, 4).map(w => `${item.sentenceBefore}${w}${item.sentenceAfter}`);
            if (!sentenceOptions.includes(fullCorrectSentence)) sentenceOptions[0] = fullCorrectSentence;
            
            let optsHtml = sentenceOptions.map((optSentence, idx) => {
                const letter = alphabet[idx];
                const isChosen = (this.selectedChoice === optSentence);
                return `
                    <div onclick="CZCardEngine.pickListeningSentence('${optSentence.replace(/'/g, "\\'")}', ${idx})" class="p-3 theme-card border rounded-2xl flex items-center space-x-2.5 cursor-pointer transition ${isChosen ? 'border-rose-500 bg-rose-500/10' : 'hover:border-rose-400 bg-white/80 dark:bg-slate-800/80'}">
                        <span class="w-6 h-6 rounded-full bg-rose-600 text-white font-bold text-xs flex items-center justify-center shrink-0">${letter}</span>
                        <span class="font-bold text-sm sm:text-base font-chinese leading-tight flex-1 text-left" style="color: var(--text-main);">${optSentence}</span>
                    </div>
                `;
            }).join('');

            contentHtml = `
                <div class="py-4 px-3 theme-card rounded-2xl text-center bg-white/70 dark:bg-slate-800/80 shadow-xs space-y-2">
                    <p class="text-xs font-bold text-rose-600 uppercase">🎧 Bấm loa để nghe và chọn câu đúng:</p>
                    <button onclick="CZCardEngine.speakZh('${fullCorrectSentence}')" class="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center hover:scale-105 cursor-pointer mx-auto shadow-md">
                        <i class="fa-solid fa-volume-high text-2xl"></i>
                    </button>
                </div>
                <div class="space-y-2 pt-1">${optsHtml}</div>
            `;
        }

        let feedbackHtml = '';
        if (this.isAnswerChecked) {
            const fullCorrectSentence = `${item.sentenceBefore}${item.correctAnswer}${item.sentenceAfter}`;
            const isRight = (lvl === 3 ? this.selectedChoice === fullCorrectSentence : this.selectedChoice === item.correctAnswer);
            
            if (isRight) {
                feedbackHtml = `
                    <div class="p-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 space-y-1 text-left text-xs shadow-xs animate-fade-in">
                        <div class="flex justify-between items-center">
                            <span class="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-600 text-white">✓ Chính xác!</span>
                            <button onclick="CZCardEngine.speakZh('${fullCorrectSentence}')" class="text-rose-600 hover:scale-110 cursor-pointer">
                                <i class="fa-solid fa-volume-high text-sm"></i>
                            </button>
                        </div>
                        <p class="font-black text-sm pt-0.5 font-chinese">🇨🇳 ${fullCorrectSentence}</p>
                        <p class="text-xs text-rose-600 font-bold">🔊 ${item.pinyin || ''}</p>
                        <p class="text-xs font-semibold opacity-90" style="color: var(--text-main);">🇻🇳 ${item.meaning || ''}</p>
                    </div>
                `;
            } else {
                feedbackHtml = `
                    <div class="p-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 text-left text-xs space-y-1">
                        <span class="text-[10px] font-black px-2 py-0.5 rounded-md bg-rose-600 text-white">✗ Chưa chính xác</span>
                        <p class="text-xs opacity-80 font-medium">Bạn hãy nghe lại hoặc thử chọn đáp án khác nhé!</p>
                    </div>
                `;
            }
        }

        stage.innerHTML = `
            <div class="theme-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between h-full space-y-2">
                <div class="flex justify-between items-center shrink-0 border-b pb-1.5 border-slate-500/10">
                    <div class="flex items-center space-x-1.5">
                        <span class="text-xs font-black px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600">Cấp ${lvl}</span>
                        <span class="text-xs font-bold">Câu ${item.questionNumber} / ${totalQ}</span>
                    </div>
                    <button onclick="CZCardEngine.clozeStarted = false; CZCardEngine.renderSelectedCard()" class="text-[11px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer">
                        <i class="fa-solid fa-arrow-left mr-1"></i> Đổi cấp độ
                    </button>
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">${contentHtml}${feedbackHtml}</div>

                <div class="flex justify-between items-center pt-2 border-t border-slate-500/20 shrink-0 text-xs">
                    <button onclick="CZCardEngine.prevClozeQuestion()" class="px-3.5 py-1.5 theme-card border hover:border-rose-500 rounded-xl font-bold cursor-pointer transition">
                        <i class="fa-solid fa-chevron-left mr-1"></i> Trước
                    </button>
                    <button onclick="CZCardEngine.checkClozeAnswerNow()" class="px-6 py-2 btn-3d text-xs font-bold rounded-xl cursor-pointer shadow">
                        Kiểm tra đáp án
                    </button>
                    <button onclick="CZCardEngine.nextClozeQuestion()" class="px-3.5 py-1.5 theme-card border hover:border-rose-500 rounded-xl font-bold cursor-pointer transition">
                        Tiếp <i class="fa-solid fa-chevron-right ml-1"></i>
                    </button>
                </div>
            </div>
        `;
    },

    pickListeningSentence(sentence, idx) {
        this.selectedChoice = sentence;
        this.selectedChoiceIndex = idx;
        this.isAnswerChecked = false;
        this.renderSelectedCard();
    },

    onLevelCompleted(stage) {
        const nextLvl = this.clozeLevel + 1;
        if (nextLvl <= 3) {
            this.unlockedLevels[nextLvl] = true;
        }
        stage.innerHTML = `
            <div class="theme-card rounded-2xl p-6 text-center space-y-3.5 my-auto shadow-sm">
                <div class="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
                    🎉
                </div>
                <h3 class="text-xl font-black text-emerald-600">CHÚC MỪNG BẠN!</h3>
                <p class="text-xs font-semibold opacity-80">Bạn đã hoàn thành xuất sắc <b>Cấp độ ${this.clozeLevel}</b>!</p>
                ${nextLvl <= 3 ? `<p class="text-xs font-bold text-rose-600">🔓 Đã mở khóa Cấp độ ${nextLvl}!</p>` : `<p class="text-xs font-bold text-purple-600">🏆 Bạn đã chinh phục toàn bộ 3 cấp độ!</p>`}
                <div class="pt-2 flex justify-center space-x-2">
                    <button onclick="CZCardEngine.clozeStarted = false; CZCardEngine.renderSelectedCard()" class="px-5 py-2 theme-card border font-bold text-xs rounded-xl cursor-pointer">
                        Về bảng cấp độ
                    </button>
                    ${nextLvl <= 3 ? `
                        <button onclick="CZCardEngine.startClozeAtLevel(${nextLvl})" class="px-5 py-2 btn-3d font-bold text-xs rounded-xl cursor-pointer">
                            Vào Cấp độ ${nextLvl} ngay
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    renderGrammarNormalView(stage) {
        const item = (this.activeLesson.grammar && this.activeLesson.grammar[0]) || { 
            pattern: "Mẫu câu chữ 是", 
            challenge: "Sắp xếp: 我 / 越南人 / 是", 
            zh: "我是越南人。",
            pinyin: "Wǒ shì Yuènán rén.", 
            meaning: "Tôi là người Việt Nam.", 
            formula: "[Chủ ngữ] + 是 + [Tân ngữ]" 
        };

        let redZhSentence = item.zh;
        if (!redZhSentence && item.challenge) {
            redZhSentence = item.challenge.replace(/^Sắp xếp:\s*/i, '').replace(/[\/\+_\-]/g, '').replace(/\s+/g, '');
        }

        stage.innerHTML = `
            <div class="theme-card rounded-2xl p-3 sm:p-4 flex flex-col justify-between h-full text-center shadow-xs">
                <div class="space-y-2 text-left w-full">
                    <div class="flex justify-between items-center pb-1 border-b border-slate-500/10">
                        <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600">Mẫu câu & Ngữ pháp</span>
                        <button onclick="CZCardEngine.openGrammarPractice()" class="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 font-bold text-xs rounded-xl border border-purple-200 transition cursor-pointer shadow-sm flex items-center space-x-1">
                            <i class="fa-solid fa-list-check text-xs"></i> <span>Làm bài tập ngữ pháp</span>
                        </button>
                    </div>
                    
                    <div class="text-center py-1">
                        <h3 class="text-xl sm:text-2xl font-black text-rose-600 font-chinese leading-tight">${item.pattern}</h3>
                        <div class="flex items-center justify-center space-x-1.5 mt-1">
                            <span class="text-xs sm:text-sm font-semibold opacity-85">${item.formula}</span>
                            <button onclick="CZCardEngine.speakZh('${item.formula}')" class="w-6 h-6 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center hover:scale-110 cursor-pointer shrink-0" title="Đọc chữ tiếng Trung trong cấu trúc">
                                <i class="fa-solid fa-volume-high text-xs"></i>
                            </button>
                        </div>
                    </div>

                    <div class="p-3.5 rounded-2xl theme-card border text-left space-y-2.5 bg-white/70 dark:bg-slate-800/80 shadow-xs">
                        ${item.challenge ? `
                            <div class="flex justify-between items-center border-b pb-1.5 border-slate-500/10">
                                <p class="text-xs font-bold text-amber-600 dark:text-amber-400">📝 Đề: ${item.challenge}</p>
                                <button onclick="CZCardEngine.speakZh('${item.challenge}')" class="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center hover:scale-110 cursor-pointer shrink-0" title="Nghe chữ tiếng Trung ở đề bài">
                                    <i class="fa-solid fa-volume-high text-xs"></i>
                                </button>
                            </div>
                        ` : ''}
                        
                        <div class="flex justify-between items-center pt-0.5">
                            <span class="text-xl sm:text-2xl font-black text-rose-600 font-chinese leading-snug">${redZhSentence}</span>
                            <button onclick="CZCardEngine.speakZh('${redZhSentence}')" class="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center hover:scale-110 cursor-pointer ml-2 shrink-0" title="Đọc câu tiếng Trung này">
                                <i class="fa-solid fa-volume-high text-sm"></i>
                            </button>
                        </div>
                        
                        <p class="text-xs sm:text-sm text-rose-500 font-bold">🔊 ${item.pinyin || ''}</p>
                        <p class="text-xs sm:text-sm font-semibold opacity-90" style="color: var(--text-main);">🇻🇳 ${item.meaning || ''}</p>
                    </div>
                </div>
            </div>
        `;
    },

    openGrammarPractice() {
        this.isGrammarPracticeMode = true;
        this.grammarUserChoices = {};
        this.isGrammarChecked = false;
        this.grammarShowPinyin = false;
        this.grammarShowVi = false;
        this.renderSelectedCard();
    },
    closeGrammarPractice() {
        this.isGrammarPracticeMode = false;
        this.renderSelectedCard();
    },
    toggleGrammarPinyin() { this.grammarShowPinyin = !this.grammarShowPinyin; this.renderSelectedCard(); },
    toggleGrammarVi() { this.grammarShowVi = !this.grammarShowVi; this.renderSelectedCard(); },
    setGrammarUserChoice(idx, choiceBool) {
        this.grammarUserChoices[idx] = choiceBool;
        this.renderSelectedCard();
    },
    checkGrammarPracticeAnswers() {
        this.isGrammarChecked = true;
        this.renderSelectedCard();
    },

    renderGrammarPracticeView(stage) {
        const item = (this.activeLesson.grammar && this.activeLesson.grammar[0]) || {};
        const exercises = item.exercises || [
            { zh: "我是学生。", pinyin: "Wǒ shì xuésheng.", vi: "Tôi là học sinh.", isCorrect: true, correction: "" },
            { zh: "他是不老师。", pinyin: "Tā shì bù lǎoshī.", vi: "Anh ấy không phải là thầy giáo.", isCorrect: false, correction: "他不是老师。 (Phủ định dùng 不是)" },
            { zh: "他们是朋友。", pinyin: "Tāmen shì péngyou.", vi: "Họ là bạn bè.", isCorrect: true, correction: "" }
        ];

        let listHtml = exercises.map((ex, idx) => {
            const userChoice = this.grammarUserChoices[idx];
            let feedbackHtml = '';

            if (this.isGrammarChecked) {
                const isRight = (userChoice === ex.isCorrect);
                feedbackHtml = `
                    <div class="mt-1.5 p-2 rounded-xl text-xs ${isRight ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}">
                        <div class="font-bold flex items-center space-x-1">
                            <span>${isRight ? '✓ Bạn đã chọn đúng!' : '✗ Bạn chọn chưa đúng!'}</span>
                        </div>
                        ${(!ex.isCorrect || !isRight) && ex.correction ? `
                            <div class="mt-1 text-[11px] font-bold text-amber-700 bg-amber-100/70 p-1.5 rounded-lg border border-amber-300">
                                💡 Câu viết đúng ngữ pháp: <span class="font-chinese text-sm">${ex.correction}</span>
                            </div>
                        ` : ''}
                    </div>
                `;
            }

            return `
                <div class="p-3 rounded-2xl theme-card border flex flex-col space-y-1.5 text-left bg-white/70 dark:bg-slate-800/80 shadow-xs">
                    <div class="flex justify-between items-start">
                        <div class="space-y-0.5 flex-1 pr-2">
                            <div class="flex items-center space-x-1.5">
                                <span class="w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">${idx + 1}</span>
                                <p class="text-base font-bold font-chinese leading-snug" style="color: var(--text-main);">${ex.zh}</p>
                            </div>
                            ${this.grammarShowPinyin ? `<p class="text-xs text-rose-600 font-bold pl-5">🔊 ${ex.pinyin}</p>` : ''}
                            ${this.grammarShowVi ? `<p class="text-xs font-semibold opacity-85 pl-5" style="color: var(--text-main);">🇻🇳 ${ex.vi}</p>` : ''}
                        </div>
                        <button onclick="CZCardEngine.speakZh('${ex.zh}')" class="text-rose-500 hover:scale-110 cursor-pointer pt-0.5 shrink-0" title="Nghe câu này">
                            <i class="fa-solid fa-volume-high text-sm"></i>
                        </button>
                    </div>
                    
                    <div class="flex items-center space-x-2 pt-1 border-t border-slate-500/10 text-xs font-bold">
                        <span class="opacity-70 text-[11px]">Đánh giá câu:</span>
                        <button onclick="CZCardEngine.setGrammarUserChoice(${idx}, true)" class="px-3 py-1 rounded-xl transition cursor-pointer flex items-center space-x-1 ${userChoice === true ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300'}">
                            <i class="fa-solid fa-check text-[10px]"></i> <span>Đúng</span>
                        </button>
                        <button onclick="CZCardEngine.setGrammarUserChoice(${idx}, false)" class="px-3 py-1 rounded-xl transition cursor-pointer flex items-center space-x-1 ${userChoice === false ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-300'}">
                            <i class="fa-solid fa-xmark text-[10px]"></i> <span>Sai</span>
                        </button>
                    </div>
                    ${feedbackHtml}
                </div>
            `;
        }).join('');

        stage.innerHTML = `
            <div class="theme-card rounded-2xl p-3 flex flex-col justify-between h-full space-y-2">
                <div class="flex justify-between items-center shrink-0 border-b pb-1.5 border-slate-500/10">
                    <div>
                        <span class="text-xs font-black text-rose-600 uppercase">Nhận biết đúng / sai cho các câu sau:</span>
                    </div>
                    <div class="flex space-x-1">
                        <button onclick="CZCardEngine.toggleGrammarPinyin()" class="px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer ${this.grammarShowPinyin ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : 'opacity-60'}">${this.grammarShowPinyin ? 'Ẩn Pinyin' : 'Hiện Pinyin'}</button>
                        <button onclick="CZCardEngine.toggleGrammarVi()" class="px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer ${this.grammarShowVi ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : 'opacity-60'}">${this.grammarShowVi ? 'Ẩn Nghĩa' : 'Hiện Nghĩa'}</button>
                    </div>
                </div>

                <div class="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">${listHtml}</div>

                <div class="flex justify-between items-center pt-2 border-t border-slate-500/10 shrink-0">
                    <button onclick="CZCardEngine.closeGrammarPractice()" class="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition">
                        <i class="fa-solid fa-arrow-left mr-1"></i> Đóng
                    </button>
                    <button onclick="CZCardEngine.checkGrammarPracticeAnswers()" class="px-5 py-1.5 btn-3d font-bold text-xs rounded-xl cursor-pointer shadow">
                        <i class="fa-solid fa-circle-check mr-1"></i> Kiểm tra đáp án
                    </button>
                </div>
            </div>
        `;
    },

    togglePinyin() { this.showPinyinDialogue = !this.showPinyinDialogue; this.renderSelectedCard(); },
    toggleVi() { this.showViDialogue = !this.showViDialogue; this.renderSelectedCard(); },

    async refreshDialogueWithAI() {
        const userKey = (localStorage.getItem('user_gemini_api_key') || "").trim();
        if (!userKey) {
            alert("Vui lòng nhập Gemini API Key để dùng tính năng tạo hội thoại mới với AI!");
            CZAppCore.openApiSetupModal(false);
            return;
        }
        const btn = document.getElementById('btn-refresh-dialogue');
        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> AI đang tạo...`;
            btn.classList.add('pointer-events-none', 'opacity-60');
        }
        try {
            const vocabList = (this.activeLesson.vocabs || []).map(v => `${v.hanzi} (${v.meaning})`).join(', ');
            const prompt = `Dựa vào chủ đề bài học "${this.activeLesson.title}" và các từ vựng sau: [${vocabList}], hãy tạo một đoạn hội thoại giao tiếp A-B gồm từ 4 đến 12 câu hội thoại sinh động, chuẩn tự nhiên. Trả về đúng định dạng JSON: [{"speaker":"A","zh":"...","pinyin":"...","vi":"..."},{"speaker":"B","zh":"...","pinyin":"...","vi":"..."}]. Không giải thích thêm.`;
            
            const raw = await CZAppCore.callGeminiAPI([{ text: prompt }]);
            const clean = CZAppCore.extractJSON(raw);
            if (Array.isArray(clean) && clean.length) {
                this.activeLesson.dialogues = clean;
                const idx = CZAppCore.lessonsDB.findIndex(x => x.id == this.activeLesson.id);
                if (idx >= 0) CZAppCore.lessonsDB[idx].dialogues = clean;
                localStorage.setItem('chinesez_lessons', JSON.stringify(CZAppCore.lessonsDB));
                CZAppCore.playSfx(true);
            }
        } catch(e) {
            console.error("Lỗi AI tạo hội thoại:", e);
            alert("Không thể tạo hội thoại mới: " + (e.message || "Vui lòng kiểm tra lại API Key!"));
        } finally {
            this.renderDialogueView(document.getElementById('study-stage-box'));
        }
    },

    renderDialogueView(stage) {
        const lines = this.activeLesson.dialogues || CZAppCore.initialLessonsData[0].dialogues;
        let dialogueListHtml = lines.map(line => `
            <div class="p-2.5 rounded-2xl theme-card border flex justify-between items-start space-x-2 bg-white/70 dark:bg-slate-800/80">
                <div class="space-y-0.5 text-left">
                    <div class="flex items-center space-x-2">
                        <span class="w-5 h-5 rounded-full ${line.speaker === 'A' ? 'bg-rose-500' : 'bg-blue-600'} text-white text-[10px] font-bold flex items-center justify-center shrink-0">${line.speaker}</span>
                        <span class="text-sm sm:text-base font-bold font-chinese" style="color: var(--text-main);">${line.zh}</span>
                    </div>
                    ${this.showPinyinDialogue ? `<p class="text-xs text-rose-600 font-semibold pl-7">🔊 ${line.pinyin}</p>` : ''}
                    ${this.showViDialogue ? `<p class="text-xs font-medium opacity-85 pl-7" style="color: var(--text-main);">🇻🇳 ${line.vi}</p>` : ''}
                </div>
                <button onclick="CZCardEngine.speakZh('${line.zh}')" class="text-rose-500 hover:scale-110 cursor-pointer pt-0.5 shrink-0" title="Nghe câu này"><i class="fa-solid fa-volume-high text-xs"></i></button>
            </div>
        `).join('');

        stage.innerHTML = `
            <div class="theme-card rounded-2xl p-3 flex flex-col justify-between h-full space-y-2">
                <div class="flex justify-between items-center shrink-0">
                    <div class="flex items-center space-x-2">
                        <span class="text-xs font-bold text-rose-500 uppercase">Hội thoại (${lines.length} câu)</span>
                        <button id="btn-refresh-dialogue" onclick="CZCardEngine.refreshDialogueWithAI()" class="px-2 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[10px] font-bold cursor-pointer transition flex items-center shadow-xs" title="Tạo đoạn hội thoại mới dựa vào từ vựng">
                            <i class="fa-solid fa-arrows-rotate mr-1"></i> Tạo hội thoại mới
                        </button>
                    </div>
                    <div class="flex space-x-1.5">
                        <button onclick="CZCardEngine.togglePinyin()" class="px-2.5 py-1 rounded-xl border text-[10px] font-bold cursor-pointer ${this.showPinyinDialogue ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : 'opacity-60'}">${this.showPinyinDialogue ? 'Ẩn Pinyin' : 'Hiện Pinyin'}</button>
                        <button onclick="CZCardEngine.toggleVi()" class="px-2.5 py-1 rounded-xl border text-[10px] font-bold cursor-pointer ${this.showViDialogue ? 'bg-rose-500/10 text-rose-600 border-rose-500/30' : 'opacity-60'}">${this.showViDialogue ? 'Ẩn Nghĩa' : 'Hiện Nghĩa'}</button>
                    </div>
                </div>
                <div class="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">${dialogueListHtml}</div>
            </div>
        `;
    },

    initMemoryStore() {
        this.memoryQuizData = [...(this.activeLesson.vocabs || [])];
        this.memoryQuizScore = 0;
        this.qHanzi = ""; this.qPinyin = ""; this.qMeaning = "";
    },

    checkMemoryAnswerNow() {
        const h = document.getElementById('sel-q-hanzi').value, p = document.getElementById('sel-q-pinyin').value, m = document.getElementById('sel-q-meaning').value;
        const box = document.getElementById('memory-msg-box');
        if (!h || !p || !m) { alert("Vui lòng chọn đủ cả 3 ô!"); return; }
        const match = this.memoryQuizData.find(it => it.hanzi === h && it.pinyin === p && it.meaning === m);
        if (match) {
            CZAppCore.playSfx(true); this.speakZh(h); this.memoryQuizScore++; this.memoryQuizData = this.memoryQuizData.filter(it => it.hanzi !== h); this.qHanzi = ""; this.qPinyin = ""; this.qMeaning = "";
            box.innerHTML = `<span class="text-emerald-600 text-sm animate-pulse font-bold">🎉 Chính xác! Bạn chọn từ tiếp theo nhé!</span>`;
            setTimeout(() => this.renderSelectedCard(), 1100);
        } else {
            CZAppCore.playSfx(false); const actual = (this.activeLesson.vocabs || []).find(it => it.hanzi === h);
            let hint = actual ? `Chữ <b>${h}</b> đi với Pinyin: <b class="text-rose-600">${actual.pinyin}</b> và Nghĩa: <b class="text-rose-600">${actual.meaning}</b>` : "Bộ ba chưa khớp nhau, bạn hãy thử lại!";
            box.innerHTML = `<div class="p-2 rounded-xl bg-rose-500/10 text-rose-600 text-xs text-left"><b>❌ Chưa đúng:</b> ${hint}</div>`;
        }
    },

    initMatchingGameData() {
        this.gameSelectedHanzi = null; this.gameSelectedPinyin = null; this.gameMatchedCount = 0;
        const vocabs = this.activeLesson.vocabs || [];
        this.randomizedGameHanzi = [...vocabs].map(v => ({ val: v.hanzi, id: v.hanzi })).sort(() => Math.random() - 0.5);
        this.randomizedGamePinyin = [...vocabs].map(v => ({ val: v.pinyin, targetHanzi: v.hanzi, id: v.pinyin })).sort(() => Math.random() - 0.5);
    },

    onGameSelectHanzi(hz) {
        const el = document.getElementById(`game-hz-${hz}`); if (el.classList.contains('is-matched')) return;
        if (this.gameSelectedHanzi) { const prev = document.getElementById(`game-hz-${this.gameSelectedHanzi}`); if (prev) prev.className = "game-cell min-h-[48px] h-[48px] rounded-2xl border-2 border-slate-300/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 flex items-center justify-center font-black text-2xl font-chinese text-slate-800 dark:text-slate-100 cursor-pointer shadow-xs transition select-none hover:scale-102 shrink-0"; }
        this.gameSelectedHanzi = hz;
        el.className = "game-cell min-h-[48px] h-[48px] rounded-2xl border-2 border-amber-500 bg-amber-500/20 ring-4 ring-amber-400/40 flex items-center justify-center font-black text-2xl font-chinese text-amber-700 dark:text-amber-300 cursor-pointer shadow-md scale-102 transition shrink-0";
        this.checkGameMatchingPair();
    },

    onGameSelectPinyin(py, targetHz) {
        const el = document.getElementById(`game-py-${py}`); if (el.classList.contains('is-matched')) return;
        if (this.gameSelectedPinyin) { const prev = document.getElementById(`game-py-${this.gameSelectedPinyin.py}`); if (prev) prev.className = "game-cell min-h-[48px] h-[48px] rounded-2xl border-2 border-slate-300/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 flex items-center justify-center font-bold text-base text-rose-600 cursor-pointer shadow-xs transition select-none hover:scale-102 shrink-0"; }
        this.gameSelectedPinyin = { py, targetHz };
        el.className = "game-cell min-h-[48px] h-[48px] rounded-2xl border-2 border-amber-500 bg-amber-500/20 ring-4 ring-amber-400/40 flex items-center justify-center font-bold text-base text-amber-700 dark:text-amber-300 cursor-pointer shadow-md scale-102 transition shrink-0";
        this.checkGameMatchingPair();
    },

    checkGameMatchingPair() {
        if (!this.gameSelectedHanzi || !this.gameSelectedPinyin) return;
        const hzEl = document.getElementById(`game-hz-${this.gameSelectedHanzi}`), pyEl = document.getElementById(`game-py-${this.gameSelectedPinyin.py}`);
        if (this.gameSelectedHanzi === this.gameSelectedPinyin.targetHz) {
            CZAppCore.playSfx(true); this.speakZh(this.gameSelectedHanzi); this.gameMatchedCount++;
            hzEl.className = "is-matched min-h-[48px] h-[48px] rounded-2xl border-2 border-emerald-500 bg-emerald-500/20 text-emerald-600 font-black text-2xl font-chinese flex items-center justify-center pointer-events-none shadow-xs shrink-0";
            pyEl.className = "is-matched min-h-[48px] h-[48px] rounded-2xl border-2 border-emerald-500 bg-emerald-500/20 text-emerald-600 font-bold text-base flex items-center justify-center pointer-events-none shadow-xs shrink-0";
            document.getElementById('game-progress-lbl').innerText = `${this.gameMatchedCount} / ${this.activeLesson.vocabs.length} cặp`;
            this.gameSelectedHanzi = null; this.gameSelectedPinyin = null;
            if (this.gameMatchedCount === this.activeLesson.vocabs.length) { setTimeout(() => alert("🎉 CHÚC MỪNG BẠN! Bạn đã ghép chính xác tất cả các cặp từ vựng!"), 300); }
        } else {
            CZAppCore.playSfx(false); hzEl.classList.add('animate-shake', 'border-rose-600', 'bg-rose-500/20'); pyEl.classList.add('animate-shake', 'border-rose-600', 'bg-rose-500/20');
            setTimeout(() => {
                hzEl.className = "game-cell min-h-[48px] h-[48px] rounded-2xl border-2 border-slate-300/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 flex items-center justify-center font-black text-2xl font-chinese text-slate-800 dark:text-slate-100 cursor-pointer shadow-xs transition select-none hover:scale-102 shrink-0";
                pyEl.className = "game-cell min-h-[48px] h-[48px] rounded-2xl border-2 border-slate-300/80 dark:border-slate-700 bg-white/80 dark:bg-slate-800 flex items-center justify-center font-bold text-base text-rose-600 cursor-pointer shadow-xs transition select-none hover:scale-102 shrink-0";
                this.gameSelectedHanzi = null; this.gameSelectedPinyin = null;
            }, 500);
        }
    },

    flipCardBox(el) { el.querySelector('.flip-card-inner').classList.toggle('flipped'); },
    nextVocab() { this.curIdx = (this.curIdx + 1) % this.activeLesson.vocabs.length; this.renderSelectedCard(); },
    prevVocab() { this.curIdx = (this.curIdx - 1 + this.activeLesson.vocabs.length) % this.activeLesson.vocabs.length; this.renderSelectedCard(); },

    pickClozeWord(w, idx) { this.selectedChoice = w; this.selectedChoiceIndex = idx; this.isAnswerChecked = false; this.renderSelectedCard(); },
    unpickClozeWord() { this.selectedChoice = null; this.selectedChoiceIndex = -1; this.isAnswerChecked = false; this.renderSelectedCard(); },
    checkClozeAnswerNow() {
        const item = this.levelQuestions[this.curClozeIdx];
        if (!this.selectedChoice) { alert("Vui lòng chọn 1 đáp án!"); return; }
        this.isAnswerChecked = true;
        const fullCorrectSentence = `${item.sentenceBefore}${item.correctAnswer}${item.sentenceAfter}`;
        const isRight = (this.clozeLevel === 3 ? this.selectedChoice === fullCorrectSentence : this.selectedChoice === item.correctAnswer);
        if (isRight) CZAppCore.playSfx(true); else CZAppCore.playSfx(false);
        this.renderSelectedCard();
    },
    prevClozeQuestion() {
        if (this.curClozeIdx <= 0) return;
        this.curClozeIdx--;
        this.selectedChoice = null; this.selectedChoiceIndex = -1; this.isAnswerChecked = false;
        this.renderSelectedCard();
    },
    nextClozeQuestion() {
        if (this.curClozeIdx < this.levelQuestions.length - 1) {
            this.curClozeIdx++;
            this.selectedChoice = null; this.selectedChoiceIndex = -1; this.isAnswerChecked = false;
            this.renderSelectedCard();
        } else {
            this.onLevelCompleted(document.getElementById('study-stage-box'));
        }
    }
};
