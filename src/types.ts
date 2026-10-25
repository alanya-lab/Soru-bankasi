export interface Question {
  id?: string;
  soru: string;
  secenekler: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };
  dogruCevap: 'A' | 'B' | 'C' | 'D' | 'E';
  aciklama: string;
  topic?: string;
  category?: string;
  difficulty?: string;
  source?: string;
}

export interface Topic {
  id: number;
  name: string;
  weight: number;
  category: string;
}

export interface SheetSyncConfig {
  sheetUrl: string;
  lastSyncTime?: string;
  autoSync: boolean;
  importedCount?: number;
}


