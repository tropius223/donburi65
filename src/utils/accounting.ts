import type { YearData } from '../types';

/**
 * 費用の按分計算（事業用のみの金額を返す）
 */
export const calculateApportionedExpense = (
  amount: number,
  isApportioned: boolean | string | undefined, // 古いデータの文字列混入に対応
  apportionRate: number,
  itemApportionRate?: number // 追加：費目ごとの按分率 (1-100)
): number => {
  // 費目ごとの按分率（1〜100%）が設定されている場合はそれを優先
  if (itemApportionRate !== undefined) {
    return Math.round(amount * (itemApportionRate / 100));
  }
  // false（ブール値）、'false'（文字列）、または未定義の場合は全額（100%）を計上
  if (isApportioned === false || isApportioned === 'false' || !isApportioned) {
    return amount;
  }
  // 過去データの互換性用
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
  const totalSales = yearData.sales.reduce((sum: number, sale: any) => sum + sale.amount, 0);
  
  // 仕入合計
  const totalPurchases = yearData.purchases.reduce((sum: number, p: any) => sum + p.amount, 0);
  
  // 費用合計（按分後）
  const totalExpenses = yearData.expenses.reduce((sum: number, exp: any) => {
    return sum + calculateApportionedExpense(exp.amount, exp.isApportioned, yearData.apportionRate, exp.apportionRate);
  }, 0);

  // 期末在庫合計
  const closingInventory = yearData.inventory.reduce((sum: number, item: any) => sum + item.totalAmount, 0);

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