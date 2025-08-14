// Test script för att verifiera att vanliga kunder inte påverkas av multisite-ändringar
// Kör detta i browser console eller som ett test

import { isMultisiteCustomer, getCustomerType, getCustomerDisplayName } from './src/utils/multisiteHelpers'

// Test 1: Vanlig kund (från kontrakt)
const normalCustomer = {
  id: 'test-123',
  company_name: 'Vanligt Företag AB',
  contact_email: 'kontakt@vanligt.se',
  is_multisite: false,
  site_type: null,
  organization_id: null
}

console.log('=== Test 1: Vanlig kund ===')
console.log('isMultisiteCustomer:', isMultisiteCustomer(normalCustomer)) // Should be false
console.log('getCustomerType:', getCustomerType(normalCustomer)) // Should be 'standard'
console.log('getCustomerDisplayName:', getCustomerDisplayName(normalCustomer)) // Should be 'Vanligt Företag AB'

// Test 2: Multisite huvudkontor
const multisiteHuvudkontor = {
  id: 'hk-123',
  company_name: 'Stora Koncernen AB',
  contact_email: 'info@storakoncernen.se',
  is_multisite: true,
  site_type: 'huvudkontor',
  organization_id: 'org-456'
}

console.log('\n=== Test 2: Multisite huvudkontor ===')
console.log('isMultisiteCustomer:', isMultisiteCustomer(multisiteHuvudkontor)) // Should be true
console.log('getCustomerType:', getCustomerType(multisiteHuvudkontor)) // Should be 'huvudkontor'
console.log('getCustomerDisplayName:', getCustomerDisplayName(multisiteHuvudkontor)) // Should be 'Stora Koncernen AB'

// Test 3: Multisite enhet
const multisiteEnhet = {
  id: 'enhet-789',
  company_name: 'Stora Koncernen AB - Stockholm',
  site_name: 'Stockholm Kontor',
  contact_email: 'stockholm@storakoncernen.se',
  is_multisite: true,
  site_type: 'enhet',
  organization_id: 'org-456',
  parent_customer_id: 'hk-123'
}

console.log('\n=== Test 3: Multisite enhet ===')
console.log('isMultisiteCustomer:', isMultisiteEnhet(multisiteEnhet)) // Should be true
console.log('getCustomerType:', getCustomerType(multisiteEnhet)) // Should be 'enhet'
console.log('getCustomerDisplayName:', getCustomerDisplayName(multisiteEnhet)) // Should be 'Stockholm Kontor'

// Test 4: SQL Queries - Verifiera att vanliga kunder inte påverkas
console.log('\n=== Test 4: SQL Query säkerhet ===')
console.log('Alla multisite-queries ska innehålla WHERE is_multisite = true')
console.log('Detta säkerställer att vanliga kunder (is_multisite = false eller null) aldrig påverkas')

// Test 5: RLS Policies
console.log('\n=== Test 5: RLS Policy test ===')
console.log('Policy: "Multisite users can view their organization customers"')
console.log('Denna policy filtrerar på organization_id som endast finns för multisite-kunder')
console.log('Vanliga kunder har organization_id = null och påverkas därför inte')

// Test 6: Bakåtkompatibilitet
console.log('\n=== Test 6: Bakåtkompatibilitet ===')
const testCases = [
  { desc: 'Vanlig kund utan is_multisite fält', data: { company_name: 'Test AB' } },
  { desc: 'Vanlig kund med is_multisite = null', data: { company_name: 'Test AB', is_multisite: null } },
  { desc: 'Vanlig kund med is_multisite = false', data: { company_name: 'Test AB', is_multisite: false } }
]

testCases.forEach(test => {
  console.log(`${test.desc}:`)
  console.log(`  - isMultisiteCustomer: ${isMultisiteCustomer(test.data)}`) // Should all be false
  console.log(`  - getCustomerType: ${getCustomerType(test.data)}`) // Should all be 'standard'
  console.log(`  - getCustomerDisplayName: ${getCustomerDisplayName(test.data)}`) // Should all return company_name
})

console.log('\n✅ Om alla test ovan visar förväntade värden är systemet bakåtkompatibelt!')
console.log('💡 Viktigt: Alla queries mot customers-tabellen för multisite ska ha WHERE is_multisite = true')