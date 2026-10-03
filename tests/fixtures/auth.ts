import { test as base } from '@playwright/test';

export const asOwner = { storageState: 'tests/.auth/owner.json' };
export const asDriver = { storageState: 'tests/.auth/driver.json' };

// Utiliser `test.use(asOwner)` / `test.use(asDriver)` dans un describe.
export const test = base;
export { expect } from '@playwright/test';
