# Security Policy

## Reporting a Vulnerability

This is a Proof of Concept project intended for local development and evaluation. It is **not
designed for production use** and has not undergone a security audit.

If you discover a security vulnerability, please report it privately by opening a GitHub issue
marked **[security]** or by contacting the repository maintainer directly.

Do not open a public issue for active security vulnerabilities -- wait for acknowledgement before
public disclosure.

## Supported Versions

Only the current `main` branch is supported. No backported security patches are provided.

## Known Limitations

- Authentication relies on the ADF HTTP interceptor forwarding the Alfresco ticket. This works
  correctly within ACA/ADW but depends on correct nginx/gateway configuration in production.
- No token refresh or expiry handling is implemented for PoC purposes.
