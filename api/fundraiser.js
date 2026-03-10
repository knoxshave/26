export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');

  if (req.method === 'OPTIONS') return res.status(200).end();

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

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    // ── RAISED ──────────────────────────────────────────────
    // The page has a "Raised" label and then the total in a nearby h3/strong.
    // We look for the FIRST large number (>50k) that appears BEFORE the word "Goal"
    let raised = null;
    const beforeGoal = html.split(/Our Goal|goal of/i)[0];
    const bigNums = [...beforeGoal.matchAll(/\$([\d,]+)/g)]
      .map(m => parseInt(m[1].replace(/,/g, ''), 10))
      .filter(n => n > 50000);
    if (bigNums.length > 0) raised = bigNums[bigNums.length - 1]; // last big number before "Goal"

    // ── GOAL ────────────────────────────────────────────────
    const goalMatch = html.match(/goal of \$([\d,]+)/i);
    const goal = goalMatch ? parseInt(goalMatch[1].replace(/,/g, ''), 10) : 100000;

    // ── MEMBERS ─────────────────────────────────────────────
    const members = [];
    const memberRE = /href="https:\/\/www\.worldsgreatestshave\.com\/fundraisers\/([^"/]+)\/2026"([\s\S]{0,600}?)(?=href="https:\/\/www\.worldsgreatestshave\.com\/fundraisers\/|<footer|Our Fundraising)/gi;

    let m;
    while ((m = memberRE.exec(html)) !== null) {
      const slug = m[1];
      const block = m[2];

      const nameMatch = block.match(/<h3[^>]*>\s*([\s\S]{2,60}?)\s*<\/h3>/);
      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/<[^>]+>/g, '').trim();
      if (!name || name.length < 2) continue;

      const amtMatch = block.match(/Raised so far:[\s\S]{0,150}?\$([\d,]+)/);
      if (!amtMatch) continue;
      const amount = parseInt(amtMatch[1].replace(/,/g, ''), 10);
      if (!amount) continue;

      if (!members.find(x => x.slug === slug)) {
        members.push({ name, slug, raised: amount });
      }
    }

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
