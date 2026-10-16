# envbook

> **Private developer workspace and zero-knowledge encrypted personal vault**  
> Built with Next.js App Router (unified single-URL full-stack), Tailwind CSS, Argon2id, and Web Crypto AES-256-GCM.

---

## ⚡ Overview

**EnvBook** is a terminal noir developer workspace engineered for extreme data privacy, ergonomics, and technical note-taking. All notes, environment variables, credentials, ideas, and architecture documents are encrypted client-side using **AES-256-GCM** before ever leaving your browser. The backend server acts solely as a blind zero-knowledge ciphertext store.

The entire application runs on a **unified single URL and port (`http://localhost:3000`)** with Next.js App Router serving both the high-performance UI and the secure zero-knowledge API.

---

## 🛡️ Security & Zero-Knowledge Architecture

- **Zero-Knowledge Ciphertext Store:** All sensitive entry fields (titles, payloads, tags) are encrypted in the browser with Web Crypto API (`AES-GCM-256`) using unique 96-bit initialization vectors (IVs) per write.
- **Key Derivation (KDF):** Master Password is key-stretched via **Argon2id** (memory cost 64MB, 3 iterations) to derive the Key Encryption Key (KEK) which wraps/unwraps the Data Encryption Key (DEK).
- **Argon2id Password Storage:** Server-side authentication uses Argon2id with cryptographically secure random salts.
- **HTTP-Only SameSite JWT:** Authenticated sessions leverage HttpOnly, SameSite cookies with standard authorization fallback.
- **Universal Eye Visibility Engine:** Password and credential inputs feature accessible show/hide toggles with automatic 15-second remask timers to prevent shoulder surfing.
- **Strict Cryptographic Versioning:** Data envelopes include cryptographic versioning tags for forward migration compatibility.

---

## ✨ Features

- **Unified Single-URL Full-Stack:** Frontend and API operate harmoniously on a single origin (`localhost:3000`) without proxy overhead or CORS complications.
- **Terminal Noir Aesthetics:** Curated emerald/obsidian dark mode, custom monospace code styling, responsive collapsible sidebar, command palette (`Cmd/Ctrl + K`), and keyboard shortcuts.
- **Notion-Inspired Block Editor:** Rich Markdown/WYSIWYG editing with slash command menu (`/h1`, `/code`, `/task`, `/quote`, `/divider`), TOC drawer, and version history restore.
- **Credentials Vault:** Masked secrets with single-click clipboard copy, universal visibility toggles, and automatic 15-second remask timers.
- **Environment Manager:** Side-by-side multi-environment manager (`production`, `staging`, `development`, `testing`) with parity diff matrix and direct `.env` import/export.
- **Ideas & Scratchpad Inbox:** Quick capture with tags, voting counters, and one-click conversion into technical PRD notes.
- **Code Snippets Library:** Multi-language syntax highlighting, copy-to-clipboard, and tag categorization.
- **Client-Side Encrypted Full-Text Search:** Instant in-memory search across decrypted titles and markdown content without server disclosure.
- **Encrypted Backup & Portability:** Export your entire workspace into an encrypted JSON envelope with SHA-256 checksum verification.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB**: Local or hosted MongoDB instance (default: `mongodb://127.0.0.1:27017/envbook`)

### Environment Variables
Configure your environment in `.env` (or copy from `.env.example`):

```env
MONGODB_URI=mongodb://127.0.0.1:27017/envbook
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
```

> **Note:** EnvBook enforces strict zero-knowledge principles. Never add encryption keys or plaintext master passwords to environment files.

### Installation

```bash
# Install dependencies across all workspaces
npm install

# Build shared types
npm run build --workspace=@envbook/shared
```

### Running the App (Single URL: http://localhost:3000)

```bash
# Start development server
npm run dev

# Or build and run production server
npm run build
npm start
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

```bash
# Run client-side crypto, validation, and editor unit tests
npm run test:unit

# Run API integration tests
npm run test:api

# Run end-to-end Playwright tests
npm run test:e2e
```

---

## 📂 Project Structure

```
envbook/
├── apps/
│   ├── web/                     # Unified Next.js full-stack application
│   │   ├── src/
│   │   │   ├── app/             # App Router pages and dynamic routes
│   │   │   │   ├── api/[...path]# Integrated zero-knowledge Next.js API handler
│   │   │   │   ├── app/         # Dashboard, editor, credentials, environments
│   │   │   │   ├── vault/       # Vault setup & unlock flows
│   │   │   │   └── ...
│   │   │   ├── server/          # Mongoose DB, models, Argon2, JWT utilities
│   │   │   ├── lib/             # Web Crypto AES-256-GCM, KDF, client API
│   │   │   └── components/      # Terminal noir UI components, editor, layout
│   │   └── test/                # Unit test suites (crypto, validation, editor)
│   └── api/                     # Standalone Express reference API
├── packages/
│   └── shared/                  # Shared Zod schemas, TypeScript types, constants
└── tests/
    └── e2e/                     # Playwright end-to-end test suites
```

---

## 📄 License

MIT © [Shadab-2604](https://github.com/Shadab-2604)
