/**
 * Pluggable upload security scan (spec section 18). NoopSecurityScanner
 * always passes — swap in an antivirus/content-scanning implementation
 * later without touching sourceService, which only depends on this
 * interface.
 */
export interface SecurityScanner {
  scan(input: { buffer: Buffer; fileName: string; mimeType: string }): Promise<
    { safe: true } | { safe: false; reason: string }
  >;
}

export class NoopSecurityScanner implements SecurityScanner {
  async scan(): Promise<{ safe: true }> {
    return { safe: true };
  }
}

export const securityScanner: SecurityScanner = new NoopSecurityScanner();
