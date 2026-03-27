import React, { useState, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import type { InventoryItem } from '../../types';

const InventoryRow = ({ item, onUpdate, onDelete }: { item: InventoryItem; onUpdate: (i: InventoryItem) => void; onDelete: (id: string) => void }) => {
// ... InventoryRow の内容は変更なし ...
  const [editData, setEditData] = useState(item);

  useEffect(() => {
    setEditData(item);
  }, [item]);

  const handleChange = (field: keyof InventoryItem, value: string | number) => {
    const newData = { ...editData, [field]: value };
    if (field === 'unitPrice' || field === 'quantity') {
      const price = field === 'unitPrice' ? (value as number) : newData.unitPrice;
      const qty = field === 'quantity' ? (value as number) : newData.quantity;
      newData.totalAmount = (price || 0) * (qty || 0);
    }
    setEditData(newData);
  };

  const handleBlur = () => {
    if (JSON.stringify(editData) !== JSON.stringify(item)) {
      if (editData.itemName && editData.unitPrice >= 0 && editData.quantity >= 0) {
        onUpdate(editData);
      } else {
        setEditData(item);
      }
    }
  };

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-200 transition-colors">
      <td className="p-0">
        <input 
          type="text" 
          value={editData.itemName} 
          onChange={(e) => handleChange('itemName', e.target.value)} 
          onBlur={handleBlur} 
          placeholder="商品名を入力" 
          className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm" 
        />
      </td>
      <td className="p-0 border-l border-gray-200">
        <input 
          type="number" 
          value={editData.unitPrice === 0 ? '' : editData.unitPrice} 
          onChange={(e) => handleChange('unitPrice', parseInt(e.target.value, 10) || 0)} 
          onBlur={handleBlur} 
          placeholder="0" 
          className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-right" 
        />
      </td>
      <td className="p-0 border-l border-gray-200">
        <input 
          type="number" 
          value={editData.quantity === 0 ? '' : editData.quantity} 
          onChange={(e) => handleChange('quantity', parseInt(e.target.value, 10) || 0)} 
          onBlur={handleBlur} 
          placeholder="0" 
          className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-right" 
        />
      </td>
      <td className="p-0 border-l border-gray-200 bg-gray-50/50">
        <div className="py-3 px-4 text-sm text-right font-medium text-gray-900">
          {editData.totalAmount.toLocaleString()}
        </div>
      </td>
      <td className="p-0 border-l border-gray-200 text-center align-middle">
        <button onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600 transition-colors p-2" title="削除">
          <svg className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </td>
    </tr>
  );
};

export const InventoryScreen: React.FC = () => {
  const currentYearData = useStore((state) => state.getCurrentYearData());
  const appData = useStore((state) => state.appData);
  const setAppData = useStore((state) => state.setAppData);
  const currentYear = useStore((state) => state.currentYear);

  const [newItemName, setNewItemName] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState<number | ''>('');
  const [newQuantity, setNewQuantity] = useState<number | ''>('');

  // 早期リターンをフックの後に移動
  if (!currentYearData || !appData) {
    return <div className="p-8 text-center text-gray-500">データを読み込み中です...</div>;
  }

  const inventory = currentYearData.inventory || [];
  const totalInventoryAmount = inventory.reduce((sum, item) => sum + item.totalAmount, 0);

  const updateStoreInventory = (updatedInventory: InventoryItem[]) => {
    if (!appData) return;
    const yearData = appData.years[currentYear] || {
      apportionRate: 1,
      openingBalances: { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 },
      sales: [], expenses: [], purchases: [], inventory: []
    };
    
    setAppData({
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          inventory: updatedInventory
        }
      }
    });
  };

  const handleUpdateInventory = (updatedItem: InventoryItem) => {
    const updatedInventory = inventory.map((i) => (i.id === updatedItem.id ? updatedItem : i));
    updateStoreInventory(updatedInventory);
  };

  const handleDeleteInventory = (id: string) => {
    const updatedInventory = inventory.filter((i) => i.id !== id);
    updateStoreInventory(updatedInventory);
  };

  const handleAddInventory = () => {
    if (!newItemName || newUnitPrice === '' || newQuantity === '') return;

    const newInventoryItem: InventoryItem = {
      id: crypto.randomUUID(),
      itemName: newItemName,
      unitPrice: newUnitPrice as number,
      quantity: newQuantity as number,
      totalAmount: (newUnitPrice as number) * (newQuantity as number),
    };

    updateStoreInventory([newInventoryItem, ...inventory]);

    setNewItemName('');
    setNewUnitPrice('');
    setNewQuantity('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddInventory();
    }
  };

  const newTotalAmount = (newUnitPrice || 0) * (newQuantity || 0);

