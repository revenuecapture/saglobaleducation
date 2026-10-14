"""Builds an approvals file from research files and their independent checks.

  python3 scripts/approve.py <slug> [<slug> ...] > data/approvals/<date>-<name>.json

A course or award is approved only when the checker's verdict is "pass" (or it failed and the checker's
corrections were applied by hand, listed in data/research/_corrected.json) and the researcher's confidence is
high or medium. Courses also need an international fee for 2026/27 or 2027/28. A university is approved
when it has at least one approved course or award and its own record did not fail the check.
"""
import json, sys, os, datetime
R = os.path.join(os.path.dirname(__file__), '..', 'data', 'research')
out = {'approved_by': 'Claude for Badr (SA Global consultant), per the finder plan', 'date': datetime.date.today().isoformat(),
       'basis': 'checker verdict pass, confidence high or medium, international fee for 2026/27 or 2027/28',
       'universities': [], 'courses': [], 'scholarships': [], 'held_back': {}}
try: CORRECTED = set(json.load(open(os.path.join(R, '_corrected.json')))['slugs'])
except Exception: CORRECTED = set()
try: EXCLUDED = json.load(open(os.path.join(R, '_exclusions.json'))).get('scholarships', {})
except Exception: EXCLUDED = {}
try: HOLDS = json.load(open(os.path.join(R, '_holds.json')))['holds']
except Exception: HOLDS = {}
for slug in sys.argv[1:]:
    if slug in HOLDS:
        out['held_back'][slug] = ['institution on hold: ' + HOLDS[slug]]; continue
    d = json.load(open(os.path.join(R, slug + '.json')))
    vp = os.path.join(R, slug + '.verify.json')
    v = json.load(open(vp)) if os.path.exists(vp) else {}
    verdict = lambda lst, s: next((x.get('verdict') for x in v.get(lst, []) if x.get('slug') == s), None)
    held = []
    ok_c = []
    for c in d.get('courses', []):
        why = []
        if verdict('courses', c['slug']) != 'pass' and c['slug'] not in CORRECTED: why.append('check ' + str(verdict('courses', c['slug'])))
        if c.get('confidence') not in ('high', 'medium'): why.append('confidence ' + str(c.get('confidence')))
        if not c.get('tuition_amount') or c.get('tuition_academic_year') not in ('2026/27', '2027/28'): why.append('fee or fee year')
        (held.append(c['slug'] + ': ' + ', '.join(why)) if why else ok_c.append(c['slug']))
    ok_s = []
    for s in d.get('scholarships', []):
        why = []
        if verdict('scholarships', s['slug']) != 'pass' and s['slug'] not in CORRECTED: why.append('check ' + str(verdict('scholarships', s['slug'])))
        if s.get('confidence') not in ('high', 'medium'): why.append('confidence ' + str(s.get('confidence')))
        if s.get('deadline_on') and s['deadline_on'] < out['date']: why.append('deadline passed ' + s['deadline_on'])
        if s['slug'] in EXCLUDED: why.append('excluded: ' + EXCLUDED[s['slug']])
        (held.append(s['slug'] + ': ' + ', '.join(why)) if why else ok_s.append(s['slug']))
    uv = (v.get('university') or {}).get('verdict')
    if (ok_c or ok_s) and (uv != 'fail' or slug in CORRECTED):
        out['universities'].append(slug); out['courses'] += ok_c; out['scholarships'] += ok_s
    elif ok_c or ok_s:
        held.append('university record failed the check: ' + '; '.join((v.get('university') or {}).get('issues', []))[:300])
    if held: out['held_back'][slug] = held
json.dump(out, sys.stdout, indent=1, ensure_ascii=False)
