import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import type { Purchase } from '../../types';

const PurchaseRow = ({ purchase, currentYear, onUpdate, onDelete }: { purchase: Purchase; currentYear: string; onUpdate: (p: Purchase) => void; onDelete: (id: string) => void }) => {
// ... PurchaseRow の内容は変更なし ...
  const [editData, setEditData] = useState(purchase);
  const [displayAmount, setDisplayAmount] = useState(purchase.amount === 0 ? '' : purchase.amount.toLocaleString());

  useEffect(() => {
    setEditData(purchase);
    setDisplayAmount(purchase.amount === 0 ? '' : purchase.amount.toLocaleString());
  }, [purchase]);

  const handleChange = (field: keyof Purchase, value: string | number) => {
    setEditData({ ...editData, [field]: value });
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (JSON.stringify(editData) !== JSON.stringify(purchase)) {
      if (editData.date && editData.date.startsWith(currentYear) && editData.supplier && editData.amount >= 0) {
        onUpdate(editData);
      } else {
        setEditData(purchase);
        setDisplayAmount(purchase.amount === 0 ? '' : purchase.amount.toLocaleString());
      }
    }
  };

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-200 transition-colors">
      <td className="p-0">
        <input 
          type="date" 
          min={`${currentYear}-01-01`} 
          max={`${currentYear}-12-31`} 
          value={editData.date} 
          onChange={(e) => handleChange('date', e.target.value)} 
          onBlur={handleBlur} 
          className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm" 
        />
      </td>
      <td className="p-0 border-l border-gray-200">
        <input 
          type="text" 
          list="supplier-list"
          value={editData.supplier} 
          onChange={(e) => handleChange('supplier', e.target.value)} 
          onBlur={handleBlur} 
          placeholder="仕入先を入力" 
          className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm" 
        />
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
        <button onClick={() => onDelete(purchase.id)} className="text-gray-400 hover:text-red-600 transition-colors p-2" title="削除">
          <svg className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  );
};

export const PurchasesScreen: React.FC = () => {
  const currentYearData = useStore((state) => state.getCurrentYearData());
  const appData = useStore((state) => state.appData);
  const setAppData = useStore((state) => state.setAppData);
  const currentYear = useStore((state) => state.currentYear);

  const [newDate, setNewDate] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [newAmountDisplay, setNewAmountDisplay] = useState('');

  const supplierOptions = useMemo(() => {
    if (!currentYearData) return [];
    const suppliers = currentYearData.purchases.map(p => p.supplier).filter(s => s.trim() !== '');
    return Array.from(new Set(suppliers));
  }, [currentYearData]);

  // 早期リターンをフックの後に移動
  if (!currentYearData || !appData) {
    return <div className="p-8 text-center text-gray-500">データを読み込み中です...</div>;
  }

  const purchases = currentYearData.purchases || [];
  const totalPurchases = purchases.reduce((sum, p) => sum + p.amount, 0);

  const updateStorePurchases = (updatedPurchases: Purchase[]) => {
    if (!appData) return;
    const yearData = appData.years[currentYear] || {
      apportionRate: 1,
      openingBalances: { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 },
      sales: [], expenses: [], purchases: [], inventory: []
    };
    
    const sortedPurchases = [...updatedPurchases].sort((a, b) => a.date.localeCompare(b.date));

    setAppData({
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          purchases: sortedPurchases
        }
      }
    });
  };

  const handleUpdatePurchase = (updatedPurchase: Purchase) => {
    const updatedPurchases = purchases.map((p) => (p.id === updatedPurchase.id ? updatedPurchase : p));
    updateStorePurchases(updatedPurchases);
  };

  const handleDeletePurchase = (id: string) => {
    const updatedPurchases = purchases.filter((p) => p.id !== id);
    updateStorePurchases(updatedPurchases);
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

  const handleAddPurchase = () => {
    if (!newDate || !newDate.startsWith(currentYear) || !newSupplier || newAmount === '') return;

    const newPurchase: Purchase = {
      id: crypto.randomUUID(),
      date: newDate,
      supplier: newSupplier,
      amount: newAmount as number,
    };

    updateStorePurchases([...purchases, newPurchase]);

    setNewDate('');
    setNewSupplier('');
    setNewAmount('');
    setNewAmountDisplay('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddPurchase();
    }
  };

// ... return部 以降は変更なし ...
  return (
    <div className="space-y-6">
      <datalist id="supplier-list">
        {supplierOptions.map((supplier, idx) => (
          <option key={idx} value={supplier} />
        ))}
      </datalist>

      <div className="bg-white shadow sm:rounded-lg overflow-hidden flex flex-col">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">仕入帳</h3>
            <p className="mt-1 text-sm text-gray-500">一覧を直接編集できます。勘定科目は自動的に「仕入」として処理されます。</p>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500 mr-2">本年仕入合計</span>
            <span className="text-2xl font-bold text-gray-900">{totalPurchases.toLocaleString()} <span className="text-base font-normal">円</span></span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border-b border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">仕入日</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5 border-l border-gray-200">仕入先</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5 border-l border-gray-200">金額 (円)</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5 border-l border-gray-200">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="bg-blue-50/50 hover:bg-blue-50 transition-colors border-b-2 border-blue-200">
                <td className="p-0">
                  <input 
                    type="date" 
                    min={`${currentYear}-01-01`} 
                    max={`${currentYear}-12-31`} 
                    value={newDate} 
                    onChange={(e) => setNewDate(e.target.value)} 
                    onKeyDown={handleKeyDown} 
                    className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-blue-900 placeholder-blue-300" 
                  />
                </td>
                <td className="p-0 border-l border-gray-200">
                  <input 
                    type="text" 
                    list="supplier-list"
                    value={newSupplier} 
                    onChange={(e) => setNewSupplier(e.target.value)} 
                    onKeyDown={handleKeyDown} 
                    placeholder="新規仕入先を追加..." 
                    className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-blue-900 placeholder-blue-400 font-medium" 
                  />
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
                  <button 
                    onClick={handleAddPurchase} 
                    disabled={!newDate || !newDate.startsWith(currentYear) || !newSupplier || newAmount === ''} 
                    className="text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded px-3 py-1.5 text-sm font-medium transition-colors m-1 shadow-sm w-24"
                  >
                    追加
                  </button>
                </td>
              </tr>

              {purchases.map((purchase) => (
                <PurchaseRow 
                  key={purchase.id} 
                  purchase={purchase} 
                  currentYear={currentYear} 
                  onUpdate={handleUpdatePurchase} 
                  onDelete={handleDeletePurchase} 
                />
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-gray-400 bg-white">
                    仕入データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};