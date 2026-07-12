const { getPeriodBrandData } = require("./salesPeriodService");
const { getLatestSalesMonth } = require("./salesMonthService");

const normalize = (v) => String(v ?? "").trim().toUpperCase();
const sortDesc = (a, k) => [...a].sort((x,y)=>Number(y[k]||0)-Number(x[k]||0));
const sortAsc = (a, k) => [...a].sort((x,y)=>Number(x[k]||0)-Number(y[k]||0));

function filterDaysByDate(days, fromDate, toDate) {
  return (days || []).filter((day) => {
    const date = String(day.date || "");
    return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
  });
}

function buildExecutiveAlerts({ kpis, topStores, bottomStores, salesTypeMix, countrySales }) {
  const alerts = [];
  if (Number(kpis.discountPercent || 0) >= 10) {
    alerts.push({ type:"discount", level:"warning", message:`Discounts are ${Number(kpis.discountPercent).toFixed(1)}% of revenue.` });
  }
  const topStore = topStores[0];
  if (topStore && Number(topStore.contribution_percent || 0) >= 20) {
    alerts.push({ type:"store", level:"warning", message:`${topStore.store_name} contributes ${Number(topStore.contribution_percent).toFixed(1)}% of revenue.` });
  }
  const bottomStore = bottomStores[0];
  if (bottomStore) {
    alerts.push({ type:"low-store", level:"critical", message:`${bottomStore.store_name} is the lowest-revenue active store.` });
  }
  const topChannel = salesTypeMix[0];
  if (topChannel && Number(kpis.netRevenue || 0)) {
    alerts.push({ type:"channel", level:"info", message:`${topChannel.name} leads channel revenue at ${(Number(topChannel.value||0)/Number(kpis.netRevenue)*100).toFixed(1)}%.` });
  }
  const topCountry = countrySales[0];
  if (topCountry && Number(kpis.netRevenue || 0)) {
    alerts.push({ type:"country", level:"info", message:`${topCountry.name} contributes ${(Number(topCountry.value||0)/Number(kpis.netRevenue)*100).toFixed(1)}% of revenue.` });
  }
  if (Number(kpis.avgOrderValue || 0) < 25) {
    alerts.push({ type:"aov", level:"warning", message:"Average order value is below AED 25." });
  }
  if (!alerts.length) alerts.push({ type:"healthy", level:"info", message:"No major exceptions detected for the selected period." });
  return alerts;
}

