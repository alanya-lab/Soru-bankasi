import { Question } from '../types';
import { TOPICS } from '../constants';

const DB_KEY = 'kbb_question_bank';
const SOLVED_KEY = 'kbb_solved_questions';

const SEED_QUESTIONS: Question[] = [
  {
    soru: "48 yaşında erkek hasta kontrolsüz hipertansiyon öyküsü ile acil servise burun sol deliğinden şiddetli kanama şikayetiyle başvuruyor. Ön rinoskopide ve aspirasyonda Kiesselbach alanında kanama odağı saptanmıyor, ancak orofarenksten belirgin aktif posterior sızıntı izleniyor. Bu hastada kanayan damarın en olası kaynağı hangisidir?",
    secenekler: {
      A: "Sfenopalatin arter (Woodruff alanı)",
      B: "Anterior etmoidal arter",
      C: "Fasiyal arterin süperior labial dalı",
      D: "İnternal karotis arter direkt dalları",
      E: "Posterior etmoidal arter"
    },
    dogruCevap: "A",
    aciklama: "Posterior epistaksisler özellikle hipertansif ileri yaş hastalarda sfenopalatin arter dallarından veya Woodruff pleksusundan kaynaklanır ve arka tampon/sfenopalatin arter ligasyonu gerektirebilir.",
    topic: "Burun Kanaması",
    category: "Rinoloji"
  },
  {
    soru: "32 yaşında kadın hasta, her iki kulakta progresif iletim tipi işitme kaybı ile başvuruyor. Otoskopik muayenede timpanik membranlar doğal, Carhart çentiği (2000 Hz kemik iletiminde düşme) ve stapes refleksi negatif saptanıyor. En olası tanı ve cerrahi seçenek hangisidir?",
    secenekler: {
      A: "Otoskleroz - Stapedotomi",
      B: "Kronik Otitis Media - Timpanoplasti",
      C: "Kolesteatom - Kanal Duvarı İndirilen Mastoidektomi",
      D: "Glomus Timpanikum - Transkanal Eksizyon",
      E: "Meniere Hastalığı - Endolenfatik Kese Dekompresyonu"
    },
    dogruCevap: "A",
    aciklama: "Genç erişkinde normal timpanik membran ile progresif iletim tipi kayıp, negatif stapes refleksi ve odyogramda 2000 Hz'deki Carhart çentiği otosklerozun patognomonik bulgularıdır. Tedavisi stapedotomidir.",
    topic: "Otoskleroz",
    category: "Otoloji & Nörootoloji"
  },
  {
    soru: "58 yaşında 35 paket/yıl sigara içicisi erkek hasta, 2 aydır geçmeyen ses kısıklığı şikayetiyle başvuruyor. Fleksibl laringoskopide sol vokal kord orta 1/3'ünde ülserovejetan lezyon saptanıyor, kord mobilitesi korunmuş (T1a). Boyunda palpabl lenfadenopati yok. Bu hasta için en uygun küratif tedavi yaklaşımı hangisidir?",
    secenekler: {
      A: "Transoral Lazer Mikrocerrahi (TLM) veya Radyoterapi",
      B: "Total Larenjektomi ve Bilateral Boyun Disseksiyonu",
      C: "Yalnızca Kemoterapi",
      D: "Sistemik İmmünoterapi ve gözlem",
      E: "Trakeotomi ve palyatif bakım"
    },
    dogruCevap: "A",
    aciklama: "Erken evre glottik larenks kanserlerinde (T1aN0M0) transoral lazer kordektomi veya küratif radyoterapi benzer lokal kontrol ve sağkalım (%90-95) başarısına sahiptir; ses kalitesi ve morbidite göz önüne alınarak hasta ile seçilir.",
    topic: "Larenks Kanserleri",
    category: "Baş ve Boyun Cerrahisi"
  },
  {
    soru: "4 yaşında erkek çocuk, uykuda horlama, ağız açık uyuma ve apne atakları şikayetiyle getiriliyor. Fizik muayenede grade 3 adenoid vejeatasyon ve bilateral tonsil hipertrofisi izleniyor. Bu olguda cerrahi endikasyon olan obstrüktif uyku apnesi için en güvenilir tanı altın standardı hangisidir?",
    secenekler: {
      A: "Gece Polisomnografisi (PSG)",
      B: "Lateral sefalometrik grafi",
      C: "Rutin adenoid biyopsisi",
      D: "Alerji deri prick testi",
      E: "Nazal hava akımı manometrisi"
    },
    dogruCevap: "A",
    aciklama: "Pediatrik obstrüktif uyku apnesinde ve adenotonsiller hipertrofinin solunumsal ciddiyetini değerlendirmede altın standart yöntem gece polisomnografisidir (PSG).",
    topic: "Adenotonsiller Hastalıklar",
    category: "Pediatrik KBB"
  },
  {
    soru: "Rinoplasti ameliyatında 'Keystone bölgesi' anatomik olarak hangi yapıların birleşim noktasını ifade eder?",
    secenekler: {
      A: "Nazal kemikler ile üst lateral kıkırdaklar ve dorsal kuadrangular kıkırdak kavşağı",
      B: "Alt lateral kıkırdakların medial krusları ile kolumella kavşağı",
      C: "Perpendiküler lamina ile vomer ve kıkırdak septum bileşkesi",
      D: "Nazal kemiklerin frontal çıkıntı ile olan dikiş hattı",
      E: "Spina nazalis anterior ile kaudal septum kavşağı"
    },
    dogruCevap: "A",
    aciklama: "Keystone alanı; nazal kemiklerin kaudal kenarı ile üst lateral kartilajların sefalik kenarı ve dorsal septumun birleştiği kilit anatomik bölgedir. Buradaki aşırı rezeksiyon açık çatı ve eyer burun deformitesine yol açar.",
    topic: "Rinoplasti (Estetik ve Fonksiyonel)",
    category: "Fasiyal Plastik ve Maksillofasiyal Travma"
  }
];

