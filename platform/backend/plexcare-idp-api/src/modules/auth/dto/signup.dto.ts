import { z } from 'zod';

export const SignupDto = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  full_name: z.string().min(2).max(200),
  customer_document: z.string().min(11).max(20),
  person_type: z.enum(['PF', 'PJ']).optional(),
  accept_terms: z.literal(true),
  client_id: z.string().default('plexcare-login-web'),
});

export type SignupRequest = z.infer<typeof SignupDto>;
