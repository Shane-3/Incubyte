export interface SalesSummary {
  vehicleId: string;
  quantity: number;
  /** Units sold within the forecast window. */
  unitsSold: number;
}

export interface ForecastWindow {
  windowDays: number;
  atRiskDays: number;
}

export interface VehicleForecast {
  vehicleId: string;
  avgDailySales: number;
  daysOfStockLeft: number | null;
  atRisk: boolean;
  suggestedRestock: number;
}

const round = (value: number, decimals: number) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Pure stock-out forecast for one vehicle (design.md section 5A). The suggested restock covers one window of
 * sales; it is computed from the integer units sold, not the rounded average, so no float error creeps in.
 */
export function forecastVehicle({ vehicleId, quantity, unitsSold }: SalesSummary, window: ForecastWindow): VehicleForecast {
  if (unitsSold === 0) {
    return { vehicleId, avgDailySales: 0, daysOfStockLeft: null, atRisk: false, suggestedRestock: 0 };
  }

  const daysOfStockLeft = round((quantity * window.windowDays) / unitsSold, 1);
  return {
    vehicleId,
    avgDailySales: round(unitsSold / window.windowDays, 2),
    daysOfStockLeft,
    atRisk: daysOfStockLeft <= window.atRiskDays,
    suggestedRestock: Math.max(0, unitsSold - quantity),
  };
}
