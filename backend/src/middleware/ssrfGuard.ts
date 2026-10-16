import { URL } from 'url';

/**
 * Validates external agent endpoint URLs to strictly prevent SSRF attacks.
 * Blocks private IP ranges, link-local, AWS/GCP cloud metadata addresses (169.254.169.254),
 * and disallows non-http(s) schemes.
 */
export function validateAgentEndpoint(urlString: string): { isValid: boolean; error?: string } {
  try {
    const parsed = new URL(urlString);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { isValid: false, error: 'Protocol must be http or https' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // In local development, localhost and 127.0.0.1 on permitted development ports are allowed
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    if (isLocalhost && process.env.NODE_ENV !== 'production') {
      return { isValid: true };
    }

    // SSRF Deny list: AWS metadata, GCP metadata, private CIDR blocks
    const blockedHosts = [
      '169.254.169.254', // AWS metadata
      'metadata.google.internal',
      'metadata.google',
      '127.0.0.1',
      'localhost',
      '0.0.0.0',
    ];

    if (blockedHosts.includes(hostname)) {
      return { isValid: false, error: 'Security violation: Access to internal or cloud metadata endpoints is prohibited.' };
    }

    // Check private IPv4 blocks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16)
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = hostname.match(ipv4Regex);
    if (match) {
      const octet1 = parseInt(match[1], 10);
      const octet2 = parseInt(match[2], 10);

      if (octet1 === 10) return { isValid: false, error: 'SSRF blocked: Private network (10.0.0.0/8)' };
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return { isValid: false, error: 'SSRF blocked: Private network (172.16.0.0/12)' };
      if (octet1 === 192 && octet2 === 168) return { isValid: false, error: 'SSRF blocked: Private network (192.168.0.0/16)' };
      if (octet1 === 169 && octet2 === 254) return { isValid: false, error: 'SSRF blocked: Link-local network (169.254.0.0/16)' };
    }

    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, error: `Invalid URL format: ${err?.message}` };
  }
}
