import pdfplumber
import re
import json

departments = [
    'Secretary', 'Finance', 'Human Capital', 'Talent Acquisition',
    'Social Event', 'Public Relation', 'Academic and Achievement',
    'Business Development', 'Media and Branding'
]

current_dept = None
interns = []

with pdfplumber.open('../Plotingan + NIM Magang Department 2026.pdf') as pdf:
    for page in pdf.pages:
        for t in page.extract_tables():
            for row in t:
                dept_cell = (row[0] or '').replace('\n', ' ').strip()
                if dept_cell in departments:
                    current_dept = dept_cell
                content = row[1] or ''
                items = re.findall(r'(\d+)\.\s+([^(]+?)\s+\((\d{14})\)', content)
                for no, name, nim in items:
                    clean_name = re.sub(r'\s+', ' ', name).strip().replace('\ufffd', "'")
                    interns.append({
                        'no': int(no),
                        'name': clean_name,
                        'nim': nim,
                        'department': current_dept
                    })

print(f"Total extracted: {len(interns)}")
dept_counts = {}
for i in interns:
    dept_counts[i['department']] = dept_counts.get(i['department'], 0) + 1

for d, count in dept_counts.items():
    print(f"  {d}: {count}")

with open('scripts/interns_extracted.json', 'w', encoding='utf-8') as f:
    json.dump(interns, f, indent=2, ensure_ascii=False)

print("Saved to scripts/interns_extracted.json")
