const MAKE_LENGTH = 3;
const MODEL_LENGTH = 16;

/** Upper-case ASCII letters and digits only: accents are dropped, punctuation and spaces removed. */
function code(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Base stock-keeping code for a model, e.g. TOY-CAMRY. The repository adds -2, -3 on collisions. */
export function baseSku(make: string, model: string): string {
  return `${code(make).slice(0, MAKE_LENGTH) || 'X'}-${code(model).slice(0, MODEL_LENGTH) || 'X'}`;
}
