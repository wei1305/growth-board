# Security Policy

GrowthBoard is designed for public, non-sensitive records.

- Never commit a GitHub token or expose it through a `VITE_*` variable.
- Never put private contact details, salary information, identity documents, addresses, confidential interview notes, or unpublished offer details in public Issues.
- In-site writes require a fine-grained personal access token restricted to this repository with only Issues read/write permission.
- The token is stored only in the current browser's local or session storage and is never included in source code, Issues, build output, or Actions logs.
- Use session-only storage on shared devices, disconnect after use, and revoke any token you believe may have been exposed.
- Report a security issue privately through GitHub's security advisory feature rather than a public Issue.
