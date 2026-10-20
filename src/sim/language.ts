// The screens' language: a code the connected app knows (app.languages), set for the whole canvas (`?lang=`) or per
// device in a set. The simulator only carries it; the app reads it (useLanguage) and writes its texts in it.
import { createContext, useContext } from 'react';
import { appConfig as app } from '../app/config';

export type Language = string;

export const LANG_PARAM = 'lang';

/** The app's languages, the first its base (the one an empty `?lang=` means). */
export const LANGUAGES: { id: Language; name: string }[] = app.languages?.length ? app.languages : [{ id: 'en', name: 'English' }];
export const BASE_LANGUAGE: Language = LANGUAGES[0].id;

/** A `?lang=` value as one of the app's languages (its base when unset or unknown). */
export const languageIn = (v: string | null | undefined): Language => (v && LANGUAGES.some((l) => l.id === v) ? v : BASE_LANGUAGE);

export const LanguageCtx = createContext<Language>(BASE_LANGUAGE);

/** The language of the screen this renders in. */
export const useLanguage = (): Language => useContext(LanguageCtx);
