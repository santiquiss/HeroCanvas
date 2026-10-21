// Some of the tool's tests run on the sample app's pages and languages (Tasks: today, project, profile, Spanish).
// With another app connected, or none (the `empty` branch), they're skipped; the rest of the tests still run.
import { appConfig, BASE_PAGES } from '@app';

export const ON_SAMPLE_APP = appConfig.name === 'Tasks' && ['today', 'project', 'profile'].every((id) => id in BASE_PAGES);
