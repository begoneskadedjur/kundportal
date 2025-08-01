// 📁 src/utils/addressFormatter.ts
// ⭐ Hjälpfunktion för att formatera adresser ⭐

export const formatAddress = (address: any): string => {
  if (!address) return '';
  
  // Om det redan är en sträng, returnera den
  if (typeof address === 'string') {
    try {
      // Försök att parsa som JSON om det ser ut som JSON
      const parsed = JSON.parse(address);
      return parsed.formatted_address || address;
    } catch (e) {
      // Om det inte går att parsa, returnera ursprungssträngen
      return address;
    }
  }
  
  // Om det är ett objekt med formatted_address
  if (address.formatted_address) {
    return address.formatted_address;
  }
  
  // Om det är ett objekt med separata fält, bygg adressen
  if (address.street && address.city) {
    return `${address.street}, ${address.postal_code || ''} ${address.city}`.trim();
  }
  
  return '';
};