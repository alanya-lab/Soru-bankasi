import { Question, SheetSyncConfig } from '../types';
import { TOPICS } from '../constants';
import { resolveCategoryForTopic, markQuestionsAsSynced } from './db';

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
    webhookUrl: '',
    autoSync: false,
    lastSyncTime: undefined,
    lastAppendTime: undefined,
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
/**
 * Cleans and normalizes header strings by removing Turkish diacritics, symbols, and whitespace
 */
function normalizeHeaderName(h: string): string {
  return (h || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/[çÇ]/g, 'c')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[ıIİi]/g, 'i')
    .replace(/[öÖ]/g, 'o')
    .replace(/[şŞ]/g, 's')
    .replace(/[üÜ]/g, 'u')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if a normalized header exactly matches an option letter (A, B, C, D, E)
 * Prevents catastrophic false-positives where words like "kategori" or "aciklama" match 'a' or 'e'
 */
function isOptionHeaderMatch(normalizedHeader: string, letter: 'a' | 'b' | 'c' | 'd' | 'e'): boolean {
  return (
    normalizedHeader === letter ||
    normalizedHeader === `sik${letter}` ||
    normalizedHeader === `secenek${letter}` ||
    normalizedHeader === `option${letter}` ||
    normalizedHeader === `opt${letter}` ||
    normalizedHeader === `choice${letter}` ||
    normalizedHeader === `${letter}sikki` ||
    normalizedHeader === `${letter}secenegi`
  );
}

/**
 * Parses CSV text into Question objects with smart column header matching
 */
