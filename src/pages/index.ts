/* Hub page: register the service worker (offline support for all tools). */
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

export {};
