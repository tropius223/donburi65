import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { calculateSummary } from '../../utils/accounting';

// 開発用フラグ：帳票画面の編集時は true にし、本番公開時に false に戻してください
// ※未課金時のモザイク表現を確認できるよう、一時的に false にしています
const DEV_SKIP_SUBSCRIPTION_CHECK = false;

export const ReportsScreen = () => {
  const userEmail = useStore((state) => state.userEmail);
  const currentYearData = useStore((state) => state.getCurrentYearData());
  const currentYear = useStore((state) => state.currentYear);

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(DEV_SKIP_SUBSCRIPTION_CHECK ? true : null);
  const [isLoading, setIsLoading] = useState(!DEV_SKIP_SUBSCRIPTION_CHECK);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [reportTab, setReportTab] = useState<'pl' | 'bs' | 'journal' | 'ledger'>('pl');
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  // 課金ステータスの確認関数
  const checkStatus = async (force = false) => {
    if (DEV_SKIP_SUBSCRIPTION_CHECK) return;
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
    if (DEV_SKIP_SUBSCRIPTION_CHECK) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      checkStatus(true);
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

  const summary = currentYearData ? calculateSummary(currentYearData) : null;

  // 金額表示用ヘルパー（未課金時はダミー数値にブラーをかけて表示）
  const renderAmount = (amount: number | string) => {
    if (!isSubscribed) {
      return <span className="filter blur-sm select-none text-gray-400 font-mono">888,888</span>;
    }
    return typeof amount === 'number' ? amount.toLocaleString() : amount;
  };

  // 期首元入金の計算
  const getBal = (key: string) => currentYearData?.openingBalances[key] || 0;
  const openingMotouire = currentYearData ? getBal('元入金') + getBal('青色申告特別控除前の所得金額') + getBal('事業主借') - getBal('事業主貸') : 0;

  // 経費の科目ごとの集計
  const expenseTotals = useMemo(() => {
    if (!currentYearData) return {};
    const totals: Record<string, number> = {};
    currentYearData.expenses.forEach(e => {
      const amount = Math.round(e.amount * currentYearData.apportionRate);
      if (amount > 0) {
        totals[e.category] = (totals[e.category] || 0) + amount;
      }
    });
    return totals;
  }, [currentYearData]);

  // 仕訳帳と総勘定元帳データの生成ロジック
  const { entries, ledgerMap } = useMemo(() => {
    if (!currentYearData) return { entries: [], ledgerMap: new Map() };
    
    type JournalEntry = {
      id: string;
      date: string;
      debitAccount: string;
      debitAmount: number;
      creditAccount: string;
      creditAmount: number;
      memo: string;
    };

    let journal: JournalEntry[] = [];
    
    // 売上（発生と入金）
    currentYearData.sales.forEach(sale => {
      journal.push({
        id: `sale-${sale.id}-1`,
        date: sale.salesDate,
        debitAccount: '売掛金',
        debitAmount: sale.amount,
        creditAccount: '売上高',
        creditAmount: sale.amount,
        memo: sale.client || '売上'
      });
      if (sale.depositDate) {
        journal.push({
          id: `sale-${sale.id}-2`,
          date: sale.depositDate,
          debitAccount: '事業主貸',
          debitAmount: sale.amount,
          creditAccount: '売掛金',
          creditAmount: sale.amount,
          memo: `${sale.client || '売上'} 入金`
        });
      }
    });

    // 前年売掛金回収
    const prevReceivables = (currentYearData as any).previousReceivables || [];
    prevReceivables.forEach((r: any) => {
      journal.push({
        id: `prev-rec-${r.id}`,
        date: r.date,
        debitAccount: '事業主貸',
        debitAmount: r.amount,
        creditAccount: '売掛金',
        creditAmount: r.amount,
        memo: '前年売掛金回収'
      });
    });

    // 仕入
    currentYearData.purchases.forEach(p => {
      journal.push({
        id: `purchase-${p.id}`,
        date: p.date,
        debitAccount: '仕入高',
        debitAmount: p.amount,
        creditAccount: '事業主貸',
        creditAmount: p.amount,
        memo: p.supplier || '仕入'
      });
    });

    // 経費 (日付はその月の末日とする)
    const getEndOfMonth = (year: string, month: number) => {
      const d = new Date(parseInt(year), month, 0);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    currentYearData.expenses.forEach(e => {
      const apportioned = Math.round(e.amount * currentYearData.apportionRate);
      if (apportioned > 0) {
        journal.push({
          id: `expense-${e.id}`,
          date: getEndOfMonth(currentYear, e.month),
          debitAccount: e.category,
          debitAmount: apportioned,
          creditAccount: '事業主貸',
          creditAmount: apportioned,
          memo: e.colLabel || e.category
        });
      }
    });

    // 決算整理仕訳 (12月31日)
    const endOfYear = `${currentYear}-12-31`;
    const openingInventory = currentYearData.openingBalances['商品'] || 0;
    const closingInventory = currentYearData.inventory.reduce((sum, item) => sum + item.totalAmount, 0);

    if (openingInventory > 0) {
      journal.push({
        id: 'adj-inv-open',
        date: endOfYear,
        debitAccount: '売上原価',
        debitAmount: openingInventory,
        creditAccount: '商品',
        creditAmount: openingInventory,
        memo: '期首商品振替'
      });
    }

    const totalPurchases = currentYearData.purchases.reduce((sum, p) => sum + p.amount, 0);
    if (totalPurchases > 0) {
      journal.push({
        id: 'adj-pur',
        date: endOfYear,
        debitAccount: '売上原価',
        debitAmount: totalPurchases,
        creditAccount: '仕入高',
        creditAmount: totalPurchases,
        memo: '当期仕入高振替'
      });
    }

    if (closingInventory > 0) {
      journal.push({
        id: 'adj-inv-close',
        date: endOfYear,
        debitAccount: '商品',
        debitAmount: closingInventory,
        creditAccount: '売上原価',
        creditAmount: closingInventory,
        memo: '期末商品振替'
      });
    }

    // 事業主貸と事業主借の相殺振替
    let jigyoDr = 0;
    let jigyoCr = 0;
    journal.forEach(entry => {
      if (entry.debitAccount === '事業主貸') jigyoDr += entry.debitAmount;
      if (entry.creditAccount === '事業主貸') jigyoCr += entry.creditAmount;
    });
    const jigyoBalance = jigyoDr - jigyoCr;
    if (jigyoBalance < 0) {
      const absBal = Math.abs(jigyoBalance);
      journal.push({
        id: 'adj-jigyo',
        date: endOfYear,
        debitAccount: '事業主貸',
        debitAmount: absBal,
        creditAccount: '事業主借',
        creditAmount: absBal,
        memo: '事業主勘定振替（マイナス調整）'
      });
    }

    // 日付順にソート
    journal.sort((a, b) => a.date.localeCompare(b.date));

    // 総勘定元帳 (Ledger) の作成
    const accounts = new Set<string>();
    Object.keys(currentYearData.openingBalances).forEach(k => accounts.add(k));
    journal.forEach(e => {
      accounts.add(e.debitAccount);
      accounts.add(e.creditAccount);
    });

    // 借方がプラスになる勘定科目かどうかの判定
    const isDebitPlus = (account: string) => {
      const creditAccounts = ['支払手形', '買掛金', '借入金', '未払金', '前受金', '預り金', '貸倒引当金', '事業主借', '元入金', '青色申告特別控除前の所得金額', '売上高'];
      return !creditAccounts.includes(account);
    };

    type LedgerEntry = {
      date: string;
      opponent: string;
      debit: number;
      credit: number;
      balance: number;
      memo: string;
    };

    const map = new Map<string, LedgerEntry[]>();
    for (const account of Array.from(accounts)) {
      const ledgerEntries: LedgerEntry[] = [];
      let balance = currentYearData.openingBalances[account] || 0;
      
      // 開始残高の記載
      if (balance !== 0) {
        ledgerEntries.push({
          date: `${currentYear}-01-01`,
          opponent: '前期繰越',
          debit: isDebitPlus(account) && balance > 0 ? balance : 0,
          credit: !isDebitPlus(account) && balance > 0 ? balance : 0,
          balance: balance,
          memo: '開始残高'
        });
      }

      // 該当する仕訳をすべて追加
      journal.forEach(e => {
        if (e.debitAccount === account) {
          balance += isDebitPlus(account) ? e.debitAmount : -e.debitAmount;
          ledgerEntries.push({
            date: e.date,
            opponent: e.creditAccount,
            debit: e.debitAmount,
            credit: 0,
            balance: balance,
            memo: e.memo
          });
        }
        if (e.creditAccount === account) {
          balance += isDebitPlus(account) ? -e.creditAmount : e.creditAmount;
          ledgerEntries.push({
            date: e.date,
            opponent: e.debitAccount,
            debit: 0,
            credit: e.creditAmount,
            balance: balance,
            memo: e.memo
          });
        }
      });

      // 動きがあった、または残高がある科目だけをMapに登録
      if (ledgerEntries.length > 0) {
        map.set(account, ledgerEntries);
      }
    }

    return { entries: journal, ledgerMap: map };
  }, [currentYearData, currentYear]);

  // 初期表示の勘定科目を設定
  useEffect(() => {
    if (ledgerMap.size > 0 && !selectedAccount) {
      const sortedKeys = Array.from(ledgerMap.keys()).sort();
      if (sortedKeys.includes('売掛金')) setSelectedAccount('売掛金');
      else setSelectedAccount(sortedKeys[0]);
    }
  }, [ledgerMap, selectedAccount]);


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600">最新の購読状態を確認中...</span>
      </div>
    );
  }

  // 貸借対照表の合計計算用
  const bsAssetsTotal = currentYearData ? Object.entries(currentYearData.openingBalances)
    .filter(([key]) => !['元入金', '青色申告特別控除前の所得金額', '事業主借', '事業主貸', '支払手形', '買掛金', '借入金', '未払金', '前受金', '預り金', '貸倒引当金'].includes(key))
    .reduce((sum, [, val]) => sum + val, 0) : 0;

  const bsLiabilitiesTotal = (currentYearData ? Object.entries(currentYearData.openingBalances)
    .filter(([key]) => ['支払手形', '買掛金', '借入金', '未払金', '前受金', '預り金', '貸倒引当金'].includes(key))
    .reduce((sum, [, val]) => sum + val, 0) : 0) + openingMotouire + (summary?.income || 0);

  return (
    <div className="space-y-6">
      
      {/* 未課金時の案内バナー（画面をブロックしないインライン表示） */}
      {!isSubscribed && (
        <div className="bg-white border-t-4 border-blue-500 shadow-md p-6 rounded-lg text-center max-w-3xl mx-auto mt-4 animate-fade-in">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">帳票出力機能は有料です</h3>
          <p className="text-gray-600 mb-6">
            仕訳帳、総勘定元帳、損益計算書、貸借対照表の<strong className="text-blue-600">金額を表示</strong>したり、出力機能を利用するには、年間1,000円の購読が必要です。<br/>
            （※現在はフォーマットのみご確認いただけます）
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={handlePurchase}
              disabled={isProcessingPayment}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
            >
              {isProcessingPayment ? '処理中...' : '年間 1,000円で購入する'}
            </button>
            <button
              onClick={() => checkStatus(true)}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              既に購入済みの場合はこちら（再確認）
            </button>
          </div>
        </div>
      )}

      {/* 帳票タブのナビゲーション（未課金でも操作可能） */}
      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex flex-wrap" aria-label="Tabs">
            <button onClick={() => setReportTab('pl')} className={`${reportTab === 'pl' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} w-1/4 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors`}>
              損益計算書
            </button>
            <button onClick={() => setReportTab('bs')} className={`${reportTab === 'bs' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} w-1/4 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors`}>
              貸借対照表
            </button>
            <button onClick={() => setReportTab('journal')} className={`${reportTab === 'journal' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} w-1/4 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors`}>
              仕訳帳
            </button>
            <button onClick={() => setReportTab('ledger')} className={`${reportTab === 'ledger' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} w-1/4 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors`}>
              総勘定元帳
            </button>
          </nav>
        </div>
      </div>

      {/* 損益計算書タブ */}
      {reportTab === 'pl' && (
        <div className="bg-white shadow sm:rounded-lg overflow-hidden animate-fade-in">
          <div className="px-6 py-8 border-b border-gray-200 bg-gray-50 text-center">
            <h2 className="text-2xl font-bold text-gray-900">{currentYear}年度 損益計算書</h2>
          </div>
          <div className="p-6">
            <table className="min-w-full divide-y divide-gray-200 text-sm md:text-base">
              <tbody>
                <tr className="bg-gray-50 font-bold">
                  <td className="py-3 px-4 text-gray-900">売上高</td>
                  <td className="py-3 px-4 text-right text-gray-900">{renderAmount(summary?.totalSales || 0)} 円</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 pl-8 text-gray-600">売上原価</td>
                  <td className="py-3 px-4 text-right text-gray-900">▲ {renderAmount(summary?.costOfSales || 0)} 円</td>
                </tr>
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td className="py-3 px-4 text-gray-900">売上総利益</td>
                  <td className="py-3 px-4 text-right text-gray-900">{renderAmount((summary?.totalSales || 0) - (summary?.costOfSales || 0))} 円</td>
                </tr>
                
                {/* 販売費及び一般管理費の詳細 */}
                <tr className="bg-gray-50 font-bold border-t border-gray-200">
                  <td colSpan={2} className="py-2 px-4 text-gray-900">販売費及び一般管理費</td>
                </tr>
                {Object.entries(expenseTotals).map(([cat, amt]) => (
                  <tr key={cat}>
                    <td className="py-2 px-4 pl-8 text-gray-600">{cat}</td>
                    <td className="py-2 px-4 text-right text-gray-900">{renderAmount(amt)} 円</td>
                  </tr>
                ))}
                <tr className="border-b border-gray-200">
                  <td className="py-3 px-4 pl-8 text-gray-900 font-medium">経費合計</td>
                  <td className="py-3 px-4 text-right text-gray-900 font-medium">▲ {renderAmount(summary?.totalExpenses || 0)} 円</td>
                </tr>

                <tr className="border-t-4 border-double border-gray-900 font-bold text-lg bg-blue-50">
                  <td className="py-4 px-4 text-blue-900">所得金額 (青色申告特別控除前)</td>
                  <td className="py-4 px-4 text-right text-blue-900">{renderAmount(summary?.income || 0)} 円</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 貸借対照表タブ */}
      {reportTab === 'bs' && (
        <div className="bg-white shadow sm:rounded-lg overflow-hidden animate-fade-in">
          <div className="px-6 py-8 border-b border-gray-200 bg-gray-50 text-center">
            <h2 className="text-2xl font-bold text-gray-900">{currentYear}年度末 貸借対照表</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <table className="min-w-full divide-y divide-gray-200 text-sm md:text-base">
                  <thead>
                    <tr className="bg-gray-100"><th colSpan={2} className="py-2 text-center border-b border-gray-200">資産の部</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentYearData && Object.entries(currentYearData.openingBalances)
                      .filter(([key, val]) => !['元入金', '青色申告特別控除前の所得金額', '事業主借', '事業主貸', '支払手形', '買掛金', '借入金', '未払金', '前受金', '預り金', '貸倒引当金'].includes(key) && val !== 0)
                      .map(([key, val]) => (
                      <tr key={key}>
                        <td className="py-2 px-4 text-gray-600">{key}</td>
                        <td className="py-2 px-4 text-right">{renderAmount(val)} 円</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                      <td className="py-3 px-4 text-gray-900">資産合計</td>
                      <td className="py-3 px-4 text-right text-gray-900">{renderAmount(bsAssetsTotal)} 円</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <table className="min-w-full divide-y divide-gray-200 text-sm md:text-base">
                  <thead>
                    <tr className="bg-gray-100"><th colSpan={2} className="py-2 text-center border-b border-gray-200">負債・純資産の部</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentYearData && Object.entries(currentYearData.openingBalances)
                      .filter(([key, val]) => ['支払手形', '買掛金', '借入金', '未払金', '前受金', '預り金', '貸倒引当金'].includes(key) && val !== 0)
                      .map(([key, val]) => (
                      <tr key={key}>
                        <td className="py-2 px-4 text-gray-600">{key}</td>
                        <td className="py-2 px-4 text-right">{renderAmount(val)} 円</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="py-2 px-4 text-gray-600">元入金</td>
                      <td className="py-2 px-4 text-right">{renderAmount(openingMotouire)} 円</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-4 text-gray-600">本年所得</td>
                      <td className="py-2 px-4 text-right text-blue-600">{renderAmount(summary?.income || 0)} 円</td>
                    </tr>
                    <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                      <td className="py-3 px-4 text-gray-900">負債・純資産合計</td>
                      <td className="py-3 px-4 text-right text-gray-900">{renderAmount(bsLiabilitiesTotal)} 円</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 仕訳帳タブ */}
      {reportTab === 'journal' && (
        <div className="bg-white shadow sm:rounded-lg overflow-hidden animate-fade-in">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900">仕訳帳</h2>
            <span className="text-sm text-gray-500">計 {entries.length} 件</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">日付</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">借方勘定</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">借方金額</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">貸方勘定</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">貸方金額</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">摘要</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entries.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900 whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-2 text-blue-600 font-medium">{e.debitAccount}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{renderAmount(e.debitAmount)}</td>
                    <td className="px-4 py-2 text-red-600 font-medium">{e.creditAccount}</td>
                    <td className="px-4 py-2 text-right text-gray-900">{renderAmount(e.creditAmount)}</td>
                    <td className="px-4 py-2 text-gray-500 truncate max-w-[200px]" title={e.memo}>{e.memo}</td>
                  </tr>
                ))}
                {entries.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">仕訳データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 総勘定元帳タブ */}
      {reportTab === 'ledger' && (
        <div className="bg-white shadow sm:rounded-lg overflow-hidden animate-fade-in">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-3 sm:space-y-0">
            <h2 className="text-lg font-bold text-gray-900">総勘定元帳</h2>
            <div className="flex items-center">
              <label className="mr-3 text-sm font-medium text-gray-700">勘定科目:</label>
              <select 
                value={selectedAccount} 
                onChange={e => setSelectedAccount(e.target.value)} 
                className="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-1.5 pl-3 pr-8 text-sm border bg-white font-medium text-gray-900"
              >
                {Array.from(ledgerMap.keys()).sort().map(acc => (
                  <option key={acc} value={acc}>{acc}</option>
                ))}
              </select>
            </div>
          </div>
          
          {selectedAccount && ledgerMap.has(selectedAccount) ? (
            <div className="overflow-x-auto p-4 sm:p-6">
              <h3 className="text-xl font-bold text-gray-800 text-center border-b-2 border-gray-400 pb-2 mb-6 w-1/3 mx-auto">{selectedAccount}</h3>
              <table className="min-w-full divide-y divide-gray-300 text-sm border border-gray-300 shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-gray-700 border-r border-gray-300">日付</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-700 border-r border-gray-300">相手勘定</th>
                    <th className="px-4 py-3 text-left font-bold text-gray-700 border-r border-gray-300">摘要</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700 border-r border-gray-300">借方</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700 border-r border-gray-300">貸方</th>
                    <th className="px-4 py-3 text-right font-bold text-gray-700">残高</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ledgerMap.get(selectedAccount)!.map((l: {date: string, opponent: string, debit: number, credit: number, balance: number, memo: string}, i: number) => (
                    <tr key={i} className="hover:bg-blue-50/30">
                      <td className="px-4 py-2 text-gray-900 whitespace-nowrap border-r border-gray-200">{l.date}</td>
                      <td className="px-4 py-2 text-gray-700 border-r border-gray-200">{l.opponent}</td>
                      <td className="px-4 py-2 text-gray-500 border-r border-gray-200 truncate max-w-[150px]" title={l.memo}>{l.memo}</td>
                      <td className="px-4 py-2 text-right text-blue-700 border-r border-gray-200 font-medium">{l.debit > 0 ? renderAmount(l.debit) : ''}</td>
                      <td className="px-4 py-2 text-right text-red-600 border-r border-gray-200 font-medium">{l.credit > 0 ? renderAmount(l.credit) : ''}</td>
                      <td className="px-4 py-2 text-right font-bold text-gray-900 bg-gray-50/50">{renderAmount(l.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              表示するデータがありません
            </div>
          )}
        </div>
      )}

    </div>
  );
};