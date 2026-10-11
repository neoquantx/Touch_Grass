export const PROOF_STATES = {
  IDLE: 'idle',
  CAMERA: 'camera',
  REVIEW: 'review',
  SAVING: 'saving',
  LOCATING: 'locating',
  COMPLETING: 'completing',
  DONE: 'done',
  ERROR: 'error'
};

export const PROOF_EVENTS = {
  START_CAMERA: 'START_CAMERA',
  TAKEN: 'TAKEN',
  USE: 'USE',
  USE_ANYWAY: 'USE_ANYWAY',
  RETAKE: 'RETAKE',
  CANCEL: 'CANCEL',
  STAGE_OK: 'STAGE_OK',
  STAGE_FAIL: 'STAGE_FAIL',
  RETRY: 'RETRY'
};

export function initialProofState() {
  return {
    state: PROOF_STATES.IDLE,
    photo: null,
    savedUri: null,
    stage: null,
    failedStage: null,
    error: null,
    acceptDark: false
  };
}

export function proofFlowReducer(state = initialProofState(), event) {
  const eventType = typeof event === 'string' ? event : event?.type;
  if (!eventType) return state;

  switch (eventType) {
    case PROOF_EVENTS.START_CAMERA: {
      return {
        ...state,
        state: PROOF_STATES.CAMERA,
        error: null
      };
    }

    case PROOF_EVENTS.TAKEN: {
      const photo = event.photo !== undefined ? event.photo : (event.payload !== undefined ? event.payload : state.photo);
      return {
        ...state,
        state: PROOF_STATES.REVIEW,
        photo,
        error: null
      };
    }

    case PROOF_EVENTS.USE: {
      if (state.state !== PROOF_STATES.REVIEW) return state;
      return {
        ...state,
        state: PROOF_STATES.SAVING,
        stage: 'saving',
        acceptDark: false,
        error: null
      };
    }

    case PROOF_EVENTS.USE_ANYWAY: {
      if (state.state !== PROOF_STATES.REVIEW) return state;
      return {
        ...state,
        state: PROOF_STATES.SAVING,
        stage: 'saving',
        acceptDark: true,
        error: null
      };
    }

    case PROOF_EVENTS.STAGE_OK: {
      if (state.state === PROOF_STATES.SAVING) {
        const savedUri = event.savedUri !== undefined ? event.savedUri : (event.payload !== undefined ? event.payload : state.savedUri);
        return {
          ...state,
          state: PROOF_STATES.LOCATING,
          stage: 'locating',
          savedUri,
          error: null
        };
      }
      if (state.state === PROOF_STATES.LOCATING) {
        return {
          ...state,
          state: PROOF_STATES.COMPLETING,
          stage: 'completing',
          error: null
        };
      }
      if (state.state === PROOF_STATES.COMPLETING) {
        return {
          ...state,
          state: PROOF_STATES.DONE,
          error: null
        };
      }
      return state;
    }

    case PROOF_EVENTS.STAGE_FAIL: {
      const failedStage = state.stage || state.state;
      const errorMsg = event.error !== undefined ? event.error : (event.payload !== undefined ? event.payload : 'Stage failed');
      return {
        ...state,
        state: PROOF_STATES.ERROR,
        failedStage,
        error: errorMsg
      };
    }

    case PROOF_EVENTS.RETRY: {
      if (state.state !== PROOF_STATES.ERROR) return state;
      const resumeStage = state.failedStage || 'saving';
      return {
        ...state,
        state: resumeStage,
        stage: resumeStage,
        error: null
      };
    }

    case PROOF_EVENTS.RETAKE: {
      return {
        ...state,
        state: PROOF_STATES.CAMERA,
        photo: null,
        savedUri: null,
        stage: null,
        failedStage: null,
        error: null,
        acceptDark: false
      };
    }

    case PROOF_EVENTS.CANCEL: {
      return initialProofState();
    }

    default:
      return state;
  }
}

export const transition = proofFlowReducer;
export default proofFlowReducer;
