/**
 * useLabelFilter.test.js
 *
 * Unit-Tests für den useLabelFilter Composable (U10).
 * Testet die Label-basierte Filterlogik:
 *  - Initialer Zustand
 *  - setLabelFilter() mit Toggle-Verhalten
 *  - clearLabelFilter()
 *  - validateFilter() Auto-Reset
 *  - getLabelCounts()
 *  - filterItemsByLabel()
 *  - getAvailableLabels()
 *  - getActiveFilterCount()
 *  - hasActiveFilter computed
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useLabelFilter } from '../useLabelFilter.js';

// ── Test-Fixtures ─────────────────────────────────────────────────────────────

/** Erstellt ein einfaches Mock-Item */
const item = (label, name = 'Item') => ({ _id: `id-${name}`, name, label, markedDeleted: false });

/** Erstellt ein Array von Mock-Items für Tests */
const testItems = () => [
  item('rot', 'Apfel'),
  item('rot', 'Tomate'),
  item('rot', 'Erdbeere'),
  item('grün', 'Salat'),
  item('grün', 'Gurke'),
  item('blau', 'Heidelbeere'),
  item(null, 'Brot'),
  item(null, 'Milch'),
  item(null, 'Butter'),
];

// ── Initialzustand ────────────────────────────────────────────────────────────

describe('useLabelFilter() - Initialzustand', () => {
  it('activeLabelFilter ist null', () => {
    const { activeLabelFilter } = useLabelFilter();
    expect(activeLabelFilter.value).toBeNull();
  });

  it('hasActiveFilter ist false', () => {
    const { hasActiveFilter } = useLabelFilter();
    expect(hasActiveFilter.value).toBe(false);
  });
});

// ── setLabelFilter ────────────────────────────────────────────────────────────

describe('setLabelFilter()', () => {
  let filter;
  beforeEach(() => {
    filter = useLabelFilter();
  });

  it('setzt activeLabelFilter auf den übergebenen Namen', () => {
    filter.setLabelFilter('rot');
    expect(filter.activeLabelFilter.value).toBe('rot');
  });

  it('hasActiveFilter wird true nach dem Setzen eines Labels', () => {
    filter.setLabelFilter('grün');
    expect(filter.hasActiveFilter.value).toBe(true);
  });

  it('Toggle: dasselbe Label nochmals klicken hebt Filter auf', () => {
    filter.setLabelFilter('blau');
    filter.setLabelFilter('blau');
    expect(filter.activeLabelFilter.value).toBeNull();
  });

  it('Toggle: Filter wird nach Toggle false', () => {
    filter.setLabelFilter('lila');
    filter.setLabelFilter('lila');
    expect(filter.hasActiveFilter.value).toBe(false);
  });

  it('Wechsel: anderes Label setzt Filter um', () => {
    filter.setLabelFilter('rot');
    filter.setLabelFilter('gelb');
    expect(filter.activeLabelFilter.value).toBe('gelb');
  });

  it('null setzen hebt Filter auf', () => {
    filter.setLabelFilter('rot');
    filter.setLabelFilter(null);
    expect(filter.activeLabelFilter.value).toBeNull();
  });

  it('Toggle mit null: null + null = null (bleibt null)', () => {
    filter.setLabelFilter(null); // null auf null toggled → bleibt null
    expect(filter.activeLabelFilter.value).toBeNull();
  });

  it('mehrfaches Setzen verschiedener Labels', () => {
    filter.setLabelFilter('rot');
    filter.setLabelFilter('grün');
    filter.setLabelFilter('blau');
    filter.setLabelFilter('lila');
    expect(filter.activeLabelFilter.value).toBe('lila');
  });
});

// ── clearLabelFilter ──────────────────────────────────────────────────────────

describe('clearLabelFilter()', () => {
  it('setzt activeLabelFilter auf null', () => {
    const filter = useLabelFilter();
    filter.setLabelFilter('rot');
    filter.clearLabelFilter();
    expect(filter.activeLabelFilter.value).toBeNull();
  });

  it('hasActiveFilter wird false', () => {
    const filter = useLabelFilter();
    filter.setLabelFilter('grün');
    filter.clearLabelFilter();
    expect(filter.hasActiveFilter.value).toBe(false);
  });

  it('clearLabelFilter() wenn kein Filter aktiv bleibt null', () => {
    const filter = useLabelFilter();
    filter.clearLabelFilter();
    expect(filter.activeLabelFilter.value).toBeNull();
  });
});

// ── getLabelCounts ────────────────────────────────────────────────────────────

