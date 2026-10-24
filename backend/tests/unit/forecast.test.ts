import { forecastVehicle } from '../../src/services/forecast.service';

const window = { windowDays: 30, atRiskDays: 7 };

function forecast(quantity: number, unitsSold: number) {
  return forecastVehicle({ vehicleId: 'camry', quantity, unitsSold }, window);
}

describe('forecastVehicle', () => {
  it('matches the worked example: 24 sold in 30 days with 2 left', () => {
    expect(forecast(2, 24)).toEqual({
      vehicleId: 'camry',
      avgDailySales: 0.8,
      daysOfStockLeft: 2.5,
      atRisk: true,
      suggestedRestock: 22,
    });
  });

  it('gives no estimate and no risk when nothing sold in the window', () => {
    expect(forecast(5, 0)).toEqual({
      vehicleId: 'camry',
      avgDailySales: 0,
      daysOfStockLeft: null,
      atRisk: false,
      suggestedRestock: 0,
    });
  });

  it('flags exactly 7 days left as at risk', () => {
    expect(forecast(7, 30)).toMatchObject({ daysOfStockLeft: 7, atRisk: true });
  });

  it('does not flag 7.1 days left', () => {
    expect(forecast(71, 300)).toMatchObject({ daysOfStockLeft: 7.1, atRisk: false });
  });

  it('rounds days left to one decimal', () => {
    expect(forecast(10, 9).daysOfStockLeft).toBe(33.3);
  });

  it('treats a sold-out vehicle with recent sales as at risk with zero days left', () => {
    expect(forecast(0, 15)).toMatchObject({ daysOfStockLeft: 0, atRisk: true, suggestedRestock: 15 });
  });

  it('never suggests a negative restock', () => {
    expect(forecast(100, 3).suggestedRestock).toBe(0);
  });

  it('rounds the suggestion up to whole units', () => {
    expect(forecastVehicle({ vehicleId: 'camry', quantity: 0, unitsSold: 10 }, { windowDays: 7, atRiskDays: 3 })).toMatchObject(
      { avgDailySales: 1.43, suggestedRestock: 10 },
    );
  });
});
