/**
 * The website sells and displays in USD only.
 * Paymob may still charge another currency at the gateway (see paymentService).
 */
const SITE_CURRENCY = 'USD';

function siteCurrency() {
  return SITE_CURRENCY;
}

/** Always USD for guest-facing / stored website amounts. */
function asSiteCurrency(_value) {
  return SITE_CURRENCY;
}

module.exports = {
  SITE_CURRENCY,
  siteCurrency,
  asSiteCurrency,
};
