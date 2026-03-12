import React, { useEffect, useState } from 'react';
import { initGoogleApi, login, loadAppData, tryRestoreSession } from '../../api/drive';
import { useStore } from '../../hooks/useStore';
import type { AppData } from '../../types';

export const LoginScreen: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const setIsAuthenticated = useStore((state) => state.setIsAuthenticated);
  const setAppData = useStore((state) => state.setAppData);

  const handleAuthSuccess = async (email: string) => {
    // すでにログアウトされている場合は何もしない（レースコンディション対策）
    const session = localStorage.getItem('donburi_auth_session_v2');
    if (!session) return;

    setIsLoadingData(true);
    setError(null);
    try {
      const data = await loadAppData();
      if (data) {
        setAppData(data);
      } else {
        const initialData: AppData = {
          version: "1.4",
          userId: email,
          years: {
            [new Date().getFullYear().toString()]: {
              apportionRate: 1,
              openingBalances: { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 },
              sales: [], expenses: [], purchases: [], inventory: []
            }
          }
        };
        setAppData(initialData);
      }
      setIsAuthenticated(true, email);
    } catch (err: any) {
      console.error('Data load error:', err);
      // 403 (Forbidden) の場合はセッションが切れているためエラーを表示せずログアウト状態を維持
      if (err.status === 403 || (err.result && err.result.error && err.result.error.code === 403)) {
        console.warn('Authentication token was already revoked.');
        return;
      }
      setError('データの読み込みに失敗しました。');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await initGoogleApi();
        if (!mounted) return;

        (window as any)._onGoogleAuthSuccess = async (email: string) => {
          if (mounted) await handleAuthSuccess(email);
        };

        const savedEmail = await tryRestoreSession();
        // セッションがストレージに存在する場合のみ、データの読み込みを開始する
        if (savedEmail && mounted) {
          await handleAuthSuccess(savedEmail);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        if (mounted) setError('初期化に失敗しました。');
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    initialize();

    return () => {
      mounted = false;
      delete (window as any)._onGoogleAuthSuccess;
    };
  }, []);

  const handleLoginClick = () => {
    setError(null);
    login();
  };

  const showContent = !isInitializing && !isLoadingData;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">どんぶり帳簿</h2>
        <p className="mt-2 text-center text-sm text-gray-600">クラウド完結型の超効率化帳簿システム</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center min-h-[200px] flex flex-col justify-center">
          {error && !isLoadingData && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 text-left">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!showContent ? (
            <div className="flex flex-col justify-center items-center space-y-4">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              <p className="text-sm text-gray-500">
                {isLoadingData ? 'データを同期しています...' : 'サインイン情報を確認中...'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-6">データはすべてあなた自身のGoogle Driveに安全に保存されます。</p>
              <button
                onClick={handleLoginClick}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Googleでログイン
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};