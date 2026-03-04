import { useStore } from './hooks/useStore';
// React import is not required in newer JSX setups and was causing a TS6133 unused error.
import { LoginScreen } from './features/auth/LoginScreen';
import { logout } from './api/drive';

function App() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const userEmail = useStore((state) => state.userEmail);
  const setIsAuthenticated = useStore((state) => state.setIsAuthenticated);
  const currentYear = useStore((state) => state.currentYear);
  const setCurrentYear = useStore((state) => state.setCurrentYear);

  const handleLogout = () => {
    logout();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">どんぶり帳簿</h1>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <label htmlFor="year-select" className="text-sm font-medium text-gray-700">年度:</label>
              <select
                id="year-select"
                value={currentYear}
                onChange={(e) => setCurrentYear(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                {/* 運用開始年などに合わせて後ほど動的に生成します */}
                <option value="2026">2026年</option>
                <option value="2025">2025年</option>
              </select>
            </div>
            <div className="text-sm text-gray-500 hidden sm:block">
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
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              ダッシュボード (仮)
            </h2>
            <p className="text-gray-700">
              認証とデータ連携が正常に動作しています。
              ここに、売上入力、費用入力、設定などの各機能へのナビゲーションやサマリーを構築していきます。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;