import { Question, SheetSyncConfig } from '../types';
import { TOPICS } from '../constants';
import { resolveCategoryForTopic } from './db';

const SHEET_CONFIG_KEY = 'kbb_sheet_sync_config';

export function getSheetConfig(): SheetSyncConfig {
  try {
    const raw = localStorage.getItem(SHEET_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse sheet config', e);
  }
  return {
    sheetUrl: '',
    autoSync: false,
    lastSyncTime: undefined,
    importedCount: 0,
  };
}

export function saveSheetConfig(config: SheetSyncConfig) {
  try {
    localStorage.setItem(SHEET_CONFIG_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save sheet config', e);
  }
}

/**
 * Extracts Google Spreadsheet ID and GID from any Google Sheets link
 */
export function extractSheetDetails(url: string): { sheetId: string | null; gid: string } {
  if (!url) return { sheetId: null, gid: '0' };
  
  // Format: /spreadsheets/d/{ID}/...
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const sheetId = idMatch ? idMatch[1] : null;

  // Format: gid={GID}
  const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : '0';

  return { sheetId, gid };
}

/**
 * Parses raw CSV/TSV text into records taking into account quoted newlines, escaped quotes, etc.
 */
export function parseCSVRows(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  // Determine delimiter: tab, semicolon or comma
  const firstLine = clean.split('\n')[0] || '';
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.split(';').length > firstLine.split(',').length) delimiter = ';';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"';
        i++; // skip next quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some(cell => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  // Push last cell/row
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(cell => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parses CSV text into Question objects with smart column header matching
 */
export function parseCSVToQuestions(csvText: string): { questions: Question[]; skipped: number; totalRows: number } {
  const rows = parseCSVRows(csvText);
  if (rows.length < 2) {
    return { questions: [], skipped: 0, totalRows: rows.length };
  }

  const headerRow = rows[0].map(h => h.toLowerCase().trim().replace(/['"_\s-]/g, ''));
  
  // Find column indices
  const findCol = (...keywords: string[]): number => {
    return headerRow.findIndex(h => keywords.some(k => h.includes(k.toLowerCase().replace(/['"_\s-]/g, ''))));
  };

  const colCategory = findCol('anakategori', 'kategori', 'category', 'bolum');
  const colTopic = findCol('altkategori', 'konu', 'topic', 'baslik', 'subtopic');
  const colSoru = findCol('soru', 'vaka', 'question', 'sorumetni');
  const colA = findCol('seceneka', 'sıka', 'sika', 'a', 'optiona');
  const colB = findCol('secenekb', 'sıkb', 'sikb', 'b', 'optionb');
  const colC = findCol('secenekc', 'sıkc', 'sikc', 'c', 'optionc');
  const colD = findCol('secenekd', 'sıkd', 'sikd', 'd', 'optiond');
  const colE = findCol('seceneke', 'sıke', 'sike', 'e', 'optione');
  const colAns = findCol('dogrucevap', 'dogrusik', 'cevap', 'answer', 'key', 'correct');
  const colExp = findCol('aciklama', 'cozum', 'explanation', 'kaynak', 'referans', 'not');

  const questions: Question[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every(c => !c)) continue;

    // Soru metni
    let soruMetni = colSoru !== -1 ? row[colSoru] : (row[2] || row[0] || '');
    if (!soruMetni || soruMetni.length < 5) {
      skipped++;
      continue;
    }

    // Seçenekler
    const optA = (colA !== -1 ? row[colA] : row[3]) || '';
    const optB = (colB !== -1 ? row[colB] : row[4]) || '';
    const optC = (colC !== -1 ? row[colC] : row[5]) || '';
    const optD = (colD !== -1 ? row[colD] : row[6]) || '';
    const optE = (colE !== -1 ? row[colE] : row[7]) || '';

    if (!optA || !optB || !optC || !optD || !optE) {
      skipped++;
      continue;
    }

    // Doğru cevap ayıklama
    const rawAns = (colAns !== -1 ? row[colAns] : row[8]) || 'A';
    let cleanAns: 'A' | 'B' | 'C' | 'D' | 'E' = 'A';
    const match = rawAns.toUpperCase().match(/[A-E]/);
    if (match) {
      cleanAns = match[0] as 'A' | 'B' | 'C' | 'D' | 'E';
    }

    // Açıklama
    const aciklama = (colExp !== -1 ? row[colExp] : row[9]) || 'Bu soru için henüz açıklama girilmedi.';

    // Kategori ve Konu
    let category = colCategory !== -1 ? row[colCategory] : (row[0] || '');
    let topic = colTopic !== -1 ? row[colTopic] : (row[1] || '');

    // Kategori ve Konu normalizasyonu
    topic = (topic || category || 'Genel').trim();
    category = resolveCategoryForTopic(topic, category);

    questions.push({
      soru: soruMetni,
      secenekler: {
        A: optA,
        B: optB,
        C: optC,
        D: optD,
        E: optE,
      },
      dogruCevap: cleanAns,
      aciklama,
      topic,
      category,
    });
  }

  return { questions, skipped, totalRows: rows.length - 1 };
}

/**
 * Fetches Google Sheet CSV via server proxy or direct export fallback
 */
export async function fetchSheetContent(sheetUrl: string): Promise<{ questions: Question[]; count: number }> {
  const { sheetId, gid } = extractSheetDetails(sheetUrl);
  if (!sheetId) {
    throw new Error('Geçerli bir Google E-Tablo bağlantısı (URL) bulunamadı. Lütfen URL formatını kontrol edin.');
  }

  let csvData = '';

  // 1. Try server proxy endpoint
  try {
    const proxyRes = await fetch(`/api/sheets/fetch?url=${encodeURIComponent(sheetUrl)}`);
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json.csv) {
        csvData = json.csv;
      }
    }
  } catch (err) {
    console.warn('Proxy fetch failed, attempting fallback...', err);
  }

  // 2. Direct fallback
  if (!csvData) {
    const directUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
    const directRes = await fetch(directUrl);
    if (!directRes.ok) {
      throw new Error(`E-Tablo verisi alınamadı (${directRes.status}). Lütfen tablonun paylaşım ayarını 'Bağlantıya sahip olan herkes görüntüleyebilir' olarak ayarladığınızdan emin olun.`);
    }
    csvData = await directRes.text();
  }

  const { questions, skipped, totalRows } = parseCSVToQuestions(csvData);
  if (questions.length === 0) {
    throw new Error(`E-Tabloda geçerli soru satırı bulunamadı (${totalRows} satır okundu, ${skipped} satır atlandı). Lütfen sütun başlıklarını kontrol edin.`);
  }

  // Update sync config
  const currentConfig = getSheetConfig();
  saveSheetConfig({
    ...currentConfig,
    sheetUrl,
    lastSyncTime: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    importedCount: questions.length,
  });

  return { questions, count: questions.length };
}

/**
 * Exports questions as Tab-Separated Values (TSV) for single-action paste into Google Sheets
 */
export function exportQuestionsToTSV(questions: Question[]): string {
  const headers = ['Ana Kategori', 'Alt Kategori', 'Soru', 'A', 'B', 'C', 'D', 'E', 'Doğru Cevap', 'Açıklama'];
  const rows = questions.map(q => {
    const clean = (str?: string) => (str || '').replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ').trim();
    return [
      clean(q.category || 'Genel KBB'),
      clean(q.topic || 'Genel'),
      clean(q.soru),
      clean(q.secenekler.A),
      clean(q.secenekler.B),
      clean(q.secenekler.C),
      clean(q.secenekler.D),
      clean(q.secenekler.E),
      q.dogruCevap,
      clean(q.aciklama),
    ].join('\t');
  });

  return [headers.join('\t'), ...rows].join('\n');
}

/**
 * Single question to single TSV line ready to append to a sheet
 */
export function singleQuestionToTSVLine(q: Question): string {
  const clean = (str?: string) => (str || '').replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ').trim();
  return [
    clean(q.category || 'Genel KBB'),
    clean(q.topic || 'Genel'),
    clean(q.soru),
    clean(q.secenekler.A),
    clean(q.secenekler.B),
    clean(q.secenekler.C),
    clean(q.secenekler.D),
    clean(q.secenekler.E),
    q.dogruCevap,
    clean(q.aciklama),
  ].join('\t');
}

/**
 * Example template header and 2 sample rows for instant user copy
 */
export function getTemplateTSV(): string {
  return [
    'Ana Kategori\tAlt Kategori\tSoru\tA\tB\tC\tD\tE\tDoğru Cevap\tAçıklama',
    'Rinoloji\tBurun Kanaması\tÖn epistaksis olgularında en sık kanama kaynağı olan vasküler pleksus hangisidir?\tKiesselbach (Little alanı)\tWoodruff pleksusu\tRetrokolumellar ven\tSfenopalatin foramen\tAnterior etmoidal pleksus\tA\tBurun ön kanamalarının %90\'ı septum ön-alt kısmındaki Kiesselbach pleksusundan kaynaklanır.',
    'Otoloji & Nörootoloji\tOtoskleroz\tOtoskleroz cerrahisi (stapedotomi) sonrasında ani işitme kaybı ve baş dönmesi gelişen hastada en olası komplikasyon nedir?\tPerilenf fistülü\tMeniere atağı\tFasiyal paralizi\tTimpanik membran perforasyonu\tİletim tipi kayıp artışı\tA\tStapes cerrahisi sonrası ani derin SNİK ve vertigo, oval pencere contasının açılması sonucu perilenf fistülünü düşündürür.'
  ].join('\n');
}
