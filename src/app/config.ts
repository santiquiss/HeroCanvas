// The sample app's settings (AppConfig): plain data, so the simulator can read them without loading the app's screens.
import { PERSONAS } from './data/sample';
import type { AppConfig } from './types';

export const appConfig: AppConfig = {
  name: 'Tasks',
  languages: [
    { id: 'en', name: 'English' },
    { id: 'es', name: 'Español' },
  ],
  personas: PERSONAS,
  home: 'today',
};
