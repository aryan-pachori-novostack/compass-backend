# Test all APIs for Compass Backend

$baseUrl = "http://localhost:3000"
$token = ""

Write-Host "`n=== Testing Compass Backend APIs ===`n" -ForegroundColor Cyan

# Test 1: Health Check
Write-Host "1. Testing GET /health" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -ContentType "application/json"
    Write-Host "   [PASS] Health check passed" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json)" -ForegroundColor Gray
} catch {
    Write-Host "   [FAIL] Health check failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Test 2: Login (POST /auth/login)
Write-Host "`n2. Testing POST /auth/login" -ForegroundColor Yellow
try {
    $loginBody = @{
        email = "example@leverage.com"
        password = "ABCD123"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $loginBody -ContentType "application/json"
    $token = $response.data.token
    Write-Host "   [PASS] Login successful" -ForegroundColor Green
    Write-Host "   Token received: $($token.Substring(0, 20))..." -ForegroundColor Gray
    Write-Host "   Partner: $($response.data.partner.email) ($($response.data.partner.partner_type))" -ForegroundColor Gray
} catch {
    Write-Host "   [FAIL] Login failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "   Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    exit 1
}

# Test 3: Login with invalid credentials
Write-Host "`n3. Testing POST /auth/login (invalid credentials)" -ForegroundColor Yellow
$invalidBody = @{
    email = "invalid@example.com"
    password = "wrongpassword123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $invalidBody -ContentType "application/json"
    Write-Host "   [FAIL] Should have failed but did not" -ForegroundColor Red
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.error -eq "AUTHENTICATION_ERROR") {
        Write-Host "   [PASS] Correctly rejected invalid credentials" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] Unexpected error: $($errorResponse.error)" -ForegroundColor Red
    }
}

# Test 4: Get Countries (GET /country/)
Write-Host "`n4. Testing GET /country/ (protected)" -ForegroundColor Yellow
if ($token) {
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        $response = Invoke-RestMethod -Uri "$baseUrl/country" -Method GET -Headers $headers -ContentType "application/json"
        Write-Host "   [PASS] Countries fetched successfully" -ForegroundColor Green
        Write-Host "   Found $($response.data.Count) countries" -ForegroundColor Gray
        if ($response.data.Count -gt 0) {
            Write-Host "   First country: $($response.data[0].name) ($($response.data[0].iso_code))" -ForegroundColor Gray
        }
    } catch {
        Write-Host "   [FAIL] Failed to fetch countries: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "   Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   [SKIP] No token available" -ForegroundColor Yellow
}

# Test 5: Get Countries without token (should fail)
Write-Host "`n5. Testing GET /country/ (without token - should fail)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/country" -Method GET -ContentType "application/json"
    Write-Host "   [FAIL] Should have failed but did not" -ForegroundColor Red
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.error -eq "UNAUTHORIZED") {
        Write-Host "   [PASS] Correctly rejected request without token" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] Unexpected error: $($errorResponse.error)" -ForegroundColor Red
    }
}

# Test 6: Get Visa Types (GET /visa/:country_id)
Write-Host "`n6. Testing GET /visa/:country_id (protected)" -ForegroundColor Yellow
if ($token) {
    try {
        $headers = @{
            "Authorization" = "Bearer $token"
        }
        $countriesResponse = Invoke-RestMethod -Uri "$baseUrl/country" -Method GET -Headers $headers -ContentType "application/json"
        
        if ($countriesResponse.data.Count -gt 0) {
            $countryId = $countriesResponse.data[0].country_id
            Write-Host "   Using country_id: $countryId ($($countriesResponse.data[0].name))" -ForegroundColor Gray
            
            $visaResponse = Invoke-RestMethod -Uri "$baseUrl/visa/$countryId" -Method GET -Headers $headers -ContentType "application/json"
            Write-Host "   [PASS] Visa types fetched successfully" -ForegroundColor Green
            Write-Host "   Found $($visaResponse.data.Count) visa types" -ForegroundColor Gray
            if ($visaResponse.data.Count -gt 0) {
                $visaType = $visaResponse.data[0]
                Write-Host "   First visa type: $($visaType.name)" -ForegroundColor Gray
                Write-Host "   - Fees: $($visaType.visa_fees.Count)" -ForegroundColor Gray
                Write-Host "   - Required documents: $($visaType.required_documents.Count)" -ForegroundColor Gray
            }
        } else {
            Write-Host "   [SKIP] No countries found" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "   [FAIL] Failed: $($_.Exception.Message)" -ForegroundColor Red
        if ($_.ErrorDetails.Message) {
            Write-Host "   Error details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   [SKIP] No token available" -ForegroundColor Yellow
}

# Test 7: Get Visa Types with invalid country_id
Write-Host "`n7. Testing GET /visa/:country_id (invalid country_id)" -ForegroundColor Yellow
if ($token) {
    $headers = @{
        "Authorization" = "Bearer $token"
    }
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/visa/invalid-country-id-12345" -Method GET -Headers $headers -ContentType "application/json"
        Write-Host "   [FAIL] Should have failed but did not" -ForegroundColor Red
    } catch {
        $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
        if ($errorResponse.error -eq "NOT_FOUND") {
            Write-Host "   [PASS] Correctly returned 404 for invalid country_id" -ForegroundColor Green
        } else {
            Write-Host "   [FAIL] Unexpected error: $($errorResponse.error)" -ForegroundColor Red
        }
    }
} else {
    Write-Host "   [SKIP] No token available" -ForegroundColor Yellow
}

# Test 8: Login validation (missing email)
Write-Host "`n8. Testing POST /auth/login (missing email)" -ForegroundColor Yellow
$invalidBody = @{
    password = "ABCD123"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method POST -Body $invalidBody -ContentType "application/json"
    Write-Host "   [FAIL] Should have failed but did not" -ForegroundColor Red
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.error -eq "VALIDATION_ERROR") {
        Write-Host "   [PASS] Correctly validated missing email" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] Unexpected error: $($errorResponse.error)" -ForegroundColor Red
    }
}

Write-Host "`n=== API Testing Complete ===`n" -ForegroundColor Cyan
