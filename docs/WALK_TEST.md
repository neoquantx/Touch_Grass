# Walk Test Checklist (Phase 3.1)

## Preparation (At home with Wi-Fi)
- [ ] Open the app and go to the **Setup** tab.
- [ ] Grant **Location** permission.
- [ ] Download the **AI Model** (Wait for "Done").
- [ ] Tap **Cache my area** (or "Use bundled area" if live Overpass fails). Wait for "Done".
- [ ] Turn on **Airplane Mode** (disable Wi-Fi and Cellular).
- [ ] Check Diagnostics: "Ready for airplane mode: Yes".
- [ ] Restart the app to verify offline hydration and date rollover logic works.

## The Walk
- [ ] Walk away from your starting location to a mapped `GO` point.
- [ ] **Battery check**: Note the starting battery percentage.
- [ ] **Speed check**: Is the UI responsive?

### GO Mission
- [ ] Attempt to check in while > 200m away. **Observe:** Does it properly reject you with distance feedback?
- [ ] Attempt to check in while within radius. **Observe:** Does it succeed?

### LOOK Mission
- [ ] Walk to the `LOOK` point.
- [ ] Tap **Take proof photo**.
- [ ] **Observe:** Does it open the camera properly? Does it accept the photo and return to the app?
- [ ] **Verify** the thumbnail is visible.
- [ ] Optional: Force close the app while the camera is open. Restart the app. **Observe:** Does the pending proof recovery work?

### LEARN Mission
- [ ] Walk to the `LEARN` point.
- [ ] Tap **Check in here**.
- [ ] **Observe:** Does the AI summary generate on-device while in airplane mode?
- [ ] Note the time it takes to generate the summary. Is it acceptable?

## Debrief
- [ ] Review the **Today** tab. Are all 3 missions marked as DONE?
- [ ] Check token balance. Is it updated correctly?
- [ ] Note ending battery percentage. Calculate battery drain for the session.
- [ ] Note any GPS accuracy issues (e.g., getting rejected despite being physically at the location).
