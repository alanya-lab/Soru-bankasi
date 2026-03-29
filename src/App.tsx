import React, { useState, useEffect, useRef } from 'react';
import { generateExamQuestions } from './services/gemini';
import { getQuestions, saveQuestions, clearQuestions, getRandomQuestions } from './services/db';
import { Question } from './types';
import { TOPICS } from './constants';
import { getTopicDistribution } from './utils';
import { Loader2, BookOpen, CheckCircle2, XCircle, ChevronRight, RefreshCw, ArrowRight, ArrowLeft, CheckSquare, Play, Settings, Trophy, Home, Database, StopCircle, Download, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ViewState = 'home' | 'setup' | 'exam' | 'result' | 'database';

export default function App() {
  const [view, setView] = useState<ViewState>('home');
  
  // DB State
  const [dbCount, setDbCount] = useState(0);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const autoGenRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup state
  const [selectedTopicIds, setSelectedTopicIds] = useState<number[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(30);
  
  // Exam state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [isTimerActive, setIsTimerActive] = useState(false);

  useEffect(() => {
    setDbCount(getQuestions().length);
  }, []);

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

    const pool = getRandomQuestions(requestedCount, topicNames);
    
    if (pool.length === 0) {
      setError("Seçilen kriterlere uygun soru bulunamadı. Lütfen önce veritabanına soru ekleyin.");
      return;
    }

    setQuestions(pool);
    setAnswers({});
    setCurrentIndex(0);
    setTimer(0);
    setIsTimerActive(true);
    setView('exam');
  };

  const handleAnswer = (key: string) => {
    if (answers[currentIndex]) return;
    setAnswers(prev => ({ ...prev, [currentIndex]: key }));
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsTimerActive(false);
      setView('result');
    }
  };

  const prevQuestion = () => {
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
    if (window.confirm('Tüm soruları silmek istediğinize emin misiniz?')) {
      clearQuestions();
      setDbCount(0);
      setGenStatus('Veritabanı temizlendi.');
    }
  };

  const handleDownload = () => {
    const data = getQuestions();
    if (data.length === 0) {
      alert("İndirilecek soru bulunamadı.");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kbb-soru-bankasi.json';
    a.click();
    URL.revokeObjectURL(url);
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
          alert("Geçersiz dosya formatı.");
        }
      } catch (err) {
        alert("Dosya okunurken bir hata oluştu.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderHome = () => (
    <div className="space-y-8">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-block px-4 py-1.5 bg-brand-primary/10 text-brand-primary rounded-full text-xs font-bold uppercase tracking-widest mb-2"
        >
          KBB Uzmanlık Sınavı Hazırlık
        </motion.div>
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          KBB Soru Bankası
        </h2>
        <p className="text-slate-500 text-lg leading-relaxed">
          Yapay zeka destekli, güncel literatüre dayalı ve tamamen çevrimdışı 
          çalışan profesyonel soru bankası.
        </p>
      </div>

      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-8 shadow-xl shadow-blue-200/50 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-400/20 rounded-full -ml-16 -mb-16 blur-2xl"></div>
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md text-white rounded-2xl flex items-center justify-center shadow-inner">
            <Database size={32} />
          </div>
          <div>
            <h3 className="font-bold text-white text-xl">Veritabanı Durumu</h3>
            <p className="text-blue-100 text-sm mt-1">
              <span className="font-mono font-bold text-white">{dbCount}</span> / 1040 soru hazır
            </p>
            <div className="w-48 h-1.5 bg-white/20 rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-1000"
                style={{ width: `${(dbCount / 1040) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setView('database')}
          className="bg-white text-blue-700 hover:bg-blue-50 px-8 py-4 rounded-2xl text-base font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg relative z-10"
        >
          Soru Bankasını Yönet
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <button onClick={() => startExam('quick')} disabled={dbCount === 0} className="vibrant-card p-8 rounded-3xl text-left group disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300 text-orange-600 shadow-sm">
            <Play size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Hızlı Sınav</h3>
          <p className="text-slate-500 text-sm leading-relaxed">Tüm konulardan rastgele seçilmiş 30 soru ile hızlı bir tur yapın.</p>
        </button>

        <button onClick={() => startExam('full')} disabled={dbCount === 0} className="vibrant-card p-8 rounded-3xl text-left group disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 text-indigo-600 shadow-sm">
            <Trophy size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Tam Deneme</h3>
          <p className="text-slate-500 text-sm leading-relaxed">Gerçek sınav formatında 130 soruluk kapsamlı bir deneme sınavı.</p>
        </button>

        <button onClick={() => setView('setup')} disabled={dbCount === 0} className="vibrant-card p-8 rounded-3xl text-left group disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300 text-emerald-600 shadow-sm">
            <Settings size={28} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">Özel Sınav</h3>
          <p className="text-slate-500 text-sm leading-relaxed">Konuları ve soru sayısını kendi ihtiyacınıza göre özelleştirin.</p>
        </button>
      </div>
    </div>
  );

  const renderDatabase = () => (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
        <div>
          <h2 className="text-lg font-semibold text-stone-800 flex items-center gap-2">
            <Database size={18} className="text-emerald-600" />
            Soru Bankası Yöneticisi
          </h2>
          <p className="text-xs text-stone-500 mt-1">Yapay zeka ile çevrimdışı soru havuzunuzu doldurun.</p>
        </div>
        <button onClick={() => setView('home')} className="text-sm text-stone-400 hover:text-stone-600">
          Geri Dön
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-stone-50 p-5 rounded-xl border border-stone-200 text-center">
          <div className="text-3xl font-bold text-stone-800 mb-1">{dbCount} <span className="text-lg text-stone-400 font-medium">/ 1040</span></div>
          <p className="text-stone-500 text-xs mb-3">Cihazınızda kayıtlı toplam soru sayısı</p>
          
          <div className="bg-stone-200 rounded-full h-2 overflow-hidden mb-2">
            <div 
              className="bg-emerald-500 h-full transition-all duration-500 ease-out"
              style={{ width: `${Math.max(2, (dbCount / 1040) * 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-stone-400 font-medium">% {Math.round((dbCount / 1040) * 100)} Tamamlandı</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={toggleAutoGenerate}
            className={`w-full py-3 rounded-xl font-medium transition-colors shadow-sm flex items-center justify-center gap-2 text-sm ${
              isAutoGenerating 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isAutoGenerating ? (
              <>
                <StopCircle size={18} />
                Üretimi Durdur
              </>
            ) : (
              <>
                <Play size={18} />
                Otomatik Soru Üretimini Başlat
              </>
            )}
          </button>
          
          {genStatus && (
            <div className="text-center text-xs font-medium text-stone-600 bg-stone-50 py-2.5 rounded-lg border border-stone-200">
              {isAutoGenerating && <Loader2 size={14} className="animate-spin inline mr-2 text-emerald-600" />}
              {genStatus}
            </div>
          )}
        </div>

        <div className="pt-5 border-t border-stone-100 flex flex-col sm:flex-row gap-3">
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAutoGenerating}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Upload size={16} />
            Yükle
          </button>
          <button
            onClick={handleDownload}
            disabled={dbCount === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Download size={16} />
            İndir
          </button>
          <button
            onClick={handleClearDb}
            disabled={isAutoGenerating || dbCount === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Temizle
          </button>
        </div>
      </div>
    </div>
  );

  const renderSetup = () => {
    // Group topics by category
    const categories = Array.from(new Set(TOPICS.map(t => t.category)));

    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">Özel Sınav Oluştur</h2>
            <p className="text-xs text-stone-500 mt-1">Kategorileri, konuları ve soru sayısını seçin.</p>
          </div>
          <button onClick={() => setView('home')} className="text-sm text-stone-400 hover:text-stone-600">
            İptal
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Soru Sayısı</label>
            <div className="flex gap-2">
              {[10, 20, 30, 40, 50].map(num => (
                <button
                  key={num}
                  onClick={() => setQuestionCount(num)}
                  className={`flex-1 py-1.5 rounded-xl border text-sm font-medium transition-colors ${
                    questionCount === num 
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                      : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-stone-700">Konular</label>
              <button 
                onClick={() => setSelectedTopicIds([])}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Tümünü Temizle
              </button>
            </div>
            
            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {categories.map(category => {
                const categoryTopics = TOPICS.filter(t => t.category === category);
                return (
                  <div key={category} className="space-y-1.5">
                    <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{category}</h3>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {categoryTopics.map(topic => {
                        const isSelected = selectedTopicIds.includes(topic.id);
                        return (
                          <button
                            key={topic.id}
                            onClick={() => toggleTopic(topic.id)}
                            className={`text-left px-2.5 py-1.5 rounded-lg text-xs border transition-colors flex items-start gap-2 ${
                              isSelected 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                            }`}
                          >
                            <div className={`shrink-0 w-3.5 h-3.5 mt-0.5 rounded border flex items-center justify-center ${
                              isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-stone-300'
                            }`}>
                              {isSelected && <CheckSquare size={10} />}
                            </div>
                            <span className="line-clamp-2 leading-tight">{topic.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => startExam('custom')}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Play size={16} />
            Sınavı Başlat
          </button>
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
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="bg-slate-900 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-sm">
              Soru {currentIndex + 1} / {questions.length}
            </span>
            <span className="text-xs text-slate-600 font-bold bg-white px-4 py-1.5 rounded-xl border border-slate-200 shadow-sm line-clamp-1 max-w-[200px] sm:max-w-none">
              {question.topic}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-orange-50 text-orange-700 rounded-xl border border-orange-100 shadow-sm">
              <span className="text-xs font-bold font-mono">{formatTime(timer)}</span>
            </div>
            <button 
              onClick={() => {
                setIsTimerActive(false);
                setView('result');
              }}
              className="text-xs text-slate-400 hover:text-red-600 font-bold transition-colors"
            >
              Sınavı Bitir
            </button>
          </div>
        </div>

        <div className="vibrant-card rounded-3xl p-6 sm:p-10 mb-8 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-brand-primary"></div>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.2 }}
              className="space-y-8 cursor-grab active:cursor-grabbing"
            >
              <div className="text-xl font-bold text-slate-800 leading-relaxed select-none">
                {question.soru}
              </div>

              <div className="space-y-3">
                {Object.entries(question.secenekler).map(([key, value]) => {
                  const isThisSelected = selectedAnswer === key;
                  const isThisCorrect = question.dogruCevap === key;
                  
                  let buttonClass = "bg-white border-slate-200 hover:border-brand-primary hover:bg-blue-50/30 text-slate-700";
                  let icon = null;

                  if (showResult) {
                    if (isThisCorrect) {
                      buttonClass = "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 z-10";
                      icon = <CheckCircle2 size={20} className="text-emerald-600" />;
                    } else if (isThisSelected && !isThisCorrect) {
                      buttonClass = "bg-red-50 border-red-500 text-red-900 ring-2 ring-red-500/20 z-10";
                      icon = <XCircle size={20} className="text-red-600" />;
                    } else {
                      buttonClass = "bg-white border-slate-100 text-slate-300 opacity-50";
                    }
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => handleAnswer(key)}
                      disabled={showResult}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-300 flex items-start gap-4 relative select-none group ${buttonClass}`}
                    >
                      <span className={`font-bold shrink-0 w-8 h-8 flex items-center justify-center rounded-xl text-sm transition-colors ${
                        showResult && isThisCorrect ? 'bg-emerald-500 text-white' :
                        showResult && isThisSelected && !isThisCorrect ? 'bg-red-500 text-white' :
                        'bg-slate-100 text-slate-500 group-hover:bg-brand-primary group-hover:text-white'
                      }`}>
                        {key}
                      </span>
                      <span className="flex-1 pt-1 font-medium leading-snug text-base">{value}</span>
                      {icon && <span className="shrink-0 mt-1">{icon}</span>}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {showResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="overflow-hidden"
                  >
                    <div className={`p-6 rounded-2xl border-2 ${
                      isCorrect 
                        ? 'bg-emerald-50/30 border-emerald-100' 
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <BookOpen size={18} className="text-brand-primary" />
                        Açıklama ve Klinik Notlar
                      </h3>
                      <p className="text-slate-600 text-sm leading-relaxed select-none font-medium">
                        {question.aciklama}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between px-2">
          <button
            onClick={prevQuestion}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ArrowLeft size={18} />
            Önceki Soru
          </button>
          
          <button
            onClick={nextQuestion}
            className="flex items-center gap-2 bg-slate-900 hover:bg-brand-primary text-white px-8 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg hover:shadow-blue-200 active:scale-95"
          >
            {currentIndex === questions.length - 1 ? 'Sınavı Bitir' : 'Sonraki Soru'}
            {currentIndex !== questions.length - 1 && <ArrowRight size={18} />}
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
      <div className="max-w-2xl mx-auto vibrant-card rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-brand-primary"></div>
        <div className="w-20 h-20 bg-brand-primary/10 text-brand-primary rounded-3xl flex items-center justify-center mx-auto mb-8 rotate-3">
          <Trophy size={40} />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 mb-2">Sınav Tamamlandı</h2>
        <p className="text-slate-500 font-medium mb-10">Performans özetiniz aşağıdadır.</p>

        <div className="grid grid-cols-3 gap-4 mb-10">
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

        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-slate-900 rounded-2xl p-6 text-white">
            <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">Başarı Oranı</div>
            <div className="text-4xl font-black">%{score}</div>
          </div>
          <div className="bg-orange-50 border-2 border-orange-100 rounded-2xl p-6">
            <div className="text-xs text-orange-400 uppercase tracking-widest font-bold mb-2">Toplam Süre</div>
            <div className="text-2xl font-black text-orange-700 font-mono">{formatTime(timer)}</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => {
              setCurrentIndex(0);
              setView('exam');
            }}
            className="px-8 py-4 rounded-2xl text-base font-bold border-2 border-slate-200 text-slate-700 hover:bg-slate-50 transition-all"
          >
            Soruları İncele
          </button>
          <button
            onClick={() => setView('home')}
            className="flex items-center justify-center gap-2 bg-brand-primary hover:bg-blue-700 text-white px-8 py-4 rounded-2xl text-base font-bold transition-all shadow-lg shadow-blue-200 active:scale-95"
          >
            <Home size={20} />
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('home')}>
            <div className="w-10 h-10 bg-brand-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <BookOpen size={20} />
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-800">
              KBB <span className="text-brand-primary">SORU BANKASI</span>
            </h1>
          </div>
          
          {view === 'exam' && (
            <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full border border-slate-200">
              <div className="w-2 h-2 bg-brand-secondary rounded-full animate-pulse"></div>
              <span className="text-xs font-bold font-mono text-slate-600">{formatTime(timer)}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'home' && renderHome()}
            {view === 'database' && renderDatabase()}
            {view === 'setup' && renderSetup()}
            {view === 'exam' && renderExam()}
            {view === 'result' && renderResult()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
