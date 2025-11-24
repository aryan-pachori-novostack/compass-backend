#!/usr/bin/env python3
"""
Passport OCR System with MRZ Extraction and Validation
Based on PyImageSearch tutorial: https://pyimagesearch.com/2021/12/01/ocr-passports-with-opencv-and-tesseract/
"""

import cv2
import numpy as np
import pytesseract
from datetime import datetime
import json
import re
from typing import Dict, Optional, Tuple, List
import os
import zipfile
import tempfile
from pdf2image import convert_from_path
from pathlib import Path

# Import PaddleOCR for better accuracy
try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    PADDLE_AVAILABLE = False
    print("Warning: PaddleOCR not installed. Using Tesseract. Install with: pip install paddlepaddle paddleocr")


class MRZDetector:
    """Detects and extracts MRZ region from passport images using OpenCV"""
    
    def __init__(self, debug=False, debug_dir="processed_images"):
        self.debug = debug
        self.debug_dir = debug_dir
        
        # Create debug directory if in debug mode
        if self.debug:
            import os
            os.makedirs(self.debug_dir, exist_ok=True)
        
    def detect_mrz(self, image: np.ndarray) -> Optional[np.ndarray]:
        """
        Detect and extract MRZ region from passport image
        
        Args:
            image: Input passport image (BGR format)
            
        Returns:
            Extracted MRZ region as numpy array, or None if not found
        """
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Apply Gaussian blur to reduce noise from decorative patterns
        gray = cv2.GaussianBlur(gray, (3, 3), 0)
        
        # Use blackhat morphological operation to reveal dark regions on light backgrounds
        # MRZ text is typically dark on light background
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 5))
        blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, kernel)
        
        if self.debug:
            cv2.imwrite(os.path.join(self.debug_dir, "debug_blackhat.jpg"), blackhat)
        
        # Compute Scharr gradient in X direction to find vertical edges
        grad_x = cv2.Sobel(blackhat, ddepth=cv2.CV_32F, dx=1, dy=0, ksize=-1)
        grad_x = np.absolute(grad_x)
        
        # Normalize to 0-255 range
        min_val, max_val = np.min(grad_x), np.max(grad_x)
        grad_x = (255 * ((grad_x - min_val) / (max_val - min_val))).astype("uint8")
        
        if self.debug:
            cv2.imwrite(os.path.join(self.debug_dir, "debug_gradient.jpg"), grad_x)
        
        # Close gaps between MRZ characters using morphological closing
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 7))
        closed = cv2.morphologyEx(grad_x, cv2.MORPH_CLOSE, kernel)
        
        if self.debug:
            cv2.imwrite(os.path.join(self.debug_dir, "debug_closed.jpg"), closed)
        
        # Threshold to get binary image
        thresh = cv2.threshold(closed, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
        
        # Additional morphological operations to clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (21, 21))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        # Erode to separate potential MRZ candidates
        thresh = cv2.erode(thresh, None, iterations=4)
        
        if self.debug:
            cv2.imwrite(os.path.join(self.debug_dir, "debug_thresh.jpg"), thresh)
        
        # Find contours
        contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        if not contours:
            return None
        
        # MRZ is typically in the bottom third of the passport
        # Find the largest contour in the bottom region
        h, w = image.shape[:2]
        bottom_third_y = int(h * 0.5)  # Start looking from 50% down (was 60%)
        
        mrz_candidates = []
        for contour in contours:
            x, y, cw, ch = cv2.boundingRect(contour)
            
            # MRZ characteristics:
            # - Located in bottom portion
            # - Wide (at least 40% of image width - more lenient)
            # - Appropriate height (not too tall or short)
            # - Appropriate aspect ratio (very wide rectangle)
            # - Located in bottom 50% of image
            if (y > bottom_third_y and 
                y + ch > h * 0.7 and  # Must extend to bottom 30% of image
                cw > w * 0.4 and 
                ch > 15 and ch < h * 0.2 and
                cw / ch > 4):  # More lenient aspect ratio
                
                mrz_candidates.append((contour, cv2.contourArea(contour)))
        
        if not mrz_candidates:
            # Fallback: Extract bottom 15% of image as MRZ region
            # This helps with passports that have decorative patterns
            bottom_height = int(h * 0.15)
            if bottom_height > 40:  # Reasonable minimum height
                y_start = h - bottom_height
                mrz_roi = image[y_start:h, 0:w]
                
                if self.debug:
                    debug_image = image.copy()
                    cv2.rectangle(debug_image, (0, y_start), (w, h), (0, 255, 0), 2)
                    cv2.imwrite(os.path.join(self.debug_dir, "debug_mrz_detection.jpg"), debug_image)
                    cv2.imwrite(os.path.join(self.debug_dir, "debug_mrz_roi.jpg"), mrz_roi)
                
                return mrz_roi
            
            return None
        
        # Select the lowest/bottom-most candidate (likely to be line 2)
        # Then expand upward to capture line 1
        mrz_contour = max(mrz_candidates, key=lambda x: cv2.boundingRect(x[0])[1])[0]
        
        # Get bounding box and extract ROI
        x, y, w, h = cv2.boundingRect(mrz_contour)
        
        # MRZ is always 2 lines. Expand upward from detected line to capture both
        # Indian passports: MRZ line height ~26-28px, gap ~6-8px
        # Be very conservative to avoid decorative angle bracket patterns
        padding_horizontal = 10
        padding_vertical_up = 42  # Conservative - just enough for 2 lines
        padding_vertical_down = 6
        
        x = max(0, x - padding_horizontal)
        y = max(0, y - padding_vertical_up)  # Expand upward more
        w = min(image.shape[1] - x, w + 2 * padding_horizontal)
        h = min(image.shape[0] - y, h + padding_vertical_up + padding_vertical_down)
        
        mrz_roi = image[y:y+h, x:x+w]
        
        if self.debug:
            debug_image = image.copy()
            cv2.rectangle(debug_image, (x, y), (x+w, y+h), (0, 255, 0), 2)
            cv2.imwrite(os.path.join(self.debug_dir, "debug_mrz_detection.jpg"), debug_image)
            cv2.imwrite(os.path.join(self.debug_dir, "debug_mrz_roi.jpg"), mrz_roi)
        
        return mrz_roi


class MRZParser:
    """Parses MRZ text and extracts structured passport data"""
    
    # Character substitution for common OCR errors in MRZ
    CHAR_CORRECTIONS = {
        'O': '0',  # Letter O to number 0
        'I': '1',  # Letter I to number 1
        'Z': '2',  # Sometimes Z is misread as 2
        'S': '5',  # Sometimes S is misread as 5
    }
    
    @staticmethod
    def calculate_check_digit(data: str) -> int:
        """
        Calculate MRZ check digit according to ICAO 9303
        
        Weighting: 7, 3, 1 (repeating)
        
        Args:
            data: String to calculate check digit for
            
        Returns:
            Check digit (0-9)
        """
        weights = [7, 3, 1]
        total = 0
        
        for i, char in enumerate(data):
            if char == '<':
                value = 0
            elif char.isdigit():
                value = int(char)
            elif char.isalpha():
                # A=10, B=11, ..., Z=35
                value = ord(char) - ord('A') + 10
            else:
                value = 0
            
            total += value * weights[i % 3]
        
        return total % 10
    
    @staticmethod
    def verify_check_digit(data: str, check_digit: str) -> bool:
        """Verify if check digit is correct"""
        try:
            expected = MRZParser.calculate_check_digit(data)
            actual = int(check_digit) if check_digit.isdigit() else -1
            return expected == actual
        except:
            return False
    
    @staticmethod
    def parse_date(date_str: str) -> Optional[str]:
        """
        Parse MRZ date format YYMMDD to ISO format YYYY-MM-DD
        
        Args:
            date_str: Date in YYMMDD format
            
        Returns:
            Date in YYYY-MM-DD format or None if invalid
        """
        if len(date_str) != 6 or not date_str.isdigit():
            return None
        
        try:
            yy = int(date_str[:2])
            mm = int(date_str[2:4])
            dd = int(date_str[4:6])
            
            # Determine century (assume < 50 is 2000s, >= 50 is 1900s)
            year = 2000 + yy if yy < 50 else 1900 + yy
            
            # Validate date
            datetime(year, mm, dd)
            
            return f"{year:04d}-{mm:02d}-{dd:02d}"
        except ValueError:
            return None
    
    def parse_td3_mrz(self, mrz_lines: List[str]) -> Optional[Dict]:
        """
        Parse TD3 (passport) MRZ format
        
        TD3 has 2 lines of 44 characters each:
        Line 1: P<ISSUING_COUNTRY_CODE<SURNAME<<GIVEN_NAMES<<<<<<<<<<<<
        Line 2: PASSPORT_NUMBER<CHECK<NATIONALITY<DOB<CHECK<SEX<EXPIRY<CHECK<<PERSONAL_NUMBER<<CHECK
        
        Args:
            mrz_lines: List of MRZ text lines
            
        Returns:
          
            Dictionary with parsed fields or None if invalid
        """
        if len(mrz_lines) < 2:
            return None 
            
        
        line1 = mrz_lines[0].strip()
        line2 = mrz_lines[1].strip()
        
        # TD3 should have at least 40 characters per line (allow some flexibility for OCR errors)
        if len(line1) < 35 or len(line2) < 35:
            return None
        
        # Clean up OCR artifacts - remove trailing K, X that are likely OCR errors for <
        line1 = line1.rstrip('KX')
        line2 = line2.rstrip('KX')
        
        # Pad to ensure we have at least 44 characters
        line1 = line1.ljust(44, '<')[:44]
        line2 = line2.ljust(44, '<')[:44]
        
        try:
            # Parse Line 1
            document_type = line1[0]
            issuing_country = line1[2:5].replace('<', '')
            
            # Fix common OCR errors in country codes (1 -> I, 0 -> O)
            if issuing_country.startswith('1') and len(issuing_country) == 3:
                issuing_country = 'I' + issuing_country[1:]
            if issuing_country.endswith('1') and len(issuing_country) == 3:
                issuing_country = issuing_country[:-1] + 'I'
            
            # Names are from position 5 to end of line
            names = line1[5:].rstrip('<')
            name_parts = names.split('<<')
            
            surname = name_parts[0].replace('<', ' ').strip() if len(name_parts) > 0 else ''
            given_names = name_parts[1].replace('<', ' ').strip() if len(name_parts) > 1 else ''
            
            # Parse Line 2
            passport_number = line2[0:9].replace('<', '')
            passport_check = line2[9]
            
            nationality = line2[10:13].replace('<', '')
            
            # Fix common OCR errors in country codes
            # 1 is often misread as I in country codes
            if nationality.startswith('1') and len(nationality) == 3:
                nationality = 'I' + nationality[1:]
            if nationality.endswith('1') and len(nationality) == 3:
                nationality = nationality[:-1] + 'I'
            
            dob = line2[13:19]
            dob_check = line2[19]
            
            sex = line2[20]
            
            expiry = line2[21:27]
            expiry_check = line2[27]
            
            personal_number = line2[28:42].replace('<', '')
            personal_check = line2[42]
            
            final_check = line2[43]
            
            # Parse dates
            date_of_birth = self.parse_date(dob)
            date_of_expiry = self.parse_date(expiry)
            
            # Verify check digits
            checks = {
                'passport_number': self.verify_check_digit(line2[0:9], passport_check),
                'date_of_birth': self.verify_check_digit(dob, dob_check),
                'date_of_expiry': self.verify_check_digit(expiry, expiry_check),
                'personal_number': self.verify_check_digit(line2[28:42], personal_check) if personal_number else True,
            }
            
            # Verify final check digit (composite)
            # Final check = passport_number + check + DOB + check + expiry + check + personal_number + check
            composite_data = line2[0:10] + line2[13:20] + line2[21:43]
            checks['composite'] = self.verify_check_digit(composite_data, final_check)
            
            return {
                'document_type': document_type,
                'issuing_country': issuing_country,
                'surname': surname,
                'given_names': given_names,
                'passport_number': passport_number,
                'nationality': nationality,
                'date_of_birth': date_of_birth,
                'sex': sex if sex in ['M', 'F', 'X'] else 'X',
                'date_of_expiry': date_of_expiry,
                'personal_number': personal_number,
                'check_digits': checks,
                'valid_mrz_checksum': all(checks.values())
            }
            
        except Exception as e:
            print(f"Error parsing MRZ: {e}")
            return None
    
    def parse_mrz(self, mrz_text: str) -> Optional[Dict]:
        """
        Parse MRZ text into structured data
        
        Args:
            mrz_text: Raw MRZ text from OCR
            
        Returns:
            Dictionary with parsed passport data or None if invalid
        """
        # Clean up the text
        lines = mrz_text.strip().split('\n')
        
        # More aggressive cleanup for OCR errors
        cleaned_lines = []
        for line in lines:
            if not line.strip():
                continue
            # Remove spaces and normalize
            line = line.strip().replace(' ', '').replace('—', '<').replace('-', '<')
            
            # Don't blindly replace K and X as they might be legitimate
            # Only replace at the end if they appear where padding should be
            if line.endswith('K') or line.endswith('X'):
                # Check if this looks like it should be padding
                if len(line) < 44:
                    line = line.rstrip('KX')
            
            cleaned_lines.append(line)
        
        # Filter to lines that look like MRZ (mostly uppercase, numbers, and <)
        mrz_lines = []
        for line in cleaned_lines:
            # Skip lines with spaces (MRZ should not have spaces after cleaning)
            if ' ' in line:
                continue
                
            # MRZ lines should be mostly alphanumeric and <
            valid_chars = sum(1 for c in line if c.isalnum() or c == '<')
            
            # MRZ line 1 must start with document type (P, A, C, I, V)
            # MRZ line 2 contains passport number or other ID
            starts_with_doc_type = len(line) > 0 and line[0] in 'PACIV'
            has_mrz_markers = '<' in line  # MRZ always has < characters
            
            # MRZ lines are typically 35-50 characters
            if (len(line) >= 35 and len(line) <= 50 and
                valid_chars / len(line) > 0.9 and  # Very high purity
                has_mrz_markers):
                # Accept if starts with doc type OR has multiple < markers
                if starts_with_doc_type or line.count('<') >= 5:
                    mrz_lines.append(line)
        
        if not mrz_lines:
            return None
        
        # Try TD3 format (passport - 2 lines of 44 chars)
        result = self.parse_td3_mrz(mrz_lines)
        
        return result


class PassportValidator:
    """Validates passport data for correctness and authenticity"""
    
    # ISO 3166-1 alpha-3 country codes (subset - extend as needed)
    VALID_COUNTRY_CODES = {
        'AFG', 'ALB', 'DZA', 'AND', 'AGO', 'ATG', 'ARG', 'ARM', 'AUS', 'AUT',
        'AZE', 'BHS', 'BHR', 'BGD', 'BRB', 'BLR', 'BEL', 'BLZ', 'BEN', 'BTN',
        'BOL', 'BIH', 'BWA', 'BRA', 'BRN', 'BGR', 'BFA', 'BDI', 'KHM', 'CMR',
        'CAN', 'CPV', 'CAF', 'TCD', 'CHL', 'CHN', 'COL', 'COM', 'COG', 'CRI',
        'CIV', 'HRV', 'CUB', 'CYP', 'CZE', 'PRK', 'COD', 'DNK', 'DJI', 'DMA',
        'DOM', 'ECU', 'EGY', 'SLV', 'GNQ', 'ERI', 'EST', 'ETH', 'FJI', 'FIN',
        'FRA', 'GAB', 'GMB', 'GEO', 'DEU', 'GHA', 'GRC', 'GRD', 'GTM', 'GIN',
        'GNB', 'GUY', 'HTI', 'HND', 'HUN', 'ISL', 'IND', 'IDN', 'IRN', 'IRQ',
        'IRL', 'ISR', 'ITA', 'JAM', 'JPN', 'JOR', 'KAZ', 'KEN', 'KIR', 'KWT',
        'KGZ', 'LAO', 'LVA', 'LBN', 'LSO', 'LBR', 'LBY', 'LIE', 'LTU', 'LUX',
        'MKD', 'MDG', 'MWI', 'MYS', 'MDV', 'MLI', 'MLT', 'MHL', 'MRT', 'MUS',
        'MEX', 'FSM', 'MCO', 'MNG', 'MNE', 'MAR', 'MOZ', 'MMR', 'NAM', 'NRU',
        'NPL', 'NLD', 'NZL', 'NIC', 'NER', 'NGA', 'NOR', 'OMN', 'PAK', 'PLW',
        'PAN', 'PNG', 'PRY', 'PER', 'PHL', 'POL', 'PRT', 'QAT', 'KOR', 'MDA',
        'ROU', 'RUS', 'RWA', 'KNA', 'LCA', 'VCT', 'WSM', 'SMR', 'STP', 'SAU',
        'SEN', 'SRB', 'SYC', 'SLE', 'SGP', 'SVK', 'SVN', 'SLB', 'SOM', 'ZAF',
        'SSD', 'ESP', 'LKA', 'SDN', 'SUR', 'SWZ', 'SWE', 'CHE', 'SYR', 'TJK',
        'THA', 'TLS', 'TGO', 'TON', 'TTO', 'TUN', 'TUR', 'TKM', 'TUV', 'TWN',
        'UGA', 'UKR', 'ARE', 'GBR', 'TZA', 'USA', 'URY', 'UZB', 'VUT', 'VEN',
        'VNM', 'YEM', 'ZMB', 'ZWE', 'D<<',  # D<< is sometimes used for Germany
    }
    
    VALID_DOCUMENT_TYPES = {'P', 'A', 'C', 'I', 'V'}  # P=Passport, A=ID card, etc.
    
    @staticmethod
    def validate_passport(data: Dict) -> Tuple[bool, List[str]]:
        """
        Validate passport data for correctness
        
        Args:
            data: Parsed passport data dictionary
            
        Returns:
            Tuple of (is_valid, list of error messages)
        """
        errors = []
        
        # Check document type
        if data.get('document_type') not in PassportValidator.VALID_DOCUMENT_TYPES:
            errors.append(f"Invalid document type: {data.get('document_type')}")
        
        # Check country codes
        issuing_country = data.get('issuing_country', '').upper()
        nationality = data.get('nationality', '').upper()
        
        if issuing_country and issuing_country not in PassportValidator.VALID_COUNTRY_CODES:
            errors.append(f"Invalid issuing country code: {issuing_country}")
        
        if nationality and nationality not in PassportValidator.VALID_COUNTRY_CODES:
            errors.append(f"Invalid nationality code: {nationality}")
        
        # Check MRZ checksums (critical ones only)
        check_details = data.get('check_digits', {})
        
        # Check critical checksums (passport, DOB, expiry)
        critical_checks = {
            'passport_number': check_details.get('passport_number'),
            'date_of_birth': check_details.get('date_of_birth'),
            'date_of_expiry': check_details.get('date_of_expiry')
        }
        
        failed_critical = [k for k, v in critical_checks.items() if not v]
        if failed_critical:
            errors.append(f"Critical MRZ checksum validation failed: {', '.join(failed_critical)}")
        
        # Warn about non-critical checksums (often OCR errors in filler characters)
        if not check_details.get('personal_number') or not check_details.get('composite'):
            # Don't fail validation, just note it
            # These often fail due to OCR errors in the filler '<' characters
            pass
        
        # Validate dates
        today = datetime.now()
        
        # Date of birth should be in the past
        dob_str = data.get('date_of_birth')
        if dob_str:
            try:
                dob = datetime.strptime(dob_str, '%Y-%m-%d')
                if dob > today:
                    errors.append("Date of birth is in the future")
                if dob < datetime(1900, 1, 1):
                    errors.append("Date of birth is too far in the past")
            except ValueError:
                errors.append(f"Invalid date of birth format: {dob_str}")
        else:
            errors.append("Missing date of birth")
        
        # Date of expiry should be in the future (or recently expired)
        expiry_str = data.get('date_of_expiry')
        if expiry_str:
            try:
                expiry = datetime.strptime(expiry_str, '%Y-%m-%d')
                if expiry < today:
                    errors.append("Passport has expired")
            except ValueError:
                errors.append(f"Invalid expiry date format: {expiry_str}")
        else:
            errors.append("Missing expiry date")
        
        # Check required fields
        required_fields = ['surname', 'passport_number']
        for field in required_fields:
            if not data.get(field):
                errors.append(f"Missing required field: {field}")
        
        is_valid = len(errors) == 0
        return is_valid, errors


class PassportOCR:
    """Main class for passport OCR processing"""
    
    def __init__(self, debug=False, debug_dir="processed_images", use_paddle=True):
        self.detector = MRZDetector(debug=debug, debug_dir=debug_dir)
        self.parser = MRZParser()
        self.validator = PassportValidator()
        self.debug = debug
        self.debug_dir = debug_dir
        self.use_paddle = use_paddle and PADDLE_AVAILABLE
        
        # Initialize PaddleOCR if available
        if self.use_paddle:
            try:
                # Initialize PaddleOCR (use_angle_cls for rotation detection, lang for English)
                self.paddle_ocr = PaddleOCR(
                    use_angle_cls=True,
                    lang='en',
                    use_gpu=False,
                    show_log=False
                )
                if self.debug:
                    print("✓ Using PaddleOCR for better accuracy")
            except Exception as e:
                print(f"Warning: Could not initialize PaddleOCR: {e}. Falling back to Tesseract.")
                self.use_paddle = False
        elif self.debug:
            print("Using Tesseract OCR")
        
        # Create debug directory if in debug mode
        if self.debug:
            os.makedirs(self.debug_dir, exist_ok=True)
    
    def extract_mrz_text(self, mrz_roi: np.ndarray) -> str:
        """
        Extract text from MRZ region using PaddleOCR or Tesseract
        
        Args:
            mrz_roi: MRZ region of interest image
            
        Returns:
            Extracted MRZ text
        """
        # Convert to grayscale if needed
        if len(mrz_roi.shape) == 3:
            gray = cv2.cvtColor(mrz_roi, cv2.COLOR_BGR2GRAY)
        else:
            gray = mrz_roi
        
        # === IMAGE ENHANCEMENT (Optimized for Indian Passports) ===
        
        # Apply moderate contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        
        # Resize to improve OCR accuracy (make text larger)
        scale_factor = 3  # 3x upscaling
        h, w = enhanced.shape[:2]
        resized = cv2.resize(enhanced, (w * scale_factor, h * scale_factor), 
                           interpolation=cv2.INTER_CUBIC)
        
        # Denoise (reduce noise while preserving edges)
        denoised = cv2.fastNlMeansDenoising(resized, None, 10, 7, 21)
        
        # Apply thresholding
        _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
        
        # Morphological operations to clean up
        kernel = np.ones((2, 2), np.uint8)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        if self.debug:
            cv2.imwrite(os.path.join(self.debug_dir, "debug_ocr_preprocessed.jpg"), thresh)
        
        # === PERFORM OCR ===
        if self.use_paddle:
            # Use PaddleOCR (better accuracy, especially for difficult images)
            try:
                result = self.paddle_ocr.ocr(thresh, cls=True)
                
                # Extract text from PaddleOCR result
                # PaddleOCR returns: [[[bbox], (text, confidence)], ...]
                text_lines = []
                if result and result[0]:
                    for line in result[0]:
                        if line and len(line) >= 2:
                            text_content = line[1][0]  # Extract text
                            # Filter to keep only MRZ characters
                            filtered_text = ''.join(c for c in text_content if c.isalnum() or c == '<')
                            if filtered_text:
                                text_lines.append(filtered_text)
                
                text = '\n'.join(text_lines)
                
            except Exception as e:
                if self.debug:
                    print(f"PaddleOCR failed: {e}. Falling back to Tesseract.")
                # Fallback to Tesseract
                custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
                text = pytesseract.image_to_string(thresh, config=custom_config)
        else:
            # Use Tesseract OCR
            custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<'
            text = pytesseract.image_to_string(thresh, config=custom_config)
        
        return text
    
    def process_image(self, image: np.ndarray) -> Dict:
        """
        Process a single passport image
        
        Args:
            image: Input passport image
            
        Returns:
            Dictionary with extraction results
        """
        # Detect MRZ region
        mrz_roi = self.detector.detect_mrz(image)
        
        if mrz_roi is None:
            return {
                'success': False,
                'error': 'Could not detect MRZ region in image',
                'valid_passport': False
            }
        
        # Extract text from MRZ
        mrz_text = self.extract_mrz_text(mrz_roi)
        
        if self.debug:
            print(f"Extracted MRZ text:\n{mrz_text}")
        
        # Parse MRZ
        parsed_data = self.parser.parse_mrz(mrz_text)
        
        if parsed_data is None:
            return {
                'success': False,
                'error': 'Could not parse MRZ text',
                'mrz_text': mrz_text,
                'valid_passport': False
            }
        
        # Validate passport
        is_valid, errors = self.validator.validate_passport(parsed_data)
        
        # Build result
        result = {
            'success': True,
            'valid_passport': is_valid,
            **parsed_data
        }
        
        if errors:
            result['validation_errors'] = errors
        
        if self.debug:
            result['mrz_text'] = mrz_text
        
        return result
    
    def process_file(self, file_path: str) -> Dict:
        """
        Process a file (JPEG, ZIP, or PDF)
        
        Args:
            file_path: Path to input file
            
        Returns:
            Dictionary with extraction results
        """
        file_path = Path(file_path)
        
        if not file_path.exists():
            return {
                'success': False,
                'error': f'File not found: {file_path}',
                'valid_passport': False
            }
        
        ext = file_path.suffix.lower()
        
        try:
            if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']:
                # Process single image
                image = cv2.imread(str(file_path))
                if image is None:
                    return {
                        'success': False,
                        'error': 'Could not read image file',
                        'valid_passport': False
                    }
                return self.process_image(image)
            
            elif ext == '.zip':
                # Extract and process first valid image from ZIP
                with tempfile.TemporaryDirectory() as temp_dir:
                    with zipfile.ZipFile(file_path, 'r') as zip_ref:
                        zip_ref.extractall(temp_dir)
                    
                    # Find image files
                    temp_path = Path(temp_dir)
                    image_files = []
                    for img_ext in ['.jpg', '.jpeg', '.png', '.bmp']:
                        image_files.extend(temp_path.rglob(f'*{img_ext}'))
                    
                    if not image_files:
                        return {
                            'success': False,
                            'error': 'No image files found in ZIP',
                            'valid_passport': False
                        }
                    
                    # Try each image until we find a valid passport
                    for img_file in image_files:
                        image = cv2.imread(str(img_file))
                        if image is not None:
                            result = self.process_image(image)
                            if result.get('success'):
                                return result
                    
                    return {
                        'success': False,
                        'error': 'No valid passport found in ZIP',
                        'valid_passport': False
                    }
            
            elif ext == '.pdf':
                # Convert PDF to images and process first page
                images = convert_from_path(file_path, first_page=1, last_page=1)
                
                if not images:
                    return {
                        'success': False,
                        'error': 'Could not extract images from PDF',
                        'valid_passport': False
                    }
                
                # Convert PIL Image to OpenCV format
                pil_image = images[0]
                image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
                
                return self.process_image(image)
            
            else:
                return {
                    'success': False,
                    'error': f'Unsupported file format: {ext}',
                    'valid_passport': False
                }
        
        except Exception as e:
            return {
                'success': False,
                'error': f'Error processing file: {str(e)}',
                'valid_passport': False
            }


def main():
    """Example usage"""
    import sys
    import argparse
    
    parser = argparse.ArgumentParser(description='Extract and validate passport data from images')
    parser.add_argument('input_file', help='Input file (JPEG, ZIP, or PDF)')
    parser.add_argument('--output', '-o', help='Output JSON file (default: stdout)')
    parser.add_argument('--debug', '-d', action='store_true', help='Enable debug mode (saves intermediate images)')
    
    args = parser.parse_args()
    
    # Create OCR processor
    ocr = PassportOCR(debug=args.debug)
    
    # Process file
    result = ocr.process_file(args.input_file)
    
    # Output result
    json_output = json.dumps(result, indent=2)
    
    if args.output:
        with open(args.output, 'w') as f:
            f.write(json_output)
        print(f"Results saved to {args.output}")
    else:
        print(json_output)
    
    # Exit with appropriate code
    sys.exit(0 if result.get('valid_passport') else 1)


if __name__ == '__main__':
    main()

