import React, { useState, useEffect, useRef } from 'react';
import { generateExamQuestions } from './services/gemini';
import { getQuestions, saveQuestions, clearQuestions, getRandomQuestions } from './services/db';
import { Question } from './types';
import { TOPICS } from './constants';
import { getTopicDistribution } from './utils';
import { Loader2, BookOpen, CheckCircle2, XCircle, ChevronRight, RefreshCw, ArrowRight, ArrowLeft, CheckSquare, Play, Settings, Trophy, Home, Database, StopCircle, Download, Upload, Check, ArrowUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ViewState = 'dashboard' | 'exam' | 'result' | 'database';

export default function App() {
  const [view, setView] = useState<ViewState>('dashboard');
  
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

    return (
      <div className="max-w-5xl mx-auto space-y-8 pt-4">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-purple-700 tracking-tight">
            HadiÇöz
          </h1>
          <p className="text-slate-700 font-medium text-lg mt-1">Medical Dashboard</p>
        </div>

        <div className="bg-white rounded-[2rem] shadow-xl border-l-[16px] border-purple-700 p-8 flex flex-col lg:flex-row gap-8">
          {/* Left: Prepare for Test */}
          <div className="bg-[#1e88e5] rounded-[1.5rem] p-6 text-white flex-1 flex flex-col shadow-inner">
            <h2 className="text-2xl font-bold mb-2">Prepare for Test</h2>
            <p className="text-blue-100 text-sm mb-6">Select subject(s) first, then start solving questions.</p>
            
            <div className="flex flex-wrap gap-2 mb-8 flex-1 content-start">
              {categories.map(category => {
                const categoryTopics = TOPICS.filter(t => t.category === category);
                const allSelected = categoryTopics.every(t => selectedTopicIds.includes(t.id));
                return (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                      allSelected ? 'bg-purple-700 text-white shadow-md' : 'bg-white/20 hover:bg-white/30 text-white'
                    }`}
                  >
                    {allSelected && <Check size={16} />}
                    {category}
                  </button>
                );
              })}
            </div>

            <button 
              onClick={() => startExam('custom')}
              disabled={selectedTopicIds.length === 0 || dbCount === 0}
              className="w-full bg-[#1565c0] hover:bg-[#0d47a1] disabled:bg-blue-400/50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition-all shadow-lg active:scale-95"
            >
              Start Solving
            </button>
          </div>

          {/* Right: Stats */}
          <div className="flex-1 flex flex-col justify-between py-2">
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="border-2 border-[#1e88e5] rounded-2xl p-4 text-center flex flex-col justify-center">
                <div className="text-xs font-semibold text-slate-500 mb-1">Database</div>
                <div className="text-4xl font-bold text-slate-800">{dbCount}</div>
                <div className="text-xs text-slate-500 mt-1">Questions</div>
              </div>
              <div className="border-2 border-purple-700 rounded-2xl p-4 text-center flex flex-col justify-center">
                <div className="text-xs font-semibold text-slate-500 mb-1">Target</div>
                <div className="text-4xl font-bold text-slate-800">1040</div>
                <div className="text-xs text-slate-500 mt-1">Questions</div>
              </div>
              <div 
                className="border-2 border-purple-700 rounded-2xl p-4 text-center cursor-pointer hover:bg-purple-50 transition-colors flex flex-col justify-center items-center group"
                onClick={() => setView('database')}
              >
                <div className="text-xs font-semibold text-slate-500 mb-2">Manage</div>
                <Database size={32} className="text-purple-700 group-hover:scale-110 transition-transform" />
                <div className="text-xs text-slate-500 mt-2">Database</div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl">
              <div className="flex justify-between text-sm font-bold text-slate-700 mb-3">
                <span>Database Progress: {dbCount} / 1040</span>
                <span>{Math.round((dbCount / 1040) * 100)}%</span>
              </div>
              <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#1e88e5] rounded-full transition-all duration-1000" style={{ width: `${(dbCount / 1040) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-8 text-center border border-slate-100">
          <h3 className="text-xl font-bold text-slate-800 mb-2">Quick Exam</h3>
          <p className="text-slate-500 text-sm mb-6">Start a quick 30-question exam from all available topics.</p>
          <button
            onClick={() => startExam('quick')}
            disabled={dbCount < 30}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg active:scale-95"
          >
            Start Quick Exam
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
      <div className="max-w-5xl mx-auto flex flex-col min-h-[85vh] pt-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-800 to-purple-700 tracking-tight">HadiÇöz</h1>
              <p className="text-sm text-slate-600 font-medium">KBB Board Hazırlık</p>
            </div>
            <div className="text-sm font-bold text-slate-600 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100">
              {formatTime(timer)}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gradient-to-r from-[#007bff] to-[#6f42c1] rounded-full py-2.5 text-center text-white font-bold text-base shadow-md">
            Soru {currentIndex + 1} / {questions.length}
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sm:p-10 mb-8 relative">
          <div className="text-xl text-slate-800 font-medium leading-relaxed mb-10">
            {question.soru}
          </div>
          <div className="text-center text-slate-400 text-sm font-medium flex items-center justify-center gap-2">
            <ArrowUp size={18} /> Detaylı Açıklama için yukarı kaydır
          </div>
        </div>

        {/* Options */}
        <div className="grid md:grid-cols-2 gap-4 mb-8 flex-1">
          {Object.entries(question.secenekler).map(([key, value]) => {
            const isThisSelected = selectedAnswer === key;
            const isThisCorrect = question.dogruCevap === key;
            
            let buttonClass = "bg-[#f0f7ff] border-2 border-[#007bff] text-slate-700 hover:bg-[#007bff] hover:text-white";
            
            if (showResult) {
              if (isThisCorrect) {
                buttonClass = "bg-emerald-500 border-emerald-500 text-white shadow-md";
              } else if (isThisSelected && !isThisCorrect) {
                buttonClass = "bg-red-500 border-red-500 text-white shadow-md";
              } else {
                buttonClass = "bg-[#f0f7ff] border-2 border-slate-200 text-slate-400 opacity-50";
              }
            } else if (isThisSelected) {
               buttonClass = "bg-[#007bff] border-[#007bff] text-white shadow-md";
            }

            return (
              <button
                key={key}
                onClick={() => handleAnswer(key)}
                disabled={showResult}
                className={`w-full text-left px-8 py-5 rounded-full transition-all duration-200 flex items-center gap-4 group ${buttonClass}`}
              >
                <span className="font-bold text-lg">{key})</span>
                <span className="flex-1 font-medium text-lg leading-snug">{value}</span>
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        <AnimatePresence>
          {showResult && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
              className="overflow-hidden"
            >
              <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 border-l-8 border-l-emerald-500">
                <h3 className="font-bold text-emerald-700 mb-3 text-lg flex items-center gap-2">
                  <BookOpen size={20} />
                  Açıklama ve Klinik Notlar
                </h3>
                <p className="text-slate-700 text-base leading-relaxed font-medium">{question.aciklama}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Bar */}
        <div className="bg-[#1565c0] rounded-t-[2rem] p-5 flex flex-col sm:flex-row items-center gap-4 mt-auto -mx-4 sm:mx-0 sm:rounded-b-[2rem] shadow-xl">
          <div className="flex w-full sm:w-auto gap-4">
            <button 
              onClick={prevQuestion}
              disabled={currentIndex === 0}
              className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-full font-medium text-base transition-colors disabled:opacity-30"
            >
              Önceki Soru
            </button>
            <button 
              className="flex-1 sm:flex-none bg-white/10 hover:bg-white/20 text-white px-8 py-4 rounded-full font-medium text-base transition-colors"
              onClick={() => {
                // Logic to toggle explanation manually if needed
              }}
            >
              Açıklama
            </button>
          </div>
          <button 
            onClick={nextQuestion}
            className="w-full sm:w-auto flex-1 bg-gradient-to-r from-[#007bff] to-[#6f42c1] hover:from-blue-500 hover:to-purple-500 text-white px-10 py-4 rounded-full font-bold text-lg flex items-center justify-between transition-all shadow-lg active:scale-95"
          >
            <span>{currentIndex === questions.length - 1 ? 'Sınavı Bitir' : 'Sonraki Soru'}</span>
            <ArrowRight size={24} />
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
