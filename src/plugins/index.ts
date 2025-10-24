/**
 * ProLease Plugin Entry Point for Standalone Build
 *
 * This file serves as the entry point when building the plugin as a standalone module
 */

import { ProLeasePlugin, manifest } from './prolease-ifrs16-plugin';

// Export everything needed for the plugin
export { ProLeasePlugin, manifest };

// Default export for convenience
export default {
  ProLeasePlugin,
  manifest,
  version: '6.0.0',
  name: 'ProLease IFRS 16',
};
