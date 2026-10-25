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

export function getQuestions(): Question[] {
  try {
    const data = localStorage.getItem(DB_KEY);
    if (!data) {
      // Seed with initial questions if bank is empty
      localStorage.setItem(DB_KEY, JSON.stringify(SEED_QUESTIONS));
      return SEED_QUESTIONS;
    }
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_QUESTIONS;
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
  const existingTexts = new Set(existing.map(q => q.soru.trim()));
  const uniqueNew = newQuestions.filter(q => !existingTexts.has(q.soru.trim()));
  const updated = [...existing, ...uniqueNew];
  localStorage.setItem(DB_KEY, JSON.stringify(updated));
  return updated.length;
}

export function addSingleQuestion(question: Question): number {
  const existing = getQuestions();
  // Add to beginning of array so newest questions appear first
  const updated = [question, ...existing.filter(q => q.soru.trim() !== question.soru.trim())];
  localStorage.setItem(DB_KEY, JSON.stringify(updated));
  return updated.length;
}

export function replaceQuestions(newQuestions: Question[]): number {
  localStorage.setItem(DB_KEY, JSON.stringify(newQuestions));
  return newQuestions.length;
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

  // Initialize with predefined categories from TOPICS
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
    let cat = q.category;
    let topic = q.topic;

    if (!cat && topic) {
      const found = TOPICS.find(t => t.name.toLowerCase() === topic!.toLowerCase());
      cat = found ? found.category : 'Diğer Konular';
    } else if (!cat) {
      cat = 'Diğer Konular';
    }

    if (!topic) {
      topic = 'Genel';
    }

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
      topicsArr.push({
        name: tName,
        total: tData.total,
        solved: tData.solved,
      });
    });

    // Sort topics: ones with questions first, then alphabetical
    topicsArr.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'tr'));

    summaries.push({
      category,
      totalQuestions: data.total,
      solvedQuestions: data.solved,
      topics: topicsArr,
    });
  });

  // Sort categories: ones with questions first
  return summaries.sort((a, b) => b.totalQuestions - a.totalQuestions);
}
