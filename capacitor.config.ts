import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.beiny.ledger',
  appName: 'بيني',
  webDir: 'web',
  server: {
    url: 'https://beiny-ledger.pauper-93phylumbunni.chatgpt.site',
    androidScheme: 'https'
  }
};

export default config;
