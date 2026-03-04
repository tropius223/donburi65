import type { YearData } from '../types';

/**
 * 費用の按分計算（事業用のみの金額を返す）
 */
export const calculateApportionedExpense = (
  amount: number,
  isApportioned: boolean,
  apportionRate: number
): number => {
  if (!isApportioned) return amount;
  return Math.round(amount * apportionRate);
};

/**
 * 売上原価の計算
 * 期首商品棚卸高 ＋ 当期商品仕入高 － 期末商品棚卸高
 */
export const calculateCostOfSales = (
  openingInventory: number,
  purchases: number,
  closingInventory: number
): number => {
  return openingInventory + purchases - closingInventory;
};

/**
 * 年度データから各種集計値と所得金額を計算する
 */
export const calculateSummary = (yearData: YearData) => {
  // 売上合計
  const totalSales = yearData.sales.reduce((sum, sale) => sum + sale.amount, 0);
  
  // 仕入合計
  const totalPurchases = yearData.purchases.reduce((sum, p) => sum + p.amount, 0);
  
  // 費用合計（按分後）
  const totalExpenses = yearData.expenses.reduce((sum, exp) => {
    return sum + calculateApportionedExpense(exp.amount, exp.isApportioned, yearData.apportionRate);
  }, 0);

  // 期末在庫合計
  const closingInventory = yearData.inventory.reduce((sum, item) => sum + item.totalAmount, 0);

  // 売上原価
  const costOfSales = calculateCostOfSales(
    yearData.openingBalances['商品'] || 0,
    totalPurchases,
    closingInventory
  );

  // 所得金額 (青色申告特別控除前)
  const income = totalSales - costOfSales - totalExpenses;

  return {
    totalSales,
    totalPurchases,
    totalExpenses,
    closingInventory,
    costOfSales,
    income
  };
};