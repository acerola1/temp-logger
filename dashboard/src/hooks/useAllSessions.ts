import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Device, Session } from '../types/sensor';

export function useAllSessions(devices: Device[]) {
  const [sessionMap, setSessionMap] = useState<Record<string, Session[]>>({});

  const deviceIds = useMemo(() => devices.map((d) => d.id), [devices]);

  useEffect(() => {
    if (deviceIds.length === 0) return;

    const unsubscribers = deviceIds.map((deviceId) => {
      const q = query(collection(db, 'devices', deviceId, 'sessions'));
      return onSnapshot(q, (snapshot) => {
        const deviceSessions: Session[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            deviceId,
            name: data.name,
            sessionTypeId: data.sessionTypeId,
            status: data.status,
            startDate: data.startDate,
            endDate: data.endDate ?? null,
          };
        });
        setSessionMap((prev) => ({ ...prev, [deviceId]: deviceSessions }));
      });
    });

    return () => unsubscribers.forEach((u) => u());
  }, [deviceIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessions = useMemo(
    () =>
      Object.values(sessionMap)
        .flat()
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [sessionMap],
  );

  return { sessions };
}
