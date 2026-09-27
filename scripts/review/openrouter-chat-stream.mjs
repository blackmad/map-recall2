/** Read OpenRouter chat SSE without losing an early generation ID on timeout. */
export async function readChatStream(body, onGenerationId) {
  if (!body) throw Error('OpenRouter response has no stream body');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '', content = '', reasoning = '', generationId = null;
  let usage = null, finishReason = null, done = false, providerError = null;
  async function event(raw) {
    const data = raw.split(/\r?\n/).filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart()).join('\n').trim();
    if (!data) return;
    if (data === '[DONE]') { done = true; return; }
    const chunk = JSON.parse(data);
    if (chunk.id && !generationId) {
      generationId = chunk.id;
      await onGenerationId(generationId);
    }
    if (chunk.error) providerError = chunk.error;
    if (chunk.usage) usage = chunk.usage;
    for (const choice of chunk.choices ?? []) {
      const delta = choice.delta ?? {};
      if (typeof delta.content === 'string') content += delta.content;
      if (typeof delta.reasoning === 'string') reasoning += delta.reasoning;
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }
  try {
    while (true) {
      const {value, done:ended} = await reader.read();
      pending += decoder.decode(value, {stream:!ended});
      let separator;
      while ((separator = pending.search(/\r?\n\r?\n/)) >= 0) {
        const match = pending.slice(separator).match(/^\r?\n\r?\n/);
        const raw = pending.slice(0, separator);
        pending = pending.slice(separator + match[0].length);
        await event(raw);
      }
      if (ended) break;
    }
    if (pending.trim()) await event(pending);
    if (!done) throw Error('OpenRouter stream ended without [DONE]');
    return {generationId, content, reasoning, usage, finishReason, providerError};
  } finally {
    reader.releaseLock();
  }
}
