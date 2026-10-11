import { isGrounded, clampSentences } from '../src/llm/grounding.js';

let failed = false;
function assertGrounded(output, tags, expected) {
  const result = isGrounded(output, tags);
  if (result !== expected) {
    console.error(`FAIL: output="${output}" expected ${expected}, got ${result}`);
    failed = true;
  }
}

// Case 1: grounded year passes
assertGrounded("Built in 1895.", ["start_date: 1895"], true);

// Case 2: invented year fails
assertGrounded("Built in 1895.", ["name: park"], false);

// Case 3: no tags with historical words fails
assertGrounded("The park was established long ago.", ["name: park"], false);

// Case 4: historical words pass if date exists
assertGrounded("The park was established long ago.", ["start_date: unknown"], true);

// Case 5: large number fails
assertGrounded("It has 500 trees.", ["name: park"], false);

// Case 6: large number passes if in tags
assertGrounded("It has 500 trees.", ["trees: 500"], true);

// Case 7: clamp sentences
const text = "One. Two. Three. Four.";
const clamped = clampSentences(text, 2);
if (clamped !== "One. Two.") {
  console.error("FAIL: clampSentences", clamped);
  failed = true;
}

// Case 8: no number passes
assertGrounded("It is a beautiful park.", ["name: park"], true);

if (!failed) {
  console.log('PASS');
} else {
  process.exit(1);
}
