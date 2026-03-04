import React, { useState, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import type { Sale } from '../../types';

// 既存の売上明細を編集・表示するための行コンポーネント
const SaleRow = ({ sale, onUpdate, onDelete }: { sale: Sale; onUpdate: (s: Sale) => void; onDelete: (id: string) => void }) => {
  const [editData, setEditData] = useState(sale);

  // 親の状態が変更されたらローカル状態も同期する
  useEffect(() => {
    setEditData(sale);
  }, [sale]);

  const handleChange = (field: keyof Sale, value: string | number) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleBlur = () => {
    // 変更があり、かつ必須項目が入力されている場合のみ親を更新
    if (JSON.stringify(editData) !== JSON.stringify(sale)) {
      if (editData.salesDate && editData.client && editData.amount >= 0) {
        onUpdate(editData);
      } else {
        // 不正な値の場合は元に戻す
        setEditData(sale);
      }
    }
  };

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-200 transition-colors">
      <td className="p-0">
        <input type="date" value={editData.salesDate} onChange={(e) => handleChange('salesDate', e.target.value)} onBlur={handleBlur} className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
      </td>
      <td className="p-0 border-l border-gray-200">
        <input type="date" value={editData.depositDate} onChange={(e) => handleChange('depositDate', e.target.value)} onBlur={handleBlur} className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
      </td>
      <td className="p-0 border-l border-gray-200">
        <input type="text" value={editData.client} onChange={(e) => handleChange('client', e.target.value)} onBlur={handleBlur} placeholder="売上先を入力" className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
      </td>
      <td className="p-0 border-l border-gray-200">
        <input type="number" value={editData.amount === 0 ? '' : editData.amount} onChange={(e) => handleChange('amount', parseInt(e.target.value, 10) || 0)} onBlur={handleBlur} placeholder="0" className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-right font-medium" />
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

  // 新規入力行のステート
  const [newSalesDate, setNewSalesDate] = useState('');
  const [newDepositDate, setNewDepositDate] = useState('');
  const [newClient, setNewClient] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');

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
  };

  const handleDeleteSale = (id: string) => {
    const updatedSales = sales.filter((s) => s.id !== id);
    updateStoreSales(updatedSales);
  };

  const handleAddSale = () => {
    if (!newSalesDate || !newClient || newAmount === '') return;

    const newSale: Sale = {
      id: crypto.randomUUID(),
      salesDate: newSalesDate,
      depositDate: newDepositDate,
      client: newClient,
      amount: newAmount as number,
    };

    updateStoreSales([...sales, newSale]);

    // 入力欄をクリア
    setNewSalesDate('');
    setNewDepositDate('');
    setNewClient('');
    setNewAmount('');
  };

  // エンターキーで追加を実行
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddSale();
    }
  };

  return (
    <div className="space-y-6">
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
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 border-l border-gray-200">入金日 (未定は空欄)</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/6 border-l border-gray-200">売上先</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6 border-l border-gray-200">金額 (円)</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12 border-l border-gray-200">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* 新規追加用の空白行 */}
              <tr className="bg-blue-50/50 hover:bg-blue-50 transition-colors border-b-2 border-blue-200">
                <td className="p-0">
                  <input type="date" value={newSalesDate} onChange={(e) => setNewSalesDate(e.target.value)} onKeyDown={handleKeyDown} className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-blue-900 placeholder-blue-300" />
                </td>
                <td className="p-0 border-l border-gray-200">
                  <input type="date" value={newDepositDate} onChange={(e) => setNewDepositDate(e.target.value)} onKeyDown={handleKeyDown} className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-blue-900 placeholder-blue-300" />
                </td>
                <td className="p-0 border-l border-gray-200">
                  <input type="text" value={newClient} onChange={(e) => setNewClient(e.target.value)} onKeyDown={handleKeyDown} placeholder="新規売上先を追加..." className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-blue-900 placeholder-blue-400 font-medium" />
                </td>
                <td className="p-0 border-l border-gray-200">
                  <input type="number" value={newAmount} onChange={(e) => setNewAmount(parseInt(e.target.value, 10) || '')} onKeyDown={handleKeyDown} placeholder="0" className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-right font-bold text-blue-900 placeholder-blue-300" />
                </td>
                <td className="p-0 border-l border-gray-200 text-center align-middle">
                  <button onClick={handleAddSale} disabled={!newSalesDate || !newClient || newAmount === ''} className="text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded px-3 py-1.5 text-sm font-medium transition-colors m-1 shadow-sm">
                    追加
                  </button>
                </td>
              </tr>

              {/* 既存の明細行 */}
              {sales.map((sale) => (
                <SaleRow key={sale.id} sale={sale} onUpdate={handleUpdateSale} onDelete={handleDeleteSale} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};