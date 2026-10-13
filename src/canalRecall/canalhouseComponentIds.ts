/** Recipe IDs are semantic labels. Preserve case and reserve slash for the
 * library's generated group/tier/bay paths. */
export const isCanalhouseComponentId=(value:unknown):value is string=>
 typeof value==='string'&&/^[a-z][a-z0-9-]*$/i.test(value);
