import { baseSku } from '../../src/services/sku';

describe('baseSku', () => {
  it.each([
    ['Toyota', 'Camry', 'TOY-CAMRY'],
    ['Mercedes-Benz', 'C 300', 'MER-C300'],
    ['Ford', 'F-150', 'FOR-F150'],
    ['BMW', '330i', 'BMW-330I'],
    ['Citroën', 'ë-C4', 'CIT-EC4'],
    ['VW', 'Golf GTI', 'VW-GOLFGTI'],
    ['Chevrolet', 'Corvette Stingray Z06 Convertible', 'CHE-CORVETTESTINGRAY'],
  ])('derives a code from %s %s', (make, model, sku) => {
    expect(baseSku(make, model)).toBe(sku);
  });

  it('only ever contains capital letters, digits and hyphens', () => {
    expect(baseSku('Rolls-Royce', 'Phantom (VIII) & co.')).toMatch(/^[A-Z0-9]+-[A-Z0-9]+$/);
  });
});
