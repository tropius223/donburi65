import React, { useEffect, useState } from 'react';
import { initGoogleApi, login, loadAppData } from '../../api/drive';
import { useStore } from '../../hooks/useStore';
import type { AppData } from '../../types';

export const LoginScreen: React.FC = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const setIsAuthenticated = useStore((state) => state.setIsAuthenticated);
  const setAppData = useStore((state) => state.setAppData);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        await initGoogleApi(async (email) => {
          if (!mounted) return;
          setIsLoadingData(true);
          setError(null);
          try {
            const data = await loadAppData();
            if (data) {
              setAppData(data);
            } else {
              // データが存在しない場合の初期化ロジック
              console.log("既存のデータが見つかりませんでした。新規作成します。");
              const initialData: AppData = {
                version: "1.4",
                userId: email,
                years: {
                  [new Date().getFullYear().toString()]: {
                    apportionRate: 1, // 初期値は100%事業用
                    openingBalances: { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 },
                    sales: [],
                    expenses: [],
                    purchases: [],
                    inventory: []
                  }
                }
              };
              setAppData(initialData);
            }
            setIsAuthenticated(true, email);
          } catch (err) {
             console.error(err);
             setError('Google Driveからのデータ読み込みに失敗しました。');
          } finally {
            if (mounted) setIsLoadingData(false);
          }
        });
      } catch (err) {
        console.error(err);
        if (mounted) setError('Google APIの初期化に失敗しました。設定を確認してください。');
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, [setIsAuthenticated, setAppData]);

  const handleLoginClick = () => {
    setError(null);
    login();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          どんぶり帳簿
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          クラウド完結型の超効率化帳簿システム
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {isInitializing ? (
            <div className="flex justify-center items-center space-x-2 text-gray-500">
              <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>準備中...</span>
            </div>
          ) : isLoadingData ? (
             <div className="flex justify-center items-center space-x-2 text-blue-600">
             <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
             <span>データを読み込んでいます...</span>
           </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-6">
                データはすべてあなた自身のGoogle Driveに安全に保存されます。
              </p>
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