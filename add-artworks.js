/**
 * add-artworks.js
 * 
 * Fetches ~200 notable artworks from the Art Institute of Chicago API,
 * deduplicates against existing entries in artworks.js, and appends them
 * with placeholder content. Then run generate-content.js to fill in the
 * AI-generated about/analysis/funFacts.
 * 
 * Usage:
 *   node add-artworks.js
 *   (then)
 *   $env:OPENAI_API_KEY="sk-..."
 *   node generate-content.js
 */

const fs = require('fs');
const path = require('path');

const ARTWORKS_FILE = path.join(__dirname, 'artworks.js');
const DELAY_MS = 300; // delay between AIC API calls

// ================================================================
// Load existing artworks
// ================================================================
function loadArtworks() {
    const raw = fs.readFileSync(ARTWORKS_FILE, 'utf-8');
    const fn = new Function(raw + '\nreturn ARTWORKS;');
    return fn();
}

// ================================================================
// AIC API helpers
// ================================================================
const AIC_BASE = 'https://api.artic.edu/api/v1';
const FIELDS = [
    'id', 'title', 'artist_display', 'date_display',
    'medium_display', 'dimensions', 'image_id',
    'style_titles', 'classification_titles', 'artwork_type_title',
    'is_public_domain', 'artist_title'
].join(',');

