import { generateMissions } from '../src/missions/generate.js';
import { describeTags } from '../src/missions/describe.js';

const dummyElements = [
  { id: '1', category: 'park', tags: { leisure: 'park', name: 'Central Park' } },
  { id: '2', category: 'historic', tags: { historic: 'monument', name: 'Statue' } },
  { id: '3', category: 'tree', tags: { natural: 'tree', species: 'Oak' } }
];

const missions = generateMissions(dummyElements);
if (missions.length === 3) {
  console.log('PASS');
} else {
  console.log('FAIL: Expected 3 missions, got', missions.length);
  process.exit(1);
}

const tags = describeTags(dummyElements[2].tags);
if (tags.length === 2 && tags[0] === 'natural: tree') {
  console.log('PASS');
} else {
  console.log('FAIL: describeTags did not match expected');
  process.exit(1);
}

const testElements = [
  // with names
  { id: 't1', category: 'tree', name: 'Old Oak', tags: { natural: 'tree', name: 'Old Oak' } },
  { id: 'h1', category: 'historic', name: 'Old Fort', tags: { historic: 'castle', name: 'Old Fort' } },
  { id: 'a1', category: 'artwork', name: 'Bronze Statue', tags: { tourism: 'artwork', name: 'Bronze Statue' } },
  // without name, with species
  { id: 't2', category: 'tree', tags: { natural: 'tree', species: 'Pine' } },
  // without name, without species
  { id: 't3', category: 'tree', tags: { natural: 'tree' } },
  { id: 'h2', category: 'historic', tags: { historic: 'monument' } },
  { id: 'a2', category: 'artwork', tags: { tourism: 'artwork' } },
  // park
  { id: 'p1', category: 'park', name: 'City Park', tags: { leisure: 'park', name: 'City Park' } },
  { id: 'p2', category: 'park', tags: { leisure: 'park' } }
];

const marketingWords = ['serene', 'enchanting', 'immersive', 'sanctuary', 'haven'];

for (let i = 0; i < 10; i++) {
  const generated = generateMissions(testElements, [], `2026-10-${i + 1}`);
  
  const lookMission = generated.find(m => m.type === 'LOOK');
  if (!lookMission) {
    console.log('FAIL: LOOK mission missing');
    process.exit(1);
  }
  if (lookMission.target !== null || !lookMission.title.startsWith('Find:')) {
    console.log('FAIL: LOOK target is not null or title does not start with Find:', lookMission);
    process.exit(1);
  }

  for (const m of generated) {
    if (m.title.includes('Unnamed place')) {
      console.log('FAIL: Mission title contains Unnamed place:', m);
      process.exit(1);
    }
    const textsToCheck = [m.title, m.description, m.flavor].filter(Boolean);
    for (const text of textsToCheck) {
      for (const word of marketingWords) {
        if (text.toLowerCase().includes(word)) {
          console.log(`FAIL: Marketing word '${word}' found in mission:`, m);
          process.exit(1);
        }
      }
    }
  }
}

console.log('PASS: All mission checks passed.');
