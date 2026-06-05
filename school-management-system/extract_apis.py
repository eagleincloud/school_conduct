import os
import re
import json

def extract_frontend_apis(src_dir):
    apis = []
    # Match api.method('url' or api.method(`url`
    # Also handle axios.method
    pattern = re.compile(r'(api|axios)\.(get|post|put|delete|patch)\(\s*([\'"`])(.*?)\3')
    
    for root, _, files in os.walk(src_dir):
        for file in files:
            if file.endswith(('.js', '.jsx', '.ts', '.tsx')):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    matches = pattern.findall(content)
                    for match in matches:
                        method = match[1].upper()
                        url = match[3]
                        # normalize url, remove ${...} to see base
                        normalized_url = '/api/' + url.lstrip('/')
                        apis.append({
                            'method': method,
                            'url': normalized_url,
                            'file': filepath.replace('\\', '/')
                        })
    return apis

def extract_backend_urls(backend_dir):
    urls = []
    # Very basic URL pattern extraction
    # This is hard because Django URLs can be complex, include(), routers, etc.
    # So we'll just scan urls.py for path('something'
    pattern = re.compile(r'path\(\s*[\'"]([^\'"]*)[\'"]')
    for root, _, files in os.walk(backend_dir):
        for file in files:
            if file == 'urls.py':
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    matches = pattern.findall(content)
                    for match in matches:
                        urls.append({
                            'url_pattern': match,
                            'file': filepath.replace('\\', '/')
                        })
    return urls

if __name__ == '__main__':
    frontend_dir = 'frontend/src'
    backend_dir = 'backend'
    
    apis = extract_frontend_apis(frontend_dir)
    
    # group by URL + Method
    grouped_apis = {}
    for api in apis:
        key = f"{api['method']} {api['url']}"
        if key not in grouped_apis:
            grouped_apis[key] = {
                'method': api['method'],
                'url': api['url'],
                'files': set()
            }
        grouped_apis[key]['files'].add(api['file'])
        
    print(f"Found {len(grouped_apis)} unique API endpoints called from frontend.")
    
    # Dump to JSON for easier processing
    with open('api_map.json', 'w') as f:
        # Convert sets to lists for JSON
        for k in grouped_apis:
            grouped_apis[k]['files'] = list(grouped_apis[k]['files'])
        json.dump(grouped_apis, f, indent=2)

