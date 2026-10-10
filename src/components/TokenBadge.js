import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, type } from '../theme.js';
import { useStore } from '../store/useStore.js';
import { Button } from './ui/Button.js';
import { Notice } from './ui/Notice.js';

export function TokenBadge() {
  const tokens = useStore((state) => state.tokens);
  const ledger = useStore((state) => state.ledger) || [];
  const ledgerCarry = useStore((state) => state.ledgerCarry) || 0;
  const [modalOpen, setModalOpen] = useState(false);
  
  const earned = ledger.filter(l => l.amount > 0).reduce((sum, l) => sum + l.amount, 0);
  const spent = ledger.filter(l => l.amount < 0).reduce((sum, l) => sum + Math.abs(l.amount), 0);
  const net = earned - spent + ledgerCarry;
  const mismatch = net !== tokens;

  return (
    <>
      <TouchableOpacity onPress={() => setModalOpen(true)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.tokenBg, paddingHorizontal: spacing[12], paddingVertical: spacing[4], borderRadius: radius.pill }}>
          <Ionicons name="flash" size={16} color={colors.tokenText} style={{ marginRight: spacing[4] }} />
          <Text style={[type.label, { color: colors.tokenText }]}>{tokens.toLocaleString()}</Text>
        </View>
      </TouchableOpacity>
      
      <Modal visible={modalOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ padding: spacing[16], borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[type.h2, { color: colors.text }]}>Token History</Text>
            <TouchableOpacity onPress={() => setModalOpen(false)}>
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing[16] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[16] }}>
              <View>
                <Text style={[type.caption, { color: colors.textMuted }]}>Balance</Text>
                <Text style={[type.h2, { color: colors.text }]}>{tokens}</Text>
              </View>
              <View>
                <Text style={[type.caption, { color: colors.textMuted }]}>Earned Total</Text>
                <Text style={[type.h2, { color: colors.success }]}>+{earned}</Text>
              </View>
              <View>
                <Text style={[type.caption, { color: colors.textMuted }]}>Spent Total</Text>
                <Text style={[type.h2, { color: colors.danger }]}>-{spent}</Text>
              </View>
            </View>
            
            {mismatch && (
              <View style={{ marginBottom: spacing[16] }}>
                <Notice variant="error" text="Balance does not match history" />
              </View>
            )}
            
            <Text style={[type.label, { color: colors.textMuted, marginBottom: spacing[8] }]}>LEDGER</Text>
            {ledger.length === 0 ? (
              <Text style={[type.body, { color: colors.textMuted, fontStyle: 'italic' }]}>No history yet.</Text>
            ) : (
              ledger.map((entry, idx) => (
                <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[8], borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View style={{ flex: 1, paddingRight: spacing[8] }}>
                    <Text style={[type.body, { color: colors.text }]}>{entry.reason}</Text>
                    <Text style={[type.caption, { color: colors.textMuted }]}>{new Date(entry.time).toLocaleString()}</Text>
                  </View>
                  <Text style={[type.body, { color: entry.amount > 0 ? colors.success : colors.danger, fontWeight: 'bold' }]}>
                    {entry.amount > 0 ? '+' : ''}{entry.amount}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}
