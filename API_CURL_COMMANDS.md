# Compass Backend - API cURL Commands

## Base URL
```
http://localhost:3000
```

## 1. Health Check

### GET /health
```bash
curl -X GET http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-20T12:00:00.000Z"
}
```

---

## 2. Authentication

### POST /auth/login

**Request:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "example@leverage.com",
    "password": "ABCD123"
  }'
```

**Success Response (200):**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "partner": {
      "partner_account_id": "uuid-here",
      "email": "example@leverage.com",
      "partner_type": "INDIVIDUAL",
      "is_active": true,
      "kyc_verified": false
    }
  }
}
```

**Error Responses:**
- **400** - Validation Error (missing email/password, invalid format)
- **401** - Authentication Error (invalid credentials)
- **403** - Account Inactive
- **429** - Too Many Requests (rate limited)

**Example with invalid credentials:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "wrong@example.com",
    "password": "wrongpassword"
  }'
```

---

## 3. Countries (Protected - Requires JWT)

### GET /country/

**Query Parameters:**
- `search` (optional) - Search by country name or ISO code
- `page` (optional) - Page number (default: 1)
- `page_size` (optional) - Records per page (default: 10, max: 100)

**Request:**
```bash
# Get all countries (first page, 10 records)
curl -X GET http://localhost:3000/country \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Search for countries
curl -X GET "http://localhost:3000/country?search=dubai" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Get page 2 with 10 records
curl -X GET "http://localhost:3000/country?page=2&page_size=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Search with pagination
curl -X GET "http://localhost:3000/country?search=vietnam&page=1&page_size=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Replace `YOUR_JWT_TOKEN_HERE` with the token from login response**

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "country_id": "uuid",
      "iso_code": "DUB",
      "name": "Dubai",
      "default_currency": "INR"
    },
    {
      "id": "uuid",
      "country_id": "uuid",
      "iso_code": "VIE",
      "name": "Vietnam",
      "default_currency": "INR"
    }
  ],
  "pagination": {
    "total": 20,
    "page": 1,
    "page_size": 10,
    "total_pages": 2
  }
}
```

**Error Responses:**
- **401** - Unauthorized (missing or invalid token)
- **500** - Internal Server Error

**Example without token (will fail):**
```bash
curl -X GET http://localhost:3000/country
```

---

## 4. Visa Types (Protected - Requires JWT)

### GET /visa/:country_id

**Path Parameters:**
- `country_id` (required) - The country ID

**Query Parameters:**
- `search` (optional) - Search by visa type name, category, or code
- `page` (optional) - Page number (default: 1)
- `page_size` (optional) - Records per page (default: 10, max: 100)

**Request:**
```bash
# Get all visa types for a country (first page, 10 records)
curl -X GET http://localhost:3000/visa/COUNTRY_ID_HERE \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Search visa types
curl -X GET "http://localhost:3000/visa/COUNTRY_ID_HERE?search=tourist" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Get page 2 with 10 records
curl -X GET "http://localhost:3000/visa/COUNTRY_ID_HERE?page=2&page_size=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Search with pagination
curl -X GET "http://localhost:3000/visa/COUNTRY_ID_HERE?search=transit&page=1&page_size=10" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Replace:**
- `COUNTRY_ID_HERE` with the `country_id` from the countries endpoint
- `YOUR_JWT_TOKEN_HERE` with the token from login response

**Example:**
```bash
# First, get countries to find a country_id
curl -X GET http://localhost:3000/country \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Then use the country_id from the response
curl -X GET http://localhost:3000/visa/abc123-country-id-here \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"

# Search for specific visa types
curl -X GET "http://localhost:3000/visa/abc123-country-id-here?search=30%20D" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Success Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "visa_type_id": "uuid",
      "country_id": "uuid",
      "code": null,
      "name": "30 D Single Adult",
      "category": "Tourist",
      "description": "Official portal (GDRFAD), Goldmedal",
      "processing_days": 4,
      "is_active": true,
      "visa_fees": [
        {
          "id": "uuid",
          "visa_fee_id": "uuid",
          "base_fee_amount": 6700,
          "service_fee_amount": null,
          "currency": "INR",
          "tax_amount": null,
          "nationality_country_id": null,
          "valid_from": null,
          "valid_to": null
        }
      ],
      "required_documents": [
        {
          "id": "uuid",
          "visa_required_document_id": "uuid",
          "document_code": "PHOTO",
          "document_name": "Photo",
          "description": null,
          "is_mandatory": true,
          "allowed_file_types": null,
          "max_file_size_mb": null
        },
        {
          "id": "uuid",
          "visa_required_document_id": "uuid",
          "document_code": "PASSPORT",
          "document_name": "Passport",
          "description": null,
          "is_mandatory": true,
          "allowed_file_types": null,
          "max_file_size_mb": null
        }
      ],
      "created_at": "2025-11-20T12:00:00.000Z",
      "updated_at": "2025-11-20T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "page_size": 10,
    "total_pages": 2
  }
}
```

