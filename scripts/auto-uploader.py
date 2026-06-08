#!/usr/bin/env python3
import os
import re
import sys
import json
import time
import hashlib
import requests

# --- CONFIGURATION ---
# Base URL of the Paperless Custom Portal
API_BASE_URL = os.environ.get("PAPERLESS_URL", "https://paperless.bangkhan.com")
# Credentials of a staff user authorized to upload
USERNAME = os.environ.get("UPLOAD_USER", "staff1")
PASSWORD = os.environ.get("UPLOAD_PASSWORD", "password")
# Directory where files are scanned and mounted (e.g., /Volumes/192.168.100.119/ปี 2569)
SCAN_DIR = os.environ.get("SCAN_DIR", "/Users/kittisak.s/Documents/chart/ปี 2569")
# Local tracker file path
TRACKER_FILE = os.environ.get("TRACKER_FILE", "uploaded_tracker.json")

# Match exactly 9 digits representing the Admission Number (e.g. 690000002)
ADMISSION_PATTERN = re.compile(r'^\d{9}$')

def log(message):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}")

def load_tracker():
    if os.path.exists(TRACKER_FILE):
        try:
            with open(TRACKER_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            log(f"Warning: Failed to load tracker file, starting fresh. Error: {e}")
    return {}

def save_tracker(tracker):
    try:
        with open(TRACKER_FILE, 'w', encoding='utf-8') as f:
            json.dump(tracker, f, indent=2, ensure_ascii=False)
    except Exception as e:
        log(f"Error saving tracker file: {e}")

def get_file_hash(filepath):
    """Calculate MD5 hash of the file to verify content uniqueness."""
    hasher = hashlib.md5()
    try:
        with open(filepath, 'rb') as f:
            buf = f.read(65536)
            while len(buf) > 0:
                hasher.update(buf)
                buf = f.read(65536)
        return hasher.hexdigest()
    except Exception as e:
        log(f"Error hashing file {filepath}: {e}")
        return None

def login():
    """Authenticate with the backend and return JWT token."""
    url = f"{API_BASE_URL}/api/auth/login"
    try:
        response = requests.post(url, json={
            "username": USERNAME,
            "password": PASSWORD
        })
        response.raise_for_status()
        data = response.json()
        token = data.get("token")
        if not token:
            raise ValueError("Token not found in login response")
        return token
    except Exception as e:
        log(f"Login failed to {url}: {e}")
        return None

def check_remote_exists(token, title):
    """Query backend search API to check if document title already exists."""
    url = f"{API_BASE_URL}/api/search"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        response = requests.get(url, headers=headers, params={"q": title})
        response.raise_for_status()
        data = response.json()
        
        # Check results list for exact title match
        results = data.get("results", [])
        for doc in results:
            if doc.get("title") == title:
                return True
        return False
    except Exception as e:
        log(f"Error checking remote existence for '{title}': {e}")
        return False

def upload_document(token, filepath, title):
    """Upload document to the backend /api/upload endpoint."""
    url = f"{API_BASE_URL}/api/upload"
    headers = {"Authorization": f"Bearer {token}"}
    
    filename = f"{title}.pdf"
    
    # Extract first 2 digits of the title as the prefix tag (e.g. 69 from 690000011)
    prefix_tag = title[:2] if len(title) >= 2 else ""
    custom_tags = f"{prefix_tag},Pending" if prefix_tag else "Pending"
    
    try:
        with open(filepath, 'rb') as f:
            files = {
                'file': (filename, f, 'application/pdf')
            }
            data = {
                'title': title,
                'tags': custom_tags
            }
            response = requests.post(url, headers=headers, files=files, data=data)
            
            if response.status_code == 200:
                log(f"Successfully uploaded: {filepath} -> Title: {title} with tags: {custom_tags}")
                return True
            else:
                log(f"Failed to upload {filepath}. Status: {response.status_code}, Response: {response.text}")
                return False
    except Exception as e:
        log(f"Upload exception for {filepath}: {e}")
        return False

def scan_and_upload():
    log(f"Starting auto-uploader sweep...")
    log(f"Scan Directory: {SCAN_DIR}")
    
    if not os.path.exists(SCAN_DIR):
        log(f"Error: Scan directory '{SCAN_DIR}' does not exist.")
        return
        
    tracker = load_tracker()
    
    # 1. Login to get token
    token = login()
    if not token:
        log("Error: Authentication failed. Aborting sweep.")
        return
        
    uploaded_count = 0
    skipped_count = 0
    failed_count = 0
    
    # Walk the scan directory
    for root, dirs, files in os.walk(SCAN_DIR):
        for dirname in dirs:
            # Check if directory name matches the 9-digit pattern (e.g. 690000002)
            if ADMISSION_PATTERN.match(dirname):
                folder_path = os.path.join(root, dirname)
                title = dirname # The folder name is the document title (e.g. 690000002)
                
                # Find PDF files in this folder
                pdf_files = [f for f in os.listdir(folder_path) if f.lower().endswith('.pdf')]
                
                for pdf in pdf_files:
                    pdf_path = os.path.join(folder_path, pdf)
                    
                    # Compute hash for tracking uniqueness
                    file_hash = get_file_hash(pdf_path)
                    if not file_hash:
                        continue
                        
                    # Skip if already in local tracker
                    if pdf_path in tracker and tracker[pdf_path].get("hash") == file_hash:
                        skipped_count += 1
                        continue
                        
                    # Double check on backend to prevent duplicates
                    if check_remote_exists(token, title):
                        log(f"Skipping {pdf_path} (Document title '{title}' already exists on server)")
                        # Update tracker to avoid repeating API check next time
                        tracker[pdf_path] = {
                            "hash": file_hash,
                            "title": title,
                            "timestamp": time.time(),
                            "status": "exists_on_server"
                        }
                        save_tracker(tracker)
                        skipped_count += 1
                        continue
                        
                    # Perform upload
                    log(f"Found new document: {pdf_path}. Uploading as '{title}'...")
                    success = upload_document(token, pdf_path, title)
                    
                    if success:
                        tracker[pdf_path] = {
                            "hash": file_hash,
                            "title": title,
                            "timestamp": time.time(),
                            "status": "success"
                        }
                        save_tracker(tracker)
                        uploaded_count += 1
                    else:
                        failed_count += 1
                        
    log(f"Sweep complete. Uploaded: {uploaded_count}, Skipped: {skipped_count}, Failed: {failed_count}")

if __name__ == "__main__":
    scan_and_upload()
