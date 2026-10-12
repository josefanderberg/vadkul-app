/**
 * Kopierar GoogleService-Info.plist till ios/ (Xcodes PROJECT_DIR) vid prebuild.
 *
 * RNFB 26 hämtar Firebase via SPM, och då kör Crashlytics byggfas
 * (@react-native-firebase/crashlytics/ios_config.sh) upload-symbols med
 * `-gsp "${PROJECT_DIR}/GoogleService-Info.plist"`. Expo lägger plisten i
 * ios/<app>/, så fasen hittade den inte och fällde iOS build 7 (12/10 2026:
 * "Unable to read Google Service plist"). Kopian rör inte Xcode-projektet,
 * den finns bara där skriptet letar.
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

module.exports = function withCrashlyticsPlist(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const källa = path.resolve(
        cfg.modRequest.projectRoot,
        cfg.ios?.googleServicesFile ?? 'GoogleService-Info.plist',
      );
      fs.copyFileSync(källa, path.join(cfg.modRequest.platformProjectRoot, 'GoogleService-Info.plist'));
      return cfg;
    },
  ]);
};
