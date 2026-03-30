import { Topic } from './types';

export const TOPICS: Topic[] = [
  // Rinoloji
  { id: 1, name: 'Burun ve Paranazal Sinüs Anatomisi', weight: 4, category: 'Rinoloji' },
  { id: 2, name: 'Burun ve Paranazal Sinüs Embriyolojisi', weight: 3, category: 'Rinoloji' },
  { id: 3, name: 'Burun ve Paranazal Sinüs Fizyolojisi', weight: 4, category: 'Rinoloji' },
  { id: 4, name: 'Burun ve Paranasal Sinüs Radyolojisi', weight: 5, category: 'Rinoloji' },
  { id: 5, name: 'Koku Anatomisi ve Fizyolojisi', weight: 4, category: 'Rinoloji' },
  { id: 6, name: 'Tat Anatomisi ve Fizyolojisi', weight: 3, category: 'Rinoloji' },
  { id: 7, name: 'Burun ve Paranazal Sinüslerin Konjenital Hastalıkları', weight: 5, category: 'Rinoloji' },
  { id: 8, name: 'Burun Tıkanıklığı', weight: 5, category: 'Rinoloji' },
  { id: 9, name: 'Burun Akıntısı', weight: 5, category: 'Rinoloji' },
  { id: 10, name: 'Burun Kanaması', weight: 5, category: 'Rinoloji' },
  { id: 11, name: 'Kronik Öksürük', weight: 4, category: 'Rinoloji' },
  { id: 12, name: 'Burun ve Paranazal Sinüslerin Yabancı Cisimleri', weight: 3, category: 'Rinoloji' },
  { id: 13, name: 'Burun ve Paranazal Sinüslerin Benign Tümörleri', weight: 5, category: 'Rinoloji' },
  { id: 14, name: 'İmmun Sistem, Doğal ve Kazanılmış İmmunite', weight: 4, category: 'Rinoloji' },
  { id: 15, name: 'Alerjik İnflamasyon', weight: 3, category: 'Rinoloji' },
  { id: 16, name: 'Alerjik Rinit', weight: 5, category: 'Rinoloji' },
  { id: 17, name: 'Alerjik Rinokonjonktivit', weight: 4, category: 'Rinoloji' },
  { id: 18, name: 'Nazal Polip', weight: 5, category: 'Rinoloji' },
  { id: 19, name: 'Nazal Hava Akımı Testleri', weight: 3, category: 'Rinoloji' },
  { id: 20, name: 'Koku Testleri', weight: 3, category: 'Rinoloji' },
  { id: 21, name: 'Septum Deviasyonu', weight: 5, category: 'Rinoloji' },
  { id: 22, name: 'Nonalerjik Rinitler', weight: 5, category: 'Rinoloji' },
  { id: 23, name: 'Rinosinüzitler', weight: 5, category: 'Rinoloji' },
  { id: 24, name: 'Fungal Sinüzit', weight: 6, category: 'Rinoloji' },
  { id: 25, name: 'Granulamazöz Ve Otoimmün Hastalıklar', weight: 5, category: 'Rinoloji' },
  { id: 26, name: 'Nazal Yayma', weight: 2, category: 'Rinoloji' },
  { id: 27, name: 'Nazal Provokasyon Testleri', weight: 3, category: 'Rinoloji' },
  { id: 28, name: 'Nazal Sitoloji', weight: 2, category: 'Rinoloji' },
  { id: 29, name: 'Alerjen Spesifik İmmünoterapi', weight: 3, category: 'Rinoloji' },
  { id: 30, name: 'Lakrimal Sistem Anatomisi, Fizyolojisi Ve Drenaj Hastalıkları', weight: 3, category: 'Rinoloji' },
  { id: 31, name: 'Burun ve Paranazal Sinüslerin Malign Tümörleri', weight: 6, category: 'Rinoloji' },
  { id: 32, name: 'Beyin Omurilik Sıvısı Rinoresi', weight: 3, category: 'Rinoloji' },

  // Otoloji & Nörootoloji
  { id: 33, name: 'Dış Kulak Yolu Hastalıkları', weight: 4, category: 'Otoloji & Nörootoloji' },
  { id: 34, name: 'Akut ve Kronik Otitis Media', weight: 6, category: 'Otoloji & Nörootoloji' },
  { id: 35, name: 'Otoskleroz', weight: 5, category: 'Otoloji & Nörootoloji' },
  { id: 36, name: 'İşitme Kayıpları ve Odyoloji', weight: 6, category: 'Otoloji & Nörootoloji' },
  { id: 37, name: 'Fasiyal Sinir Hastalıkları', weight: 5, category: 'Otoloji & Nörootoloji' },
  { id: 38, name: 'Periferik Vestibüler Hastalıklar (BPPV, Meniere, vb.)', weight: 6, category: 'Otoloji & Nörootoloji' },
  { id: 39, name: 'Akustik Nöroma ve Serebellopontin Köşe Tümörleri', weight: 5, category: 'Otoloji & Nörootoloji' },

  // Baş ve Boyun Cerrahisi
  { id: 40, name: 'Larenks Anatomisi ve Benign Lezyonları', weight: 4, category: 'Baş ve Boyun Cerrahisi' },
  { id: 41, name: 'Larenks Kanserleri', weight: 6, category: 'Baş ve Boyun Cerrahisi' },
  { id: 42, name: 'Tükürük Bezi Hastalıkları ve Tümörleri', weight: 5, category: 'Baş ve Boyun Cerrahisi' },
  { id: 43, name: 'Boyun Kitleleri ve Ayırıcı Tanısı', weight: 5, category: 'Baş ve Boyun Cerrahisi' },
  { id: 44, name: 'Tiroid ve Paratiroid Cerrahisi', weight: 4, category: 'Baş ve Boyun Cerrahisi' },

  // Pediatrik KBB
  { id: 45, name: 'Adenotonsiller Hastalıklar', weight: 5, category: 'Pediatrik KBB' },
  { id: 46, name: 'Pediatrik Havayolu Problemleri (Laringomalazi vb.)', weight: 5, category: 'Pediatrik KBB' },
  { id: 47, name: 'Konjenital Boyun Kitleleri', weight: 4, category: 'Pediatrik KBB' },

  // Fasiyal Plastik ve Maksillofasiyal Travma
  { id: 48, name: 'Rinoplasti (Estetik ve Fonksiyonel)', weight: 6, category: 'Fasiyal Plastik ve Maksillofasiyal Travma' },
  { id: 49, name: 'Fasiyal Flepler ve Greftler', weight: 5, category: 'Fasiyal Plastik ve Maksillofasiyal Travma' },
  { id: 50, name: 'Maksillofasiyal Travmalar', weight: 6, category: 'Fasiyal Plastik ve Maksillofasiyal Travma' },
  { id: 51, name: 'Otoplasti ve Aurikula Rekonstrüksiyonu', weight: 4, category: 'Fasiyal Plastik ve Maksillofasiyal Travma' },
  { id: 52, name: 'Dudak ve Damak Yarıkları', weight: 4, category: 'Fasiyal Plastik ve Maksillofasiyal Travma' },
  { id: 53, name: 'Yüz Gençleştirme (Cerrahi ve Medikal)', weight: 3, category: 'Fasiyal Plastik ve Maksillofasiyal Travma' },
  { id: 54, name: 'Fasiyal Paralizi Rehabilitasyonu', weight: 5, category: 'Fasiyal Plastik ve Maksillofasiyal Travma' },

  // Uyku Tıbbı
  { id: 55, name: 'Uyku Fizyolojisi ve Polisomnografi', weight: 4, category: 'Uyku Tıbbı' },
  { id: 56, name: 'Obstrüktif Uyku Apnesi Sendromu (OSAS)', weight: 6, category: 'Uyku Tıbbı' },
  { id: 57, name: 'Horlama ve Cerrahi Tedavileri', weight: 5, category: 'Uyku Tıbbı' },

  // Oral Kavite, Farenks ve Özofagus
  { id: 58, name: 'Oral Kavite Anatomisi ve Benign Hastalıkları', weight: 4, category: 'Oral Kavite, Farenks ve Özofagus' },
  { id: 59, name: 'Oral Kavite Kanserleri', weight: 6, category: 'Oral Kavite, Farenks ve Özofagus' },
  { id: 60, name: 'Orofarenks ve Hipofarenks Kanserleri', weight: 6, category: 'Oral Kavite, Farenks ve Özofagus' },
  { id: 61, name: 'Yutma Bozuklukları (Disfaji)', weight: 5, category: 'Oral Kavite, Farenks ve Özofagus' },
  { id: 62, name: 'Özofagus Hastalıkları ve Yabancı Cisimleri', weight: 4, category: 'Oral Kavite, Farenks ve Özofagus' },

  // Genel KBB ve Aciller
  { id: 63, name: 'KBB Acilleri (Hava Yolu, Kanama vb.)', weight: 6, category: 'Genel KBB ve Aciller' },
  { id: 64, name: 'Sistemik Hastalıkların KBB Bulguları', weight: 5, category: 'Genel KBB ve Aciller' },
  { id: 65, name: 'Baş Boyun Sendromları ve Genetik', weight: 4, category: 'Genel KBB ve Aciller' },
  { id: 66, name: 'KBB\'de Görüntüleme Yöntemleri', weight: 4, category: 'Genel KBB ve Aciller' }
];
