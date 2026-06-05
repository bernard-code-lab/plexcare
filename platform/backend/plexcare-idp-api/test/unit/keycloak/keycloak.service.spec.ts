import MockAdapter from 'axios-mock-adapter';
import axios from 'axios';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import { KeycloakService } from '../../../src/modules/keycloak/keycloak.service';
import { KeycloakAdminTokenService } from '../../../src/modules/keycloak/keycloak-admin-token.service';
import { AppException } from '../../../src/shared/errors/app-exception';

const KC_BASE = 'http://kc.test';
const REALM = 'plexcare';

const env = {
  get(key: string): string {
    switch (key) {
      case 'KEYCLOAK_BASE_URL':
        return KC_BASE;
      case 'KEYCLOAK_REALM':
        return REALM;
      case 'KEYCLOAK_ADMIN_CLIENT_ID':
        return 'idp-admin';
      case 'KEYCLOAK_ADMIN_CLIENT_SECRET':
        return 'secret';
      default:
        return '';
    }
  },
} as never;

async function mintKcAccessToken(opts: { sub: string; email: string; verified: boolean }): Promise<string> {
  const { privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true });
  await exportJWK(privateKey); // ensure exportable
  return new SignJWT({ email: opts.email, email_verified: opts.verified })
    .setProtectedHeader({ alg: 'EdDSA' })
    .setSubject(opts.sub)
    .setIssuer('kc')
    .setExpirationTime('1h')
    .sign(privateKey);
}

describe('KeycloakService.directGrant', () => {
  let svc: KeycloakService;
  let mock: MockAdapter;

  beforeEach(() => {
    const adminTokens = new KeycloakAdminTokenService(env);
    svc = new KeycloakService(env, adminTokens);
    // Replace internal axios instance with one we can mock.
    const httpRef = (svc as unknown as { http: typeof axios }).http;
    mock = new MockAdapter(httpRef);
  });

  afterEach(() => mock.restore());

  it('returns parsed user info on 200', async () => {
    const access = await mintKcAccessToken({
      sub: 'kc-user-uuid',
      email: 'felipe@plexcare.com.br',
      verified: true,
    });
    mock
      .onPost(`/realms/${REALM}/protocol/openid-connect/token`)
      .reply(200, { access_token: access, refresh_token: 'r', expires_in: 300 });

    const out = await svc.directGrant('felipe@plexcare.com.br', 'pwd123456789');
    expect(out.kcUserId).toBe('kc-user-uuid');
    expect(out.emailVerified).toBe(true);
    expect(out.email).toBe('felipe@plexcare.com.br');
  });

  it('maps 401 → login_invalid_credentials', async () => {
    mock.onPost(`/realms/${REALM}/protocol/openid-connect/token`).reply(401, { error: 'invalid_grant' });
    await expect(svc.directGrant('a@b.com', 'wrong')).rejects.toMatchObject({
      code: 'login_invalid_credentials',
    });
  });

  it('maps 5xx → service_unavailable', async () => {
    mock.onPost(`/realms/${REALM}/protocol/openid-connect/token`).reply(503);
    await expect(svc.directGrant('a@b.com', 'p')).rejects.toBeInstanceOf(AppException);
    await expect(svc.directGrant('a@b.com', 'p')).rejects.toMatchObject({ code: 'service_unavailable' });
  });

  it('maps network error → service_unavailable', async () => {
    mock.onPost(`/realms/${REALM}/protocol/openid-connect/token`).networkError();
    await expect(svc.directGrant('a@b.com', 'p')).rejects.toMatchObject({ code: 'service_unavailable' });
  });
});

describe('KeycloakService.createUser', () => {
  let svc: KeycloakService;
  let mock: MockAdapter;
  let adminTokens: KeycloakAdminTokenService;

  beforeEach(() => {
    adminTokens = new KeycloakAdminTokenService(env);
    svc = new KeycloakService(env, adminTokens);
    mock = new MockAdapter((svc as unknown as { http: typeof axios }).http);
    // Stub admin token fetch.
    jest.spyOn(adminTokens, 'get').mockResolvedValue('admin-token');
  });

  afterEach(() => mock.restore());

  it('returns kc user id from Location header on 201', async () => {
    mock.onPost(`/admin/realms/${REALM}/users`).reply(201, '', {
      Location: 'http://kc/admin/realms/plexcare/users/kc-uuid-123',
    });
    const id = await svc.createUser({
      email: 'new@plexcare.com.br',
      password: 'longenoughpwd',
      fullName: 'New User',
    });
    expect(id).toBe('kc-uuid-123');
  });

  it('throws signup_email_taken on 409', async () => {
    mock.onPost(`/admin/realms/${REALM}/users`).reply(409, { errorMessage: 'User exists' });
    await expect(
      svc.createUser({ email: 'taken@plexcare.com.br', password: 'longenough', fullName: 'X' }),
    ).rejects.toMatchObject({ code: 'signup_email_taken' });
  });

  it('throws service_unavailable on 500', async () => {
    mock.onPost(`/admin/realms/${REALM}/users`).reply(500);
    await expect(
      svc.createUser({ email: 'x@y.com', password: 'longenough', fullName: 'X' }),
    ).rejects.toMatchObject({ code: 'service_unavailable' });
  });
});

describe('KeycloakService.executeActionsEmail', () => {
  let svc: KeycloakService;
  let mock: MockAdapter;
  let adminTokens: KeycloakAdminTokenService;

  beforeEach(() => {
    adminTokens = new KeycloakAdminTokenService(env);
    svc = new KeycloakService(env, adminTokens);
    mock = new MockAdapter((svc as unknown as { http: typeof axios }).http);
    jest.spyOn(adminTokens, 'get').mockResolvedValue('admin-token');
  });

  afterEach(() => mock.restore());

  it('PUTs actions array to /execute-actions-email and accepts 204', async () => {
    let bodyReceived: unknown;
    mock.onPut(`/admin/realms/${REALM}/users/kc-uuid/execute-actions-email`).reply((config) => {
      bodyReceived = JSON.parse(config.data as string);
      return [204];
    });
    await svc.executeActionsEmail('kc-uuid', ['VERIFY_EMAIL']);
    expect(bodyReceived).toEqual(['VERIFY_EMAIL']);
  });

  it('throws service_unavailable on non-204', async () => {
    mock.onPut(`/admin/realms/${REALM}/users/kc-uuid/execute-actions-email`).reply(500);
    await expect(svc.executeActionsEmail('kc-uuid', ['VERIFY_EMAIL'])).rejects.toMatchObject({
      code: 'service_unavailable',
    });
  });
});

describe('KeycloakService.ping', () => {
  let svc: KeycloakService;
  let mock: MockAdapter;

  beforeEach(() => {
    svc = new KeycloakService(env, new KeycloakAdminTokenService(env));
    mock = new MockAdapter((svc as unknown as { http: typeof axios }).http);
  });

  afterEach(() => mock.restore());

  it('returns true on 200', async () => {
    mock.onGet(`/realms/${REALM}`).reply(200, { realm: REALM });
    await expect(svc.ping()).resolves.toBe(true);
  });

  it('returns false on error', async () => {
    mock.onGet(`/realms/${REALM}`).networkError();
    await expect(svc.ping()).resolves.toBe(false);
  });
});
