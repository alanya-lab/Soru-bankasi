import React, { useState, useEffect, useRef } from 'react';
import { generateExamQuestions } from './services/gemini';
import { getQuestions, saveQuestions, clearQuestions, getRandomQuestions, getSolvedQuestions, markQuestionsAsSolved } from './services/db';
import { Question } from './types';
import { TOPICS } from './constants';
import { getTopicDistribution } from './utils';
import { Loader2, BookOpen, CheckCircle2, XCircle, ChevronRight, RefreshCw, ArrowRight, ArrowLeft, CheckSquare, Play, Settings, Trophy, Home, Database, StopCircle, Download, Upload, Check, ArrowUp, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ViewState = 'dashboard' | 'exam' | 'result' | 'database';

export default function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  
  // DB State
  const [dbCount, setDbCount] = useState(0);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [solvedQuestions, setSolvedQuestions] = useState<string[]>([]);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const autoGenRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup state
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(30);
  const [includeSolved, setIncludeSolved] = useState<boolean>(false);
  
  // Exam state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [forceShowExplanation, setForceShowExplanation] = useState(false);

  useEffect(() => {
    const q = getQuestions();
    setDbCount(q.length);
    setAllQuestions(q);
    setSolvedQuestions(getSolvedQuestions());
  }, [view]);

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
      requestedCount = 30;
    } else if (mode === 'full') {
      requestedCount = 130;
    } else if (mode === 'custom') {
      requestedCount = questionCount;
      if (selectedTopicIds.length > 0) {
        topicNames = TOPICS.filter(t => selectedTopicIds.includes(t.id)).map(t => t.name);
      }
    }

    const pool = getRandomQuestions(requestedCount, topicNames, includeSolved);
    
    if (pool.length === 0) {
      if (!includeSolved) {
        setError("Seçilen kriterlere uygun YENİ soru bulunamadı. Lütfen 'Çözülmüş soruları dahil et' seçeneğini açın veya yeni soru üretin.");
      } else {
        setError("Seçilen kriterlere uygun soru bulunamadı. Lütfen önce veritabanına soru ekleyin.");
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
      setView('result');
    }
  };

  const prevQuestion = () => {
    setForceShowExplanation(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      nextQuestion();
    } else if (info.offset.x > swipeThreshold) {
      prevQuestion();
    } else if (info.offset.y < -swipeThreshold) {
      setForceShowExplanation(true);
    }
  };

  const toggleTopic = (id: number) => {
    setSelectedTopicIds(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleAutoGenerate = async () => {
    if (autoGenRef.current) {
      autoGenRef.current = false;
      setIsAutoGenerating(false);
      setGenStatus('Üretim durduruldu.');
      return;
    }

    autoGenRef.current = true;
    setIsAutoGenerating(true);
    setGenStatus('Üretim başlıyor...');

    let currentCount = getQuestions().length;
    while (currentCount < 1040 && autoGenRef.current) {
      try {
        const dist = getTopicDistribution(15);
        const distText = dist.map(d => `${d.count}x ${d.name}`).join(', ');
        setGenStatus(`Hazırlanıyor (${distText})...`);

        const newQs = await generateExamQuestions(dist);
        currentCount = saveQuestions(newQs);
        setDbCount(currentCount);
        setGenStatus(`Başarıyla eklendi. Toplam: ${currentCount}`);
        
        // Wait 5 seconds before next batch to avoid rate limits
        await new Promise(r => setTimeout(r, 5000));
      } catch (e: any) {
        setGenStatus(`Hata: ${e.message}. 10 saniye sonra tekrar denenecek.`);
        await new Promise(r => setTimeout(r, 10000));
      }
    }
    
    if (currentCount >= 1040) {
      setGenStatus('Hedeflenen 1040 soruya ulaşıldı!');
    }
    autoGenRef.current = false;
    setIsAutoGenerating(false);
  };

  const handleClearDb = () => {
    // In a real app, use a custom modal. For now, just clear it directly or use a state-based confirmation.
    // To keep it simple, we'll just clear it and update status.
    clearQuestions();
    setDbCount(0);
    setGenStatus('Veritabanı temizlendi.');
  };

  const handleDownload = () => {
    const data = getQuestions();
    if (data.length === 0) {
      setGenStatus("İndirilecek soru bulunamadı.");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kbb-soru-bankasi.json';
    a.click();
    URL.revokeObjectURL(url);
    setGenStatus('Sorular başarıyla indirildi.');
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          const newCount = saveQuestions(parsed);
          setDbCount(newCount);
          setGenStatus(`${parsed.length} soru başarıyla yüklendi.`);
        } else {
          setGenStatus("Hata: Geçersiz dosya formatı.");
        }
      } catch (err) {
        setGenStatus("Hata: Dosya okunurken bir hata oluştu.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderDashboard = () => {
    const categories = Array.from(new Set(TOPICS.map(t => t.category)));

    const toggleCategory = (category: string) => {
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

    return (
      <div className="max-w-4xl mx-auto h-[100dvh] flex flex-col p-4 gap-4 overflow-hidden">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-purple-700 tracking-tight leading-none">
              HadiÇöz
            </h1>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mt-1">Medikal Kontrol Paneli</p>
          </div>
          <button 
            onClick={() => setView('database')}
            className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
          >
            <Database size={16} /> <span className="hidden sm:inline">Soru Bankası</span>
          </button>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
          
          {/* Left: Hadi Çözelim (Takes up most space) */}
          <div className="flex-[2] md:flex-[7] bg-[#1e88e5] rounded-3xl p-4 sm:p-5 text-white flex flex-col shadow-lg overflow-hidden relative min-h-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
            
            <div className="flex justify-between items-end mb-4 shrink-0 relative z-10">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold mb-1">Hadi Çözelim</h2>
                <p className="text-blue-100 text-[10px] sm:text-xs">Konuları seçin ve teste başlayın.</p>
              </div>
              <button
                onClick={() => startExam('quick')}
                disabled={dbCount < 30}
                className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-800/50 disabled:text-slate-400 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all shadow-md flex items-center gap-1.5 sm:gap-2"
              >
                <Play size={14} fill="currentColor" /> <span className="hidden sm:inline">Hızlı Sınav</span><span className="sm:hidden">Hızlı</span>
              </button>
            </div>

            {/* Topics Accordion */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 mb-4 relative z-10">
              {categories.map(category => {
                const categoryTopics = TOPICS.filter(t => t.category === category);
                const allSelected = categoryTopics.every(t => selectedTopicIds.includes(t.id));
                const isExpanded = expandedCategories.includes(category);
                
                return (
                  <div key={category} className="bg-white/10 rounded-xl overflow-hidden transition-all">
                    <div className="flex items-center justify-between p-2.5 sm:p-3">
                      <button
                        onClick={() => toggleExpandedCategory(category)}
                        className="flex-1 text-left font-bold text-xs sm:text-sm text-white flex items-center gap-2"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        <span className="truncate">{category}</span>
                      </button>
                      <button
                        onClick={() => toggleCategory(category)}
                        className={`w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0 ml-2 ${allSelected ? 'bg-white border-white' : 'border-white/50 hover:bg-white/20'}`}
                      >
                        {allSelected && <Check size={12} className="text-[#1e88e5]" strokeWidth={3} />}
                      </button>
                    </div>
                    
                    {isExpanded && (
                      <div className="flex flex-col gap-1 px-2.5 pb-2.5 sm:px-3 sm:pb-3">
                        {categoryTopics.map(topic => {
                          const isSelected = selectedTopicIds.includes(topic.id);
                          const topicQuestions = allQuestions.filter(q => q.topic === topic.name);
                          const totalQ = topicQuestions.length;
                          const solvedQ = topicQuestions.filter(q => solvedQuestions.includes(q.soru.trim())).length;
                          
                          return (
                            <button
                              key={topic.id}
                              onClick={() => toggleTopic(topic.id)}
                              className={`w-full text-left px-2.5 py-2 sm:px-3 sm:py-2 rounded-lg text-[10px] sm:text-xs font-medium transition-all flex items-center justify-between ${
                                isSelected ? 'bg-white text-[#1e88e5]' : 'bg-white/10 text-blue-50 hover:bg-white/20'
                              }`}
                            >
                              <span className="flex-1 truncate pr-2">{topic.name}</span>
                              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-md font-bold ${isSelected ? 'bg-blue-100 text-blue-800' : 'bg-black/20 text-white'}`}>
                                {solvedQ}/{totalQ}
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

            {/* Bottom Controls */}
            <div className="shrink-0 space-y-2.5 sm:space-y-3 relative z-10">
              <div className="flex items-center justify-between bg-white/10 rounded-xl p-2 sm:p-3">
                <span className="text-white text-[10px] sm:text-xs font-medium">Çözülmüş soruları tekrar sor</span>
                <button
                  onClick={() => setIncludeSolved(!includeSolved)}
                  className={`w-10 h-5 sm:w-12 sm:h-6 rounded-full transition-colors relative ${includeSolved ? 'bg-green-400' : 'bg-slate-400/50'}`}
                >
                  <div className={`w-4 h-4 sm:w-5 sm:h-5 bg-white rounded-full absolute top-0.5 transition-transform ${includeSolved ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0.5'}`}></div>
                </button>
              </div>
              <div className="flex gap-1.5 sm:gap-2">
                {[10, 20, 30, 50, 9999].map(num => (
                  <button
                    key={num}
                    onClick={() => setQuestionCount(num)}
                    className={`flex-1 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all ${
                      questionCount === num ? 'bg-white text-[#1e88e5] shadow-md' : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {num === 9999 ? 'Hepsi' : num}
                  </button>
                ))}
              </div>
              <button 
                onClick={() => startExam('custom')}
                disabled={selectedTopicIds.length === 0 || dbCount === 0}
                className="w-full bg-[#1565c0] hover:bg-[#0d47a1] disabled:bg-blue-400/50 disabled:cursor-not-allowed text-white py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
              >
                Soru Çözmeye Başla <ArrowRight size={14} className="sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Right: Stats */}
          <div className="flex-1 md:flex-[4] flex flex-col gap-4 min-h-0 shrink-0 md:shrink">
            <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-100 flex-1 flex flex-col justify-center items-center text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 to-purple-500"></div>
              
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2 sm:mb-4">
                <Trophy size={24} className="sm:w-7 sm:h-7" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-0.5 sm:mb-1">Genel İlerleme</h3>
              <p className="text-slate-500 text-[10px] sm:text-xs mb-4 sm:mb-6">Tüm konulardaki genel başarı durumunuz.</p>
              
              <div className="w-full grid grid-cols-2 gap-2 sm:gap-3">
                <div className="bg-slate-50 rounded-2xl p-3 sm:p-4 border border-slate-100">
                  <div className="text-2xl sm:text-3xl font-black text-blue-600 mb-0.5 sm:mb-1">{solvedQuestions.length}</div>
                  <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Çözülen Soru</div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-3 sm:p-4 border border-slate-100">
                  <div className="text-2xl sm:text-3xl font-black text-purple-600 mb-0.5 sm:mb-1">{dbCount}</div>
                  <div className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Toplam Soru</div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full mt-4 sm:mt-6">
                <div className="flex justify-between text-[9px] sm:text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  <span>İlerleme</span>
                  <span>{dbCount > 0 ? Math.round((solvedQuestions.length / dbCount) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 sm:h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-1000"
                    style={{ width: `${dbCount > 0 ? (solvedQuestions.length / dbCount) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const renderExam = () => {
    const question = questions[currentIndex];
    if (!question) return null;

    const selectedAnswer = answers[currentIndex];
    const showResult = !!selectedAnswer;
    const isCorrect = selectedAnswer === question.dogruCevap;

    return (
      <div className="max-w-2xl mx-auto flex flex-col h-[100dvh] justify-start px-3 pb-3 pt-8 sm:px-4 sm:pb-4 sm:pt-12">
        <div className="flex flex-col w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 max-h-[75dvh]">
          {/* Header */}
          <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setView('dashboard')}
                className="p-1.5 rounded-full bg-white shadow-sm border border-slate-200 text-slate-600 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-purple-700 leading-none mb-0.5">HadiÇöz</h1>
                <p className="text-[10px] text-slate-500 font-medium">Soru {currentIndex + 1} / {questions.length}</p>
              </div>
            </div>
            <div className="text-xs font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg shadow-sm border border-slate-200">
              {formatTime(timer)}
            </div>
          </div>

          {/* Question & Options */}
          <motion.div 
            key={currentIndex}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            onPanEnd={(e, info) => {
              if (info.offset.y < -50 && Math.abs(info.offset.x) < 50) {
                setForceShowExplanation(true);
              }
            }}
            className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col custom-scrollbar"
          >
            <div className="text-sm sm:text-base text-slate-800 font-medium leading-snug mb-5">
              {question.soru}
            </div>
            
            <div className="flex flex-col gap-2 mt-auto">
              {Object.entries(question.secenekler).map(([key, value]) => {
                const isThisSelected = selectedAnswer === key;
                const isThisCorrect = question.dogruCevap === key;
                
                let buttonClass = "bg-slate-50 border border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300";
                
                if (showResult) {
                  if (isThisCorrect) {
                    buttonClass = "bg-emerald-500 border-emerald-600 text-white shadow-sm";
                  } else if (isThisSelected && !isThisCorrect) {
                    buttonClass = "bg-red-500 border-red-600 text-white shadow-sm";
                  } else {
                    buttonClass = "bg-slate-50 border-slate-200 text-slate-400 opacity-50";
                  }
                } else if (isThisSelected) {
                   buttonClass = "bg-blue-600 border-blue-700 text-white shadow-sm";
                }

                return (
                  <button
                    key={key}
                    onClick={() => handleAnswer(key)}
                    disabled={showResult}
                    className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-3 ${buttonClass}`}
                  >
                    <span className="font-bold text-xs sm:text-sm w-4">{key})</span>
                    <span className="flex-1 font-medium text-xs sm:text-sm leading-tight">{value}</span>
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {(showResult || forceShowExplanation) && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
                  className="overflow-hidden"
                >
                  <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-100">
                    <h3 className="font-bold text-emerald-800 mb-1.5 text-xs flex items-center gap-1.5">
                      <BookOpen size={14} />
                      Açıklama
                    </h3>
                    <p className="text-emerald-900 text-xs leading-relaxed">{question.aciklama}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Bottom Bar */}
          <div className="bg-white p-3 border-t border-slate-100 flex items-center gap-2 flex-shrink-0">
            <button 
              onClick={prevQuestion}
              disabled={currentIndex === 0}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold text-xs transition-colors disabled:opacity-40"
            >
              Önceki
            </button>
            <button 
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl font-semibold text-xs transition-colors"
              onClick={() => setForceShowExplanation(!forceShowExplanation)}
            >
              Açıklama
            </button>
            <button 
              onClick={nextQuestion}
              className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
            >
              <span>{currentIndex === questions.length - 1 ? 'Bitir' : 'Sonraki'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDatabase = () => {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 shadow-xl border border-slate-100">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-extrabold text-slate-800">Veritabanı Yönetimi</h2>
          <button onClick={() => setView('dashboard')} className="text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-2">
            <ArrowLeft size={20} /> Ana Sayfaya Dön
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-6">
            <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><Database size={20} /> Durum</h3>
            <p className="text-blue-600 mb-4">Mevcut Soru Sayısı: <strong className="text-2xl">{dbCount}</strong> / 1040</p>
            <div className="h-3 bg-blue-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${(dbCount / 1040) * 100}%` }}></div>
            </div>
          </div>

          <div className="bg-purple-50 border-2 border-purple-100 rounded-2xl p-6">
            <h3 className="font-bold text-purple-800 mb-2 flex items-center gap-2"><RefreshCw size={20} className={isAutoGenerating ? "animate-spin" : ""} /> Otomatik Üretim</h3>
            <p className="text-purple-600 text-sm mb-4 h-10">{genStatus || "Yapay zeka ile otomatik soru üretimi başlatın."}</p>
            <button 
              onClick={toggleAutoGenerate}
              className={`w-full py-3 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${isAutoGenerating ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-600 hover:bg-purple-700'}`}
            >
              {isAutoGenerating ? <><StopCircle size={20} /> Üretimi Durdur</> : <><Play size={20} /> Üretimi Başlat</>}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="border-2 border-slate-100 rounded-2xl p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Download size={20} /> Dışa Aktar</h3>
            <p className="text-slate-500 text-sm mb-4">Mevcut soruları JSON formatında bilgisayarınıza indirin.</p>
            <button onClick={handleDownload} className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-bold transition-all">
              Soruları İndir
            </button>
          </div>

          <div className="border-2 border-slate-100 rounded-2xl p-6">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Upload size={20} /> İçe Aktar</h3>
            <p className="text-slate-500 text-sm mb-4">Daha önce indirdiğiniz JSON dosyasını yükleyin.</p>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef}
              onChange={handleUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-3 rounded-xl font-bold transition-all cursor-pointer flex justify-center items-center">
              Dosya Seç ve Yükle
            </label>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-slate-100">
          <button onClick={handleClearDb} className="text-red-500 hover:text-red-700 font-bold text-sm flex items-center gap-2 transition-colors">
            <XCircle size={16} /> Tüm Veritabanını Temizle (Tehlikeli)
          </button>
        </div>
      </div>
    );
  };

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

    const score = Math.round((correct / questions.length) * 100);

    return (
      <div className="max-w-2xl mx-auto bg-white rounded-[2rem] p-8 sm:p-12 text-center relative overflow-hidden shadow-xl border border-slate-100">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#007bff] to-[#6f42c1]"></div>
        <div className="w-20 h-20 bg-blue-50 text-[#007bff] rounded-full flex items-center justify-center mx-auto mb-8">
          <Trophy size={40} />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Sınav Tamamlandı</h2>
        <p className="text-slate-500 font-medium mb-8 text-lg">Performans özetiniz aşağıdadır.</p>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-4">
            <div className="text-3xl font-black text-emerald-600 mb-1">{correct}</div>
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Doğru</div>
          </div>
          <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4">
            <div className="text-3xl font-black text-red-600 mb-1">{incorrect}</div>
            <div className="text-xs font-bold text-red-800 uppercase tracking-wider">Yanlış</div>
          </div>
          <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4">
            <div className="text-3xl font-black text-slate-600 mb-1">{empty}</div>
            <div className="text-xs font-bold text-slate-800 uppercase tracking-wider">Boş</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-900 rounded-2xl p-6 text-white text-left">
            <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Başarı Oranı</div>
            <div className="text-4xl font-black">%{score}</div>
          </div>
          <div className="bg-orange-50 border-2 border-orange-100 rounded-2xl p-6 text-left">
            <div className="text-xs text-orange-500 uppercase tracking-widest font-bold mb-2">Toplam Süre</div>
            <div className="text-3xl font-black text-orange-700 font-mono">{formatTime(timer)}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => {
              setCurrentIndex(0);
              setView('exam');
            }}
            className="px-8 py-4 rounded-full text-base font-bold border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
          >
            Soruları İncele
          </button>
          <button
            onClick={() => setView('dashboard')}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-[#007bff] to-[#6f42c1] hover:from-blue-600 hover:to-purple-600 text-white px-8 py-4 rounded-full text-base font-bold transition-all shadow-lg active:scale-95"
          >
            <Home size={20} />
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#eef2f6] text-slate-900 font-sans selection:bg-blue-200">
      <main className="px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
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
