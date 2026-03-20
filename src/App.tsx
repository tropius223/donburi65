import { useState, useEffect, useRef } from 'react';
import { useStore } from './hooks/useStore';
import { LoginScreen } from './features/auth/LoginScreen';
import { logout, saveAppData } from './api/drive';
import { SalesScreen } from './features/sales/SalesScreen';
import { ExpensesScreen } from './features/expenses/ExpensesScreen';
import { PurchasesScreen } from './features/purchases/PurchasesScreen';
import { InventoryScreen } from './features/inventory/InventoryScreen';
import { SettingsScreen } from './features/settings/SettingsScreen';
import { ReportsScreen } from './features/reports/ReportsScreen';
import { BlueReturnScreen } from './features/reports/BlueReturnScreen';

function App() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const userEmail = useStore((state) => state.userEmail);
  const setIsAuthenticated = useStore((state) => state.setIsAuthenticated);
  const currentYear = useStore((state) => state.currentYear);
  const setCurrentYear = useStore((state) => state.setCurrentYear);
  const appData = useStore((state) => state.appData);

  const [activeTab, setActiveTab] = useState('sales');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [isManagingSubscription, setIsManagingSubscription] = useState(false);
  const isInitialLoad = useRef(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
  };

  const handleManageSubscription = async () => {
    setIsManagingSubscription(true);
    try {
      const response = await fetch('/.netlify/functions/create-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error === 'Customer not found') {
        alert('課金履歴が見つかりません。');
      } else {
        alert('ポータルの表示に失敗しました。');
      }
    } catch (error) {
      console.error('Portal Error:', error);
      alert('通信エラーが発生しました。');
    } finally {
      setIsManagingSubscription(false);
    }
  };

  useEffect(() => {
    if (!appData) return;

    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    setSaveStatus('unsaved');

    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
    }

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
  }, [appData]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const tabs = [
    { id: 'sales', label: '売上' },
    { id: 'expenses', label: '費用' },
    { id: 'purchases', label: '仕入' },
    { id: 'inventory', label: '棚卸' },
    { id: 'reports', label: '帳票' },
    { id: 'blue-return', label: '青色申告' },
    { id: 'settings', label: '開始仕訳' },
  ];

  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saved':
        return <span className="text-green-600 text-sm font-medium flex items-center">保存済み</span>;
      case 'saving':
        return <span className="text-blue-600 text-sm font-medium flex items-center">保存中...</span>;
      case 'unsaved':
        return <span className="text-gray-500 text-sm font-medium flex items-center">未保存</span>;
      case 'error':
        return <span className="text-red-600 text-sm font-medium flex items-center">保存失敗</span>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        {activeTab === 'sales' && <SalesScreen />}
        {activeTab === 'expenses' && <ExpensesScreen />}
        {activeTab === 'purchases' && <PurchasesScreen />}
        {activeTab === 'inventory' && <InventoryScreen />}
        {activeTab === 'reports' && <ReportsScreen />}
        {activeTab === 'blue-return' && <BlueReturnScreen />}
        {activeTab === 'settings' && <SettingsScreen />}
      </main>

      {/* アプリ全体のフッターを追加 */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 text-sm text-gray-500">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <button
              onClick={handleManageSubscription}
              disabled={isManagingSubscription}
              className="text-gray-800 hover:text-gray-900 hover:underline disabled:opacity-50"
            >
              {isManagingSubscription ? '処理中...' : '有料プランの管理・解約'}
            </button>
            <a href="/terms.html" className="hover:text-gray-900 hover:underline">利用規約</a>
            <a href="/privacy.html" className="hover:text-gray-900 hover:underline">プライバシーポリシー</a>
            <a href="#" className="hover:text-gray-900 hover:underline">特定商取引法に基づく表記</a>
          </div>
          <div>&copy; {new Date().getFullYear()} どんぶり帳簿</div>
        </div>
      </footer>
    </div>
  );
}

export default App;