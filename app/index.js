import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { checkModelExists, downloadModel } from '../src/llm/modelDownload';
import { loadModel, generateSentence, releaseModel } from '../src/llm/llm';

export default function Phase0Test() {
  const [modelExists, setModelExists] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [speed, setSpeed] = useState('');

  useEffect(() => {
    checkModelExists().then(setModelExists);
    return () => {
      releaseModel();
    };
  }, []);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadModel((p) => setProgress(p));
      setModelExists(true);
    } catch (e) {
      console.error(e);
      alert('Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLoad = async () => {
    try {
      setIsLoading(true);
      await loadModel();
      setIsLoaded(true);
    } catch (e) {
      console.error(e);
      alert('Load failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      setGeneratedText('');
      setSpeed('');
      
      const startTime = Date.now();
      const result = await generateSentence('Write a single sentence about going outside and touching grass.', (token) => {
        setGeneratedText((prev) => prev + token);
      });
      const endTime = Date.now();
      
      if (result.timings) {
        const tokensPerSec = (1000 / result.timings.prompt_per_token_ms).toFixed(2);
        const evalPerSec = (1000 / result.timings.eval_per_token_ms).toFixed(2);
        setSpeed(`Speed: ${evalPerSec} t/s (Eval), ${tokensPerSec} t/s (Prompt)`);
      } else {
        const timeSec = (endTime - startTime) / 1000;
        // fallback calculation if timings is not there (llama.rn should return it though)
        setSpeed(`Completed in ${timeSec.toFixed(2)}s`);
      }
    } catch (e) {
      console.error(e);
      alert('Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Grasslock Phase 0 Test</Text>
      
      <View style={styles.section}>
        <Text>Model on disk: {modelExists ? 'Yes' : 'No'}</Text>
        {!modelExists && (
          <Button 
            title={isDownloading ? `Downloading... ${(progress * 100).toFixed(1)}%` : "Download Model (300MB+)"} 
            onPress={handleDownload}
            disabled={isDownloading} 
          />
        )}
      </View>

      <View style={styles.section}>
        <Text>Model loaded: {isLoaded ? 'Yes' : 'No'}</Text>
        {modelExists && !isLoaded && (
          <Button 
            title={isLoading ? "Loading..." : "Load Model"} 
            onPress={handleLoad}
            disabled={isLoading} 
          />
        )}
        {isLoading && <ActivityIndicator size="small" />}
      </View>

      <View style={styles.section}>
        <Button 
          title="Generate One Sentence" 
          onPress={handleGenerate} 
          disabled={!isLoaded || isGenerating} 
        />
        {isGenerating && <ActivityIndicator size="small" />}
        <Text style={styles.output}>{generatedText}</Text>
        <Text style={styles.speed}>{speed}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  section: { marginVertical: 15, width: '100%', alignItems: 'center' },
  output: { marginTop: 10, fontSize: 16, fontStyle: 'italic', textAlign: 'center' },
  speed: { marginTop: 5, fontSize: 14, fontWeight: 'bold', color: 'green' }
});