**Error Responses:**
- **400** - Validation Error (missing country_id)
- **401** - Unauthorized (missing or invalid token)
- **404** - Not Found (country not found)
- **500** - Internal Server Error

**Example with invalid country_id:**
```bash
curl -X GET http://localhost:3000/visa/invalid-id-12345 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

---

## Complete Workflow Example

### Step 1: Login
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "example@leverage.com",
    "password": "ABCD123"
  }' | jq -r '.data.token')

echo "Token: $TOKEN"
```

### Step 2: Get Countries (with search and pagination)
```bash
# Get first 10 countries
curl -X GET "http://localhost:3000/country?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN" | jq

# Search for a specific country
curl -X GET "http://localhost:3000/country?search=dubai" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Step 3: Get Visa Types for a Country (with search and pagination)
```bash
# Get country_id from previous response, then:
COUNTRY_ID="your-country-id-here"

# Get first 10 visa types
curl -X GET "http://localhost:3000/visa/$COUNTRY_ID?page=1&page_size=10" \
  -H "Authorization: Bearer $TOKEN" | jq

# Search for specific visa types
curl -X GET "http://localhost:3000/visa/$COUNTRY_ID?search=tourist" \
  -H "Authorization: Bearer $TOKEN" | jq
```

---

## PowerShell Examples (Windows)

### Login
```powershell
$body = @{
    email = "example@leverage.com"
    password = "ABCD123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/auth/login" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"

$token = $response.data.token
Write-Host "Token: $token"
```

### Get Countries (with search and pagination)
```powershell
$headers = @{
    "Authorization" = "Bearer $token"
}

# Get first page of countries
$countries = Invoke-RestMethod -Uri "http://localhost:3000/country?page=1&page_size=10" `
    -Method GET `
    -Headers $headers `
    -ContentType "application/json"

$countries.data | Format-Table
Write-Host "Total: $($countries.pagination.total), Page: $($countries.pagination.page)/$($countries.pagination.total_pages)"

# Search for countries
$searchResult = Invoke-RestMethod -Uri "http://localhost:3000/country?search=dubai" `
    -Method GET `
    -Headers $headers `
    -ContentType "application/json"

$searchResult.data | Format-Table
```

### Get Visa Types (with search and pagination)
```powershell
$countryId = $countries.data[0].country_id

# Get first page of visa types
$visaTypes = Invoke-RestMethod -Uri "http://localhost:3000/visa/$countryId?page=1&page_size=10" `
    -Method GET `
    -Headers $headers `
    -ContentType "application/json"

$visaTypes.data | Format-List
Write-Host "Total: $($visaTypes.pagination.total), Page: $($visaTypes.pagination.page)/$($visaTypes.pagination.total_pages)"

# Search for specific visa types
$visaSearch = Invoke-RestMethod -Uri "http://localhost:3000/visa/$countryId?search=tourist" `
    -Method GET `
    -Headers $headers `
    -ContentType "application/json"

$visaSearch.data | Format-List
```

---

## Notes

1. **Rate Limiting:**
   - Auth endpoints: 5 requests per 15 minutes
   - General API: 100 requests per 15 minutes

2. **Token Expiration:**
   - Default: 7 days (configurable via `JWT_EXPIRES_IN`)

3. **Error Format:**
   ```json
   {
     "error": "ERROR_CODE",
     "message": "Human readable message",
     "code": 400
   }
   ```

4. **Success Format:**
   ```json
   {
     "data": { ... }
   }
   ```

