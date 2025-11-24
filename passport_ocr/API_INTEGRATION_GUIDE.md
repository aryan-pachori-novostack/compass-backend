# API Integration Guide

This guide shows how to integrate the Passport OCR system into various application types.

## Table of Contents

1. [Flask REST API](#flask-rest-api)
2. [FastAPI Implementation](#fastapi-implementation)
3. [Django Integration](#django-integration)
4. [Batch Processing Script](#batch-processing-script)
5. [Webhook Integration](#webhook-integration)
6. [Database Integration](#database-integration)

---

## Flask REST API

### Installation

```bash
pip install flask flask-cors
```

### Implementation

Create `app_flask.py`:

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from passport_ocr import PassportOCR
import os
from werkzeug.utils import secure_filename
import tempfile

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'pdf', 'zip'}
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Initialize OCR processor
ocr = PassportOCR(debug=False)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/v1/passport/extract', methods=['POST'])
def extract_passport():
    """
    Extract passport data from uploaded file
    
    Accepts: multipart/form-data with 'file' field
    Returns: JSON with passport data
    """
    # Check if file is present
    if 'file' not in request.files:
        return jsonify({
            'status': 'error',
            'message': 'No file provided'
        }), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({
            'status': 'error',
            'message': 'Empty filename'
        }), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            'status': 'error',
            'message': 'Invalid file type. Allowed: jpg, jpeg, png, pdf, zip'
        }), 400
    
    try:
        # Save uploaded file temporarily
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        # Process passport
        result = ocr.process_file(filepath)
        
        # Clean up temporary file
        os.remove(filepath)
        
        # Build response
        if result.get('success'):
            response = {
                'status': 'success',
                'data': {
                    'passport_number': result.get('passport_number'),
                    'full_name': f"{result.get('given_names', '')} {result.get('surname', '')}".strip(),
                    'given_names': result.get('given_names'),
                    'surname': result.get('surname'),
                    'nationality': result.get('nationality'),
                    'issuing_country': result.get('issuing_country'),
                    'date_of_birth': result.get('date_of_birth'),
                    'date_of_expiry': result.get('date_of_expiry'),
                    'sex': result.get('sex'),
                    'document_type': result.get('document_type'),
                    'personal_number': result.get('personal_number'),
                    'is_valid': result.get('valid_passport'),
                    'mrz_checksum_valid': result.get('valid_mrz_checksum')
                },
                'validation': {
                    'is_valid': result.get('valid_passport'),
                    'errors': result.get('validation_errors', [])
                }
            }
            return jsonify(response), 200
        else:
            return jsonify({
                'status': 'error',
                'message': result.get('error', 'Unknown error occurred')
            }), 422
    
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Server error: {str(e)}'
        }), 500

@app.route('/api/v1/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'passport-ocr'
    }), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```

### Usage

```bash
# Start server
python app_flask.py

# Test with curl
curl -X POST http://localhost:5000/api/v1/passport/extract \
  -F "file=@passport.jpg"
```

---

## FastAPI Implementation

### Installation

```bash
pip install fastapi uvicorn python-multipart
```

### Implementation

Create `app_fastapi.py`:

```python
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from passport_ocr import PassportOCR
import tempfile
import os
from typing import Optional
from pydantic import BaseModel

