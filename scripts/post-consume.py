#!/usr/bin/env python3
import os
import requests
import re
import sys

# Environment variables provided by Paperless
DOCUMENT_ID = os.environ.get('DOCUMENT_ID')
DOCUMENT_FILE_NAME = os.environ.get('DOCUMENT_FILE_NAME')
DOCUMENT_SOURCE_PATH = os.environ.get('DOCUMENT_SOURCE_PATH')
PAPERLESS_URL = "http://localhost:8000"  # Localhost inside the container
PAPERLESS_TOKEN = os.environ.get('PAPERLESS_API_TOKEN')

# Ensure we have a token (you might need to add this to docker-compose environment vars for the script too, 
# or use a static admin token if the script runs as root/system)
# NOTE: Paperless scripts run in the context of the worker. 
# We need an API token to call back to Paperless API.
# Check if PAPERLESS_API_TOKEN is available, if not, we might need to rely on other methods or user config.

def log(message):
    print(f"[Post-Consume] {message}")

def get_year_from_filename(filename):
    # Priority 1: Look for specific 9-digit ID format (e.g. 620000283) anywhere in filename
    # This avoids confusion with date prefixes like "2024-..." (which are 4 digits) or dates (8 digits)
    # We look for exactly 9 digits not surrounded by other digits.
    match_id = re.search(r'(?<!\d)(\d{2})\d{7}(?!\d)', filename)
    if match_id:
        return match_id.group(1)

    # Priority 2: Fallback to old behavior (start of string) matching at least 2 digits
    match = re.match(r'^(\d{2})\d+', filename)
    if match:
        return match.group(1)
    return None

def main():
    if not DOCUMENT_ID or not DOCUMENT_FILE_NAME:
        log("Error: Missing DOCUMENT_ID or DOCUMENT_FILE_NAME")
        return

    year = get_year_from_filename(DOCUMENT_FILE_NAME)
    if not year:
        log(f"No year pattern found in filename: {DOCUMENT_FILE_NAME}")
        return

    log(f"Found Year: {year} for Document {DOCUMENT_ID}")

    headers = {
        "Authorization": f"Token {PAPERLESS_TOKEN}"
    }

    tag_ids_to_add = []

    # Helper function to get or create tag
    def get_or_create_tag(tag_name, color="#a6e22e"):
        try:
            r = requests.get(f"{PAPERLESS_URL}/api/tags/?name__iexact={tag_name}", headers=headers)
            r.raise_for_status()
            data = r.json()
            if data['count'] > 0:
                tid = data['results'][0]['id']
                log(f"Tag '{tag_name}' found. ID: {tid}")
                return tid
            else:
                log(f"Tag '{tag_name}' not found. Creating...")
                r_create = requests.post(f"{PAPERLESS_URL}/api/tags/", json={"name": tag_name, "color": color, "is_inbox_tag": False}, headers=headers)
                r_create.raise_for_status()
                tid = r_create.json()['id']
                log(f"Tag '{tag_name}' created. ID: {tid}")
                return tid
        except Exception as e:
            log(f"Error getting/creating tag '{tag_name}': {e}")
            return None

    # 1. Get/Create Year Tag
    year_tag_id = get_or_create_tag(year, "#a6e22e")
    if year_tag_id:
        tag_ids_to_add.append(year_tag_id)

    # 2. Get/Create Pending Tag (Orange color)
    pending_tag_id = get_or_create_tag("Pending", "#ff9800")
    if pending_tag_id:
        tag_ids_to_add.append(pending_tag_id)

    # 3. Assign Tags to Document
    if tag_ids_to_add:
        try:
            # First get current tags to append
            r_doc = requests.get(f"{PAPERLESS_URL}/api/documents/{DOCUMENT_ID}/", headers=headers)
            r_doc.raise_for_status()
            current_tags = r_doc.json()['tags']
            
            updated = False
            for tid in tag_ids_to_add:
                if tid not in current_tags:
                    current_tags.append(tid)
                    updated = True
            
            if updated:
                r_update = requests.patch(f"{PAPERLESS_URL}/api/documents/{DOCUMENT_ID}/", json={"tags": current_tags}, headers=headers)
                r_update.raise_for_status()
                log(f"Successfully assigned tags {tag_ids_to_add} to Document {DOCUMENT_ID}")
            else:
                log(f"Document {DOCUMENT_ID} already has valid tags")

        except Exception as e:
             log(f"Error updating document: {e}")

if __name__ == "__main__":
    main()
