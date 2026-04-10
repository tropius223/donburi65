import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import type { Sale } from '../../types';

// 既存の売上明細を編集・表示するための行コンポーネント
const SaleRow = ({ sale, currentYear, onUpdate, onDelete }: { sale: Sale; currentYear: string; onUpdate: (s: Sale) => void; onDelete: (id: string) => void }) => {
  const [editData, setEditData] = useState(sale);
  const [displayAmount, setDisplayAmount] = useState(sale.amount === 0 ? '' : sale.amount.toLocaleString());

  // 親の状態が変更されたらローカル状態も同期する
  useEffect(() => {
    setEditData(sale);
    setDisplayAmount(sale.amount === 0 ? '' : sale.amount.toLocaleString());
  }, [sale]);

  const handleChange = (field: keyof Sale, value: string | number) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 数字以外の文字を削除
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (!raw) {
      setDisplayAmount('');
      handleChange('amount', 0);
    } else {
      const num = parseInt(raw, 10);
      setDisplayAmount(num.toLocaleString());
      handleChange('amount', num);
    }
  };

  const handleBlur = () => {
    // 変更があり、かつ必須項目が入力されている場合のみ親を更新
    if (JSON.stringify(editData) !== JSON.stringify(sale)) {
      // 売上日が現在の年度と一致しているかチェック
      if (editData.salesDate && editData.salesDate.startsWith(currentYear) && editData.client && editData.amount >= 0) {
        onUpdate(editData);
      } else {
        // 不正な値の場合は元に戻す
        setEditData(sale);
        setDisplayAmount(sale.amount === 0 ? '' : sale.amount.toLocaleString());
      }
    }
  };

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-200 transition-colors">
      <td className="p-0">
        <input type="date" min={`${currentYear}-01-01`} max={`${currentYear}-12-31`} value={editData.salesDate} onChange={(e) => handleChange('salesDate', e.target.value)} onBlur={handleBlur} className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
      </td>
      <td className="p-0 border-l border-gray-200">
        <input
          type="date"
          min={editData.salesDate}
          value={editData.depositDate}
          onChange={(e) => handleChange('depositDate', e.target.value)}
          onBlur={handleBlur}
          className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm"
        />
      </td>
      <td className="p-0 border-l border-gray-200">
        <input type="text" list="client-list" value={editData.client} onChange={(e) => handleChange('client', e.target.value)} onBlur={handleBlur} placeholder="売上先を入力" className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
      </td>
      <td className="p-0 border-l border-gray-200">
        <input 
          type="text" 
          inputMode="numeric"
          value={displayAmount} 
          onChange={handleAmountChange} 
          onBlur={handleBlur} 
          placeholder="0" 
          className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-right font-medium" 
        />
      </td>
      <td className="p-0 border-l border-gray-200 text-center align-middle">
        <button onClick={() => onDelete(sale.id)} className="text-gray-400 hover:text-red-600 transition-colors p-2" title="削除">
          <svg className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  );
};

