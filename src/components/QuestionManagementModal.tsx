import React, { useState, useEffect } from 'react';
import { Question, SheetSyncConfig } from '../types';
import { TOPICS } from '../constants';
import { 
  getSheetConfig, 
  saveSheetConfig, 
  fetchSheetContent, 
  exportQuestionsToTSV, 
  singleQuestionToTSVLine, 
  getTemplateTSV 
} from '../services/sheetsService';
import { 
  addSingleQuestion, 
  saveQuestions, 
  replaceQuestions, 
  clearQuestions,
  getQuestions,
  resolveCategoryForTopic,
  normalizeQuestion 
} from '../services/db';
import { 
  X, 
  FileSpreadsheet, 
  PlusCircle, 
  FileCode, 
  RefreshCw, 
  Check, 
  Copy, 
  ExternalLink, 
  AlertCircle, 
  Trash2, 
  Database,
  ArrowRight,
  Info
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onQuestionsUpdated: () => void;
  currentCount: number;
}

type TabType = 'sheet' | 'manual' | 'json';

export default function QuestionManagementModal({ isOpen, onClose, onQuestionsUpdated, currentCount }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>('sheet');

  // Sheet Sync State
  const [sheetUrl, setSheetUrl] = useState('');
  const [autoSync, setAutoSync] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | undefined>();
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>('merge');
  const [isLoading, setIsLoading] = useState(false);
  const [sheetMessage, setSheetMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Manual Form State
  const [formCategory, setFormCategory] = useState('Rinoloji');
  const [customCategory, setCustomCategory] = useState('');
  const [formTopic, setFormTopic] = useState('Burun Kanaması');
  const [customTopic, setCustomTopic] = useState('');
  const [formSoru, setFormSoru] = useState('');
  const [formOptA, setFormOptA] = useState('');
  const [formOptB, setFormOptB] = useState('');
  const [formOptC, setFormOptC] = useState('');
  const [formOptD, setFormOptD] = useState('');
  const [formOptE, setFormOptE] = useState('');
  const [formDogruCevap, setFormDogruCevap] = useState<'A' | 'B' | 'C' | 'D' | 'E'>('A');
  const [formAciklama, setFormAciklama] = useState('');
  const [manualMessage, setManualMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // JSON Batch State
  const [jsonText, setJsonText] = useState('');
  const [jsonMessage, setJsonMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Copy Feedback State
  const [copiedType, setCopiedType] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const config = getSheetConfig();
      setSheetUrl(config.sheetUrl || '');
      setAutoSync(config.autoSync || false);
      setLastSyncTime(config.lastSyncTime);
      setSheetMessage(null);
      setManualMessage(null);
      setJsonMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Categories list
  const existingCategories = Array.from(new Set(TOPICS.map(t => t.category)));
  const topicsForCategory = TOPICS.filter(t => t.category === (customCategory ? '' : formCategory)).map(t => t.name);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleSheetSync = async () => {
    if (!sheetUrl.trim()) {
      setSheetMessage({ type: 'error', text: 'Lütfen Google E-Tablonuzun paylaşım linkini girin.' });
      return;
    }

    setIsLoading(true);
    setSheetMessage(null);

    try {
      const { questions, count } = await fetchSheetContent(sheetUrl.trim());
      
      let updatedTotal = 0;
      if (syncMode === 'replace') {
        updatedTotal = replaceQuestions(questions);
      } else {
        updatedTotal = saveQuestions(questions);
      }

      const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(now);
      saveSheetConfig({
        sheetUrl: sheetUrl.trim(),
        autoSync,
        lastSyncTime: now,
        importedCount: count,
      });

      setSheetMessage({
        type: 'success',
        text: `Senkronizasyon başarılı! E-Tablodan ${count} soru çekildi. Toplam soru havuzu: ${updatedTotal}`,
      });
      onQuestionsUpdated();
    } catch (err: any) {
      setSheetMessage({
        type: 'error',
        text: err.message || 'E-Tablo verisi çekilirken bir hata oluştu.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAutoSyncToggle = (enabled: boolean) => {
    setAutoSync(enabled);
    const config = getSheetConfig();
    saveSheetConfig({ ...config, autoSync: enabled });
  };

  const handleAddManualQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = customCategory.trim() || formCategory;
    const finalTopic = customTopic.trim() || formTopic;

    if (!formSoru.trim()) {
      setManualMessage({ type: 'error', text: 'Lütfen soru metnini girin.' });
      return;
    }
    if (!formOptA.trim() || !formOptB.trim() || !formOptC.trim() || !formOptD.trim() || !formOptE.trim()) {
      setManualMessage({ type: 'error', text: 'Lütfen 5 seçeneğin (A, B, C, D, E) tamamını doldurun.' });
      return;
    }

    const newQuestion: Question = {
      soru: formSoru.trim(),
      secenekler: {
        A: formOptA.trim(),
        B: formOptB.trim(),
        C: formOptC.trim(),
        D: formOptD.trim(),
        E: formOptE.trim(),
      },
      dogruCevap: formDogruCevap,
      aciklama: formAciklama.trim() || 'Açıklama girilmedi.',
      category: finalCategory,
      topic: finalTopic,
    };

    const newTotal = addSingleQuestion(newQuestion);
    setManualMessage({ type: 'success', text: `Soru başarıyla eklendi! Toplam soru: ${newTotal}` });
    onQuestionsUpdated();

    // Reset question inputs, keep category/topic for faster sequential entry
    setFormSoru('');
    setFormOptA('');
    setFormOptB('');
    setFormOptC('');
    setFormOptD('');
    setFormOptE('');
    setFormAciklama('');
  };

  const handleCopySingleAsSheetRow = () => {
    const finalCategory = customCategory.trim() || formCategory;
    const finalTopic = customTopic.trim() || formTopic;
    if (!formSoru.trim()) {
      setManualMessage({ type: 'error', text: 'Kopyalamadan önce en azından soru metnini yazmalısınız.' });
      return;
    }
    const tempQ: Question = {
      soru: formSoru.trim(),
      secenekler: {
        A: formOptA.trim(),
        B: formOptB.trim(),
        C: formOptC.trim(),
        D: formOptD.trim(),
        E: formOptE.trim(),
      },
      dogruCevap: formDogruCevap,
      aciklama: formAciklama.trim(),
      category: finalCategory,
      topic: finalTopic,
    };
    handleCopy(singleQuestionToTSVLine(tempQ), 'manualRow');
  };

  const handleImportJSON = () => {
    if (!jsonText.trim()) {
      setJsonMessage({ type: 'error', text: 'Lütfen JSON verisi yapıştırın.' });
      return;
    }

    try {
      const parsed = JSON.parse(jsonText.trim());
      const rawList = Array.isArray(parsed) ? parsed : [parsed];
      
      const validQuestions: Question[] = [];
      for (const item of rawList) {
        if (!item.soru && !item.question) continue;
        const qText = item.soru || item.question;
        const opts = item.secenekler || item.options || {
          A: item.A || '',
          B: item.B || '',
          C: item.C || '',
          D: item.D || '',
          E: item.E || '',
        };
        const ans = (item.dogruCevap || item.answer || 'A').toUpperCase().match(/[A-E]/)?.[0] || 'A';
        const exp = item.aciklama || item.explanation || '';
        const topic = (item.topic || item.konu || 'Genel').trim();
        const cat = resolveCategoryForTopic(topic, item.category || item.kategori);

        if (opts.A && opts.B && opts.C && opts.D && opts.E) {
          validQuestions.push({
            soru: qText,
            secenekler: {
              A: String(opts.A),
              B: String(opts.B),
              C: String(opts.C),
              D: String(opts.D),
              E: String(opts.E),
            },
            dogruCevap: ans as any,
            aciklama: exp,
            topic,
            category: cat,
          });
        }
      }

      if (validQuestions.length === 0) {
        setJsonMessage({ type: 'error', text: 'Geçerli formatta soru tespit edilemedi. Lütfen JSON formatınızı kontrol edin.' });
        return;
      }

      const total = saveQuestions(validQuestions);
      setJsonMessage({ type: 'success', text: `${validQuestions.length} soru başarıyla içe aktarıldı! Toplam soru: ${total}` });
      setJsonText('');
      onQuestionsUpdated();
    } catch (e: any) {
      setJsonMessage({ type: 'error', text: `JSON ayrıştırma hatası: ${e.message}` });
    }
  };

  const handleExportAllJSON = () => {
    const qList = getQuestions();
    handleCopy(JSON.stringify(qList, null, 2), 'allJson');
  };

  const handleExportAllTSV = () => {
    const qList = getQuestions();
    handleCopy(exportQuestionsToTSV(qList), 'allTsv');
  };

  const handleAutoRepairCategories = () => {
    const list = getQuestions();
    const repaired = list.map(q => normalizeQuestion(q));
    replaceQuestions(repaired);
    onQuestionsUpdated();
    setJsonMessage({ 
      type: 'success', 
      text: `Tüm sorular (${repaired.length}) başarıyla incelendi ve Board ana başlıklarına göre doğru kategorilere dağıtıldı!` 
    });
  };

  const handleClearBank = () => {
    if (window.confirm('Tüm soru bankasını sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      clearQuestions();
      onQuestionsUpdated();
      setJsonMessage({ type: 'error', text: 'Soru bankası sıfırlandı.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                Soru Bankası & E-Tablo Yönetimi
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                  {currentCount} Soru
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Google E-Tablonuz ile senkronize edin, manuel soru ekleyin veya toplu JSON aktarın.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('sheet')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium rounded-t-xl border-t border-x transition-all ${
              activeTab === 'sheet'
                ? 'bg-slate-900 border-slate-700 text-emerald-400 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Google E-Tablolar (Sheets)
            {lastSyncTime && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium rounded-t-xl border-t border-x transition-all ${
              activeTab === 'manual'
                ? 'bg-slate-900 border-slate-700 text-emerald-400 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Yeni Soru Ekle
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium rounded-t-xl border-t border-x transition-all ${
              activeTab === 'json'
                ? 'bg-slate-900 border-slate-700 text-emerald-400 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Toplu JSON & Yedek
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 1: GOOGLE SHEETS */}
          {activeTab === 'sheet' && (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Bağlantı Durumu</div>
                    <div className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 mt-0.5">
                      {sheetUrl ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          E-Tablo Tanımlı
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                          Bağlı Değil
                        </>
                      )}
                    </div>
                  </div>
                  <FileSpreadsheet className="w-6 h-6 text-slate-500" />
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Son Senkronizasyon</div>
                    <div className="text-sm font-semibold text-slate-200 mt-0.5">
                      {lastSyncTime ? `${lastSyncTime}` : 'Henüz yapılmadı'}
                    </div>
                  </div>
                  <RefreshCw className="w-6 h-6 text-slate-500" />
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400">Aktif Soru Sayısı</div>
                    <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                      {currentCount} Soru Hazır
                    </div>
                  </div>
                  <Database className="w-6 h-6 text-slate-500" />
                </div>
              </div>

              {/* URL Input & Actions */}
              <div className="p-5 rounded-2xl bg-slate-800/30 border border-slate-700/80 space-y-4">
                <label className="block text-sm font-medium text-slate-200">
                  Google E-Tablo Paylaşım Linki (URL)
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                  />
                  <button
                    onClick={handleSheetSync}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white text-sm font-medium shadow-md shadow-emerald-950/30 transition shrink-0"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                    {isLoading ? 'Senkronize Ediliyor...' : 'Soruları Getir / Eşitle'}
                  </button>
                </div>

                {/* Sync Options */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-700/50 text-xs text-slate-300">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 font-medium">Eşitleme Şekli:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="syncMode"
                        checked={syncMode === 'merge'}
                        onChange={() => setSyncMode('merge')}
                        className="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                      />
                      <span>Mevcut Havuzla Birleştir</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="syncMode"
                        checked={syncMode === 'replace'}
                        onChange={() => setSyncMode('replace')}
                        className="text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                      />
                      <span>Sadece E-Tablodakileri Yükle</span>
                    </label>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer hover:text-white transition">
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => handleSaveAutoSyncToggle(e.target.checked)}
                      className="rounded text-emerald-500 focus:ring-emerald-500 bg-slate-900 border-slate-700"
                    />
                    <span>Açılışta otomatik kontrol et</span>
                  </label>
                </div>

                {/* Feedback message */}
                {sheetMessage && (
                  <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                    sheetMessage.type === 'success' 
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  }`}>
                    {sheetMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{sheetMessage.text}</span>
                  </div>
                )}
              </div>

              {/* Template & Helper Tools */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <Copy className="w-4 h-4 text-emerald-400" />
                    Örnek E-Tablo Şablonu
                  </div>
                  <p className="text-xs text-slate-400">
                    Boş bir Google E-Tablo açıp 1. satırına yapıştırabileceğiniz başlık ve 2 örnek board sorusu.
                  </p>
                  <button
                    onClick={() => handleCopy(getTemplateTSV(), 'template')}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/70 text-xs font-medium text-slate-200 flex items-center justify-center gap-2 transition"
                  >
                    {copiedType === 'template' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Şablon Kopyalandı (Ctrl+V ile yapıştırın)</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        Şablon Satırlarını Kopyala
                      </>
                    )}
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    Mevcut Havuzu E-Tabloya Aktar
                  </div>
                  <p className="text-xs text-slate-400">
                    Şu an uygulamadaki tüm {currentCount} soruyu kopyalayıp Google E-Tablo'nuza tek tıkla yapıştırın.
                  </p>
                  <button
                    onClick={handleExportAllTSV}
                    className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600/70 text-xs font-medium text-slate-200 flex items-center justify-center gap-2 transition"
                  >
                    {copiedType === 'allTsv' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Tüm Sorular Kopyalandı!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        Tüm Soruları E-Tablo İçin Kopyala (TSV)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 3 Step Guide */}
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-slate-300 space-y-2">
                <div className="font-semibold text-blue-400 flex items-center gap-1.5">
                  <Info className="w-4 h-4" />
                  Google E-Tablo Bağlantı Adımları:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
                  <li>Google E-Tablolar'da yeni bir tablo açın veya var olan tablonuzu kullanın.</li>
                  <li>İlk satır sütun başlıkları: <code className="text-blue-300">Ana Kategori</code>, <code className="text-blue-300">Alt Kategori</code>, <code className="text-blue-300">Soru</code>, <code className="text-blue-300">A</code>, <code className="text-blue-300">B</code>, <code className="text-blue-300">C</code>, <code className="text-blue-300">D</code>, <code className="text-blue-300">E</code>, <code className="text-blue-300">Doğru Cevap</code>, <code className="text-blue-300">Açıklama</code> olmalıdır.</li>
                  <li>Tablonun sağ üstündeki <strong>Paylaş</strong> butonuna basıp <em>"Bağlantıya sahip olan herkes görüntüleyebilir"</em> yapın ve linki yukarıya yapıştırın.</li>
                </ol>
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL QUESTION ADD */}
          {activeTab === 'manual' && (
            <form onSubmit={handleAddManualQuestion} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Ana Kategori */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Ana Kategori</label>
                  <div className="flex gap-2">
                    <select
                      value={customCategory ? '__custom__' : formCategory}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setCustomCategory(' ');
                        } else {
                          setCustomCategory('');
                          setFormCategory(e.target.value);
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      {existingCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__custom__">+ Yeni Kategori Yaz...</option>
                    </select>
                  </div>
                  {customCategory !== '' && (
                    <input
                      type="text"
                      placeholder="Yeni kategori adı yazın..."
                      value={customCategory.trimStart()}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-emerald-500/50 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                  )}
                </div>

                {/* Alt Kategori */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Alt Kategori / Konu</label>
                  <div className="flex gap-2">
                    <select
                      value={customTopic ? '__custom__' : formTopic}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setCustomTopic(' ');
                        } else {
                          setCustomTopic('');
                          setFormTopic(e.target.value);
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      {topicsForCategory.map(top => (
                        <option key={top} value={top}>{top}</option>
                      ))}
                      <option value="__custom__">+ Yeni Konu Yaz...</option>
                    </select>
                  </div>
                  {customTopic !== '' && (
                    <input
                      type="text"
                      placeholder="Yeni konu adı yazın..."
                      value={customTopic.trimStart()}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-emerald-500/50 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Soru Metni */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Soru Metni (Klinik Vaka / Soru)</label>
                <textarea
                  rows={3}
                  required
                  value={formSoru}
                  onChange={(e) => setFormSoru(e.target.value)}
                  placeholder="Hastanın yaşı, başvuru semptomları ve klinik soruyu buraya yazın..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition resize-y"
                />
              </div>

              {/* Seçenekler A - E */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">Seçenekler</label>
                {(['A', 'B', 'C', 'D', 'E'] as const).map((opt) => {
                  const val = opt === 'A' ? formOptA : opt === 'B' ? formOptB : opt === 'C' ? formOptC : opt === 'D' ? formOptD : formOptE;
                  const setVal = opt === 'A' ? setFormOptA : opt === 'B' ? setFormOptB : opt === 'C' ? setFormOptC : opt === 'D' ? setFormOptD : setFormOptE;
                  const isCorrect = formDogruCevap === opt;

                  return (
                    <div key={opt} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setFormDogruCevap(opt)}
                        className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center transition shrink-0 ${
                          isCorrect 
                            ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/50 ring-2 ring-emerald-400' 
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                        title={isCorrect ? 'Doğru Cevap Olarak İşaretlendi' : 'Doğru Cevap Yap'}
                      >
                        {opt}
                      </button>
                      <input
                        type="text"
                        required
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder={`Seçenek ${opt} metnini girin...`}
                        className={`flex-1 px-3 py-2 rounded-xl bg-slate-950 border text-xs text-slate-100 placeholder-slate-600 focus:outline-none transition ${
                          isCorrect ? 'border-emerald-500/70 bg-emerald-950/10' : 'border-slate-800 focus:border-slate-600'
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Doğru Cevap Seçici Açıklaması */}
              <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
                <span>İşaretlenen Doğru Cevap: <strong className="text-emerald-400 text-sm ml-1">{formDogruCevap}</strong></span>
                <span className="text-[11px] text-slate-500">Doğru şıkkı değiştirmek için soldaki harf butonuna tıklayın.</span>
              </div>

              {/* Açıklama */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Klinik Açıklama & Çözüm Referansı</label>
                <textarea
                  rows={2}
                  value={formAciklama}
                  onChange={(e) => setFormAciklama(e.target.value)}
                  placeholder="Doğru cevabın gerekçesi, patofizyoloji veya kılavuz referansı..."
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition resize-y"
                />
              </div>

              {manualMessage && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  manualMessage.type === 'success' 
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}>
                  {manualMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{manualMessage.text}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCopySingleAsSheetRow}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 flex items-center justify-center gap-2 transition"
                >
                  {copiedType === 'manualRow' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">E-Tablo Satırı Kopyalandı!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      E-Tablo Satırı Olarak Kopyala
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/30 transition flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  Soru Bankasına Kaydet
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: BATCH JSON & BACKUP */}
          {activeTab === 'json' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <label className="block text-xs font-semibold text-slate-200">
                  JSON Formatında Toplu Soru İçe Aktar
                </label>
                <p className="text-xs text-slate-400">
                  Başka bir yapay zekaya (ChatGPT, Claude vb.) veya dosyaya hazırlattığınız soru listesini JSON dizi formatında doğrudan buraya yapıştırıp içeri aktarabilirsiniz.
                </p>
                <textarea
                  rows={6}
                  value={jsonText}
                  onChange={(e) => setJsonText(e.target.value)}
                  placeholder={`[\n  {\n    "category": "Rinoloji",\n    "topic": "Burun Kanaması",\n    "soru": "Soru metni...",\n    "secenekler": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },\n    "dogruCevap": "A",\n    "aciklama": "Açıklama metni..."\n  }\n]`}
                  className="w-full p-3 font-mono text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />

                {jsonMessage && (
                  <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    jsonMessage.type === 'success' 
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                  }`}>
                    {jsonMessage.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                    <span>{jsonMessage.text}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleImportJSON}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition flex items-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4" />
                    JSON Soruları İçeri Aktar
                  </button>
                </div>
              </div>

              {/* Export / Backup Section */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <div className="text-xs font-semibold text-slate-200">
                  Mevcut Bankayı Yedekle & Dışa Aktar
                </div>
                <p className="text-xs text-slate-400">
                  Uygulamadaki tüm sorularınızı tek tıkla kopyalayarak güvenli bir dosyaya yedekleyebilirsiniz.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleExportAllJSON}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-medium text-slate-200 flex items-center gap-2 transition"
                  >
                    {copiedType === 'allJson' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">JSON Kopyalandı!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        Tümünü JSON Olarak Kopyala
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleExportAllTSV}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-medium text-slate-200 flex items-center gap-2 transition"
                  >
                    {copiedType === 'allTsv' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">E-Tablo Formatında Kopyalandı!</span>
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
                        Tümünü E-Tablo Formatında Kopyala
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleAutoRepairCategories}
                    className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-medium text-blue-300 flex items-center gap-2 transition"
                    title="Mevcut soruların konularını analiz edip doğru Board ana kategorilerine otomatik dağıtır"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                    Kategorileri Otomatik Dağıt & Onar
                  </button>

                  <button
                    onClick={handleClearBank}
                    className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-medium text-rose-400 flex items-center gap-2 transition ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Soru Bankasını Temizle
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Veriler Google E-Tablo ve yerel hafızada güvenle tutulur</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
}
