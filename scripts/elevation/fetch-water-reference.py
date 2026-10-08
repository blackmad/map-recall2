# /// script
# requires-python = ">=3.11"
# dependencies = ["requests"]
# ///
"""Archive the published pilot water-level reference; record dated access honestly."""
import argparse,datetime,hashlib,json,time
from pathlib import Path
import requests
p=argparse.ArgumentParser();p.add_argument('--archive',required=True);a=p.parse_args()
root=Path(a.archive)/'terrain/amsterdam/raw/water-level-reference';root.mkdir(parents=True,exist_ok=True)
url='https://www.agv.nl/siteassets/werk-in-uitvoering/waterpeil/peilbesluitenamsterdam.pdf'
file=root/'peilbesluitenamsterdam.pdf';meta=root/'source.json';record=json.loads(meta.read_text()) if meta.exists() else {'url':url,'attempts':[]}
if not file.exists():
    for attempt in range(3):
        at=datetime.datetime.now(datetime.timezone.utc).isoformat()
        try:
            r=requests.get(url,timeout=45);r.raise_for_status()
            if not r.content.startswith(b'%PDF'):raise ValueError('Reference response is not PDF')
            file.write_bytes(r.content);record.update({'retrievedAt':at,'access':'success','sha256':hashlib.sha256(r.content).hexdigest(),'bytes':len(r.content),'scope':'Amsterdam stadsboezem published target -0.40m NAP; document dated 2008, not a live measurement; other disconnected waters remain estimated','rights':'Official waterschap publication; preserved as a research reference, not distributed in game assets'});break
        except Exception as e:
            record['attempts'].append({'at':at,'error':str(e)});record['access']='failed';meta.write_text(json.dumps(record,indent=2)+'\n')
            if attempt==2:raise
            time.sleep(2**attempt)
meta.write_text(json.dumps(record,indent=2)+'\n');print(json.dumps({'access':record['access'],'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()}))