async function fetchAIC(endpoint) {
    const res = await fetch(`${AIC_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`AIC API ${res.status}: ${await res.text()}`);
    return res.json();
}

async function searchArtworks(query, page = 1, limit = 50) {
    const params = new URLSearchParams({
        q: query,
        page: String(page),
        limit: String(limit),
        fields: FIELDS,
    });
    return fetchAIC(`/artworks/search?${params}`);
}

// ================================================================
// Curated searches — diverse mix of artists, movements, periods
// ================================================================
const SEARCHES = [
    // Impressionism & Post-Impressionism
    'Claude Monet painting',
    'Pierre-Auguste Renoir painting',
    'Edgar Degas painting',
    'Paul Cézanne painting',
    'Vincent van Gogh painting',
    'Paul Gauguin painting',
    'Camille Pissarro painting',
    'Berthe Morisot painting',
    'Mary Cassatt painting',
    
    // Renaissance & Baroque
    'Rembrandt van Rijn painting',
    'Peter Paul Rubens painting',
    'El Greco painting',
    'Gustave Courbet painting',
    
    // 19th Century
    'James McNeill Whistler painting',
    'Winslow Homer painting',
    'John Singer Sargent painting',
    'Édouard Manet painting',
    'Henri de Toulouse-Lautrec',
    'Gustave Caillebotte painting',
    
    // Modern
    'Henri Matisse painting',
    'Wassily Kandinsky painting',
    'Marc Chagall painting',
    'Georgia O\'Keeffe painting',
    'Salvador Dalí painting',
    'René Magritte painting',
    'Frida Kahlo painting',
    'Amedeo Modigliani painting',
    
    // American Art
    'Archibald Motley painting',
    'Charles White painting',
    'Jacob Lawrence painting',
    
    // Asian Art
    'Japanese woodblock print ukiyo-e',
    'Chinese landscape painting scroll',
    
    // Other notable
    'still life painting flowers',
    'landscape painting masterpiece',
    'portrait painting notable',
    'seascape marine painting',
];

// ================================================================
// Classify movement from AIC metadata
// ================================================================
function guessMovement(artwork) {
    const styles = (artwork.style_titles || []).join(' ').toLowerCase();
    const artist = (artwork.artist_display || '').toLowerCase();
    const title = (artwork.title || '').toLowerCase();
    const date = artwork.date_display || '';

    if (styles.includes('impressionism') || styles.includes('impressionist')) return 'Impressionism';
    if (styles.includes('post-impressionism') || styles.includes('post-impressionist')) return 'Post-Impressionism';
    if (styles.includes('cubism') || styles.includes('cubist')) return 'Cubism';
    if (styles.includes('surrealism') || styles.includes('surrealist')) return 'Surrealism';
    if (styles.includes('expressionism') || styles.includes('expressionist')) return 'Expressionism';
    if (styles.includes('abstract')) return 'Abstract Art';
    if (styles.includes('baroque')) return 'Baroque';
    if (styles.includes('renaissance')) return 'Renaissance';
    if (styles.includes('realism') || styles.includes('realist')) return 'Realism';
    if (styles.includes('romanticism') || styles.includes('romantic')) return 'Romanticism';
    if (styles.includes('rococo')) return 'Rococo';
    if (styles.includes('modernism') || styles.includes('modern')) return 'Modern Art';
    if (styles.includes('art nouveau')) return 'Art Nouveau';
    if (styles.includes('pointillism')) return 'Pointillism';
    if (styles.includes('fauvism')) return 'Fauvism';
    if (styles.includes('pop art')) return 'Pop Art';
    if (styles.includes('minimalism')) return 'Minimalism';
    if (styles.includes('ukiyo-e')) return 'Ukiyo-e';
    
    // Guess from artist/date if styles don't help
    if (artist.includes('monet') || artist.includes('renoir') || artist.includes('degas') || 
        artist.includes('pissarro') || artist.includes('morisot') || artist.includes('sisley'))
        return 'Impressionism';
    if (artist.includes('cézanne') || artist.includes('van gogh') || artist.includes('gauguin') ||
        artist.includes('seurat') || artist.includes('toulouse-lautrec'))
        return 'Post-Impressionism';
    if (artist.includes('matisse')) return 'Fauvism';
    if (artist.includes('kandinsky')) return 'Abstract Art';
    if (artist.includes('dalí') || artist.includes('magritte')) return 'Surrealism';
    if (artist.includes('o\'keeffe')) return 'American Modernism';
    if (artist.includes('homer')) return 'American Realism';
    if (artist.includes('chagall')) return 'Modern Art';
    if (artist.includes('kahlo')) return 'Surrealism / Mexican Modernism';
    if (artist.includes('rubens') || artist.includes('rembrandt')) return 'Baroque';
    if (artist.includes('el greco')) return 'Mannerism';
    
    return '';
}

// Parse artist life dates from the display string
function parseArtistLife(artistDisplay) {
    if (!artistDisplay) return '';
    // Try to extract nationality and dates like "French, 1840-1926"
    const match = artistDisplay.match(/([A-Za-z]+(?:\s*,\s*born\s+[A-Za-z]+)?)\s*,?\s*((?:\d{4}|c\.\s*\d{4})\s*[–—-]\s*(?:\d{4}|c\.\s*\d{4}))/);
    if (match) return `${match[1].trim()}, ${match[2].trim()}`;
    // Just return the full display if we can't parse
    const lines = artistDisplay.split('\n');
    return lines.length > 1 ? lines[1].trim() : lines[0].trim();
}

function parseArtistName(artwork) {
    return artwork.artist_title || artwork.artist_display?.split('\n')[0]?.trim() || 'Unknown Artist';
}

// ================================================================
// Main
// ================================================================
async function main() {
    const existing = loadArtworks();
    const existingIds = new Set(existing.map(a => typeof a.id === 'number' ? a.id : a.id));

    console.log(`\n🎨 AIC Artwork Fetcher`);
    console.log(`   ${existing.length} existing artworks`);
    console.log(`   Running ${SEARCHES.length} searches...\n`);

    const candidates = new Map(); // id -> artwork data

    for (let i = 0; i < SEARCHES.length; i++) {
        const query = SEARCHES[i];
        console.log(`  🔍 [${i + 1}/${SEARCHES.length}] "${query}"...`);

        try {
            // Fetch 2 pages per search to get variety
            for (let page = 1; page <= 2; page++) {
                const result = await searchArtworks(query, page, 50);
                const artworks = result.data || [];

                for (const a of artworks) {
                    // Skip if no image, already exists, or already found
                    if (!a.image_id) continue;
                    if (existingIds.has(a.id)) continue;
                    if (candidates.has(a.id)) continue;
                    // Skip non-paintings/prints (sculptures, textiles, etc.)
                    const type = (a.artwork_type_title || '').toLowerCase();
                    if (type && !type.includes('paint') && !type.includes('print') && 
                        !type.includes('drawing') && !type.includes('watercolor')) continue;

                    candidates.set(a.id, {
                        id: a.id,
                        title: a.title || 'Untitled',
                        artist: parseArtistName(a),
                        artistLife: parseArtistLife(a.artist_display),
                        date: a.date_display || '',
                        medium: a.medium_display || '',
                        dimensions: a.dimensions || '',
                        imageId: a.image_id,
                        movement: guessMovement(a),
                        about: 'Content will be generated by AI.',
                        analysis: 'Content will be generated by AI.',
                        funFacts: ['Run generate-content.js to populate this.']
                    });
                }

                await new Promise(r => setTimeout(r, DELAY_MS));
            }
        } catch (err) {
            console.error(`  ❌ Error searching "${query}": ${err.message}`);
        }
    }

    console.log(`\n📊 Found ${candidates.size} new artworks`);

    // Cap at 200 to keep file size reasonable
    const MAX_NEW = 200;
    let newArtworks = Array.from(candidates.values());
    
    if (newArtworks.length > MAX_NEW) {
        // Shuffle and take MAX_NEW to get a diverse sample
        for (let i = newArtworks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newArtworks[i], newArtworks[j]] = [newArtworks[j], newArtworks[i]];
        }
        newArtworks = newArtworks.slice(0, MAX_NEW);
        console.log(`   Capped to ${MAX_NEW} artworks for file size`);
    }

    // Combine with existing
    const allArtworks = [...existing, ...newArtworks];

    console.log(`   Total: ${allArtworks.length} artworks\n`);
    console.log('📝 Writing artworks.js...');

    // Build the output file
    const lines = ['const ARTWORKS = ['];

    for (let i = 0; i < allArtworks.length; i++) {
        const a = allArtworks[i];
        const comma = i < allArtworks.length - 1 ? ',' : '';

        lines.push('    {');
        lines.push(`        id: ${JSON.stringify(a.id)},`);
        lines.push(`        title: ${JSON.stringify(a.title)},`);
        lines.push(`        artist: ${JSON.stringify(a.artist)},`);
        lines.push(`        artistLife: ${JSON.stringify(a.artistLife)},`);
        lines.push(`        date: ${JSON.stringify(a.date)},`);
        lines.push(`        medium: ${JSON.stringify(a.medium)},`);
        lines.push(`        dimensions: ${JSON.stringify(a.dimensions)},`);

        if (a.imageUrl) {
            lines.push(`        imageUrl: ${JSON.stringify(a.imageUrl)},`);
        } else {
            lines.push(`        imageId: ${JSON.stringify(a.imageId)},`);
        }

        lines.push(`        movement: ${JSON.stringify(a.movement || '')},`);
        lines.push(`        about: ${JSON.stringify(a.about)},`);
        lines.push(`        analysis: ${JSON.stringify(a.analysis)},`);

        const factsStr = a.funFacts.map(f => `            ${JSON.stringify(f)}`).join(',\n');
        lines.push(`        funFacts: [\n${factsStr}\n        ]`);

        lines.push(`    }${comma}`);
    }

    lines.push('];');
    lines.push('');

    fs.writeFileSync(ARTWORKS_FILE, lines.join('\n'), 'utf-8');

    console.log('✅ artworks.js updated!\n');
    console.log(`🔢 ${newArtworks.length} new artworks added (${allArtworks.length} total)`);
    console.log(`💰 Estimated GPT-4o cost for new artworks: ~$${(newArtworks.length * 0.008).toFixed(2)}`);
    console.log(`\n👉 Now run generate-content.js to generate AI content for the new entries.\n`);
    console.log('   $env:OPENAI_API_KEY="sk-..."');
    console.log('   node generate-content.js\n');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
