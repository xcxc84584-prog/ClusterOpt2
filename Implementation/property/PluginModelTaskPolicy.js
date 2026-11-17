/**
 * PR14.5: pure model/task input and output validation.
 * Secrets never appear in these contracts or diagnostic messages.
 */
const MODEL = /^[A-Za-z0-9_.:-]{1,100}$/;
const REQUEST = /^[0-9a-f]{8}-[0-9a-f-]{27,28}$/i;
const STATES = new Set(["running", "completed", "failed", "interrupted"]);
const MAX_PROMPT = 8000;
const MAX_ANSWER = 65536;

export const PluginModelTaskPolicy = Object.freeze({
  maxPromptLength: MAX_PROMPT,
  maxAnswerLength: MAX_ANSWER,
  modelValid: value => typeof value === "string" && MODEL.test(value),
  promptValid: value => typeof value === "string" &&
    value.trim().length > 0 && value.length <= MAX_PROMPT,
  requestIdValid: value => typeof value === "string" &&
    REQUEST.test(value),
  providerInfo(value) {
    return value?.type === "provider_info" &&
      typeof value.configured === "boolean" &&
      this.modelValid(value.model);
  },
  taskStatus(value) {
    return value?.type === "task_status" &&
      this.requestIdValid(value.requestId) &&
      STATES.has(value.status) &&
      typeof value.message === "string" &&
      value.message.length <= 1024;
  },
  taskResult(value) {
    return value?.type === "task_result" &&
      this.requestIdValid(value.requestId) &&
      typeof value.text === "string" &&
      value.text.length <= MAX_ANSWER;
  },
  taskMessage(value) {
    return this.providerInfo(value) ||
      this.taskStatus(value) || this.taskResult(value);
  },
  redactedTaskResult(value) {
    if (!this.taskMessage(value)) return null;
    if (value.type === "provider_info") {
      return { configured: value.configured, model: value.model };
    }
    if (value.type === "task_result") {
      return { requestId: value.requestId, text: value.text };
    }
    return {
      requestId: value.requestId, status: value.status,
      message: value.message
    };
  }
});
