import { MAX_VINE_PHOTOS, type Vine, type VinePhoto } from './model';
import type { PreparedVinePhoto } from './vinePhotos';

export type VinePhotoUploadJobStatus =
  | 'queued'
  | 'preparing'
  | 'uploading'
  | 'committing'
  | 'awaiting-sync'
  | 'failed';

export interface VinePhotoUploadJob {
  jobId: string;
  photoId: string;
  vineId: string;
  fileName: string;
  status: VinePhotoUploadJobStatus;
  progress: number;
  previewUrl: string | null;
  error: string | null;
}

export interface VinePhotoUploadQueueDependencies {
  prepare(file: File, signal: AbortSignal): Promise<PreparedVinePhoto>;
  upload(
    vineId: string,
    photoId: string,
    prepared: PreparedVinePhoto,
    onProgress: (uploadedBytes: number, totalBytes: number) => void,
    signal: AbortSignal,
  ): Promise<VinePhoto>;
  commit(vineId: string, photo: VinePhoto): Promise<void>;
  hasCommitted(vineId: string, photoId: string): Promise<boolean>;
  cleanup(photo: VinePhoto): Promise<void>;
  createId?: () => string;
  createPreviewUrl?: (blob: Blob) => string;
  revokePreviewUrl?: (url: string) => void;
}

interface InternalJob extends VinePhotoUploadJob {
  file: File;
  prepared: PreparedVinePhoto | null;
  uploadedPhoto: VinePhoto | null;
  controller: AbortController;
  runVersion: number;
}

interface SemaphoreWaiter {
  resolve: (release: () => void) => void;
  reject: (error: unknown) => void;
  signal: AbortSignal;
  abort: () => void;
}

function abortError(): DOMException {
  return new DOMException('A fotófeltöltés megszakadt.', 'AbortError');
}

class Semaphore {
  private active = 0;
  private readonly waiters: SemaphoreWaiter[] = [];
  private readonly limit: number;

  constructor(limit: number) {
    this.limit = limit;
  }

  acquire(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(abortError());

    return new Promise((resolve, reject) => {
      const waiter: SemaphoreWaiter = {
        resolve,
        reject,
        signal,
        abort: () => {
          const index = this.waiters.indexOf(waiter);
          if (index >= 0) this.waiters.splice(index, 1);
          reject(abortError());
        },
      };
      signal.addEventListener('abort', waiter.abort, { once: true });
      this.waiters.push(waiter);
      this.dispatch();
    });
  }

  private dispatch() {
    while (this.active < this.limit && this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      if (!waiter) return;
      waiter.signal.removeEventListener('abort', waiter.abort);
      if (waiter.signal.aborted) {
        waiter.reject(abortError());
        continue;
      }

      this.active += 1;
      let released = false;
      waiter.resolve(() => {
        if (released) return;
        released = true;
        this.active -= 1;
        this.dispatch();
      });
    }
  }
}

export interface VinePhotoUploadQueue {
  enqueue(vineId: string, files: readonly File[]): readonly string[];
  retry(jobId: string): void;
  cancel(jobId: string): void;
  reconcile(vines: readonly Vine[]): void;
  getSnapshot(): readonly VinePhotoUploadJob[];
  subscribe(listener: () => void): () => void;
}

export class InMemoryVinePhotoUploadQueue implements VinePhotoUploadQueue {
  private readonly prepareSlots = new Semaphore(1);
  private readonly uploadSlots = new Semaphore(2);
  private readonly commitSlots = new Map<string, Semaphore>();
  private readonly listeners = new Set<() => void>();
  private readonly jobsById = new Map<string, InternalJob>();
  private readonly confirmedPhotoIds = new Map<string, Set<string>>();
  private readonly dependencies: VinePhotoUploadQueueDependencies;
  private snapshot: readonly VinePhotoUploadJob[] = [];

  constructor(dependencies: VinePhotoUploadQueueDependencies) {
    this.dependencies = dependencies;
  }

  enqueue(vineId: string, files: readonly File[]): readonly string[] {
    const occupiedPhotoIds = new Set(this.confirmedPhotoIds.get(vineId) ?? []);
    for (const job of this.jobsById.values()) {
      if (job.vineId === vineId) occupiedPhotoIds.add(job.photoId);
    }

    const accepted = files.slice(0, Math.max(0, MAX_VINE_PHOTOS - occupiedPhotoIds.size));
    const jobIds: string[] = [];
    for (const file of accepted) {
      const jobId = this.createId();
      const photoId = this.createId();
      const job: InternalJob = {
        jobId,
        photoId,
        vineId,
        fileName: file.name,
        file,
        status: 'queued',
        progress: 0,
        previewUrl: null,
        error: null,
        prepared: null,
        uploadedPhoto: null,
        controller: new AbortController(),
        runVersion: 0,
      };
      this.jobsById.set(jobId, job);
      jobIds.push(jobId);
    }
    this.publish();
    for (const jobId of jobIds) this.start(jobId);
    return jobIds;
  }

  retry(jobId: string): void {
    const job = this.jobsById.get(jobId);
    if (!job || job.status !== 'failed') return;
    job.status = 'queued';
    job.error = null;
    job.progress = job.uploadedPhoto ? 100 : 0;
    job.controller = new AbortController();
    this.publish();
    this.start(jobId);
  }

  cancel(jobId: string): void {
    const job = this.jobsById.get(jobId);
    if (!job || job.status === 'committing' || job.status === 'awaiting-sync') return;
    job.controller.abort();
    this.remove(job);
    if (job.uploadedPhoto) void this.cleanupIfUncommitted(job);
  }

