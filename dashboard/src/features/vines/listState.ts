import {
  VINE_ROOT_TYPES,
  VINE_STATUSES,
  type Vine,
  type VineRootType,
  type VineStatus,
} from './model';
import { locationKey } from './vineLocations';

export type VineListStatus = VineStatus | 'all';
export type VineListRootType = VineRootType | 'all';
export type VineListFruited = 'yes' | 'no' | 'all';
export type VineListSort = 'updated_desc' | 'planting_desc' | 'variety_asc';

export interface VineListState {
  query: string;
  status: VineListStatus;
  rootType: VineListRootType;
  /** `undefined`: mind; `null`: régi, helyszín nélküli; szöveg: pontos helyszín. */
  location: string | null | undefined;
  tag: string;
  fruited: VineListFruited;
  sort: VineListSort;
}

export const DEFAULT_VINE_LIST_STATE: Readonly<VineListState> = {
  query: '',
  status: 'active',
  rootType: 'all',
  location: undefined,
  tag: '',
  fruited: 'all',
  sort: 'updated_desc',
};

const VINE_LIST_STATUSES = [...VINE_STATUSES, 'all'] as const;
const VINE_LIST_ROOT_TYPES = [...VINE_ROOT_TYPES, 'all'] as const;

function isOneOf<T extends string>(value: string | null, values: readonly T[]): value is T {
  return value !== null && values.includes(value as T);
}

export function parseVineListState(search: string): VineListState {
  const params = new URLSearchParams(search);
  const status = params.get('status');
  const rootType = params.get('rootType');
  const fruited = params.get('fruited');
  const sort = params.get('sort');
  const rawLocation = params.get('location');

  return {
    query: (params.get('q') ?? '').trim(),
    status: isOneOf(status, VINE_LIST_STATUSES)
      ? status
      : DEFAULT_VINE_LIST_STATE.status,
    rootType: isOneOf(rootType, VINE_LIST_ROOT_TYPES)
      ? rootType
      : DEFAULT_VINE_LIST_STATE.rootType,
    location: rawLocation === null ? undefined : rawLocation.trim() || null,
    tag: (params.get('tag') ?? '').trim(),
    fruited: isOneOf(fruited, ['yes', 'no', 'all'])
      ? fruited
      : DEFAULT_VINE_LIST_STATE.fruited,
    sort: isOneOf(sort, ['updated_desc', 'planting_desc', 'variety_asc'])
      ? sort
      : DEFAULT_VINE_LIST_STATE.sort,
  };
}

export function serializeVineListState(state: VineListState): string {
  const params = new URLSearchParams();
  const query = state.query.trim();
  const tag = state.tag.trim();

  if (query) params.set('q', query);
  if (state.status !== DEFAULT_VINE_LIST_STATE.status) params.set('status', state.status);
  if (state.rootType !== DEFAULT_VINE_LIST_STATE.rootType) {
    params.set('rootType', state.rootType);
  }
  if (state.location !== undefined) params.set('location', state.location ?? '');
  if (tag) params.set('tag', tag);
  if (state.fruited !== DEFAULT_VINE_LIST_STATE.fruited) params.set('fruited', state.fruited);
  if (state.sort !== DEFAULT_VINE_LIST_STATE.sort) params.set('sort', state.sort);

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

function compareSerialNumber(left: Vine, right: Vine): number {
  return left.serialNumber - right.serialNumber;
}

function compareByPlantingYear(left: Vine, right: Vine): number {
  const leftYear = left.plantingYear;
  const rightYear = right.plantingYear;

  if (leftYear === null) return rightYear === null ? compareSerialNumber(left, right) : 1;
  if (rightYear === null) return -1;
  return rightYear - leftYear || compareSerialNumber(left, right);
}

export function selectVisibleVines(
  vines: readonly Vine[],
  state: VineListState,
): Vine[] {
  const query = state.query.trim().toLocaleLowerCase('hu');

  const visible = vines.filter((vine) => {
    if (state.status !== 'all' && vine.status !== state.status) return false;
    if (state.rootType !== 'all' && vine.rootType !== state.rootType) return false;
    if (
      state.location !== undefined &&
      (state.location === null
        ? vine.location !== null
        : vine.location === null || locationKey(vine.location) !== locationKey(state.location))
    ) {
      return false;
    }
    if (state.tag && !vine.tags.includes(state.tag)) return false;
    if (state.fruited !== 'all' && vine.hasFruited !== (state.fruited === 'yes')) return false;
    if (!query) return true;

    return (
      vine.variety.toLocaleLowerCase('hu').includes(query) ||
      String(vine.serialNumber).includes(query) ||
      locationKey(vine.location ?? '').includes(query) ||
      vine.areaDescription.toLocaleLowerCase('hu').includes(query)
    );
  });

  return visible.sort((left, right) => {
    switch (state.sort) {
      case 'planting_desc':
        return compareByPlantingYear(left, right);
      case 'variety_asc':
        return (
          left.variety.localeCompare(right.variety, 'hu', { sensitivity: 'base' }) ||
          compareSerialNumber(left, right)
        );
      default:
        return (
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
          compareSerialNumber(left, right)
        );
    }
  });
}
