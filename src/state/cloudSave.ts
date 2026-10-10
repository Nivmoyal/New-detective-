// Saving the game to the player's own private space on claude.ai, so a game
// survives a cleared browser and continues on another device. The browser
// copy stays as the fast local save; when the page opens, whichever copy was
// saved last wins. Without the platform (a signed-out visitor, a local
// build, a view-only visitor) the game simply keeps the browser save.

interface DocRef {
  get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }>;
  set(data: Record<string, unknown>): Promise<void>;
}

export interface CloudSave {
  /** The saved game, as stored (JSON text), and when it was saved. */
  load(): Promise<{ raw: string; savedAt: number } | null>;
  /** Save; resolves false when this viewer cannot keep a cloud save. */
  save(raw: string, savedAt: number): Promise<boolean>;
}

type ClaudeWindow = { claude?: { use?: (name: string) => Promise<unknown> } };

export async function connectCloud(): Promise<CloudSave | null> {
  const claude = (window as unknown as ClaudeWindow).claude;
  if (!claude?.use) return null;
  try {
    const [db, user] = (await Promise.all([claude.use('db'), claude.use('user')])) as [
      { doc(path: string): DocRef } | null,
      { id(): Promise<string | null> } | null,
    ];
    if (!db || !user) return null;
    const id = await user.id();
    if (!id) return null;
    const ref = db.doc(`data/users/${id}/save`);
    return {
      async load() {
        const snap = await ref.get();
        const d = snap.exists ? snap.data() : undefined;
        if (!d || typeof d.game !== 'string') return null;
        return { raw: d.game, savedAt: Number(d.savedAt) || 0 };
      },
      async save(raw, savedAt) {
        try {
          await ref.set({ game: raw, savedAt });
          return true;
        } catch (e) {
          const code = (e as { code?: string }).code;
          // A transient problem: try once more shortly after.
          if (code === 'unavailable') {
            await new Promise((r) => setTimeout(r, 800 + Math.random() * 800));
            try {
              await ref.set({ game: raw, savedAt });
              return true;
            } catch {
              return false;
            }
          }
          return false;
        }
      },
    };
  } catch {
    return null;
  }
}