/**
 * Resolves or repairs the appropriate Board category for a given topic or existing category
 */
export function resolveCategoryForTopic(topic?: string, existingCategory?: string): string {
  const cleanCat = (existingCategory || '').trim();
  const cleanTopic = (topic || '').trim().toLowerCase();

  // If already a valid canonical category (and not the generic placeholder 'Genel KBB')
  if (cleanCat && cleanCat !== 'Genel KBB' && cleanCat !== 'Diğer Konular') {
    const canonical = TOPICS.find(t => t.category.toLowerCase() === cleanCat.toLowerCase());
    if (canonical) {
      return canonical.category;
    }
  }

  if (!cleanTopic) {
    return cleanCat && cleanCat !== 'Genel KBB' ? cleanCat : 'Genel KBB ve Aciller';
  }

  // 1. Exact match with TOPICS definition
  const exact = TOPICS.find(t => t.name.toLowerCase().trim() === cleanTopic);
  if (exact) return exact.category;

  // 2. Substring match with TOPICS definition
  const sub = TOPICS.find(t => cleanTopic.includes(t.name.toLowerCase().trim()) || t.name.toLowerCase().trim().includes(cleanTopic));
  if (sub) return sub.category;

  // 3. High-yield Medical Domain keyword matching for Turkish ENT (KBB) Board Topics
  // Rinoloji
  if (/(burun|sinüs|sinus|rinit|rhinit|koku|septum|polip|epistaksis|rino|choan|koana|etmoid|sfenoid|maksiller|antrum|frontal|kribriform|papirasea|rinore|turbinat|konka|alerjik|rinokonjonktivit|nazal)/i.test(cleanTopic)) {
    return 'Rinoloji';
  }

  // Otoloji & Nörootoloji
  if (/(kulak|otit|otitis|oto|mastoid|timpan|ossikül|ossikul|stapes|malleus|inkus|carhart|kolesteatom|odyo|işitme|isitme|kohlea|koklea|vestibül|vestibul|vertigo|bppv|meniere|fasial|fasiyal|nistagmus|schwannom|labirent|akustik|aurikula|timpanoplasti|stapedotomi|endolenfatik)/i.test(cleanTopic)) {
    return 'Otoloji & Nörootoloji';
  }

  // Baş ve Boyun Cerrahisi
  if (/(larenks|larynx|glottik|vokal|kord|ses|kordektomi|boyun|servikal|lenf|tiroid|paratiroid|tükürük|tukuruk|salivary|parotis|submandibuler|sublingual|karsinom|skuamöz|skuamoz|laringektomi|disseksiyon)/i.test(cleanTopic)) {
    return 'Baş ve Boyun Cerrahisi';
  }

  // Pediatrik KBB
  if (/(pediatrik|çocuk|cocuk|adenoid|geniz eti|tonsil|bademcik|tonsillit|laringomalazi|trakeomalazi|stridor|krup|tiroglossal|brankiyal)/i.test(cleanTopic)) {
    return 'Pediatrik KBB';
  }

  // Fasiyal Plastik ve Maksillofasiyal Travma
  if (/(rinoplasti|flep|greft|maksillofasiyal|mandibula|maksilla|le fort|zigoma|blowout|travma|otoplasti|dudak damak|mikrotia|blefaroplasti|estetik|rekonstrüksiyon)/i.test(cleanTopic)) {
    return 'Fasiyal Plastik ve Maksillofasiyal Travma';
  }

  // Uyku Tıbbı
  if (/(uyku|apne|osas|ahı|ahi|horlama|polisomnografi|psg|cpap|uppp|uvulopalatofaringoplasti)/i.test(cleanTopic)) {
    return 'Uyku Tıbbı';
  }

  // Oral Kavite, Farenks ve Özofagus
  if (/(oral|ağız|agiz|dil|lingua|uvula|damak|farenks|farinks|orofarenks|hipofarenks|yutma|disfaji|özofagus|ozofagus|zenker|retrofarengeal|parafarengeal)/i.test(cleanTopic)) {
    return 'Oral Kavite, Farenks ve Özofagus';
  }

  // Genel KBB ve Aciller
  if (/(acil|anafilaksi|trakeotomi|entübasyon|yabancı cisim|yabanci cisim|hematom)/i.test(cleanTopic)) {
    return 'Genel KBB ve Aciller';
  }

  return 'Genel KBB ve Aciller';
}

