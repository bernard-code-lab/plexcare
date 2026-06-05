/** Strict numeric validation of CPF (11 digits) or CNPJ (14 digits). */
export function isValidDocument(raw: string): { ok: true; kind: 'PF' | 'PJ'; digits: string } | { ok: false } {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) return validateCpf(digits) ? { ok: true, kind: 'PF', digits } : { ok: false };
  if (digits.length === 14) return validateCnpj(digits) ? { ok: true, kind: 'PJ', digits } : { ok: false };
  return { ok: false };
}

function validateCpf(cpf: string): boolean {
  if (/^(\d)\1+$/.test(cpf)) return false;
  const digits = cpf.split('').map(Number);
  const check = (slice: number[], factorStart: number) => {
    const sum = slice.reduce((acc, d, i) => acc + d * (factorStart - i), 0);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return check(digits.slice(0, 9), 10) === digits[9] && check(digits.slice(0, 10), 11) === digits[10];
}

function validateCnpj(cnpj: string): boolean {
  if (/^(\d)\1+$/.test(cnpj)) return false;
  const digits = cnpj.split('').map(Number);
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, ...weights1];
  const check = (slice: number[], weights: number[]) => {
    const sum = slice.reduce((acc, d, i) => acc + d * weights[i]!, 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  return check(digits.slice(0, 12), weights1) === digits[12] && check(digits.slice(0, 13), weights2) === digits[13];
}