// ... return部 以降は変更なし ...
  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              期末（12月31日）時点での実地棚卸の数値を入力してください。複雑な低価法などは採用せず、<strong>仕入時の原価での評価</strong>を前提とします。
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg overflow-hidden flex flex-col">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">期末棚卸帳</h3>
            <p className="mt-1 text-sm text-gray-500">一覧を直接編集できます。単価と数量を入力すると合計が自動計算されます。</p>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500 mr-2">期末棚卸合計</span>
            <span className="text-2xl font-bold text-gray-900">{totalInventoryAmount.toLocaleString()} <span className="text-base font-normal">円</span></span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 border-b border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">商品名</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5 border-l border-gray-200">仕入単価 (円)</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5 border-l border-gray-200">数量</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5 border-l border-gray-200">合計金額 (円)</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-1/12 border-l border-gray-200">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="bg-blue-50/50 hover:bg-blue-50 transition-colors border-b-2 border-blue-200">
                <td className="p-0">
                  <input 
                    type="text" 
                    value={newItemName} 
                    onChange={(e) => setNewItemName(e.target.value)} 
                    onKeyDown={handleKeyDown} 
                    placeholder="棚卸商品を追加..." 
                    className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-blue-900 placeholder-blue-400 font-medium" 
                  />
                </td>
                <td className="p-0 border-l border-gray-200">
                  <input 
                    type="number" 
                    value={newUnitPrice} 
                    onChange={(e) => setNewUnitPrice(parseInt(e.target.value, 10) || '')} 
                    onKeyDown={handleKeyDown} 
                    placeholder="0" 
                    className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-right font-medium text-blue-900 placeholder-blue-300" 
                  />
                </td>
                <td className="p-0 border-l border-gray-200">
                  <input 
                    type="number" 
                    value={newQuantity} 
                    onChange={(e) => setNewQuantity(parseInt(e.target.value, 10) || '')} 
                    onKeyDown={handleKeyDown} 
                    placeholder="0" 
                    className="block w-full border-0 bg-transparent py-3 px-4 focus:ring-2 focus:ring-blue-500 sm:text-sm text-right font-medium text-blue-900 placeholder-blue-300" 
                  />
                </td>
                <td className="p-0 border-l border-gray-200 bg-blue-50/80">
                  <div className="py-3 px-4 text-sm text-right font-bold text-blue-900">
                    {newTotalAmount.toLocaleString()}
                  </div>
                </td>
                <td className="p-0 border-l border-gray-200 text-center align-middle">
                  <button 
                    onClick={handleAddInventory} 
                    disabled={!newItemName || newUnitPrice === '' || newQuantity === ''} 
                    className="text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded px-3 py-1.5 text-sm font-medium transition-colors m-1 shadow-sm w-24"
                  >
                    追加
                  </button>
                </td>
              </tr>

              {inventory.map((item) => (
                <InventoryRow 
                  key={item.id} 
                  item={item} 
                  onUpdate={handleUpdateInventory} 
                  onDelete={handleDeleteInventory} 
                />
              ))}
              {inventory.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400 bg-white">
                    棚卸データがありません
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