describe('getLabelCounts()', () => {
  let filter;
  beforeEach(() => {
    filter = useLabelFilter();
  });

  it('gibt leeres Objekt für leeres Array zurück', () => {
    const counts = filter.getLabelCounts([]);
    expect(counts).toEqual({});
  });

  it('zählt Items pro Label korrekt', () => {
    const counts = filter.getLabelCounts(testItems());
    expect(counts.rot).toBe(3);
    expect(counts.grün).toBe(2);
    expect(counts.blau).toBe(1);
  });

  it('Items ohne Label werden nicht gezählt', () => {
    const counts = filter.getLabelCounts(testItems());
    expect(counts[null]).toBeUndefined();
    expect(counts['null']).toBeUndefined();
    expect(Object.keys(counts)).toHaveLength(3);
  });

  it('gibt leeres Objekt wenn alle Items kein Label haben', () => {
    const noLabelItems = [item(null, 'A'), item(null, 'B'), item(null, 'C')];
    const counts = filter.getLabelCounts(noLabelItems);
    expect(counts).toEqual({});
  });

  it('zählt korrekt bei nur einem Label', () => {
    const oneLabel = [item('orange', 'X'), item('orange', 'Y')];
    const counts = filter.getLabelCounts(oneLabel);
    expect(counts).toEqual({ orange: 2 });
  });

  it('zählt jedes Label einzeln wenn alle verschieden', () => {
    const differentLabels = [
      item('rot', 'A'),
      item('grün', 'B'),
      item('blau', 'C'),
      item('gelb', 'D'),
    ];
    const counts = filter.getLabelCounts(differentLabels);
    expect(counts).toEqual({ rot: 1, grün: 1, blau: 1, gelb: 1 });
  });

  it('verarbeitet undefined label als kein Label', () => {
    const items = [{ _id: '1', name: 'Test', label: undefined }];
    const counts = filter.getLabelCounts(items);
    expect(counts).toEqual({});
  });
});

// ── filterItemsByLabel ────────────────────────────────────────────────────────

describe('filterItemsByLabel()', () => {
  let filter;
  beforeEach(() => {
    filter = useLabelFilter();
  });

  it('gibt alle Items zurück wenn kein Filter aktiv', () => {
    const items = testItems();
    const result = filter.filterItemsByLabel(items);
    expect(result).toHaveLength(items.length);
  });

  it('filtert Items nach aktivem Label', () => {
    filter.setLabelFilter('rot');
    const result = filter.filterItemsByLabel(testItems());
    expect(result).toHaveLength(3);
    expect(result.every((i) => i.label === 'rot')).toBe(true);
  });

  it('filtert korrekt auf 1 Item wenn nur eines passt', () => {
    filter.setLabelFilter('blau');
    const result = filter.filterItemsByLabel(testItems());
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Heidelbeere');
  });

  it('gibt leeres Array wenn kein Item das Label hat', () => {
    filter.setLabelFilter('lila');
    const result = filter.filterItemsByLabel(testItems());
    expect(result).toHaveLength(0);
  });

  it('gibt leeres Array für leeres Input-Array zurück', () => {
    filter.setLabelFilter('rot');
    const result = filter.filterItemsByLabel([]);
    expect(result).toHaveLength(0);
  });

  it('filtert nicht auf Items ohne Label', () => {
    filter.setLabelFilter('rot');
    const result = filter.filterItemsByLabel(testItems());
    expect(result.every((i) => i.label !== null)).toBe(true);
  });

  it('nach clearLabelFilter() werden alle Items zurückgegeben', () => {
    filter.setLabelFilter('rot');
    filter.clearLabelFilter();
    const result = filter.filterItemsByLabel(testItems());
    expect(result).toHaveLength(testItems().length);
  });
});

// ── getAvailableLabels ────────────────────────────────────────────────────────

describe('getAvailableLabels()', () => {
  let filter;
  beforeEach(() => {
    filter = useLabelFilter();
  });

  it('gibt leeres Array für leeres Input-Array zurück', () => {
    const result = filter.getAvailableLabels([]);
    expect(result).toHaveLength(0);
  });

  it('gibt nur Labels mit mindestens einem Item zurück', () => {
    const result = filter.getAvailableLabels(testItems());
    const names = result.map((c) => c.name);
    expect(names).toContain('rot');
    expect(names).toContain('grün');
    expect(names).toContain('blau');
    expect(names).not.toContain('orange');
    expect(names).not.toContain('gelb');
    expect(names).not.toContain('lila');
  });

  it('jedes zurückgegebene Objekt hat name, hex, label und count', () => {
    const result = filter.getAvailableLabels(testItems());
    for (const label of result) {
      expect(label).toHaveProperty('name');
      expect(label).toHaveProperty('hex');
      expect(label).toHaveProperty('label');
      expect(label).toHaveProperty('count');
      expect(label.count).toBeGreaterThan(0);
    }
  });

  it('count stimmt mit tatsächlicher Anzahl überein', () => {
    const result = filter.getAvailableLabels(testItems());
    const rot = result.find((c) => c.name === 'rot');
    expect(rot?.count).toBe(3);
    const grün = result.find((c) => c.name === 'grün');
    expect(grün?.count).toBe(2);
  });

  it('gibt leeres Array wenn alle Items kein Label haben', () => {
    const noLabelItems = [item(null, 'A'), item(null, 'B')];
    const result = filter.getAvailableLabels(noLabelItems);
    expect(result).toHaveLength(0);
  });
});

