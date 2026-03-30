import React, { useState, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import type { OpeningBalances, AppData } from '../../types';

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

const performCarryOverCalc = (prevData: YearData, prevYearStr: string): OpeningBalances => {
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

  const uncollectedSales = prevSales.filter((s: any) => !s.depositDate || s.depositDate > `${prevYearStr}-12-31`).reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
  const collectedSales = prevSales.filter((s: any) => s.depositDate && s.depositDate <= `${prevYearStr}-12-31`).reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
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

export const SettingsScreen: React.FC = () => {
  const appData = useStore((state) => state.appData);
  const currentYear = useStore((state) => state.currentYear);

  // フック（useState, useEffect）は必ず早期リターンの前に配置する
  const [openingBalances, setOpeningBalances] = useState<OpeningBalances>(
    currentYearData?.openingBalances || { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 }
  );
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [prevReceivables, setPrevReceivables] = useState<PrevReceivable[]>([]);
  const [newRecDate, setNewRecDate] = useState('');
  const [newRecAmount, setNewRecAmount] = useState<number | ''>('');

  useEffect(() => {
    if (appData && !appData.years[currentYear]) {
      let newOpeningBalances: OpeningBalances = { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 };
      const prevYearStr = (parseInt(currentYear) - 1).toString();
      const prevYearData = appData.years[prevYearStr];
      
      if (prevYearData) {
         newOpeningBalances = performCarryOverCalc(prevYearData, prevYearStr);
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
  }, [appData, currentYear, setAppData]);

  const hasAutoRecovered = useRef(false);

  // エラーでクラッシュしない安全な自動繰越計算ロジック
  const performCarryOverCalc = (prevData: YearData) => {
    const prevBal = prevData.openingBalances || {};
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

    const newBalances: OpeningBalances = { ...prevBal };
    newBalances['売掛金'] = closingAccountsReceivable;
    newBalances['商品'] = closingInventory;
    newBalances['元入金'] = nextMotouire;
    newBalances['青色申告特別控除前の所得金額'] = 0;
    newBalances['事業主貸'] = 0;
    newBalances['事業主借'] = 0;

    return newBalances;
  };

  // 無限ループを回避しつつ、マウント時および年度変更時に1回だけ確実に実行する処理
  useEffect(() => {
    const currentAppData = useStore.getState().appData;
    if (!currentAppData) return;

    const currentData = currentAppData.years[currentYear];
    const prevYearStr = (parseInt(currentYear) - 1).toString();
    const prevData = currentAppData.years[prevYearStr];

    if (currentData) {
      const balances = currentData.openingBalances || { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 };
      setOpeningBalances(balances);
      
      const inputs: Record<string, string> = {};
      Object.keys(balances).forEach(k => {
        inputs[k] = balances[k] === 0 ? '' : balances[k].toString();
      });
      setInputValues(initialInputs);

      setPrevReceivables((currentYearData as any).previousReceivables || []);
    }
  }, [currentYearData]);

  // すべてのフックを呼び出した後に早期リターンを実行する
  if (!currentYearData || !appData) {
    return <div className="p-8 text-center text-gray-500">データを読み込み中です...</div>;
  }

  const saveSettings = (balances: OpeningBalances, receivables: PrevReceivable[] = prevReceivables) => {
    const currentAppData = useStore.getState().appData;
    if (!currentAppData) return;
    const yearData = currentAppData.years[currentYear] || { apportionRate: 1, sales: [], expenses: [], purchases: [], inventory: [] };
    
    setAppData({
      ...currentAppData,
      years: {
        ...currentAppData.years,
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

  const handleResetData = () => {
    if (!appData) return;
    if (window.confirm(`本当に【${currentYear}年度】のデータを初期化しますか？\n他の年度のデータは保持されますが、この年度に入力したデータは真っ新になります。`)) {
      setAppData({
        ...appData,
        years: {
          ...appData.years,
          [currentYear]: {
            apportionRate: 1,
            openingBalances: { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 },
            sales: [],
            expenses: [],
            purchases: [],
            inventory: []
          }
        }
      });
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

  const renderDebugInfo = () => {
    const prevYearData = appData?.years[prevYear];
    if (!prevYearData) return <p className="text-gray-500">前年のデータは存在しません。</p>;

    const prevSales = prevYearData.sales || [];
    const uncollectedSales = prevSales.filter((s: any) => !s.depositDate || s.depositDate > `${prevYear}-12-31`).reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    const collectedSales = prevSales.filter((s: any) => s.depositDate && s.depositDate <= `${prevYear}-12-31`).reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
    const calc = performCarryOverCalc(prevYearData, prevYear);

    return (
      <div className="mt-4 p-4 bg-gray-100 rounded text-xs font-mono text-gray-700 space-y-1">
        <p className="font-bold border-b border-gray-300 mb-2 pb-1">内部データ確認用：前年({prevYear})の計算状況</p>
        <p>未回収の売上合計 (入金日が未定のもの): {uncollectedSales.toLocaleString()} 円</p>
        <p>入金済みの売上合計: {collectedSales.toLocaleString()} 円</p>
        <p>計算された次期繰越の売掛金: {calc['売掛金'].toLocaleString()} 円</p>
        <p>計算された次期繰越の元入金: {calc['元入金'].toLocaleString()} 円</p>
        <p className="mt-2 text-gray-500">※入金済みの売上は、事業主勘定と相殺されるため元入金を増加させません。</p>
      </div>
    );
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
                  <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded text-sm text-blue-800 shadow-sm">
                      前年帳簿をどんぶり帳簿でつけているため、ここでの手入力は必要ありません。（自動で連携されます）
                    </div>
                    {hasUncollectedSalesFromPrevYear && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded text-sm text-yellow-800 shadow-sm">
                        <p className="font-bold mb-1 text-yellow-900">【前年から繰り越された未回収の売掛金があります】</p>
                        <p className="leading-relaxed">
                          前年（{prevYear}年）の帳簿に、入金日が未定（または本年以降）の売上（計 {uncollectedSalesFromPrevYear.toLocaleString()} 円）が残っています。<br/>
                          入金日が確定しだい、画面上部の「年度」を <strong>{prevYear}年</strong> に切り替えて、売上帳の該当データに「入金日」を入力してください。<br/>
                          入力すると、本年の帳簿に自動で入金が反映されます。
                        </p>
                      </div>
                    )}
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
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
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

      <div className="bg-white shadow sm:rounded-lg p-6 border-t-4 border-gray-300">
        <h3 className="text-lg font-medium text-gray-800 border-b pb-4 mb-6">デバッグ用情報</h3>
        {renderDebugInfo()}
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
            {currentYear}年度のデータを初期化する
          </button>
          <span className="text-sm text-gray-500 font-medium">
            全体データ容量: {formatBytes(dataSize)}
          </span>
        </div>
      </div>

    </div>
  );
};