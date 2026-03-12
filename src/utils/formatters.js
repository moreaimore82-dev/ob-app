export function formatFiyat(value, decimals) {
  return Number(value).toLocaleString('tr-TR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatHacim(value) {
  return Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

export function getDecimals(price) {
  if (price < 1) return 5;
  if (price > 1000) return 0;
  return 2;
}
