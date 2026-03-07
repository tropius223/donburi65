// どんぶり帳簿の各データの型定義

export interface OpeningBalances {
  売掛金: number;
  商品: number; // 期首商品棚卸高
  元入金: number;
  // 手入力による追加科目を許容する場合のインデックスシグネチャ
  [key: string]: number;
}

export interface Sale {
  id: string;
  salesDate: string; // 売上日
  amount: number; // 金額
  depositDate: string; // 入金日
  client: string; // 売上先
}

export interface Expense {
  id: string;
  month: number; // 発生月 (1-12)
  category: string; // 科目 (列名と紐づく)
  amount: number; // 金額
  isApportioned: boolean; // 按分有無
}

export interface Purchase {
  id: string;
  date: string; // 仕入日
  amount: number; // 金額
  supplier: string; // 仕入先
}

export interface InventoryItem {
  id: string;
  itemName: string; // 商品名
  unitPrice: number; // 仕入単価
  quantity: number; // 数量
  totalAmount: number; // 合計金額
}

export interface ExpenseColumn {
  label: string;
  category: string;
  isApportioned: boolean;
}

export interface YearData {
  apportionRate: number; // 事業用按分比率 (例: 0.5)
  openingBalances: OpeningBalances;
  sales: Sale[];
  expenses: Expense[];
  purchases: Purchase[];
  inventory: InventoryItem[];
  expenseColumns?: ExpenseColumn[]; // 列のカスタマイズ設定
}

export interface AppData {
  version: string;
  userId: string;
  years: {
    [year: string]: YearData;
  };
}