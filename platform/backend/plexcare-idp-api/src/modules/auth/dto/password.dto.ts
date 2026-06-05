import { z } from 'zod';

export const ForgotPasswordDto = z.object({
  email: z.string().email(),
});
export type ForgotPasswordRequest = z.infer<typeof ForgotPasswordDto>;

export const ResetPasswordDto = z.object({
  reset_token: z.string().min(1),
  new_password: z.string().min(12).max(128),
});
export type ResetPasswordRequest = z.infer<typeof ResetPasswordDto>;

export const ChangePasswordDto = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(12).max(128),
});
export type ChangePasswordRequest = z.infer<typeof ChangePasswordDto>;

export const VerifyEmailDto = z.object({
  verification_token: z.string().min(1),
});
export type VerifyEmailRequest = z.infer<typeof VerifyEmailDto>;
