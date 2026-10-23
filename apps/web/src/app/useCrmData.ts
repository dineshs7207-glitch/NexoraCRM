import { useEffect, useState } from 'react';
import { initialData } from './seed';
import type { AuditEntry, CRMData } from './types';

const storageKey = 'nexora-crm-demo-v1';

export function useCrmData() {
  const [data, setData] = useState<CRMData>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return initialData;
      const parsed=JSON.parse(saved) as Partial<CRMData>;
      const migratedTickets=(parsed.tickets??[]).map((ticket,index,all)=>({...ticket,ticketNumber:ticket.ticketNumber||`NX-TKT-2026-${String(all.length-index).padStart(4,'0')}`,dueAt:ticket.dueAt??'',status:ticket.status??'Open'}));
      return { ...initialData, ...parsed, tickets:migratedTickets };
    } catch { return initialData; }
  });

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(data)); }, [data]);

  const record = (action: string, target: string, type: string): AuditEntry => ({
    id: crypto.randomUUID(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), occurredAt:new Date().toISOString(),
    user: 'Dinesh S.', action, target, type,
  });

  const update = <K extends keyof CRMData>(key: K, value: CRMData[K], action: string, target: string, type: string) => {
    setData((prev) => ({ ...prev, [key]: value, audit: [record(action, target, type), ...prev.audit] }));
  };

  return { data, setData, update };
}