export const SalesScreen: React.FC = () => {
  const currentYearData = useStore((state) => state.getCurrentYearData());
  const appData = useStore((state) => state.appData);
  const setAppData = useStore((state) => state.setAppData);
  const currentYear = useStore((state) => state.currentYear);
  const addLog = useStore((state) => state.addLog);

  // 前年の未回収売掛金が存在するかどうかの判定
  const prevYear = (parseInt(currentYear) - 1).toString();
  const prevYearDataForUI = appData?.years[prevYear];
  const hasPreviousYearData = !!prevYearDataForUI;

  const uncollectedSalesFromPrevYear = React.useMemo(() => {
    if (!prevYearDataForUI || !prevYearDataForUI.sales) return 0;
    return prevYearDataForUI.sales
      .filter((s: any) => !s.depositDate || s.depositDate > `${prevYear}-12-31`)
      .reduce((sum: number, s: any) => sum + (s.amount || 0), 0);
  }, [prevYearDataForUI, prevYear]);
  const hasUncollectedSalesFromPrevYear = uncollectedSalesFromPrevYear > 0;

  // 新規入力行のステート
  const [newSalesDate, setNewSalesDate] = useState('');
  const [newDepositDate, setNewDepositDate] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newAmountDisplay, setNewAmountDisplay] = useState('');

  // 取引先の重複なしリストを生成
  const clientOptions = useMemo(() => {
    if (!currentYearData) return [];
    const clients = currentYearData.sales.map(s => s.client).filter(c => c.trim() !== '');
    return Array.from(new Set(clients));
  }, [currentYearData]);

  if (!currentYearData && !appData) {
    return <div>データを読み込み中です...</div>;
  }

  const sales = currentYearData?.sales || [];
  const totalSales = sales.reduce((sum, s) => sum + s.amount, 0);

  // Zustandのデータを更新するヘルパー
  const updateStoreSales = (updatedSales: Sale[]) => {
    if (!appData) return;
    const yearData = appData.years[currentYear] || {
      apportionRate: 1,
      openingBalances: { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 },
      sales: [], expenses: [], purchases: [], inventory: []
    };
    
    // 日付順にソートして保存
    const sortedSales = [...updatedSales].sort((a, b) => a.salesDate.localeCompare(b.salesDate));

    setAppData({
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          sales: sortedSales
        }
      }
    });
  };

  const handleUpdateSale = (updatedSale: Sale) => {
    const updatedSales = sales.map((s) => (s.id === updatedSale.id ? updatedSale : s));
    updateStoreSales(updatedSales);
    addLog('売上データの更新', `売上先: ${updatedSale.client}, 金額: ${updatedSale.amount}円`);
  };

  const handleDeleteSale = (id: string) => {
    const target = sales.find(s => s.id === id);
    const updatedSales = sales.filter((s) => s.id !== id);
    updateStoreSales(updatedSales);
    if (target) addLog('売上データの削除', `売上先: ${target.client}, 金額: ${target.amount}円`);
  };

  const handleNewAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (!raw) {
      setNewAmountDisplay('');
      setNewAmount('');
    } else {
      const num = parseInt(raw, 10);
      setNewAmountDisplay(num.toLocaleString());
      setNewAmount(num);
    }
  };

  const handleAddSale = () => {
    if (!newSalesDate || !newSalesDate.startsWith(currentYear) || !newClient || newAmount === '') return;

    const newSale: Sale = {
      id: crypto.randomUUID(),
      salesDate: newSalesDate,
      depositDate: newDepositDate,
      client: newClient,
      amount: newAmount as number,
    };

    updateStoreSales([...sales, newSale]);
    addLog('売上データの追加', `売上先: ${newClient}, 金額: ${newAmount}円`);

    // 入力欄をクリア
    setNewSalesDate('');
    setNewDepositDate('');
    setNewClient('');
    setNewAmount('');
    setNewAmountDisplay('');
  };

  // エンターキーで追加を実行
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSale();
    }
  };

  return (
    <div className="space-y-6">
      {/* サジェスト用のデータリストを追加 */}
      <datalist id="client-list">
        {clientOptions.map((client, index) => (
          <option key={index} value={client} />
        ))}
      </datalist>

      {hasPreviousYearData && hasUncollectedSalesFromPrevYear && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800 font-bold mb-1">【前年から繰り越された未回収の売掛金があります】</p>
              <p className="text-sm text-yellow-700 leading-relaxed">
                前年（{prevYear}年）の帳簿に、入金日が未定（または本年以降）の売上（計 {uncollectedSalesFromPrevYear.toLocaleString()} 円）が残っています。<br/>
                入金日が確定しだい、画面上部の「年度」を <strong>{prevYear}年</strong> に切り替えて、該当データに「入金日」を入力してください。
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow sm:rounded-lg overflow-hidden flex flex-col">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">売上帳</h3>
            <p className="mt-1 text-sm text-gray-500">一覧を直接編集できます。一番上の空白行に入力して追加します。</p>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500 mr-2">本年売上合計</span>
            <span className="text-2xl font-bold text-gray-900">{totalSales.toLocaleString()} <span className="text-base font-normal">円</span></span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border-b border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">売上日</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 border-l border-gray-200">
                  入金日 <span className="font-normal normal-case opacity-75">(未定は空欄)</span>
                </th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/6 border-l border-gray-200">売上先</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 border-l border-gray-200">金額 (円)</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12 border-l border-gray-200">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* 新規追加用の空白行 */}
              <tr className="bg-blue-50/50 hover:bg-blue-50 transition-colors border-b-2 border-blue-200">
                <td className="p-0">
                  <input type="date" min={`${currentYear}-01-01`} max={`${currentYear}-12-31`} value={newSalesDate} onChange={(e) => setNewSalesDate(e.target.value)} onKeyDown={handleKeyDown} className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-blue-900 placeholder-blue-300" />
                </td>
                <td className="p-0 border-l border-gray-200">
                  <input
                    type="date"
                    min={newSalesDate}
                    value={newDepositDate}
                    onChange={(e) => setNewDepositDate(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-blue-900 placeholder-blue-300"
                  />
                </td>
                <td className="p-0 border-l border-gray-200">
                  <input type="text" list="client-list" value={newClient} onChange={(e) => setNewClient(e.target.value)} onKeyDown={handleKeyDown} placeholder="新規売上先を追加..." className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-blue-900 placeholder-blue-400 font-medium" />
                </td>
                <td className="p-0 border-l border-gray-200">
                  <input 
                    type="text" 
                    inputMode="numeric"
                    value={newAmountDisplay} 
                    onChange={handleNewAmountChange} 
                    onKeyDown={handleKeyDown} 
                    placeholder="0" 
                    className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-right font-bold text-blue-900 placeholder-blue-300" 
                  />
                </td>
                <td className="p-0 border-l border-gray-200 text-center align-middle">
                  <button onClick={handleAddSale} disabled={!newSalesDate || !newSalesDate.startsWith(currentYear) || !newClient || newAmount === ''} className="text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded px-3 py-1.5 text-sm font-medium transition-colors m-1 shadow-sm">
                    追加
                  </button>
                </td>
              </tr>

              {/* 既存の明細行 */}
              {sales.map((sale) => (
                <SaleRow key={sale.id} sale={sale} currentYear={currentYear} onUpdate={handleUpdateSale} onDelete={handleDeleteSale} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};