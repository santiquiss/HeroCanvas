// The interaction recording's state, for Capture (SimulatorShell holds it: the canvas faces the device while it
// records; the panel starts, stops and shows it). The seconds go to state ten times a second, not every frame.
import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/ui';
import { dropRecording, startRecording, type Recording, type RecordingSession } from './recording';

export type RecordingState =
  | { status: 'idle'; error?: string }
  | { status: 'starting' }
  | { status: 'recording'; seconds: number }
  | { status: 'ready'; recording: Recording };

export interface InteractionRecording {
  state: RecordingState;
  /** The finished recording, while there is one. */
  recording: Recording | null;
  /** Recording now (or asking to): the canvas holds the device facing you. */
  active: boolean;
  start: (frame: HTMLElement) => void;
  stop: () => void;
  discard: () => void;
}

export function useRecording(): InteractionRecording {
  const [state, setState] = useState<RecordingState>({ status: 'idle' });
  const session = useRef<RecordingSession | null>(null);
  const shown = useRef(-1);

  const stop = useCallback(() => {
    const s = session.current;
    if (!s) return;
    session.current = null;
    s.stop().then(
      (recording) => setState(recording ? { status: 'ready', recording } : { status: 'idle', error: t('Nothing was recorded') }),
      (e) => setState({ status: 'idle', error: e instanceof Error ? e.message : String(e) }),
    );
  }, []);

  const start = useCallback(
    (frame: HTMLElement) => {
      if (session.current) return;
      setState({ status: 'starting' });
      shown.current = -1;
      startRecording(
        frame,
        (seconds) => {
          const tenths = Math.floor(seconds * 10);
          if (tenths === shown.current) return;
          shown.current = tenths;
          setState({ status: 'recording', seconds: tenths / 10 });
        },
        stop,
        // Broken on the way (the encoder, the stream): end it and say why.
        (e) => {
          session.current?.cancel();
          session.current = null;
          setState({ status: 'idle', error: e instanceof Error ? e.message : String(e) });
        },
      ).then(
        (s) => {
          session.current = s;
          setState({ status: 'recording', seconds: 0 });
        },
        // Declining the browser's prompt isn't an error worth a message.
        (e) => setState({ status: 'idle', error: e instanceof DOMException && e.name === 'NotAllowedError' ? undefined : e instanceof Error ? e.message : String(e) }),
      );
    },
    [stop],
  );

  // A recording that goes (discarded, recorded again, Capture left) frees its preview.
  const held = state.status === 'ready' ? state.recording : null;
  useEffect(() => () => dropRecording(held), [held]);

  const discard = useCallback(() => setState({ status: 'idle' }), []);

  // Escape stops it from anywhere: no reaching for the panel's Stop, so the recording doesn't end with the pointer
  // crossing the screen. Caught first, so the prototype doesn't also take it (closing a sheet).
  const recording = state.status === 'recording';
  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      stop();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, stop]);

  // Leaving Capture mid-recording ends it.
  useEffect(() => () => session.current?.cancel(), []);

  return {
    state,
    recording: state.status === 'ready' ? state.recording : null,
    active: state.status === 'starting' || state.status === 'recording',
    start,
    stop,
    discard,
  };
}
