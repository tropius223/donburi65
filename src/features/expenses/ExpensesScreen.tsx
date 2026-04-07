import React, { useState, useEffect } from 'react';
import { useStore } from '../../hooks/useStore';
import type { ExpenseColumn } from '../../types';

// 選択可能な勘定科目のリスト
const ACCOUNT_CATEGORIES = [
  '租税公課', '荷造運賃', '水道光熱費', '旅費交通費', '通信費', 
  '広告宣伝費', '接待交際費', '損害保険料', '修繕費', '消耗品費', 
  '減価償却費', '福利厚生費', '給料賃金', '外注工賃', '利子割引料', 
  '地代家賃', '貸倒金', '雑費'
];

const DEFAULT_EXPENSE_COLUMNS: ExpenseColumn[] = [
  { label: '家賃', category: '地代家賃', isApportioned: true },
  { label: '光熱費', category: '水道光熱費', isApportioned: true },
  { label: 'インターネット料金', category: '通信費', isApportioned: false },
  { label: 'Adobe', category: '通信費', isApportioned: false },
  { label: '10万未満PC購入', category: '消耗品費', isApportioned: false },
];

const ColumnHeader = ({ 
  col, 
  onUpdate,
  onDelete
}: { 
  col: ExpenseColumn; 
  onUpdate: (field: keyof ExpenseColumn, value: string | boolean) => void;
  onDelete: () => void;
}) => {
  const [label, setLabel] = useState(col.label);

  useEffect(() => {
    setLabel(col.label);
  }, [col.label]);

  const borderClass = col.isApportioned ? 'border-blue-300' : 'border-gray-300';

  return (
    <th className={`border-b border-r ${borderClass} p-2 min-w-[140px] align-top bg-white relative group`}> 
      <button 
        onClick={onDelete}
        className="absolute top-1 right-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1"
        title="列を削除"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      <div className="mb-2 mt-4">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => {
            if (label !== col.label) onUpdate('label', label);
          }}
          className="w-full text-sm font-bold text-blue-700 bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:bg-white text-center"
          placeholder="内容"
        />
      </div>
      <div className="mb-2">
        <select
          value={col.category}
          onChange={(e) => onUpdate('category', e.target.value)}
          className="w-full text-xs text-gray-700 border border-gray-200 rounded px-1 py-1 focus:ring-2 focus:ring-blue-500"
        >
          <option value="勘定科目" disabled>勘定科目</option>
          {ACCOUNT_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      <div>
        <select
          value={col.isApportioned ? 'true' : 'false'}
          onChange={(e) => onUpdate('isApportioned', e.target.value === 'true')}
          className={`w-full text-xs rounded px-1 py-1 focus:ring-2 focus:ring-blue-500 transition-colors ${
            col.isApportioned 
              ? 'bg-blue-50 text-blue-700 border border-blue-300 font-medium' 
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          <option value="true">按分: 有</option>
          <option value="false">按分: 無</option>
        </select>
      </div>
    </th>
  );
};

// 日別明細の入力モーダルコンポーネント
const ExpenseDetailsModal = ({ target, onClose, onSave, currentYear }: any) => {
  const [details, setDetails] = useState<{id: string, date: string, amount: number}[]>(target.expense?.details || []);
  const [newDate, setNewDate] = useState('');
  const [newAmount, setNewAmount] = useState<number | ''>('');

  const monthStr = String(target.month).padStart(2, '0');
  const lastDay = new Date(parseInt(currentYear), target.month, 0).getDate();
  const minDate = `${currentYear}-${monthStr}-01`;
  const maxDate = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

  const total = details.reduce((sum, d) => sum + d.amount, 0);

  const handleAdd = () => {
    if (!newDate || newAmount === '') return;
    setDetails([...details, { id: crypto.randomUUID(), date: newDate, amount: Number(newAmount) }]);
    setNewDate('');
    setNewAmount('');
  };

  const handleDelete = (id: string) => {
    setDetails(details.filter(d => d.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">{target.month}月 - {target.col.label} の日別明細</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <div className="flex gap-3 mb-6 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 mb-1">発生日</label>
              <input 
                type="date" min={minDate} max={maxDate} 
                value={newDate} onChange={e => setNewDate(e.target.value)} onKeyDown={handleKeyDown}
                className="w-full border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm p-2" 
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-600 mb-1">金額 (円)</label>
              <input 
                type="number" value={newAmount} onChange={e => setNewAmount(parseInt(e.target.value) || '')} onKeyDown={handleKeyDown}
                className="w-full border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 text-sm p-2 text-right" placeholder="0" 
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleAdd} disabled={!newDate || newAmount === ''} 
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-bold disabled:bg-blue-300 transition-colors shadow-sm"
              >
                追加
              </button>
            </div>
          </div>

          <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-md overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">発生日</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">金額 (円)</th>
                <th className="px-4 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {details.sort((a,b) => a.date.localeCompare(b.date)).map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-800">{d.date}</td>
                  <td className="px-4 py-2 text-sm text-right font-medium text-gray-800">{d.amount.toLocaleString()}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => handleDelete(d.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
              {details.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-400">
                    明細はありません。<br/>(空のまま保存すると月まとめ入力に戻ります)
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-blue-50/50 border-t border-blue-100">
              <tr>
                <td className="px-4 py-3 font-bold text-sm text-blue-900">合計金額</td>
                <td className="px-4 py-3 font-bold text-base text-right text-blue-700">{total.toLocaleString()}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors shadow-sm">
            キャンセル
          </button>
          <button onClick={() => onSave(target.month, target.col.label, target.col.category, target.col.isApportioned, details)} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shadow-sm">
            保存して反映
          </button>
        </div>
      </div>
    </div>
  );
}

const ExpenseCell: React.FC<{
  month: number;
  colIndex: number;
  col: ExpenseColumn;
  expense: any;
  apportionRate: number;
  onAmountChange: (month: number, colLabel: string, colCategory: string, colIsApportioned: boolean, value: string) => void;
  onOpenModal: () => void;
}> = ({ month, colIndex, col, expense, apportionRate, onAmountChange, onOpenModal }) => {
  const amount = expense?.amount ?? '';
  const hasDetails = expense?.details && expense.details.length > 0;
  
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (amount === '' || amount === 0) {
      setDisplay('');
    } else {
      const str = Number(amount).toLocaleString();
      setDisplay(col.isApportioned ? `[${str}]` : str);
    }
  }, [amount, col.isApportioned]);

  const handleFocus = () => {
    if (hasDetails || !display) return;
    const raw = display.replace(/[^0-9]/g, '');
    if (raw) {
      setDisplay(parseInt(raw, 10).toLocaleString());
    } else {
      setDisplay('');
    }
  };

  const handleBlur = () => {
    if (hasDetails) return;
    const raw = display.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10) || 0;
    
    if (num === 0) {
      setDisplay('');
    } else {
      const str = num.toLocaleString();
      setDisplay(col.isApportioned ? `[${str}]` : str);
    }
    onAmountChange(month, col.label, col.category, col.isApportioned, num.toString());
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (hasDetails) return;
    const raw = e.target.value.replace(/[^0-9]/g, '');
    if (!raw) {
      setDisplay('');
    } else {
      const num = parseInt(raw, 10);
      setDisplay(num.toLocaleString());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // スペースキー（半角・全角問わず）が押されたら日別ポップアップを開く
    if (e.key === ' ' || e.key === '　' || e.code === 'Space') {
      e.preventDefault();
      onOpenModal();
      return;
    }

    if (hasDetails) return;
    const target = e.currentTarget;
    const selectionStart = target.selectionStart;
    const selectionEnd = target.selectionEnd;
    const valueLength = target.value.length;

    let nextCol = colIndex;
    let nextMonth = month;
    let shouldMove = false;

    switch (e.key) {
      case 'Enter':
      case 'ArrowDown':
        e.preventDefault();
        nextMonth = month + 1;
        shouldMove = true;
        break;
      case 'ArrowUp':
        e.preventDefault();
        nextMonth = month - 1;
        shouldMove = true;
        break;
      case 'ArrowLeft':
        if (selectionStart === 0 && selectionEnd === 0) {
          e.preventDefault();
          nextCol = colIndex - 1;
          shouldMove = true;
        }
        break;
      case 'ArrowRight':
        if (selectionStart === valueLength && selectionEnd === valueLength) {
          e.preventDefault();
          nextCol = colIndex + 1;
          shouldMove = true;
        }
        break;
    }

    if (shouldMove) {
      const nextInput = document.getElementById(`expense-input-${nextCol}-${nextMonth}`);
      if (nextInput) {
        nextInput.focus();
      }
    }
  };

  const apportioned = col.isApportioned && amount !== '' ? Math.floor(Number(amount) * apportionRate) : 0;
  const cellBorder = col.isApportioned ? 'border-blue-300' : 'border-gray-200';
  const bgColor = hasDetails ? 'bg-gray-100' : 'bg-transparent';
  const textColor = hasDetails ? 'text-gray-500 font-bold' : 'text-gray-900';

  return (
    <td className={`border-b border-r ${cellBorder} p-0 relative group`}>
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <button
          type="button"
          onClick={onOpenModal}
          className="bg-white border border-blue-200 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm hover:bg-blue-50 transition-colors"
        >
          (日別)
        </button>
      </div>
      <div className="relative w-full h-full">
        <input
          id={`expense-input-${colIndex}-${month}`}
          type="text"
          inputMode="numeric"
          readOnly={hasDetails}
          className={`w-full border-0 ${bgColor} py-3 px-2 text-right text-sm focus:ring-2 focus:ring-inset focus:ring-blue-500 ${textColor}`}
          value={display}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={hasDetails ? '' : '0'}
          title={hasDetails ? '日別明細が存在します。編集は(日別)ボタンから行ってください。' : ''}
        />
        {col.isApportioned && amount !== '' && amount !== 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-blue-700 opacity-0 group-hover:opacity-100 pointer-events-none bg-white/90">
            按分後 {apportioned.toLocaleString()}
          </div>
        )}
      </div>
    </td>
  );
};

export const ExpensesScreen: React.FC = () => {
  const currentYearData = useStore((state) => state.getCurrentYearData());
  const appData = useStore((state) => state.appData);
  const setAppData = useStore((state) => state.setAppData);
  const currentYear = useStore((state) => state.currentYear);

  const [rateInput, setRateInput] = useState<string>('100');
  const [modalTarget, setModalTarget] = useState<{ month: number; col: ExpenseColumn; expense?: any } | null>(null);

  useEffect(() => {
    if (currentYearData) {
      const initialRate = currentYearData.apportionRate ?? 1;
      setRateInput(Math.round(initialRate * 100).toString());
    }
  }, [currentYearData?.apportionRate]);

  if (!currentYearData && !appData) {
    return <div className="p-8 text-center text-gray-500">データを読み込み中です...</div>;
  }

  const expenses = currentYearData?.expenses || [];
  const columns = currentYearData?.expenseColumns || DEFAULT_EXPENSE_COLUMNS;
  const rate = currentYearData?.apportionRate ?? 1;

  const handleUpdateColumn = (colIndex: number, field: keyof ExpenseColumn, value: string | boolean) => {
    if (!appData) return;
    const yearData = appData.years[currentYear];
    const newColumns = [...columns];
    const oldLabel = newColumns[colIndex].label;

    newColumns[colIndex] = { ...newColumns[colIndex], [field]: value };

    let newExpenses = [...expenses];

    if (field === 'label' && oldLabel !== value) {
      newExpenses = newExpenses.map(e => e.colLabel === oldLabel ? { ...e, colLabel: value as string } : e);
    }
    if (field === 'category') {
      newExpenses = newExpenses.map(e => e.colLabel === newColumns[colIndex].label ? { ...e, category: value as string } : e);
    }
    if (field === 'isApportioned') {
      newExpenses = newExpenses.map(e => e.colLabel === newColumns[colIndex].label ? { ...e, isApportioned: value as boolean } : e);
    }

    setAppData({
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          expenses: newExpenses,
          expenseColumns: newColumns,
        },
      },
    });
  };

  const handleAddColumn = () => {
    if (!appData) return;
    const yearData = appData.years[currentYear];
    const newColumns = [...columns, { label: '', category: '勘定科目', isApportioned: false }];

    setAppData({
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          expenseColumns: newColumns,
        },
      },
    });
  };

  const handleDeleteColumn = (colIndex: number) => {
    if (!appData) return;
    if (!window.confirm('この列を削除してもよろしいですか？入力された金額も削除されます。')) return;

    const yearData = appData.years[currentYear];
    const labelToRemove = columns[colIndex].label;
    
    const newColumns = columns.filter((_, idx) => idx !== colIndex);
    const newExpenses = expenses.filter(e => e.colLabel !== labelToRemove);

    setAppData({
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          expenses: newExpenses,
          expenseColumns: newColumns,
        },
      },
    });
  };

  // 直接入力（月まとめ）の更新処理
  const handleUpdateAmount = (month: number, colLabel: string, colCategory: string, colIsApportioned: boolean, value: string) => {
    if (!appData) return;

    const amount = parseInt(value, 10) || 0;
    const yearData = appData.years[currentYear];
    
    let newExpenses = [...expenses];
    const index = newExpenses.findIndex((e) => e.month === month && e.colLabel === colLabel);

    if (index > -1) {
      if (amount === 0 && (!newExpenses[index].details || newExpenses[index].details.length === 0)) {
        newExpenses.splice(index, 1);
      } else {
        newExpenses[index] = { ...newExpenses[index], amount, colLabel, category: colCategory, isApportioned: colIsApportioned };
      }
    } else if (amount > 0) {
      newExpenses.push({
        id: crypto.randomUUID(),
        month,
        colLabel,
        category: colCategory,
        amount,
        isApportioned: colIsApportioned,
      });
    }

    setAppData({
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          expenses: newExpenses,
        },
      },
    });
  };

  // 日別明細モーダルからの保存処理
  const handleSaveDetails = (month: number, colLabel: string, colCategory: string, colIsApportioned: boolean, details: any[]) => {
    if (!appData) return;
    const yearData = appData.years[currentYear];
    let newExpenses = [...expenses];
    const index = newExpenses.findIndex((e) => e.month === month && e.colLabel === colLabel);
    
    const totalAmount = details.reduce((sum, d) => sum + d.amount, 0);

    if (index > -1) {
      if (totalAmount === 0 && details.length === 0) {
        newExpenses.splice(index, 1); // 明細がなくなり合計も0なら削除して直接入力に戻す
      } else {
        newExpenses[index] = { ...newExpenses[index], amount: totalAmount, details, category: colCategory, isApportioned: colIsApportioned };
      }
    } else if (details.length > 0 || totalAmount > 0) {
      newExpenses.push({
        id: crypto.randomUUID(),
        month,
        colLabel,
        category: colCategory,
        amount: totalAmount,
        isApportioned: colIsApportioned,
        details,
      });
    }

    setAppData({
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          expenses: newExpenses,
        },
      },
    });
    setModalTarget(null);
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRateInput(val);

    if (!appData) return;
    const yearData = appData.years[currentYear];
    
    const numValue = val === '' ? 0 : Number(val);

    let validRate = numValue;
    if (isNaN(validRate) || validRate < 0) validRate = 0;
    if (validRate > 100) validRate = 100;

    setAppData({
      ...appData,
      years: {
        ...appData.years,
        [currentYear]: {
          ...yearData,
          apportionRate: validRate / 100,
        },
      },
    });
  };

  const handleRateBlur = () => {
    if (rateInput === '') {
      setRateInput('0');
    } else {
      let validRate = Number(rateInput);
      if (isNaN(validRate) || validRate < 0) validRate = 0;
      if (validRate > 100) validRate = 100;
      setRateInput(validRate.toString());
    }
  };

  const getExpense = (month: number, label: string) => {
    return expenses.find((e) => e.month === month && e.colLabel === label);
  };

  const getColumnTotal = (label: string) => {
    return expenses.filter((e) => e.colLabel === label)
      .reduce((sum, e) => sum + (e.isApportioned ? Math.floor(e.amount * rate) : e.amount), 0);
  };

  const getRowTotal = (month: number) => {
    return expenses.filter((e) => e.month === month)
      .reduce((sum, e) => sum + (e.isApportioned ? Math.floor(e.amount * rate) : e.amount), 0);
  };

  const grandTotal = expenses.reduce((sum, e) => sum + (e.isApportioned ? Math.floor(e.amount * rate) : e.amount), 0);

  return (
    <div className="space-y-6">
      {modalTarget && (
        <ExpenseDetailsModal
          target={modalTarget}
          currentYear={currentYear}
          onClose={() => setModalTarget(null)}
          onSave={handleSaveDetails}
        />
      )}

      <div className="bg-white shadow sm:rounded-lg p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">事業用按分比率</h3>
          <p className="mt-1 text-sm text-gray-500">
            「按分: 有」に設定した列に入力された金額に対し、ここで設定した事業用の割合が自動的に掛け合わされます。
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center space-x-2">
          <input
            type="number"
            min="0"
            max="100"
            value={rateInput}
            onChange={handleRateChange}
            onBlur={handleRateBlur}
            className="block w-24 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-lg border p-2 text-right font-bold text-blue-700"
          />
          <span className="text-gray-700 font-medium">%</span>
        </div>
      </div>

      <div className="bg-white shadow sm:rounded-lg overflow-hidden flex flex-col">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">費用帳</h3>
            <p className="mt-1 text-sm text-gray-500">
              列名・科目・按分の有無を自由に変更できます。下のセルに金額を入力してください。<br/>
              セルにカーソルを合わせると表示される「(日別)」ボタンから、日付ごとの詳細な記帳も可能です。
            </p>
          </div>
          <div className="text-right">
            <span className="text-sm text-gray-500 mr-2">全費用合計</span>
            <span className="text-2xl font-bold text-gray-900">
              {grandTotal.toLocaleString()} <span className="text-base font-normal">円</span>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto pb-4">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="sticky left-0 z-[5] bg-gray-100 border-b border-r border-gray-300 p-2 text-sm font-bold text-gray-700 w-20 align-middle text-center">
                  発生月
                </th>
                {columns.map((col, idx) => (
                  <ColumnHeader 
                    key={idx} 
                    col={col} 
                    onUpdate={(field, value) => handleUpdateColumn(idx, field, value)} 
                    onDelete={() => handleDeleteColumn(idx)}
                  />
                ))}
                <th className="border-b border-r border-gray-300 bg-gray-50 w-16 align-middle text-center">
                  <button onClick={handleAddColumn} className="text-blue-600 hover:text-blue-800 flex flex-col items-center justify-center w-full h-full p-2 text-xs" title="列を追加">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mb-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    追加
                  </button>
                </th>
                <th className="border-b border-gray-300 p-2 text-sm font-bold text-gray-700 bg-gray-100 w-24 align-middle text-center">
                  合計
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <tr key={month} className="hover:bg-blue-50/30 transition-colors">
                  <td className="sticky left-0 z-[5] bg-white border-b border-r border-gray-200 p-2 text-sm font-medium text-gray-700 text-center">
                    {month}月
                  </td>
                  {columns.map((col, idx) => (
                    <ExpenseCell
                      key={idx}
                      month={month}
                      colIndex={idx}
                      col={col}
                      expense={getExpense(month, col.label)}
                      apportionRate={rate}
                      onAmountChange={handleUpdateAmount}
                      onOpenModal={() => setModalTarget({ month, col, expense: getExpense(month, col.label) })}
                    />
                  ))}
                  <td className="border-b border-r border-gray-200 bg-gray-50/30"></td>
                  <td className="border-b border-gray-200 p-2 text-right text-sm font-bold bg-gray-50/50 text-gray-700">
                    {getRowTotal(month).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td className="sticky left-0 z-[5] bg-gray-100 border-r border-gray-300 p-2 text-center text-sm text-gray-700">
                  合計
                </td>
                {columns.map((col, idx) => (
                  <td key={idx} className="border-r border-gray-300 p-2 text-right text-sm text-gray-700">
                    {getColumnTotal(col.label).toLocaleString()}
                  </td>
                ))}
                <td className="border-r border-gray-300 bg-gray-100"></td>
                <td className="p-2 text-right text-sm text-blue-700 bg-blue-50">
                  {grandTotal.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};