export function parseCSVToQuestions(csvText: string): { questions: Question[]; skipped: number; totalRows: number } {
  const rows = parseCSVRows(csvText);
  if (rows.length < 2) {
    return { questions: [], skipped: 0, totalRows: rows.length };
  }

  const rawHeaders = rows[0];
  const headerRow = rawHeaders.map(normalizeHeaderName);
  const columnCount = rawHeaders.length;

  // 1. Match Options A, B, C, D, E with STRICT exact matching (NEVER substring include!)
  let colA = headerRow.findIndex(h => isOptionHeaderMatch(h, 'a'));
  let colB = headerRow.findIndex(h => isOptionHeaderMatch(h, 'b'));
  let colC = headerRow.findIndex(h => isOptionHeaderMatch(h, 'c'));
  let colD = headerRow.findIndex(h => isOptionHeaderMatch(h, 'd'));
  let colE = headerRow.findIndex(h => isOptionHeaderMatch(h, 'e'));

  // 2. Match Category (Must NOT be subcategory / altkategori)
  let colCategory = headerRow.findIndex(h => 
    !h.includes('alt') && !h.includes('sub') && 
    (h === 'anakategori' || h === 'kategori' || h === 'category' || h === 'bolum' || h === 'maincategory' || h === 'brans' || h.includes('kategori'))
  );

  // 3. Match Topic / Subcategory
  let colTopic = headerRow.findIndex(h => 
    h === 'altkategori' || h === 'konu' || h === 'topic' || h === 'altbaslik' || h === 'baslik' || 
    h === 'subtopic' || h.includes('altkategori') || h.includes('subtopic') || h.includes('konu')
  );

  // 4. Match Question stem
  let colSoru = headerRow.findIndex(h => 
    h === 'soru' || h === 'sorumetni' || h === 'question' || h === 'stem' || h === 'vaka' || 
    h === 'klinikvaka' || h.includes('soru') || h.includes('question')
  );

  // 5. Match Correct Answer
  let colAns = headerRow.findIndex(h => 
    h === 'dogrucevap' || h === 'dogrusik' || h === 'cevap' || h === 'yanit' || h === 'answer' || 
    h === 'correct' || h === 'key' || h.includes('dogrucevap') || h.includes('cevap') || h.includes('yanit') || h.includes('answer')
  );

  // 6. Match Explanation
  let colExp = headerRow.findIndex(h => 
    h === 'aciklama' || h === 'cozum' || h === 'explanation' || h === 'kaynak' || h === 'referans' || 
    h === 'not' || h === 'rationale' || h.includes('aciklama') || h.includes('cozum') || h.includes('explanation')
  );

  // Positional fallbacks if headers couldn't be detected
  if (colA === -1 || colB === -1 || colC === -1 || colD === -1 || colE === -1) {
    if (columnCount >= 10) {
      // Standard 10 columns: Ana Kategori, Alt Kategori, Soru, A, B, C, D, E, Doğru Cevap, Açıklama
      if (colCategory === -1) colCategory = 0;
      if (colTopic === -1) colTopic = 1;
      if (colSoru === -1) colSoru = 2;
      colA = 3; colB = 4; colC = 5; colD = 6; colE = 7;
      if (colAns === -1) colAns = 8;
      if (colExp === -1) colExp = 9;
    } else if (columnCount === 9) {
      // 9 columns: Konu/Topic, Soru, A, B, C, D, E, Doğru Cevap, Açıklama
      if (colTopic === -1) colTopic = 0;
      if (colSoru === -1) colSoru = 1;
      colA = 2; colB = 3; colC = 4; colD = 5; colE = 6;
      if (colAns === -1) colAns = 7;
      if (colExp === -1) colExp = 8;
    } else if (columnCount === 8) {
      // 8 columns: Soru, A, B, C, D, E, Doğru Cevap, Açıklama
      if (colSoru === -1) colSoru = 0;
      colA = 1; colB = 2; colC = 3; colD = 4; colE = 5;
      if (colAns === -1) colAns = 6;
      if (colExp === -1) colExp = 7;
    }
  }

  const questions: Question[] = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length === 0 || row.every(c => !c)) continue;

    // Soru metni
    let soruMetni = (colSoru !== -1 && row[colSoru]) ? row[colSoru] : (row[2] || row[0] || '');
    if (!soruMetni || soruMetni.length < 5) {
      skipped++;
      continue;
    }

    // Seçenekler (A - E)
    const optA = (colA !== -1 ? row[colA] : '') || '';
    const optB = (colB !== -1 ? row[colB] : '') || '';
    const optC = (colC !== -1 ? row[colC] : '') || '';
    const optD = (colD !== -1 ? row[colD] : '') || '';
    const optE = (colE !== -1 ? row[colE] : '') || '';

    if (!optA || !optB || !optC || !optD || !optE) {
      skipped++;
      continue;
    }

    // Doğru cevap ayıklama
    const rawAns = (colAns !== -1 && row[colAns]) ? row[colAns] : 'A';
    let cleanAns: 'A' | 'B' | 'C' | 'D' | 'E' = 'A';
    const match = rawAns.toUpperCase().match(/[A-E]/);
    if (match) {
      cleanAns = match[0] as 'A' | 'B' | 'C' | 'D' | 'E';
    }

    // Açıklama
    const aciklama = (colExp !== -1 && row[colExp]) ? row[colExp] : 'Bu soru için henüz açıklama girilmedi.';

    // Kategori ve Konu
    let category = (colCategory !== -1 && row[colCategory]) ? row[colCategory] : '';
    let topic = (colTopic !== -1 && row[colTopic]) ? row[colTopic] : '';

    // If only one was provided, determine appropriate topic & category
    topic = (topic || category || 'Genel').trim();
    category = resolveCategoryForTopic(topic, category);

    questions.push({
      soru: soruMetni.trim(),
      secenekler: {
        A: optA.trim(),
        B: optB.trim(),
        C: optC.trim(),
        D: optD.trim(),
        E: optE.trim(),
      },
      dogruCevap: cleanAns,
      aciklama: aciklama.trim(),
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

  // Register all imported questions as synced with sheet
  markQuestionsAsSynced(questions);

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
 * Converts a Question object to a 10-element array matching Google Sheet columns
 */
export function questionToRowArray(q: Question): string[] {
  const clean = (str?: string) => (str || '').replace(/\t/g, ' ').replace(/[\r\n]+/g, ' ').trim();
  return [
    clean(q.category || 'Genel KBB ve Aciller'),
    clean(q.topic || 'Genel'),
    clean(q.soru),
    clean(q.secenekler.A),
    clean(q.secenekler.B),
    clean(q.secenekler.C),
    clean(q.secenekler.D),
    clean(q.secenekler.E),
    q.dogruCevap,
    clean(q.aciklama || 'Açıklama girilmedi.'),
  ];
}

/**
 * Exports questions as Tab-Separated Values (TSV) for single-action paste into Google Sheets.
 * If includeHeaders is false, produces raw rows suitable for pasting right below existing rows!
 */
export function exportQuestionsToTSV(questions: Question[], includeHeaders: boolean = true): string {
  const headers = ['Ana Kategori', 'Alt Kategori', 'Soru', 'A', 'B', 'C', 'D', 'E', 'Doğru Cevap', 'Açıklama'];
  const rows = questions.map(q => questionToRowArray(q).join('\t'));

  if (includeHeaders) {
    return [headers.join('\t'), ...rows].join('\n');
  }
  return rows.join('\n');
}

/**
 * Single question to single TSV line ready to append to a sheet
 */
export function singleQuestionToTSVLine(q: Question): string {
  return questionToRowArray(q).join('\t');
}

/**
 * Appends an array of questions directly to the user's Google Sheet via their Apps Script Webhook
 */
export async function appendQuestionsToGoogleSheet(
  webhookUrl: string, 
  questions: Question[]
): Promise<{ ok: boolean; message: string; count: number }> {
  if (!webhookUrl || !webhookUrl.trim()) {
    throw new Error('Google Apps Script Webhook URL adresi tanımlı değil.');
  }

  if (questions.length === 0) {
    return { ok: true, message: 'Eklenecek yeni soru bulunamadı.', count: 0 };
  }

  const rows = questions.map(questionToRowArray);

  const response = await fetch('/api/sheets/append', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookUrl: webhookUrl.trim(),
      rowData: {
        action: 'append',
        rows,
      },
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `E-Tabloya satır eklenirken hata oluştu (${response.status})`);
  }

  const result = await response.json();
  if (result.ok === false) {
    throw new Error(result.error || 'Google E-Tablo scriptinden hata yanıtı alındı.');
  }

  // Mark appended questions as synced locally
  markQuestionsAsSynced(questions);

  // Update sync config
  const currentConfig = getSheetConfig();
  const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  saveSheetConfig({
    ...currentConfig,
    lastAppendTime: now,
  });

  return {
    ok: true,
    message: `${questions.length} soru Google E-Tablonuzun son satırlarının devamına başarıyla eklendi!`,
    count: questions.length,
  };
}

/**
 * Returns copy-paste ready Google Apps Script code for 1-click Webhook deployment
 */
export function getAppsScriptCodeSnippet(): string {
  return `// Google E-Tablonuzda: Uzantılar (Extensions) -> Apps Script menüsünü açıp
// mevcut içeriği silip bu kodu yapıştırın ve Dağıt (Deploy) -> Yeni Dağıtım -> Web Uygulaması yapın:

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    var rows = data.rows || (Array.isArray(data) ? data : [data]);
    
    // Eğer tablo tamamen boşsa, önce sütun başlıklarını yaz
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Ana Kategori", "Alt Kategori", "Soru", 
        "A", "B", "C", "D", "E", 
        "Doğru Cevap", "Açıklama"
      ]);
    }
    
    if (rows && rows.length > 0) {
      var lastRow = sheet.getLastRow();
      var numCols = rows[0].length;
      var range = sheet.getRange(lastRow + 1, 1, rows.length, numCols);
      range.setValues(rows);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      added: rows ? rows.length : 0,
      newLastRow: sheet.getLastRow()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
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
