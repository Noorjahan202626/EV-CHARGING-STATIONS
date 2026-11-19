// backend/utils/vehicleValidation.js

// Valid Indian State/UT codes (MoRTH official list)
export const VALID_STATE_CODES = new Set([
  "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN",
  "GA", "GJ", "HP", "HR", "JH", "JK", "KA", "KL", "LA", "LD",
  "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "OR", "PB", "PY",
  "RJ", "SK", "TG", "TN", "TR", "TS", "UK", "UP", "WB"
]);

// Matches:
// 1. Standard RTO: 2-letter state + 1-2 digit RTO + 1-3 letters (no I/O) + 4 digits (0001-9999)
// 2. BH-Series:    2-digit year (21-99) + "BH" + 4 digits (0001-9999) + 1-2 letters (no I/O)
export const STANDARD_RTO_REGEX = /^([A-Z]{2})([0-9]{1,2})([A-HJ-NP-Z]{1,3})([0-9]{4})$/;
export const BH_SERIES_REGEX = /^(2[1-9]|[3-9][0-9])BH([0-9]{4})([A-HJ-NP-Z]{1,2})$/;

export function normalizeIndianRegNo(input) {
  if (!input || typeof input !== "string") return "";
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function validateIndianVehicleNumber(input) {
  const clean = normalizeIndianRegNo(input);

  if (!clean) {
    return { valid: false, error: "Vehicle registration number is required." };
  }

  // Check BH-Series
  const bhMatch = clean.match(BH_SERIES_REGEX);
  if (bhMatch) {
    const num = Number(bhMatch[2]);
    if (num === 0) {
      return { valid: false, error: "Registration number cannot end in 0000." };
    }
    return { valid: true, normalized: clean, type: "BH" };
  }

  // Check Standard State/UT RTO
  const rtoMatch = clean.match(STANDARD_RTO_REGEX);
  if (rtoMatch) {
    const [, stateCode, rtoCode, , numStr] = rtoMatch;

    if (!VALID_STATE_CODES.has(stateCode)) {
      return { valid: false, error: `Invalid state/UT code "${stateCode}".` };
    }
    // Only Delhi (DL) permits single-digit RTO codes without leading zero (e.g., DL1C...)
    if (rtoCode.length === 1 && stateCode !== "DL") {
      return { valid: false, error: `Use a 2-digit RTO code (e.g., ${stateCode}0${rtoCode}...).` };
    }
    if (rtoCode === "00") {
      return { valid: false, error: "RTO code cannot be 00." };
    }
    if (Number(numStr) === 0) {
      return { valid: false, error: "Registration number cannot end in 0000." };
    }

    return { valid: true, normalized: clean, type: "RTO" };
  }

  return {
    valid: false,
    error: "Invalid format. Enter a valid Indian plate (e.g., KA25AB1234 or 24BH1234AA)."
  };
}
