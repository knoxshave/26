export default async function handler(req, res) {
  // CORS — must be before anything else
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const response = await fetch(
      'https://www.worldsgreatestshave.com/fundraisers/knoxgrammar2026',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const html = await response.text();

    // --- Parse raised amount ---
    const raisedMatch = html.match(/\$\s*([\d,]+)<\/h3>\s*<\/div>\s*<div[^>]*>\s*<h4[^>]*>\s*Raised/i)
      || html.match(/Raised[\s\S]{0,50}?\*\*\$([\d,]+)\*\*/i)
      || html.match(/raised.*?\$\s*([\d,]+)/i);
    
    // More targeted: look for the specific raised block
    const raisedMatch2 = html.match(/####\s*Raised[\s\S]{0,100}###\s*\*\*\$([\d,]+)\*\*/);
    const raisedRaw = raisedMatch2 || html.match(/\$([\d,]{4,})/g);
    
    // Find all dollar amounts and pick the largest (most likely total)
    const allAmounts = [...html.matchAll(/\$([\d,]{4,})/g)]
      .map(m => parseInt(m[1].replace(/,/g, ''), 10))
      .filter(n => n > 10000 && n < 500000);
    
    const raised = allAmounts.length > 0 ? Math.max(...allAmounts) : null;

    // --- Parse goal ---
    const goalMatch = html.match(/goal of \$([\d,]+)/i)
      || html.match(/Our Goal[\s\S]{0,200}?\$([\d,]+)/i);
    const goal = goalMatch ? parseInt(goalMatch[1].replace(/,/g, ''), 10) : 100000;

    // --- Parse members ---
    // Strategy: find all fundraiser profile links with names and amounts
    const members = [];
    
    // Pattern 1: href with /fundraisers/slug/2026 followed by name and raised amount
    const memberBlocks = html.split(/(?=href="https:\/\/www\.worldsgreatestshave\.com\/fundraisers\/[^"]+\/2026")/g);
    
    for (const block of memberBlocks.slice(1, 150)) {
      // Extract slug
      const slugMatch = block.match(/href="https:\/\/www\.worldsgreatestshave\.com\/fundraisers\/([^"]+)\/2026"/);
      if (!slugMatch) continue;
      const slug = slugMatch[1];
      
      // Extract name - look for h3 tag content
      const nameMatch = block.match(/<h3[^>]*>\s*([^<]{2,40}?)\s*<\/h3>/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();
      if (!name || name.length < 2) continue;
      
      // Extract raised amount
      const amtMatch = block.match(/Raised so far:[\s\S]{0,100}?\$([\d,]+)/);
      if (!amtMatch) continue;
      const amount = parseInt(amtMatch[1].replace(/,/g, ''), 10);
      if (!amount || amount <= 0) continue;
      
      // Avoid duplicates
      if (!members.find(m => m.slug === slug)) {
        members.push({ name, slug, raised: amount });
      }
    }

    // Sort by raised descending
    members.sort((a, b) => b.raised - a.raised);

    res.status(200).json({
      raised,
      goal,
      members,
      memberCount: members.length,
      lastUpdated: new Date().toISOString(),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