function aggregateFilteredDays(days, country, storeCode, search) {
  const normalizedCountry = normalize(country);
  const normalizedStore = String(storeCode || "").trim();
  const normalizedSearch = normalize(search);

  let netRevenue=0, discounts=0, itemsSold=0, orders=0;
  const dates=new Set(), countryMap=new Map(), companyMap=new Map(), salesTypeMap=new Map();
  const storeMap=new Map(), itemMap=new Map(), revenueTrend=new Map(), ordersTrend=new Map(), aovTrend=new Map();

  for (const day of days || []) {
    let dayRevenue=0, dayOrders=0;
    for (const store of day.stores || []) {
      if (normalizedCountry && normalize(store.country_name)!==normalizedCountry) continue;
      if (normalizedStore && String(store.store_code).trim()!==normalizedStore) continue;

      const storeRevenue=Number(store.net_sales||0), storeDiscount=Number(store.discounts||0);
      const storeQuantity=Number(store.quantity||0), storeOrders=Number(store.orders||0);
      netRevenue+=storeRevenue; discounts+=storeDiscount; itemsSold+=storeQuantity; orders+=storeOrders;
      dayRevenue+=storeRevenue; dayOrders+=storeOrders; if(day.date) dates.add(day.date);

      const key=String(store.store_code||"").trim();
      if(!storeMap.has(key)) storeMap.set(key,{store_code:store.store_code,store_name:store.store_name,country_code:store.country_code,country_name:store.country_name,company_code:store.company_code,company_name:store.company_name,net_sales:0,discounts:0,quantity:0,orders:0});
      const s=storeMap.get(key); s.net_sales+=storeRevenue; s.discounts+=storeDiscount; s.quantity+=storeQuantity; s.orders+=storeOrders;

      const cn=store.country_name||store.country_code||"Unknown";
      const co=store.company_name||store.company_code||"Unknown";
      countryMap.set(cn,(countryMap.get(cn)||0)+storeRevenue);
      companyMap.set(co,(companyMap.get(co)||0)+storeRevenue);

      for(const ch of store.sales_types||[]) salesTypeMap.set(ch.name||"UNKNOWN",(salesTypeMap.get(ch.name||"UNKNOWN")||0)+Number(ch.value||0));

      for(const item of store.items||[]) {
        const label=item.item_description||item.item_no||"Unknown Item";
        if(normalizedSearch && !normalize(label).includes(normalizedSearch)) continue;
        const itemKey=String(item.item_no||label);
        if(!itemMap.has(itemKey)) itemMap.set(itemKey,{item_no:item.item_no,item_description:label,quantity:0,net_sales:0});
        const it=itemMap.get(itemKey); it.quantity+=Number(item.quantity||0); it.net_sales+=Number(item.net_sales||0);
      }
    }
    if(day.date){ revenueTrend.set(day.date,dayRevenue); ordersTrend.set(day.date,dayOrders); aovTrend.set(day.date,dayOrders?dayRevenue/dayOrders:0); }
  }

  const reportingDays=dates.size||1;
  const storeDirectory=Array.from(storeMap.values()).map(s=>({...s,avg_order_value:s.orders?s.net_sales/s.orders:0,avg_daily_sales:s.net_sales/reportingDays,contribution_percent:netRevenue?(s.net_sales/netRevenue)*100:0}));
  const itemRanking=Array.from(itemMap.values());
  const countrySales=sortDesc(Array.from(countryMap.entries()).map(([name,value])=>({name,value})),"value");
  const companySales=sortDesc(Array.from(companyMap.entries()).map(([name,value])=>({name,value})),"value");
  const salesTypeMix=sortDesc(Array.from(salesTypeMap.entries()).map(([name,value])=>({name,value})),"value");
  const topStores=sortDesc(storeDirectory,"net_sales").slice(0,10);
  const bottomStores=sortAsc(storeDirectory.filter(x=>Number(x.net_sales||0)>0),"net_sales").slice(0,10);
  const kpis={netRevenue,orders,avgOrderValue:orders?netRevenue/orders:0,discounts,discountPercent:netRevenue?(discounts/netRevenue)*100:0,itemsSold,activeStores:storeMap.size,averageDailySales:netRevenue/reportingDays,averageDailySalesPerOutlet:storeMap.size?netRevenue/reportingDays/storeMap.size:0,reportingDays};

  return {
    kpis,
    revenueTrend:Array.from(revenueTrend.entries()).map(([date,value])=>({date,value})).sort((a,b)=>a.date.localeCompare(b.date)),
    ordersTrend:Array.from(ordersTrend.entries()).map(([date,value])=>({date,value})).sort((a,b)=>a.date.localeCompare(b.date)),
    avgOrderValueTrend:Array.from(aovTrend.entries()).map(([date,value])=>({date,value})).sort((a,b)=>a.date.localeCompare(b.date)),
    countrySales,companySales,salesTypeMix,storeDirectory:sortDesc(storeDirectory,"net_sales"),topStores,bottomStores,
    topItemsByRevenue:sortDesc(itemRanking,"net_sales").slice(0,10),
    topItemsByQuantity:sortDesc(itemRanking,"quantity").slice(0,10),
    bottomItemsByRevenue:sortAsc(itemRanking.filter(x=>Number(x.net_sales||0)>0),"net_sales").slice(0,10),
    bottomItemsByQuantity:sortAsc(itemRanking.filter(x=>Number(x.quantity||0)>0),"quantity").slice(0,10),
    executiveAlerts:buildExecutiveAlerts({kpis,topStores,bottomStores,salesTypeMix,countrySales}),
  };
}

async function getSalesDashboard({brandCode,month,period="MTD",country="",store="",search="",fromDate="",toDate=""}) {
  const selectedMonth=month||getLatestSalesMonth();
  if(!selectedMonth) throw new Error("No sales summary data is available");
  const normalizedBrandCode=normalize(brandCode), normalizedPeriod=normalize(period||"MTD");
  const periodData=getPeriodBrandData({selectedMonth,period:normalizedPeriod,brandCode:normalizedBrandCode});
  if(!periodData.selectedBrand) throw new Error(`Brand ${normalizedBrandCode} not found for ${selectedMonth}`);
  const dateFilteredDays=filterDaysByDate(periodData.days||[],fromDate,toDate);
  const aggregated=aggregateFilteredDays(dateFilteredDays,country,store,search);
  const storeOptions=(periodData.selectedBrand.stores||[]).filter(x=>!country||normalize(x.country_name)===normalize(country)).map(x=>({store_code:x.store_code,store_name:x.store_name,country_name:x.country_name})).sort((a,b)=>String(a.store_name||"").localeCompare(String(b.store_name||"")));

  return {
    success:true,brandCode:normalizedBrandCode,brandName:periodData.selectedBrand.brandName||normalizedBrandCode,
    month:selectedMonth,period:normalizedPeriod,currency:periodData.selectedSummary?.currency||"AED",
    periodInfo:{type:normalizedPeriod,selectedMonth,includedMonths:periodData.includedMonths||[],includedFiles:periodData.includedFiles||[],sourceByMonth:periodData.sourceByMonth||{},requestedFromDate:fromDate||null,requestedToDate:toDate||null,startDate:dateFilteredDays[0]?.date||null,endDate:dateFilteredDays.at(-1)?.date||null},
    filters:{countries:[...(periodData.selectedBrand.countries||[])].sort(),stores:storeOptions,periods:["WTD","MTD","YTD"]},
    ...aggregated,
  };
}

async function refreshSalesMonth(month){
  const selectedMonth=month||getLatestSalesMonth();
  if(!selectedMonth) throw new Error("No sales summary data is available");
  return {success:true,message:`Sales data is available for ${selectedMonth}`,month:selectedMonth};
}

module.exports={getSalesDashboard,refreshSalesMonth};
