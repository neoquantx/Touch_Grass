import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, Share } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { checkModelExists } from '../src/llm/modelDownload';
import { loadModel, generate, releaseModel } from '../src/llm/llm';
import { useStore } from '../src/store/useStore';
import { useRouter } from 'expo-router';
import { CONFIG } from '../src/config';
import { isVeryDark } from '../src/utils/photo';
import { getEventLogs, clearEventLogs } from '../src/utils/eventLog';

// UI Components
import { Screen } from '../src/components/ui/Screen';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { Notice } from '../src/components/ui/Notice';
import { Chip } from '../src/components/ui/Chip';
import { IconCircle } from '../src/components/ui/IconCircle';
import { colors, spacing, type, radius } from '../src/theme';

export default function DiagnosticsScreen() {
  const router = useRouter();

  const [modelExists, setModelExists] = useState(false);
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchResults, setBenchResults] = useState([]);
  const [errorText, setErrorText] = useState('');
  const [selectedThread, setSelectedThread] = useState(4);

  // Camera test state
  const cameraExif = useStore(s => s.cameraExif ?? true);
  const setCameraExif = useStore(s => s.setCameraExif);
  const [testingCamera, setTestingCamera] = useState(false);
  const [testPhotoResult, setTestPhotoResult] = useState(null);

  // Event log state
  const [eventLogs, setEventLogs] = useState([]);

  const refreshLogs = () => {
    setEventLogs(getEventLogs().slice(0, 80));
  };

  useEffect(() => {
    checkModelExists().then(setModelExists);
    refreshLogs();
    return () => {
      releaseModel();
    };
  }, []);

  const takeTestPhoto = async () => {
    try {
      setTestingCamera(true);
      setTestPhotoResult(null);
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== 'granted') {
        setTestPhotoResult({ error: 'Camera permission denied' });
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5,
        exif: cameraExif
      });
      if (res.canceled) {
        setTestPhotoResult({ canceled: true });
        return;
      }
      const asset = res.assets[0];
      const exif = asset.exif || {};
      const dark = isVeryDark(exif);
      const resultObj = {
        size: asset.fileSize,
        width: asset.width,
        height: asset.height,
        uri: asset.uri,
        exifKeys: Object.keys(exif),
        isVeryDark: dark
      };
      setTestPhotoResult(resultObj);
      useStore.getState().setLastPhotoInfo({
        size: asset.fileSize,
        width: asset.width,
        height: asset.height,
        exif,
        isVeryDark: dark
      });
    } catch (e) {
      setTestPhotoResult({ error: e.message });
    } finally {
      setTestingCamera(false);
      refreshLogs();
    }
  };

  const shareLogs = async () => {
    try {
      const logs = getEventLogs();
      const text = logs.map(e => `[${new Date(e.time).toISOString()}] [${e.tag}] ${e.message}${e.data ? ' ' + JSON.stringify(e.data) : ''}`).join('\n');
      await Share.share({ message: text || 'No logs recorded.', title: 'Touch Grass Event Log' });
    } catch (e) {
      console.warn('Share log error:', e);
    }
  };

  const clearLogs = () => {
    clearEventLogs();
    setEventLogs([]);
  };

  const runBenchmark = async () => {
    setBenchmarking(true);
    setBenchResults([]);
    setErrorText('');

    const threadsToTest = [2, 3, 4, 5, 6];
    const results = [];

    try {
      for (const t of threadsToTest) {
        await releaseModel();
        CONFIG.LLM.nThreads = t;

        const startLoad = Date.now();
        await loadModel();
        const loadMs = Date.now() - startLoad;

        const res = await generate({
          messages: [{ role: 'user', content: 'Count from 1 to 100.' }],
          maxTokens: 64
        });

        results.push({
          threads: t,
          loadMs,
          tps: res.tps.toFixed(2),
          tokens: res.tokenCount
        });

        setBenchResults([...results]);
      }
    } catch (e) {
      setErrorText('Benchmark failed: ' + String(e));
    } finally {
      setBenchmarking(false);
      CONFIG.LLM.nThreads = 4;
      releaseModel();
    }
  };

  const lastPhoto = useStore(s => s.lastPhotoInfo);

  return (
    <Screen scroll title="Diagnostics" subtitle="Hardware & inference benchmarks">
      <View style={styles.container}>

        {/* Back Link / Quick Navigation */}
        <View style={styles.navRow}>
          <Button
            size="small"
            variant="ghost"
            icon="arrow-back"
            label="Back to Setup"
            onPress={() => router.back()}
          />
        </View>

        {/* Camera Test Card */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <IconCircle name="camera" size={28} color={colors.primary} bgColor={colors.primarySoft} />
            <View style={{ flex: 1, marginLeft: spacing[12] }}>
              <Text style={type.h2}>Camera & EXIF Test</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>Hardware capture & brightness verification</Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={type.bodyBold}>EXIF Metadata</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                {cameraExif ? 'Capturing camera metadata' : 'Stripped metadata'}
              </Text>
            </View>
            <Button
              size="small"
              variant={cameraExif ? 'secondary' : 'primary'}
              label={cameraExif ? 'Disable' : 'Enable'}
              onPress={() => setCameraExif(!cameraExif)}
            />
          </View>

          <Button
            label={testingCamera ? 'Opening camera...' : 'Take test photo'}
            icon="camera-outline"
            onPress={takeTestPhoto}
            loading={testingCamera}
            style={{ marginTop: spacing[12] }}
          />

          {testPhotoResult && (
            <View style={styles.resultBox}>
              {testPhotoResult.canceled ? (
                <Text style={[type.caption, { color: colors.textMuted }]}>Photo capture canceled.</Text>
              ) : testPhotoResult.error ? (
                <Text style={[type.caption, { color: colors.danger }]}>Error: {testPhotoResult.error}</Text>
              ) : (
                <View>
                  <Text style={[type.captionBold, { color: colors.primary, marginBottom: spacing[6] }]}>CAPTURE RESULT</Text>
                  <Text style={[type.caption, styles.resultLine]}>Size: {testPhotoResult.size ? `${(testPhotoResult.size / 1024).toFixed(1)} KB` : 'Unknown'}</Text>
                  <Text style={[type.caption, styles.resultLine]}>Dimensions: {testPhotoResult.width} × {testPhotoResult.height} px</Text>
                  <Text style={[type.caption, styles.resultLine]}>Brightness Check: {testPhotoResult.isVeryDark ? 'Too Dark (Flagged)' : 'Adequate Light'}</Text>
                  <Text style={[type.caption, styles.resultLine]}>EXIF Keys: {testPhotoResult.exifKeys?.length > 0 ? testPhotoResult.exifKeys.join(', ') : 'none'}</Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* Event Log Panel */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <IconCircle name="document-text" size={28} color={colors.info} bgColor={colors.infoSoft} />
            <View style={{ flex: 1, marginLeft: spacing[12] }}>
              <Text style={type.h2}>Event Log ({eventLogs.length})</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>In-memory application event trail</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: spacing[8], marginBottom: spacing[12] }}>
            <Button size="small" variant="secondary" icon="share-outline" label="Share log" onPress={shareLogs} />
            <Button size="small" variant="ghost" icon="trash-outline" label="Clear" onPress={clearLogs} />
          </View>

          {eventLogs.length === 0 ? (
            <Text style={[type.caption, { color: colors.textMuted, fontStyle: 'italic', paddingVertical: spacing[8] }]}>
              No events logged yet.
            </Text>
          ) : (
            <View style={styles.logContainer}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 240 }}>
                {eventLogs.map((entry, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.logItem,
                      idx === eventLogs.length - 1 && { borderBottomWidth: 0 }
                    ]}
                  >
                    <View style={styles.logMetaRow}>
                      <Text style={[type.captionBold, { color: colors.textMuted, fontSize: 11 }]}>
                        {new Date(entry.time).toLocaleTimeString()}
                      </Text>
                      <Chip label={entry.tag} size="small" bgColor={colors.surfaceAlt} textColor={colors.text} />
                    </View>
                    <Text style={[type.body, { fontSize: 13, color: colors.text, marginTop: 2 }]}>{entry.message}</Text>
                    {entry.data && (
                      <Text style={[type.caption, { color: colors.textMuted, fontSize: 11, marginTop: 2 }]} numberOfLines={2}>
                        {JSON.stringify(entry.data)}
                      </Text>
                    )}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </Card>

        {/* Last Photo (EXIF Debug) */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <IconCircle name="image" size={28} color={colors.learn} bgColor={colors.learnSoft} />
            <View style={{ flex: 1, marginLeft: spacing[12] }}>
              <Text style={type.h2}>Last Photo EXIF</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>Inspection of most recent verification photo</Text>
            </View>
          </View>

          {lastPhoto ? (
            <View style={styles.exifTable}>
              <View style={styles.exifRow}>
                <Text style={[type.captionBold, { color: colors.textMuted }]}>FILE SIZE</Text>
                <Text style={type.bodyBold}>{lastPhoto.size ? `${(lastPhoto.size / 1024).toFixed(1)} KB` : 'N/A'}</Text>
              </View>
              <View style={styles.exifRow}>
                <Text style={[type.captionBold, { color: colors.textMuted }]}>RESOLUTION</Text>
                <Text style={type.bodyBold}>{lastPhoto.width} × {lastPhoto.height}</Text>
              </View>
              <View style={styles.exifRow}>
                <Text style={[type.captionBold, { color: colors.textMuted }]}>DARKNESS CHECK</Text>
                <Chip
                  label={lastPhoto.isVeryDark ? 'TOO DARK' : 'GOOD LIGHT'}
                  bgColor={lastPhoto.isVeryDark ? colors.dangerSoft : colors.successSoft}
                  textColor={lastPhoto.isVeryDark ? colors.danger : colors.success}
                  size="small"
                />
              </View>
              {lastPhoto.exif?.ISOSpeedRatings !== undefined && (
                <View style={styles.exifRow}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>ISO SPEED</Text>
                  <Text style={type.caption}>{lastPhoto.exif.ISOSpeedRatings}</Text>
                </View>
              )}
              {lastPhoto.exif?.ExposureTime !== undefined && (
                <View style={styles.exifRow}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>EXPOSURE TIME</Text>
                  <Text style={type.caption}>{lastPhoto.exif.ExposureTime}s</Text>
                </View>
              )}
              {lastPhoto.exif?.BrightnessValue !== undefined && (
                <View style={styles.exifRow}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>BRIGHTNESS VALUE</Text>
                  <Text style={type.caption}>{lastPhoto.exif.BrightnessValue}</Text>
                </View>
              )}
              {lastPhoto.exif?.DateTimeOriginal !== undefined && (
                <View style={[styles.exifRow, { borderBottomWidth: 0 }]}>
                  <Text style={[type.captionBold, { color: colors.textMuted }]}>DATE & TIME</Text>
                  <Text style={type.caption}>{lastPhoto.exif.DateTimeOriginal}</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={[type.body, { color: colors.textMuted, fontStyle: 'italic', paddingVertical: spacing[8] }]}>
              Take a photo first to view sensor metadata.
            </Text>
          )}
        </Card>

        {/* LLM Benchmark */}
        {!modelExists ? (
          <Card style={styles.card}>
            <Notice
              variant="warn"
              title="Model Missing"
              message="The AI model file has not been downloaded yet. Download it in Setup to run benchmarks."
            />
            <Button
              label="Go to Setup"
              icon="arrow-forward"
              onPress={() => router.push('/setup')}
              style={{ marginTop: spacing[12] }}
            />
          </Card>
        ) : (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <IconCircle name="speedometer" size={28} color={colors.primary} bgColor={colors.primarySoft} />
              <View style={{ flex: 1, marginLeft: spacing[12] }}>
                <Text style={type.h2}>LLM Benchmark</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  Optimal config: 4 threads (~37.8 tps on mobile)
                </Text>
              </View>
            </View>

            <Text style={[type.captionBold, { color: colors.textMuted, marginBottom: spacing[8] }]}>
              THREAD ALLOCATION
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing[8], marginBottom: spacing[16] }}>
              {[2, 3, 4, 5, 6].map(t => (
                <Button
                  key={t}
                  variant={CONFIG.LLM?.nThreads === t ? 'primary' : 'secondary'}
                  size="small"
                  label={`${t} T`}
                  onPress={() => {
                    CONFIG.LLM.nThreads = t;
                    setSelectedThread(t);
                  }}
                />
              ))}
            </View>

            <Button
              label={benchmarking ? "Benchmarking threads..." : "Run Multi-Thread Benchmark"}
              icon="play-outline"
              onPress={runBenchmark}
              disabled={benchmarking}
              loading={benchmarking}
            />

            {benchResults.length > 0 && (
              <View style={styles.benchmarkTable}>
                <View style={styles.benchHeaderRow}>
                  <Text style={[type.captionBold, { flex: 1, color: colors.textMuted }]}>THREADS</Text>
                  <Text style={[type.captionBold, { flex: 1, color: colors.textMuted }]}>LOAD (MS)</Text>
                  <Text style={[type.captionBold, { flex: 1, color: colors.textMuted, textAlign: 'right' }]}>TOKENS/SEC</Text>
                </View>
                {benchResults.map((r, i) => (
                  <View
                    key={i}
                    style={[
                      styles.benchDataRow,
                      r.threads === 4 && styles.benchHighlightRow
                    ]}
                  >
                    <Text style={[type.bodyBold, { flex: 1 }]}>{r.threads} threads</Text>
                    <Text style={[type.body, { flex: 1, color: colors.textMuted }]}>{r.loadMs} ms</Text>
                    <Text style={[type.bodyBold, { flex: 1, color: colors.success, textAlign: 'right' }]}>
                      {r.tps} tps
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Card>
        )}

        {errorText ? (
          <Notice variant="error" message={errorText} style={{ marginTop: spacing[12] }} />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing[16],
    paddingBottom: spacing[40],
  },
  navRow: {
    marginBottom: spacing[8],
  },
  card: {
    marginBottom: spacing[16],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[14],
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    padding: spacing[12],
    borderRadius: radius[8],
    marginBottom: spacing[4],
  },
  resultBox: {
    marginTop: spacing[12],
    backgroundColor: colors.surfaceAlt,
    padding: spacing[12],
    borderRadius: radius[8],
  },
  resultLine: {
    color: colors.text,
    marginBottom: 4,
  },
  logContainer: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius[8],
    padding: spacing[8],
  },
  logItem: {
    paddingVertical: spacing[8],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  logMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exifTable: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius[8],
    padding: spacing[12],
  },
  exifRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing[6],
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  benchmarkTable: {
    marginTop: spacing[16],
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius[8],
    padding: spacing[12],
  },
  benchHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingBottom: spacing[6],
    marginBottom: spacing[6],
  },
  benchDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[6],
  },
  benchHighlightRow: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius[4],
    paddingHorizontal: spacing[6],
  },
});
