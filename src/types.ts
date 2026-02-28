export interface Question {
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
}

export interface Topic {
  id: number;
  name: string;
  weight: number;
  category: string;
}

