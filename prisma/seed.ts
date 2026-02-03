// @ts-ignore - This file uses tsconfig.seed.json which has verbatimModuleSyntax: false
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VisaVariantData {
  name: string;
  category?: string;
  fee_inr: number;
  documents_required?: string[];
  where_to_apply?: string;
  processing_time?: string;
}

interface CountryData {
  country: string;
  visa_types: VisaVariantData[];
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
 * Parse processing time string to min and max days
 */
function parseProcessingDays(processingTime?: string): { min: number | null; max: number | null } {
  if (!processingTime) return { min: null, max: null };
  
  // Match patterns like "3-5 working days", "5-6 days", "2–3 working days"
  const range_match = processingTime.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range_match) {
    return {
      min: parseInt(range_match[1]),
      max: parseInt(range_match[2])
    };
  }
  
  const single_match = processingTime.match(/(\d+)/);
  if (single_match) {
    const days = parseInt(single_match[1]);
    return { min: days, max: days };
  }
  
  // "within 24 hours" -> 1 day
  if (processingTime.toLowerCase().includes('24 hours') || processingTime.toLowerCase().includes('within')) {
    return { min: 1, max: 1 };
  }
  
  return { min: null, max: null };
}

/**
 * Extract entry type from variant name (Single/Multiple)
 */
function extractEntryType(variantName: string): string | null {
  const lower = variantName.toLowerCase();
  if (lower.includes('multi')) return 'Multiple';
  if (lower.includes('single')) return 'Single';
  return null;
}

/**
 * Extract duration days from variant name
 */
function extractDurationDays(variantName: string): number | null {
  const match = variantName.match(/(\d+)\s*D/i);
  if (match) {
    return parseInt(match[1]);
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
        const visa_type_map = new Map<string, string>(); // "country_id|category" -> visa_type.id

        // Step 1: Create countries
        console.log('🌍 Seeding countries...');
        for (const country_data of seed_data) {
          const iso_code = generateIsoCode(country_data.country);
          
          const country = await tx.country.upsert({
            where: { iso_code },
            update: {
              name: country_data.country,
              is_active: true,
            },
            create: {
              iso_code,
              name: country_data.country,
              is_active: true,
            },
          });
          
          country_map.set(country_data.country, country.id);
          console.log(`  ✓ ${country.name} (${country.iso_code})`);
        }

        // Step 2: Create visa types (grouped by category) and variants
        console.log('📋 Seeding visa types and variants...');
        for (const country_data of seed_data) {
          const country_id = country_map.get(country_data.country);
          if (!country_id) {
            console.warn(`  ⚠ Country "${country_data.country}" not found, skipping...`);
            continue;
          }

          // Group variants by category to create VisaTypes
          const category_map = new Map<string, VisaVariantData[]>();
          for (const visa_data of country_data.visa_types) {
            const category = visa_data.category || 'Regular';
            if (!category_map.has(category)) {
              category_map.set(category, []);
            }
            category_map.get(category)!.push(visa_data);
          }

          // Create VisaType for each category
          for (const [category, variants] of category_map.entries()) {
            const visa_type_key = `${country_id}|${category}`;
            let visa_type_id = visa_type_map.get(visa_type_key);

            if (!visa_type_id) {
              // Get processing time from first variant that has it
              const variant_with_time = variants.find(v => v.processing_time);
              const processing = variant_with_time 
                ? parseProcessingDays(variant_with_time.processing_time)
                : { min: null, max: null };

              // Check if visa type already exists
              const existing_visa_type = await tx.visaType.findFirst({
                where: {
                  country_id,
                  name: category,
                },
              });

              let visa_type;
              if (existing_visa_type) {
                visa_type = await tx.visaType.update({
                  where: { id: existing_visa_type.id },
                  data: {
                    processing_days_min: processing.min,
                    processing_days_max: processing.max,
                    is_active: true,
                  },
                });
              } else {
                visa_type = await tx.visaType.create({
                  data: {
                    country_id,
                    name: category,
                    category: category === 'Regular' ? null : category,
                    processing_days_min: processing.min,
                    processing_days_max: processing.max,
                    is_active: true,
                  },
                });
              }

              visa_type_id = visa_type.id;
              visa_type_map.set(visa_type_key, visa_type.id);
              console.log(`  ✓ Visa Type: ${category} (${country_data.country})`);
            }

            // Create VisaVariants for each variant in this category
            if (!visa_type_id) {
              console.warn(`  ⚠ Visa type ID not found for category "${category}", skipping variants...`);
              continue;
            }

            for (const visa_data of variants) {
              const existing_variant = await tx.visaVariant.findFirst({
                where: {
                  visa_type_id: visa_type_id,
                  variant_name: visa_data.name,
                },
              });

              if (!existing_variant) {
                const processing = parseProcessingDays(visa_data.processing_time);
                const entry_type = extractEntryType(visa_data.name);
                const duration_days = extractDurationDays(visa_data.name);

                await tx.visaVariant.create({
                  data: {
                    visa_type_id: visa_type_id,
                    variant_name: visa_data.name,
                    entry_type: entry_type,
                    duration_days: duration_days,
                    processing_text: visa_data.processing_time || null,
                    currency: 'INR',
                    adult_fee: visa_data.fee_inr > 0 ? visa_data.fee_inr : null,
                    child_fee: null, // Can be set separately if needed
                    taxes_fee: null,
                    is_active: true,
                  },
                });
                console.log(`    ✓ Variant: ${visa_data.name} (Fee: INR ${visa_data.fee_inr})`);
              }

              // Create required documents for this variant (linked to visa type)
              if (visa_data.documents_required && visa_data.documents_required.length > 0) {
                for (const doc_name of visa_data.documents_required) {
                  const doc_code = doc_name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
                  
                  const existing_doc = await tx.visaRequiredDocument.findFirst({
                    where: {
                      visa_type_id: visa_type_id,
                      document_code: doc_code,
                    },
                  });

                  if (!existing_doc) {
                    await tx.visaRequiredDocument.create({
                      data: {
                        visa_type_id: visa_type_id,
                        document_code: doc_code,
                        document_name: doc_name,
                        is_mandatory: true,
                        allowed_types: null,
                        max_size_mb: null,
                      },
                    });
                    console.log(`      📄 Document: ${doc_name}`);
                  }
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
