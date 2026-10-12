import type { DesktopApi } from './types';

export const isDesktop = typeof window !== 'undefined' && window.studyCompanion !== undefined;

function api(): DesktopApi {
  if (!window.studyCompanion) throw new Error('请在桌面应用中使用此功能。');
  return window.studyCompanion;
}
export const desktop: DesktopApi = {
  bootstrap: () => api().bootstrap(),
  saveSettings: (settings) => api().saveSettings(settings),
  storeApiKey: (baseUrl, key) => api().storeApiKey(baseUrl, key),
  removeApiKey: (baseUrl) => api().removeApiKey(baseUrl),
  hasApiKey: (baseUrl) => api().hasApiKey(baseUrl),
  studyOverview: (year, month) => api().studyOverview(year, month),
  checkIn: (year, month) => api().checkIn(year, month),
  setStudyRunning: (running, year, month) => api().setStudyRunning(running, year, month),
  checkConnection: (provider, profile, key) => api().checkConnection(provider, profile, key),
  listSources: () => api().listSources(),
  importExample: () => api().importExample(),
  probeGeneration: (signature, consentEndpoint) =>
    api().probeGeneration(signature, consentEndpoint),
  probeEmbedding: () => api().probeEmbedding(),
  listReviews: (turnId) => api().listReviews(turnId),
  getReview: (id) => api().getReview(id),
  saveReview: (input) => api().saveReview(input),
  resolveReviewCitation: (id, number) => api().resolveReviewCitation(id, number),
  exportReview: (id, revision) => api().exportReview(id, revision),
  importSources: () => api().importSources(),
  cancelImport: () => api().cancelImport(),
  onImportProgress: (listener) => api().onImportProgress(listener),
  openSource: (id) => api().openSource(id),
  saveReadingPosition: (id, position) => api().saveReadingPosition(id, position),
  copyCitation: (id, anchor, quote) => api().copyCitation(id, anchor, quote),
  readSelection: (id, anchor, quote) => api().readSelection(id, anchor, quote),
  prepareReadingQuestion: (question, id, anchor, quote) =>
    api().prepareReadingQuestion(question, id, anchor, quote),
  listConversations: () => api().listConversations(),
  createConversation: () => api().createConversation(),
  getConversation: (id) => api().getConversation(id),
  previewHistory: (target) => api().previewHistory(target),
  renameConversation: (id, version, title) => api().renameConversation(id, version, title),
  deleteHistory: (target, version) => api().deleteHistory(target, version),
  exportHistory: (target, version) => api().exportHistory(target, version),
  sendChat: (request) => api().sendChat(request),
  stopChat: (id) => api().stopChat(id),
  activeChat: () => api().activeChat(),
  onChatUpdate: (listener) => api().onChatUpdate(listener),
  prepareQuestion: (question, sourceId) => api().prepareQuestion(question, sourceId),
  preparePractice: (request) => api().preparePractice(request),
  sendPractice: (request) => api().sendPractice(request),
  cancelRetrieval: () => api().cancelRetrieval(),
  rebuildIndex: () => api().rebuildIndex(),
  onRetrievalProgress: (listener) => api().onRetrievalProgress(listener),
  resolveCitation: (turnId, number) => api().resolveCitation(turnId, number),
  embeddingStatus: () => api().embeddingStatus(),
  downloadEmbedding: () => api().downloadEmbedding(),
  cancelEmbeddingDownload: () => api().cancelEmbeddingDownload(),
  onEmbeddingProgress: (listener) => api().onEmbeddingProgress(listener),
  listNotes: () => api().listNotes(),
  getNote: (id) => api().getNote(id),
  saveNote: (request) => api().saveNote(request),
  deleteNote: (id, revision) => api().deleteNote(id, revision),
  exportNote: (id, revision) => api().exportNote(id, revision),
  setNoteDraftDirty: (dirty) => api().setNoteDraftDirty(dirty),
  onShowNotes: (listener) => api().onShowNotes(listener),
  listNoteFeedback: (id) => api().listNoteFeedback(id),
  prepareNoteFeedback: (id, revision, question) =>
    api().prepareNoteFeedback(id, revision, question),
  sendNoteFeedback: (request) => api().sendNoteFeedback(request),
  listLearningDrafts: () => api().listLearningDrafts(),
  prepareLearningDraft: (request, memoryIds) => api().prepareLearningDraft(request, memoryIds),
  sendLearningDraft: (request) => api().sendLearningDraft(request),
  listMemories: () => api().listMemories(),
  saveMemory: (request) => api().saveMemory(request),
  deleteMemory: (id, revision) => api().deleteMemory(id, revision),
  prepareMemoryProposal: (turnId, edit) => api().prepareMemoryProposal(turnId, edit),
  confirmMemoryProposal: (id) => api().confirmMemoryProposal(id),
  discardMemoryProposal: (id) => api().discardMemoryProposal(id),
  planningOverview: (day) => api().planningOverview(day),
  saveStudyProject: (request) => api().saveStudyProject(request),
  saveDailyTask: (request) => api().saveDailyTask(request),
  setDailyTaskCompleted: (id, revision, completed) =>
    api().setDailyTaskCompleted(id, revision, completed),
  deleteDailyTask: (id, revision) => api().deleteDailyTask(id, revision),
  prepareTaskProposal: (turnId, request) => api().prepareTaskProposal(turnId, request),
  confirmTaskProposal: (id) => api().confirmTaskProposal(id),
  discardTaskProposal: (id) => api().discardTaskProposal(id),
  focusOverview: () => api().focusOverview(),
  focusHistory: (query) => api().focusHistory(query),
  getFocusSession: (id) => api().getFocusSession(id),
  startFocus: (request) => api().startFocus(request),
  controlFocus: (id, revision, action) => api().controlFocus(id, revision, action),
  saveFocusReview: (id, revision, review) => api().saveFocusReview(id, revision, review),
  backupState: () => api().backupState(),
  exportBackup: () => api().exportBackup(),
  inspectBackup: () => api().inspectBackup(),
  confirmRestore: (id) => api().confirmRestore(id),
  discardRestore: (id) => api().discardRestore(id),
  cancelBackup: () => api().cancelBackup(),
  onBackupUpdate: (listener) => api().onBackupUpdate(listener),
};

export function errorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return '操作未完成，请重试。';
}

export function sameEndpoint(left: string, right: string): boolean {
  try {
    return (
      new URL(left.trim()).href.replace(/\/$/, '') === new URL(right.trim()).href.replace(/\/$/, '')
    );
  } catch {
    return false;
  }
}
