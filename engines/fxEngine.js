async function convertToNaira(amount, currency, db) {
  const snap = await db.collection('settings').doc('fx').get();
  const rates = snap.data();

  if (currency === 'CAD') return amount * rates.CAD;
  if (currency === 'USD') return amount * rates.USD;
  if (currency === 'CNY') return amount * rates.CNY;

  throw new Error('Unsupported currency');
}

module.exports = { convertToNaira };