app = FastAPI(
    title="Passport OCR API",
    description="Extract and validate passport data using OCR",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OCR
ocr = PassportOCR(debug=False)

class PassportData(BaseModel):
    passport_number: Optional[str]
    full_name: str
    given_names: Optional[str]
    surname: Optional[str]
    nationality: Optional[str]
    issuing_country: Optional[str]
    date_of_birth: Optional[str]
    date_of_expiry: Optional[str]
    sex: Optional[str]
    document_type: Optional[str]
    personal_number: Optional[str]
    is_valid: bool
    mrz_checksum_valid: bool

class PassportResponse(BaseModel):
    status: str
    data: Optional[PassportData]
    validation: dict

@app.post("/api/v1/passport/extract", response_model=PassportResponse)
async def extract_passport(file: UploadFile = File(...)):
    """
    Extract passport data from uploaded file
    
    - **file**: Passport image (JPG, PNG, PDF) or ZIP archive
    """
    # Validate file type
    allowed_extensions = ['jpg', 'jpeg', 'png', 'pdf', 'zip']
    file_ext = file.filename.split('.')[-1].lower()
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Process passport
        result = ocr.process_file(tmp_path)
        
        if result.get('success'):
            return PassportResponse(
                status="success",
                data=PassportData(
                    passport_number=result.get('passport_number'),
                    full_name=f"{result.get('given_names', '')} {result.get('surname', '')}".strip(),
                    given_names=result.get('given_names'),
                    surname=result.get('surname'),
                    nationality=result.get('nationality'),
                    issuing_country=result.get('issuing_country'),
                    date_of_birth=result.get('date_of_birth'),
                    date_of_expiry=result.get('date_of_expiry'),
                    sex=result.get('sex'),
                    document_type=result.get('document_type'),
                    personal_number=result.get('personal_number'),
                    is_valid=result.get('valid_passport', False),
                    mrz_checksum_valid=result.get('valid_mrz_checksum', False)
                ),
                validation={
                    'is_valid': result.get('valid_passport'),
                    'errors': result.get('validation_errors', [])
                }
            )
        else:
            raise HTTPException(
                status_code=422,
                detail=result.get('error', 'Could not process passport')
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.get("/api/v1/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "passport-ocr"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### Usage

```bash
# Start server
python app_fastapi.py

# Or with uvicorn directly
uvicorn app_fastapi:app --reload --host 0.0.0.0 --port 8000

# Test with curl
curl -X POST http://localhost:8000/api/v1/passport/extract \
  -F "file=@passport.jpg"

# View API docs
# Open http://localhost:8000/docs
```

---

## Django Integration

### Installation

```bash
pip install django djangorestframework
```

### Implementation

#### Create Django app

```bash
django-admin startproject myproject
cd myproject
python manage.py startapp passport_app
```

#### `passport_app/views.py`

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from passport_ocr import PassportOCR
import tempfile
import os

class PassportExtractView(APIView):
    parser_classes = (MultiPartParser,)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.ocr = PassportOCR(debug=False)
    
    def post(self, request):
        """Extract passport data from uploaded file"""
        if 'file' not in request.FILES:
            return Response(
                {'status': 'error', 'message': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        file_obj = request.FILES['file']
        
        # Validate file type
        allowed_extensions = ['jpg', 'jpeg', 'png', 'pdf', 'zip']
        file_ext = file_obj.name.split('.')[-1].lower()
        
        if file_ext not in allowed_extensions:
            return Response(
                {'status': 'error', 'message': 'Invalid file type'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Save temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as tmp:
            for chunk in file_obj.chunks():
                tmp.write(chunk)
            tmp_path = tmp.name
        
        try:
            # Process passport
            result = self.ocr.process_file(tmp_path)
            
            if result.get('success'):
                return Response({
                    'status': 'success',
                    'data': {
                        'passport_number': result.get('passport_number'),
                        'full_name': f"{result.get('given_names', '')} {result.get('surname', '')}".strip(),
                        'nationality': result.get('nationality'),
                        'date_of_birth': result.get('date_of_birth'),
                        'date_of_expiry': result.get('date_of_expiry'),
                        'is_valid': result.get('valid_passport')
                    },
                    'validation': {
                        'is_valid': result.get('valid_passport'),
                        'errors': result.get('validation_errors', [])
                    }
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    'status': 'error',
                    'message': result.get('error')
                }, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
```

#### `passport_app/urls.py`

```python
from django.urls import path
from .views import PassportExtractView

urlpatterns = [
    path('api/v1/passport/extract', PassportExtractView.as_view(), name='passport-extract'),
]
```

---

## Batch Processing Script

Process multiple passports from a directory:

Create `batch_process.py`:

```python
#!/usr/bin/env python3
"""Batch process passport images from a directory"""

import os
import json
from pathlib import Path
from passport_ocr import PassportOCR
import argparse
from tqdm import tqdm

def batch_process(input_dir, output_dir, debug=False):
    """
    Process all passport images in a directory
    
    Args:
        input_dir: Directory containing passport images
        output_dir: Directory to save results
        debug: Enable debug mode
    """
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Initialize OCR
    ocr = PassportOCR(debug=debug)
    
    # Find all image files
    input_path = Path(input_dir)
    image_files = []
    for ext in ['*.jpg', '*.jpeg', '*.png', '*.pdf']:
        image_files.extend(input_path.glob(ext))
    
    print(f"Found {len(image_files)} files to process")
    
    # Process each file
    results = []
    successful = 0
    failed = 0
    
    for img_file in tqdm(image_files, desc="Processing passports"):
        try:
            result = ocr.process_file(str(img_file))
            result['filename'] = img_file.name
            results.append(result)
            
            if result.get('success'):
                successful += 1
                
                # Save individual result
                output_file = Path(output_dir) / f"{img_file.stem}_result.json"
                with open(output_file, 'w') as f:
                    json.dump(result, f, indent=2)
            else:
                failed += 1
        
        except Exception as e:
            print(f"\nError processing {img_file.name}: {e}")
            failed += 1
    
    # Save summary
    summary_file = Path(output_dir) / "batch_summary.json"
    with open(summary_file, 'w') as f:
        json.dump({
            'total_files': len(image_files),
            'successful': successful,
            'failed': failed,
            'results': results
        }, f, indent=2)
    
    print(f"\n{'='*60}")
    print(f"Processing complete!")
    print(f"Total files: {len(image_files)}")
    print(f"Successful: {successful}")
    print(f"Failed: {failed}")
    print(f"Results saved to: {output_dir}")
    print(f"{'='*60}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Batch process passport images')
    parser.add_argument('input_dir', help='Directory containing passport images')
    parser.add_argument('--output', '-o', default='results', help='Output directory for results')
    parser.add_argument('--debug', '-d', action='store_true', help='Enable debug mode')
    
    args = parser.parse_args()
    
    batch_process(args.input_dir, args.output, args.debug)
```

Usage:

```bash
pip install tqdm
python batch_process.py /path/to/passports --output results
```

---

## Webhook Integration

Send results to a webhook after processing:

```python
import requests
from passport_ocr import PassportOCR

def process_and_notify(image_path, webhook_url):
    """Process passport and send results to webhook"""
    ocr = PassportOCR()
    result = ocr.process_file(image_path)
    
    # Send to webhook
    response = requests.post(webhook_url, json=result, timeout=30)
    
    if response.status_code == 200:
        print("Successfully sent to webhook")
    else:
        print(f"Webhook failed: {response.status_code}")
    
    return result

# Usage
process_and_notify('passport.jpg', 'https://your-api.com/webhook/passport')
```

---

## Database Integration

### SQLAlchemy (Python)

```python
from sqlalchemy import create_engine, Column, Integer, String, Date, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from passport_ocr import PassportOCR
from datetime import datetime

Base = declarative_base()

class Passport(Base):
    __tablename__ = 'passports'
    
    id = Column(Integer, primary_key=True)
    passport_number = Column(String(50), unique=True, nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    nationality = Column(String(3))
    date_of_birth = Column(Date)
    date_of_expiry = Column(Date)
    sex = Column(String(1))
    issuing_country = Column(String(3))
    is_valid = Column(Boolean)
    checksum_valid = Column(Boolean)
    created_at = Column(Date, default=datetime.utcnow)

# Create database
engine = create_engine('sqlite:///passports.db')
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)

def save_passport_to_db(image_path):
    """Extract passport data and save to database"""
    ocr = PassportOCR()
    result = ocr.process_file(image_path)
    
    if result.get('success'):
        session = Session()
        
        try:
            passport = Passport(
                passport_number=result.get('passport_number'),
                first_name=result.get('given_names'),
                last_name=result.get('surname'),
                nationality=result.get('nationality'),
                date_of_birth=datetime.strptime(result['date_of_birth'], '%Y-%m-%d').date() if result.get('date_of_birth') else None,
                date_of_expiry=datetime.strptime(result['date_of_expiry'], '%Y-%m-%d').date() if result.get('date_of_expiry') else None,
                sex=result.get('sex'),
                issuing_country=result.get('issuing_country'),
                is_valid=result.get('valid_passport'),
                checksum_valid=result.get('valid_mrz_checksum')
            )
            
            session.add(passport)
            session.commit()
            print(f"Saved passport {passport.passport_number} to database")
            
        except Exception as e:
            session.rollback()
            print(f"Error saving to database: {e}")
        finally:
            session.close()
    else:
        print(f"Failed to extract passport data: {result.get('error')}")

# Usage
save_passport_to_db('passport.jpg')
```

---

## Frontend Integration Examples

### JavaScript (Fetch API)

```javascript
async function uploadPassport(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('http://localhost:8000/api/v1/passport/extract', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.status === 'success') {
            console.log('Passport data:', result.data);
            displayPassportData(result.data);
        } else {
            console.error('Error:', result.message);
        }
    } catch (error) {
        console.error('Upload failed:', error);
    }
}

// HTML
// <input type="file" id="passportFile" accept=".jpg,.jpeg,.png,.pdf">
document.getElementById('passportFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        uploadPassport(file);
    }
});
```

### React Example

```jsx
import React, { useState } from 'react';
import axios from 'axios';

function PassportUploader() {
    const [passportData, setPassportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        setLoading(true);
        setError(null);
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await axios.post(
                'http://localhost:8000/api/v1/passport/extract',
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            
            setPassportData(response.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Upload failed');
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <div>
            <input type="file" onChange={handleFileUpload} accept=".jpg,.jpeg,.png,.pdf" />
            
            {loading && <p>Processing...</p>}
            {error && <p style={{color: 'red'}}>{error}</p>}
            
            {passportData && (
                <div>
                    <h3>Passport Information</h3>
                    <p>Name: {passportData.full_name}</p>
                    <p>Passport #: {passportData.passport_number}</p>
                    <p>Nationality: {passportData.nationality}</p>
                    <p>Valid: {passportData.is_valid ? '✓' : '✗'}</p>
                </div>
            )}
        </div>
    );
}
```

---

## Production Considerations

1. **Rate Limiting**: Implement rate limiting to prevent abuse
2. **Authentication**: Add API key or OAuth authentication
3. **File Size Limits**: Enforce reasonable file size limits
4. **Async Processing**: Use Celery or similar for long-running tasks
5. **Caching**: Cache results for duplicate requests
6. **Monitoring**: Add logging and monitoring
7. **Error Handling**: Comprehensive error handling and reporting
8. **Security**: Sanitize file uploads, use virus scanning
9. **Data Privacy**: Implement data retention policies, encryption
10. **Scalability**: Consider containerization (Docker) and orchestration (Kubernetes)

