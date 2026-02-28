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

  useEffect(() => {
    setDbCount(getQuestions().length);
  }, []);

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
      setGenStatus('Yapay zeka 15 yeni soru hazırlıyor. Lütfen bekleyin...');
      try {
        const dist = getTopicDistribution(15);
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
    <div className="space-y-6">
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-stone-800 tracking-tight">KBB Soru Bankası</h2>
        <p className="text-stone-500 text-base">Çevrimdışı çalışan, yapay zeka destekli güncel KBB (Board Seviyesi) soru bankası ile kendinizi test edin.</p>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
            <Database size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-emerald-900 text-sm">Veritabanı Durumu</h3>
            <p className="text-emerald-700 text-xs mt-0.5">Mevcut Soru: {dbCount} / 1040</p>
          </div>
        </div>
        <button 
          onClick={() => setView('database')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap"
        >
          Soru Bankasını Yönet
        </button>
      </div>

      {dbCount === 0 && (
        <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-xs border border-amber-200 text-center">
          Sınavlara başlamadan önce "Soru Bankasını Yönet" bölümünden veritabanına soru eklemelisiniz.
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        <button onClick={() => startExam('quick')} disabled={dbCount === 0} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-500 group-hover:text-white transition-colors text-emerald-600">
            <Play size={20} />
          </div>
          <h3 className="text-base font-semibold text-stone-800 mb-1">Hızlı Sınav</h3>
          <p className="text-stone-500 text-xs">Tüm konulardan rastgele seçilmiş 30 soru.</p>
        </button>

        <button onClick={() => startExam('full')} disabled={dbCount === 0} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-500 group-hover:text-white transition-colors text-emerald-600">
            <Trophy size={20} />
          </div>
          <h3 className="text-base font-semibold text-stone-800 mb-1">Tam Deneme</h3>
          <p className="text-stone-500 text-xs">Gerçek sınav formatında 130 soruluk deneme.</p>
        </button>

        <button onClick={() => setView('setup')} disabled={dbCount === 0} className="bg-white p-5 rounded-2xl shadow-sm border border-stone-200 hover:border-emerald-500 hover:ring-1 hover:ring-emerald-500 transition-all text-left group disabled:opacity-50 disabled:cursor-not-allowed">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-500 group-hover:text-white transition-colors text-emerald-600">
            <Settings size={20} />
          </div>
          <h3 className="text-base font-semibold text-stone-800 mb-1">Özel Sınav</h3>
          <p className="text-stone-500 text-xs">İstediğiniz konuları ve soru sayısını belirleyin.</p>
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs border border-red-100 max-w-2xl mx-auto text-center">
          {error}
        </div>
      )}
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="bg-stone-900 text-white px-2.5 py-1 rounded-lg text-xs font-medium">
              Soru {currentIndex + 1} / {questions.length}
            </span>
            <span className="text-xs text-stone-500 font-medium bg-white px-2.5 py-1 rounded-lg border border-stone-200 line-clamp-1 max-w-[200px] sm:max-w-none">
              {question.topic}
            </span>
          </div>
          <button 
            onClick={() => setView('result')}
            className="text-xs text-stone-500 hover:text-stone-800 font-medium"
          >
            Sınavı Bitir
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 sm:p-6 mb-5 overflow-hidden">
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
              className="space-y-6 cursor-grab active:cursor-grabbing"
            >
              <div className="text-base font-medium text-stone-800 leading-relaxed select-none">
                {question.soru}
              </div>

              <div className="space-y-2.5">
                {Object.entries(question.secenekler).map(([key, value]) => {
                  const isThisSelected = selectedAnswer === key;
                  const isThisCorrect = question.dogruCevap === key;
                  
                  let buttonClass = "bg-white border-stone-200 hover:border-stone-300 hover:bg-stone-50 text-stone-700";
                  let icon = null;

                  if (showResult) {
                    if (isThisCorrect) {
                      buttonClass = "bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500 z-10";
                      icon = <CheckCircle2 size={18} className="text-emerald-600" />;
                    } else if (isThisSelected && !isThisCorrect) {
                      buttonClass = "bg-red-50 border-red-500 text-red-800 ring-1 ring-red-500 z-10";
                      icon = <XCircle size={18} className="text-red-600" />;
                    } else {
                      buttonClass = "bg-white border-stone-200 text-stone-400 opacity-60";
                    }
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => handleAnswer(key)}
                      disabled={showResult}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-300 flex items-start gap-3 relative select-none ${buttonClass}`}
                    >
                      <span className={`font-semibold shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-sm ${
                        showResult && isThisCorrect ? 'bg-emerald-200 text-emerald-800' :
                        showResult && isThisSelected && !isThisCorrect ? 'bg-red-200 text-red-800' :
                        'bg-stone-100 text-stone-500'
                      }`}>
                        {key}
                      </span>
                      <span className="flex-1 pt-0.5 leading-snug text-sm">{value}</span>
                      {icon && <span className="shrink-0">{icon}</span>}
                    </button>
                  );
                })}
              </div>

              <AnimatePresence>
                {showResult && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                    className="overflow-hidden"
                  >
                    <div className={`p-4 rounded-xl border ${
                      isCorrect 
                        ? 'bg-emerald-50/50 border-emerald-100' 
                        : 'bg-stone-50 border-stone-200'
                    }`}>
                      <h3 className="text-xs font-semibold text-stone-800 mb-1.5 flex items-center gap-1.5">
                        <BookOpen size={14} className="text-emerald-600" />
                        Açıklama
                      </h3>
                      <p className="text-stone-600 text-xs leading-relaxed select-none">
                        {question.aciklama}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={prevQuestion}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={16} />
            Önceki
          </button>
          
          <button
            onClick={nextQuestion}
            className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white px-5 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            {currentIndex === questions.length - 1 ? 'Sınavı Bitir' : 'Sonraki'}
            {currentIndex !== questions.length - 1 && <ArrowRight size={16} />}
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
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5">
          <Trophy size={32} />
        </div>
        <h2 className="text-2xl font-bold text-stone-800 mb-2">Sınav Tamamlandı</h2>
        <p className="text-stone-500 text-sm mb-6">İşte sonuçlarınız:</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
            <div className="text-2xl font-bold text-emerald-600 mb-1">{correct}</div>
            <div className="text-xs font-medium text-emerald-800">Doğru</div>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-3">
            <div className="text-2xl font-bold text-red-600 mb-1">{incorrect}</div>
            <div className="text-xs font-medium text-red-800">Yanlış</div>
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
            <div className="text-2xl font-bold text-stone-600 mb-1">{empty}</div>
            <div className="text-xs font-medium text-stone-800">Boş</div>
          </div>
        </div>

        <div className="bg-stone-50 rounded-xl p-5 mb-6">
          <div className="text-xs text-stone-500 uppercase tracking-wider font-semibold mb-1">Başarı Oranı</div>
          <div className="text-3xl font-bold text-stone-800">%{score}</div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              setCurrentIndex(0);
              setView('exam');
            }}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            Soruları İncele
          </button>
          <button
            onClick={() => setView('home')}
            className="flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            <Home size={16} />
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-emerald-200">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-sm cursor-pointer" onClick={() => setView('home')}>
            <BookOpen size={16} />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-stone-800 cursor-pointer" onClick={() => setView('home')}>
            KBB Soru Bankası
          </h1>
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
