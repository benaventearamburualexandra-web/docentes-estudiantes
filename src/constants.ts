export const INITIAL_SCHEDULE = {
  monday: { enabled: true, slots: [{ start: '07:45', end: '14:05' }] },
  tuesday: { enabled: true, slots: [{ start: '07:45', end: '14:05' }] },
  wednesday: { enabled: true, slots: [{ start: '07:45', end: '14:05' }] },
  thursday: { enabled: true, slots: [{ start: '07:45', end: '14:05' }] },
  friday: { enabled: true, slots: [{ start: '07:45', end: '14:05' }] },
  saturday: { enabled: false, slots: [] },
  sunday: { enabled: false, slots: [] },
};

export const DAY_LABELS: Record<string, string> = {
  monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié', thursday: 'Jue', 
  friday: 'Vie', saturday: 'Sáb', sunday: 'Dom',
};