async function calculateLogistics(weightKg, db) {

  const snap = await db.collection('settings').doc('logistics').get();
  const config = snap.data();

  const freight = weightKg * config.airFreightPerKgUSD * 1500;
  const clearance = weightKg * config.clearancePerKgNGN;

  return freight + clearance + config.localDeliveryPerUnitNGN;
}

module.exports = { calculateLogistics };

