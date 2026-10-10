import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore, selectIsSetupComplete, llmStore } from '../../src/store/useStore.js';
import { generate, stop, release } from '../../src/llm/llm.js';
import { runExclusive, cancelCurrentJob } from '../../src/llm/queue.js';
import { buildCompanionPrompt } from '../../src/llm/prompts.js';
import { planSpend } from '../../src/llm/accounting.js';

import { Screen } from '../../src/components/ui/Screen.js';
import { EmptyState } from '../../src/components/ui/EmptyState.js';
import { Notice } from '../../src/components/ui/Notice.js';
import { Button } from '../../src/components/ui/Button.js';
import { IconCircle } from '../../src/components/ui/IconCircle.js';
import { TokenBadge } from '../../src/components/TokenBadge.js';
import { colors, spacing, type, radius } from '../../src/theme.js';

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
    
    const sysPrompt = buildCompanionPrompt();
    
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
        const { tps } = await generate({
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

        
        if (tps > 0) setLastTps(tps);
        
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

  if (!isSetupComplete) {
    return (
      <Screen title="Companion" rightSlot={
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="create-outline" size={24} color={colors.primary} style={{ marginRight: 16 }} onPress={() => {
            if (messages.length > 0) {
              Alert.alert("New Chat", "Clear current conversation?", [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: () => setMessages([]) }
              ]);
            }
          }} />
          <TokenBadge />
        </View>
      }>
        <EmptyState 
          icon="settings" 
          title="Companion is offline" 
          body="Finish setup to chat with the AI." 
          action={{ label: 'Go to Setup', onPress: () => router.navigate('/setup') }}
        />
      </Screen>
    );
  }

  const isLocked = tokens <= 0;

  return (
    <Screen title="Companion" rightSlot={<TokenBadge />}>
      
      {isLocked ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState 
            icon="lock-closed" 
            title="Companion is locked" 
            body="Earn tokens by completing a mission outdoors. Every token the model writes costs 1 token." 
            action={{ label: "See today's missions", onPress: () => router.navigate('/') }}
          />
        </View>
      ) : (
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} 
          style={{ flex: 1 }}
          keyboardVerticalOffset={60}
        >
          {tokens > 0 && tokens < 100 && (
            <View style={{ paddingHorizontal: spacing[16], paddingBottom: spacing[8] }}>
              <Notice variant="warn" text="Low on tokens." />
            </View>
          )}
          
          
          {messages.length === 0 && (
            <View style={{ padding: spacing[16], gap: spacing[8] }}>
              <Button variant="secondary" label="What can I do outside today?" onPress={() => { handleSend("What can I do outside today?"); }} />
              <Button variant="secondary" label="Tell me about the places I visited today" onPress={() => { handleSend("Tell me about the places I visited today"); }} />
              <Button variant="secondary" label="Give me a short outdoor safety tip" onPress={() => { handleSend("Give me a short outdoor safety tip"); }} />
            </View>
          )}

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: spacing[16] }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              if (item.role === 'system') {
                return <View style={{ marginVertical: spacing[8] }}><Notice variant="warn" text={item.content} /></View>;
              }
              const isUser = item.role === 'user';
              
              return (
                <View style={{ marginBottom: spacing[12], alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <View style={{ 
                    backgroundColor: isUser ? colors.primary : colors.surface,
                    borderWidth: isUser ? 0 : 1,
                    borderColor: colors.border,
                    padding: spacing[12],
                    borderRadius: radius[16],
                  }}>
                    <Text style={[type.body, { color: isUser ? colors.onPrimary : colors.text }]}>
                      {item.content}
                    </Text>
                  </View>
                  {!isUser && item.tokensSpent !== undefined && (
                    <Text style={[type.caption, { color: colors.textMuted, marginTop: 4, marginLeft: 4 }]}>
                      -{item.tokensSpent} tokens
                    </Text>
                  )}
                </View>
              );

            }}
          />
          
          {errorMsg && (
            <View style={{ paddingHorizontal: spacing[16], marginBottom: spacing[8] }}>
              <Notice variant="error" text={`Error: ${errorMsg}`} action={{ label: 'Retry', onPress: () => setErrorMsg(null) }} />
            </View>
          )}

          <View style={{ padding: spacing[16], backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Message Companion..."
                maxLength={500}
                placeholderTextColor={colors.textMuted}
                multiline
                style={[type.body, { 
                  flex: 1, 
                  backgroundColor: colors.surfaceAlt, 
                  borderRadius: radius[24], 
                  paddingHorizontal: spacing[16], 
                  paddingTop: spacing[12],
                  paddingBottom: spacing[12],
                  minHeight: 48,
                  maxHeight: 120,
                  color: colors.text 
                }]}
              />
              {generating ? (
                <Button label="Stop" onPress={() => stop()} variant="danger" size="small" style={{ marginLeft: spacing[8] }} />
              ) : (
                <View style={{ marginLeft: spacing[8], width: 48, height: 48, borderRadius: 24, backgroundColor: inputText.trim() ? colors.primary : colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="arrow-up" size={24} color={inputText.trim() ? colors.onPrimary : colors.textMuted} onPress={handleSend} />
                </View>
              )}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[8], paddingHorizontal: spacing[4] }}>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                {llmState === 'loading' ? 'Waking the model...' : (waitingFirstToken ? 'Thinking...' : 'Runs on this phone.')}
              </Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                {lastTps ? `${lastTps.toFixed(1)} tps • ` : ''}{tokens} remaining
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  );
}
