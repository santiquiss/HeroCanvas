// Chrome's capture APIs the recording uses (recording.ts) that TypeScript's DOM types don't carry yet: Element
// Capture (RestrictionTarget), Region Capture (CropTarget) and reading a track frame by frame.

declare class RestrictionTarget {
  static fromElement(element: Element): Promise<RestrictionTarget>;
}

declare class CropTarget {
  static fromElement(element: Element): Promise<CropTarget>;
}

interface MediaStreamTrack {
  restrictTo(target: RestrictionTarget | null): Promise<void>;
  cropTo(target: CropTarget | null): Promise<void>;
}

declare class MediaStreamTrackProcessor {
  constructor(init: { track: MediaStreamTrack });
  readonly readable: ReadableStream<VideoFrame>;
}
