---
name: gcs-cors-setup
description: Configure Google Cloud Storage (GCS) bucket Cross-Origin Resource Sharing (CORS) for direct browser file uploads.
---

# Google Cloud Storage CORS Configuration Guide

Chat.SO uses direct-to-cloud file uploads via V4 Signed PUT URLs. To allow browsers to upload files directly without being blocked by CORS:

## 1. CORS Configuration File (`cors.json`)

```json
[
  {
    "origin": ["http://localhost:5173", "http://localhost:3000", "https://*"],
    "method": ["GET", "PUT", "POST", "OPTIONS", "HEAD"],
    "responseHeader": [
      "Content-Type",
      "Content-Length",
      "Content-Range",
      "ETag",
      "x-goog-resumable",
      "x-goog-meta-*"
    ],
    "maxAgeSeconds": 3600
  }
]
```

## 2. Apply CORS Using Google Cloud CLI

Run the following command using `gcloud storage` or `gsutil`:

```bash
# Using gcloud storage (Recommended)
gcloud storage buckets update gs://YOUR_BUCKET_NAME --cors-file=cors.json

# Using gsutil (Legacy)
gsutil cors set cors.json gs://YOUR_BUCKET_NAME
```

## 3. Verify CORS Settings

```bash
gcloud storage buckets describe gs://YOUR_BUCKET_NAME --format="default(cors)"
```
