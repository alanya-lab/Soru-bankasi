import React, { useState, useEffect } from 'react';
import { 
  getQuestions, 
  saveQuestions, 
  clearQuestions, 
  getRandomQuestions, 
  getSolvedQuestions, 
  markQuestionsAsSolved,
  getCategoryAndTopicStats,
  resetSolvedQuestions,
  deleteQuestionByIndex
} from './services/db';
import { getSheetConfig, fetchSheetContent, singleQuestionToTSVLine } from './services/sheetsService';
import { Question, SheetSyncConfig } from './types';
import { TOPICS } from './constants';
import QuestionManagementModal from './components/QuestionManagementModal';
import { 
  BookOpen, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  RefreshCw, 
  ArrowRight, 
  ArrowLeft, 
  Play, 
  Trophy, 
  Home, 
  Database, 
  Check, 
  ChevronDown, 
  ChevronUp,
  FileSpreadsheet,
  PlusCircle,
  Copy,
  Search,
  Trash2,
  ExternalLink,
  Sparkles,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ViewState = 'dashboard' | 'exam' | 'result' | 'database';

export default function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  
  // DB & Questions State
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [solvedQuestions, setSolvedQuestions] = useState<string[]>([]);
  const [sheetConfig, setSheetConfig] = useState<SheetSyncConfig>(getSheetConfig());
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  // Question Management Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Setup / Exam Config state
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['Rinoloji']);
  const [questionCount, setQuestionCount] = useState<number>(20);
  const [includeSolved, setIncludeSolved] = useState<boolean>(false);
  
  // Exam Execution state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [forceShowExplanation, setForceShowExplanation] = useState(false);
  const [copiedQuestionId, setCopiedQuestionId] = useState<number | null>(null);

  // Database Search state
  const [dbSearch, setDbSearch] = useState('');
  const [dbCategoryFilter, setDbCategoryFilter] = useState('all');

  const refreshAppData = () => {
    const qList = getQuestions();
    setAllQuestions(qList);
    setSolvedQuestions(getSolvedQuestions());
    setSheetConfig(getSheetConfig());
  };

  useEffect(() => {
    refreshAppData();
  }, [view]);

  // Auto-sync from Google Sheets on initial startup if configured
  useEffect(() => {
    const config = getSheetConfig();
    if (config.sheetUrl && config.autoSync) {
      setIsSyncingSheet(true);
      fetchSheetContent(config.sheetUrl)
        .then(({ questions, count }) => {
          saveQuestions(questions);
          refreshAppData();
          setSyncToast(`E-Tablodan ${count} soru senkronize edildi.`);
          setTimeout(() => setSyncToast(null), 3500);
        })
        .catch(err => {
          console.warn('Initial auto-sync error:', err);
        })
        .finally(() => {
          setIsSyncingSheet(false);
        });
    }
  }, []);

  // Timer interval during exam
  useEffect(() => {
    let interval: any;
    if (isTimerActive) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isTimerActive]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v < 10 ? "0" + v : v).join(":");
  };

  const startExam = (mode: 'quick' | 'full' | 'custom') => {
    setError(null);
    let requestedCount = 0;
    let topicNames: string[] | undefined;

    if (mode === 'quick') {
      requestedCount = Math.min(20, allQuestions.length);
    } else if (mode === 'full') {
      requestedCount = 100;
    } else if (mode === 'custom') {
      requestedCount = questionCount;
      if (selectedTopicIds.length > 0) {
        topicNames = TOPICS.filter(t => selectedTopicIds.includes(t.id)).map(t => t.name);
      }
    }

    const pool = getRandomQuestions(requestedCount, topicNames, includeSolved);
    
    if (pool.length === 0) {
      if (!includeSolved) {
        setError("Seçilen konularda ÇÖZÜLMEMİŞ soru kalmadı. 'Çözülmüş soruları tekrar sor' anahtarını açabilir veya yeni soru ekleyebilirsiniz.");
      } else {
        setError("Seçilen kriterlere uygun soru bulunamadı. Lütfen 'Soru Bankası & E-Tablo' üzerinden soru ekleyin.");
      }
      return;
    }

    setQuestions(pool);
    setAnswers({});
    setCurrentIndex(0);
    setTimer(0);
    setIsTimerActive(true);
    setForceShowExplanation(false);
    setView('exam');
  };

  const handleAnswer = (key: string) => {
    if (answers[currentIndex]) return;
    setAnswers(prev => ({ ...prev, [currentIndex]: key }));
  };

  const nextQuestion = () => {
    setForceShowExplanation(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsTimerActive(false);
      const answeredQuestions = questions
        .filter((_, i) => answers[i])
        .map(q => q.soru.trim());
      markQuestionsAsSolved(answeredQuestions);
      refreshAppData();
      setView('result');
    }
  };

  const prevQuestion = () => {
    setForceShowExplanation(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const toggleTopic = (id: number) => {
    setSelectedTopicIds(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleCategorySelect = (category: string) => {
    const categoryTopicIds = TOPICS.filter(t => t.category === category).map(t => t.id);
    const allSelected = categoryTopicIds.every(id => selectedTopicIds.includes(id));
    if (allSelected) {
      setSelectedTopicIds(prev => prev.filter(id => !categoryTopicIds.includes(id)));
    } else {
      setSelectedTopicIds(prev => Array.from(new Set([...prev, ...categoryTopicIds])));
    }
  };

  const toggleExpandedCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category]
    );
  };

  const handleCopySingleQuestion = (q: Question, idx: number) => {
    const line = singleQuestionToTSVLine(q);
    navigator.clipboard.writeText(line);
    setCopiedQuestionId(idx);
    setTimeout(() => setCopiedQuestionId(null), 2000);
  };

  // Live Category Summaries with question counts
  const categoryStats = getCategoryAndTopicStats(allQuestions, solvedQuestions);

  // Filtered Questions for Database View
  const filteredDbQuestions = allQuestions.filter(q => {
    const matchesSearch = !dbSearch.trim() || 
      q.soru.toLowerCase().includes(dbSearch.toLowerCase()) ||
      (q.topic && q.topic.toLowerCase().includes(dbSearch.toLowerCase())) ||
      (q.aciklama && q.aciklama.toLowerCase().includes(dbSearch.toLowerCase()));

    const matchesCategory = dbCategoryFilter === 'all' || q.category === dbCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  /* ------------------------------------------------------------- */
  /*                      RENDER: DASHBOARD                        */
  /* ------------------------------------------------------------- */
  const renderDashboard = () => {
    const totalQuestionsCount = allQuestions.length;
    const totalSolvedCount = solvedQuestions.length;
    const overallSuccessRate = totalQuestionsCount > 0 
      ? Math.min(100, Math.round((totalSolvedCount / totalQuestionsCount) * 100)) 
      : 0;

    return (
      <div className="max-w-5xl mx-auto h-[100dvh] flex flex-col p-3 sm:p-4 gap-3 overflow-hidden select-none">
        
        {/* Top Header Bar */}
        <header className="bg-white rounded-2xl shadow-sm border border-slate-200/80 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
              KBB
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight leading-tight flex items-center gap-2">
                Board Sınav Hazırlık
                <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                  KBB Yeterlilik
                </span>
              </h1>
              <p className="text-[11px] text-slate-400 font-medium">Google E-Tablo & Kategori Tabanlı Soru Bankası</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sheets Status Button / Badge */}
            <button
              onClick={() => setIsModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                sheetConfig.sheetUrl
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title="Google E-Tablo senkronizasyonunu yönetin"
            >
              <FileSpreadsheet className={`w-3.5 h-3.5 ${sheetConfig.sheetUrl ? 'text-emerald-600' : 'text-slate-500'}`} />
              <span className="hidden md:inline">
                {sheetConfig.sheetUrl ? 'E-Tablo Bağlı' : 'E-Tablo Bağla'}
              </span>
              {sheetConfig.sheetUrl && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              )}
            </button>

            {/* Quick Add Question Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-sm transition"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Soru Ekle</span>
            </button>

            {/* Database View Toggle */}
            <button
              onClick={() => setView('database')}
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/60 transition flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Havuz ({totalQuestionsCount})</span>
            </button>
          </div>
        </header>

        {/* Sync Toast Notification */}
        {syncToast && (
          <div className="bg-emerald-600 text-white text-xs font-medium px-4 py-2 rounded-xl flex items-center justify-between shadow-lg animate-fade-in shrink-0">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4" /> {syncToast}
            </span>
            <button onClick={() => setSyncToast(null)} className="opacity-80 hover:opacity-100">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-0">
          
          {/* Left Column: Hadi Çözelim (Main Topics & Selection) */}
          <section className="flex-1 md:flex-[7] bg-gradient-to-br from-[#1e88e5] to-[#1565c0] rounded-2xl p-3.5 sm:p-4 text-white flex flex-col shadow-md overflow-hidden relative min-h-0">
            <div className="flex items-center justify-between pb-2.5 border-b border-white/15 shrink-0">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2">
                  <span>Hadi Çözelim</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/20 text-white">
                    {selectedTopicIds.length > 0 ? `${selectedTopicIds.length} Konu Seçili` : 'Tüm Konular'}
                  </span>
                </h2>
                <p className="text-[11px] text-blue-100">Ana başlığa tıklayıp alt konuları açın ve soruları seçin.</p>
              </div>

              <button
                onClick={() => startExam('quick')}
                disabled={totalQuestionsCount === 0}
                className="bg-white hover:bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Hızlı 20 Soru</span>
              </button>
            </div>

            {/* Error banner if pool empty */}
            {error && (
              <div className="mt-2 p-2.5 rounded-xl bg-rose-500/90 text-white text-xs flex items-center gap-2 shrink-0 animate-shake">
                <XCircle className="w-4 h-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="opacity-80 hover:opacity-100">
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Topics Accordion List */}
            <div className="flex-1 overflow-y-auto pr-1 my-2.5 space-y-2 custom-scrollbar">
              {categoryStats.map(cat => {
                const isExpanded = expandedCategories.includes(cat.category);
                const categoryTopicIds = TOPICS.filter(t => t.category === cat.category).map(t => t.id);
                const allSelected = categoryTopicIds.length > 0 && categoryTopicIds.every(id => selectedTopicIds.includes(id));
                const someSelected = categoryTopicIds.some(id => selectedTopicIds.includes(id));

                return (
                  <div 
                    key={cat.category} 
                    className="bg-white/10 hover:bg-white/[0.14] border border-white/10 rounded-xl overflow-hidden transition-all"
                  >
                    {/* Category Header Row */}
                    <div className="flex items-center justify-between p-2.5 sm:px-3 sm:py-2">
                      <button
                        onClick={() => toggleExpandedCategory(cat.category)}
                        className="flex-1 text-left font-bold text-xs sm:text-sm text-white flex items-center gap-2"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-blue-200" /> : <ChevronDown className="w-4 h-4 text-blue-200" />}
                        <span className="truncate">{cat.category}</span>
                      </button>

                      {/* Stats & Select Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/20 text-blue-100">
                          {cat.solvedQuestions}/{cat.totalQuestions} Soru
                        </span>

                        <button
                          onClick={() => toggleCategorySelect(cat.category)}
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                            allSelected 
                              ? 'bg-white border-white text-[#1e88e5]' 
                              : someSelected 
                              ? 'bg-white/40 border-white text-white'
                              : 'border-white/40 hover:bg-white/20'
                          }`}
                          title="Tüm alt konuları seç/kaldır"
                        >
                          {(allSelected || someSelected) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      </div>
                    </div>

                    {/* Subtopics dropdown */}
                    {isExpanded && (
                      <div className="flex flex-col gap-1 px-2 pb-2.5 pt-0.5 border-t border-white/10 bg-black/10">
                        {cat.topics.map(topic => {
                          const topicDef = TOPICS.find(t => t.name === topic.name && t.category === cat.category);
                          const topicId = topicDef ? topicDef.id : -1;
                          const isSelected = topicId !== -1 && selectedTopicIds.includes(topicId);

                          return (
                            <button
                              key={topic.name}
                              onClick={() => {
                                if (topicId !== -1) toggleTopic(topicId);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                                isSelected 
                                  ? 'bg-white text-blue-900 shadow-sm font-semibold' 
                                  : 'bg-white/5 text-blue-100 hover:bg-white/15'
                              }`}
                            >
                              <span className="truncate pr-2">{topic.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                                isSelected ? 'bg-blue-100 text-blue-800' : 'bg-black/20 text-white'
                              }`}>
                                {topic.solved}/{topic.total}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom Controls Bar */}
            <div className="shrink-0 pt-2 border-t border-white/15 space-y-2">
              <div className="flex items-center justify-between bg-white/10 rounded-xl px-3 py-2 text-xs">
                <span className="text-white font-medium flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-200" />
                  Çözülmüş soruları tekrar sor
                </span>
                <button
                  onClick={() => setIncludeSolved(!includeSolved)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${includeSolved ? 'bg-emerald-400' : 'bg-white/20'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${includeSolved ? 'translate-x-5' : 'translate-x-0.5'}`}></div>
                </button>
              </div>

              {/* Question Count Select */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-blue-100 hidden sm:inline">Soru Sayısı:</span>
                <div className="flex-1 flex gap-1.5">
                  {[10, 20, 30, 50, 9999].map(num => (
                    <button
                      key={num}
                      onClick={() => setQuestionCount(num)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                        questionCount === num 
                          ? 'bg-white text-blue-900 shadow-sm' 
                          : 'bg-white/15 text-white hover:bg-white/25'
                      }`}
                    >
                      {num === 9999 ? 'Tümü' : num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Exam Button */}
              <button 
                onClick={() => startExam('custom')}
                disabled={totalQuestionsCount === 0}
                className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold text-xs sm:text-sm transition shadow-lg active:scale-98 flex items-center justify-center gap-2"
              >
                <span>Sınavı Başlat ({questionCount === 9999 ? 'Tüm Havuz' : `${questionCount} Soru`})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Right Column: Progress & Quick Actions */}
          <aside className="flex-1 md:flex-[3] flex flex-col gap-3 min-h-0 shrink-0">
            
            {/* Progress Card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">İlerleme Durumu</span>
                  <Trophy className="w-4 h-4 text-amber-500" />
                </div>

                <div className="grid grid-cols-2 gap-2 my-2">
                  <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-2.5 text-center">
                    <div className="text-xl font-black text-blue-700">{totalSolvedCount}</div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Çözülen</div>
                  </div>
                  <div className="bg-purple-50/70 border border-purple-100 rounded-xl p-2.5 text-center">
                    <div className="text-xl font-black text-purple-700">{totalQuestionsCount}</div>
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">Toplam Soru</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1 mt-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-600">
                    <span>Tamamlanma</span>
                    <span>%{overallSuccessRate}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-700"
                      style={{ width: `${overallSuccessRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {totalSolvedCount > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('Çözülmüş soru geçmişini sıfırlamak istiyor musunuz?')) {
                      resetSolvedQuestions();
                      refreshAppData();
                    }
                  }}
                  className="mt-3 text-[10px] text-slate-400 hover:text-rose-500 text-center transition"
                >
                  Çözülenleri Sıfırla
                </button>
              )}
            </div>

            {/* E-Tablo Hub Card */}
            <div className="bg-slate-900 rounded-2xl p-4 shadow-sm text-slate-100 flex-1 flex flex-col justify-between border border-slate-800">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <FileSpreadsheet className="w-4 h-4" />
                  E-Tablo Entegrasyonu
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Google Sheets linkinizi bağlayarak kaliteli board sorularınızı kolayca ekleyin ve yönetin.
                </p>

                <div className="pt-2 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Sütun: Kategori, Soru, Şıklar (A-E), Cevap</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    <span>Tek tıkla içeri çekme ve dışa aktarma</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-950/40 flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  E-Tablo Ayarları & Soru Ekle
                </button>
              </div>
            </div>

          </aside>
        </div>

        {/* Question Management Modal */}
        <QuestionManagementModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onQuestionsUpdated={refreshAppData}
          currentCount={allQuestions.length}
        />
      </div>
    );
  };

  /* ------------------------------------------------------------- */
  /*                        RENDER: EXAM                           */
  /* ------------------------------------------------------------- */
  const renderExam = () => {
    const question = questions[currentIndex];
    if (!question) return null;

    const selectedAnswer = answers[currentIndex];
    const showResult = !!selectedAnswer;
    const isCorrect = selectedAnswer === question.dogruCevap;

    return (
      <div className="max-w-3xl mx-auto flex flex-col h-[100dvh] justify-start p-3 sm:p-4 select-none">
        <div className="flex flex-col w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200/80 max-h-[92dvh]">
          
          {/* Exam Header */}
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200/80 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setView('dashboard')}
                className="p-1.5 rounded-xl bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 transition"
                title="Ana Sayfaya Dön"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <span className="text-xs font-bold text-blue-700">
                  {question.category || 'KBB Sınavı'}
                </span>
                <span className="text-slate-400 mx-1.5">•</span>
                <span className="text-[11px] text-slate-500 font-medium">{question.topic || 'Genel'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
                Soru {currentIndex + 1} / {questions.length}
              </span>
              <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                {formatTime(timer)}
              </span>
            </div>
          </div>

          {/* Exam Question Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
            {/* Question Text */}
            <div className="text-sm sm:text-base font-semibold text-slate-800 leading-relaxed bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
              {question.soru}
            </div>

            {/* Options List A - E */}
            <div className="space-y-2.5">
              {(['A', 'B', 'C', 'D', 'E'] as const).map((opt) => {
                const optText = question.secenekler[opt];
                if (!optText) return null;

                let optClass = 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700';

                if (showResult) {
                  if (opt === question.dogruCevap) {
                    optClass = 'bg-emerald-50 border-emerald-500 text-emerald-900 font-semibold ring-1 ring-emerald-500';
                  } else if (selectedAnswer === opt) {
                    optClass = 'bg-rose-50 border-rose-500 text-rose-900 font-semibold ring-1 ring-rose-500';
                  } else {
                    optClass = 'bg-slate-50/50 border-slate-200 text-slate-400 opacity-60';
                  }
                }

                return (
                  <button
                    key={opt}
                    onClick={() => handleAnswer(opt)}
                    disabled={showResult}
                    className={`w-full p-3 sm:p-3.5 rounded-xl border text-left text-xs sm:text-sm transition-all flex items-start gap-3 ${optClass}`}
                  >
                    <span className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                      showResult && opt === question.dogruCevap
                        ? 'bg-emerald-600 text-white'
                        : showResult && selectedAnswer === opt
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {opt}
                    </span>
                    <span className="flex-1 pt-0.5">{optText}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation Section */}
            {(showResult || forceShowExplanation) && (
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs sm:text-sm text-slate-800 space-y-2 animate-fade-in">
                <div className="font-bold text-amber-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Doğru Cevap: {question.dogruCevap}
                  </span>
                  
                  {/* Copy Question to Sheet Row */}
                  <button
                    onClick={() => handleCopySingleQuestion(question, currentIndex)}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-xs"
                    title="Bu soruyu E-Tablo satırı olarak panoya kopyala"
                  >
                    {copiedQuestionId === currentIndex ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-700">Satır Kopyalandı</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        E-Tablo Satırı Kopyala
                      </>
                    )}
                  </button>
                </div>
                <p className="text-slate-700 leading-relaxed text-xs">
                  {question.aciklama || 'Bu soru için henüz ek bir klinik açıklama girilmedi.'}
                </p>
              </div>
            )}
          </div>

          {/* Exam Footer Navigation */}
          <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              onClick={prevQuestion}
              disabled={currentIndex === 0}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Önceki</span>
            </button>

            <button
              onClick={() => setForceShowExplanation(!forceShowExplanation)}
              className="text-xs text-slate-500 hover:text-blue-700 font-medium transition"
            >
              {forceShowExplanation ? 'Açıklamayı Gizle' : 'Çözümü Gör'}
            </button>

            <button
              onClick={nextQuestion}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition flex items-center gap-1.5 active:scale-95"
            >
              <span>{currentIndex < questions.length - 1 ? 'Sonraki' : 'Sınavı Bitir'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    );
  };

  /* ------------------------------------------------------------- */
  /*                      RENDER: RESULT                           */
  /* ------------------------------------------------------------- */
  const renderResult = () => {
    let correct = 0;
    let incorrect = 0;
    let empty = 0;

    questions.forEach((q, i) => {
      const ans = answers[i];
      if (!ans) empty++;
      else if (ans === q.dogruCevap) correct++;
      else incorrect++;
    });

    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;

    return (
      <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-8 text-center relative overflow-hidden shadow-xl border border-slate-200">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
          <Trophy className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-800 mb-1">Sınav Tamamlandı</h2>
        <p className="text-slate-500 font-medium mb-6 text-xs sm:text-sm">Board çalışma oturumu performans özetiniz.</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">{correct}</div>
            <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Doğru</div>
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3">
            <div className="text-2xl sm:text-3xl font-black text-rose-600">{incorrect}</div>
            <div className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Yanlış</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-600">{empty}</div>
            <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Boş</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-slate-900 rounded-2xl p-4 text-white text-left">
            <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1">Başarı Oranı</div>
            <div className="text-3xl font-black text-emerald-400">%{score}</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-left">
            <div className="text-[10px] text-blue-700 uppercase tracking-widest font-bold mb-1">Toplam Süre</div>
            <div className="text-2xl font-black text-blue-900 font-mono">{formatTime(timer)}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              setCurrentIndex(0);
              setView('exam');
            }}
            className="px-6 py-2.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
          >
            Soruları ve Çözümleri İncele
          </button>
          <button
            onClick={() => setView('dashboard')}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition shadow-md"
          >
            <Home className="w-4 h-4" />
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  };

  /* ------------------------------------------------------------- */
  /*                     RENDER: DATABASE                          */
  /* ------------------------------------------------------------- */
  const renderDatabase = () => {
    const existingCats = Array.from(new Set(allQuestions.map(q => q.category || 'Genel KBB')));

    return (
      <div className="max-w-5xl mx-auto h-[100dvh] flex flex-col p-3 sm:p-4 gap-3 overflow-hidden select-none">
        {/* Database Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setView('dashboard')}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
              title="Geri Dön"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-800 flex items-center gap-2">
                Soru Bankası Havuzu
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                  {allQuestions.length} Soru
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Tüm sorularınızı filtreleyin, arayın veya E-Tabloya aktarın.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>E-Tablo & Soru Ekle</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-3 flex flex-col sm:flex-row gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Sorularda, konularda veya açıklamalarda ara..."
              value={dbSearch}
              onChange={(e) => setDbSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={dbCategoryFilter}
            onChange={(e) => setDbCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
          >
            <option value="all">Tüm Kategoriler ({allQuestions.length})</option>
            {existingCats.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Question Cards List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
          {filteredDbQuestions.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-200">
              <Database className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">Eşleşen soru bulunamadı.</p>
              <p className="text-xs text-slate-400 mt-1">Arama filtrenizi değiştirebilir veya E-Tablo üzerinden yeni sorular ekleyebilirsiniz.</p>
            </div>
          ) : (
            filteredDbQuestions.map((q, idx) => (
              <div 
                key={idx}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:border-blue-300 transition space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      {q.category || 'Genel KBB'}
                    </span>
                    <span className="text-slate-500 font-medium">{q.topic || 'Genel'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopySingleQuestion(q, idx)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition"
                      title="E-Tablo satırı olarak kopyala"
                    >
                      {copiedQuestionId === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Bu soruyu silmek istediğinize emin misiniz?')) {
                          deleteQuestionByIndex(idx);
                          refreshAppData();
                        }
                      }}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                      title="Soruyu sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="text-xs sm:text-sm font-semibold text-slate-800 leading-snug">
                  {q.soru}
                </div>

                {/* Compact Options Preview */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs">
                  {(['A', 'B', 'C', 'D', 'E'] as const).map(opt => (
                    <div 
                      key={opt}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] truncate flex items-center gap-1.5 ${
                        opt === q.dogruCevap 
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold' 
                          : 'bg-slate-50 border-slate-100 text-slate-600'
                      }`}
                    >
                      <span className="font-bold">{opt}:</span>
                      <span className="truncate">{q.secenekler[opt]}</span>
                    </div>
                  ))}
                </div>

                {q.aciklama && (
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">
                    <strong className="text-slate-600">Açıklama:</strong> {q.aciklama}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal */}
        <QuestionManagementModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onQuestionsUpdated={refreshAppData}
          currentCount={allQuestions.length}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#edf2f7] text-slate-900 font-sans">
      <main className="w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {view === 'dashboard' && renderDashboard()}
            {view === 'database' && renderDatabase()}
            {view === 'exam' && renderExam()}
            {view === 'result' && renderResult()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