// ── getActiveFilterCount ──────────────────────────────────────────────────────

describe('getActiveFilterCount()', () => {
  let filter;
  beforeEach(() => {
    filter = useLabelFilter();
  });

  it('gibt Gesamtanzahl zurück wenn kein Filter aktiv', () => {
    const items = testItems();
    const count = filter.getActiveFilterCount(items);
    expect(count).toBe(items.length);
  });

  it('gibt 0 zurück für leeres Array', () => {
    const count = filter.getActiveFilterCount([]);
    expect(count).toBe(0);
  });

  it('gibt Anzahl der gefilterten Items zurück', () => {
    filter.setLabelFilter('rot');
    const count = filter.getActiveFilterCount(testItems());
    expect(count).toBe(3);
  });

  it('gibt 0 zurück wenn kein Item das Label hat', () => {
    filter.setLabelFilter('lila');
    const count = filter.getActiveFilterCount(testItems());
    expect(count).toBe(0);
  });
});

// ── validateFilter ────────────────────────────────────────────────────────────

describe('validateFilter()', () => {
  it('hebt Filter auf wenn kein Item mehr das Label hat', () => {
    const filter = useLabelFilter();
    filter.setLabelFilter('orange');
    // Items ohne orange-Label
    filter.validateFilter(testItems());
    expect(filter.activeLabelFilter.value).toBeNull();
  });

  it('behält Filter bei wenn noch Items mit dem Label vorhanden', () => {
    const filter = useLabelFilter();
    filter.setLabelFilter('rot');
    filter.validateFilter(testItems());
    expect(filter.activeLabelFilter.value).toBe('rot');
  });

  it('tut nichts wenn kein Filter aktiv ist', () => {
    const filter = useLabelFilter();
    filter.validateFilter(testItems());
    expect(filter.activeLabelFilter.value).toBeNull();
  });

  it('hebt Filter auf wenn leeres Array übergeben wird', () => {
    const filter = useLabelFilter();
    filter.setLabelFilter('rot');
    filter.validateFilter([]);
    expect(filter.activeLabelFilter.value).toBeNull();
  });
});

// ── Integration Tests ─────────────────────────────────────────────────────────

describe('useLabelFilter() - Integrationsszenarien', () => {
  it('kompletter Filter-Workflow: setzen, filtern, aufheben', () => {
    const filter = useLabelFilter();
    const items = testItems();

    // Kein Filter → alle Items
    expect(filter.filterItemsByLabel(items)).toHaveLength(9);

    // Filter setzen
    filter.setLabelFilter('rot');
    expect(filter.filterItemsByLabel(items)).toHaveLength(3);
    expect(filter.hasActiveFilter.value).toBe(true);

    // Filter aufheben
    filter.clearLabelFilter();
    expect(filter.filterItemsByLabel(items)).toHaveLength(9);
    expect(filter.hasActiveFilter.value).toBe(false);
  });

  it('Filter-Toggle zwischen zwei Labels', () => {
    const filter = useLabelFilter();
    const items = testItems();

    filter.setLabelFilter('rot');
    expect(filter.filterItemsByLabel(items)).toHaveLength(3);

    filter.setLabelFilter('grün');
    expect(filter.filterItemsByLabel(items)).toHaveLength(2);

    filter.setLabelFilter('blau');
    expect(filter.filterItemsByLabel(items)).toHaveLength(1);
  });

  it('validateFilter räumt auf wenn Labels entfernt werden', () => {
    const filter = useLabelFilter();
    filter.setLabelFilter('rot');

    // Alle rot-Items entfernen
    const itemsWithoutRot = testItems().filter((i) => i.label !== 'rot');
    filter.validateFilter(itemsWithoutRot);

    expect(filter.activeLabelFilter.value).toBeNull();
    expect(filter.filterItemsByLabel(itemsWithoutRot)).toHaveLength(itemsWithoutRot.length);
  });
});
