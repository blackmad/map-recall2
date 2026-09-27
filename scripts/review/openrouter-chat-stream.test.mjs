import assert from 'node:assert/strict';
import {readChatStream} from './openrouter-chat-stream.mjs';

function stream(parts) {
 const encoder = new TextEncoder();
 return new ReadableStream({
  start(controller) {
   for (const part of parts) controller.enqueue(encoder.encode(part));
   controller.close();
  },
 });
}

const ids = [];
const result = await readChatStream(stream([
 'data: {"id":"gen-test","choices":[{"delta":{"content":"<s"}}]}\n\n',
 'data: {"id":"gen-test","choices":[{"delta":{"content":"vg>","reasoning":"thought"},"finish_reason":"stop"}]}\n',
 '\ndata: {"usage":{"completion_tokens":12,"cost":0.00001},"choices":[]}\n\n',
 'data: [DONE]\n\n',
]), async id => ids.push(id));
assert.deepEqual(ids, ['gen-test'], 'save generation ID on first chunk, once');
assert.equal(result.content, '<svg>');
assert.equal(result.reasoning, 'thought');
assert.equal(result.finishReason, 'stop');
assert.equal(result.usage.cost, 0.00001);

const seen = [];
await assert.rejects(readChatStream(stream([
 'data: {"id":"gen-timeout","choices":[{"delta":{"content":"partial"}}]}\n\n',
]), async id => seen.push(id)), /without \[DONE\]/);
assert.deepEqual(seen, ['gen-timeout'], 'incomplete stream still preserves generation ID');

console.log('OpenRouter SSE: split events, usage, and early generation ID passed.');
