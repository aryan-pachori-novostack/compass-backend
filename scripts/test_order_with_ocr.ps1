Write-Host "Testing Order Creation with OCR Processing" -ForegroundColor Cyan
Write-Host ""

# Step 1: Login
Write-Host "1. Logging in..." -ForegroundColor Yellow
$loginRes = curl.exe -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -d '{\"email\":\"example@leverage.com\",\"password\":\"ABCD123\"}'

$loginData = $loginRes | ConvertFrom-Json
$token = $loginData.data.token
Write-Host "   Token obtained" -ForegroundColor Green

# Step 2: Get country and visa type
Write-Host "`n2. Getting country and visa type..." -ForegroundColor Yellow
$countryRes = curl.exe -s -X GET http://localhost:3000/country -H "Authorization: Bearer $token"

$countryData = $countryRes | ConvertFrom-Json
$country = $countryData.data[0]
$countryId = $country.country_id
Write-Host "   Country: $($country.name)" -ForegroundColor Green

$visaRes = curl.exe -s -X GET "http://localhost:3000/visa/$countryId" -H "Authorization: Bearer $token"

$visaData = $visaRes | ConvertFrom-Json
$visaType = $visaData.data[0]
$visaTypeId = $visaType.visa_type_id
Write-Host "   Visa Type: $($visaType.name)" -ForegroundColor Green

# Step 3: Create order with zip file
Write-Host "`n3. Creating order with zip file..." -ForegroundColor Yellow
$zipPath = Resolve-Path "test_order_files\Mahendra Bhikhubhai Patel GROUP-20251130T095522Z-1-001.zip"

$orderRes = curl.exe -s -X POST http://localhost:3000/order -H "Authorization: Bearer $token" -F "order_type=GROUP" -F "visa_type_id=$visaTypeId" -F "country_id=$countryId" -F "group_name=Mahendra Bhikhubhai Patel GROUP" -F "travel_dates=2025-12-01,2025-12-15" -F "zip_file=@$zipPath"

$orderData = $orderRes | ConvertFrom-Json

if ($orderData.error) {
    Write-Host "   Order creation failed: $($orderData.message)" -ForegroundColor Red
    exit 1
}

$orderId = $orderData.data.order_id
Write-Host "   Order created: $orderId" -ForegroundColor Green
Write-Host "   Travellers: $($orderData.data.travellers_count)" -ForegroundColor Cyan
Write-Host "   Documents: $($orderData.data.documents_count)" -ForegroundColor Cyan

# Step 4: Wait for OCR processing
Write-Host "`n4. Waiting for OCR processing..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

Write-Host "`nTest completed!" -ForegroundColor Green
Write-Host "`nSummary:" -ForegroundColor Cyan
Write-Host "   Order ID: $orderId" -ForegroundColor White
Write-Host "   Check OCR status in database" -ForegroundColor White
Write-Host "   Monitor SSE at: http://localhost:3000/order/$orderId/progress" -ForegroundColor White
