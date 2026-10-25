import { formatPrice } from './format';

describe('formatPrice', () => {
  it('leaves whole prices without cents', () => {
    expect(formatPrice(28400)).toBe('$28,400');
  });

  it('always shows cents as two digits', () => {
    expect(formatPrice(27999.5)).toBe('$27,999.50');
    expect(formatPrice(38999.99)).toBe('$38,999.99');
  });
});
