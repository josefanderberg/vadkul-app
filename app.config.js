/**
 * Ovanpå app.json - ändrar bara en sak, och bara lokalt.
 *
 * runtimeVersion är { policy: 'fingerprint' } så att EAS Update aldrig skickar
 * JS till ett bygge med fel native-kod. Men dev-servern räknar om fingeravtrycket
 * vid VARJE manifestförfrågan (~15 s på Intel-Macen), och dev-klienten ger upp
 * efter hårdkodade 10 s ("Could not reach http://localhost:8081"). `npm start`
 * sätter därför VADKUL_LOKAL=1 och dev-servern får ett fast värde i stället.
 *
 * EAS-byggen och `eas update` körs utan variablerna och får fingeravtrycket
 * som vanligt.
 *
 * VADKUL_RUNTIME=<fingeravtryck> (4/11): publicera en OTA till ett BYGGES
 * runtime när maskinen som publicerar räknar fram ett annat fingeravtryck
 * (Android-avtrycket skiljer sig mellan Mac:en och en molnsession, och två
 * iOS-byggen med olika avtryck är ute samtidigt). Avtrycken syns i
 * `eas update:list --branch production`; JS-bundlen är densamma, det är bara
 * etiketten som måste matcha det installerade bygget.
 */
module.exports = ({ config }) => {
  if (process.env.VADKUL_LOKAL === '1') return { ...config, runtimeVersion: 'lokal-dev' };
  if (process.env.VADKUL_RUNTIME) return { ...config, runtimeVersion: process.env.VADKUL_RUNTIME };
  return config;
};
