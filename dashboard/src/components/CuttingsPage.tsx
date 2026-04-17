import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { CuttingsList } from './CuttingsList';
import { CuttingDetail } from './CuttingDetail';
import { CuttingForm } from './CuttingForm';
import { getCuttingIdFromPath, getCuttingPath, toCuttingPhotos } from './cuttingsViewUtils';
import { usePhotoUpload } from '../hooks/usePhotoUpload';
import { useCuttingsQuery } from '../hooks/queries/useCuttingsQuery';
import type { CreateCuttingInput } from '../types/cutting';
import type { CuttingFormValues } from '../lib/schemas';

interface CuttingsPageProps {
  isAdmin: boolean;
}

const DEFAULT_FORM_VALUES = (): CuttingFormValues => ({
  variety: '',
  plantType: 'cutting',
  plantedAt: new Date().toISOString().slice(0, 10),
  status: 'active',
  notes: '',
});

function isMobileLayoutWidth() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 1023px)').matches;
}

export function CuttingsPage({ isAdmin }: CuttingsPageProps) {
  const { data: cuttings, loading, error, createCutting, updateCutting, isCreating, isUpdating } =
    useCuttingsQuery();
  const { upload: uploadPhotos } = usePhotoUpload();
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    getCuttingIdFromPath(window.location.pathname),
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(() => isMobileLayoutWidth());

  const selectedCutting = useMemo(
    () =>
      cuttings.find((cutting) => cutting.id === selectedId) ??
      (isMobileLayout ? null : cuttings[0] ?? null),
    [cuttings, isMobileLayout, selectedId],
  );
  const nextSerialNumber = useMemo(
    () => cuttings.reduce((maxValue, cutting) => Math.max(maxValue, cutting.serialNumber), 0) + 1,
    [cuttings],
  );
  const knownVarieties = useMemo(
    () =>
      Array.from(
        new Set(
          cuttings
            .map((cutting) => cutting.variety.trim())
            .filter((variety) => variety.length > 0),
        ),
      ).sort((left, right) => left.localeCompare(right, 'hu')),
    [cuttings],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const handleChange = () => setIsMobileLayout(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setSelectedId(getCuttingIdFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (cuttings.length === 0) {
      if (window.location.pathname !== '/dugvanyok') {
        window.history.replaceState({}, '', '/dugvanyok');
      }
      return;
    }

    if (!selectedCutting) {
      if (isMobileLayout) {
        if (window.location.pathname !== '/dugvanyok') {
          window.history.replaceState({}, '', '/dugvanyok');
        }
        return;
      }

      const fallbackCutting = cuttings[0];
      setSelectedId(fallbackCutting.id);
      window.history.replaceState({}, '', getCuttingPath(fallbackCutting.id));
      return;
    }

    const expectedPath = getCuttingPath(selectedCutting.id);
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState({}, '', expectedPath);
    }
  }, [cuttings, isMobileLayout, selectedCutting]);

  const handleCreate = async (values: CuttingFormValues, files: FileList | null) => {
    if (!isAdmin) {
      throw new Error('Csak admin tud új dugványt létrehozni.');
    }

    const cuttingId = crypto.randomUUID();
    const uploads = files
      ? await uploadPhotos({
          files,
          storagePathPrefix: `cuttings/${cuttingId}/photos`,
        })
      : [];
    const photos = toCuttingPhotos(uploads);
    const payload: CreateCuttingInput = {
      serialNumber: nextSerialNumber,
      variety: values.variety.trim(),
      plantType: values.plantType,
      plantedAt: values.plantedAt,
      status: values.status,
      notes: values.notes.trim(),
      photos,
    };

    await createCutting(cuttingId, payload);
    window.history.pushState({}, '', getCuttingPath(cuttingId));
    setSelectedId(cuttingId);
    setShowCreateForm(false);
  };

  const handleSelectCutting = (cuttingId: string) => {
    const nextPath = getCuttingPath(cuttingId);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setSelectedId(cuttingId);
  };

  const handleCloseSelectedCutting = () => {
    if (window.location.pathname !== '/dugvanyok') {
      window.history.pushState({}, '', '/dugvanyok');
    }
    setSelectedId(null);
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-vine-900 dark:text-vine-50">Dugványok</h2>
          <p className="text-sm text-vine-500 dark:text-vine-300">
            Cserepezett szőlő dugványok és oltványok követése fotókkal.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowCreateForm((open) => !open)}
            className="inline-flex items-center gap-2 rounded-xl bg-vine-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-vine-700"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? 'Űrlap bezárása' : 'Új dugvány'}
          </button>
        )}
      </div>

      {showCreateForm && isAdmin && (
        <CuttingForm
          serialNumber={nextSerialNumber}
          defaultValues={DEFAULT_FORM_VALUES()}
          knownVarieties={knownVarieties}
          isPending={isCreating}
          submitLabel="Mentés"
          helperText="Esemény napló a részletes nézetben adható hozzá."
          showPhotoUpload
          onSubmit={handleCreate}
        />
      )}

      {!isAdmin && (
        <div className="rounded-2xl border border-vine-200 bg-white/60 px-4 py-3 text-sm text-vine-600 dark:border-vine-700 dark:bg-vine-800/40 dark:text-vine-200">
          Megfigyelő nézet. Új dugványt és képet csak admin tud rögzíteni.
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-vine-400">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          Dugványok betöltése...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <CuttingsList
            cuttings={cuttings}
            selectedCuttingId={selectedCutting?.id ?? null}
            onSelectCutting={handleSelectCutting}
          />

          <CuttingDetail
            cuttings={cuttings}
            selectedCutting={selectedCutting}
            knownVarieties={knownVarieties}
            isAdmin={isAdmin}
            isMobileLayout={isMobileLayout}
            isUpdating={isUpdating}
            onCloseSelectedCutting={handleCloseSelectedCutting}
            onUpdateCutting={updateCutting}
          />
        </div>
      )}
    </section>
  );
}
