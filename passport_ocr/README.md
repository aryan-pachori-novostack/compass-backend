# Passport OCR System

A comprehensive Python implementation for extracting and validating passport data using OpenCV and Tesseract OCR. This system detects the Machine Readable Zone (MRZ) on passport documents, extracts structured data, and performs ICAO 9303 compliant validation.

## Features

- ✅ **MRZ Detection**: Automatically locates the MRZ region using advanced OpenCV image processing techniques
- ✅ **Multiple Input Formats**: Supports JPEG, PNG, ZIP archives, and PDF files
- ✅ **OCR Extraction**: Uses Tesseract OCR to extract text from the MRZ
- ✅ **Structured Parsing**: Parses TD3 (passport) format MRZ into structured JSON
- ✅ **Checksum Validation**: Verifies all ICAO 9303 check digits for data integrity
- ✅ **Comprehensive Validation**: 
  - Date validation (birth date, expiry date)
  - Country code validation (ISO 3166-1 alpha-3)
  - Document type validation
  - Required field validation
- ✅ **JSON Output**: Returns clean, structured JSON with all passport fields
- ✅ **Debug Mode**: Optionally saves intermediate processing images for troubleshooting

## Based On

This implementation follows the methodology described in the PyImageSearch tutorial:
[OCR Passports with OpenCV and Tesseract](https://pyimagesearch.com/2021/12/01/ocr-passports-with-opencv-and-tesseract/)

## Prerequisites

### System Dependencies

#### Tesseract OCR

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install tesseract-ocr
```

**macOS:**
```bash
brew install tesseract
```

**Windows:**
Download and install from: https://github.com/UB-Mannheim/tesseract/wiki

#### Poppler (for PDF support)

**Ubuntu/Debian:**
```bash
sudo apt-get install poppler-utils
```

**macOS:**
```bash
brew install poppler
```

**Windows:**
Download from: https://github.com/oschwartz10612/poppler-windows/releases/

### Python Dependencies

```bash
pip install -r requirements.txt
```

## Installation

1. Clone or download this repository
2. Install system dependencies (Tesseract OCR and Poppler)
3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Command Line

Basic usage:
```bash
python passport_ocr.py input_passport.jpg
```

Save output to JSON file:
```bash
python passport_ocr.py input_passport.jpg --output result.json
```

Enable debug mode (saves intermediate processing images):
```bash
python passport_ocr.py input_passport.jpg --debug
```

Process a PDF:
```bash
python passport_ocr.py passport_scan.pdf
```

Process images in a ZIP archive:
```bash
python passport_ocr.py passport_images.zip
```

### Python API

```python
from passport_ocr import PassportOCR
import json

# Create OCR processor
ocr = PassportOCR(debug=False)

# Process a file
result = ocr.process_file('passport.jpg')

# Print JSON output
print(json.dumps(result, indent=2))

# Check if passport is valid
if result.get('valid_passport'):
    print("✓ Valid passport")
    print(f"Name: {result['given_names']} {result['surname']}")
    print(f"Passport #: {result['passport_number']}")
    print(f"Expiry: {result['date_of_expiry']}")
else:
    print("✗ Invalid passport")
    if 'validation_errors' in result:
        for error in result['validation_errors']:
            print(f"  - {error}")
```

### Processing Individual Images

```python
import cv2
from passport_ocr import PassportOCR

# Load image
image = cv2.imread('passport.jpg')

# Create OCR processor
ocr = PassportOCR()

# Process image
result = ocr.process_image(image)

print(result)
```

## Output Format

The system returns a JSON object with the following structure:

### Successful Extraction

```json
{
  "success": true,
  "valid_passport": true,
  "document_type": "P",
  "issuing_country": "GBR",
  "surname": "JENNINGS",
  "given_names": "PAUL MICHAEL",
  "passport_number": "0123456784",
  "nationality": "GBR",
  "date_of_birth": "1984-11-02",
  "sex": "M",
  "date_of_expiry": "2008-10-05",
  "personal_number": "",
  "check_digits": {
    "passport_number": true,
    "date_of_birth": true,
    "date_of_expiry": true,
    "personal_number": true,
    "composite": true
  },
  "valid_mrz_checksum": true
}
```

### Validation Errors

If validation fails, the output includes details:

```json
{
  "success": true,
  "valid_passport": false,
  "document_type": "P",
  "issuing_country": "GBR",
  "surname": "JENNINGS",
  "given_names": "PAUL MICHAEL",
  "passport_number": "0123456784",
  "nationality": "GBR",
  "date_of_birth": "1984-11-02",
  "sex": "M",
  "date_of_expiry": "2008-10-05",
  "personal_number": "",
  "valid_mrz_checksum": true,
  "validation_errors": [
    "Passport has expired"
  ]
}
```

### Extraction Failure

```json
{
  "success": false,
  "error": "Could not detect MRZ region in image",
  "valid_passport": false
}
```

## How It Works

### 1. MRZ Detection (`MRZDetector`)

The system uses morphological operations to locate the MRZ:

1. **Blackhat Operation**: Reveals dark text on light background
2. **Gradient Calculation**: Finds vertical edges using Sobel operator
3. **Morphological Closing**: Connects MRZ characters into a single region
4. **Thresholding**: Creates binary image
5. **Contour Detection**: Finds candidate regions
6. **Region Filtering**: Selects MRZ based on:
   - Location (bottom portion of document)
   - Size (wide rectangular region)
   - Aspect ratio (width >> height)

### 2. OCR Extraction

1. **Preprocessing**: 
   - Upscaling for better OCR accuracy
   - Thresholding to enhance contrast
2. **Tesseract OCR**:
   - Configured for MRZ character set (A-Z, 0-9, <)
   - PSM 6 mode (uniform block of text)

### 3. MRZ Parsing (`MRZParser`)

Parses TD3 format (passport - 2 lines of 44 characters):

**Line 1:** `P<COUNTRY<SURNAME<<GIVEN_NAMES<<<<<<<<<<<<`
**Line 2:** `PASSPORT_NUM<C<NAT<DOB<C<SEX<EXP<C<<PERSONAL<C`

Where `C` represents check digits.

### 4. Checksum Validation

Implements ICAO 9303 check digit algorithm:
- Weights: 7, 3, 1 (repeating)
- Character values: 0-9 (numeric), A=10, B=11, ..., Z=35, <=0
- Validates:
  - Passport number check digit
  - Date of birth check digit
  - Expiry date check digit
  - Personal number check digit
  - Composite check digit (overall MRZ integrity)

### 5. Passport Validation (`PassportValidator`)

Performs comprehensive validation:
- **Document Type**: Must be valid (P, A, C, I, V)
- **Country Codes**: Must be valid ISO 3166-1 alpha-3 codes
- **Date of Birth**: Must be in the past and reasonable
- **Expiry Date**: Should be in the future (flags if expired)
- **Required Fields**: Surname and passport number must be present
- **MRZ Checksums**: All check digits must be valid

## Field Descriptions

| Field | Description | Example |
|-------|-------------|---------|
| `document_type` | Type of document (P=Passport) | "P" |
| `issuing_country` | Country that issued the document (ISO 3166-1 alpha-3) | "USA" |
| `surname` | Family name / Last name | "SMITH" |
| `given_names` | Given names / First and middle names | "JOHN MICHAEL" |
| `passport_number` | Passport number | "123456789" |
| `nationality` | Nationality (ISO 3166-1 alpha-3) | "USA" |
| `date_of_birth` | Birth date (ISO 8601 format) | "1985-03-15" |
| `sex` | Sex (M/F/X) | "M" |
| `date_of_expiry` | Expiry date (ISO 8601 format) | "2030-03-15" |
| `personal_number` | Optional personal identification number | "" |
| `valid_mrz_checksum` | Whether all MRZ checksums are valid | true |
| `valid_passport` | Overall validation result | true |

## Debug Mode

Enable debug mode to save intermediate processing images:

```bash
python passport_ocr.py passport.jpg --debug
```

Debug images saved:
- `debug_blackhat.jpg` - After blackhat morphological operation
- `debug_gradient.jpg` - After gradient calculation
- `debug_closed.jpg` - After morphological closing
- `debug_thresh.jpg` - After thresholding
- `debug_mrz_detection.jpg` - MRZ region highlighted on original image
- `debug_mrz_roi.jpg` - Extracted MRZ region
- `debug_ocr_preprocessed.jpg` - MRZ after preprocessing for OCR

## Limitations & Improvements

### Current Limitations

1. **OCR Accuracy**: Tesseract is not 100% accurate with MRZ fonts. Some characters may be misread, especially:
   - O/0 (letter O vs digit 0)
   - I/1 (letter I vs digit 1)
   - S/5, Z/2 confusion

2. **Image Quality**: Requires reasonably clear images. Blurry, rotated, or low-resolution images may fail.

3. **Format Support**: Currently supports TD3 (passport) format only. TD1 (ID cards) and TD2 formats not yet implemented.

4. **Orientation**: Assumes passport is right-side up. Rotation detection not implemented.

### Suggested Improvements

1. **Custom OCR Model**: Train a custom Tesseract model or use deep learning (e.g., CRNN) specifically for MRZ fonts
2. **Rotation Detection**: Add skew detection and correction
3. **Multiple Format Support**: Implement TD1 and TD2 parsers
4. **Character Correction**: Use check digits to automatically correct OCR errors
5. **Enhanced Preprocessing**: Adaptive thresholding, denoising, perspective correction
6. **Confidence Scores**: Return OCR confidence scores for each field
7. **Visual Inspection Zone (VIZ)**: Extract data from the human-readable portion of the passport

## Troubleshooting

### "Could not detect MRZ region in image"

- Ensure the image shows the full passport
- Check that the MRZ is visible and not obscured
- Try improving image quality (higher resolution, better lighting)
- Enable debug mode to see intermediate processing steps

### "Could not parse MRZ text"

- MRZ text was detected but couldn't be parsed
- Usually indicates poor OCR quality
- Try with a clearer image
- Check debug output to see extracted text

### OCR Errors

- Install latest version of Tesseract OCR
- Ensure Tesseract is in your system PATH
- On Windows, you may need to set the Tesseract path:
  ```python
  pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
  ```

### PDF Processing Errors

- Ensure Poppler is installed and in your PATH
- Try converting PDF to image manually first
- Check if PDF is encrypted or password-protected

## License

This project is provided as-is for educational and commercial use.

## Contributing

Contributions are welcome! Areas for improvement:
- Additional MRZ format support (TD1, TD2)
- OCR accuracy improvements
- Additional validation rules
- Multi-language support
- Web API wrapper

## References

- [PyImageSearch Tutorial: OCR Passports with OpenCV and Tesseract](https://pyimagesearch.com/2021/12/01/ocr-passports-with-opencv-and-tesseract/)
- [ICAO 9303 Machine Readable Travel Documents](https://www.icao.int/publications/pages/publication.aspx?docnum=9303)
- [OpenCV Documentation](https://docs.opencv.org/)
- [Tesseract OCR Documentation](https://tesseract-ocr.github.io/)

## Author

Built for passport data extraction and validation with business analyst requirements in mind.

