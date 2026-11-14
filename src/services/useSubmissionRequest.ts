import { useRef } from 'react';

export function useSubmissionRequest() {
  const pending = useRef<{ fingerprint: string; id: string } | null>(null);
  return {
    getId(payload: unknown) {
      const fingerprint = JSON.stringify(payload);
      if (pending.current?.fingerprint !== fingerprint) {
        const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
          byte.toString(16).padStart(2, '0')
        ).join('');
        pending.current = { fingerprint, id };
      }
      return pending.current.id;
    },
    clear() {
      pending.current = null;
    },
  };
}
