/**
 * useItemDetails.test.js
 *
 * Unit-Tests für den useItemDetails Composable (U10).
 * Testet den UI-State des Artikel-Detail-Panels:
 *  - LABEL_COLORS Konstante
 *  - getLabelColor() Hilfsfunktion
 *  - getLabelObject() Hilfsfunktion
 *  - openDetail() / closeDetail() / toggleDetail()
 *  - isDirty() Änderungserkennung
 *  - isExpanded() Panel-Status
 *  - setLabel() / clearLabel()
 *  - getDetailValues()
 *  - isValidLabel()
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useItemDetails, LABEL_COLORS, getLabelColor, getLabelObject } from '../useItemDetails.js';

// ── Test-Fixtures ─────────────────────────────────────────────────────────────

const mockItem = (overrides = {}) => ({
  _id: 'item-001',
  name: 'Milch',
  note: '',
  label: null,
  checked: false,
  markedDeleted: false,
  ...overrides,
});

// ── LABEL_COLORS ──────────────────────────────────────────────────────────────

describe('LABEL_COLORS', () => {
  it('enthält genau 6 Farben', () => {
    expect(LABEL_COLORS).toHaveLength(6);
  });

  it('jede Farbe hat name, hex und label', () => {
    for (const color of LABEL_COLORS) {
      expect(color).toHaveProperty('name');
      expect(color).toHaveProperty('hex');
      expect(color).toHaveProperty('label');
      expect(color.name).toBeTruthy();
      expect(color.hex).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color.label).toBeTruthy();
    }
  });

  it('enthält rot, orange, gelb, grün, blau, lila', () => {
    const names = LABEL_COLORS.map((c) => c.name);
    expect(names).toContain('rot');
    expect(names).toContain('orange');
    expect(names).toContain('gelb');
    expect(names).toContain('grün');
    expect(names).toContain('blau');
    expect(names).toContain('lila');
  });

  it('alle Namen sind eindeutig', () => {
    const names = LABEL_COLORS.map((c) => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('alle Hex-Werte sind eindeutig', () => {
    const hexes = LABEL_COLORS.map((c) => c.hex);
    const unique = new Set(hexes);
    expect(unique.size).toBe(hexes.length);
  });
});

// ── getLabelColor ─────────────────────────────────────────────────────────────

describe('getLabelColor()', () => {
  it('gibt null zurück für null', () => {
    expect(getLabelColor(null)).toBeNull();
  });

  it('gibt null zurück für undefined', () => {
    expect(getLabelColor(undefined)).toBeNull();
  });

  it('gibt null zurück für unbekannten Label-Namen', () => {
    expect(getLabelColor('unbekannt')).toBeNull();
    expect(getLabelColor('')).toBeNull();
    expect(getLabelColor('ROT')).toBeNull(); // case-sensitive
  });

  it('gibt #ef4444 für rot zurück', () => {
    expect(getLabelColor('rot')).toBe('#ef4444');
  });

  it('gibt #f97316 für orange zurück', () => {
    expect(getLabelColor('orange')).toBe('#f97316');
  });

  it('gibt #eab308 für gelb zurück', () => {
    expect(getLabelColor('gelb')).toBe('#eab308');
  });

  it('gibt #22c55e für grün zurück', () => {
    expect(getLabelColor('grün')).toBe('#22c55e');
  });

  it('gibt #3b82f6 für blau zurück', () => {
    expect(getLabelColor('blau')).toBe('#3b82f6');
  });

  it('gibt #a855f7 für lila zurück', () => {
    expect(getLabelColor('lila')).toBe('#a855f7');
  });
});

// ── getLabelObject ────────────────────────────────────────────────────────────

describe('getLabelObject()', () => {
  it('gibt null zurück für null', () => {
    expect(getLabelObject(null)).toBeNull();
  });

  it('gibt null zurück für unbekannten Namen', () => {
    expect(getLabelObject('xyz')).toBeNull();
  });

  it('gibt vollständiges Objekt für gültigen Namen zurück', () => {
    const obj = getLabelObject('rot');
    expect(obj).not.toBeNull();
    expect(obj.name).toBe('rot');
    expect(obj.hex).toBe('#ef4444');
    expect(obj.label).toBe('Rot');
  });

  it('gibt vollständiges Objekt für blau zurück', () => {
    const obj = getLabelObject('blau');
    expect(obj).not.toBeNull();
    expect(obj.name).toBe('blau');
    expect(obj.hex).toBe('#3b82f6');
  });
});

// ── useItemDetails: Initialzustand ────────────────────────────────────────────

describe('useItemDetails() - Initialzustand', () => {
  it('expandedItemId ist null', () => {
    const { expandedItemId } = useItemDetails();
    expect(expandedItemId.value).toBeNull();
  });

  it('detailNote ist leer', () => {
    const { detailNote } = useItemDetails();
    expect(detailNote.value).toBe('');
  });

  it('detailLabel ist null', () => {
    const { detailLabel } = useItemDetails();
    expect(detailLabel.value).toBeNull();
  });

  it('isDirty() gibt false zurück im Initialzustand', () => {
    const { isDirty } = useItemDetails();
    expect(isDirty()).toBe(false);
  });

  it('isExpanded() gibt false zurück für beliebige ID', () => {
    const { isExpanded } = useItemDetails();
    expect(isExpanded('item-001')).toBe(false);
    expect(isExpanded('')).toBe(false);
  });
});

// ── openDetail ────────────────────────────────────────────────────────────────

describe('openDetail()', () => {
  let detail;
  beforeEach(() => {
    detail = useItemDetails();
  });

  it('setzt expandedItemId auf die Item-ID', () => {
    const item = mockItem({ _id: 'item-42' });
    detail.openDetail(item);
    expect(detail.expandedItemId.value).toBe('item-42');
  });

  it('lädt note aus dem Item', () => {
    const item = mockItem({ note: 'Bitte frisch kaufen' });
    detail.openDetail(item);
    expect(detail.detailNote.value).toBe('Bitte frisch kaufen');
  });

  it('lädt label aus dem Item', () => {
    const item = mockItem({ label: 'grün' });
    detail.openDetail(item);
    expect(detail.detailLabel.value).toBe('grün');
  });

  it('setzt note auf leeren String wenn item.note undefined ist', () => {
    const item = mockItem();
    delete item.note;
    detail.openDetail(item);
    expect(detail.detailNote.value).toBe('');
  });

  it('setzt label auf null wenn item.label undefined ist', () => {
    const item = mockItem();
    delete item.label;
    detail.openDetail(item);
    expect(detail.detailLabel.value).toBeNull();
  });

  it('isExpanded() gibt true zurück nach openDetail', () => {
    const item = mockItem({ _id: 'item-x' });
    detail.openDetail(item);
    expect(detail.isExpanded('item-x')).toBe(true);
  });

  it('isExpanded() gibt false für andere ID', () => {
    const item = mockItem({ _id: 'item-x' });
    detail.openDetail(item);
    expect(detail.isExpanded('item-y')).toBe(false);
  });

  it('überschreibt vorheriges Panel', () => {
    detail.openDetail(mockItem({ _id: 'item-1', note: 'Note 1' }));
    detail.openDetail(mockItem({ _id: 'item-2', note: 'Note 2' }));
    expect(detail.expandedItemId.value).toBe('item-2');
    expect(detail.detailNote.value).toBe('Note 2');
  });
});

// ── closeDetail ───────────────────────────────────────────────────────────────

describe('closeDetail()', () => {
  it('setzt expandedItemId auf null', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ _id: 'item-1' }));
    detail.closeDetail();
    expect(detail.expandedItemId.value).toBeNull();
  });

  it('leert detailNote', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ note: 'test' }));
    detail.closeDetail();
    expect(detail.detailNote.value).toBe('');
  });

  it('leert detailLabel', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ label: 'rot' }));
    detail.closeDetail();
    expect(detail.detailLabel.value).toBeNull();
  });

  it('isDirty() gibt nach closeDetail() false zurück', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ note: 'x' }));
    detail.detailNote.value = 'y'; // Änderung machen
    detail.closeDetail();
    expect(detail.isDirty()).toBe(false);
  });
});

// ── toggleDetail ──────────────────────────────────────────────────────────────

describe('toggleDetail()', () => {
  it('öffnet Panel wenn es geschlossen ist', () => {
    const detail = useItemDetails();
    const item = mockItem({ _id: 'item-toggle' });
    detail.toggleDetail(item);
    expect(detail.expandedItemId.value).toBe('item-toggle');
  });

  it('schließt Panel wenn dasselbe Item nochmal geklickt wird', () => {
    const detail = useItemDetails();
    const item = mockItem({ _id: 'item-toggle' });
    detail.toggleDetail(item);
    detail.toggleDetail(item);
    expect(detail.expandedItemId.value).toBeNull();
  });

  it('wechselt zu neuem Item wenn ein anderes geklickt wird', () => {
    const detail = useItemDetails();
    const item1 = mockItem({ _id: 'item-1', note: 'Note 1' });
    const item2 = mockItem({ _id: 'item-2', note: 'Note 2' });
    detail.toggleDetail(item1);
    detail.toggleDetail(item2);
    expect(detail.expandedItemId.value).toBe('item-2');
    expect(detail.detailNote.value).toBe('Note 2');
  });
});

// ── isDirty ───────────────────────────────────────────────────────────────────

describe('isDirty()', () => {
  it('false wenn nichts geändert wurde', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ note: 'test', label: 'rot' }));
    expect(detail.isDirty()).toBe(false);
  });

  it('true wenn note geändert wurde', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ note: 'original' }));
    detail.detailNote.value = 'geändert';
    expect(detail.isDirty()).toBe(true);
  });

  it('true wenn label geändert wurde', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ label: null }));
    detail.detailLabel.value = 'blau';
    expect(detail.isDirty()).toBe(true);
  });

  it('false wenn note auf Originalwert zurückgesetzt', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ note: 'original', label: null }));
    detail.detailNote.value = 'geändert';
    detail.detailNote.value = 'original'; // zurücksetzen
    expect(detail.isDirty()).toBe(false);
  });

  it('true wenn label auf null gesetzt und ursprünglich ein Label hatte', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ label: 'rot' }));
    detail.detailLabel.value = null;
    expect(detail.isDirty()).toBe(true);
  });
});

// ── setLabel / clearLabel ─────────────────────────────────────────────────────

describe('setLabel() / clearLabel()', () => {
  it('setLabel() setzt detailLabel', () => {
    const detail = useItemDetails();
    detail.setLabel('lila');
    expect(detail.detailLabel.value).toBe('lila');
  });

  it('setLabel() überschreibt vorheriges Label', () => {
    const detail = useItemDetails();
    detail.setLabel('rot');
    detail.setLabel('blau');
    expect(detail.detailLabel.value).toBe('blau');
  });

  it('clearLabel() setzt detailLabel auf null', () => {
    const detail = useItemDetails();
    detail.setLabel('grün');
    detail.clearLabel();
    expect(detail.detailLabel.value).toBeNull();
  });
});

// ── getDetailValues ───────────────────────────────────────────────────────────

describe('getDetailValues()', () => {
  it('gibt { note, label } zurück', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ note: 'Frisch', label: 'grün' }));
    const values = detail.getDetailValues();
    expect(values).toEqual({ note: 'Frisch', label: 'grün' });
  });

  it('gibt leere Strings und null zurück im Initialzustand', () => {
    const detail = useItemDetails();
    const values = detail.getDetailValues();
    expect(values).toEqual({ note: '', label: null });
  });

  it('gibt aktuelle Bearbeitungswerte zurück nach Änderung', () => {
    const detail = useItemDetails();
    detail.openDetail(mockItem({ note: 'alt', label: 'rot' }));
    detail.detailNote.value = 'neu';
    detail.detailLabel.value = 'blau';
    const values = detail.getDetailValues();
    expect(values).toEqual({ note: 'neu', label: 'blau' });
  });
});

// ── isValidLabel ──────────────────────────────────────────────────────────────

describe('isValidLabel()', () => {
  it('gibt true für null zurück', () => {
    const { isValidLabel } = useItemDetails();
    expect(isValidLabel(null)).toBe(true);
  });

  it('gibt true für jeden LABEL_COLORS-Namen zurück', () => {
    const { isValidLabel } = useItemDetails();
    for (const color of LABEL_COLORS) {
      expect(isValidLabel(color.name)).toBe(true);
    }
  });

  it('gibt false für unbekannte Namen zurück', () => {
    const { isValidLabel } = useItemDetails();
    expect(isValidLabel('pink')).toBe(false);
    expect(isValidLabel('ROT')).toBe(false);
    expect(isValidLabel('')).toBe(false);
    expect(isValidLabel('123')).toBe(false);
  });
});