/**
 * Normalizes question topic and category
 */
export function normalizeQuestion(q: Question): Question {
  const cleanTopic = (q.topic || '').trim() || 'Genel';
  const finalCategory = resolveCategoryForTopic(cleanTopic, q.category);
  return {
    ...q,
    topic: cleanTopic,
    category: finalCategory,
  };
}

export function getQuestions(): Question[] {
  try {
    const data = localStorage.getItem(DB_KEY);
    if (!data) {
      // Seed with initial questions if bank is empty
      localStorage.setItem(DB_KEY, JSON.stringify(SEED_QUESTIONS));
      return SEED_QUESTIONS;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Auto-heal / Auto-migrate questions that have 'Genel KBB' or unmapped categories
      let changed = false;
      const normalized = parsed.map(q => {
        const norm = normalizeQuestion(q);
        if (norm.category !== q.category || norm.topic !== q.topic) {
          changed = true;
        }
        return norm;
      });

      if (changed) {
        localStorage.setItem(DB_KEY, JSON.stringify(normalized));
      }
      return normalized;
    }
    return SEED_QUESTIONS;
  } catch {
    return SEED_QUESTIONS;
  }
}

export function getSolvedQuestions(): string[] {
  try {
    const data = localStorage.getItem(SOLVED_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function resetSolvedQuestions() {
  localStorage.removeItem(SOLVED_KEY);
}

export function markQuestionsAsSolved(questions: string[]) {
  const existing = new Set(getSolvedQuestions());
  questions.forEach(q => existing.add(q.trim()));
  localStorage.setItem(SOLVED_KEY, JSON.stringify(Array.from(existing)));
}

export function saveQuestions(newQuestions: Question[]): number {
  const existing = getQuestions();
  const normalizedNew = newQuestions.map(normalizeQuestion);
  const existingTexts = new Set(existing.map(q => q.soru.trim()));
  const uniqueNew = normalizedNew.filter(q => !existingTexts.has(q.soru.trim()));
  const updated = [...existing, ...uniqueNew];
  localStorage.setItem(DB_KEY, JSON.stringify(updated));
  return updated.length;
}

export function addSingleQuestion(question: Question): number {
  const existing = getQuestions();
  const normQ = normalizeQuestion(question);
  // Add to beginning of array so newest questions appear first
  const updated = [normQ, ...existing.filter(q => q.soru.trim() !== normQ.soru.trim())];
  localStorage.setItem(DB_KEY, JSON.stringify(updated));
  return updated.length;
}

export function replaceQuestions(newQuestions: Question[]): number {
  const normalizedNew = newQuestions.map(normalizeQuestion);
  localStorage.setItem(DB_KEY, JSON.stringify(normalizedNew));
  return normalizedNew.length;
}

export function deleteQuestionByIndex(index: number): Question[] {
  const existing = getQuestions();
  if (index >= 0 && index < existing.length) {
    existing.splice(index, 1);
    localStorage.setItem(DB_KEY, JSON.stringify(existing));
  }
  return existing;
}

export function clearQuestions() {
  localStorage.removeItem(DB_KEY);
}

export function getRandomQuestions(count: number, topicNames?: string[], includeSolved: boolean = true): Question[] {
  let pool = getQuestions();
  
  if (topicNames && topicNames.length > 0) {
    const lowerTopics = topicNames.map(t => t.toLowerCase().trim());
    pool = pool.filter(q => {
      const qTopic = (q.topic || '').toLowerCase().trim();
      const qCat = (q.category || '').toLowerCase().trim();
      return lowerTopics.includes(qTopic) || lowerTopics.includes(qCat);
    });
  }

  if (!includeSolved) {
    const solved = new Set(getSolvedQuestions().map(s => s.toLowerCase().trim()));
    pool = pool.filter(q => !solved.has(q.soru.toLowerCase().trim()));
  }

  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

export interface CategorySummary {
  category: string;
  totalQuestions: number;
  solvedQuestions: number;
  topics: {
    name: string;
    total: number;
    solved: number;
  }[];
}

/**
 * Computes live category and topic statistics based on all questions and solved questions
 */
export function getCategoryAndTopicStats(allQuestions: Question[], solvedQuestionsList: string[]): CategorySummary[] {
  const solvedSet = new Set(solvedQuestionsList.map(s => s.toLowerCase().trim()));
  const categoryMap = new Map<string, { total: number; solved: number; topicMap: Map<string, { total: number; solved: number }> }>();

  // Initialize with canonical categories in official order
  const canonicalCategories = [
    'Rinoloji',
    'Otoloji & Nörootoloji',
    'Baş ve Boyun Cerrahisi',
    'Pediatrik KBB',
    'Fasiyal Plastik ve Maksillofasiyal Travma',
    'Uyku Tıbbı',
    'Oral Kavite, Farenks ve Özofagus',
    'Genel KBB ve Aciller',
  ];

  canonicalCategories.forEach(cat => {
    categoryMap.set(cat, { total: 0, solved: 0, topicMap: new Map() });
  });

  // Also pre-seed standard topics into each canonical category
  TOPICS.forEach(t => {
    if (!categoryMap.has(t.category)) {
      categoryMap.set(t.category, { total: 0, solved: 0, topicMap: new Map() });
    }
    const catData = categoryMap.get(t.category)!;
    if (!catData.topicMap.has(t.name)) {
      catData.topicMap.set(t.name, { total: 0, solved: 0 });
    }
  });

  // Tally actual questions
  allQuestions.forEach(q => {
    const topic = (q.topic || 'Genel').trim();
    const cat = resolveCategoryForTopic(topic, q.category);

    if (!categoryMap.has(cat)) {
      categoryMap.set(cat, { total: 0, solved: 0, topicMap: new Map() });
    }
    const catData = categoryMap.get(cat)!;
    catData.total++;

    if (!catData.topicMap.has(topic)) {
      catData.topicMap.set(topic, { total: 0, solved: 0 });
    }
    const topicData = catData.topicMap.get(topic)!;
    topicData.total++;

    const isSolved = solvedSet.has(q.soru.toLowerCase().trim());
    if (isSolved) {
      catData.solved++;
      topicData.solved++;
    }
  });

  const summaries: CategorySummary[] = [];
  categoryMap.forEach((data, category) => {
    const topicsArr: { name: string; total: number; solved: number }[] = [];
    data.topicMap.forEach((tData, tName) => {
      // If category has questions, prioritize topics with questions (total > 0)
      if (data.total === 0 || tData.total > 0) {
        topicsArr.push({
          name: tName,
          total: tData.total,
          solved: tData.solved,
        });
      }
    });

    // Sort topics: ones with questions first, then descending total, then alphabetical
    topicsArr.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'tr'));

    summaries.push({
      category,
      totalQuestions: data.total,
      solvedQuestions: data.solved,
      topics: topicsArr,
    });
  });

  // Sort categories: categories with questions first, followed by canonical order
  return summaries.sort((a, b) => {
    if (b.totalQuestions !== a.totalQuestions) {
      return b.totalQuestions - a.totalQuestions;
    }
    const aIdx = canonicalCategories.indexOf(a.category);
    const bIdx = canonicalCategories.indexOf(b.category);
    return (aIdx !== -1 ? aIdx : 99) - (bIdx !== -1 ? bIdx : 99);
  });
}
