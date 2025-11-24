#!/usr/bin/env python3
"""
Unit tests for Passport OCR system
Run with: python -m pytest test_passport_ocr.py -v
Or: python test_passport_ocr.py
"""

import unittest
import numpy as np
import cv2
from passport_ocr import MRZParser, PassportValidator
from datetime import datetime, timedelta


class TestMRZParser(unittest.TestCase):
    """Test MRZ parsing functionality"""
    
    def setUp(self):
        self.parser = MRZParser()
    
    def test_calculate_check_digit(self):
        """Test check digit calculation"""
        # Example from ICAO 9303
        # Passport number: AB2134<<<
        result = self.parser.calculate_check_digit("AB2134<<<")
        self.assertEqual(result, 5)
        
        # Date: 780131 (31 Jan 1978)
        result = self.parser.calculate_check_digit("780131")
        self.assertEqual(result, 7)
    
    def test_verify_check_digit(self):
        """Test check digit verification"""
        # Valid check digits
        self.assertTrue(self.parser.verify_check_digit("AB2134<<<", "5"))
        self.assertTrue(self.parser.verify_check_digit("780131", "7"))
        
        # Invalid check digits
        self.assertFalse(self.parser.verify_check_digit("AB2134<<<", "0"))
        self.assertFalse(self.parser.verify_check_digit("780131", "0"))
    
    def test_parse_date(self):
        """Test date parsing"""
        # Valid dates
        self.assertEqual(self.parser.parse_date("840102"), "1984-01-02")
        self.assertEqual(self.parser.parse_date("201231"), "2020-12-31")
        self.assertEqual(self.parser.parse_date("000101"), "2000-01-01")
        
        # Invalid dates
        self.assertIsNone(self.parser.parse_date("991340"))  # Invalid month
        self.assertIsNone(self.parser.parse_date("990230"))  # Invalid date
        self.assertIsNone(self.parser.parse_date("abc123"))  # Invalid format
    
    def test_parse_td3_mrz_valid(self):
        """Test parsing valid TD3 MRZ"""
        # Example MRZ from a British passport
        mrz_lines = [
            "P<GBRJENNINGS<<PAUL<MICHAEL<<<<<<<<<<<<<<<<",
            "0123456784GBR8411025M08100504<<<<<<<<<<<<<<02"
        ]
        
        result = self.parser.parse_td3_mrz(mrz_lines)
        
        self.assertIsNotNone(result)
        self.assertEqual(result['document_type'], 'P')
        self.assertEqual(result['issuing_country'], 'GBR')
        self.assertEqual(result['surname'], 'JENNINGS')
        self.assertEqual(result['given_names'], 'PAUL MICHAEL')
        self.assertEqual(result['passport_number'], '0123456784')
        self.assertEqual(result['nationality'], 'GBR')
        self.assertEqual(result['date_of_birth'], '1984-11-02')
        self.assertEqual(result['sex'], 'M')
        self.assertEqual(result['date_of_expiry'], '2008-10-05')
    
    def test_parse_td3_mrz_short_lines(self):
        """Test handling of short MRZ lines"""
        mrz_lines = [
            "P<GBR",  # Too short
            "0123456784"
        ]
        
        result = self.parser.parse_td3_mrz(mrz_lines)
        self.assertIsNone(result)
    
    def test_parse_mrz_with_cleanup(self):
        """Test MRZ parsing with text cleanup"""
        # MRZ with spaces (from OCR)
        mrz_text = """
        P<GBR JENNINGS<<PAUL<MICHAEL<<<<<<<<<<<<<<<<
        0123456784 GBR 8411025 M 08100504 <<<<<<<<<<<<<<02
        """
        
        result = self.parser.parse_mrz(mrz_text)
        self.assertIsNotNone(result)
        self.assertEqual(result['surname'], 'JENNINGS')


