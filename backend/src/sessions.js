// In-memory conversation state per WhatsApp user (waId)
// State values: 'IDLE' | 'AWAITING_NAME' | 'CONFIRMING_BILL'
// For production with horizontal scaling, replace with a Redis/DB-backed store.

const sessions = new Map();

function getSession(waId) {
  if (!sessions.has(waId)) {
    sessions.set(waId, { state: 'IDLE', pendingBill: null, pendingImage: null });
  }
  return sessions.get(waId);
}

function setState(waId, state) {
  getSession(waId).state = state;
}

function setPending(waId, bill, image) {
  const s = getSession(waId);
  s.pendingBill  = bill;
  s.pendingImage = image;
}

function clearPending(waId) {
  const s = getSession(waId);
  s.pendingBill  = null;
  s.pendingImage = null;
}

module.exports = { getSession, setState, setPending, clearPending };
