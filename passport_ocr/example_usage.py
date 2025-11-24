#!/usr/bin/env python3
"""
Example usage of the Passport OCR system
Demonstrates various use cases and API patterns
"""

import json
from passport_ocr import PassportOCR
import cv2


def example_1_basic_usage():
    """Example 1: Basic usage with a single image file"""
    print("=" * 80)
    print("Example 1: Basic Usage")
    print("=" * 80)
    
    # Create OCR processor
    ocr = PassportOCR(debug=False)
    
    # Process a passport image
    result = ocr.process_file('sample_passport.jpg')
    
    # Print results
    print(json.dumps(result, indent=2))
    
    # Check validity
    if result.get('valid_passport'):
        print("\n✓ Valid passport detected!")
    else:
        print("\n✗ Invalid or problematic passport")
        if 'validation_errors' in result:
            print("\nValidation errors:")
            for error in result['validation_errors']:
                print(f"  - {error}")


def example_2_extract_specific_fields():
    """Example 2: Extract and use specific fields"""
    print("\n" + "=" * 80)
    print("Example 2: Extract Specific Fields")
    print("=" * 80)
    
    ocr = PassportOCR()
    result = ocr.process_file('sample_passport.jpg')
    
    if result.get('success'):
        # Extract specific fields for business logic
        full_name = f"{result.get('given_names', '')} {result.get('surname', '')}".strip()
        passport_num = result.get('passport_number', 'N/A')
        nationality = result.get('nationality', 'N/A')
        expiry_date = result.get('date_of_expiry', 'N/A')
        
        print(f"Full Name: {full_name}")
        print(f"Passport Number: {passport_num}")
        print(f"Nationality: {nationality}")
        print(f"Expiry Date: {expiry_date}")
        
        # Check if passport is expired
        from datetime import datetime
        if result.get('date_of_expiry'):
            expiry = datetime.strptime(result['date_of_expiry'], '%Y-%m-%d')
            if expiry < datetime.now():
                print("\n⚠️  WARNING: This passport has EXPIRED!")
            else:
                days_until_expiry = (expiry - datetime.now()).days
                print(f"\n✓ Passport valid for {days_until_expiry} more days")


