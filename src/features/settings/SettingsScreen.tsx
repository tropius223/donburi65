import React, { useState, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import type { OpeningBalances, AppData, YearData } from '../../types';
import { calculateApportionedExpense } from '../../utils/accounting';

const ASSET_ACCOUNTS = [
  '売掛金', '事業主貸', '現金', '当座預金', '定期預金', 'その他の預金', '受取手形', '有価証券',
  '棚卸資産', '前払金', '貸付金', '建物', '建物附属設備', '機械装置', '車両運搬具',
  '工具・器具・備品', '土地'
];

const LIABILITY_ACCOUNTS = [
  '支払手形', '買掛金', '借入金', '未払金', '前受金', '預り金', '貸倒引当金', '事業主借'
];

const CAPITAL_ACCOUNTS = [
  '元入金',
  '青色申告特別控除前の所得金額'
];

type PrevReceivable = { id: string; date: string; amount: number };

export const SettingsScreen: React.FC = () => {
  const currentYearData = useStore((state) => state.getCurrentYearData());
  const appData = useStore((state) => state.appData);
  const setAppData = useStore((state) => state.setAppData);
  const currentYear = useStore((state) => state.currentYear);

  // フック（useState, useEffect）は必ず早期リターンの前に配置する
  const [openingBalances, setOpeningBalances] = useState<OpeningBalances>(
    currentYearData?.openingBalances || { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 }
  );
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [prevReceivables, setPrevReceivables] = useState<PrevReceivable[]>([]);
  const [newRecDate, setNewRecDate] = useState('');
  const [newRecAmount, setNewRecAmount] = useState<number | ''>('');

  // 前年データから期首残高を計算するロジック（型を明示）
  const performCarryOverCalc = (prevData: YearData): OpeningBalances => {
    // デフォルト値を設定し、必須プロパティの欠損を防ぐ
    const prevBal = prevData.openingBalances || { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 };
    const prevSales = prevData.sales || [];
    const prevPurchases = prevData.purchases || [];
    const prevExpenses = prevData.expenses || [];
    const prevInventory = prevData.inventory || [];
    const prevRec = (prevData as any).previousReceivables || [];

    const totalSales = prevSales.reduce((sum: number, sale: any) => sum + (sale.amount || 0), 0);
    const totalPurchases = prevPurchases.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const totalExpenses = prevExpenses.reduce((sum: number, exp: any) => {
      return sum + calculateApportionedExpense(exp.amount || 0, exp.isApportioned, prevData.apportionRate || 1);
    }, 0);
    const closingInventory = prevInventory.reduce((sum: number, item: any) => sum + (item.totalAmount || 0), 0);
    
    const costOfSales = (prevBal['商品'] || 0) + totalPurchases - closingInventory;
    const income = totalSales - costOfSales - totalExpenses;

    const uncollectedSales = prevSales.filter((s: any) => s.depositDate === '').reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    const collectedSales = prevSales.filter((s: any) => s.depositDate !== '').reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    const prevRecTotal = prevRec.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

    const closingAccountsReceivable = (prevBal['売掛金'] || 0) - prevRecTotal + uncollectedSales;

    const jigyoDr = collectedSales + prevRecTotal;
    const jigyoCr = totalPurchases + totalExpenses;
    const jigyoBalance = jigyoDr - jigyoCr;
    const closingJigyoKashi = jigyoBalance > 0 ? jigyoBalance : 0;
    const closingJigyoKari = jigyoBalance < 0 ? Math.abs(jigyoBalance) : 0;

    const openingMotouire = (prevBal['元入金'] || 0) + (prevBal['青色申告特別控除前の所得金額'] || 0) + (prevBal['事業主借'] || 0) - (prevBal['事業主貸'] || 0);
    const nextMotouire = openingMotouire + income + closingJigyoKari - closingJigyoKashi;

    return {
      ...prevBal,
      '売掛金': closingAccountsReceivable,
      '商品': closingInventory,
      '元入金': nextMotouire,
      '青色申告特別控除前の所得金額': 0,
      '事業主貸': 0,
      '事業主借': 0,
    };
  };

  // 【追加】対象年度のデータ枠がない場合に自動作成してローディングブロックを解除する処理
  useEffect(() => {
    if (appData && !currentYearData) {
      // TypeScriptエラーを防ぐため型注釈を明示
      let newOpeningBalances: OpeningBalances = { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 };
      const prevYearStr = (parseInt(currentYear) - 1).toString();
      const prevYearData = appData.years[prevYearStr];
      
      // 前年データが存在すれば繰越計算を実行
      if (prevYearData) {
         newOpeningBalances = performCarryOverCalc(prevYearData);
      }
      
      setAppData({
        ...appData,
        years: {
          ...appData.years,
          [currentYear]: {
            apportionRate: 1,
            openingBalances: newOpeningBalances,
            sales: [],
            expenses: [],
            purchases: [],
            inventory: []
          }
        }
      });
    }
  }, [appData, currentYear, currentYearData, setAppData]);

  useEffect(() => {
    if (currentYearData) {
      const balances = currentYearData.openingBalances || { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 };
      setOpeningBalances(balances);

      const initialInputs: Record<string, string> = {};
      Object.keys(balances).forEach(key => {
        initialInputs[key] = balances[key] === 0 ? '' : balances[key].toString();
      });
      setInputValues(initialInputs);

      setPrevReceivables((currentYearData as any).previousReceivables || []);
    }
  }, [currentYearData]);

  // すべてのフックを呼び出した後に早期リターンを実行する
  if (!currentYearData || !appData) {
    return <div className="p-8 text-center text-gray-500">データを読み込み中です...</div>;
  }

  const prevYear = (parseInt(currentYear) - 1).toString();
  const hasPreviousYearData = !!appData.years[prevYear];

  const saveSettings = (balances: OpeningBalances, receivables: PrevReceivable[] = prevReceivables) => {
    if (!appData) return;
    const yearData = appData.years[currentYear];
    setAppData({
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          openingBalances: balances,
          previousReceivables: receivables,
        } as any,
      },
    });
  };

  const handleBalanceChange = (key: string, value: string) => {
    setInputValues(prev => ({ ...prev, [key]: value }));

    let numValue = parseInt(value, 10);
    if (isNaN(numValue)) numValue = 0;

    const newBalances = { ...openingBalances, [key]: numValue };
    setOpeningBalances(newBalances);
    saveSettings(newBalances, prevReceivables);
  };

  const handleAddPrevReceivable = () => {
    if (!newRecDate || newRecAmount === '') return;
    const newItems = [...prevReceivables, { id: crypto.randomUUID(), date: newRecDate, amount: Number(newRecAmount) }];
    setPrevReceivables(newItems);
    saveSettings(openingBalances, newItems);
    setNewRecDate('');
    setNewRecAmount('');
  };

  const handleDeletePrevReceivable = (id: string) => {
    const newItems = prevReceivables.filter(r => r.id !== id);
    setPrevReceivables(newItems);
    saveSettings(openingBalances, newItems);
  };

  const handleRecKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPrevReceivable();
    }
  };

  // 【追加】手動で繰越計算を実行する処理
  const handleManualCarryOver = () => {
    const prevYearData = appData.years[prevYear];
    if (!prevYearData) {
      alert('前年のデータが存在しません。');
      return;
    }

    if (window.confirm('前年の期末残高を再計算して、現在の入力値を上書きしますか？\n（本年の固定資産などは前年と同じ値がセットされ、売掛金や商品、元入金などは自動計算されます）')) {
      const calculated = performCarryOverCalc(prevYearData);
      setAppData({
        ...appData,
        years: {
          ...appData.years,
          [currentYear]: {
            ...currentYearData,
            openingBalances: calculated
          }
        }
      });
      alert('前年の期末残高を計算し、反映しました。\n※どんぶり帳簿では入出金済みの残高はすべて相殺されるため、売掛金や在庫などがなければ残高は0円になります。');
    }
  };

  const handleResetData = () => {
    if (!appData) return;
    if (window.confirm('本当にすべてのデータを初期化しますか？\n※この操作は取り消せません。Google Drive上のデータも真っ新な状態に上書きされます。')) {
      const initialData: AppData = {
        version: "1.4",
        userId: appData.userId,
        years: {
          [currentYear]: {
            apportionRate: 1,
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
  };

  const renderAccountInput = (accountName: string) => {
    const recommended = ['売掛金', '事業主貸', '元入金', '青色申告特別控除前の所得金額'].includes(accountName);
    const displayValue = inputValues[accountName] !== undefined ? inputValues[accountName] : '';
    
    return (
      <div key={accountName} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
        <label className={`block text-sm ${recommended ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
          {accountName}
        </label>
        <div className="relative rounded-md shadow-sm w-1/2">
          <input
            type="text"
            inputMode="numeric"
            value={displayValue}
            onChange={(e) => {
              const rawValue = e.target.value.replace(/[^-0-9]/g, '');
              handleBalanceChange(accountName, rawValue);
            }}
            className={`focus:ring-blue-500 focus:border-blue-500 block w-full pl-3 pr-8 sm:text-sm rounded-md py-1.5 border text-right transition-colors ${!recommended ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-gray-300'}`}
            placeholder={recommended ? "0" : "0（非推奨）"}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className={`sm:text-sm ${recommended ? 'text-gray-500' : 'text-gray-400'}`}>円</span>
          </div>
        </div>
      </div>
    );
  };

  const prevReceivablesTotal = prevReceivables.reduce((sum, r) => sum + r.amount, 0);
  const openingAccountsReceivable = openingBalances['売掛金'] || 0;
  const isReceivablesMismatch = !hasPreviousYearData && prevReceivablesTotal !== openingAccountsReceivable;

  const totalAssets = ASSET_ACCOUNTS.reduce((sum, account) => sum + (openingBalances[account] || 0), 0);
  const totalLiabilitiesAndCapital = [...LIABILITY_ACCOUNTS, ...CAPITAL_ACCOUNTS].reduce((sum, account) => sum + (openingBalances[account] || 0), 0);
  const isBalanceMatch = totalAssets === totalLiabilitiesAndCapital;

  const dataSize = appData ? new Blob([JSON.stringify(appData)]).size : 0;
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8">
      
      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg leading-6 font-medium text-gray-900">開始仕訳（期首残高）</h3>
          <p className="mt-1 text-sm text-gray-500">
            2年目以降の場合に入力してください。前年末の貸借対照表の数値を入力します。システムで自動繰越された場合はその数値が表示されています。
          </p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            
            <div>
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h4 className="text-md font-medium text-gray-900">資産の部</h4>
                {hasPreviousYearData && (
                  <button
                    onClick={handleManualCarryOver}
                    className="text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded border border-blue-200 transition-colors"
                  >
                    前年から再計算
                  </button>
                )}
              </div>
              <div className="space-y-1">
                {ASSET_ACCOUNTS.map(renderAccountInput)}
              </div>
            </div>

            <div className="space-y-10">
              
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">前年売掛金のうち、本年入金されたもの</h4>
                {hasPreviousYearData ? (
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded text-sm text-blue-800 shadow-sm">
                    前年帳簿をどんぶり帳簿でつけているため、入力の必要はありません。（自動で連携されます）
                  </div>
                ) : (
                  <div className="space-y-3">
                    <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 w-2/5">入金日</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 w-2/5 border-l border-gray-200">金額 (円)</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-1/5 border-l border-gray-200">操作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr className="bg-blue-50/50">
                          <td className="p-0">
                             <input type="date" value={newRecDate} onChange={e => setNewRecDate(e.target.value)} onKeyDown={handleRecKeyDown} className="block w-full border-0 bg-transparent py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500" />
                          </td>
                          <td className="p-0 border-l border-gray-200">
                             <input type="number" value={newRecAmount} onChange={e => setNewRecAmount(parseInt(e.target.value, 10) || '')} onKeyDown={handleRecKeyDown} placeholder="0" className="block w-full border-0 bg-transparent py-2 px-3 text-sm text-right focus:ring-2 focus:ring-blue-500" />
                          </td>
                          <td className="p-0 border-l border-gray-200 text-center">
                            <button onClick={handleAddPrevReceivable} disabled={!newRecDate || newRecAmount === ''} className="text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded px-2 py-1 text-xs">追加</button>
                          </td>
                        </tr>
                        {prevReceivables.map(r => (
                          <tr key={r.id}>
                            <td className="py-2 px-3 text-sm">{r.date}</td>
                            <td className="py-2 px-3 text-sm text-right border-l border-gray-200">{r.amount.toLocaleString()}</td>
                            <td className="py-2 px-3 text-center border-l border-gray-200">
                              <button onClick={() => handleDeletePrevReceivable(r.id)} className="text-gray-400 hover:text-red-600 p-1">
                                <svg className="h-4 w-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    
                    {isReceivablesMismatch && (
                      <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                        エラー：入金金額の合計（{prevReceivablesTotal.toLocaleString()}円）が、資産の部の売掛金（{openingAccountsReceivable.toLocaleString()}円）と一致しません。
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">資本の部</h4>
                <div className="space-y-1">
                  {CAPITAL_ACCOUNTS.map(renderAccountInput)}
                </div>
              </div>
              
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">負債の部</h4>
                <div className="space-y-1">
                  {LIABILITY_ACCOUNTS.map(renderAccountInput)}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 p-4 rounded text-sm text-blue-800 leading-relaxed shadow-sm">
                どんぶり帳簿のロジックにより、資金の出入りは<strong>事業主勘定</strong>に集約されます。<br/>
                そのため、売掛金、事業主貸、元入金 以外の科目（現預金や未払金など）に数値を入力して残高管理を行うことは推奨していません。
              </div>
            </div>

          </div>
        </div>
        
        <div className="px-4 py-4 sm:px-6 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-col sm:flex-row justify-between items-center text-sm">
            <div className="flex space-x-6 mb-2 sm:mb-0">
              <div>
                <span className="text-gray-500 mr-2">資産の部 合計:</span>
                <span className="font-bold text-gray-900">{totalAssets.toLocaleString()} 円</span>
              </div>
              <div>
                <span className="text-gray-500 mr-2">負債・資本の部 合計:</span>
                <span className="font-bold text-gray-900">{totalLiabilitiesAndCapital.toLocaleString()} 円</span>
              </div>
            </div>
            <div>
              {isBalanceMatch ? (
                <span className="text-green-600 font-bold flex items-center bg-green-50 px-3 py-1 rounded-full border border-green-200">
                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  貸借一致
                </span>
              ) : (
                <span className="text-red-600 font-bold flex items-center bg-red-50 px-3 py-1 rounded-full border border-red-200">
                  <svg className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  差額: {Math.abs(totalAssets - totalLiabilitiesAndCapital).toLocaleString()} 円
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg p-6 border-t-4 border-red-500">
        <h3 className="text-lg font-medium text-red-600 border-b pb-4 mb-6">危険な操作</h3>
        <p className="text-sm text-gray-500 mb-6">
          入力した仕訳などのすべてのデータを初期化し、真っ新な状態に戻します。旧データの不整合をリセットしたい場合に使用してください。
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <button
            onClick={handleResetData}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            全データを初期化する
          </button>
          <span className="text-sm text-gray-500 font-medium">
            現在のデータ容量: {formatBytes(dataSize)}
          </span>
        </div>
      </div>

    </div>
  );
};