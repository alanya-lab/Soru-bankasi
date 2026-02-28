import { Question } from '../types';

const DB_KEY = 'kbb_question_bank';

export function getQuestions(): Question[] {
  try {
    const data = localStorage.getItem(DB_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveQuestions(newQuestions: Question[]): number {
  const existing = getQuestions();
  const existingTexts = new Set(existing.map(q => q.soru.trim()));
  const uniqueNew = newQuestions.filter(q => !existingTexts.has(q.soru.trim()));
  const updated = [...existing, ...uniqueNew];
  localStorage.setItem(DB_KEY, JSON.stringify(updated));
  return updated.length;
}

export function clearQuestions() {
  localStorage.removeItem(DB_KEY);
}

export function getRandomQuestions(count: number, topicNames?: string[]): Question[] {
  let pool = getQuestions();
  if (topicNames && topicNames.length > 0) {
    pool = pool.filter(q => q.topic && topicNames.includes(q.topic));
  }
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
