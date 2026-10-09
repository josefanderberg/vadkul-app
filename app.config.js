/**
 * Ovanpå app.json - ändrar bara en sak, och bara lokalt.
 *
 * runtimeVersion är { policy: 'fingerprint' } så att EAS Update aldrig skickar
 * JS till ett bygge med fel native-kod. Men dev-servern räknar om fingeravtrycket
 * vid VARJE manifestförfrågan (~15 s på Intel-Macen), och dev-klienten ger upp
 * efter hårdkodade 10 s ("Could not reach http://localhost:8081"). `npm start`
 * sätter därför VADKUL_LOKAL=1 och dev-servern får ett fast värde i stället.
 *
 * EAS-byggen och `eas update` körs utan variabeln och får fingeravtrycket som vanligt.
 */
module.exports = ({ config }) =>
  process.env.VADKUL_LOKAL === '1' ? { ...config, runtimeVersion: 'lokal-dev' } : config;
