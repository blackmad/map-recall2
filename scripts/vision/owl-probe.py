# /// script
# requires-python = ">=3.10,<3.14"
# dependencies = ["torch","transformers","pillow","numpy","scipy","accelerate"]
# ///
"""OWLv2 (google/owlv2-base-patch16-ensemble, MPS) probe on the gold crops. PARKED spike.
Usage: owl-probe.py EVAL_DIR OUT_JSON  (gold-labels.json beside this script)."""
import os
import json,sys,time,torch,numpy as np
from PIL import Image
from transformers import Owlv2Processor, Owlv2ForObjectDetection
dev='mps' if torch.backends.mps.is_available() else 'cpu'
name='google/owlv2-base-patch16-ensemble'
proc=Owlv2Processor.from_pretrained(name);model=Owlv2ForObjectDetection.from_pretrained(name).to(dev).eval()
D=sys.argv[1];r=json.load(open(D+'/truth.json'));g=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'gold-labels.json')))
out={}
for k in sorted(g,key=int):
    x=r[int(k)];im=Image.open(D+'/'+x['file']).convert('RGB')
    t=time.time()
    inp=proc(text=[["a window","a door","a shopfront"]],images=im,return_tensors='pt').to(dev)
    with torch.no_grad(): o=model(**inp)
    W,H=im.size;s=max(W,H)
    res=proc.image_processor.post_process_object_detection(outputs=o,threshold=0.1,target_sizes=torch.tensor([[s,s]]).to(dev))[0]
    out[k]=dict(boxes=res['boxes'].cpu().tolist(),scores=res['scores'].cpu().tolist(),labels=res['labels'].cpu().tolist(),sec=time.time()-t,W=W,H=H)
    print(k,len(out[k]['boxes']),round(out[k]['sec'],1),flush=True)
json.dump(out,open(sys.argv[2],'w'))
