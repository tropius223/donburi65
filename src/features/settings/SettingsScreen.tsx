import React, { useState, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import type { OpeningBalances } from '../../types';

const ASSET_ACCOUNTS = [
  '売掛金', '事業主貸', '現金', '当座預金', '定期預金', 'その他の預金', '受取手形', '有価証券',
  '棚卸資産', '前払金', '貸付金', '建物', '建物附属設備', '機械装置', '車両運搬具',
  '工具・器具・備品', '土地'
];

const LIABILITY_ACCOUNTS = [
  '支払手形', '買掛金', '借入金', '未払金', '前受金', '預り金', '貸倒引当金', '事業主借'
];

const CAPITAL_ACCOUNTS = [
  '元入金'
];

type PrevReceivable = { id: string; date: string; amount: number };

export const SettingsScreen: React.FC = () => {
  const currentYearData = useStore((state) => state.getCurrentYearData());
  const appData = useStore((state) => state.appData);
  const setAppData = useStore((state) => state.setAppData);
  const currentYear = useStore((state) => state.currentYear);

  if (!currentYearData || !appData) {
    return <div className="p-8 text-center text-gray-500">データを読み込み中です...</div>;
  }

  // 期首残高のステート
  const [openingBalances, setOpeningBalances] = useState<OpeningBalances>(
    currentYearData.openingBalances || { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 }
  );
  const [inputValues, setInputValues] = useState<Record<string, string>>({});

  // 前年売掛金の回収入力用ステート
  const [prevReceivables, setPrevReceivables] = useState<PrevReceivable[]>([]);
  const [newRecDate, setNewRecDate] = useState('');
  const [newRecAmount, setNewRecAmount] = useState<number | ''>('');

  // 前年データが存在するか判定（どんぶり帳簿で前年分をつけているか）
  const prevYear = (parseInt(currentYear) - 1).toString();
  const hasPreviousYearData = !!appData.years[prevYear];

  // データ同期
  useEffect(() => {
    if (currentYearData) {
      
      const balances = currentYearData.openingBalances || { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 };
      setOpeningBalances(balances);

      const initialInputs: Record<string, string> = {};
      Object.keys(balances).forEach(key => {
        initialInputs[key] = balances[key] === 0 ? '' : balances[key].toString();
      });
      setInputValues(initialInputs);

      // 前年売掛金の読み込み
      setPrevReceivables((currentYearData as any).previousReceivables || []);
    }
  }, [currentYearData]);

  // 設定の保存処理
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
          // 型定義拡張を避けるため any として保存
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

  // 前年売掛金の追加処理
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

  const renderAccountInput = (accountName: string) => {
    const recommended = ['売掛金', '事業主貸', '元入金'].includes(accountName);
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

  // 売掛金の一致確認
  const prevReceivablesTotal = prevReceivables.reduce((sum, r) => sum + r.amount, 0);
  const openingAccountsReceivable = openingBalances['売掛金'] || 0;
  // 過去の帳簿データがない場合のみ、金額の不一致をチェックする
  const isReceivablesMismatch = !hasPreviousYearData && prevReceivablesTotal !== openingAccountsReceivable;

  return (
    <div className="space-y-8">
      
      {/* 開始仕訳の設定 */}
      <div className="bg-white shadow sm:rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg leading-6 font-medium text-gray-900">開始仕訳（期首残高）</h3>
          <p className="mt-1 text-sm text-gray-500">
            2年目以降の場合に入力してください。前年末の貸借対照表の数値を入力します。システムで自動繰越された場合はその数値が表示されています。
          </p>
        </div>
        <div className="px-4 py-5 sm:p-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            
            {/* 左カラム：資産の部 */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4 border-b pb-2">資産の部</h4>
              <div className="space-y-1">
                {ASSET_ACCOUNTS.map(renderAccountInput)}
              </div>
            </div>

            {/* 右カラム：前年売掛金・資本の部・負債の部 */}
            <div className="space-y-10">
              
              {/* 前年売掛金の回収予定 */}
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
      </div>

    </div>
  );
};