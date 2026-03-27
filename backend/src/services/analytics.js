// Port of frontend analytics.js — pure functions on bill arrays
// Used by: /api/analytics route, /api/customers (KPI enrichment), WhatsApp /stats command

function getAllItems(bills) {
  return bills.reduce((acc, b) =>
    acc.concat((b.items || []).map(i => ({
      ...i, billDate: b.date, billTotal: b.total, currency: b.currency,
    }))), []);
}

function monthKey(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0');
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getSpendingByMonth(bills) {
  const map = {};
  bills.forEach(b => { const k = monthKey(b.date); if (k) map[k] = (map[k] || 0) + (b.total || 0); });
  const sorted = Object.keys(map).sort();
  return { labels: sorted.map(monthLabel), data: sorted.map(k => +map[k].toFixed(2)) };
}

function getCategoryBreakdown(bills) {
  const items = getAllItems(bills);
  const map = {};
  items.forEach(i => {
    const c = i.category || 'Other';
    if (!map[c]) map[c] = { total: 0, count: 0 };
    map[c].total += i.price || 0;
    map[c].count++;
  });
  const grand = Object.values(map).reduce((s, v) => s + v.total, 0);
  return Object.entries(map)
    .map(([category, { total, count }]) => ({
      category, total: +total.toFixed(2), count,
      percentage: grand > 0 ? +((total / grand) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function getBrandFrequency(bills, topN = 10) {
  const map = {};
  getAllItems(bills).forEach(i => {
    if (!i.brand) return;
    const b = i.brand.trim(); if (!b) return;
    if (!map[b]) map[b] = { count: 0, totalSpent: 0 };
    map[b].count++;
    map[b].totalSpent += i.price || 0;
  });
  return Object.entries(map)
    .map(([brand, { count, totalSpent }]) => ({ brand, count, totalSpent: +totalSpent.toFixed(2) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

function getStoreFrequency(bills, topN = 10) {
  const map = {};
  bills.forEach(b => {
    const s = (b.store_name || 'Unknown').trim();
    if (!map[s]) map[s] = { visits: 0, totalSpent: 0 };
    map[s].visits++;
    map[s].totalSpent += b.total || 0;
  });
  return Object.entries(map)
    .map(([store, { visits, totalSpent }]) => ({ store, visits, totalSpent: +totalSpent.toFixed(2) }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, topN);
}

function getKpiSummary(bills) {
  if (!bills.length) return { totalBills: 0, totalSpend: 0, avgBillValue: 0, topStore: '—', topBrand: '—', topCategory: '—' };
  const totalSpend = +bills.reduce((s, b) => s + (b.total || 0), 0).toFixed(2);
  const stores = getStoreFrequency(bills, 1);
  const brands = getBrandFrequency(bills, 1);
  const cats   = getCategoryBreakdown(bills);
  return {
    totalBills: bills.length,
    totalSpend,
    avgBillValue: +(totalSpend / bills.length).toFixed(2),
    topStore:    (stores[0] || {}).store    || '—',
    topBrand:    (brands[0] || {}).brand    || '—',
    topCategory: (cats[0]   || {}).category || '—',
  };
}

function computeSegment(bills) {
  if (bills.length < 3) return { primary: 'Insufficient Data', secondary: null, color: '#475569', description: 'Scan at least 3 bills to compute a segment.', scores: {} };
  const totalSpend = bills.reduce((s, b) => s + (b.total || 0), 0);
  const avgBill = totalSpend / bills.length;
  const dates = bills.map(b => b.date).filter(Boolean).map(d => new Date(d)).filter(d => !isNaN(d));
  let bpm = 0;
  if (dates.length >= 2) {
    dates.sort((a, b) => a - b);
    const months = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24 * 30.5);
    bpm = months > 0 ? bills.length / months : bills.length;
  }
  const items   = getAllItems(bills);
  const branded = items.filter(i => i.brand && i.brand.trim());
  const bcount  = {};
  branded.forEach(i => { const b = i.brand.trim(); bcount[b] = (bcount[b] || 0) + 1; });
  const unique = Object.keys(bcount).length;
  const topBC  = unique ? Math.max(...Object.values(bcount)) : 0;
  const bRepeat = branded.length > 0 ? (branded.length - unique) / branded.length : 0;
  const luxItems = items.filter(i => ['Electronics', 'Clothing & Apparel'].includes(i.category));
  const luxRatio = totalSpend > 0 ? luxItems.reduce((s, i) => s + (i.price || 0), 0) / totalSpend : 0;
  const spendScore = avgBill < 20 ? 20 : avgBill < 60 ? 50 : avgBill < 150 ? 75 : 95;
  let brandScore = bRepeat < 0.3 ? 20 : bRepeat < 0.6 ? 50 : 85;
  if (topBC >= 5) brandScore = Math.min(100, brandScore + 15);
  const freqScore = bpm < 1 ? 20 : bpm < 4 ? 50 : 80;
  let primary, color, description;
  if (brandScore >= 70 && topBC >= 4) { primary = 'Brand Loyal'; color = '#a855f7'; description = 'Shows strong preference for specific brands.'; }
  else if (spendScore >= 80 || luxRatio > 0.4) { primary = 'Luxury Shopper'; color = '#f59e0b'; description = 'Regularly purchases premium and high-value items.'; }
  else if (spendScore >= 50) { primary = 'Mid-Range Shopper'; color = '#3b82f6'; description = 'Balances value and quality in purchases.'; }
  else { primary = 'Budget Shopper'; color = '#10b981'; description = 'Prioritizes value and affordability.'; }
  return { primary, secondary: freqScore >= 70 ? 'Frequent Shopper' : null, color, description, scores: { spend: spendScore, brandLoyalty: brandScore, frequency: freqScore } };
}

module.exports = { getSpendingByMonth, getCategoryBreakdown, getBrandFrequency, getStoreFrequency, getKpiSummary, computeSegment };
