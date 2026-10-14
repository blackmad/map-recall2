# /// script
# requires-python = ">=3.11"
# dependencies = ["torch", "timm", "transformers>=4.56", "safetensors"]
# ///
"""Convert timm's ungated DINOv3 ViT-L/16 (LVD-1689M) copy into a transformers DINOv3ViTModel folder.

TRELLIS.2 conditions on `facebook/dinov3-vitl16-pretrain-lvd1689m`, which is gated (manual approval) on
Hugging Face. Meta's DINOv3 License allows redistribution, and `timm/vit_large_patch16_dinov3_qkvb.lvd1689m`
is such a redistribution (ungated, DINOv3 License, LICENSE.md included). This maps its keys onto the
transformers layout and checks the outputs agree with timm's own forward pass.

  python -I dinov3_timm_to_hf.py <timm-dir-with-model.safetensors> <out-dir>
"""
import json, os, shutil, sys
import torch
from safetensors.torch import load_file, save_file
from transformers import DINOv3ViTConfig, DINOv3ViTModel

src, out = sys.argv[1], sys.argv[2]
sd = load_file(os.path.join(src, "model.safetensors"))
L = 24
cfg = DINOv3ViTConfig(hidden_size=1024, num_hidden_layers=L, num_attention_heads=16, intermediate_size=4096,
                      num_register_tokens=4, patch_size=16, image_size=224, rope_theta=100.0,
                      query_bias=True, key_bias=False, value_bias=True, proj_bias=True, mlp_bias=True,
                      use_gated_mlp=False, layerscale_value=1e-5, layer_norm_eps=1e-5)
o = {
    "embeddings.cls_token": sd["cls_token"],
    "embeddings.register_tokens": sd["reg_token"],
    "embeddings.mask_token": torch.zeros(1, 1, 1024),
    "embeddings.patch_embeddings.weight": sd["patch_embed.proj.weight"],
    "embeddings.patch_embeddings.bias": sd["patch_embed.proj.bias"],
    "norm.weight": sd["norm.weight"], "norm.bias": sd["norm.bias"],
}
for i in range(L):
    b, h = f"blocks.{i}.", f"model.layer.{i}."
    q, k, v = sd[b + "attn.qkv.weight"].chunk(3, 0)
    o.update({
        h + "norm1.weight": sd[b + "norm1.weight"], h + "norm1.bias": sd[b + "norm1.bias"],
        h + "attention.q_proj.weight": q.contiguous(), h + "attention.k_proj.weight": k.contiguous(), h + "attention.v_proj.weight": v.contiguous(),
        h + "attention.q_proj.bias": sd[b + "attn.q_bias"], h + "attention.v_proj.bias": sd[b + "attn.v_bias"],
        h + "attention.o_proj.weight": sd[b + "attn.proj.weight"], h + "attention.o_proj.bias": sd[b + "attn.proj.bias"],
        h + "layer_scale1.lambda1": sd[b + "gamma_1"], h + "layer_scale2.lambda1": sd[b + "gamma_2"],
        h + "norm2.weight": sd[b + "norm2.weight"], h + "norm2.bias": sd[b + "norm2.bias"],
        h + "mlp.up_proj.weight": sd[b + "mlp.fc1.weight"], h + "mlp.up_proj.bias": sd[b + "mlp.fc1.bias"],
        h + "mlp.down_proj.weight": sd[b + "mlp.fc2.weight"], h + "mlp.down_proj.bias": sd[b + "mlp.fc2.bias"],
    })
model = DINOv3ViTModel(cfg).eval()
missing, unexpected = model.load_state_dict(o, strict=False)
print("missing", missing, "unexpected", unexpected)
assert not unexpected and all("rope" in m or "inv_freq" in m for m in missing), (missing, unexpected)

# Check against timm's own forward pass (both apply the final norm).
import timm
tm = timm.create_model("vit_large_patch16_dinov3_qkvb.lvd1689m", pretrained=True,
                       pretrained_cfg_overlay=dict(file=os.path.join(src, "model.safetensors"))).eval()
x = torch.randn(1, 3, 512, 512)
with torch.no_grad():
    a = model(pixel_values=x).last_hidden_state
    b = tm.forward_features(x)
err = (a - b).abs().max().item(); rel = err / b.abs().max().item()
print("max abs diff", err, "rel", rel, a.shape, b.shape)
assert rel < 1e-2, "converted model disagrees with timm"
os.makedirs(out, exist_ok=True)
model.save_pretrained(out)
shutil.copy(os.path.join(src, "LICENSE.md"), os.path.join(out, "LICENSE.md"))
json.dump({"source": "timm/vit_large_patch16_dinov3_qkvb.lvd1689m", "licence": "DINOv3 License", "maxAbsDiff": err, "rel": rel},
          open(os.path.join(out, "conversion.json"), "w"), indent=1)
print("wrote", out)
