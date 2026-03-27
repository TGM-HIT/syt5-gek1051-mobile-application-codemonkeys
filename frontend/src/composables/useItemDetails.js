/**
 * useItemDetails.js
 *
 * Composable für die Verwaltung von Artikel-Details (U10).
 * Kapselt den UI-State für das Detail-Panel: welcher Artikel ist geöffnet,
 * welche Notiz und welches Label werden gerade bearbeitet.
 *
 * Trennung der Zuständigkeiten:
 *  - useShoppingList  → Datenpersistenz (PouchDB/CouchDB)
 *  - useItemDetails   → UI-State des Detail-Panels
 */

import { ref } from 'vue';

/**
 * Verfügbare Label-Farben mit Namen und Hex-Wert.
 * Der Name wird im Dokument gespeichert, der Hex-Wert nur für die Anzeige verwendet.
 */
export const LABEL_COLORS = [
  { name: 'rot', hex: '#ef4444', label: 'Rot' },
  { name: 'orange', hex: '#f97316', label: 'Orange' },
  { name: 'gelb', hex: '#eab308', label: 'Gelb' },
  { name: 'grün', hex: '#22c55e', label: 'Grün' },
  { name: 'blau', hex: '#3b82f6', label: 'Blau' },
  { name: 'lila', hex: '#a855f7', label: 'Lila' },
];

/**
 * Gibt den Hex-Farbwert für einen Label-Namen zurück.
 * @param {string|null} labelName - Name des Labels (z.B. 'rot') oder null
 * @returns {string|null} Hex-Farbwert oder null
 */
export function getLabelColor(labelName) {
  if (!labelName) return null;
  return LABEL_COLORS.find((c) => c.name === labelName)?.hex ?? null;
}

/**
 * Gibt das Label-Objekt für einen Label-Namen zurück.
 * @param {string|null} labelName
 * @returns {{ name: string, hex: string, label: string }|null}
 */
export function getLabelObject(labelName) {
  if (!labelName) return null;
  return LABEL_COLORS.find((c) => c.name === labelName) ?? null;
}

/**
 * Composable für den UI-State des Artikel-Detail-Panels.
 *
 * Verwendung in ShoppingList.vue:
 * ```js
 * const {
 *   expandedItemId,
 *   detailNote,
 *   detailLabel,
 *   isExpanded,
 *   openDetail,
 *   closeDetail,
 *   toggleDetail,
 *   setLabel,
 *   clearLabel,
 *   isDirty,
 * } = useItemDetails();
 * ```
 */
export function useItemDetails() {
  /** ID des aktuell geöffneten Artikels (null = kein Panel offen) */
  const expandedItemId = ref(null);

  /** Notiz-Text der aktuell im Panel bearbeiteten wird */
  const detailNote = ref('');

  /** Label-Name der aktuell im Panel ausgewählt ist (null = kein Label) */
  const detailLabel = ref(null);

  /** Originalwerte beim Öffnen (für Dirty-Check) */
  const _originalNote = ref('');
  const _originalLabel = ref(null);

  /**
   * Prüft ob das aktuell geöffnete Detail-Panel ungespeicherte Änderungen hat.
   * @returns {boolean}
   */
  function isDirty() {
    return detailNote.value !== _originalNote.value || detailLabel.value !== _originalLabel.value;
  }

  /**
   * Prüft ob ein bestimmter Artikel gerade geöffnet ist.
   * @param {string} itemId
   * @returns {boolean}
   */
  function isExpanded(itemId) {
    return expandedItemId.value === itemId;
  }

  /**
   * Öffnet das Detail-Panel für einen Artikel.
   * Initialisiert detailNote und detailLabel mit den aktuellen Werten des Artikels.
   * @param {Object} item - Das Artikel-Objekt
   */
  function openDetail(item) {
    expandedItemId.value = item._id;
    detailNote.value = item.note ?? '';
    detailLabel.value = item.label ?? null;
    _originalNote.value = item.note ?? '';
    _originalLabel.value = item.label ?? null;
  }

  /**
   * Schließt das Detail-Panel ohne zu speichern.
   */
  function closeDetail() {
    expandedItemId.value = null;
    detailNote.value = '';
    detailLabel.value = null;
    _originalNote.value = '';
    _originalLabel.value = null;
  }

  /**
   * Öffnet das Panel wenn geschlossen, schließt es wenn offen (Toggle).
   * @param {Object} item - Das Artikel-Objekt
   */
  function toggleDetail(item) {
    if (expandedItemId.value === item._id) {
      closeDetail();
    } else {
      openDetail(item);
    }
  }

  /**
   * Setzt das aktuell ausgewählte Label.
   * @param {string} labelName - Name des Labels (z.B. 'rot')
   */
  function setLabel(labelName) {
    detailLabel.value = labelName;
  }

  /**
   * Entfernt das aktuell ausgewählte Label (setzt auf null).
   */
  function clearLabel() {
    detailLabel.value = null;
  }

  /**
   * Gibt die aktuellen Bearbeitungswerte als Objekt zurück.
   * Nützlich um die Werte an updateItemDetails() zu übergeben.
   * @returns {{ note: string, label: string|null }}
   */
  function getDetailValues() {
    return {
      note: detailNote.value,
      label: detailLabel.value,
    };
  }

  /**
   * Überprüft ob ein Label-Name gültig ist (in LABEL_COLORS vorhanden).
   * @param {string|null} labelName
   * @returns {boolean}
   */
  function isValidLabel(labelName) {
    if (labelName === null) return true;
    return LABEL_COLORS.some((c) => c.name === labelName);
  }

  return {
    // State
    expandedItemId,
    detailNote,
    detailLabel,

    // Computed helpers
    isDirty,
    isExpanded,
    isValidLabel,
    getDetailValues,

    // Actions
    openDetail,
    closeDetail,
    toggleDetail,
    setLabel,
    clearLabel,
  };
}
