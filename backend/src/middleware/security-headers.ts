import helmet from 'helmet';

/** API responses are JSON only, so the CSP allows nothing and the API can never be framed. */
export function securityHeaders(production: boolean) {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    strictTransportSecurity: production ? { maxAge: 31536000, includeSubDomains: true, preload: false } : false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });
}
