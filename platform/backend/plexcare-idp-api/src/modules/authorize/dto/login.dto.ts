import { z } from 'zod';

export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  client_id: z.string(),
  redirect_uri: z.string().url(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal('S256'),
  state: z.string().min(16),
  nonce: z.string().optional(),
});

export type LoginRequest = z.infer<typeof LoginDto>;
