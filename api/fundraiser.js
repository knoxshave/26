export default async function handler(req, res) {
  // Allow your site to call this API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate'); // Cache 5 mins

  try {
    const response = await fetch(
      'https://www.worldsgreatestshave.com/fundraisers/knoxgrammar2026',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const html = await response.text();

    // --- Parse raised amount ---
    // Looks for pattern like: Raised ### $110,643
    const raisedMatch = html.match(/Raised[\s\S]{0,200}?\$\s*([\d,]+)/i);
    const raised = raisedMatch ? parseInt(raisedMatch[1].replace(/,/g, ''), 10) : null;

    // --- Parse goal amount ---
    const goalMatch = html.match(/goal of \$([\d,]+)/i)
      || html.match(/Our Goal[\s\S]{0,200}?\$\s*([\d,]+)/i);
    const goal = goalMatch ? parseInt(goalMatch[1].replace(/,/g, ''), 10) : null;

    // --- Parse team members ---
    // Each member card: name + raised amount
    const memberRegex =
      /fundraisers\/([^"]+?)\/2026"[\s\S]{0,500}?<h3[^>]*>\s*([\s\S]+?)\s*<\/h3>[\s\S]{0,300}?Raised so far:[\s\S]{0,100}?\$([\d,]+)/gi;

    const members = [];
    let match;
    while ((match = memberRegex.exec(html)) !== null && members.length < 50) {
      const slug = match[1];
      const name = match[2].replace(/<[^>]+>/g, '').trim();
      const amountRaised = parseInt(match[3].replace(/,/g, ''), 10);
      members.push({ name, slug, raised: amountRaised });
    }

    // Sort by raised descending
    members.sort((a, b) => b.raised - a.raised);

    // --- Parse recent donors ---
    const donorRegex =
      /\$\s*([\d,]+)\s*<\/h5>[\s\S]{0,100}?<h4[^>]*>\s*([\s\S]+?)\s*<\/h4>/gi;
    const donors = [];
    while ((match = donorRegex.exec(html)) !== null && donors.length < 10) {
      const amount = parseInt(match[1].replace(/,/g, ''), 10);
      const name = match[2].replace(/<[^>]+>/g, '').trim();
      if (name && amount) donors.push({ name, amount });
    }

    res.status(200).json({
      raised,
      goal,
      members,
      donors,
      memberCount: members.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
