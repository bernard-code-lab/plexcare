import { AppException } from '../errors/app-exception';

/**
 * OWASP ASVS L1 password policy (backend-canonical).
 * - Length ≥ 12
 * - At least 3 of {lower, upper, digit, symbol}
 */
export function validatePassword(password: string, errorCode: 'signup_password_weak' | 'password_policy_violation' = 'signup_password_weak'): void {
  if (password.length < 12) {
    throw new AppException(errorCode, { detail: 'Senha deve ter no mínimo 12 caracteres.' });
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rx) => rx.test(password)).length;
  if (classes < 3) {
    throw new AppException(errorCode, {
      detail: 'Senha deve combinar 3 de 4: minúscula, maiúscula, dígito, símbolo.',
    });
  }
}
