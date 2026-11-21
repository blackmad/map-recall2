"""Convert a ComfyUI UI-format workflow (template JSON) into the API prompt format, using the server's /object_info.

    python -I comfy_ui_to_api.py <workflow.json> <object_info.json> <out_api.json>

Handles: links (also through Reroute), widget values in object_info order (control_after_generate takes an extra
slot), COMFY_DYNAMICCOMBO_V3 sub-inputs (named "<combo>.<sub>", values following the combo's own value), and drops
UI-only nodes (notes, previews). Subgraphs are not expanded (the TRELLIS.2/Pixal3D template has none).
"""
import json
import sys

wf, oi = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
DROP = {"Note", "MarkdownNote", "PreviewImage", "MaskPreview", "Preview3DAdvanced", "Preview3D", "PrimitiveNode"}
WIDGET_TYPES = {"INT", "FLOAT", "STRING", "BOOLEAN", "COMBO", "COLOR", "COMFY_DYNAMICCOMBO_V3"}
links = {l[0]: l for l in wf["links"]}
nodes = {n["id"]: n for n in wf["nodes"]}


def is_widget(spec):
    t = spec[0]
    return isinstance(t, list) or t in WIDGET_TYPES


def source(link_id):
    l = links[link_id]
    src = nodes[l[1]]
    if src["type"] in ("Reroute", "PreviewImage", "MaskPreview"):  # previews pass their input through in v0.46 templates
        return source(src["inputs"][0]["link"])
    return [str(l[1]), l[2]]


api = {}
for n in wf["nodes"]:
    if n["type"] in DROP or n.get("mode", 0) in (2, 4):
        continue
    info = oi.get(n["type"])
    if info is None:
        raise SystemExit(f"node type {n['type']} not on the server")
    linked = {i["name"]: i["link"] for i in n.get("inputs", []) if i.get("link") is not None}
    vals = list(n.get("widgets_values") or [])
    if isinstance(n.get("widgets_values"), dict):
        vals = list(n["widgets_values"].values())
    inputs = {}

    def take(name, spec):
        global vals
        opts = spec[1] if len(spec) > 1 and isinstance(spec[1], dict) else {}
        if name in linked:
            inputs[name] = source(linked[name])
            if is_widget(spec) and vals and not opts.get("forceInput"):
                vals.pop(0)
                if opts.get("control_after_generate"):
                    vals.pop(0)
            return
        if not is_widget(spec) or opts.get("forceInput"):
            return
        if not vals:
            return
        v = vals.pop(0)
        inputs[name] = v
        if opts.get("control_after_generate") and vals and isinstance(vals[0], str) and vals[0] in ("fixed", "randomize", "increment", "decrement"):
            vals.pop(0)
        if spec[0] == "COMFY_DYNAMICCOMBO_V3":
            for o in opts["options"]:
                if o["key"] == v:
                    for sec in ("required", "optional"):
                        for sub, sspec in o["inputs"].get(sec, {}).items():
                            take(f"{name}.{sub}", sspec)

    for sec in ("required", "optional"):
        for name, spec in info["input"].get(sec, {}).items():
            take(name, spec)
    for name, lid in linked.items():
        if name not in inputs:
            inputs[name] = source(lid)
    api[str(n["id"])] = {"class_type": n["type"], "inputs": inputs, "_meta": {"title": n.get("title", n["type"])}}

# Drop links to removed nodes.
for k, v in api.items():
    v["inputs"] = {a: b for a, b in v["inputs"].items() if not (isinstance(b, list) and len(b) == 2 and isinstance(b[0], str) and b[0] not in api)}
json.dump(api, open(sys.argv[3], "w"), indent=1)
print(len(api), "nodes")
