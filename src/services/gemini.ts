import { GoogleGenAI, Type } from '@google/genai';
import { Question } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateExamQuestions(
  topicDistribution: {name: string, count: number}[],
  onProgress?: (loaded: number, total: number) => void
): Promise<Question[]> {
  // Flatten the distribution into an array of individual topic requests
  let allRequests: string[] = [];
  for (const t of topicDistribution) {
    for (let i = 0; i < t.count; i++) {
      allRequests.push(t.name);
    }
  }

  // Chunk requests into batches of max 15 questions to avoid timeouts and token limits
  const BATCH_SIZE = 15;
  const chunks: string[][] = [];
  for (let i = 0; i < allRequests.length; i += BATCH_SIZE) {
    chunks.push(allRequests.slice(i, i + BATCH_SIZE));
  }

  let allQuestions: Question[] = [];
  let loaded = 0;

  const focusAreas = [
    "nadir görülen cerrahi komplikasyonlar",
    "en güncel (2023-2024) tedavi kılavuzları",
    "pediatrik ve geriatrik atipik vakalar",
    "radyolojik (BT/MR) ve endoskopik bulgular",
    "cerrahi anatomi varyasyonları",
    "farmakolojik yan etkiler ve ilaç etkileşimleri",
    "sendromik hastalıklar ve genetik geçişler",
    "histopatolojik inceleme sonuçları",
    "spesifik sendromlar (ör: Kartagener, Samter, vb.)",
    "farklı cerrahi yaklaşımlar (FESS, Caldwell-Luc vb.)"
  ];

  for (const chunk of chunks) {
    const chunkDist: Record<string, number> = {};
    for (const topic of chunk) {
      chunkDist[topic] = (chunkDist[topic] || 0) + 1;
    }
    const distributionText = Object.entries(chunkDist).map(([name, count]) => `- ${name}: ${count} soru`).join('\n');
    
    // Pick 2 random focus areas for this batch to force variety
    const shuffledFocus = [...focusAreas].sort(() => 0.5 - Math.random()).slice(0, 2);

    const prompt = `Lütfen KBB Asistanları ve Uzmanları için Board (Yeterlilik) Sınavı zorluğunda, klinik senaryo veya ileri düzey teorik bilgi içeren toplam ${chunk.length} adet çoktan seçmeli soru hazırla. 
Soruların konulara göre dağılımı tam olarak şu şekilde olmalıdır:
${distributionText}

ÖNEMLİ ÇEŞİTLİLİK KURALI: Önceki ürettiğin klasik soruları KESİNLİKLE TEKRAR ETME! Yepyeni, farklı ve spesifik sorular üret.
Bu partide özellikle şu alanlara odaklan: ${shuffledFocus.join(" ve ")}.
Soruları kurgularken farklı hasta yaşları (örneğin 4 yaşında çocuk, 72 yaşında diyabetik amca), farklı semptom kombinasyonları ve spesifik laboratuvar/görüntüleme bulguları kullan. İnternetteki güncel KBB makalelerinden ve vaka sunumlarından ilham al.`;
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', // Switched to flash for higher rate limits
        contents: prompt,
        config: {
          temperature: 0.9, // Higher temperature for more variety
          tools: [{ googleSearch: {} }], // Enable Google Search for real-world grounding
          systemInstruction: `Sen KBB (Kulak Burun Boğaz) Board / Yeterlilik sınavı hazırlayan uzman bir profesörsün. Sana verilen konu dağılımına göre çoktan seçmeli sorular üreteceksin.
Kurallar:
1. Sorular TUS seviyesinde DEĞİL, KBB asistanları ve uzmanlarına yönelik çok zor, detaylı ve klinik senaryo ağırlıklı (Board seviyesi) olmalıdır.
2. Her soru KESİNLİKLE 5 seçenekli (A, B, C, D, E) olmalıdır.
3. Seçenekler birbirine çok yakın, çeldiricisi son derece yüksek olmalıdır.
4. Sadece güncel literatüre ve uluslararası kılavuzlara dayan.
5. Çıktıyı SADECE aşağıdaki JSON formatında ver, metin veya yorum ekleme:
[
  {
    "topic": "Sorunun ait olduğu konu başlığı",
    "soru": "Soru metni buraya",
    "secenekler": {
      "A": "1. seçenek",
      "B": "2. seçenek",
      "C": "3. seçenek",
      "D": "4. seçenek",
      "E": "5. seçenek"
    },
    "dogruCevap": "A",
    "aciklama": "Doğru cevabın metinle eşleşen kısa açıklaması"
  }
]`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                topic: { type: Type.STRING },
                soru: { type: Type.STRING },
                secenekler: {
                  type: Type.OBJECT,
                  properties: {
                    A: { type: Type.STRING },
                    B: { type: Type.STRING },
                    C: { type: Type.STRING },
                    D: { type: Type.STRING },
                    E: { type: Type.STRING },
                  },
                  required: ["A", "B", "C", "D", "E"]
                },
                dogruCevap: { type: Type.STRING },
                aciklama: { type: Type.STRING },
              },
              required: ["topic", "soru", "secenekler", "dogruCevap", "aciklama"]
            }
          }
        }
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        allQuestions = allQuestions.concat(parsed);
      }
    } catch (e) {
      console.error("Chunk error:", e);
      // Continue even if one chunk fails, to return at least some questions
    }
    
    loaded += chunk.length;
    if (onProgress) {
      onProgress(loaded, allRequests.length);
    }
  }

  if (allQuestions.length === 0) {
    throw new Error("Sorular oluşturulamadı. Lütfen tekrar deneyin.");
  }

  return allQuestions;
}
