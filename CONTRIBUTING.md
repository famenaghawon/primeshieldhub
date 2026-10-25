# Contributing to PrimeShieldHub

This is a **proprietary and confidential** codebase. External contributions are not accepted without prior written consent.

## Internal Developer Guidelines

### Branching Strategy
*   main is the production branch. Do not push directly to main.
*   Create a feature branch: git checkout -b feat/your-feature or git checkout -b fix/your-bug.
*   Open a Pull Request (PR) against main.

### Commit Messages
We use Conventional Commits:
*   feat: add new payment gateway
*   fix: patch cart manipulation vulnerability
*   chore: update dependencies
*   docs: update API schema

### Pre-Flight Checklist
Before submitting a PR, ensure:
1.  **CI Passes:** The GitHub Actions pipeline must be green (schema valid, no secrets, no nvm/).
2.  **Local Test:** wrangler dev in backend/ works, and the frontend can communicate with it.
3.  **No New Bloat:** Do not commit large images, .zip, .exe, or .env files.
4.  **Secret Scan:** Run git grep -inE "sk_live_|sk_test_|r8_" - it must return nothing.
