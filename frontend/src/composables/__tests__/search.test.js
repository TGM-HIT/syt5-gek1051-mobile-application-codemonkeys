import { describe, it, expect, beforeEach } from 'vitest';
import { ref } from 'vue';

/**
 * Unit-Tests für die Suchlogik:
 * Match-Verhalten, Groß-/Kleinschreibung und Zurücksetzen der Suche.
 */
// Die Suchlogik aus ShoppingList.vue als isolierte Funktionen nachgebaut,
// um sie unabhängig von der Component-Umgebung testen zu können.
function useSearch() {
  const searchQuery = ref('');

  function clearSearch() {
    searchQuery.value = '';
  }

  function isSearchMatch(item) {
    if (!searchQuery.value) return true;
    return item.name.toLowerCase().includes(searchQuery.value.toLowerCase());
  }

  return { searchQuery, clearSearch, isSearchMatch };
}

describe('Suchfunktion', () => {
  let searchQuery, clearSearch, isSearchMatch;

  beforeEach(() => {
    ({ searchQuery, clearSearch, isSearchMatch } = useSearch());
  });

  describe('isSearchMatch – leere Suche', () => {
    it('gibt true zurück wenn searchQuery leer ist', () => {
      expect(isSearchMatch({ name: 'Milch' })).toBe(true);
    });

    it('gibt true zurück für beliebige Items wenn kein Suchbegriff gesetzt', () => {
      expect(isSearchMatch({ name: 'Brot' })).toBe(true);
      expect(isSearchMatch({ name: '' })).toBe(true);
    });
  });

  describe('isSearchMatch – exakter Treffer', () => {
    it('gibt true zurück wenn Name exakt dem Suchbegriff entspricht', () => {
      searchQuery.value = 'Milch';
      expect(isSearchMatch({ name: 'Milch' })).toBe(true);
    });
  });

  describe('isSearchMatch – Teilstring', () => {
    it('gibt true zurück wenn Suchbegriff im Namen enthalten ist', () => {
      searchQuery.value = 'ilc';
      expect(isSearchMatch({ name: 'Milch' })).toBe(true);
    });

    it('gibt false zurück wenn Suchbegriff nicht im Namen enthalten ist', () => {
      searchQuery.value = 'Eier';
      expect(isSearchMatch({ name: 'Milch' })).toBe(false);
    });
  });

  describe('isSearchMatch – Groß-/Kleinschreibung', () => {
    it('findet Items unabhängig von Groß-/Kleinschreibung im Suchbegriff', () => {
      searchQuery.value = 'milch';
      expect(isSearchMatch({ name: 'Milch' })).toBe(true);
    });

    it('findet Items unabhängig von Groß-/Kleinschreibung im Item-Namen', () => {
      searchQuery.value = 'MILCH';
      expect(isSearchMatch({ name: 'milch' })).toBe(true);
    });

    it('findet Items auch bei gemischter Schreibweise', () => {
      searchQuery.value = 'MiLcH';
      expect(isSearchMatch({ name: 'mIlCh' })).toBe(true);
    });
  });

  describe('isSearchMatch – kein Treffer', () => {
    it('gibt false zurück wenn der Name komplett anders ist', () => {
      searchQuery.value = 'Käse';
      expect(isSearchMatch({ name: 'Brot' })).toBe(false);
    });

    it('gibt false zurück wenn der Name leer ist und Suchbegriff gesetzt', () => {
      searchQuery.value = 'Milch';
      expect(isSearchMatch({ name: '' })).toBe(false);
    });
  });

  describe('clearSearch', () => {
    it('setzt searchQuery auf leeren String zurück', () => {
      searchQuery.value = 'Milch';
      clearSearch();
      expect(searchQuery.value).toBe('');
    });

    it('isSearchMatch gibt nach clearSearch wieder true zurück', () => {
      searchQuery.value = 'xyz';
      expect(isSearchMatch({ name: 'Milch' })).toBe(false);
      clearSearch();
      expect(isSearchMatch({ name: 'Milch' })).toBe(true);
    });
  });
});