  reconcile(vines: readonly Vine[]): void {
    this.confirmedPhotoIds.clear();
    for (const vine of vines) {
      this.confirmedPhotoIds.set(vine.id, new Set(vine.photos.map((photo) => photo.id)));
    }

    for (const job of [...this.jobsById.values()]) {
      if (this.confirmedPhotoIds.get(job.vineId)?.has(job.photoId)) {
        if (['queued', 'preparing', 'uploading'].includes(job.status)) job.controller.abort();
        this.remove(job);
      }
    }
  }

  getSnapshot = (): readonly VinePhotoUploadJob[] => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private createId(): string {
    return (this.dependencies.createId ?? (() => crypto.randomUUID()))();
  }

  private createPreviewUrl(blob: Blob): string {
    return (this.dependencies.createPreviewUrl ?? URL.createObjectURL)(blob);
  }

  private revokePreviewUrl(url: string): void {
    (this.dependencies.revokePreviewUrl ?? URL.revokeObjectURL)(url);
  }

  private start(jobId: string): void {
    const job = this.jobsById.get(jobId);
    if (!job) return;
    job.runVersion += 1;
    void this.run(job, job.runVersion);
  }

  private async run(job: InternalJob, version: number): Promise<void> {
    const signal = job.controller.signal;
    try {
      if (!job.prepared) {
        await this.withSlot(this.prepareSlots, signal, async () => {
          this.update(job, version, { status: 'preparing' });
          const prepared = await this.dependencies.prepare(job.file, signal);
          if (signal.aborted) throw abortError();
          job.prepared = prepared;
          const previewBlob = prepared.thumbnail?.blob
            ?? (prepared.width <= 120 && prepared.height <= 120 ? prepared.blob : null);
          if (previewBlob) job.previewUrl = this.createPreviewUrl(previewBlob);
          this.update(job, version, { status: 'queued' });
        });
      }

      if (!job.uploadedPhoto) {
        await this.withSlot(this.uploadSlots, signal, async () => {
          this.update(job, version, { status: 'uploading', progress: 0 });
          job.uploadedPhoto = await this.dependencies.upload(
            job.vineId,
            job.photoId,
            job.prepared as PreparedVinePhoto,
            (uploadedBytes, totalBytes) => {
              const next = totalBytes > 0
                ? Math.round((Math.min(uploadedBytes, totalBytes) / totalBytes) * 100)
                : 100;
              this.update(job, version, { progress: Math.max(job.progress, next) });
            },
            signal,
          );
        });
      }

      const commitSlot = this.commitSlots.get(job.vineId) ?? new Semaphore(1);
      this.commitSlots.set(job.vineId, commitSlot);
      await this.withSlot(commitSlot, signal, async () => {
        this.update(job, version, { status: 'committing', progress: 100 });
        await this.dependencies.commit(job.vineId, job.uploadedPhoto as VinePhoto);
      });
      this.update(job, version, { status: 'awaiting-sync', progress: 100 });
    } catch (error) {
      if (signal.aborted || !this.isCurrent(job, version)) return;
      await this.handleFailure(job, version, error);
    }
  }

  private async handleFailure(job: InternalJob, version: number, error: unknown) {
    if (job.uploadedPhoto) {
      try {
        if (await this.dependencies.hasCommitted(job.vineId, job.photoId)) {
          this.update(job, version, { status: 'awaiting-sync', progress: 100, error: null });
          return;
        }
        await this.dependencies.cleanup(job.uploadedPhoto);
        job.uploadedPhoto = null;
      } catch {
        // Bizonytalan commitnál megtartjuk az objektumokat: egy későbbi
        // realtime snapshot vagy idempotens retry biztonságosan feloldja.
      }
    }

    this.update(job, version, {
      status: 'failed',
      error: error instanceof Error && error.message && !error.message.startsWith('Firebase')
        ? error.message
        : 'Nem sikerült feltölteni a fotót.',
    });
  }

  private async cleanupIfUncommitted(job: InternalJob): Promise<void> {
    try {
      if (await this.dependencies.hasCommitted(job.vineId, job.photoId)) return;
      if (job.uploadedPhoto) await this.dependencies.cleanup(job.uploadedPhoto);
    } catch {
      // Bizonytalan commit esetén a hivatkozott objektum megőrzése a biztonságos
      // irány; egy esetleges árva objektum később külön takarítható.
    }
  }

  private async withSlot<T>(
    semaphore: Semaphore,
    signal: AbortSignal,
    operation: () => Promise<T>,
  ): Promise<T> {
    const release = await semaphore.acquire(signal);
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private update(
    job: InternalJob,
    version: number,
    patch: Partial<VinePhotoUploadJob>,
  ): void {
    if (!this.isCurrent(job, version)) return;
    Object.assign(job, patch);
    this.publish();
  }

  private isCurrent(job: InternalJob, version: number): boolean {
    return this.jobsById.get(job.jobId) === job && job.runVersion === version;
  }

  private remove(job: InternalJob): void {
    if (!this.jobsById.delete(job.jobId)) return;
    if (job.previewUrl) this.revokePreviewUrl(job.previewUrl);
    this.publish();
  }

  private publish(): void {
    this.snapshot = [...this.jobsById.values()].map((job) => ({
      jobId: job.jobId,
      photoId: job.photoId,
      vineId: job.vineId,
      fileName: job.fileName,
      status: job.status,
      progress: job.progress,
      previewUrl: job.previewUrl,
      error: job.error,
    }));
    for (const listener of this.listeners) listener();
  }
}
