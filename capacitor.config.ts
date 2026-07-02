import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.solla.app',
  appName: 'Solla',
  webDir: 'build',
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK'
    }
  }
};

export default config;