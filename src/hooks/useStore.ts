import { create } from 'zustand';
import type { AppData, YearData } from '../types';

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
  
  // ログを記録するアクション
  addLog: (action: string, details?: string) => void;
  
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

  // ログ記録の実装
  addLog: (action, details = '') => {
    const { appData } = get();
    if (!appData) return;

    const newLog = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action,
      details,
    };

    set({
      appData: {
        ...appData,
        logs: [...(appData.logs || []), newLog], // 既存のログ配列に追加（なければ空配列から開始）
      },
    });
  },

  getCurrentYearData: () => {
    const { appData, currentYear } = get();
    if (!appData || !appData.years[currentYear]) {
      return null;
    }
    return appData.years[currentYear];
  },
}));