def example_3_batch_processing():
    """Example 3: Process multiple files"""
    print("\n" + "=" * 80)
    print("Example 3: Batch Processing")
    print("=" * 80)
    
    ocr = PassportOCR()
    
    # List of files to process
    files = [
        'passport1.jpg',
        'passport2.jpg',
        'passport_scan.pdf',
        'passport_images.zip'
    ]
    
    results = []
    
    for file_path in files:
        print(f"\nProcessing: {file_path}")
        result = ocr.process_file(file_path)
        
        if result.get('success'):
            print(f"  ✓ Success - {result.get('given_names')} {result.get('surname')}")
            results.append(result)
        else:
            print(f"  ✗ Failed - {result.get('error')}")
    
    # Save all results to a single JSON file
    with open('batch_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\nProcessed {len(results)} passports successfully")


def example_4_opencv_integration():
    """Example 4: Direct OpenCV integration"""
    print("\n" + "=" * 80)
    print("Example 4: OpenCV Integration")
    print("=" * 80)
    
    ocr = PassportOCR()
    
    # Read image with OpenCV
    image = cv2.imread('sample_passport.jpg')
    
    if image is None:
        print("Could not load image")
        return
    
    # You can do your own preprocessing here
    # For example, rotate the image if needed
    # image = cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    
    # Process the image directly
    result = ocr.process_image(image)
    
    print(json.dumps(result, indent=2))


def example_5_error_handling():
    """Example 5: Robust error handling"""
    print("\n" + "=" * 80)
    print("Example 5: Error Handling")
    print("=" * 80)
    
    ocr = PassportOCR()
    
    file_path = 'passport_to_check.jpg'
    
    try:
        result = ocr.process_file(file_path)
        
        if not result.get('success'):
            # Handle extraction failure
            error_msg = result.get('error', 'Unknown error')
            print(f"Extraction failed: {error_msg}")
            
            # Log for manual review
            with open('failed_extractions.log', 'a') as f:
                f.write(f"File: {file_path} - Error: {error_msg}\n")
            
            return None
        
        if not result.get('valid_passport'):
            # Handle validation failure
            print("Passport validation failed")
            
            errors = result.get('validation_errors', [])
            for error in errors:
                print(f"  - {error}")
            
            # You might want to flag for manual review
            result['requires_manual_review'] = True
        
        return result
        
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return None


def example_6_web_api_simulation():
    """Example 6: Simulating a web API endpoint"""
    print("\n" + "=" * 80)
    print("Example 6: Web API Simulation")
    print("=" * 80)
    
    def process_passport_upload(file_path: str) -> dict:
        """
        Simulate an API endpoint that processes passport uploads
        
        Returns a standardized API response
        """
        ocr = PassportOCR()
        result = ocr.process_file(file_path)
        
        # Build API response
        api_response = {
            'status': 'success' if result.get('success') else 'error',
            'timestamp': '2024-01-01T12:00:00Z',
            'data': None,
            'errors': []
        }
        
        if result.get('success'):
            # Return only relevant fields
            api_response['data'] = {
                'passport_number': result.get('passport_number'),
                'full_name': f"{result.get('given_names', '')} {result.get('surname', '')}".strip(),
                'nationality': result.get('nationality'),
                'date_of_birth': result.get('date_of_birth'),
                'date_of_expiry': result.get('date_of_expiry'),
                'sex': result.get('sex'),
                'issuing_country': result.get('issuing_country'),
                'is_valid': result.get('valid_passport'),
                'mrz_checksum_valid': result.get('valid_mrz_checksum')
            }
            
            if not result.get('valid_passport'):
                api_response['errors'] = result.get('validation_errors', [])
        else:
            api_response['errors'].append(result.get('error'))
        
        return api_response
    
    # Simulate API call
    response = process_passport_upload('sample_passport.jpg')
    print(json.dumps(response, indent=2))


def example_7_data_export():
    """Example 7: Export data for database insertion"""
    print("\n" + "=" * 80)
    print("Example 7: Database Export Format")
    print("=" * 80)
    
    ocr = PassportOCR()
    result = ocr.process_file('sample_passport.jpg')
    
    if result.get('success'):
        # Prepare data for database insertion
        db_record = {
            'passport_number': result.get('passport_number'),
            'first_name': result.get('given_names'),
            'last_name': result.get('surname'),
            'nationality': result.get('nationality'),
            'date_of_birth': result.get('date_of_birth'),
            'sex': result.get('sex'),
            'issue_country': result.get('issuing_country'),
            'expiry_date': result.get('date_of_expiry'),
            'personal_number': result.get('personal_number') or None,
            'is_valid': result.get('valid_passport'),
            'checksum_valid': result.get('valid_mrz_checksum'),
            'validation_notes': ', '.join(result.get('validation_errors', [])) or None,
            'document_type': result.get('document_type')
        }
        
        print("Database record format:")
        print(json.dumps(db_record, indent=2))
        
        # Example SQL (pseudo-code)
        print("\nExample SQL INSERT:")
        print("""
        INSERT INTO passports (
            passport_number, first_name, last_name, nationality,
            date_of_birth, sex, issue_country, expiry_date,
            personal_number, is_valid, checksum_valid, validation_notes
        ) VALUES (
            %(passport_number)s, %(first_name)s, %(last_name)s, %(nationality)s,
            %(date_of_birth)s, %(sex)s, %(issue_country)s, %(expiry_date)s,
            %(personal_number)s, %(is_valid)s, %(checksum_valid)s, %(validation_notes)s
        )
        """)


def example_8_debug_mode():
    """Example 8: Using debug mode for troubleshooting"""
    print("\n" + "=" * 80)
    print("Example 8: Debug Mode")
    print("=" * 80)
    
    # Enable debug mode to save intermediate images
    ocr = PassportOCR(debug=True)
    
    result = ocr.process_file('sample_passport.jpg')
    
    print("Debug mode enabled - intermediate images saved:")
    print("  - debug_blackhat.jpg")
    print("  - debug_gradient.jpg")
    print("  - debug_closed.jpg")
    print("  - debug_thresh.jpg")
    print("  - debug_mrz_detection.jpg")
    print("  - debug_mrz_roi.jpg")
    print("  - debug_ocr_preprocessed.jpg")
    
    print("\nResult:")
    print(json.dumps(result, indent=2))


def main():
    """Run all examples"""
    print("\n")
    print("╔" + "=" * 78 + "╗")
    print("║" + " " * 20 + "PASSPORT OCR EXAMPLES" + " " * 37 + "║")
    print("╚" + "=" * 78 + "╝")
    
    examples = [
        ("Basic Usage", example_1_basic_usage),
        ("Extract Specific Fields", example_2_extract_specific_fields),
        ("Batch Processing", example_3_batch_processing),
        ("OpenCV Integration", example_4_opencv_integration),
        ("Error Handling", example_5_error_handling),
        ("Web API Simulation", example_6_web_api_simulation),
        ("Database Export", example_7_data_export),
        ("Debug Mode", example_8_debug_mode)
    ]
    
    print("\nAvailable examples:")
    for i, (name, _) in enumerate(examples, 1):
        print(f"  {i}. {name}")
    
    print("\nNote: These examples assume you have a 'sample_passport.jpg' file.")
    print("To run examples, uncomment the desired function calls below.\n")
    
    # Uncomment to run specific examples:
    # example_1_basic_usage()
    # example_2_extract_specific_fields()
    # example_3_batch_processing()
    # example_4_opencv_integration()
    # example_5_error_handling()
    # example_6_web_api_simulation()
    # example_7_data_export()
    # example_8_debug_mode()


if __name__ == '__main__':
    main()

