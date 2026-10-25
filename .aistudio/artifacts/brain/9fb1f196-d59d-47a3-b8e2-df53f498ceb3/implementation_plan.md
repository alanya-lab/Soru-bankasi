# Revize Plan: Google E-Tablo & Özel Soru Yönetimi Entegrasyonu

Kullanıcı geri bildirimi doğrultusunda **yapay zeka soru üretimi devreden çıkarılmıştır**. Odak noktası; kullanıcının kendi kaliteli sorularını (kitaplardan, kurul sınavlarından veya dış kaynaklardan) **Google E-Tablolar**, **uygulama içi form** veya **toplu JSON/metin** ile kolayca ekleyip yönetebilmesidir.

---

## 1. Yeni Sistem Mimarisi & Özellikler

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SORU YÖNETİM MERKEZİ                           │
├───────────────────┬───────────────────────────┬────────────────────────┤
│ 1. Google E-Tablo │ 2. Uygulama İçi Soru Ekle │ 3. Toplu JSON / Metin  │
│    Canlı Bağlantı │    (Hızlı Form)           │    İçe / Dışa Aktarma  │
└─────────┬─────────┴─────────────┬─────────────┴───────────┬────────────┘
          │                       │                         │
          ▼                       ▼                         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Ortak Aktif Soru Havuzu                            │
│  (Kategori & Alt Kategori Bazlı Takip, Çözülme Durumu, Filtreleme)     │
└────────────────────────────────────────────────────────────────────────┘
```

### Temel Yetenekler:

1. **Google E-Tablo (Google Sheets) Canlı Bağlantısı:**
   - Kullanıcı, E-Tablo bağlantısını (paylaşım linkini) girer.
   - Sistem, tablodaki satırları (`Ana Kategori`, `Alt Kategori`, `Soru`, `A`, `B`, `C`, `D`, `E`, `Doğru Cevap`, `Açıklama`) otomatik algılar ve aktif soru havuzuna aktarır.
   - "Şimdi Eşitle" butonu ile tabloda yapılan herhangi bir değişiklik (ör. yeni soru ekleme, düzeltme yapma) anında uygulamaya yansır.

2. **Uygulama İçi "Soru Ekle" Formu:**
   - Kullanıcı gezinirken veya aklına gelen bir soruyu eklemek istediğinde:
     - Ana Kategori (seçim veya yeni yazma)
     - Alt Kategori (seçim veya yeni yazma)
     - Soru Metni (Klinik vaka / teorik soru)
     - A, B, C, D, E Seçenekleri
     - Doğru Seçenek (A-E)
     - Açıklama / Referans
   - Eklenen soru anında sisteme eklenir ve isterseniz E-Tabloya eklenecek satır formatında veya JSON olarak kopyalanabilir.

3. **Toplu Soru İçe / Dışa Aktarma (JSON & Metin):**
   - Kullanıcının elindeki mevcut JSON formatındaki soruları veya hazır soru listelerini tek seferde yapıştırıp içeri aktarabileceği pratik içe aktarma aracı.
   - Soru bankasındaki soruları tek tıkla `JSON formatında indir/kopyala` veya `E-Tabloya yapıştırılacak formatta kopyala`.

4. **Hazır Google E-Tablo Şablonu:**
   - Kullanıcının doğrudan Google E-Tablo'da kendi sorularını rahatça düzenleyebilmesi için tek tıkla kopyalanabilen örnek sütun başlıkları ve örnek satırlar.

---

## 2. E-Tablo Sütun Formatı

Kullanıcının E-Tablosunda kullanabileceği standart ve esnek sütun yapısı:

| Sütun | Başlık | Açıklama | Örnek |
|---|---|---|---|
| A | `Ana Kategori` | 4 ana KBB dalı veya yeni kategori | Rinoloji |
| B | `Alt Kategori` | İlgili alt başlık | Burun Kanamaları (Epistaksis) |
| C | `Soru` | Board / klinik vaka sorusu metni | 45 yaşında erkek hasta... |
| D | `A` | A seçeneği | Sfenopalatin arter ligasyonu |
| E | `B` | B seçeneği | Ön tampon uygulaması |
| F | `C` | C seçeneği | Arka tampon uygulaması |
| G | `D` | D seçeneği | Koterizasyon |
| H | `E` | E seçeneği | Anjiyografik embolizasyon |
| I | `Doğru Cevap` | A, B, C, D veya E | A |
| J | `Açıklama` | Vaka açıklaması ve klinik notlar | Kiesselbach pleksusu kanamalarında... |

*Sistem sütun sırası hafif farklı olsa dahi başlık isimlerini akıllıca eşleştirecektir.*

---

## 3. Uygulama Adımları

### Adım 1: E-Tablo Sunucu Uç Noktası (`server.ts`)
- `/api/sheets/fetch`: Tarayıcının CORS kısıtlamasına takılmadan kullanıcının Google Sheets paylaşım linkindeki CSV verisini çeken hafif proxy uç noktası.

### Adım 2: Soru Yönetim & E-Tablo Servisi (`src/services/sheetsService.ts`)
- Google Sheets URL'sinden ID çıkarma ve CSV'yi soru formatına dönüştürme.
- CSV ve JSON ayrıştırma mantığı (hatalı satırları veya eksik alanları güvenle yakalama).
- Soru bankasını E-Tablo satırları formatına (TSV/CSV) veya JSON formatına dönüştürme fonksiyonları.

### Adım 3: Soru Yönetim Modalı & Sekmesi (`QuestionManagementModal.tsx`)
- Üst barda **"Soru Bankası & E-Tablo"** butonu.
- Modal içerisinde 3 temiz sekme:
  1. **Google E-Tablo Bağlantısı:** Link yapıştırma, bağlantı durumu, tek tıkla eşitleme ve hazır şablonu açma linki.
  2. **Yeni Soru Ekle:** Temiz ve hızlı tekil soru giriş formu (kategori seçicili, A-E seçenekli).
  3. **Toplu Aktar & Yedekle:** JSON yapıştırıp içeri aktarma, mevcut soruları JSON olarak kopyalama veya E-Tablo için kopyalama.

### Adım 4: Arayüz ve Navigasyon İyileştirmesi
- Yapay zekaya rastgele soru ürettirme gibi kalitesiz sonuç veren butonların arayüzden temizlenmesi/devre dışı bırakılması.
- "Hadi Çözelim" ve konu listelerinde E-Tablodan ve formdan gelen tüm soruların gerçek zamanlı soru sayıları ve çözülme yüzdeleriyle entegrasyonu.

---

## 4. Kullanıcı Deneyimi Avantajları
- **Sıfır Kalite Riski:** Sadece kullanıcının güvenilir bulduğu, onayladığı gerçek sorular yer alır.
- **Maksimum Esneklik:** İster Google Sheets'te Excel gibi rahatça çalışın, ister uygulama içinden tek tek ekleyin, ister başka bir yapay zekaya hazırlattığınız JSON'ı tek tıkla yapıştırın.
- **Veri Kaybı Yok:** E-Tablo linki veya JSON yedekleme sayesinde verileriniz her zaman güvendedir.
