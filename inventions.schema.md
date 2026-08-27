# inventions.json — Data Conventions

Reference for anyone editing `inventions.json` or `worker/inventions_minified.json`.
The minified file is regenerated from the source: `node -e "const d=JSON.parse(require('fs').readFileSync('inventions.json','utf8'));require('fs').writeFileSync('worker/inventions_minified.json',JSON.stringify(d))"`

## Entry Structure

Every entry must have exactly these 6 fields:

```json
{
  "name": "Printing Press",
  "year": 1440,
  "country": {
    "modern": "Germany",
    "endonym": "Deutschland",
    "historical": "Holy Roman Empire"
  },
  "inventor": "Johannes Gutenberg",
  "category": "Communication",
  "description": "A mechanical device that produces text and images on paper using movable type."
}
```

## Field Rules

### name
- Title case (e.g. "Printing Press", "35mm Film Camera")
- Must be unique across the dataset

### year
- Integer. Negative for BC (e.g. `-300` = 300 BC)
- Current range: -9000 to 2021
- Use the **invention/discovery date**, not the commercial release date

### country
- Always an object with exactly 3 keys: `modern`, `endonym`, `historical`
- `modern`: Present-day country name (e.g. "USA", "England", "Germany", "Iraq")
- `endonym`: Native-language name (e.g. "United States", "Deutschland", "Al-Iraq")
- `historical`: Name of the political entity at the time of invention (e.g. "Holy Roman Empire", "Kingdom of Great Britain", "Ancient Greece")

### inventor
- **Single person**: Full name — `"Johannes Gutenberg"`
- **Two people**: Use `"and"` — `"Larry Page and Sergey Brin"`
- **Multiple groups/civilizations**: Use `","` — `"Ancient Persians, Egyptians"`
- **Company/organization**: Name only — `"Bell Labs"`, `"Chrysler"`, `"EDF"`
- **Unknown**: `"Unknown"` (capitalized)
- **Never** use `&` — always spell out `and`

### category
Valid categories (28 total):
Accessories, Agriculture, Clothing, Communication, Computing, Construction, Domestic, Electrical, Electronics, Energy, Finance, Food & Drink, Health, Household, Industrial, Infrastructure, Materials, Medicine, Music, Navigation, Recreation, Safety, Science, Space, Tools, Transportation, Transport, Warfare

Note: both `Transport` and `Transportation` exist in the dataset.

### description
- Starts with a capital letter (typically "A" or "An")
- Ends with a period
- Single sentence, 35-115 characters
- Describes what the invention **is**, not its history
