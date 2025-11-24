#!/usr/bin/env python3
"""
FastAPI server for Passport OCR microservice
Processes passport images and publishes results to Redis
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from passport_ocr import PassportOCR
import tempfile
import os
import json
import redis
import time
from typing import Optional
from pydantic import BaseModel
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

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

# Initialize OCR processor
ocr = PassportOCR(debug=False)

# Redis configuration
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
ocr_result_channel = os.getenv("OCR_RESULT_CHANNEL", "ocr_results")

# Initialize Redis client
try:
    redis_client = redis.from_url(redis_url, decode_responses=True)
    redis_client.ping()  # Test connection
    print(f"✓ Connected to Redis at {redis_url}")
except Exception as e:
    print(f"Warning: Could not connect to Redis: {e}")
    redis_client = None


class OCRRequest(BaseModel):
    """Request metadata for OCR processing"""
    order_id: str
    traveller_id: str
    document_id: str
    job_id: str


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


class OCRResponse(BaseModel):
    status: str
    job_id: str
    message: str


def publish_ocr_result(job_id: str, order_id: str, traveller_id: str, document_id: str, result: dict):
    """Publish OCR result to Redis channel"""
    if not redis_client:
        print(f"Warning: Redis not available, cannot publish result for job {job_id}")
        return
    
    try:
        message = {
            "job_id": job_id,
            "order_id": order_id,
            "traveller_id": traveller_id,
            "document_id": document_id,
            "result": result,
            "timestamp": int(time.time() * 1000)
        }
        
        redis_client.publish(ocr_result_channel, json.dumps(message))
        print(f"✓ Published OCR result for job {job_id} to channel {ocr_result_channel}")
    except Exception as e:
        print(f"Error publishing OCR result: {e}")


def process_passport_async(
    file_path: str,
    job_id: str,
    order_id: str,
    traveller_id: str,
    document_id: str
):
    """Process passport file asynchronously and publish results"""
    try:
        # Process passport
        result = ocr.process_file(file_path)
        
        # Build response data
        if result.get('success'):
            response_data = {
                "status": "success",
                "data": {
                    "passport_number": result.get('passport_number'),
                    "full_name": f"{result.get('given_names', '')} {result.get('surname', '')}".strip(),
                    "given_names": result.get('given_names'),
                    "surname": result.get('surname'),
                    "nationality": result.get('nationality'),
                    "issuing_country": result.get('issuing_country'),
                    "date_of_birth": result.get('date_of_birth'),
                    "date_of_expiry": result.get('date_of_expiry'),
                    "sex": result.get('sex'),
                    "document_type": result.get('document_type'),
                    "personal_number": result.get('personal_number'),
                    "is_valid": result.get('valid_passport', False),
                    "mrz_checksum_valid": result.get('valid_mrz_checksum', False)
                },
                "validation": {
                    "is_valid": result.get('valid_passport'),
                    "errors": result.get('validation_errors', [])
                },
                "raw_result": result  # Include full result for debugging
            }
        else:
            response_data = {
                "status": "error",
                "error": result.get('error', 'Unknown error occurred'),
                "raw_result": result
            }
        
        # Publish to Redis
        publish_ocr_result(job_id, order_id, traveller_id, document_id, response_data)
        
    except Exception as e:
        error_result = {
            "status": "error",
            "error": f"Server error: {str(e)}"
        }
        publish_ocr_result(job_id, order_id, traveller_id, document_id, error_result)
    finally:
        # Clean up temporary file
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass


@app.post("/api/v1/passport/extract", response_model=OCRResponse)
async def extract_passport(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    order_id: str = None,
    traveller_id: str = None,
    document_id: str = None
):
    """
    Extract passport data from uploaded file (async processing)
    
    - **file**: Passport image (JPG, PNG, PDF) or ZIP archive
    - **order_id**: Order ID (required)
    - **traveller_id**: Traveller ID (required)
    - **document_id**: Document ID (required)
    
    Returns job_id immediately, processes in background
    """
    # Validate required parameters
    if not order_id or not traveller_id or not document_id:
        raise HTTPException(
            status_code=400,
            detail="order_id, traveller_id, and document_id are required as query parameters"
        )
    
    # Validate file type
    allowed_extensions = ['jpg', 'jpeg', 'png', 'pdf', 'zip']
    file_ext = file.filename.split('.')[-1].lower() if file.filename else ''
    
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Generate job ID
    job_id = str(uuid.uuid4())
    
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{file_ext}') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    # Process asynchronously in background
    background_tasks.add_task(
        process_passport_async,
        tmp_path,
        job_id,
        order_id,
        traveller_id,
        document_id
    )
    
    return OCRResponse(
        status="processing",
        job_id=job_id,
        message="Passport processing started. Results will be published to Redis."
    )


@app.get("/api/v1/health")
def health_check():
    """Health check endpoint"""
    redis_status = "connected" if redis_client and redis_client.ping() else "disconnected"
    return {
        "status": "healthy",
        "service": "passport-ocr",
        "redis": redis_status
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

