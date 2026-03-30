import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../hooks/useStore';
import { calculateSummary, calculateApportionedExpense } from '../../utils/accounting';

// 開発用フラグ：帳票画面の編集時は true にし、本番公開時に false に戻してください
const DEV_SKIP_SUBSCRIPTION_CHECK = true;

export const BlueReturnScreen: React.FC = () => {
  const userEmail = useStore((state) => state.userEmail);
  // 修正：アンチパターンを解消
  const appData = useStore((state) => state.appData);
  const currentYear = useStore((state) => state.currentYear);
  const currentYearData = appData?.years[currentYear];

  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(DEV_SKIP_SUBSCRIPTION_CHECK ? true : null);
  const [isLoading, setIsLoading] = useState(!DEV_SKIP_SUBSCRIPTION_CHECK);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const checkStatus = async (force = false) => {
    if (DEV_SKIP_SUBSCRIPTION_CHECK) return;
    if (!userEmail) return;
    if (force) setIsLoading(true);

    try {
      const response = await fetch('/api/check-subscription', { // APIパスを修正
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, forceRefresh: force }),
      });
      const data = await response.json();
      setIsSubscribed(data.isSubscribed);
    } catch (error) {
      console.error('課金確認エラー:', error);
      setIsSubscribed(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (DEV_SKIP_SUBSCRIPTION_CHECK) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      checkStatus(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      checkStatus(false);
    }
  }, [userEmail]);

  const handlePurchase = async () => {
    setIsProcessingPayment(true);
    try {
      const response = await fetch('/api/create-checkout', { // APIパスを修正
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('決済エラー:', error);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const summary = currentYearData ? calculateSummary(currentYearData) : null;

  // 1. 月別集計データ
  const monthlyInput = useMemo(() => {
    const data = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, sales: 0, purchases: 0 }));
    if (currentYearData) {
      currentYearData.sales.forEach((s: any) => {
        const m = parseInt(s.salesDate.split('-')[1], 10);
        if (m >= 1 && m <= 12) data[m - 1].sales += s.amount;
      });
      currentYearData.purchases.forEach((p: any) => {
        const m = parseInt(p.date.split('-')[1], 10);
        if (m >= 1 && m <= 12) data[m - 1].purchases += p.amount;
      });
    }
    return data;
  }, [currentYearData]);

  const calculatedSalesTotal = monthlyInput.reduce((acc, curr) => acc + curr.sales, 0);
  const calculatedPurchasesTotal = monthlyInput.reduce((acc, curr) => acc + curr.purchases, 0);
  const kajishouhi = 0;
  const zatsushuunyuu = 0;
  const totalSales = calculatedSalesTotal + kajishouhi + zatsushuunyuu;

  // 2 & 3. 売上先・仕入先の明細（金額が多い順に上位を取得）
  const salesDetails = useMemo(() => {
    if (!currentYearData) return [];
    const grouped: Record<string, number> = {};
    currentYearData.sales.forEach((s: any) => {
      grouped[s.client] = (grouped[s.client] || 0) + s.amount;
    });
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        type: '登録番号等',
        number: 'ご自身で入力ください',
        name,
        address: 'ご自身で入力ください',
        amount
      }));
  }, [currentYearData]);

  const purchasesDetails = useMemo(() => {
    if (!currentYearData) return [];
    const grouped: Record<string, number> = {};
    currentYearData.purchases.forEach((p: any) => {
      grouped[p.supplier] = (grouped[p.supplier] || 0) + p.amount;
    });
    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([name, amount]) => ({
        type: '登録番号等',
        number: 'ご自身で入力ください',
        name,
        address: 'ご自身で入力ください',
        amount
      }));
  }, [currentYearData]);

  // 4. 経費の集計（どのような保存状態でも確実に拾い上げる堅牢なロジック）
  const getExpense = (cat: string) => {
    if (!currentYearData) return 0;
    
    // 初期化直後など、列設定がデータに存在しない場合のためのデフォルトマッピング
    const columns = currentYearData.expenseColumns || [
      { label: '家賃', category: '地代家賃' },
      { label: '光熱費', category: '水道光熱費' },
      { label: 'インターネット料金', category: '通信費' },
      { label: 'Adobe', category: '通信費' },
      { label: '10万未満PC購入', category: '消耗品費' },
    ];
    
    // 該当の勘定科目(cat)に紐づく「列の名称」のリストを作成
    const targetLabels = columns.filter((col: any) => col.category === cat).map((col: any) => col.label);

    return currentYearData.expenses
      .filter((e: any) => 
        e.category === cat || // ①正しく勘定科目が保存されている場合
        targetLabels.includes(e.category) || // ②categoryフィールドに列名が保存されてしまっている場合
        (e.colLabel && targetLabels.includes(e.colLabel)) // ③colLabelから逆引きできる場合
      )
      .reduce((sum: number, e: any) => sum + calculateApportionedExpense(e.amount, e.isApportioned, currentYearData.apportionRate), 0);
  };

  const expenses = {
    sozeiKouka: getExpense('租税公課'), nidzukuri: getExpense('荷造運賃'), suidouKounetsu: getExpense('水道光熱費'),
    ryohiKoutsu: getExpense('旅費交通費'), tsuushin: getExpense('通信費'), koukoku: getExpense('広告宣伝費'),
    settai: getExpense('接待交際費'), songai: getExpense('損害保険料'), shuuzen: getExpense('修繕費'),
    shomouhin: getExpense('消耗品費'), genkashoukyaku: getExpense('減価償却費'), fukuri: getExpense('福利厚生費'),
    kyuuryou: getExpense('給料賃金'), gaichuu: getExpense('外注工賃'), rishi: getExpense('利子割引料'),
    chidai: getExpense('地代家賃'), kashidaore: getExpense('貸倒金'), zappi: getExpense('雑費'),
  };
  const expensesTotal = Object.values(expenses).reduce((a, b) => a + b, 0);

  // currentYearData?.openingBalances から値を取得するヘルパー関数
  const getBal = (key: string) => currentYearData?.openingBalances[key] || 0;

  // 売掛金の期末残高計算
  const prevYearStr = (parseInt(currentYear) - 1).toString();
  const prevYearData = appData?.years[prevYearStr];

  // 修正：前年売掛金のうち、当期に回収されたものを自動算出
  const autoCollectedPrevSales = prevYearData?.sales.filter((s: any) => s.depositDate >= `${currentYear}-01-01` && s.depositDate <= `${currentYear}-12-31`).reduce((sum: number, s: any) => sum + s.amount, 0) || 0;
  
  const prevReceivables = (currentYearData as any)?.previousReceivables || [];
  const prevReceivablesTotal = prevReceivables.reduce((sum: number, r: any) => sum + r.amount, 0) + autoCollectedPrevSales;
  
  // 修正：期ズレを考慮し、当期売上のうち未回収または翌年以降回収のものを算出
  const uncollectedSales = currentYearData?.sales.filter((s: any) => !s.depositDate || s.depositDate > `${currentYear}-12-31`).reduce((sum: number, s: any) => sum + s.amount, 0) || 0;
  // 修正：当期売上のうち、当期中に回収されたものを算出
  const collectedSales = currentYearData?.sales.filter((s: any) => s.depositDate && s.depositDate <= `${currentYear}-12-31`).reduce((sum: number, s: any) => sum + s.amount, 0) || 0;
  
  const openingAccountsReceivable = getBal('売掛金');
  const closingAccountsReceivable = openingAccountsReceivable - prevReceivablesTotal + uncollectedSales;

  // 事業主貸・借の期末残高計算（期首は必ず0）
  const jigyoushunKashi_Dr = collectedSales + prevReceivablesTotal; // 借方発生：売上の入金 ＋ 前年売掛金の回収
  const jigyoushunKashi_Cr = calculatedPurchasesTotal + expensesTotal; // 貸方発生：仕入 ＋ 経費の支払い
  const jigyoushunBalance = jigyoushunKashi_Dr - jigyoushunKashi_Cr;
  const closingJigyoushunKashi = jigyoushunBalance > 0 ? jigyoushunBalance : 0;
  const closingJigyoushunKari = jigyoushunBalance < 0 ? Math.abs(jigyoushunBalance) : 0;

  // 期首元入金の計算（設定画面で入力された期首の事業主勘定と所得金額を元入金に集約して相殺する）
  const openingMotouire = getBal('元入金') + getBal('青色申告特別控除前の所得金額') + getBal('事業主借') - getBal('事業主貸');

  // 5. 貸借対照表データ
  const bsAssets = [
    { name: '現金', start: getBal('現金'), end: getBal('現金') },
    { name: '当座預金', start: getBal('当座預金'), end: getBal('当座預金') },
    { name: '定期預金', start: getBal('定期預金'), end: getBal('定期預金') },
    { name: 'その他の預金', start: getBal('その他の預金'), end: getBal('その他の預金') },
    { name: '受取手形', start: getBal('受取手形'), end: getBal('受取手形') },
    { name: '売掛金', start: openingAccountsReceivable, end: closingAccountsReceivable }, // 売掛金の期末計算を適用
    { name: '有価証券', start: getBal('有価証券'), end: getBal('有価証券') },
    { name: '棚卸資産', start: getBal('商品'), end: summary?.closingInventory || 0 }, // 棚卸資産の期末計算を適用
    { name: '前払金', start: getBal('前払金'), end: getBal('前払金') },
    { name: '貸付金', start: getBal('貸付金'), end: getBal('貸付金') },
    { name: '建物', start: getBal('建物'), end: getBal('建物') },
    { name: '建物附属設備', start: getBal('建物附属設備'), end: getBal('建物附属設備') },
    { name: '機械装置', start: getBal('機械装置'), end: getBal('機械装置') },
    { name: '車両運搬具', start: getBal('車両運搬具'), end: getBal('車両運搬具') },
    { name: '工具・器具・備品', start: getBal('工具・器具・備品'), end: getBal('工具・器具・備品') },
    { name: '土地', start: getBal('土地'), end: getBal('土地') },
    { name: '事業主貸', start: 0, end: closingJigyoushunKashi }, // 期首は必ず0、期末は計算値を適用
  ];
  const bsAssetsTotal = bsAssets.reduce((acc, curr) => ({ start: acc.start + curr.start, end: acc.end + curr.end }), { start: 0, end: 0 });

  const bsLiabilities = [
    { name: '支払手形', start: getBal('支払手形'), end: getBal('支払手形') },
    { name: '買掛金', start: getBal('買掛金'), end: getBal('買掛金') },
    { name: '借入金', start: getBal('借入金'), end: getBal('借入金') },
    { name: '未払金', start: getBal('未払金'), end: getBal('未払金') },
    { name: '前受金', start: getBal('前受金'), end: getBal('前受金') },
    { name: '預り金', start: getBal('預り金'), end: getBal('預り金') },
    { name: '貸倒引当金', start: getBal('貸倒引当金'), end: getBal('貸倒引当金') },
    { name: '事業主借', start: 0, end: closingJigyoushunKari }, // 期首は必ず0、期末は計算値を適用
    { name: '元入金', start: openingMotouire, end: openingMotouire }, // 事業主勘定を集約した値を適用
  ];
  const bsLiabilitiesTotal = {
    start: bsLiabilities.reduce((acc, curr) => acc + curr.start, 0),
    end: bsLiabilities.reduce((acc, curr) => acc + curr.end, 0) + (summary?.income || 0)
  };

  const formatCurrency = (num: number | undefined | null) => {
    if (!isSubscribed) return '888,888';
    if (num === 0) return '0';
    if (!num) return '－';
    if (num < 0) return '△' + new Intl.NumberFormat('ja-JP').format(Math.abs(num));
    return new Intl.NumberFormat('ja-JP').format(num);
  };

  const amountClass = !isSubscribed ? 'blur-amount' : '';

  // 早期リターンを最後に移動
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        <span className="ml-3 text-gray-600">最新の購読状態を確認中...</span>
      </div>
    );
  }
  
  // currentYearDataがない場合のフォールバック（フックがすべて実行された後）
  if (!currentYearData) {
    return <div className="p-8 text-center text-gray-500">データを読み込み中です...</div>;
  }

  return (
    <div className="relative">
      {!isSubscribed && (
        <div className="bg-white border-t-4 border-blue-500 shadow-md p-6 rounded-lg text-center max-w-3xl mx-auto mt-4 animate-fade-in mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-3">青色申告決算書の機能は有料です</h3>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={handlePurchase}
              disabled={isProcessingPayment}
              className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
            >
              {isProcessingPayment ? '処理中...' : '年間 1,000円で購入'}
            </button>
            <button
              onClick={() => checkStatus(true)}
              className="text-sm text-blue-600 hover:underline font-medium"
            >
              購入済みの場合（再確認）
            </button>
          </div>
        </div>
      )}

      {/* Tailwind等のスタイルと衝突しないようにScoped風のラッパーを使用 */}
      <div className="legacy-blue-return text-left">
        <style>{`
          .legacy-blue-return { background: #fff; color: #333; font-family: "Hiragino Kaku Gothic ProN", "メイリオ", "ＭＳ ゴシック", sans-serif; line-height: 180%; font-size: 14px; margin: 0; padding: 0;}
          .legacy-blue-return .container { width: 960px; max-width: 100%; margin: 0 auto; padding: 2px 10px; box-sizing: border-box;}
          .legacy-blue-return .clearfix:after { content: ""; clear: both; display: block; }
          .legacy-blue-return h2 { font-weight: normal; font-size: 128.6%; border-bottom: 2px dotted #ea9000; padding-bottom: 6px; margin: 40px 0 14px 0; color: #333;}
          .legacy-blue-return h3 { color: #197f4a; margin: 20px 0 10px; font-weight: normal; font-size: 120%;}
          .legacy-blue-return .area-title { color: #197f4a; font-weight: bold; font-size: 171.4%; margin: 40px 0 20px 0; border: none; }
          
          .legacy-blue-return table { width: 100%; border-collapse: collapse; border-spacing: 0; margin: 28px 0 20px 0; }
          .legacy-blue-return th, .legacy-blue-return td { border-bottom: 1px solid #ccc; text-align: left; vertical-align: top; padding: 8px; }
          .legacy-blue-return th { background: #f2efe4; font-weight: normal; }
          .legacy-blue-return td { background: #fff; border-left: 1px solid #ccc; }
          .legacy-blue-return tr:first-child th, .legacy-blue-return tr:first-child td { border-top: 1px solid #ccc; }
          
          .legacy-blue-return .p-contentsList { display: flex; align-items: center; border-bottom: 1px dotted #ccc; padding: 8px 0; }
          .legacy-blue-return .p-contentsList.sticky { background: #f2efe4; border-top: 1px solid #ccc; border-bottom: 1px solid #ccc; font-weight: bold; }
          .legacy-blue-return .p-contentsList-2 { display: flex; align-items: center; padding: 12px 0; background: #eaf5ef; border-top: 2px solid #197f4a; border-bottom: 1px solid #ccc; font-weight: bold; }
          .legacy-blue-return .p-contentsList__leftSection { width: 25%; text-align: center; }
          .legacy-blue-return .p-contentsList__middleSection, .legacy-blue-return .p-contentsList__rightSection { width: 37.5%; text-align: center; }
          .legacy-blue-return .input-amount-inputbox { text-align: right; padding: 6px; border: 1px inset #ccc; width: 140px; font-size: 110%; background-color: #f0f0f0; border-style: solid; color: #333;}
          .legacy-blue-return .input-wrap { display: inline-flex; align-items: center; }
          .legacy-blue-return .c-unit__input { margin-left: 5px; }
          
          .legacy-blue-return .detailTableSection { border-top: 2px solid #197f4a; margin-top: 10px; background: #fff; border-bottom: 1px solid #ccc;}
          .legacy-blue-return .detailTableTitle { display: flex; background: #f2efe4; border-bottom: 1px solid #ccc; font-weight: bold; font-size: 12px; }
          .legacy-blue-return .detailTableTitle > div { padding: 12px 10px; box-sizing: border-box; border-left: 1px solid #ccc;}
          .legacy-blue-return .detailTableTitle > div:first-child { border-left: none; }
          .legacy-blue-return .detailTableContent { display: flex; border-bottom: 1px dotted #ccc; align-items: center; font-size: 13px;}
          .legacy-blue-return .detailTableContent > div { padding: 10px; box-sizing: border-box; }
          .legacy-blue-return .col-num { width: 8%; text-align: center; }
          .legacy-blue-return .col-reg { width: 25%; }
          .legacy-blue-return .col-name { width: 24%; }
          .legacy-blue-return .col-addr { width: 25%; }
          .legacy-blue-return .col-amount { width: 18%; text-align: right; }
          .legacy-blue-return .hNumber { font-weight: bold; background: #eee; padding: 2px 6px; border: 1px solid #ccc; border-radius: 2px; font-size: 11px;}
          
          .legacy-blue-return .l-calculation { border: 1px solid #ccc; margin-bottom: 20px; background: #fff;}
          .legacy-blue-return .accordion-title { background: #f2efe4; padding: 10px 15px; margin: 0; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ccc; }
          .legacy-blue-return .c-low { padding: 10px 15px; border-bottom: 1px dotted #ccc; display: flex; justify-content: space-between; align-items: center; }
          .legacy-blue-return .c-low:last-child { border-bottom: none; }
          .legacy-blue-return .c-subject { display: flex; align-items: center; }
          .legacy-blue-return .item-Serial { display: inline-block; width: 24px; text-align: center; background: #eee; border: 1px solid #ccc; margin-right: 10px; font-size: 12px;}
          .legacy-blue-return .input-wrap input { text-align: right; border: 1px solid #ccc; background: #f0f0f0; width: 140px; padding: 4px; color: #333;}
          .legacy-blue-return .total.fixed { border: 2px solid #197f4a; background: #eaf5ef; margin-bottom: 30px;}
          .legacy-blue-return .c-subject__total { font-weight: bold; font-size: 110%; }
          
          .legacy-blue-return .p-input__price__title { display: flex; justify-content: flex-end; padding: 10px 15px; font-weight: bold; font-size: 12px; background: #f9f9f9; border-bottom: 1px solid #ccc; }
          .legacy-blue-return .p-input__price__title__left, .legacy-blue-return .p-input__price__title__right { width: 160px; text-align: center; margin-left: 10px;}
          .legacy-blue-return .p-input__price__ultag { list-style: none; margin: 0; padding: 0; }
          .legacy-blue-return .p-input__price__ultag li { display: flex; align-items: center; justify-content: space-between; padding: 8px 15px; border-bottom: 1px dotted #ccc; }
          .legacy-blue-return .p-input__price__subtitle { width: 30%; font-size: 14px;}
          .legacy-blue-return .p-input__price__contentBox { display: flex; width: 70%; justify-content: flex-end; }
          .legacy-blue-return .p-input__price__contentBox__left, .legacy-blue-return .p-input__price__contentBox__right { width: 160px; display: flex; align-items: center; justify-content: flex-end; margin-left: 10px;}
          .legacy-blue-return .c-title__content__befote { display: inline-flex; align-items: center; margin-left: 20px; font-weight: normal; font-size: 12px;}
          .legacy-blue-return .c-title__price-wrap { font-weight: bold; margin-left: 10px; font-size: 16px;}
          .legacy-blue-return .p-input__price__sum { background: #fcfaf2; font-weight: bold; }
          .legacy-blue-return .dayDisabled { background: #eee; border: 1px solid #ccc; padding: 4px; text-align: center; width: 40px;}

          .blur-amount {
            filter: blur(4px);
            color: #9ca3af !important;
            font-family: monospace;
            user-select: none;
            pointer-events: none;
          }
        `}</style>
        
        <div className="container" style={{ marginTop: '30px' }}>
          <div id="contents" style={{ marginBottom: '80px' }}>
            
            {/* 1. 月別の入力 */}
            <div style={{ marginBottom: '40px' }}>
              <h3>月別の入力</h3>
              <div className="p-contentsList sticky">
                <div className="p-contentsList__leftSection number">月</div>
                <div className="p-contentsList__middleSection name">売上（収入）金額（円）</div>
                <div className="p-contentsList__rightSection price">仕入金額（円）</div>
              </div>
              {monthlyInput.map((item, index) => (
                <div className="p-contentsList" key={index}>
                  <div className="p-contentsList__leftSection number">{item.month}月</div>
                  <div className="p-contentsList__middleSection name">
                    <span className="input-wrap">
                      <input type="text" className={`input-amount-inputbox ${amountClass}`} value={formatCurrency(item.sales)} readOnly />
                      <span className="c-unit__input">円</span>
                    </span>
                  </div>
                  <div className="p-contentsList__rightSection price">
                    <span className="input-wrap">
                      <input type="text" className={`input-amount-inputbox ${amountClass}`} value={formatCurrency(item.purchases)} readOnly />
                      <span className="c-unit__input">円</span>
                    </span>
                  </div>
                </div>
              ))}
              <div className="p-contentsList">
                <div className="p-contentsList__leftSection number">家事消費等</div>
                <div className="p-contentsList__middleSection name">
                  <span className="input-wrap">
                    <input type="text" className={`input-amount-inputbox ${amountClass}`} value={formatCurrency(kajishouhi)} readOnly />
                    <span className="c-unit__input">円</span>
                  </span>
                </div>
                <div className="p-contentsList__rightSection price"></div>
              </div>
              <div className="p-contentsList">
                <div className="p-contentsList__leftSection number">雑収入</div>
                <div className="p-contentsList__middleSection name">
                  <span className="input-wrap">
                    <input type="text" className={`input-amount-inputbox ${amountClass}`} value={formatCurrency(zatsushuunyuu)} readOnly />
                    <span className="c-unit__input">円</span>
                  </span>
                </div>
                <div className="p-contentsList__rightSection price"></div>
              </div>
              <div className="p-contentsList-2">
                <div className="p-contentsList__leftSection number">合計</div>
                <div className="p-contentsList__middleSection name">
                  <span className="input-wrap">
                    <input type="text" className={`input-amount-inputbox ${amountClass}`} style={{ fontWeight: 'bold', background: 'transparent', border: 'none' }} readOnly value={formatCurrency(calculatedSalesTotal)} />
                    <span className="c-unit__input">円</span>
                  </span>
                </div>
                <div className="p-contentsList__rightSection price">
                  <span className="input-wrap">
                    <input type="text" className={`input-amount-inputbox ${amountClass}`} style={{ fontWeight: 'bold', background: 'transparent', border: 'none' }} readOnly value={formatCurrency(calculatedPurchasesTotal)} />
                    <span className="c-unit__input">円</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 2. 売上（収入）金額の明細 */}
            <div style={{ marginBottom: '40px' }}>
              <h3>売上（収入）金額の明細</h3>
              <div className="detailTableSection">
                <div className="detailTableTitle">
                  <div className="col-num"></div>
                  <div className="col-reg">登録番号又は法人番号</div>
                  <div className="col-name">売上先名</div>
                  <div className="col-addr">所在地</div>
                  <div className="col-amount">売上（収入）金額（円）</div>
                </div>
                {salesDetails.length > 0 ? salesDetails.map((detail, index) => (
                  <div className="detailTableContent" key={index}>
                    <div className="col-num"><span className="hNumber">{index + 1}件目</span></div>
                    <div className="col-reg">
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>{detail.type}</div>
                      <input type="text" className="input-amount-inputbox" style={{ width: '100%', textAlign: 'left', color: '#999' }} value={detail.number} readOnly />
                    </div>
                    <div className="col-name">
                      <input type="text" className="input-amount-inputbox" style={{ width: '100%', textAlign: 'left' }} value={detail.name} readOnly />
                    </div>
                    <div className="col-addr">
                      <input type="text" className="input-amount-inputbox" style={{ width: '100%', textAlign: 'left', color: '#999' }} value={detail.address} readOnly />
                    </div>
                    <div className="col-amount">
                      <span className="input-wrap w100" style={{ justifyContent: 'flex-end' }}>
                        <input type="text" className={`input-amount-inputbox ${amountClass}`} style={{ width: '100px' }} value={formatCurrency(detail.amount)} readOnly />
                      </span>
                    </div>
                  </div>
                )) : <div className="p-4 text-center text-gray-500">明細はありません</div>}
              </div>
            </div>

            {/* 3. 仕入金額の明細 */}
            <div style={{ marginBottom: '40px' }}>
              <h3>仕入金額の明細</h3>
              <div className="detailTableSection">
                <div className="detailTableTitle">
                  <div className="col-num"></div>
                  <div className="col-reg">登録番号又は法人番号</div>
                  <div className="col-name">仕入先名</div>
                  <div className="col-addr">所在地</div>
                  <div className="col-amount">仕入金額（円）</div>
                </div>
                {purchasesDetails.length > 0 ? purchasesDetails.map((detail, index) => (
                  <div className="detailTableContent" key={index}>
                    <div className="col-num"><span className="hNumber">{index + 1}件目</span></div>
                    <div className="col-reg">
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '2px' }}>{detail.type}</div>
                      <input type="text" className="input-amount-inputbox" style={{ width: '100%', textAlign: 'left', color: '#999' }} value={detail.number} readOnly />
                    </div>
                    <div className="col-name">
                      <input type="text" className="input-amount-inputbox" style={{ width: '100%', textAlign: 'left' }} value={detail.name} readOnly />
                    </div>
                    <div className="col-addr">
                      <input type="text" className="input-amount-inputbox" style={{ width: '100%', textAlign: 'left', color: '#999' }} value={detail.address} readOnly />
                    </div>
                    <div className="col-amount">
                      <span className="input-wrap w100" style={{ justifyContent: 'flex-end' }}>
                        <input type="text" className={`input-amount-inputbox ${amountClass}`} style={{ width: '100px' }} value={formatCurrency(detail.amount)} readOnly />
                      </span>
                    </div>
                  </div>
                )) : <div className="p-4 text-center text-gray-500">明細はありません</div>}
              </div>
            </div>

            {/* 4. 損益計算書の入力 */}
            <h2 className="area-title" style={{ marginTop: '40px' }}>損益計算書の入力</h2>
            
            <div className="l-calculation">
              <div className="accordion-container">
                <p className="accordion-title">
                  <span>売上（収入）金額の合計</span>
                  <span className={amountClass}>{formatCurrency(totalSales)} 円</span>
                </p>
                <div className="c-low">
                  <div className="c-subject"><span className="item-Serial">1</span>売上（収入）金額（雑収入を含む）</div>
                  <div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(totalSales)} readOnly /> 円</div>
                </div>
              </div>
            </div>

            <div className="l-calculation">
              <div className="accordion-container">
                <p className="accordion-title">
                  <span>売上原価の合計</span>
                  <span className={amountClass}>{formatCurrency(summary?.costOfSales)} 円</span>
                </p>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">2</span>期首商品（製品）棚卸高</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(currentYearData?.openingBalances['商品'] || 0)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">3</span>仕入金額</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(calculatedPurchasesTotal)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject" style={{ paddingLeft: '34px' }}>製品製造原価</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(0)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">4</span>小計（2 ＋ 3）</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency((currentYearData?.openingBalances['商品'] || 0) + calculatedPurchasesTotal)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">5</span>期末商品（製品）棚卸高</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(summary?.closingInventory || 0)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">6</span>差引原価（4 － 5）</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(summary?.costOfSales)} readOnly /> 円</div></div>
                <div className="c-low" style={{ background: '#fcfaf2' }}>
                  <div className="c-subject"><span className="item-Serial">7</span>差引金額（1 － 6）</div>
                  <div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(totalSales - (summary?.costOfSales || 0))} readOnly style={{ fontWeight: 'bold', background: 'transparent' }} /> 円</div>
                </div>
              </div>
            </div>

            <div className="l-calculation">
              <div className="accordion-container">
                <p className="accordion-title">
                  <span>経費の合計</span>
                  <span className={amountClass}>{formatCurrency(expensesTotal)} 円</span>
                </p>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">8</span>租税公課</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.sozeiKouka)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">9</span>荷造運賃</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.nidzukuri)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">10</span>水道光熱費</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.suidouKounetsu)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">11</span>旅費交通費</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.ryohiKoutsu)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">12</span>通信費</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.tsuushin)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">13</span>広告宣伝費</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.koukoku)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">14</span>接待交際費</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.settai)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">15</span>損害保険料</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.songai)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">16</span>修繕費</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.shuuzen)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">17</span>消耗品費</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.shomouhin)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">18</span>減価償却費</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.genkashoukyaku)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">19</span>福利厚生費</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.fukuri)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">20</span>給料賃金</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.kyuuryou)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">21</span>外注工賃</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.gaichuu)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">22</span>利子割引料</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.rishi)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">23</span>地代家賃</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.chidai)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">24</span>貸倒金</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.kashidaore)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">31</span>雑費</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expenses.zappi)} readOnly /> 円</div></div>
                <div className="c-low"><div className="c-subject"><span className="item-Serial">32</span>経費合計</div><div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency(expensesTotal)} readOnly /> 円</div></div>
                <div className="c-low" style={{ background: '#fcfaf2' }}>
                  <div className="c-subject"><span className="item-Serial">33</span>差引金額（7 － 32）</div>
                  <div className="input-wrap"><input type="text" className={amountClass} value={formatCurrency((totalSales - (summary?.costOfSales || 0)) - expensesTotal)} readOnly style={{ fontWeight: 'bold', background: 'transparent' }} /> 円</div>
                </div>
              </div>
            </div>

            <div className="l-calculation">
              <div className="accordion-container">
                <p className="accordion-title" style={{ borderBottom: 'none' }}>
                  <span>繰戻額等の合計</span>
                  <span>－ 円</span>
                </p>
              </div>
            </div>

            <div className="l-calculation">
              <div className="accordion-container">
                <p className="accordion-title" style={{ borderBottom: 'none' }}>
                  <span>専従者給与・繰入額等の合計</span>
                  <span>－ 円</span>
                </p>
              </div>
            </div>

            <div className="total fixed" style={{ padding: '15px 20px' }}>
              <div className="c-low boNo" style={{ border: 'none', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="c-subject__total" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="item-Serial" style={{ background: '#197f4a', color: '#fff', borderColor: '#197f4a', fontWeight: 'normal' }}>43</span>
                    <span style={{ color: '#197f4a', fontSize: '120%', fontWeight: 'bold' }}>青色申告特別控除前の所得金額</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '5px', paddingLeft: '34px' }}>
                    (売上金額の合計 － 売上原価の合計 － 経費の合計 ＋ 繰戻額等の合計 － 専従者給与・繰入額等の合計)
                  </div>
                </div>
                <span className="input-wrap_total">
                  <input type="text" value={formatCurrency(summary?.income)} readOnly className={`text-align_right ${amountClass}`} style={{ fontSize: '130%', fontWeight: 'bold', padding: '6px', background: '#fff', border: '1px solid #197f4a', width: '160px', color: '#197f4a', textAlign: 'right' }} /> 円
                </span>
              </div>
            </div>

            {/* 5. 貸借対照表（資産負債調）の入力 */}
            <h2 className="area-title" style={{ marginTop: '40px' }}>貸借対照表（資産負債調）の入力</h2>
            
            <div className="balance-sheet">
              

              {/* 資産の部 */}
              <div className="l-calculation">
                <div className="accordion-container">
                  <div className="accordion-title">
                    <span className="c-title__content">資産の部</span>
                    <div className="c-title__price">
                      <span className="c-title__content__befote">期首 <span className="c-title__price-wrap"><span className={amountClass}>{formatCurrency(bsAssetsTotal.start)}</span> <span className="c-unit">円</span></span></span>
                      <span className="c-title__content__befote">期末 <span className="c-title__price-wrap"><span className={amountClass}>{formatCurrency(bsAssetsTotal.end)}</span> <span className="c-unit">円</span></span></span>
                    </div>
                  </div>
                  <div className="accordion-content no-input">
                    <div className="p-input__price__title">
                      <div className="p-input__price__title__left">期首（円）</div>
                      <div className="p-input__price__title__right">期末（円）</div>
                    </div>
                    <ul className="p-input__price__ultag">
                      {bsAssets.map((item, index) => (
                        <li key={index}>
                          <div className="p-input__price__subtitle">{item.name}</div>
                          <div className="p-input__price__contentBox">
                            <div className="p-input__price__contentBox__left">
                              <input type="text" className={`input-amount-inputbox ${amountClass}`} readOnly value={formatCurrency(item.start)} />
                              <span className="p-input__price--pricetag u-pc_only">円</span>
                            </div>
                            <div className="p-input__price__contentBox__right">
                              <input type="text" className={`input-amount-inputbox ${amountClass}`} readOnly value={formatCurrency(item.end)} />
                              <span className="p-input__price--pricetag u-pc_only">円</span>
                            </div>
                          </div>
                        </li>
                      ))}
                      <li className="p-input__price__sum">
                        <div className="p-input__price__subtitle">合計</div>
                        <div className="p-input__price__contentBox">
                          <div className="p-input__price__contentBox__left">
                            <input type="text" className={`input-amount-inputbox ${amountClass}`} readOnly value={formatCurrency(bsAssetsTotal.start)} />
                            <span className="p-input__price--pricetag u-pc_only">円</span>
                          </div>
                          <div className="p-input__price__contentBox__right">
                            <input type="text" className={`input-amount-inputbox ${amountClass}`} readOnly value={formatCurrency(bsAssetsTotal.end)} />
                            <span className="p-input__price--pricetag u-pc_only">円</span>
                          </div>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* 負債・資本の部 */}
              <div className="l-calculation">
                <div className="accordion-container">
                  <div className="accordion-title">
                    <span className="c-title__content">負債・資本の部</span>
                    <div className="c-title__price">
                      <span className="c-title__content__befote">期首 <span className="c-title__price-wrap"><span className={amountClass}>{formatCurrency(bsLiabilitiesTotal.start)}</span> <span className="c-unit">円</span></span></span>
                      <span className="c-title__content__befote">期末 <span className="c-title__price-wrap"><span style={{ color: '#197f4a' }} className={amountClass}>{formatCurrency(bsLiabilitiesTotal.end)}</span> <span className="c-unit">円</span></span></span>
                    </div>
                  </div>
                  <div className="accordion-content no-input">
                    <div className="p-input__price__title">
                      <div className="p-input__price__title__left">期首（円）</div>
                      <div className="p-input__price__title__right">期末（円）</div>
                    </div>
                    <ul className="p-input__price__ultag">
                      {bsLiabilities.map((item, index) => (
                        <li key={index}>
                          <div className="p-input__price__subtitle">{item.name}</div>
                          <div className="p-input__price__contentBox">
                            <div className="p-input__price__contentBox__left">
                              <input type="text" className={`input-amount-inputbox ${amountClass}`} readOnly value={formatCurrency(item.start)} />
                              <span className="p-input__price--pricetag u-pc_only">円</span>
                            </div>
                            <div className="p-input__price__contentBox__right">
                              <input type="text" className={`input-amount-inputbox ${amountClass}`} readOnly value={formatCurrency(item.end)} />
                              <span className="p-input__price--pricetag u-pc_only">円</span>
                            </div>
                          </div>
                        </li>
                      ))}
                      <li>
                        <div className="p-input__price__subtitle">青色申告特別控除前の所得金額</div>
                        <div className="p-input__price__contentBox">
                          <div className="p-input__price__contentBox__left" style={{ visibility: 'hidden' }}>
                            <input type="text" className="input-amount-inputbox" readOnly value="－" />
                          </div>
                          <div className="p-input__price__contentBox__right">
                            <input type="text" className={`input-amount-inputbox ${amountClass}`} style={{ color: '#197f4a', fontWeight: 'bold' }} readOnly value={formatCurrency(summary?.income)} />
                            <span className="p-input__price--pricetag u-pc_only">円</span>
                          </div>
                        </div>
                      </li>
                      <li className="p-input__price__sum">
                        <div className="p-input__price__subtitle">合計</div>
                        <div className="p-input__price__contentBox">
                          <div className="p-input__price__contentBox__left">
                            <input type="text" className={`input-amount-inputbox ${amountClass}`} readOnly value={formatCurrency(bsLiabilitiesTotal.start)} />
                            <span className="p-input__price--pricetag u-pc_only">円</span>
                          </div>
                          <div className="p-input__price__contentBox__right">
                            <input type="text" className={`input-amount-inputbox ${amountClass}`} readOnly value={formatCurrency(bsLiabilitiesTotal.end)} />
                            <span className="p-input__price--pricetag u-pc_only">円</span>
                          </div>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};