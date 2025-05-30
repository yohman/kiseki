import requests
import json

# List of sheet names
sheet_names = ['map']

# Spreadsheet ID and API key
spreadsheet_id = '1SkLkL2Hfw5wD3-ZfASaT5H4lCwMKRvkSGL1HZpVWMGs'
api_key = 'AIzaSyAxlHpEwRMRcj5qobzddd2oN9FNjWAh0RY'

# Output data dictionary
data = {}

# Function to fetch data from a specific sheet
def fetch_data(sheet_name):
    url = f'https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{sheet_name}?key={api_key}'
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise HTTPError for bad responses
        json_data = response.json()

        # Include the first row (headers) in the returned data
        if 'values' in json_data:
            return json_data
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data for sheet {sheet_name}: {e}")
        return None

# Fetch data for each sheet and store it in the data dictionary
for sheet_name in sheet_names:
    sheet_data = fetch_data(sheet_name)
    if sheet_data and 'values' in sheet_data:
        data[sheet_name] = sheet_data['values']

# Save the data to a JSON file
output_file = 'sheets_data.json'
with open(output_file, 'w', encoding='utf-8') as json_file:
    json.dump(data, json_file, indent=4, ensure_ascii=False)

print(f"Data saved to {output_file}")


# Upload the JSON file to GitHub
import base64
from datetime import datetime
import os

# GitHub settings
GITHUB_REPO = 'yohman/kiseki'
GITHUB_BRANCH = 'main'
GITHUB_FILE_PATH = 'sheets_data.json'
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

if not GITHUB_TOKEN:
    print("❌ GitHub token not found in environment. Aborting push.")
    exit(1)

headers = {
    'Authorization': f'token {GITHUB_TOKEN}',
    'Accept': 'application/vnd.github.v3+json'
}

# Get current file SHA (needed to update)
get_url = f'https://api.github.com/repos/{GITHUB_REPO}/contents/{GITHUB_FILE_PATH}'
response = requests.get(get_url, headers=headers)

if response.status_code == 200:
    sha = response.json().get('sha')
else:
    sha = None  # New file

# Read and encode file
with open(output_file, 'rb') as f:
    content = base64.b64encode(f.read()).decode('utf-8')

# Prepare payload
payload = {
    'message': f'Update sheets_data.json at {datetime.utcnow().isoformat()}',
    'content': content,
    'branch': GITHUB_BRANCH
}
if sha:
    payload['sha'] = sha

# Commit the file
put_response = requests.put(get_url, headers=headers, json=payload)

if put_response.status_code in [200, 201]:
    print("✅ Successfully committed sheets_data.json to GitHub.")
else:
    print(f"❌ GitHub commit failed with status {put_response.status_code}")
    print(put_response.json())