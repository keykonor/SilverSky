"""Actual configured DeepSeek + Amap smoke; public acceptance phrases only, no keys logged."""
import json
from pathlib import Path
import sys

import httpx

BASE = 'http://127.0.0.1:8000/api/v2'
with httpx.Client(timeout=65, trust_env=False) as client:
    status = client.get(BASE+'/status')
    print('Configuration:', status.json())
    records = []
    for scenario, text in [('A', '我想从天津大学卫津路校区去天津医科大学总医院。'), ('C', '从天津大学去总医院。')]:
        response = client.post(BASE+'/interpret', json={'text':text, 'city':'TIANJIN'})
        if response.status_code != 200:
            print('Live', scenario, response.status_code, response.json()); sys.exit(1)
        analysis = response.json()
        summary = { 'scenario':scenario, 'intent':analysis['intent'], 'resolved':{k:v['name'] if v else None for k,v in analysis['resolved'].items()},
                   'candidates':{role:[{'id':p['id'],'name':p['name'],'address':p['address']} for p in analysis[role+'_candidates']] for role in ('origin','destination')} }
        print(json.dumps(summary,ensure_ascii=False))
        records.append(summary)
    path=Path('.verification/v2/live-analysis.json');path.write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print('Live analysis probes finished; no candidate automatically picked by this script.')