class TestPassportValidator(unittest.TestCase):
    """Test passport validation functionality"""
    
    def setUp(self):
        self.validator = PassportValidator()
    
    def test_validate_valid_passport(self):
        """Test validation of a valid passport"""
        # Future expiry date
        future_date = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
        
        data = {
            'document_type': 'P',
            'issuing_country': 'USA',
            'nationality': 'USA',
            'surname': 'SMITH',
            'given_names': 'JOHN',
            'passport_number': '123456789',
            'date_of_birth': '1985-01-15',
            'date_of_expiry': future_date,
            'sex': 'M',
            'valid_mrz_checksum': True,
            'check_digits': {
                'passport_number': True,
                'date_of_birth': True,
                'date_of_expiry': True,
                'personal_number': True,
                'composite': True
            }
        }
        
        is_valid, errors = self.validator.validate_passport(data)
        self.assertTrue(is_valid)
        self.assertEqual(len(errors), 0)
    
    def test_validate_expired_passport(self):
        """Test validation of an expired passport"""
        data = {
            'document_type': 'P',
            'issuing_country': 'USA',
            'nationality': 'USA',
            'surname': 'SMITH',
            'given_names': 'JOHN',
            'passport_number': '123456789',
            'date_of_birth': '1985-01-15',
            'date_of_expiry': '2020-01-15',  # Expired
            'sex': 'M',
            'valid_mrz_checksum': True,
            'check_digits': {
                'passport_number': True,
                'date_of_birth': True,
                'date_of_expiry': True,
                'personal_number': True,
                'composite': True
            }
        }
        
        is_valid, errors = self.validator.validate_passport(data)
        self.assertFalse(is_valid)
        self.assertTrue(any('expired' in error.lower() for error in errors))
    
    def test_validate_invalid_country_code(self):
        """Test validation with invalid country code"""
        future_date = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
        
        data = {
            'document_type': 'P',
            'issuing_country': 'XXX',  # Invalid code
            'nationality': 'USA',
            'surname': 'SMITH',
            'given_names': 'JOHN',
            'passport_number': '123456789',
            'date_of_birth': '1985-01-15',
            'date_of_expiry': future_date,
            'sex': 'M',
            'valid_mrz_checksum': True,
            'check_digits': {
                'passport_number': True,
                'date_of_birth': True,
                'date_of_expiry': True,
                'personal_number': True,
                'composite': True
            }
        }
        
        is_valid, errors = self.validator.validate_passport(data)
        self.assertFalse(is_valid)
        self.assertTrue(any('country' in error.lower() for error in errors))
    
    def test_validate_invalid_checksum(self):
        """Test validation with invalid MRZ checksum"""
        future_date = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
        
        data = {
            'document_type': 'P',
            'issuing_country': 'USA',
            'nationality': 'USA',
            'surname': 'SMITH',
            'given_names': 'JOHN',
            'passport_number': '123456789',
            'date_of_birth': '1985-01-15',
            'date_of_expiry': future_date,
            'sex': 'M',
            'valid_mrz_checksum': False,  # Invalid checksum
            'check_digits': {
                'passport_number': False,
                'date_of_birth': True,
                'date_of_expiry': True,
                'personal_number': True,
                'composite': True
            }
        }
        
        is_valid, errors = self.validator.validate_passport(data)
        self.assertFalse(is_valid)
        self.assertTrue(any('checksum' in error.lower() for error in errors))
    
    def test_validate_future_birth_date(self):
        """Test validation with future birth date"""
        future_date = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
        future_birth = (datetime.now() + timedelta(days=30)).strftime('%Y-%m-%d')
        
        data = {
            'document_type': 'P',
            'issuing_country': 'USA',
            'nationality': 'USA',
            'surname': 'SMITH',
            'given_names': 'JOHN',
            'passport_number': '123456789',
            'date_of_birth': future_birth,  # Future date
            'date_of_expiry': future_date,
            'sex': 'M',
            'valid_mrz_checksum': True,
            'check_digits': {
                'passport_number': True,
                'date_of_birth': True,
                'date_of_expiry': True,
                'personal_number': True,
                'composite': True
            }
        }
        
        is_valid, errors = self.validator.validate_passport(data)
        self.assertFalse(is_valid)
        self.assertTrue(any('future' in error.lower() for error in errors))
    
    def test_validate_missing_required_fields(self):
        """Test validation with missing required fields"""
        future_date = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
        
        data = {
            'document_type': 'P',
            'issuing_country': 'USA',
            'nationality': 'USA',
            'surname': '',  # Missing surname
            'given_names': 'JOHN',
            'passport_number': '',  # Missing passport number
            'date_of_birth': '1985-01-15',
            'date_of_expiry': future_date,
            'sex': 'M',
            'valid_mrz_checksum': True,
            'check_digits': {
                'passport_number': True,
                'date_of_birth': True,
                'date_of_expiry': True,
                'personal_number': True,
                'composite': True
            }
        }
        
        is_valid, errors = self.validator.validate_passport(data)
        self.assertFalse(is_valid)
        self.assertTrue(any('surname' in error.lower() for error in errors))
        self.assertTrue(any('passport_number' in error.lower() for error in errors))


class TestMRZCheckDigitCalculations(unittest.TestCase):
    """Test specific MRZ check digit calculations from ICAO 9303 examples"""
    
    def setUp(self):
        self.parser = MRZParser()
    
    def test_example_passport_checksums(self):
        """Test checksums from example passports"""
        # Common test cases
        test_cases = [
            ("L898902C<", 3),  # Passport number
            ("690806", 6),     # Date: 06 Aug 1969
            ("940623", 1),     # Date: 23 Jun 1994
            ("ZE184226<", 1),  # Another passport number
        ]
        
        for data, expected in test_cases:
            with self.subTest(data=data):
                result = self.parser.calculate_check_digit(data)
                self.assertEqual(result, expected, 
                               f"Check digit for '{data}' should be {expected}, got {result}")


def create_test_image():
    """Create a simple test image (for testing image processing pipeline)"""
    # Create a blank white image
    img = np.ones((800, 600, 3), dtype=np.uint8) * 255
    
    # Add some text-like patterns in the bottom (simulating MRZ location)
    # This is just for basic pipeline testing
    cv2.rectangle(img, (50, 600), (550, 700), (0, 0, 0), -1)
    
    return img


class TestImageProcessing(unittest.TestCase):
    """Test image processing pipeline"""
    
    def test_detector_accepts_valid_image(self):
        """Test that detector accepts valid image format"""
        from passport_ocr import MRZDetector
        
        detector = MRZDetector()
        test_image = create_test_image()
        
        # Should not crash
        try:
            result = detector.detect_mrz(test_image)
            # Result may be None (no MRZ found) but shouldn't crash
            self.assertTrue(result is None or isinstance(result, np.ndarray))
        except Exception as e:
            self.fail(f"Detector crashed with valid image: {e}")


def run_tests():
    """Run all tests"""
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestMRZParser))
    suite.addTests(loader.loadTestsFromTestCase(TestPassportValidator))
    suite.addTests(loader.loadTestsFromTestCase(TestMRZCheckDigitCalculations))
    suite.addTests(loader.loadTestsFromTestCase(TestImageProcessing))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Return exit code
    return 0 if result.wasSuccessful() else 1


if __name__ == '__main__':
    exit(run_tests())

