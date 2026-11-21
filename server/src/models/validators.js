export function isNonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

export function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function hasAtMostTwoDecimalPlaces(value) {
  if (!Number.isFinite(value) || value < 0) return false;
  const cents = value * 100;
  return Math.abs(cents - Math.round(cents)) < 1e-8;
}
