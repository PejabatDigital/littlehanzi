/* session.js — ephemeral state that lives for one visit only.
   Nothing here is persisted; storage.js owns everything that survives a reload. */

const state = {
  draftProfile: null,   // profile being created across New player -> Pick a level
  stationRun: null,     // the station currently being played
};

export function setDraftProfile(draft) { state.draftProfile = draft; }
export function getDraftProfile() { return state.draftProfile; }
export function clearDraftProfile() { state.draftProfile = null; }

export function setStationRun(run) { state.stationRun = run; }
export function getStationRun() { return state.stationRun; }
export function clearStationRun() { state.stationRun = null; }
