import { validatePassword } from '../../../src/shared/auth/password-policy';
import { isValidDocument } from '../../../src/shared/auth/document-validator';

describe('validatePassword', () => {
  it('accepts 12+ chars with 3 classes', () => {
    expect(() => validatePassword('Senha123abc!')).not.toThrow();
  });
  it('rejects < 12 chars', () => {
    expect(() => validatePassword('Short1!')).toThrow(/12/);
  });
  it('rejects when missing classes', () => {
    expect(() => validatePassword('aaaaaaaaaaaa')).toThrow(/3 de 4/);
  });
});

describe('isValidDocument', () => {
  it('rejects 0-digit doc', () => {
    expect(isValidDocument('not-a-number').ok).toBe(false);
  });
  it('rejects all-same-digit CPF', () => {
    expect(isValidDocument('11111111111').ok).toBe(false);
  });
  it('rejects all-same-digit CNPJ', () => {
    expect(isValidDocument('11111111111111').ok).toBe(false);
  });
  it('accepts a valid CPF', () => {
    // 123.456.789-09
    const out = isValidDocument('12345678909');
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.kind).toBe('PF');
  });
  it('accepts a valid CNPJ', () => {
    const out = isValidDocument('11.222.333/0001-81');
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.kind).toBe('PJ');
      expect(out.digits).toBe('11222333000181');
    }
  });
});
