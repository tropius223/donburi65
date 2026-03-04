import React, { useState } from 'react';
import { useStore } from '../../hooks/useStore';
import type { Sale } from '../../types';

export const SalesScreen: React.FC = () => {
  const currentYearData = useStore((state) => state.getCurrentYearData());
  const appData = useStore((state) => state.appData);
  const setAppData = useStore((state) => state.setAppData);
  const currentYear = useStore((state) => state.currentYear);

  const [salesDate, setSalesDate] = useState('');
  const [amount, setAmount] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [client, setClient] = useState('');

  // 売上データの追加処理
  const handleAddSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appData) return;

    const newSale: Sale = {
      id: crypto.randomUUID(),
      salesDate,
      amount: parseInt(amount, 10),
      depositDate,
      client,
    };

    // 既存データがない場合は初期化して追加
    const yearData = appData.years[currentYear] || {
      apportionRate: 1,
      openingBalances: { 現金: 0, 売掛金: 0, 商品: 0, 元入金: 0 },
      sales: [], expenses: [], purchases: [], inventory: []
    };

    const updatedAppData = {
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          sales: [...yearData.sales, newSale].sort((a, b) => a.salesDate.localeCompare(b.salesDate))
        }
      }
    };

    setAppData(updatedAppData);
    // フォームのクリア
    setSalesDate('');
    setAmount('');
    setDepositDate('');
    setClient('');
  };

  if (!currentYearData && !appData) {
    return <div>データを読み込み中です...</div>;
  }

  const sales = currentYearData?.sales || [];
  const totalSales = sales.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
        <div className="md:grid md:grid-cols-3 md:gap-6">
          <div className="md:col-span-1">
            <h3 className="text-lg font-medium leading-6 text-gray-900">新規売上入力</h3>
            <p className="mt-1 text-sm text-gray-500">
              売上日と入金日を分けることで、自動的に売掛金と事業主貸の回収仕訳が生成されます。
            </p>
          </div>
          <div className="mt-5 md:mt-0 md:col-span-2">
            <form onSubmit={handleAddSale}>
              <div className="grid grid-cols-6 gap-6">
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">売上日</label>
                  <input type="date" required value={salesDate} onChange={(e) => setSalesDate(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">入金日 (未定の場合は空欄)</label>
                  <input type="date" value={depositDate} onChange={(e) => setDepositDate(e.target.value)}
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">売上先</label>
                  <input type="text" required value={client} onChange={(e) => setClient(e.target.value)} placeholder="例: A株式会社"
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="block text-sm font-medium text-gray-700">金額 (円)</label>
                  <input type="number" required min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000"
                    className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md border p-2" />
                </div>
              </div>
              <div className="mt-6 text-right">
                <button type="submit" className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700">
                  追加する
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">売上明細一覧</h3>
          <span className="inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            合計: {totalSales.toLocaleString()} 円
          </span>
        </div>
        <ul className="divide-y divide-gray-200">
          {sales.map((sale) => (
            <li key={sale.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-blue-600 truncate">{sale.client}</p>
                <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                  <span>売上: {sale.salesDate}</span>
                  {sale.depositDate && <span>入金: {sale.depositDate}</span>}
                </div>
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {sale.amount.toLocaleString()} 円
              </div>
            </li>
          ))}
          {sales.length === 0 && (
            <li className="px-4 py-8 text-center text-gray-500">データがありません</li>
          )}
        </ul>
      </div>
    </div>
  );
};