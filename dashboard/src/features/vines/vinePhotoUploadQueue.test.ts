import { describe, expect, it, vi } from 'vitest';
import type { PreparedVinePhoto } from './vinePhotos';
import type { Vine, VinePhoto } from './model';
import {
  InMemoryVinePhotoUploadQueue,
  type VinePhotoUploadQueueDependencies,
} from './vinePhotoUploadQueue';

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

async function waitUntil(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('A várt queue-állapot nem érkezett meg.');
}

const prepared: PreparedVinePhoto = {
  blob: new Blob(['large'], { type: 'image/jpeg' }),
  width: 640,
  height: 480,
  contentType: 'image/jpeg',
  capturedAt: null,
  thumbnail: { blob: new Blob(['thumb']), width: 120, height: 90 },
};

function uploaded(photoId: string): VinePhoto {
  return {
    id: photoId,
    storagePath: `photos/${photoId}.jpg`,
    downloadUrl: `https://example.test/${photoId}.jpg`,
    width: 640,
    height: 480,
    thumbnail: null,
    capturedAt: null,
    uploadedAt: '2026-08-08T10:00:00.000Z',
    caption: '',
  };
}

function file(name: string): File {
  return new File(['image'], name, { type: 'image/jpeg' });
}

function vine(id: string, photoIds: readonly string[] = []): Vine {
  return { id, photos: photoIds.map(uploaded) } as Vine;
}

function dependencies(
  overrides: Partial<VinePhotoUploadQueueDependencies> = {},
): VinePhotoUploadQueueDependencies {
  let id = 0;
  return {
    prepare: vi.fn().mockResolvedValue(prepared),
    upload: vi.fn(async (_vineId, photoId, _prepared, progress) => {
      progress(5, 10);
      progress(10, 10);
      return uploaded(photoId);
    }),
    commit: vi.fn().mockResolvedValue(undefined),
    hasCommitted: vi.fn().mockResolvedValue(false),
    cleanup: vi.fn().mockResolvedValue(undefined),
    createId: () => `id-${++id}`,
    createPreviewUrl: () => `blob:preview-${id}`,
    revokePreviewUrl: vi.fn(),
    ...overrides,
  };
}

