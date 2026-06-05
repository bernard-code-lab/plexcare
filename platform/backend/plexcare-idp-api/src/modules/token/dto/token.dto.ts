import { z } from 'zod';

export const TokenExchangeDto = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  account_id: z.string().optional(),
});

export type TokenExchangeRequest = z.infer<typeof TokenExchangeDto>;

export const RefreshDto = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string().uuid(),
  client_id: z.string(),
});

export type RefreshRequest = z.infer<typeof RefreshDto>;

export const RevokeDto = z.object({
  refresh_token: z.string().uuid(),
  reason: z.enum(['logout', 'admin_revoke']).default('logout'),
});

export type RevokeRequest = z.infer<typeof RevokeDto>;

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  token_type: 'Bearer';
  expires_in: number;
  scope: string;
}
