import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, Modal, TextInput, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore, selectIsSetupComplete } from '../../src/store/useStore.js';
import { Screen } from '../../src/components/ui/Screen.js';
import { Card } from '../../src/components/ui/Card.js';
import { Chip } from '../../src/components/ui/Chip.js';
import { Button } from '../../src/components/ui/Button.js';
import { EmptyState } from '../../src/components/ui/EmptyState.js';
import { ProofModal } from '../../src/components/ProofModal.js';
import { colors, spacing, type, radius, shadows } from '../../src/theme.js';
import { formatDateDisplay } from '../../src/utils/date.js';

const CATEGORY_FILTERS = [
  { key: 'ALL', label: 'All Discoveries', icon: 'compass' },
  { key: 'NATURE', label: '🌿 Nature & Parks', icon: 'leaf' },
  { key: 'HISTORY', label: '🏛️ Historic & Culture', icon: 'library' },
  { key: 'SCAVENGER', label: '🌸 Flora & Scavenger', icon: 'camera' }
];

export default function JournalTab() {
  const router = useRouter();
  const hasHydrated = useStore((state) => state.hasHydrated);
  const isSetupComplete = useStore(selectIsSetupComplete);

  const rawJournal = useStore((state) => state.journal) || [];
  const days = useStore((state) => state.days) || {};
  const updateJournalNote = useStore((state) => state.updateJournalNote);
  const deleteJournalEntry = useStore((state) => state.deleteJournalEntry);

  const [activeFilter, setActiveFilter] = useState('ALL');
  const [selectedProof, setSelectedProof] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [noteText, setNoteText] = useState('');

  // Merge explicit journal items with completed missions from days to guarantee no historical data is lost
  const journalEntries = useMemo(() => {
    const map = new Map();

    // 1. First add all explicit journal items
    for (const item of rawJournal) {
      if (item && item.id) {
        map.set(item.missionId || item.id, item);
      }
    }

    // 2. Synthesize entries for any completed missions in days that don't have a journal item yet
    for (const [dateStr, day] of Object.entries(days)) {
      for (const m of (day.missions || [])) {
        if (!map.has(m.id)) {
          map.set(m.id, {
            id: `legacy_${m.id}`,
            missionId: m.id,
            type: m.type,
            title: m.title || 'Outdoor Discovery',
            category: m.category || (m.type === 'LOOK' ? 'scavenger' : 'park'),
            date: dateStr,
            completedAt: m.completedAt || Date.now(),
            photoUri: m.proofUri || m.photoUri || null,
            lat: m.lat ?? null,
            lon: m.lon ?? null,
            fact: m.fact || null,
            factSource: m.factSource || null,
            note: m.note || ''
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  }, [rawJournal, days]);

  const filteredEntries = useMemo(() => {
    if (activeFilter === 'ALL') return journalEntries;
    if (activeFilter === 'NATURE') {
      return journalEntries.filter(e => {
        const cat = (e.category || '').toLowerCase();
        return cat === 'park' || cat === 'tree' || cat === 'garden' || cat === 'forest' || cat === 'wood';
      });
    }
    if (activeFilter === 'HISTORY') {
      return journalEntries.filter(e => {
        const cat = (e.category || '').toLowerCase();
        return cat === 'historic' || cat === 'monument' || e.type === 'LEARN';
      });
    }
    if (activeFilter === 'SCAVENGER') {
      return journalEntries.filter(e => e.type === 'LOOK' || e.category === 'scavenger');
    }
    return journalEntries;
  }, [journalEntries, activeFilter]);

  if (!hasHydrated) return null;

  const openNoteEditor = (entry) => {
    setEditingEntry(entry);
    setNoteText(entry.note || '');
  };

  const saveNote = () => {
    if (editingEntry) {
      updateJournalNote(editingEntry.id, noteText.trim(), editingEntry);
      setEditingEntry(null);
      setNoteText('');
    }
  };

  const headerRight = (
    <View style={styles.entryCountBadge}>
      <Ionicons name="book" size={13} color={colors.primary} style={{ marginRight: 4 }} />
      <Text style={[type.captionBold, { color: colors.primary, fontSize: 11 }]}>
        {journalEntries.length} {journalEntries.length === 1 ? 'Discovery' : 'Discoveries'}
      </Text>
    </View>
  );

  return (
    <Screen title="Field Journal" subtitle="Explorer's nature scrapbook" rightSlot={headerRight} scroll={false}>
      {!isSetupComplete ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing[16] }}>
          <EmptyState
            icon="settings-outline"
            title="Setup Required"
            body="Finish setting up your area and model to start discovering places and logging field entries."
            action={{ label: "Go to Setup", onPress: () => router.navigate('/(tabs)/setup') }}
          />
        </View>
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing[16], paddingBottom: spacing[24] }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing[16] }}>
              {/* Filter Chips Bar */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing[8], paddingVertical: 4 }}>
                {CATEGORY_FILTERS.map(f => {
                  const isSelected = f.key === activeFilter;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      activeOpacity={0.75}
                      onPress={() => setActiveFilter(f.key)}
                      style={[
                        styles.filterChip,
                        isSelected && styles.filterChipSelected
                      ]}
                    >
                      <Text style={[
                        type.captionBold,
                        { color: isSelected ? colors.primary : colors.textSecondary, fontSize: 12 }
                      ]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <View style={{ paddingTop: spacing[32] }}>
              <EmptyState
                icon="book-outline"
                title={activeFilter === 'ALL' ? "Your Journal is Empty" : "No entries in this category"}
                body={activeFilter === 'ALL'
                  ? "Every time you complete an outdoor mission, touch grass, and verify proof, it will be immortalized here in your Field Scrapbook."
                  : "Try selecting 'All Discoveries' to view your other outdoor journal entries."}
                action={activeFilter === 'ALL' ? { label: "Go to Today's Missions", onPress: () => router.navigate('/(tabs)') } : undefined}
              />
            </View>
          }
          renderItem={({ item }) => {
            const timeStr = item.completedAt
              ? new Date(item.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '';
            const dateStr = item.date ? formatDateDisplay(item.date) : '';

            let categoryColor = colors.go;
            let categoryBg = colors.goSoft;
            let categoryLabel = 'PARK';

            if (item.type === 'LOOK') {
              categoryColor = colors.look;
              categoryBg = colors.lookSoft;
              categoryLabel = 'SCAVENGER';
            } else if (item.type === 'LEARN' || item.category === 'historic') {
              categoryColor = colors.learn;
              categoryBg = colors.learnSoft;
              categoryLabel = 'HISTORIC';
            } else if (item.category === 'tree') {
              categoryColor = colors.primary;
              categoryBg = colors.primarySoft;
              categoryLabel = 'TREE';
            }

            return (
              <Card style={{ marginBottom: spacing[16] }} variant="elevated">
                {/* Header Row: Category Pill & Date */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[10] }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[6] }}>
                    <Chip label={categoryLabel} bgColor={categoryBg} textColor={categoryColor} size="small" />
                    <Chip label={item.type || 'MISSION'} bgColor={colors.surfaceAlt} textColor={colors.textSecondary} size="small" />
                  </View>
                  <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>
                    {dateStr} {timeStr ? `• ${timeStr}` : ''}
                  </Text>
                </View>

                {/* Photo Proof Thumbnail with tap to view */}
                {item.photoUri ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setSelectedProof(item)}
                    style={styles.photoContainer}
                  >
                    <Image source={{ uri: item.photoUri }} style={styles.entryPhoto} resizeMode="cover" />
                    <View style={styles.expandPill}>
                      <Ionicons name="expand" size={12} color="#FFF" style={{ marginRight: 4 }} />
                      <Text style={[type.captionBold, { color: '#FFF', fontSize: 10 }]}>View Proof</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="image-outline" size={32} color={colors.textSubtle} />
                    <Text style={[type.caption, { color: colors.textMuted, marginTop: 4 }]}>Physical check-in proof</Text>
                  </View>
                )}

                {/* Title & Coordinates */}
                <View style={{ marginTop: spacing[12], marginBottom: spacing[8] }}>
                  <Text style={[type.h2, { color: colors.text, fontSize: 18 }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {item.lat !== null && item.lon !== null && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Ionicons name="location-outline" size={12} color={colors.textMuted} style={{ marginRight: 3 }} />
                      <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>
                        {Number(item.lat).toFixed(4)}°, {Number(item.lon).toFixed(4)}°
                      </Text>
                    </View>
                  )}
                </View>

                {/* Grounded Fact / Nature Information Box */}
                {item.fact ? (
                  <View style={styles.factBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Ionicons name="bulb-outline" size={14} color={colors.learn} style={{ marginRight: 4 }} />
                      <Text style={[type.captionBold, { color: colors.learn, fontSize: 11 }]}>
                        {item.factSource === 'ai' ? 'ON-DEVICE AI FIELD NOTE' : 'MAP FACTS'}
                      </Text>
                    </View>
                    <Text style={[type.body, { color: colors.text, fontSize: 13, lineHeight: 19 }]}>
                      {item.fact}
                    </Text>
                  </View>
                ) : null}

                {/* User Personal Observation / Field Note */}
                <View style={styles.noteSection}>
                  {item.note ? (
                    <View style={styles.noteContentBox}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="pencil" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                          <Text style={[type.captionBold, { color: colors.primary, fontSize: 11 }]}>PERSONAL NOTE</Text>
                        </View>
                        <TouchableOpacity onPress={() => openNoteEditor(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={[type.captionBold, { color: colors.primaryLight, fontSize: 11 }]}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={[type.body, { color: colors.textSecondary, fontStyle: 'italic', fontSize: 13, lineHeight: 18 }]}>
                        "{item.note}"
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => openNoteEditor(item)}
                      style={styles.addNoteBtn}
                    >
                      <Ionicons name="create-outline" size={14} color={colors.textMuted} style={{ marginRight: 6 }} />
                      <Text style={[type.captionBold, { color: colors.textMuted, fontSize: 12 }]}>
                        Add field observation note...
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Note Editor Modal */}
      <Modal
        visible={!!editingEntry}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingEntry(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[8] }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="journal-outline" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[type.h2, { fontSize: 17, color: colors.text }]}>Field Observation</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingEntry(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[type.caption, { color: colors.textMuted, marginBottom: spacing[12] }]}>
              {editingEntry?.title}
            </Text>

            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Record your thoughts, weather, wildlife sightings, or mood..."
              placeholderTextColor={colors.textSubtle}
              multiline
              maxLength={300}
              autoFocus
              style={styles.noteInput}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[10], marginTop: spacing[14] }}>
              <Button
                variant="secondary"
                size="small"
                label="Cancel"
                onPress={() => setEditingEntry(null)}
              />
              <Button
                size="small"
                label="Save Note"
                icon={<Ionicons name="checkmark" size={15} color={colors.onPrimary} />}
                onPress={saveNote}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Proof Fullscreen Viewer Modal */}
      <ProofModal
        visible={!!selectedProof}
        mission={selectedProof}
        onClose={() => setSelectedProof(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  entryCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing[10],
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder
  },
  filterChip: {
    paddingHorizontal: spacing[12],
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    ...shadows.subtle
  },
  filterChipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  photoContainer: {
    width: '100%',
    height: 180,
    borderRadius: radius[12],
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.surfaceAlt
  },
  entryPhoto: {
    width: '100%',
    height: '100%'
  },
  expandPill: {
    position: 'absolute',
    bottom: spacing[8],
    right: spacing[8],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: spacing[8],
    paddingVertical: 4,
    borderRadius: radius.pill
  },
  photoPlaceholder: {
    width: '100%',
    height: 100,
    borderRadius: radius[12],
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border
  },
  factBox: {
    backgroundColor: colors.learnSoft,
    padding: spacing[10],
    borderRadius: radius[10],
    marginTop: spacing[6],
    marginBottom: spacing[8],
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  noteSection: {
    marginTop: spacing[8]
  },
  noteContentBox: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing[10],
    borderRadius: radius[10],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary
  },
  addNoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[10],
    borderRadius: radius[8],
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[20]
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius[16],
    padding: spacing[16],
    ...shadows.elevated
  },
  noteInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius[10],
    padding: spacing[12],
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.borderSubtle
  }
});
