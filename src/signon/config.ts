/** Shared Destiny primary BAP endpoint advertised by signon (and later BAP TCP). */

export const BAP_SIGNON_IP = process.env.BAP_SIGNON_IP ?? '127.0.0.1';
export const BAP_SIGNON_PORT = Number(process.env.BAP_SIGNON_PORT ?? 3074);

/**
 * Signon ticket session keys (fields 2/3). BAP secure-hello AES/HMAC must use
 * the same values once TCP secure hello lands.
 */
export const BAP_SESSION_KEY_AES = Buffer.alloc(16, 0);
export const BAP_SESSION_KEY_HMAC = Buffer.alloc(16, 0);
export const BAP_SECURITY_TOKEN = Buffer.from('bnet-signon-token', 'utf8');
