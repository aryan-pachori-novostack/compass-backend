# Setup Guide for Passport OCR System

This guide will help you set up the Passport OCR system on your machine.

## Table of Contents

1. [Windows Setup](#windows-setup)
2. [macOS Setup](#macos-setup)
3. [Linux Setup](#linux-setup)
4. [Testing the Installation](#testing-the-installation)
5. [Troubleshooting](#troubleshooting)

---

## Windows Setup

### Step 1: Install Python

1. Download Python 3.8 or later from [python.org](https://www.python.org/downloads/)
2. Run the installer
3. **Important**: Check "Add Python to PATH" during installation
4. Verify installation:

```powershell
python --version
```

### Step 2: Install Tesseract OCR

1. Download Tesseract installer from:
   https://github.com/UB-Mannheim/tesseract/wiki

2. Run the installer (e.g., `tesseract-ocr-w64-setup-v5.3.0.exe`)

3. During installation, note the installation path (default: `C:\Program Files\Tesseract-OCR`)

4. Add Tesseract to your PATH:
   - Open "Environment Variables" (search in Start menu)
   - Under "System Variables", find "Path"
   - Click "Edit" → "New"
   - Add: `C:\Program Files\Tesseract-OCR`
   - Click "OK"

5. Verify installation:

```powershell
tesseract --version
```

### Step 3: Install Poppler (for PDF support)

1. Download Poppler for Windows from:
   https://github.com/oschwartz10612/poppler-windows/releases/

2. Extract the ZIP file (e.g., to `C:\Program Files\poppler`)

3. Add Poppler's `bin` folder to PATH:
   - Open "Environment Variables"
   - Edit "Path" system variable
   - Add: `C:\Program Files\poppler\Library\bin`

4. Restart your terminal/PowerShell

### Step 4: Install Python Dependencies

1. Open PowerShell or Command Prompt

2. Navigate to the project folder:

```powershell
cd C:\Users\YourName\Desktop\work\passport_ocr
```

3. (Optional) Create a virtual environment:

```powershell
python -m venv venv
.\venv\Scripts\activate
```

4. Install dependencies:

```powershell
pip install -r requirements.txt
```

### Step 5: Test the Installation

```powershell
python test_passport_ocr.py
```

---

## macOS Setup

### Step 1: Install Homebrew (if not already installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Step 2: Install Python

Python 3 usually comes with macOS, but you can install the latest version:

```bash
brew install python@3.11
```

Verify:

```bash
python3 --version
```

### Step 3: Install Tesseract OCR

```bash
brew install tesseract
```

Verify:

```bash
tesseract --version
```

### Step 4: Install Poppler

```bash
brew install poppler
```

### Step 5: Install Python Dependencies

```bash
cd ~/Desktop/work/passport_ocr

# Optional: create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 6: Test the Installation

```bash
python3 test_passport_ocr.py
```

---

## Linux Setup

### Ubuntu/Debian

#### Step 1: Update System

```bash
sudo apt-get update
sudo apt-get upgrade
```

#### Step 2: Install Python and Dependencies

```bash
sudo apt-get install python3 python3-pip python3-venv
```

#### Step 3: Install Tesseract OCR

```bash
sudo apt-get install tesseract-ocr
```

Verify:

```bash
tesseract --version
```

#### Step 4: Install Poppler

```bash
sudo apt-get install poppler-utils
```

#### Step 5: Install Python Dependencies

```bash
cd ~/Desktop/work/passport_ocr

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Step 6: Test the Installation

```bash
python3 test_passport_ocr.py
```

### Fedora/RHEL/CentOS

```bash
# Install Python
sudo dnf install python3 python3-pip

# Install Tesseract
sudo dnf install tesseract

# Install Poppler
sudo dnf install poppler-utils

# Install Python dependencies
cd ~/Desktop/work/passport_ocr
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Test
python3 test_passport_ocr.py
```

---

## Testing the Installation

### Run Unit Tests

```bash
python test_passport_ocr.py
```

Expected output:
```
test_calculate_check_digit (__main__.TestMRZParser) ... ok
test_parse_date (__main__.TestMRZParser) ... ok
test_validate_valid_passport (__main__.TestPassportValidator) ... ok
...
----------------------------------------------------------------------
Ran X tests in X.XXXs

OK
```

### Test with a Sample Image

If you have a passport image, test it:

```bash
python passport_ocr.py sample_passport.jpg
```

Expected output (JSON):
```json
{
  "success": true,
  "valid_passport": true,
  "document_type": "P",
  "issuing_country": "USA",
  ...
}
```

### Test Debug Mode

```bash
python passport_ocr.py sample_passport.jpg --debug
```

This will create several `debug_*.jpg` images showing the processing steps.

---

## Troubleshooting

### Issue: "tesseract: command not found"

**Solution:**
- Ensure Tesseract is installed
- Verify it's in your PATH: `echo $PATH` (Linux/Mac) or `echo %PATH%` (Windows)
- Try specifying the full path in your code:

```python
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'  # Windows
```

### Issue: "No module named 'cv2'"

**Solution:**
```bash
pip install opencv-python
```

### Issue: "Unable to load any of the engines"

**Solution:**
- Reinstall Tesseract
- Ensure you installed the full version with trained data
- On Windows, make sure to select "Additional language data" during installation

### Issue: PDF processing fails

**Solution:**
- Ensure Poppler is installed
- Verify with: `pdfinfo --version` (should show Poppler version)
- On Windows, ensure Poppler's `bin` folder is in PATH

### Issue: "Could not detect MRZ region in image"

**Possible causes:**
1. Image quality is too low
2. Passport is rotated or skewed
3. MRZ is obscured or cut off

**Solutions:**
- Try with a clearer, higher-resolution image
- Ensure the entire passport is visible
- Try with `--debug` flag to see processing steps
- Manually rotate the image if needed

### Issue: "Could not parse MRZ text"

**Possible causes:**
1. OCR accuracy issues
2. Non-standard MRZ format
3. Poor image quality

**Solutions:**
- Improve image quality (better lighting, higher resolution)
- Try preprocessing the image (sharpen, contrast adjustment)
- Check debug output to see what text was extracted

### Issue: Low OCR accuracy

**Solutions:**
1. Use higher resolution images (at least 300 DPI)
2. Ensure good lighting and contrast
3. The passport should be flat (not curved)
4. Consider training a custom Tesseract model for MRZ fonts

### Issue: ModuleNotFoundError for 'pdf2image'

**Solution:**
```bash
pip install pdf2image
```

Also ensure Poppler is installed (see above).

---

## Verifying Component Versions

Run this Python script to check all components:

```python
import sys
import cv2
import pytesseract
import PIL
from pdf2image import convert_from_path

print(f"Python: {sys.version}")
print(f"OpenCV: {cv2.__version__}")
print(f"Pytesseract: {pytesseract.__version__}")
print(f"Pillow: {PIL.__version__}")

try:
    version = pytesseract.get_tesseract_version()
    print(f"Tesseract: {version}")
except:
    print("Tesseract: NOT FOUND")

try:
    # This will fail if poppler is not installed
    convert_from_path("test.pdf", first_page=1, last_page=1)
except Exception as e:
    if "poppler" in str(e).lower():
        print("Poppler: NOT FOUND")
    else:
        print("Poppler: OK (or test.pdf not found)")
```

---

## Next Steps

Once setup is complete:

1. Read the [README.md](README.md) for usage instructions
2. Review [example_usage.py](example_usage.py) for code examples
3. Test with your own passport images
4. Integrate into your application

---

## Getting Help

If you encounter issues not covered here:

1. Check the [README.md](README.md) for general usage
2. Run with `--debug` flag to see processing steps
3. Review debug images to identify where processing fails
4. Check Tesseract and OpenCV documentation for advanced configuration

## Security Note

When handling passport images:
- Store securely and encrypted
- Delete after processing (if not needed)
- Comply with GDPR and local privacy laws
- Never commit real passport images to version control
- Use secure transmission (HTTPS) for uploads

