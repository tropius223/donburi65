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

  // 課金ステータスの確認
  useEffect(() => {
    const checkStatus = async () => {
      if (!userEmail) return;
      try {
        const response = await fetch('/.netlify/functions/check-subscription', {
          method: 'POST',
          body: JSON.stringify({ email: userEmail }),
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
    checkStatus();
  }, [userEmail]);

  // Stripe決済セッションの作成
  const handlePurchase = async () => {
    setIsProcessingPayment(true);
    try {
      const response = await fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('決済エラー:', error);
      alert('決済画面の起動に失敗しました。');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600">課金状態を確認中...</span>
      </div>
    );
  }

  // 集計データの計算
  const summary = currentYearData ? calculateSummary(currentYearData) : null;

  return (
    <div className="relative">
      {/* 未課金時のオーバーレイ */}
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
            <p className="mt-4 text-xs text-gray-400 text-left">
              ※Stripeによる安全な決済が行われます。購入後、この画面の制限が解除されます。
            </p>
          </div>
        </div>
      )}

      {/* 帳票コンテンツ（未課金時はぼかし） */}
      <div className={`space-y-12 ${!isSubscribed ? 'filter blur-sm select-none pointer-events-none' : ''}`}>
        <div className="bg-white shadow sm:rounded-lg overflow-hidden">
          <div className="px-6 py-8 border-b border-gray-200 bg-gray-50">
            <h2 className="text-2xl font-bold text-center text-gray-900">{currentYear}年度 損益計算書</h2>
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
                  <td className="py-3 px-4 text-right text-gray-900">{( (summary?.totalSales || 0) - (summary?.costOfSales || 0) ).toLocaleString()} 円</td>
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
          <div className="px-6 py-8 border-b border-gray-200 bg-gray-50">
            <h2 className="text-2xl font-bold text-center text-gray-900">{currentYear}年度末 貸借対照表</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* 資産の部 */}
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
                    {/* ここに期末在庫を反映するロジックを後で追加 */}
                  </tbody>
                </table>
              </div>
              {/* 負債・純資産の部 */}
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