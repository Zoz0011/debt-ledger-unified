import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.beiny.ledger',
  appName: 'بيني',
  webDir: 'web',
  server: {
    url: 'https://beiny-ledger.nutmeg-fern-4150.chatgpt.site',
    androidScheme: 'https'
  }
};

export default config;
