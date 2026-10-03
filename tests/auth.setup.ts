import { test as setup } from '@playwright/test';
import { loginAs } from './helpers/session';

setup('session owner', ({ browser }) => loginAs('owner', browser));
setup('session driver', ({ browser }) => loginAs('driver', browser));
