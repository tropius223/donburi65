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

  // 環境変数からメンテナンスモードの状態を取得
  const isMaintenanceMode = import.meta.env.VITE_MAINTENANCE_MODE === 'true';
  const maintenanceMessage = import.meta.env.VITE_MAINTENANCE_MESSAGE || '現在システムメンテナンス中です。しばらくお待ちください。';

  const handleAuthSuccess = async (email: string) => {
    // メンテナンス中はログイン処理を進めない
    if (isMaintenanceMode) return;

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
        // メンテナンス中でなければセッションの復元を試みる
        if (savedEmail && mounted && !isMaintenanceMode) {
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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap');
        .font-noto {
          font-family: 'Noto Sans JP', sans-serif;
        }
        .bg-mesh {
          background-color: #f8fafc;
          background-image: radial-gradient(at 0% 0%, rgba(251, 146, 60, 0.12) 0, transparent 50%), 
                            radial-gradient(at 100% 100%, rgba(245, 158, 11, 0.12) 0, transparent 50%);
        }
      `}</style>

      <div className="font-noto bg-mesh min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* ロゴエリア */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm border border-orange-100 mb-4 overflow-hidden">
              <span className="text-3xl font-black text-orange-600">65</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">どんぶり帳簿</h1>
            <p className="text-gray-500 text-sm mt-2">副業の65万円控除を、もっと身近に。</p>
          </div>

          {/* ログインカード */}
          <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-orange-900/10 border border-gray-100 p-8 md:p-10">
            
            {error && !isLoadingData && (
              <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 text-left rounded shadow-sm">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {showContent ? (
              <div id="auth-container">
                <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">副業で差をつけるあなたへ</h2>
                <p className="text-gray-400 text-xs text-center mb-8">元手なしのビジネスに最適な、必要最小限で低価格な帳簿</p>
                
                <div className="space-y-6">
                  {/* 特徴スロット */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="text-center p-3 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="text-orange-500 mb-1 flex justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002-2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                        </svg>
                      </div>
                      <span className="text-[9px] font-bold text-gray-500">データ非保持</span>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="text-blue-500 mb-1 flex justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"></path>
                        </svg>
                      </div>
                      <span className="text-[9px] font-bold text-gray-500">Drive保存</span>
                    </div>
                    <div className="text-center p-3 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="text-green-500 mb-1 flex justify-center">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                      </div>
                      <span className="text-[9px] font-bold text-gray-500">e-Tax対応</span>
                    </div>
                  </div>

                  {/* メンテナンスモード判定 */}
                  {isMaintenanceMode ? (
                    <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200 text-center">
                      <div className="text-yellow-500 mb-3 flex justify-center">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                      </div>
                      <h3 className="font-bold text-yellow-800 mb-2">メンテナンス中</h3>
                      <p className="text-xs text-yellow-700 leading-relaxed whitespace-pre-wrap">
                        {maintenanceMessage}
                      </p>
                    </div>
                  ) : (
                    <button 
                      onClick={handleLoginClick}
                      className="w-full flex items-center justify-center gap-4 px-6 py-4 bg-white border border-gray-300 rounded-2xl hover:bg-gray-50 transition-all font-bold text-gray-700 shadow-sm group"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Googleでログイン
                    </button>
                  )}

                  {/* セキュリティ通知 */}
                  <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex gap-3">
                    <div className="shrink-0 text-orange-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"></path>
                      </svg>
                    </div>
                    <p className="text-[11px] text-orange-800 leading-relaxed">
                      <span className="font-bold">プライバシー保護:</span><br />
                      運営者があなたの帳簿を閲覧・保存することはありません。すべてはあなたのDrive内で完結します。
                    </p>
                  </div>

                  {/* 同意事項 */}
                  <div className="pt-2 text-center">
                    <p className="text-[10px] text-gray-400 leading-loose">
                      サインインすることで、どんぶり帳簿の<br />
                      <a href="terms.html" className="text-orange-600 font-bold hover:underline">利用規約</a>および<a href="precautions.html" className="text-orange-600 font-bold hover:underline">注意事項</a>に同意したものとみなされます。
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div id="loading-example" className="flex flex-col items-center justify-center py-10">
                <div className="relative mb-6">
                  <div className="w-16 h-16 border-4 border-orange-100 rounded-full"></div>
                  <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <p className="text-gray-500 font-bold text-sm">
                  {isLoadingData ? 'データを同期しています...' : 'サインイン情報を確認中...'}
                </p>
                <p className="text-gray-300 text-[10px] mt-2">あなたのGoogle Driveを確認中</p>
              </div>
            )}
            
          </div>

          {/* サポート・外部リンク */}
          <div className="mt-10 flex flex-col items-center gap-6">
            <div className="flex justify-center gap-8 text-xs text-gray-400 font-medium">
              <a href="landing_page.html" className="hover:text-orange-600 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                </svg>
                LPに戻る
              </a>
              <a href="manual.html" className="hover:text-orange-600 transition flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
                操作マニュアル
              </a>
            </div>
            
            <p className="text-[10px] text-gray-300 italic">
              &copy; {new Date().getFullYear()} どんぶり帳簿 All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};