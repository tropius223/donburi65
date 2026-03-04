import React, { useState } from 'react';
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
  };

  const handleSave = async () => {
    if (!appData) return;
    setIsSaving(true);
    setSaveMessage('');
    try {
      await saveAppData(appData);
      setSaveMessage('Google Driveに保存しました');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error(error);
      setSaveMessage('保存に失敗しました');
      setTimeout(() => setSaveMessage(''), 3000);
    } finally {
      setIsSaving(false);
    }
  };

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
            
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {isSaving ? '保存中...' : 'Driveへ保存'}
            </button>
            
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

      {/* 保存メッセージトースト */}
      {saveMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50 transition-opacity">
          {saveMessage}
        </div>
      )}

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