/**
 * useLabelFilter.js (U10)
 *
 * Composable für die Label-basierte Filterung von Einkaufsartikeln.
 * Kapselt den Filter-State und die Filter-Logik, damit ShoppingList.vue
 * schlank bleibt.
 *
 * Trennung der Zuständigkeiten:
 *  - useLabelFilter  → aktives Label, Zählung, gefilterte Items
 *  - useItemDetails  → Detail-Panel UI-State
 *  - useShoppingList → Datenpersistenz
 *
 * Verwendung:
 * ```js
 * const {
 *   activeLabelFilter,
 *   setLabelFilter,
 *   clearLabelFilter,
 *   getLabelCounts,
 *   filterItemsByLabel,
 *   hasActiveFilter,
 * } = useLabelFilter();
 * ```
 */

import { ref, computed } from 'vue';
import { LABEL_COLORS } from './useItemDetails.js';

/**
 * Composable für Label-Filterung.
 * Kann in mehreren Listenkomponenten unabhängig voneinander genutzt werden.
 */
export function useLabelFilter() {
  /** Aktuell aktiver Label-Filter (null = alle anzeigen) */
  const activeLabelFilter = ref(null);

  /**
   * Gibt true zurück wenn ein Label-Filter aktiv ist.
   */
  const hasActiveFilter = computed(() => activeLabelFilter.value !== null);

  /**
   * Setzt den aktiven Label-Filter.
   * Falls das übergebene Label bereits aktiv ist, wird der Filter aufgehoben (Toggle).
   * @param {string|null} labelName - Label-Name oder null zum Aufheben
   */
  function setLabelFilter(labelName) {
    if (activeLabelFilter.value === labelName) {
      activeLabelFilter.value = null;
    } else {
      activeLabelFilter.value = labelName;
    }
  }

  /**
   * Hebt den aktiven Label-Filter auf.
   */
  function clearLabelFilter() {
    activeLabelFilter.value = null;
  }

  /**
   * Zählt Artikel pro Label aus einem Array von Item-Objekten.
   * Gibt ein Objekt zurück: { labelName: Anzahl }.
   * Items ohne Label werden nicht gezählt.
   *
   * @param {Array<Object>} items - Array von Item-Objekten mit label-Feld
   * @returns {{ [labelName: string]: number }}
   *
   * @example
   * const counts = getLabelCounts([
   *   { label: 'rot', name: 'Apfel' },
   *   { label: 'rot', name: 'Tomate' },
   *   { label: 'grün', name: 'Salat' },
   *   { label: null, name: 'Brot' },
   * ]);
   * // → { rot: 2, grün: 1 }
   */
  function getLabelCounts(items) {
    const counts = {};
    for (const item of items) {
      if (item.label) {
        counts[item.label] = (counts[item.label] || 0) + 1;
      }
    }
    return counts;
  }

  /**
   * Filtert ein Array von Items anhand des aktiven Label-Filters.
   * Wenn kein Filter aktiv ist, wird das Array unverändert zurückgegeben.
   *
   * @param {Array<Object>} items - Zu filternde Items
   * @returns {Array<Object>} Gefilterte Items
   */
  function filterItemsByLabel(items) {
    if (!activeLabelFilter.value) return items;
    return items.filter((item) => item.label === activeLabelFilter.value);
  }

  /**
   * Gibt alle LABEL_COLORS zurück die in dem gegebenen Items-Array
   * mindestens einmal vorkommen, mit ihrer Anzahl.
   * Nützlich für die LabelFilterBar.
   *
   * @param {Array<Object>} items
   * @returns {Array<{ name: string, hex: string, label: string, count: number }>}
   */
  function getAvailableLabels(items) {
    const counts = getLabelCounts(items);
    return LABEL_COLORS.filter((c) => (counts[c.name] ?? 0) > 0).map((c) => ({
      ...c,
      count: counts[c.name],
    }));
  }

  /**
   * Gibt die Anzahl der Artikel zurück die mit dem aktuell aktiven Label markiert sind.
   * Nützlich für UI-Badges.
   *
   * @param {Array<Object>} items
   * @returns {number}
   */
  function getActiveFilterCount(items) {
    if (!activeLabelFilter.value) return items.length;
    return items.filter((item) => item.label === activeLabelFilter.value).length;
  }

  /**
   * Prüft ob der aktive Filter noch gültig ist (d.h. ob noch Items mit
   * diesem Label existieren). Falls nicht, wird der Filter automatisch aufgehoben.
   * Sollte nach dem Löschen von Items oder Entfernen von Labels aufgerufen werden.
   *
   * @param {Array<Object>} items - Aktuell sichtbare Items
   */
  function validateFilter(items) {
    if (!activeLabelFilter.value) return;
    const counts = getLabelCounts(items);
    if (!counts[activeLabelFilter.value]) {
      activeLabelFilter.value = null;
    }
  }

  return {
    // State
    activeLabelFilter,
    hasActiveFilter,

    // Actions
    setLabelFilter,
    clearLabelFilter,
    validateFilter,

    // Helpers
    getLabelCounts,
    filterItemsByLabel,
    getAvailableLabels,
    getActiveFilterCount,
  };
}
