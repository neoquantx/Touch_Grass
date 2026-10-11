import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, FlatList, ScrollView, KeyboardAvoidingView, Platform, Alert, TouchableOpacity, StyleSheet, Animated, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore, selectIsSetupComplete, llmStore } from '../../src/store/useStore.js';
import { generate, stop, release } from '../../src/llm/llm.js';
import { runExclusive, cancelCurrentJob } from '../../src/llm/queue.js';
import { buildCompanionPrompt, PERSONAS, QUICK_PROMPTS } from '../../src/llm/prompts.js';
import { planSpend } from '../../src/llm/accounting.js';
import { logEvent } from '../../src/utils/eventLog.js';

import { Screen } from '../../src/components/ui/Screen.js';
import { EmptyState } from '../../src/components/ui/EmptyState.js';
import { Notice } from '../../src/components/ui/Notice.js';
import { Button } from '../../src/components/ui/Button.js';
import { Card } from '../../src/components/ui/Card.js';
import { IconCircle } from '../../src/components/ui/IconCircle.js';
import { TokenBadge } from '../../src/components/TokenBadge.js';
import { colors, spacing, type, radius, shadows } from '../../src/theme.js';

export default function CompanionTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isSetupComplete = useStore(selectIsSetupComplete);
  const tokens = useStore((state) => state.tokens);
  const spendTokens = useStore((state) => state.spendTokens);
  const lastTps = useStore((state) => state.lastTps);
  const setLastTps = useStore((state) => state.setLastTps);
  const missions = useStore((state) => state.missions);
  const llmState = useStore((state) => state.llmState);
  const companionPersona = useStore((state) => state.companionPersona || 'nature');
  const setCompanionPersona = useStore((state) => state.setCompanionPersona);
  
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [waitingFirstToken, setWaitingFirstToken] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  
  const listRef = useRef(null);

  useFocusEffect(
    useCallback(() => {
      return () => {
        stop();
        cancelCurrentJob();
      };
    }, [])
  );

  const handleSend = async (textOverride) => {
    const txt = (typeof textOverride === 'string' ? textOverride : inputText).trim();
    if (!txt || generating || tokens <= 0) return;
    
    const userMsg = { id: Date.now().toString(), role: 'user', content: txt };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setErrorMsg(null);
    setGenerating(true);
    setWaitingFirstToken(true);
    
    const sysPrompt = buildCompanionPrompt(companionPersona);
    
    const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
    const llmMessages = [{ role: 'system', content: sysPrompt }, ...history, { role: 'user', content: userMsg.content }];
    
    const astId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: astId, role: 'assistant', content: '' }]);

    let generated = 0;
    let alreadySpent = 0;
    let outOfTokens = false;
    const initialBalance = useStore.getState().tokens;
    
    try {
      await runExclusive(async (flag) => {
        const genResult = await generate({
          messages: llmMessages,
          maxTokens: 200,
          onToken: (token) => {
            setWaitingFirstToken(false);
            setMessages(prev => {
              const newMsgs = [...prev];
              const last = newMsgs[newMsgs.length - 1];
              last.content += token;
              return newMsgs;
            });
            
            generated++;
            const { spendNow, stop } = planSpend({ generated, alreadySpent, balance: initialBalance, chunk: 20 });
            if (spendNow > 0) {
              useStore.getState().spendTokens(spendNow);
              alreadySpent += spendNow;
            }
          },
          shouldStop: () => {
            flag.check();
            const { stop } = planSpend({ generated, alreadySpent, balance: initialBalance, chunk: 20 });
            if (stop) {
              outOfTokens = true;
              return true;
            }
            return false;
          }
        });
        
        const { spendNow } = planSpend({ generated, alreadySpent, balance: initialBalance, chunk: 'flush' });
        if (spendNow > 0) {
          useStore.getState().spendTokens(spendNow);
          alreadySpent += spendNow;
        }
        
        if (alreadySpent > 0) {
          useStore.getState().addLedgerEntry(-alreadySpent, `-${alreadySpent} Companion reply`);
          setMessages(prev => {
              const newMsgs = [...prev];
              const last = newMsgs[newMsgs.length - 1];
              last.tokensSpent = alreadySpent;
              return newMsgs;
          });
        }

        const replyTps = genResult?.tps || 0;
        const pps = genResult?.predicted_per_second ?? replyTps;
        logEvent('companion', 'reply completed', {
          tokenCount: generated,
          predicted_per_second: pps
        });
        
        if (replyTps > 0) setLastTps(replyTps);
        
        if (outOfTokens) {
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: 'Out of tokens. Complete another mission to continue.' }]);
        }
      });
    } catch (e) {
      if (e.message !== 'Aborted') {
        setErrorMsg(e.message || 'Generation failed');
      }
    } finally {
      setGenerating(false);
      setWaitingFirstToken(false);
    }
  };

  const clearChatConfirm = () => {
    if (messages.length > 0) {
      Alert.alert('New Conversation', 'Clear the current conversation?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setMessages([]) }
      ]);
    }
  };

  const headerRight = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {messages.length > 0 && (
        <TouchableOpacity
          onPress={clearChatConfirm}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerIconBtn}
          accessibilityLabel="Clear chat"
          accessibilityRole="button"
        >
          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
      <TokenBadge />
    </View>
  );

  if (!isSetupComplete) {
    return (
      <Screen title="Companion" subtitle="Offline on-device AI" rightSlot={headerRight}>
        <EmptyState 
          icon="settings-outline" 
          title="Companion is offline" 
          body="Finish setup by downloading the local model and map data to chat with the AI." 
          action={{ label: 'Go to Setup', onPress: () => router.navigate('/setup') }}
        />
      </Screen>
    );
  }

  const isLocked = tokens <= 0;

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.welcomeHero}>
        <View style={styles.heroIconBox}>
          <Ionicons name="sparkles" size={24} color={colors.primary} />
        </View>
        <Text style={[type.h2, { color: colors.text, marginTop: spacing[10] }]}>
          Your Outdoor Companion
        </Text>
        <Text style={[type.body, { color: colors.textMuted, textAlign: 'center', fontSize: 14, marginTop: 4, maxWidth: 300 }]}>
          Runs 100% on this phone with no server or internet. Ask about your daily missions, nature, safety, or places you visited.
        </Text>
      </View>

      <Text style={[type.label, { color: colors.textSecondary, marginBottom: spacing[10], paddingHorizontal: 4 }]}>
        SUGGESTED QUESTIONS
      </Text>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleSend("What are my missions today?")}
        style={styles.promptCard}
      >
        <View style={[styles.promptIconBox, { backgroundColor: colors.goSoft }]}>
          <Ionicons name="compass-outline" size={18} color={colors.primary} />
        </View>
        <Text style={[type.bodyBold, styles.promptText]}>
          What are my missions today?
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleSend("What can I do outside today?")}
        style={styles.promptCard}
      >
        <View style={[styles.promptIconBox, { backgroundColor: colors.tokenBg }]}>
          <Ionicons name="sunny-outline" size={18} color={colors.tokenText} />
        </View>
        <Text style={[type.bodyBold, styles.promptText]}>
          What can I do outside today?
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleSend("Tell me about the places I visited today")}
        style={styles.promptCard}
      >
        <View style={[styles.promptIconBox, { backgroundColor: colors.lookSoft }]}>
          <Ionicons name="trail-sign-outline" size={18} color={colors.look} />
        </View>
        <Text style={[type.bodyBold, styles.promptText]}>
          Tell me about the places I visited today
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleSend("Give me a short outdoor safety tip")}
        style={styles.promptCard}
      >
        <View style={[styles.promptIconBox, { backgroundColor: colors.goSoft }]}>
          <Ionicons name="shield-checkmark-outline" size={18} color={colors.go} />
        </View>
        <Text style={[type.bodyBold, styles.promptText]}>
          Give me a short outdoor safety tip
        </Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textSubtle} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Screen title="Companion" subtitle="Offline on-device AI" rightSlot={headerRight} style={{ paddingBottom: 0 }}>
      {isLocked ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState 
            icon="lock-closed" 
            title="Companion is locked" 
            body="Earn tokens by completing outdoor missions. Every token the model generates costs 1 token." 
            action={{ label: "See today's missions", onPress: () => router.navigate('/') }}
          />
        </View>
      ) : (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          {tokens > 0 && tokens < 100 && (
            <View style={{ paddingHorizontal: spacing[16], paddingBottom: spacing[8] }}>
              <Notice variant="warn" text={`Low on tokens (${tokens} left). Complete missions to earn more.`} />
            </View>
          )}

          {/* Persona Switcher Bar */}
          <View style={{ backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, paddingVertical: spacing[8] }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing[16], gap: spacing[8] }}>
              {Object.values(PERSONAS).map(p => {
                const isSelected = p.id === companionPersona;
                return (
                  <TouchableOpacity
                    key={p.id}
                    onPress={() => setCompanionPersona(p.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing[10],
                      paddingVertical: 5,
                      borderRadius: radius.pill,
                      backgroundColor: isSelected ? colors.primarySoft : colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.primary : colors.borderSubtle
                    }}
                  >
                    <Text style={{ fontSize: 13, marginRight: 4 }}>{p.badge}</Text>
                    <Text style={[type.captionBold, { color: isSelected ? colors.primary : colors.textSecondary }]}>
                      {p.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <View style={{ paddingHorizontal: spacing[16], marginTop: 4 }}>
              <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>
                {PERSONAS[companionPersona]?.tagline}
              </Text>
            </View>
          </View>

          {/* Conversation List with Empty State */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            ListEmptyComponent={renderEmptyState}
            contentContainerStyle={[
              styles.listContent,
              messages.length === 0 && styles.emptyListContent
            ]}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                listRef.current?.scrollToEnd({ animated: true });
              }
            }}
            onLayout={() => {
              if (messages.length > 0) {
                listRef.current?.scrollToEnd({ animated: true });
              }
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              if (item.role === 'system') {
                return (
                  <View style={{ marginVertical: spacing[8] }}>
                    <Notice variant="warn" text={item.content} />
                  </View>
                );
              }
              const isUser = item.role === 'user';
              
              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser ? styles.userRow : styles.assistantRow
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isUser ? styles.userBubble : styles.assistantBubble
                    ]}
                  >
                    {!isUser && !item.content && waitingFirstToken ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
                        <Ionicons name="ellipsis-horizontal" size={18} color={colors.textMuted} />
                        <Text style={[type.caption, { color: colors.textMuted, marginLeft: 6 }]}>Thinking...</Text>
                      </View>
                    ) : (
                      <Text
                        style={[
                          type.body,
                          {
                            color: isUser ? colors.onPrimary : colors.text,
                            lineHeight: 22
                          }
                        ]}
                      >
                        {item.content}
                      </Text>
                    )}
                  </View>

                  {!isUser && item.tokensSpent !== undefined && (
                    <View style={styles.tokenSpendTag}>
                      <Ionicons name="flash" size={10} color={colors.tokenText} style={{ marginRight: 3 }} />
                      <Text style={[type.caption, { color: colors.tokenText, fontSize: 11 }]}>
                        -{item.tokensSpent} tokens
                      </Text>
                    </View>
                  )}
                </View>
              );
            }}
          />
          
          {errorMsg && (
            <View style={{ paddingHorizontal: spacing[16], marginBottom: spacing[8] }}>
              <Notice variant="error" text={`Error: ${errorMsg}`} action={{ label: 'Dismiss', onPress: () => setErrorMsg(null) }} />
            </View>
          )}

          {/* Quick Prompts Bar */}
          {!generating && tokens > 0 && (
            <View style={{ paddingVertical: spacing[6], backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.borderSubtle }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing[12], gap: spacing[8] }}>
                {QUICK_PROMPTS.map((qp, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => handleSend(qp)}
                    activeOpacity={0.7}
                    style={{
                      backgroundColor: colors.surfaceAlt,
                      paddingHorizontal: spacing[10],
                      paddingVertical: 5,
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: colors.border
                    }}
                  >
                    <Text style={[type.captionBold, { color: colors.textSecondary, fontSize: 12 }]}>
                      {qp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bottom Input Area */}
          <View style={styles.inputBar}>
            <View style={styles.inputContainer}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message Companion..."
                maxLength={500}
                placeholderTextColor={colors.textSubtle}
                multiline
                onFocus={() => {
                  if (messages.length > 0) {
                    setTimeout(() => {
                      listRef.current?.scrollToEnd({ animated: true });
                    }, 120);
                  }
                }}
                style={[
                  type.body,
                  styles.textInput
                ]}
              />
              {generating ? (
                <TouchableOpacity
                  onPress={() => stop()}
                  style={styles.stopBtn}
                  accessibilityLabel="Stop generation"
                  accessibilityRole="button"
                >
                  <Ionicons name="stop" size={16} color={colors.onPrimary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => handleSend()}
                  disabled={!inputText.trim()}
                  style={[
                    styles.sendBtn,
                    {
                      backgroundColor: inputText.trim() ? colors.primary : colors.surfaceAlt,
                      opacity: inputText.trim() ? 1 : 0.6
                    }
                  ]}
                  accessibilityLabel="Send message"
                  accessibilityRole="button"
                >
                  <Ionicons
                    name="arrow-up"
                    size={20}
                    color={inputText.trim() ? colors.onPrimary : colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Model Status Footnote */}
            <View style={styles.footerRow}>
              <Text style={[type.caption, { color: colors.textMuted, fontSize: 11 }]}>
                {llmState === 'loading'
                  ? 'Waking local model...'
                  : (waitingFirstToken ? 'Synthesizing response...' : 'Runs 100% on this phone')}
              </Text>
              <Text style={[type.captionBold, { color: colors.textMuted, fontSize: 11 }]}>
                {(lastTps != null ? `${lastTps.toFixed(1)} tps • ` : '')}{tokens} tokens
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[10]
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: spacing[20]
  },
  emptyContainer: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[12]
  },
  welcomeHero: {
    alignItems: 'center',
    marginBottom: spacing[24]
  },
  heroIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center'
  },
  promptCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing[14],
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing[8],
    ...shadows.subtle
  },
  promptIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[12]
  },
  promptText: {
    flex: 1,
    color: colors.text,
    fontSize: 14
  },
  listContent: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[8],
    paddingBottom: spacing[16]
  },
  messageRow: {
    marginBottom: spacing[14],
    maxWidth: '85%'
  },
  userRow: {
    alignSelf: 'flex-end'
  },
  assistantRow: {
    alignSelf: 'flex-start'
  },
  messageBubble: {
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[16],
    borderRadius: radius[20]
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
    ...shadows.subtle
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderBottomLeftRadius: 4,
    ...shadows.card
  },
  tokenSpendTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginLeft: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.tokenBg,
    paddingHorizontal: spacing[6],
    paddingVertical: 1,
    borderRadius: radius.pill
  },
  inputBar: {
    paddingHorizontal: spacing[16],
    paddingTop: spacing[10],
    paddingBottom: spacing[14],
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    ...shadows.floating
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius[24],
    paddingLeft: spacing[16],
    paddingRight: spacing[6],
    paddingVertical: spacing[4],
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  textInput: {
    flex: 1,
    color: colors.text,
    minHeight: 40,
    maxHeight: 110,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 15
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[6]
  },
  stopBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing[6]
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[8],
    paddingHorizontal: spacing[4]
  }
});
