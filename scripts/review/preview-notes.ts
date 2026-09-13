/** Separate, candidate-bound second-pass feedback; original notes are untouched. */
export async function mountPreviewNotes(bytes: ArrayBuffer) {
    const digest = await crypto.subtle.digest('SHA-256', bytes), id = Array.from(new Uint8Array(digest), v => v.toString(16).padStart(2, '0')).join('');
    return mountPreviewNotesForCandidate(id);
}
/** The workbench receives the exact candidate digest without transferring its meshes. */
export async function mountPreviewNotesForCandidate(id: string) {
    if (!/^[a-f0-9]{64}$/.test(id))
        throw Error('Invalid preview identity');
    const box = document.querySelector<HTMLTextAreaElement>('#repair-note')!, status = document.querySelector<HTMLSelectElement>('#repair-note-status')!, message = document.querySelector('#repair-note-message')!, label = document.querySelector('#repair-note-label')!, saveButton = document.querySelector<HTMLButtonElement>('#repair-note-save')!, readyButton = document.querySelector<HTMLButtonElement>('#repair-notes-ready')!;
    box.disabled = true;
    status.disabled = true;
    saveButton.disabled = true;
    readyButton.disabled = true;
    const url = `/api/facade-repair/notes/${id}`, response = await fetch(url), initial = await response.json();
    if (!response.ok)
        throw Error(initial.error);
    const history = document.createElement('div');
    history.id = 'repair-note-history';
    history.style.whiteSpace = 'pre-wrap';
    document.querySelector('#repair-feedback')!.append(history);
    let state = initial, current = '', timer: ReturnType<typeof setTimeout> | undefined, queue: Promise<boolean> = Promise.resolve(true);
    const drafts = new Map<string, any>(), blocked = new Set<string>(), pending = new Set<string>();
    const key = (caseId: string) => `repair-note:${id}:${caseId}`;
    const info = (text: string) => { message.textContent = text; };
    const controls = (enabled: boolean) => { box.disabled = !enabled; status.disabled = !enabled; saveButton.disabled = !enabled; readyButton.disabled = !enabled; };
    const draft = (caseId: string) => { if (drafts.has(caseId))
        return drafts.get(caseId); let local; try {
        local = JSON.parse(localStorage.getItem(key(caseId)) ?? 'null');
    }
    catch { } const value = local ?? { text: state.notes[caseId]?.text ?? '', status: state.notes[caseId]?.status ?? 'unreviewed', expectedRevision: state.notes[caseId]?.revision ?? 0 }; drafts.set(caseId, value); return value; };
    const persist = (caseId: string) => localStorage.setItem(key(caseId), JSON.stringify(draft(caseId)));
    const same = (value: any, prior: any) => value.text === (prior?.text ?? '') && value.status === (prior?.status ?? 'unreviewed');
    const explain = (status: number, error: string) => status === 409 ? `${error} Your draft is kept here; reload and compare before saving.` : status === 403 ? `${error} Your draft is kept here; reload before saving.` : `${error || 'Save failed.'} Your draft is kept in this browser; use Save note to retry.`;
    const save = (caseId: string) => {
        if (!caseId)
            return queue;
        if (blocked.has(caseId)) {
            info('This note needs reload and comparison before saving. Your draft is kept in this browser.');
            return queue.then(() => false);
        }
        const value = { ...draft(caseId) };
        pending.add(caseId);
        queue = queue.then(async () => {
            if (blocked.has(caseId)) {
                persist(caseId);
                return false;
            }
            const prior = state.notes[caseId];
            if (same(value, prior)) {
                if (same(draft(caseId), prior)) {
                    pending.delete(caseId);
                    localStorage.removeItem(key(caseId));
                }
                return true;
            }
            try {
                const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-review-token': initial.token }, body: JSON.stringify({ packetSha256: id, caseId, ...value, expectedRevision: draft(caseId).expectedRevision, issues: [] }) });
                const result = await r.json();
                if (!r.ok) {
                    if (r.status === 409 || r.status === 403)
                        blocked.add(caseId);
                    persist(caseId);
                    info(explain(r.status, String(result.error ?? 'Save rejected.')));
                    return false;
                }
                state = result;
                const latest = draft(caseId);
                latest.expectedRevision = state.notes[caseId].revision;
                if (same(latest, state.notes[caseId])) {
                    pending.delete(caseId);
                    localStorage.removeItem(key(caseId));
                }
                else {
                    persist(caseId);
                    pending.add(caseId);
                }
                if (current === caseId && !pending.has(caseId))
                    info('Saved to project');
                return true;
            }
            catch (error) {
                persist(caseId);
                info(explain(0, String(error)));
                return false;
            }
        });
        return queue;
    };
    const changed = () => { const d = draft(current); d.text = box.value; d.status = status.value; pending.add(current); persist(current); info('Unsaved draft…'); clearTimeout(timer); const caseId = current; timer = setTimeout(() => save(caseId), 650); };
    const flush = async () => {
        clearTimeout(timer);
        await save(current);
        await queue;
        for (const caseId of [...pending]) {
            if (blocked.has(caseId))
                return false;
            await save(caseId);
        }
        return (await queue) && pending.size === 0 && !blocked.size;
    };
    const saveCurrent = async (): Promise<boolean> => {
        clearTimeout(timer);
        const caseId = current;
        if (!caseId)
            return true;
        await save(caseId);
        await queue;
        // A draft may have changed while the request was in flight. Keep
        // flushing this case until its latest value is durable or blocked.
        let attempts = 0;
        while (pending.has(caseId) && !blocked.has(caseId) && attempts++ < 8) {
            await save(caseId);
            await queue;
        }
        return !pending.has(caseId) && !blocked.has(caseId);
    };
    box.addEventListener('input', changed);
    status.addEventListener('change', changed);
    saveButton.addEventListener('click', () => { clearTimeout(timer); void save(current); });
    readyButton.addEventListener('click', async () => {
        controls(false);
        try {
            if (!await flush()) {
                if (blocked.size)
                    info('Reload and compare the conflicting note before marking this preview ready.');
                else
                    info('All drafts must save before this preview can be marked ready.');
                return;
            }
            try {
                const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-review-token': initial.token }, body: JSON.stringify({ packetSha256: id, action: 'ready' }) }), result = await r.json();
                if (!r.ok) {
                    info(explain(r.status, String(result.error ?? 'Ready request failed.')));
                    return;
                }
                info('Ready for the next repair pass.');
            }
            catch (error) {
                info(explain(0, String(error)));
            }
        }
        finally {
            controls(true);
        }
    });
    controls(true);
    return { saveCurrent, show(caseId: string) { if (current === caseId)
            return; clearTimeout(timer); void save(current); current = caseId; const d = draft(caseId); label.textContent = `Notes on this repair — ${caseId}`; history.textContent = (initial.previousReviews ?? []).flatMap((r: any) => r.notes[caseId] ? [`Previous preview feedback (${r.notes[caseId].status}): ${r.notes[caseId].text || 'No written note'}`] : []).join('\n'); box.value = d.text; status.value = d.status; info(localStorage.getItem(key(caseId)) ? 'Restored unsaved draft' : state.notes[caseId] ? 'Saved to project' : 'New feedback; your original note is preserved above.'); } };
}