describe('InMemoryVinePhotoUploadQueue', () => {
  it('azonnal stabil job- és photoId-val sorba állít, majd realtime igazolásig megtart', async () => {
    const deps = dependencies();
    const queue = new InMemoryVinePhotoUploadQueue(deps);
    const progress: number[] = [];
    queue.subscribe(() => {
      const first = queue.getSnapshot()[0];
      if (first?.status === 'uploading') progress.push(first.progress);
    });

    expect(queue.enqueue('vine-1', [file('a.jpg')])).toEqual(['id-1']);
    expect(queue.getSnapshot()[0]).toMatchObject({
      jobId: 'id-1',
      photoId: 'id-2',
      vineId: 'vine-1',
      status: 'queued',
    });

    await waitUntil(() => queue.getSnapshot()[0]?.status === 'awaiting-sync');
    expect(deps.upload).toHaveBeenCalledWith(
      'vine-1',
      'id-2',
      prepared,
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(deps.commit).toHaveBeenCalledWith('vine-1', expect.objectContaining({ id: 'id-2' }));
    expect(progress).toEqual([...progress].sort((left, right) => left - right));

    queue.reconcile([vine('vine-1', ['id-2'])]);
    expect(queue.getSnapshot()).toEqual([]);
    expect(deps.revokePreviewUrl).toHaveBeenCalledWith('blob:preview-2');
  });

  it('a publikált progress a teljes job-élettartam alatt monoton nő', async () => {
    const queue = new InMemoryVinePhotoUploadQueue(dependencies());
    const observedProgress: number[] = [];
    queue.subscribe(() => {
      const current = queue.getSnapshot()[0];
      if (current) observedProgress.push(current.progress);
    });

    queue.enqueue('vine-1', [file('a.jpg')]);
    await waitUntil(() => queue.getSnapshot()[0]?.status === 'awaiting-sync');

    expect(observedProgress).toEqual(
      [...observedProgress].sort((left, right) => left - right),
    );
  });

  it('a dokumentált állapotokon sorrendben halad végig', async () => {
    const queue = new InMemoryVinePhotoUploadQueue(dependencies());
    const statuses: string[] = [];
    queue.subscribe(() => {
      const status = queue.getSnapshot()[0]?.status;
      if (status && statuses.at(-1) !== status) statuses.push(status);
    });

    queue.enqueue('vine-1', [file('a.jpg')]);
    await waitUntil(() => queue.getSnapshot()[0]?.status === 'awaiting-sync');

    expect(statuses).toEqual([
      'queued',
      'preparing',
      'queued',
      'uploading',
      'committing',
      'awaiting-sync',
    ]);
  });

  it('lépésenként prepare=1, upload=2 és tőkénként commit=1 konkurenciát tart', async () => {
    const prepareGates = new Map<string, ReturnType<typeof deferred<PreparedVinePhoto>>>();
    const uploadGates = new Map<string, ReturnType<typeof deferred<VinePhoto>>>();
    const commitGates: Array<ReturnType<typeof deferred<void>>> = [];
    let preparing = 0;
    let uploading = 0;
    let maxPreparing = 0;
    let maxUploading = 0;
    let committing = 0;
    let maxCommitting = 0;
    const deps = dependencies({
      prepare: vi.fn(async (source) => {
        preparing += 1;
        maxPreparing = Math.max(maxPreparing, preparing);
        const gate = deferred<PreparedVinePhoto>();
        prepareGates.set(source.name, gate);
        const result = await gate.promise;
        preparing -= 1;
        return result;
      }),
      upload: vi.fn(async (_vineId, photoId) => {
        uploading += 1;
        maxUploading = Math.max(maxUploading, uploading);
        const gate = deferred<VinePhoto>();
        uploadGates.set(photoId, gate);
        const result = await gate.promise;
        uploading -= 1;
        return result;
      }),
      commit: vi.fn(async () => {
        committing += 1;
        maxCommitting = Math.max(maxCommitting, committing);
        const gate = deferred<void>();
        commitGates.push(gate);
        await gate.promise;
        committing -= 1;
      }),
    });
    const queue = new InMemoryVinePhotoUploadQueue(deps);
    queue.enqueue('vine-1', [file('a.jpg'), file('b.jpg'), file('c.jpg')]);

    await waitUntil(() => prepareGates.has('a.jpg'));
    expect(prepareGates.has('b.jpg')).toBe(false);
    prepareGates.get('a.jpg')?.resolve(prepared);
    await waitUntil(() => prepareGates.has('b.jpg') && uploadGates.has('id-2'));
    prepareGates.get('b.jpg')?.resolve(prepared);
    await waitUntil(() => prepareGates.has('c.jpg') && uploadGates.has('id-4'));
    prepareGates.get('c.jpg')?.resolve(prepared);
    await waitUntil(() => queue.getSnapshot().some((job) => job.photoId === 'id-6' && job.status === 'queued'));
    expect(maxPreparing).toBe(1);
    expect(maxUploading).toBe(2);

    uploadGates.get('id-2')?.resolve(uploaded('id-2'));
    await waitUntil(() => commitGates.length === 1 && uploadGates.has('id-6'));
    uploadGates.get('id-4')?.resolve(uploaded('id-4'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(commitGates).toHaveLength(1);
    commitGates[0]?.resolve();
    await waitUntil(() => commitGates.length === 2);
    uploadGates.get('id-6')?.resolve(uploaded('id-6'));
    commitGates[1]?.resolve();
    await waitUntil(() => commitGates.length === 3);
    commitGates[2]?.resolve();
    await waitUntil(() => queue.getSnapshot().every((job) => job.status === 'awaiting-sync'));
    expect(maxCommitting).toBe(1);
  });

  it('különböző tőkék commitját párhuzamosan, az eredeti célon futtatja', async () => {
    const commitGates = new Map<string, ReturnType<typeof deferred<void>>>();
    const activeVines = new Set<string>();
    let maxConcurrentCommits = 0;
    const deps = dependencies({
      commit: vi.fn(async (vineId) => {
        activeVines.add(vineId);
        maxConcurrentCommits = Math.max(maxConcurrentCommits, activeVines.size);
        const gate = deferred<void>();
        commitGates.set(vineId, gate);
        await gate.promise;
        activeVines.delete(vineId);
      }),
    });
    const queue = new InMemoryVinePhotoUploadQueue(deps);

    queue.enqueue('vine-1', [file('a.jpg')]);
    queue.enqueue('vine-2', [file('b.jpg')]);
    await waitUntil(() => commitGates.size === 2);

    expect(maxConcurrentCommits).toBe(2);
    expect(deps.commit).toHaveBeenCalledWith('vine-1', expect.objectContaining({ id: 'id-2' }));
    expect(deps.commit).toHaveBeenCalledWith('vine-2', expect.objectContaining({ id: 'id-4' }));
    commitGates.get('vine-1')?.resolve();
    commitGates.get('vine-2')?.resolve();
    await waitUntil(() => queue.getSnapshot().every((job) => job.status === 'awaiting-sync'));
  });

  it('egy hiba nem állítja meg a többi jobot, retry közben pedig megmarad a photoId', async () => {
    let failedOnce = false;
    const deps = dependencies({
      upload: vi.fn(async (_vineId, photoId) => {
        if (!failedOnce) {
          failedOnce = true;
          throw new Error('Hálózati hiba');
        }
        return uploaded(photoId);
      }),
    });
    const queue = new InMemoryVinePhotoUploadQueue(deps);
    queue.enqueue('vine-1', [file('a.jpg'), file('b.jpg')]);

    await waitUntil(() => queue.getSnapshot().some((job) => job.status === 'failed'));
    await waitUntil(() => queue.getSnapshot().some((job) => job.status === 'awaiting-sync'));
    const failed = queue.getSnapshot().find((job) => job.status === 'failed');
    expect(failed).toMatchObject({ photoId: 'id-2', error: 'Hálózati hiba' });

    queue.retry(failed?.jobId ?? '');
    await waitUntil(() => queue.getSnapshot().every((job) => job.status === 'awaiting-sync'));
    expect(queue.getSnapshot().map((job) => job.photoId)).toContain('id-2');
  });

  it('aktív feltöltést valóban megszakít és felszabadítja a preview-t', async () => {
    const aborted = vi.fn();
    const deps = dependencies({
      upload: vi.fn((_vineId, _photoId, _prepared, _progress, signal) =>
        new Promise<VinePhoto>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted();
            reject(new DOMException('cancelled', 'AbortError'));
          });
        })),
    });
    const queue = new InMemoryVinePhotoUploadQueue(deps);
    const [jobId] = queue.enqueue('vine-1', [file('a.jpg')]);
    await waitUntil(() => queue.getSnapshot()[0]?.status === 'uploading');

    queue.cancel(jobId ?? '');
    expect(queue.getSnapshot()).toEqual([]);
    expect(aborted).toHaveBeenCalledOnce();
    expect(deps.revokePreviewUrl).toHaveBeenCalledOnce();
  });

  it('megszakított előkészítés után azonnal elindítja a következő fotót', async () => {
    const started: string[] = [];
    const aborted: string[] = [];
    const deps = dependencies({
      prepare: vi.fn((source: File, signal?: AbortSignal) => {
        started.push(source.name);
        if (source.name === 'b.jpg') return Promise.resolve(prepared);
        return new Promise<PreparedVinePhoto>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            aborted.push(source.name);
            reject(new DOMException('cancelled', 'AbortError'));
          });
        });
      }),
    });
    const queue = new InMemoryVinePhotoUploadQueue(deps);
    const [firstJobId] = queue.enqueue('vine-1', [file('a.jpg'), file('b.jpg')]);
    await waitUntil(() => queue.getSnapshot()[0]?.status === 'preparing');

    queue.cancel(firstJobId ?? '');
    await waitUntil(() => started.includes('b.jpg'));

    expect(aborted).toEqual(['a.jpg']);
    expect(queue.getSnapshot().map((job) => job.fileName)).toEqual(['b.jpg']);
  });

  it('elveszett commit-válasznál egyeztet, és nem törli a már hivatkozott objektumot', async () => {
    const deps = dependencies({
      commit: vi.fn().mockRejectedValue(new Error('Elveszett válasz')),
      hasCommitted: vi.fn().mockResolvedValue(true),
    });
    const queue = new InMemoryVinePhotoUploadQueue(deps);
    queue.enqueue('vine-1', [file('a.jpg')]);

    await waitUntil(() => queue.getSnapshot()[0]?.status === 'awaiting-sync');
    expect(deps.cleanup).not.toHaveBeenCalled();
  });

  it('igazolt commit-hibánál takarít, és a job külön újrapróbálható marad', async () => {
    const deps = dependencies({
      commit: vi.fn().mockRejectedValue(new Error('Firestore hiba')),
      hasCommitted: vi.fn().mockResolvedValue(false),
    });
    const queue = new InMemoryVinePhotoUploadQueue(deps);
    queue.enqueue('vine-1', [file('a.jpg')]);

    await waitUntil(() => queue.getSnapshot()[0]?.status === 'failed');
    expect(deps.cleanup).toHaveBeenCalledWith(expect.objectContaining({ id: 'id-2' }));
    expect(queue.getSnapshot()[0]).toMatchObject({ photoId: 'id-2', error: 'Firestore hiba' });
  });

  it('a mentett és függő photoId-k uniójával foglalja a 100 férőhelyet', () => {
    const deps = dependencies();
    const queue = new InMemoryVinePhotoUploadQueue(deps);
    const existingIds = Array.from({ length: 99 }, (_, index) => `existing-${index}`);
    queue.reconcile([vine('vine-1', existingIds)]);

    expect(queue.enqueue('vine-1', [file('a.jpg'), file('b.jpg')])).toHaveLength(1);
    expect(queue.enqueue('vine-1', [file('c.jpg')])).toEqual([]);
  });
});
