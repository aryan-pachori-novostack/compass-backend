// @ts-ignore - This file uses tsconfig.seed.json which has verbatimModuleSyntax: false
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface VisaTypeData {
  name: string;
  category?: string;
  fee_inr: number;
  documents_required?: string[];
  where_to_apply?: string;
  processing_time?: string;
}

interface CountryData {
  country: string;
  visa_types: VisaTypeData[];
}

const seed_data: CountryData[] = [
  {
    "country": "Dubai",
    "visa_types": [
      {
        "name": "30 D Single Adult",
        "category": "Tourist",
        "fee_inr": 6700,
        "documents_required": [
          "Photo",
          "Passport",
          "Round Trip Ticket",
          "Hotel Accommodation"
        ],
        "where_to_apply": "Official portal (GDRFAD), Goldmedal",
        "processing_time": "3-5 working days"
      },
      {
        "name": "30 D Single Child",
        "category": "Tourist",
        "fee_inr": 1200,
        "documents_required": [
          "Photo",
          "Passport",
          "Round Trip Ticket",
          "Hotel Accommodation"
        ],
        "where_to_apply": "Official portal (GDRFAD), Goldmedal",
        "processing_time": "3-5 working days"
      },
      {
        "name": "30 D Multi Adult",
        "category": "Tourist",
        "fee_inr": 12000,
        "documents_required": [
          "Photo",
          "Passport",
          "Round Trip Ticket",
          "Hotel Accommodation"
        ]
      },
      {
        "name": "30 D Multi Child",
        "category": "Tourist",
        "fee_inr": 2500,
        "documents_required": [
          "Photo",
          "Passport",
          "Round Trip Ticket",
          "Hotel Accommodation"
        ]
      },
      {
        "name": "60 D Single Adult",
        "category": "Tourist",
        "fee_inr": 12000,
        "documents_required": [
          "Photo",
          "Passport",
          "Round Trip Ticket",
          "Hotel Accommodation"
        ]
      },
      {
        "name": "60 D Single Kids",
        "category": "Tourist",
        "fee_inr": 2500,
        "documents_required": [
          "Photo",
          "Passport",
          "Round Trip Ticket",
          "Hotel Accommodation"
        ]
      },
      {
        "name": "60 D Multi Adult",
        "category": "Tourist",
        "fee_inr": 18000
      },
      {
        "name": "60 D Multi Kids",
        "category": "Tourist",
        "fee_inr": 3500
      },
      {
        "name": "Transit 48 hrs",
        "category": "Transit",
        "fee_inr": 2500
      },
      {
        "name": "Transit 96 hrs",
        "category": "Transit",
        "fee_inr": 5000
      },
      {
        "name": "Extension",
        "category": "Service",
        "fee_inr": 24000
      },
      {
        "name": "Cancellation",
        "category": "Service",
        "fee_inr": 5200
      },
      {
        "name": "Correction",
        "category": "Service",
        "fee_inr": 4500
      },
      {
        "name": "OTB",
        "category": "Service",
        "fee_inr": 1200
      },
      {
        "name": "Absconding",
        "category": "Penalty",
        "fee_inr": 85000
      }
    ]
  },
  {
    "country": "Vietnam",
    "visa_types": [
      {
        "name": "Regular",
        "fee_inr": 2500,
        "documents_required": [
          "Front passport page",
          "Passport size photo"
        ],
        "where_to_apply": "https://evisa.gov.vn/",
        "processing_time": "5-6 working days"
      },
      { "name": "0 Day", "fee_inr": 10000 },
      { "name": "1 Day", "fee_inr": 7000 },
      { "name": "2 Day", "fee_inr": 5500 }
    ]
  },
  {
    "country": "Azerbaijan",
    "visa_types": [
      {
        "name": "Regular",
        "fee_inr": 2600,
        "documents_required": ["Passport"],
        "where_to_apply": "https://evisa.gov.az/en/",
        "processing_time": "5-6 days"
      }
    ]
  },
  {
    "country": "Indonesia",
    "visa_types": [
      {
        "name": "Regular",
        "fee_inr": 3000,
        "documents_required": [
          "Photo",
          "Passport",
          "Round trip flight ticket (PDF)"
        ],
        "where_to_apply": "https://evisa.imigrasi.go.id/",
        "processing_time": "within 24 hours"
      }
    ]
  },
  {
    "country": "Georgia",
    "visa_types": [
      {
        "name": "Regular",
        "fee_inr": 3500,
        "documents_required": [
          "Passport (min 6 months validity)",
          "Passport-size photo",
          "Return flight ticket",
          "Accommodation proof",
          "Travel/health insurance",
          "Bank statements",
          "ITR",
          "Employment letter",
          "PAN",
          "Aadhaar"
        ],
        "where_to_apply": "https://www.evisa.gov.ge/GeoVisa/",
        "processing_time": "5-7 days"
      }
    ]
  },
  {
    "country": "US",
    "visa_types": [
      {
        "name": "Regular",
        "fee_inr": 15000,
        "documents_required": []
      }
    ]
  },
  {
    "country": "Egypt",
    "visa_types": [
      { "name": "Regular", "fee_inr": 2500, "documents_required": [] }
    ]
  },
  {
    "country": "Russia",
    "visa_types": [
      { "name": "Regular", "fee_inr": 5500, "documents_required": [] }
    ]
  },
  {
    "country": "France",
    "visa_types": [
      { "name": "Regular", "fee_inr": 0, "documents_required": [] }
    ]
  },
  {
    "country": "Greece",
    "visa_types": [
      {
        "name": "Regular",
        "fee_inr": 0,
        "documents_required": [
          "Passport",
          "Visa application form",
          "Passport size photo",
          "Cover letter",
          "Itinerary",
          "Hotel booking",
          "Return ticket",
          "Aadhaar",
          "Bank statement (6 months)",
          "Payslips (3 months)",
          "ITR/Form 16 (3 years)"
        ]
      }
    ]
  },
  {
    "country": "China",
    "visa_types": [
      { "name": "Regular", "fee_inr": 15000, "documents_required": [] }
    ]
  },
  {
    "country": "Tanzania",
    "visa_types": [
      { "name": "Regular", "fee_inr": 5000, "documents_required": [] }
    ]
  },
  {
    "country": "Kenya",
    "visa_types": [
      {
        "name": "Regular",
        "fee_inr": 3500,
        "documents_required": [
          "Passport (1 blank page)",
          "Passport photo",
          "Flight itinerary",
          "Hotel or safari booking",
          "Bank statement (min $500)",
          "Yellow fever vaccination certificate"
        ],
        "where_to_apply": "https://evisa.go.ke/",
        "processing_time": "2–3 working days"
      }
    ]
  },
  {
    "country": "Uganda",
    "visa_types": [
      { "name": "Regular", "fee_inr": 5000, "documents_required": [] }
    ]
  },
  {
    "country": "UK",
    "visa_types": [
      { "name": "Regular", "fee_inr": 30000, "documents_required": [] }
    ]
  },
  {
    "country": "Singapore",
    "visa_types": [
      { "name": "Regular", "fee_inr": 3000, "documents_required": [] }
    ]
  },
  {
    "country": "Malaysia",
    "visa_types": [
      { "name": "Regular", "fee_inr": 0, "documents_required": [] }
    ]
  },
  {
    "country": "Uzbekistan",
    "visa_types": [
      { "name": "Regular", "fee_inr": 2500, "documents_required": [] }
    ]
  },
  {
    "country": "Oman",
    "visa_types": [
      { "name": "Regular", "fee_inr": 2400, "documents_required": [] }
    ]
  },
  {
    "country": "Cambodia",
    "visa_types": [
      {
        "name": "Regular",
        "fee_inr": 3500,
        "documents_required": [
          "Passport (min 6 months validity)",
          "Passport size photo"
        ],
        "where_to_apply": "https://www.evisa.gov.kh/",
        "processing_time": "3–4 days"
      }
    ]
  }
];

