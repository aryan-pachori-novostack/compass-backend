/**
 * Test script for Order Initiation with OCR
 * Tests the complete flow: Login -> Create Order with Passport -> Check OCR Status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'example@leverage.com';
const TEST_PASSWORD = 'ABCD123';

async function testOrderOCR() {
  try {
    console.log('🧪 Testing Order Initiation with OCR...\n');

    // Step 1: Login
    console.log('1. Logging in...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.text();
      throw new Error(`Login failed: ${loginResponse.status} - ${error}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.data.token;
    console.log('✓ Login successful\n');

    // Step 2: Get countries and visa types (to get valid IDs)
    console.log('2. Fetching countries...');
    const countriesResponse = await fetch(`${BASE_URL}/country`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!countriesResponse.ok) {
      throw new Error('Failed to fetch countries');
    }

    const countriesData = await countriesResponse.json();
    const countries = countriesData.data || [];
    
    if (countries.length === 0) {
      throw new Error('No countries found. Please seed the database first.');
    }

    const firstCountry = countries[0];
    console.log(`✓ Found country: ${firstCountry.name} (${firstCountry.country_id})\n`);

    // Step 3: Get visa types for the country
    console.log('3. Fetching visa types...');
    const visaResponse = await fetch(`${BASE_URL}/visa/${firstCountry.id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!visaResponse.ok) {
      throw new Error('Failed to fetch visa types');
    }

    const visaData = await visaResponse.json();
    const visaTypes = visaData.data || [];

    if (visaTypes.length === 0) {
      throw new Error('No visa types found for this country.');
    }

    const firstVisaType = visaTypes[0];
    console.log(`✓ Found visa type: ${firstVisaType.name} (${firstVisaType.id})\n`);

    // Step 4: Create order with passport file
    console.log('4. Creating order with passport file...');
    console.log('   Note: This requires a passport image file.');
    console.log('   For testing, you can use: passport_ocr/passport.jpg\n');

    // Check if passport file exists
    const passportPath = path.join(__dirname, 'passport_ocr', 'passport.jpg');
    
    if (!fs.existsSync(passportPath)) {
      console.log('⚠️  Passport file not found. Skipping order creation.');
      console.log('   To test OCR, create an order via API with a passport file.\n');
      return;
    }

    // Create form data using built-in FormData
    const formData = new FormData();
    formData.append('order_type', 'INDIVIDUAL');
    formData.append('visa_type_id', firstVisaType.id);
    formData.append('country_id', firstCountry.id);
    formData.append('traveller_name', 'Test Traveller');
    
    // Read file as buffer and create blob
    const fileBuffer = fs.readFileSync(passportPath);
    const fileBlob = new Blob([fileBuffer], { type: 'image/jpeg' });
    formData.append('zip_file', fileBlob, 'passport.jpg');

    const orderResponse = await fetch(`${BASE_URL}/order`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!orderResponse.ok) {
      const error = await orderResponse.text();
      throw new Error(`Order creation failed: ${orderResponse.status} - ${error}`);
    }

    const orderData = await orderResponse.json();
    const order = orderData.data;
    console.log(`✓ Order created: ${order.order_id}\n`);

    // Step 5: Check OCR status
    console.log('5. Checking OCR status...');
    console.log('   Waiting 2 seconds for OCR processing to start...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const ocrStatusResponse = await fetch(`${BASE_URL}/ocr/status/${order.order_id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!ocrStatusResponse.ok) {
      const error = await ocrStatusResponse.text();
      throw new Error(`OCR status check failed: ${ocrStatusResponse.status} - ${error}`);
    }

    const ocrStatusData = await ocrStatusResponse.json();
    console.log('✓ OCR Status:');
    console.log(JSON.stringify(ocrStatusData, null, 2));
    console.log('\n');

    // Step 6: Poll for OCR completion
    console.log('6. Polling for OCR completion (max 30 seconds)...');
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;

      const statusResponse = await fetch(`${BASE_URL}/ocr/status/${order.order_id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const travellers = statusData.data.travellers || [];
        
        let allCompleted = true;
        for (const traveller of travellers) {
          for (const doc of traveller.documents || []) {
            if (doc.ocr_status === 'PROCESSING' || doc.ocr_status === 'PENDING') {
              allCompleted = false;
            }
            if (doc.ocr_status === 'COMPLETED' && doc.extracted_data) {
              console.log(`\n✓ OCR Completed for ${traveller.full_name}:`);
              console.log(`  Passport Number: ${doc.extracted_data.passport_number || 'N/A'}`);
              console.log(`  Full Name: ${doc.extracted_data.full_name || 'N/A'}`);
              console.log(`  Expiry Date: ${doc.extracted_data.date_of_expiry || 'N/A'}`);
            }
          }
        }

        if (allCompleted) {
          console.log('\n✓ All OCR processing completed!\n');
          break;
        }
      }

      process.stdout.write(`\r   Attempt ${attempts}/${maxAttempts}...`);
    }

    console.log('\n✅ Test completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testOrderOCR();
