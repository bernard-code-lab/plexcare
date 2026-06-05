/**
 * Hand-rolled OpenAPI 3.1 document mirroring the contracts in
 * tasks/idp-api-blueprint.md §4. We avoid runtime Nest reflection to keep
 * the contract decoupled from controller annotations — single source of
 * truth lives here.
 */

import type { OpenAPIObject } from '@nestjs/swagger';

const PROBLEM_RESPONSE = {
  description: 'RFC 7807 problem+json',
  content: {
    'application/problem+json': {
      schema: {
        type: 'object' as const,
        required: ['type', 'title', 'status', 'code', 'detail', 'instance'],
        properties: {
          type: { type: 'string' as const, format: 'uri' },
          title: { type: 'string' as const },
          status: { type: 'integer' as const },
          code: { type: 'string' as const },
          detail: { type: 'string' as const },
          instance: { type: 'string' as const },
          trace_id: { type: 'string' as const },
        },
      },
    },
  },
};

export function buildOpenApiDocument(): OpenAPIObject {
  return {
    openapi: '3.1.0',
    info: {
      title: 'plexcare-idp-api',
      version: '0.1.0',
      description:
        'Authorization Server (NestJS + Prisma + MySQL). OIDC-like com PKCE, JWT Ed25519, refresh rotacionável.',
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'auth', description: 'Signup, login, reset, change, verify' },
      { name: 'token', description: 'Token exchange, refresh, revoke' },
      { name: 'me', description: 'User profile & sessions' },
      { name: 'discovery', description: 'OIDC well-known' },
      { name: 'ops', description: 'Health, metrics' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      responses: { Problem: PROBLEM_RESPONSE },
      schemas: {
        SignupRequest: {
          type: 'object',
          required: ['email', 'password', 'full_name', 'customer_document', 'accept_terms'],
          properties: {
            email: { type: 'string', format: 'email', maxLength: 255 },
            password: { type: 'string', minLength: 12, maxLength: 128 },
            full_name: { type: 'string', minLength: 2, maxLength: 200 },
            customer_document: { type: 'string', description: 'CPF (11) ou CNPJ (14)' },
            person_type: { type: 'string', enum: ['PF', 'PJ'] },
            accept_terms: { type: 'boolean', enum: [true] },
            client_id: { type: 'string' },
          },
        },
        SignupAccepted: {
          type: 'object',
          properties: {
            idp_user_id: { type: 'string' },
            verification_sent_to: { type: 'string', format: 'email' },
            message: { type: 'string' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: [
            'email',
            'password',
            'client_id',
            'redirect_uri',
            'code_challenge',
            'code_challenge_method',
            'state',
          ],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
            client_id: { type: 'string' },
            redirect_uri: { type: 'string', format: 'uri' },
            code_challenge: { type: 'string', minLength: 43, maxLength: 128 },
            code_challenge_method: { type: 'string', enum: ['S256'] },
            state: { type: 'string', minLength: 16 },
            nonce: { type: 'string' },
          },
        },
        LoginResponse: {
          type: 'object',
          required: ['code', 'state', 'redirect_uri'],
          properties: {
            code: { type: 'string' },
            state: { type: 'string' },
            redirect_uri: { type: 'string', format: 'uri' },
          },
        },
        TokenRequest: {
          type: 'object',
          required: ['grant_type', 'code', 'code_verifier', 'client_id', 'redirect_uri'],
          properties: {
            grant_type: { type: 'string', enum: ['authorization_code'] },
            code: { type: 'string' },
            code_verifier: { type: 'string', minLength: 43, maxLength: 128 },
            client_id: { type: 'string' },
            redirect_uri: { type: 'string', format: 'uri' },
            account_id: { type: 'string' },
          },
        },
        RefreshRequest: {
          type: 'object',
          required: ['grant_type', 'refresh_token', 'client_id'],
          properties: {
            grant_type: { type: 'string', enum: ['refresh_token'] },
            refresh_token: { type: 'string', format: 'uuid' },
            client_id: { type: 'string' },
          },
        },
        RevokeRequest: {
          type: 'object',
          required: ['refresh_token'],
          properties: {
            refresh_token: { type: 'string', format: 'uuid' },
            reason: { type: 'string', enum: ['logout', 'admin_revoke'] },
          },
        },
        TokenResponse: {
          type: 'object',
          required: ['access_token', 'refresh_token', 'id_token', 'token_type', 'expires_in', 'scope'],
          properties: {
            access_token: { type: 'string' },
            refresh_token: { type: 'string', format: 'uuid' },
            id_token: { type: 'string' },
            token_type: { type: 'string', enum: ['Bearer'] },
            expires_in: { type: 'integer' },
            scope: { type: 'string' },
          },
        },
        MeResponse: {
          type: 'object',
          required: ['idp_user_id', 'email', 'email_verified', 'active_role', 'account', 'roles'],
          properties: {
            idp_user_id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            email_verified: { type: 'boolean' },
            active_role: { type: 'string' },
            customer: { type: 'object', properties: { id: { type: 'string' } } },
            account: { type: 'object', properties: { id: { type: 'string' } } },
            roles: { type: 'array', items: { $ref: '#/components/schemas/UserRole' } },
          },
        },
        UserRole: {
          type: 'object',
          properties: {
            account_id: { type: 'string' },
            role: { type: 'string', enum: ['doctor', 'employee', 'client', 'admin'] },
            doctor_id: { type: 'string', nullable: true },
            client_id: { type: 'string', nullable: true },
            employee_id: { type: 'string', nullable: true },
            is_default: { type: 'boolean' },
          },
        },
        Session: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            client_id: { type: 'string' },
            user_agent: { type: 'string', nullable: true },
            ip_address: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            last_used_at: { type: 'string', format: 'date-time' },
            is_current: { type: 'boolean' },
          },
        },
      },
    },
    paths: {
      '/v1/auth/signup': {
        post: {
          tags: ['auth'],
          operationId: 'signup',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupRequest' } } },
          },
          parameters: [{ in: 'header', name: 'Idempotency-Key', schema: { type: 'string' } }],
          responses: {
            '202': {
              description: 'aceito',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/SignupAccepted' } } },
            },
            '409': { $ref: '#/components/responses/Problem' },
            '422': { $ref: '#/components/responses/Problem' },
            '429': { $ref: '#/components/responses/Problem' },
            '503': { $ref: '#/components/responses/Problem' },
          },
        },
      },
      '/v1/auth/login': {
        post: {
          tags: ['auth'],
          operationId: 'login',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
          },
          responses: {
            '200': {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } },
            },
            '401': { $ref: '#/components/responses/Problem' },
            '403': { $ref: '#/components/responses/Problem' },
            '423': { $ref: '#/components/responses/Problem' },
          },
        },
      },
      '/v1/auth/forgot-password': {
        post: {
          tags: ['auth'],
          operationId: 'forgotPassword',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email'],
                  properties: { email: { type: 'string', format: 'email' } },
                },
              },
            },
          },
          responses: { '204': { description: 'neutro' } },
        },
      },
      '/v1/auth/reset-password': {
        post: {
          tags: ['auth'],
          operationId: 'resetPassword',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['reset_token', 'new_password'],
                  properties: {
                    reset_token: { type: 'string' },
                    new_password: { type: 'string', minLength: 12 },
                  },
                },
              },
            },
          },
          responses: {
            '204': { description: 'OK; todas as sessões revogadas' },
            '400': { $ref: '#/components/responses/Problem' },
            '422': { $ref: '#/components/responses/Problem' },
          },
        },
      },
      '/v1/auth/email/verify': {
        post: {
          tags: ['auth'],
          operationId: 'verifyEmail',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['verification_token'],
                  properties: { verification_token: { type: 'string' } },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      idp_user_id: { type: 'string' },
                      email: { type: 'string' },
                      email_verified: { type: 'boolean' },
                    },
                  },
                },
              },
            },
            '400': { $ref: '#/components/responses/Problem' },
          },
        },
      },
      '/v1/token': {
        post: {
          tags: ['token'],
          operationId: 'tokenExchange',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenRequest' } } },
          },
          responses: {
            '200': {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenResponse' } } },
            },
            '400': { $ref: '#/components/responses/Problem' },
            '401': { $ref: '#/components/responses/Problem' },
          },
        },
      },
      '/v1/token/refresh': {
        post: {
          tags: ['token'],
          operationId: 'tokenRefresh',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
          },
          responses: {
            '200': {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenResponse' } } },
            },
            '401': { $ref: '#/components/responses/Problem' },
          },
        },
      },
      '/v1/token/revoke': {
        post: {
          tags: ['token'],
          operationId: 'tokenRevoke',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RevokeRequest' } } },
          },
          responses: { '204': { description: 'OK (idempotente)' } },
        },
      },
      '/v1/me': {
        get: {
          tags: ['me'],
          operationId: 'me',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/MeResponse' } } },
            },
            '401': { $ref: '#/components/responses/Problem' },
          },
        },
      },
      '/v1/me/roles': {
        get: {
          tags: ['me'],
          operationId: 'meRoles',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/UserRole' } },
                },
              },
            },
          },
        },
      },
      '/v1/me/switch-account': {
        post: {
          tags: ['me'],
          operationId: 'switchAccount',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['account_id'],
                  properties: {
                    account_id: { type: 'string' },
                    role: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'OK',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/TokenResponse' } } },
            },
            '403': { $ref: '#/components/responses/Problem' },
          },
        },
      },
      '/v1/me/sessions': {
        get: {
          tags: ['me'],
          security: [{ bearerAuth: [] }],
          operationId: 'meSessions',
          responses: {
            '200': {
              description: 'OK',
              content: {
                'application/json': {
                  schema: { type: 'array', items: { $ref: '#/components/schemas/Session' } },
                },
              },
            },
          },
        },
      },
      '/v1/me/sessions/{id}': {
        delete: {
          tags: ['me'],
          security: [{ bearerAuth: [] }],
          operationId: 'revokeSession',
          parameters: [
            { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } },
          ],
          responses: { '204': { description: 'OK (idempotente)' } },
        },
      },
      '/v1/auth/change-password': {
        post: {
          tags: ['auth'],
          security: [{ bearerAuth: [] }],
          operationId: 'changePassword',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['current_password', 'new_password'],
                  properties: {
                    current_password: { type: 'string' },
                    new_password: { type: 'string', minLength: 12 },
                  },
                },
              },
            },
          },
          responses: {
            '204': { description: 'OK; outras sessões revogadas; sessão atual mantida' },
            '401': { $ref: '#/components/responses/Problem' },
          },
        },
      },
      '/.well-known/jwks.json': {
        get: {
          tags: ['discovery'],
          operationId: 'jwks',
          responses: {
            '200': {
              description: 'JWKS',
              headers: { 'Cache-Control': { schema: { type: 'string' } } },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { keys: { type: 'array', items: { type: 'object' } } },
                  },
                },
              },
            },
          },
        },
      },
      '/.well-known/openid-configuration': {
        get: { tags: ['discovery'], operationId: 'oidcDiscovery', responses: { '200': { description: 'OK' } } },
      },
      '/health': { get: { tags: ['ops'], operationId: 'health', responses: { '200': { description: 'alive' } } } },
      '/ready': {
        get: {
          tags: ['ops'],
          operationId: 'ready',
          responses: { '200': { description: 'OK' }, '503': { description: 'dependency down' } },
        },
      },
      '/metrics': {
        get: {
          tags: ['ops'],
          operationId: 'metrics',
          responses: { '200': { description: 'Prometheus exposition' } },
        },
      },
    },
  };
}
