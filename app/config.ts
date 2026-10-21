// Your app's settings (AppConfig): none yet. HeroCanvas shows Get started until the app declares its pages; your
// agent writes this file when it connects your app (the connect-app skill).
import type { AppConfig } from 'herocanvas';

export const appConfig: AppConfig = {
  name: 'Your app',
  home: '',
  // The devices it's made for: the designer offers only those. Leave it out for every device. For example:
  // devices: { platforms: ['ios'] },                      // iPhones and iPads
  // devices: { platforms: ['android'], types: ['phone'] }, // Android phones
  // devices: { types: ['tablet'] },                        // tablets, iPad and Android
};
