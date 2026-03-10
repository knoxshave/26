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
    // Try multiple strategies in order, use first that works
    let raised = null;

    // Strategy 1: Look for "Raised" label followed by a dollar amount nearby
    const raisedLabelMatch = html.match(/[Rr]aised[\s\S]{0,300}?\$([\d,]+)/);
    if (raisedLabelMatch) {
      const val = parseInt(raisedLabelMatch[1].replace(/,/g, ''), 10);
      if (val > 1000) raised = val;
    }

    // Strategy 2: Look for dollar amount in a heading/strong near "raised"
    if (raised === null) {
      const matches = [...html.matchAll(/\$([\d,]+)\s*(?:<[^>]+>)*\s*[Rr]aised/g)];
      for (const m of matches) {
        const val = parseInt(m[1].replace(/,/g, ''), 10);
        if (val > 1000) { raised = val; break; }
      }
    }

    // Strategy 3: Look for JSON-LD or data attributes with a raised/total amount
    if (raised === null) {
      const jsonMatch = html.match(/"(?:raised|total|amount_raised|amountRaised)"\s*:\s*([\d.]+)/i);
      if (jsonMatch) {
        const val = Math.round(parseFloat(jsonMatch[1]));
        if (val > 1000) raised = val;
      }
    }

    // Strategy 4: Collect all dollar amounts, filter plausible fundraiser totals (5k-999k),
    // exclude the goal amount, and take the most common cluster
    if (raised === null) {
      const goal = extractGoal(html);
      const allAmounts = [...html.matchAll(/\$([\d,]+)/g)]
        .map(m => parseInt(m[1].replace(/,/g, ''), 10))
        .filter(n => n >= 5000 && n <= 999000 && n !== goal);

      if (allAmounts.length > 0) {
        // Pick the largest that's not suspiciously round (avoid static labels)
        const candidates = allAmounts.filter(n => n % 1000 !== 0 || n > 50000);
        if (candidates.length > 0) raised = Math.max(...candidates);
        else raised = Math.max(...allAmounts);
      }
    }

    // ── GOAL ────────────────────────────────────────────────
    const goal = extractGoal(html);

    // ── MEMBERS ─────────────────────────────────────────────
    const members = [];
    const memberRE = /href="https:\/\/www\.worldsgreatestshave\.com\/fundraisers\/([^"/]+)\/2026"([\s\S]{0,800}?)(?=href="https:\/\/www\.worldsgreatestshave\.com\/fundraisers\/|<footer|Our Fundraising)/gi;
    let m;
    while ((m = memberRE.exec(html)) !== null) {
      const slug = m[1];
      const block = m[2];

      // Try multiple name patterns
      const nameMatch =
        block.match(/<h3[^>]*>\s*([\s\S]{2,80}?)\s*<\/h3>/) ||
        block.match(/<h2[^>]*>\s*([\s\S]{2,80}?)\s*<\/h2>/) ||
        block.match(/class="[^"]*name[^"]*"[^>]*>\s*([\s\S]{2,80}?)\s*</i);

      if (!nameMatch) continue;
      const name = nameMatch[1].replace(/<[^>]+>/g, '').trim();
      if (!name || name.length < 2) continue;

      // Try multiple amount patterns
      const amtMatch =
        block.match(/[Rr]aised so far:?[\s\S]{0,200}?\$([\d,]+)/) ||
        block.match(/[Rr]aised:?[\s\S]{0,100}?\$([\d,]+)/) ||
        block.match(/\$([\d,]+)[\s\S]{0,50}?[Rr]aised/);

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

function extractGoal(html) {
  const patterns = [
    /goal of \$([\d,]+)/i,
    /[Gg]oal[^$]{0,50}\$([\d,]+)/,
    /"goal"\s*:\s*([\d.]+)/,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return parseInt(m[1].replace(/,/g, ''), 10);
  }
  return 100000; // fallback
}
