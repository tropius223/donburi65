import { useState, useEffect, useRef } from 'react';
import { useStore } from './hooks/useStore';
import { LoginScreen } from './features/auth/LoginScreen';
import { logout, saveAppData } from './api/drive';
import { SalesScreen } from './features/sales/SalesScreen';

function App() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const userEmail = useStore((state) => state.userEmail);
  const setIsAuthenticated = useStore((state) => state.setIsAuthenticated);
  const currentYear = useStore((state) => state.currentYear);
  const setCurrentYear = useStore((state) => state.setCurrentYear);
  const appData = useStore((state) => state.appData);

  const [activeTab, setActiveTab] = useState('sales');
  // 保存ステータス管理
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  // 初回ロード判定用
  const isInitialLoad = useRef(true);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
  };

  // 自動保存（デバウンス処理）
  useEffect(() => {
    if (!appData) return;

    // 初回データ読み込み時は保存をスキップ
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    setSaveStatus('unsaved');

    // 以前のタイマーがあればクリア（入力が続く限り保存を延期）
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

    // 3秒間変更がなければ保存を実行
    autoSaveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await saveAppData(appData);
        setSaveStatus('saved');
      } catch (error) {
        console.error('自動保存に失敗しました:', error);
        setSaveStatus('error');
      }
    }, 3000);

    return () => {
      if (autoSaveTimer.current) {
        clearTimeout(autoSaveTimer.current);
      }
    };
  }, [appData]); // appData（グローバル状態）が変更されるたびに発火

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const tabs = [
    { id: 'sales', label: '売上' },
    { id: 'expenses', label: '費用' },
    { id: 'purchases', label: '仕入' },
    { id: 'inventory', label: '棚卸' },
    { id: 'reports', label: '帳票 (有料)' },
    { id: 'settings', label: '設定' },
  ];

  // ステータス表示コンポーネント
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saved':
        return <span className="text-green-600 text-sm font-medium flex items-center">☁️ 保存済み</span>;
      case 'saving':
        return <span className="text-blue-600 text-sm font-medium flex items-center">🔄 保存中...</span>;
      case 'unsaved':
        return <span className="text-gray-500 text-sm font-medium flex items-center">✍️ 未保存</span>;
      case 'error':
        return <span className="text-red-600 text-sm font-medium flex items-center">⚠️ 保存失敗</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">どんぶり帳簿</h1>
          </div>
          <div className="flex items-center space-x-4 sm:space-x-6">
            <div className="flex items-center space-x-2">
              <label htmlFor="year-select" className="text-sm font-medium text-gray-700 hidden sm:block">年度:</label>
              <select
                id="year-select"
                value={currentYear}
                onChange={(e) => setCurrentYear(e.target.value)}
                className="block w-full pl-3 pr-8 py-1.5 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border bg-white"
              >
                <option value="2026">2026年</option>
                <option value="2025">2025年</option>
              </select>
            </div>
            
            <div className="w-24 flex justify-end">
              {renderSaveStatus()}
            </div>
            
            <div className="text-sm text-gray-500 hidden md:block">
              {userEmail}
            </div>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-gray-500 hover:text-gray-700 focus:outline-none"
            >
              ログアウト
            </button>
          </div>
        </div>
        
        {/* ナビゲーションタブ */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-auto">
          <nav className="flex space-x-4 sm:space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'sales' && <SalesScreen />}
        {activeTab === 'expenses' && <div className="p-6 bg-white shadow rounded-lg text-gray-600 text-center">費用画面は開発中です。</div>}
        {activeTab === 'purchases' && <div className="p-6 bg-white shadow rounded-lg text-gray-600 text-center">仕入画面は開発中です。</div>}
        {activeTab === 'inventory' && <div className="p-6 bg-white shadow rounded-lg text-gray-600 text-center">棚卸画面は開発中です。</div>}
        {activeTab === 'reports' && <div className="p-6 bg-white shadow rounded-lg text-gray-600 text-center">帳票画面は開発中です。</div>}
        {activeTab === 'settings' && <div className="p-6 bg-white shadow rounded-lg text-gray-600 text-center">設定画面は開発中です。</div>}
      </main>
    </div>
  );
}

export default App;