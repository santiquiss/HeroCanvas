// Loaded into the app's iframe by the lab: the app's picture taken in its own window (its classes, styles and fonts;
// from the lab's window the app's elements aren't the lab's HTMLElements, and the picture came out empty).
import { elementToCanvas } from '../src/capture/domImage';

(window as unknown as Record<string, unknown>).__heroPicture = (scale: number) => elementToCanvas(document.documentElement, scale);