/**
 * Generate ISO code from country name
 */
function generateIsoCode(countryName: string): string {
  const name_parts = countryName.split(/[\s-]+/);
  if (name_parts.length >= 2) {
    return (name_parts[0].substring(0, 2) + name_parts[1].substring(0, 1)).toUpperCase();
  }
  return countryName.substring(0, 3).toUpperCase();
}

/**
 * Parse processing time string to days
 */
function parseProcessingDays(processingTime?: string): number | null {
  if (!processingTime) return null;
  
  // Match patterns like "3-5 working days", "5-6 days", "within 24 hours", "2–3 working days"
  const range_match = processingTime.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range_match) {
    return Math.ceil((parseInt(range_match[1]) + parseInt(range_match[2])) / 2);
  }
  
  const single_match = processingTime.match(/(\d+)/);
  if (single_match) {
    return parseInt(single_match[1]);
  }
  
  // "within 24 hours" -> 1 day
  if (processingTime.toLowerCase().includes('24 hours') || processingTime.toLowerCase().includes('within')) {
    return 1;
  }
  
  return null;
}

/**
 * Main seed function
 */
async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // Use transaction for all operations
    await prisma.$transaction(
      async (tx) => {
        const country_map = new Map<string, string>(); // country_name -> country.id
        const visa_type_map = new Map<string, string>(); // "country_name|visa_name" -> visa_type.id

        // Step 1: Create countries
        console.log('🌍 Seeding countries...');
        for (const country_data of seed_data) {
          const iso_code = generateIsoCode(country_data.country);
          
          const country = await tx.country.upsert({
            where: { iso_code },
            update: {
              name: country_data.country,
              default_currency: 'INR',
              is_active: true,
            },
            create: {
              iso_code,
              name: country_data.country,
              default_currency: 'INR',
              is_active: true,
            },
          });
          
          country_map.set(country_data.country, country.id);
          console.log(`  ✓ ${country.name} (${country.iso_code})`);
        }

        // Step 2: Create visa types and fees
        console.log('📋 Seeding visa types and fees...');
        for (const country_data of seed_data) {
          const country_id = country_map.get(country_data.country);
          if (!country_id) {
            console.warn(`  ⚠ Country "${country_data.country}" not found, skipping...`);
            continue;
          }

          for (const visa_data of country_data.visa_types) {
            // Create or update visa type
            const existing = await tx.visaType.findFirst({
              where: {
                country_id,
                name: visa_data.name,
              },
            });

            let visa_type;
            if (existing) {
              visa_type = await tx.visaType.update({
                where: { id: existing.id },
                data: {
                  category: visa_data.category || null,
                  description: visa_data.where_to_apply || null,
                  processing_days: parseProcessingDays(visa_data.processing_time),
                  is_active: true,
                },
              });
            } else {
              visa_type = await tx.visaType.create({
                data: {
                  country_id,
                  name: visa_data.name,
                  category: visa_data.category || null,
                  description: visa_data.where_to_apply || null,
                  processing_days: parseProcessingDays(visa_data.processing_time),
                  is_active: true,
                },
              });
            }

            const visa_key = `${country_data.country}|${visa_data.name}`;
            visa_type_map.set(visa_key, visa_type.id);
            console.log(`  ✓ ${visa_data.name} (${country_data.country})`);

            // Create visa fee
            if (visa_data.fee_inr > 0) {
              const existing_fee = await tx.visaFee.findFirst({
                where: {
                  visa_type_id: visa_type.id,
                  currency: 'INR',
                  base_fee_amount: visa_data.fee_inr,
                },
              });

              if (!existing_fee) {
                await tx.visaFee.create({
                  data: {
                    visa_type_id: visa_type.id,
                    nationality_country_id: null,
                    base_fee_amount: visa_data.fee_inr,
                    currency: 'INR',
                    service_fee_amount: null,
                    tax_amount: null,
                    valid_from: null,
                    valid_to: null,
                  },
                });
                console.log(`    💰 Fee: INR ${visa_data.fee_inr}`);
              }
            }

            // Step 3: Create required documents
            if (visa_data.documents_required && visa_data.documents_required.length > 0) {
              for (const doc_name of visa_data.documents_required) {
                const doc_code = doc_name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
                
                const existing_doc = await tx.visaRequiredDocument.findFirst({
                  where: {
                    visa_type_id: visa_type.id,
                    document_code: doc_code,
                  },
                });

                if (!existing_doc) {
                  await tx.visaRequiredDocument.create({
                    data: {
                      visa_type_id: visa_type.id,
                      document_code: doc_code,
                      document_name: doc_name,
                      description: null,
                      is_mandatory: true,
                      allowed_file_types: null,
                      max_file_size_mb: null,
                    },
                  });
                  console.log(`    📄 Document: ${doc_name}`);
                }
              }
            }
          }
        }
      },
      {
        timeout: 60000, // 60 seconds timeout
      }
    );

    // Step 4: Seed individual partner account
    console.log('👤 Seeding individual partner account...');
    await prisma.$transaction(async (tx) => {
      const partner_email = 'example@leverage.com';
      const partner_password = 'ABCD123';

      // Check if partner already exists
      const existing_partner = await tx.partnerAccount.findUnique({
        where: {
          email: partner_email,
        },
      });

      if (existing_partner) {
        console.log(`  ⚠ Partner account with email '${partner_email}' already exists, skipping...`);
        return;
      }

      // Hash password
      const password_hash = await bcrypt.hash(partner_password, 10);

      // Create PartnerAccount
      const partner_account = await tx.partnerAccount.create({
        data: {
          partner_type: 'INDIVIDUAL',
          email: partner_email,
          password_hash: password_hash,
          is_active: true,
          kyc_verified: false,
        },
      });

      // Create IndividualProfile with same id
      await tx.individualProfile.create({
        data: {
          id: partner_account.id,
          full_name: 'Example User',
          phone: '+1234567890',
          aadhaar_number: null,
          pan_number: null,
          date_of_birth: null,
          nationality_id: null,
        },
      });

      console.log(`  ✓ Individual partner account created: ${partner_email}`);
      console.log(`  ✓ Password: ${partner_password}`);
    });

    console.log('✅ Database seed completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed
main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
