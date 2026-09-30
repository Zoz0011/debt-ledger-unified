import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.beiny.ledger',
  appName: 'بيني',
  webDir: 'web',
  server: {
    androidScheme: 'https'
  }
};

export default config;
