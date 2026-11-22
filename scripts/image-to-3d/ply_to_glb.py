"""ply_to_glb.py <in.ply> <out.glb>: vertex-coloured TripoSR mesh -> GLB (unchanged frame), prints triangles.
PLY colours are sRGB bytes; glTF COLOR_0 is linear, so they are decoded before export."""
import sys
import numpy as np
import trimesh
m = trimesh.load(sys.argv[1], process=False)
c = np.asarray(m.visual.vertex_colors).astype(np.float64) / 255.0
rgb = c[:, :3]
lin = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
m.visual.vertex_colors = np.concatenate([np.round(lin * 255), np.round(c[:, 3:] * 255)], axis=1).astype(np.uint8)
m.export(sys.argv[2])
print(len(m.faces))
