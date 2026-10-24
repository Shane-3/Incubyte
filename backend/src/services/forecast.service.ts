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

export function forecastVehicle(_sales: SalesSummary, _window: ForecastWindow): VehicleForecast {
  throw new Error('Not implemented');
}
