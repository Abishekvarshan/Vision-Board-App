
export interface VisionItem {
  id: string;
  url: string;
  category: string;
  caption: string;
  createdAt: number;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  date: string; // ISO string YYYY-MM-DD
}

export interface Activity {
  date: string; // YYYY-MM-DD
  count: number;
}

export type Category = 'Career' | 'Health' | 'Travel' | 'Relationships' | 'Wealth' | 'Personal';

export const CATEGORIES: Category[] = ['Career', 'Health', 'Travel', 'Relationships', 'Wealth', 'Personal'];
