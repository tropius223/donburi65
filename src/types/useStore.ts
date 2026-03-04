import { create } from 'zustand';
import { AppData, YearData } from '../types';

interface AppState {
  // 認証状態
  isAuthenticated: boolean;
  userEmail: string | null;
  
  // アプリケーションデータ
  appData: AppData | null;
  currentYear: string;

  // 状態更新アクション
  setIsAuthenticated: (auth: boolean, email?: string | null) => void;
  setAppData: (data: AppData) => void;
  setCurrentYear: (year: string) => void;
  
  // 現在の年度データを取得するヘルパー
  getCurrentYearData: () => YearData | null;
}

export const useStore = create<AppState>((set, get) => ({
  isAuthenticated: false,
  userEmail: null,
  appData: null,
  // デフォルトは現在の西暦を設定
  currentYear: new Date().getFullYear().toString(),

  setIsAuthenticated: (auth, email = null) =>
    set({ isAuthenticated: auth, userEmail: email }),

  setAppData: (data) => set({ appData: data }),

  setCurrentYear: (year) => set({ currentYear: year }),

  getCurrentYearData: () => {
    const { appData, currentYear } = get();
    if (!appData || !appData.years[currentYear]) {
      return null;
    }
    return appData.years[currentYear];
  },
}));