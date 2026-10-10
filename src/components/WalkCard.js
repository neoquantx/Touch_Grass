import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Card } from './ui/Card.js';
import { Button } from './ui/Button.js';
import { Notice } from './ui/Notice.js';
import { colors, spacing, type } from '../theme.js';
import { useStore } from '../store/useStore.js';
import { startWalk, stopWalk, subscribeWalk } from '../progress/walkController.js';
import { CONFIG } from '../config.js';

export function WalkCard() {
  const walk = useStore(state => state.walk);
  const [liveData, setLiveData] = useState({ distanceM: 0, seconds: 0, accuracyWarn: false });
  const [summary, setSummary] = useState(null);
  
  useEffect(() => {
    return subscribeWalk(setLiveData);
  }, []);
  
  const handleStart = async () => {
    setSummary(null);
    await startWalk();
  };
  
  const handleStop = async () => {
    await stopWalk();
    setSummary({
      distance: liveData.distanceM,
      duration: liveData.seconds,
      steps: Math.round(liveData.distanceM / CONFIG.WALK.strideM)
    });
  };
  
  if (summary && !walk?.active) {
    return (
      <Card style={{ marginBottom: spacing[16] }}>
        <Text style={[type.h2, { marginBottom: spacing[8] }]}>Walk Summary</Text>
        <Text style={[type.body, { marginBottom: spacing[4] }]}>Distance: {Math.round(summary.distance)} m</Text>
        <Text style={[type.body, { marginBottom: spacing[4] }]}>Duration: {Math.round(summary.duration / 60)} min</Text>
        <Text style={[type.body, { marginBottom: spacing[12] }]}>Estimated steps: {summary.steps}</Text>
        <Button label="Done" onPress={() => setSummary(null)} />
      </Card>
    );
  }
  
  if (walk && walk.active) {
    const pace = liveData.distanceM > 0 ? (liveData.seconds / 60) / (liveData.distanceM / 1000) : 0;
    return (
      <Card style={{ marginBottom: spacing[16], borderColor: colors.primary, borderWidth: 2 }}>
        <Text style={[type.h2, { marginBottom: spacing[8] }]}>Walking...</Text>
        {liveData.accuracyWarn && <Notice variant="warn" text="Poor GPS accuracy" />}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[12] }}>
          <View>
            <Text style={[type.h1, { color: colors.primary }]}>{Math.round(liveData.distanceM)} m</Text>
            <Text style={type.caption}>Distance</Text>
          </View>
          <View>
            <Text style={[type.h1, { color: colors.text }]}>{Math.round(liveData.seconds / 60)} min</Text>
            <Text style={type.caption}>Time</Text>
          </View>
          <View>
            <Text style={[type.h1, { color: colors.text }]}>{pace > 0 ? Math.round(pace) : '--'}</Text>
            <Text style={type.caption}>min/km</Text>
          </View>
        </View>
        <Button variant="danger" label="Stop Walk" onPress={handleStop} />
      </Card>
    );
  }
  
  return (
    <Card style={{ marginBottom: spacing[16] }}>
      <Text style={[type.h2, { marginBottom: spacing[8] }]}>Start a Walk</Text>
      <Text style={[type.body, { color: colors.textMuted, marginBottom: spacing[12] }]}>
        Counts distance for tokens. The screen stays on while walking. Keep an eye on traffic.
      </Text>
      <Button label="Start Walk" onPress={handleStart} />
    </Card>
  );
}
