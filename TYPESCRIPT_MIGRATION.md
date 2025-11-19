# TypeScript Migration Guide

## Overview
This document tracks the migration of Screenity from JavaScript to TypeScript.

## Migration Strategy
- **Gradual Migration**: Using `allowJs: true` to allow mixing JS and TS files
- **Start with utilities**: Convert utility files first
- **Then core modules**: Background scripts, messaging, etc.
- **Finally components**: React components last

## Progress

### ✅ Completed
- [x] TypeScript configuration updated
- [x] Type definitions created
- [x] Chrome API types installed
- [x] Utility files migrated:
  - `src/pages/Background/utils/base64ToUint8Array.ts`
  - `src/pages/Background/utils/featureDetection.ts`
  - `src/pages/Background/utils/waitForContentScript.ts`
  - `src/pages/Background/utils/blobToBase64.ts`
  - `src/pages/Background/utils/browserHelpers.ts`
- [x] Message router migrated: `src/messaging/messageRouter.ts`

### 🔄 In Progress
- [ ] Background scripts migration
- [ ] React components migration
- [ ] Type definitions for custom modules

### 📋 TODO
- [ ] Migrate remaining utility files
- [ ] Migrate Background/index.js
- [ ] Migrate Background/messaging/handlers.js
- [ ] Migrate Background/auth/loginWithWebsite.js
- [ ] Migrate Background/drive/handleSaveToDrive.js
- [ ] Migrate React components (Content, Sandbox, etc.)
- [ ] Add comprehensive type definitions
- [ ] Update webpack config if needed
- [ ] Test build process
- [ ] Fix any type errors

## Type Definitions Created

### `src/types/chrome.d.ts`
- Chrome Extension API type augmentations

### `src/types/global.d.ts`
- Global type definitions for assets (SVG, PNG, CSS, etc.)
- Environment variable types

### `src/types/messaging.d.ts`
- Message types for Chrome extension messaging
- BaseMessage, SaveToDriveMessage, RecordingMessage, etc.

## Configuration Changes

### `tsconfig.json`
- `allowJs: true` - Allows mixing JS and TS files
- `strict: false` - Gradually enable strict mode
- `jsx: "react-jsx"` - Modern React JSX transform
- Added path aliases for cleaner imports

## Next Steps

1. Continue migrating utility files
2. Migrate Background scripts
3. Migrate React components
4. Enable strict mode gradually
5. Add comprehensive JSDoc comments
6. Create type definitions for all custom modules

## Notes

- All new files should be `.ts` or `.tsx`
- Old `.js` files can coexist during migration
- Use `// @ts-ignore` sparingly and document why
- Prefer `unknown` over `any` when type is truly unknown

