# Security Policy

## Zero-Knowledge Guarantee

EnvBook is architected from the ground up as a zero-knowledge developer vault and workspace.

1. **Client-Side Encryption:** Plaintext notes, credentials, and configuration files are never transmitted across the network. All encryption occurs in your web browser using standard Web Crypto API implementations of `AES-GCM-256`.
2. **Key Derivation:** Master passwords are stretched locally using `Argon2id` (memory cost 65536, 3 time cost iterations, parallelism 1) before deriving keys. The master password never leaves the client device.
3. **Server Role:** The backend server and database only receive and store blind ciphertexts, salt parameters, and wrapped data encryption keys (DEK). Even with full database access, an adversary cannot decrypt your notes or credentials.

## Reporting a Vulnerability

If you discover a security vulnerability within EnvBook, please report it privately:

- **Email:** security@envbook.local or contact repository maintainers via GitHub Security Advisories.
- **Expected Details:** Steps to reproduce, affected cryptographic primitives or routes, and potential impact.
- **Response Timeline:** We aim to acknowledge receipt of reports within 48 hours and provide remediation updates within 5 business days.
