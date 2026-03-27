<script setup>
/**
 * LabelFilterBar.vue (U10)
 *
 * Zeigt eine horizontale Leiste mit Label-Filterschaltflächen.
 * Der Benutzer kann auf eine Farbe klicken, um nur Artikel mit diesem
 * Label anzuzeigen. Ein weiterer Klick deaktiviert den Filter wieder.
 *
 * Props:
 *  - activeLabel: string|null – aktuell aktiver Label-Filter
 *  - counts: Object – { labelName: Anzahl } – Anzahl Artikel pro Label
 *
 * Emits:
 *  - update:activeLabel – wenn ein Label ausgewählt/abgewählt wird
 */
import { computed } from 'vue';
import { LABEL_COLORS, getLabelColor } from '@/composables/useItemDetails';

const props = defineProps({
  /** Aktuell aktiver Label-Filter (null = kein Filter) */
  activeLabel: {
    type: String,
    default: null,
  },
  /**
   * Anzahl der Artikel pro Label-Name.
   * Beispiel: { rot: 2, grün: 5 }
   */
  counts: {
    type: Object,
    default: () => ({}),
  },
});

const emit = defineEmits(['update:activeLabel']);

/**
 * Filtert LABEL_COLORS auf Labels mit mindestens einem Artikel.
 * Labels ohne Artikel werden ausgeblendet, um die Leiste nicht zu überladen.
 */
const visibleLabels = computed(() => {
  return LABEL_COLORS.filter((c) => (props.counts[c.name] ?? 0) > 0);
});

/**
 * Gesamtanzahl der Artikel die ein Label haben (für "Alle"-Button Kontext).
 */
const totalLabeledCount = computed(() => {
  return Object.values(props.counts).reduce((sum, n) => sum + n, 0);
});

/**
 * Gibt zurück, ob mindestens ein Label verwendet wird (Bar anzeigen).
 */
const hasAnyLabels = computed(() => visibleLabels.value.length > 0);

function selectLabel(labelName) {
  if (props.activeLabel === labelName) {
    // Gleiches Label nochmal klicken → Filter aufheben
    emit('update:activeLabel', null);
  } else {
    emit('update:activeLabel', labelName);
  }
}

function clearFilter() {
  emit('update:activeLabel', null);
}
</script>

<template>
  <div v-if="hasAnyLabels" class="label-filter-bar" role="toolbar" aria-label="Label-Filter">
    <span class="label-filter-title">Label:</span>

    <!-- "Alle" Button -->
    <button
      class="label-filter-btn label-filter-all"
      :class="{ active: activeLabel === null }"
      @click="clearFilter"
      title="Alle Artikel anzeigen"
      aria-pressed="activeLabel === null"
    >
      Alle
      <span class="label-count">{{ totalLabeledCount }}</span>
    </button>

    <!-- Label-Schaltflächen -->
    <button
      v-for="color in visibleLabels"
      :key="color.name"
      class="label-filter-btn"
      :class="{ active: activeLabel === color.name }"
      :style="{
        '--label-color': getLabelColor(color.name),
        borderColor: activeLabel === color.name ? getLabelColor(color.name) : undefined,
        backgroundColor:
          activeLabel === color.name ? getLabelColor(color.name) + '22' : undefined,
      }"
      @click="selectLabel(color.name)"
      :title="`Nur ${color.label} anzeigen`"
      :aria-pressed="activeLabel === color.name"
    >
      <span
        class="label-dot-small"
        :style="{ background: getLabelColor(color.name) }"
      ></span>
      {{ color.label }}
      <span class="label-count">{{ counts[color.name] ?? 0 }}</span>
    </button>
  </div>
</template>

<style scoped>
.label-filter-bar {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  padding: 0.5rem 0;
  margin-bottom: 0.5rem;
}

.label-filter-title {
  font-size: 0.78rem;
  font-weight: 700;
  color: #718096;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: 0.2rem;
  flex-shrink: 0;
}

.label-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #4a5568;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s,
    box-shadow 0.15s;
  white-space: nowrap;
}

.label-filter-btn:hover {
  border-color: var(--label-color, #cbd5e0);
  background: #f7fafc;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.label-filter-btn.active {
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.label-filter-all {
  --label-color: #718096;
}

.label-filter-all.active {
  background: #edf2f7;
  border-color: #718096;
  color: #2d3748;
}

.label-dot-small {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.1);
}

.label-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: rgba(0, 0, 0, 0.07);
  border-radius: 9px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
}

.label-filter-btn.active .label-count {
  background: rgba(0, 0, 0, 0.12);
}

@media (max-width: 640px) {
  .label-filter-bar {
    gap: 0.3rem;
  }

  .label-filter-btn {
    padding: 0.25rem 0.55rem;
    font-size: 0.75rem;
  }
}
</style>
