import { useState, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import { calculateSummary } from '../../utils/accounting';

export const ReportsScreen = () => {
  const userEmail = useStore((state) => state.userEmail);
  const currentYearData = useStore((state) => state.getCurrentYearData());
  const currentYear = useStore((state) => state.currentYear);

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // 課金ステータスの確認関数
  const checkStatus = async (force = false) => {
    if (!userEmail) return;
    if (force) setIsLoading(true);

    try {
      const response = await fetch('/.netlify/functions/check-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, forceRefresh: force }),
      });
      const data = await response.json();
      setIsSubscribed(data.isSubscribed);
    } catch (error) {
      console.error('課金確認エラー:', error);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 決済成功パラメーターがある場合は強制リフレッシュ
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      checkStatus(true);
      // パラメーターをURLから取り除く（リロード時の再処理防止）
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      checkStatus(false);
    }
  }, [userEmail]);

  const handlePurchase = async () => {
    setIsProcessingPayment(true);
    try {
      const response = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('決済エラー:', error);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600">最新の購読状態を確認中...</span>
      </div>
    );
  }

  const summary = currentYearData ? calculateSummary(currentYearData) : null;

  return (
    <div className="relative">
      {!isSubscribed && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-gray-200 text-center max-w-md mx-4">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">帳票出力機能は有料です</h3>
            <p className="text-gray-600 mb-8">
              仕訳帳、総勘定元帳、損益計算書、貸借対照表の表示・出力機能を利用するには、年間1,000円の購読が必要です。
            </p>
            <button
              onClick={handlePurchase}
              disabled={isProcessingPayment}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 disabled:opacity-50"
            >
              {isProcessingPayment ? '処理中...' : '年間 1,000円で購入する'}
            </button>
            <button
              onClick={() => checkStatus(true)}
              className="mt-6 text-sm text-blue-600 hover:underline font-medium"
            >
              既に購入済みの場合はこちら（再確認）
            </button>
            <p className="mt-4 text-xs text-gray-400 text-left">
              ※購入直後は反映に数十秒かかる場合があります。反映されない場合は上の「再確認」を押してください。
            </p>
          </div>
        </div>
      )}

      <div className={`space-y-12 ${!isSubscribed ? 'filter blur-sm select-none pointer-events-none' : ''}`}>
        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-6 py-8 border-b border-gray-200 bg-gray-50 text-center">
            <h2 className="text-2xl font-bold text-gray-900">{currentYear}年度 損益計算書</h2>
          </div>
          <div className="p-6">
            <table className="min-w-full divide-y divide-gray-200">
              <tbody>
                <tr className="bg-gray-50 font-bold">
                  <td className="py-3 px-4 text-gray-900">売上高</td>
                  <td className="py-3 px-4 text-right text-gray-900">{summary?.totalSales.toLocaleString()} 円</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 pl-8 text-gray-600">売上原価</td>
                  <td className="py-3 px-4 text-right text-gray-900">▲ {summary?.costOfSales.toLocaleString()} 円</td>
                </tr>
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td className="py-3 px-4 text-gray-900">売上総利益</td>
                  <td className="py-3 px-4 text-right text-gray-900">{((summary?.totalSales || 0) - (summary?.costOfSales || 0)).toLocaleString()} 円</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 pl-8 text-gray-600">販売費及び一般管理費（経費）</td>
                  <td className="py-3 px-4 text-right text-gray-900">▲ {summary?.totalExpenses.toLocaleString()} 円</td>
                </tr>
                <tr className="border-t-4 border-double border-gray-900 font-bold text-lg bg-blue-50">
                  <td className="py-4 px-4 text-blue-900">所得金額 (青色申告特別控除前)</td>
                  <td className="py-4 px-4 text-right text-blue-900">{summary?.income.toLocaleString()} 円</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-6 py-8 border-b border-gray-200 bg-gray-50 text-center">
            <h2 className="text-2xl font-bold text-gray-900">{currentYear}年度末 貸借対照表</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-100"><th colSpan={2} className="py-2 text-center">資産の部</th></tr>
                  </thead>
                  <tbody>
                    {currentYearData && Object.entries(currentYearData.openingBalances).map(([key, val]) => (
                      <tr key={key}>
                        <td className="py-2 px-4 text-gray-600">{key}</td>
                        <td className="py-2 px-4 text-right">{val.toLocaleString()} 円</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr className="bg-gray-100"><th colSpan={2} className="py-2 text-center">負債・純資産の部</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-2 px-4 text-gray-600">元入金</td>
                      <td className="py-2 px-4 text-right">{(currentYearData?.openingBalances['元入金'] || 0).toLocaleString()} 円</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-gray-600">本年所得</td>
                      <td className="py-2 px-4 text-right text-blue-600">{summary?.income.toLocaleString()} 円</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};