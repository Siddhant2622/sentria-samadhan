/**
 * AI City Health Score — Analytics Engine
 * Computes category-wise health scores, AI insights, forecasts, and rankings.
 * Self-contained module — no side effects on existing routes.
 */

const CATEGORIES = ['Roads', 'Sanitation', 'Electricity', 'Water', 'Traffic', 'Environment', 'Other'];

const CATEGORY_LABELS = {
  Roads: 'Roads & Infrastructure',
  Sanitation: 'Sanitation & Waste',
  Electricity: 'Electricity & Lighting',
  Water: 'Water & Drainage',
  Traffic: 'Traffic & Transport',
  Environment: 'Environment & Green',
  Other: 'Public Infrastructure',
};

const SLA_DAYS = {
  Roads: 7,
  Sanitation: 3,
  Electricity: 2,
  Water: 3,
  Traffic: 5,
  Environment: 5,
  Other: 7,
};

// Health tier classification
function getHealthTier(score) {
  if (score >= 90) return { label: 'Excellent', color: '#10b981', bg: '#10b981' };
  if (score >= 75) return { label: 'Good', color: '#22c55e', bg: '#22c55e' };
  if (score >= 60) return { label: 'Average', color: '#eab308', bg: '#eab308' };
  if (score >= 40) return { label: 'Poor', color: '#f97316', bg: '#f97316' };
  return { label: 'Critical', color: '#ef4444', bg: '#ef4444' };
}

/**
 * Query helper — promisified db.all
 */
function dbAll(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function dbGet(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

/**
 * Compute health scores for a given district (or all districts if null)
 */
async function computeHealthScores(db, district) {
  const districtClause = district ? `AND c.district = ?` : '';
  const districtParams = district ? [district] : [];

  // ─── 1. Aggregate complaints per category ─────────────────
  const categoryData = {};
  for (const cat of CATEGORIES) {
    const params = [cat, ...districtParams];

    const total = await dbGet(db,
      `SELECT COUNT(*) as cnt FROM complaints c WHERE c.category = ? ${districtClause}`, params);

    const resolved = await dbGet(db,
      `SELECT COUNT(*) as cnt FROM complaints c WHERE c.category = ? AND c.status IN ('Resolved','Completed') ${districtClause}`, params);

    const pending = await dbGet(db,
      `SELECT COUNT(*) as cnt FROM complaints c WHERE c.category = ? AND c.status NOT IN ('Resolved','Completed','Rejected') ${districtClause}`, params);

    // Average resolution time (days) for resolved complaints
    const avgTime = await dbGet(db,
      `SELECT AVG(
        CAST((julianday(COALESCE(c.actual_completion_date, c.updated_at)) - julianday(c.created_at)) AS REAL)
       ) as avg_days
       FROM complaints c
       WHERE c.category = ? AND c.status IN ('Resolved','Completed') ${districtClause}`, params);

    // Repeat complaints (reports_count > 1)
    const repeats = await dbGet(db,
      `SELECT COUNT(*) as cnt FROM complaints c WHERE c.category = ? AND c.reports_count > 1 ${districtClause}`, params);

    // Citizen satisfaction from feedback
    const satisfaction = await dbGet(db,
      `SELECT AVG(f.rating) as avg_rating, COUNT(f.id) as cnt
       FROM feedback f
       JOIN complaints c ON f.complaint_id = c.id
       WHERE c.category = ? ${districtClause}`, [cat, ...districtParams]);

    // Recent complaints (last 30 days)
    const recent = await dbGet(db,
      `SELECT COUNT(*) as cnt FROM complaints c WHERE c.category = ? AND c.created_at >= datetime('now', '-30 days') ${districtClause}`, params);

    // Previous 30-day window (30-60 days ago) for trend
    const previous = await dbGet(db,
      `SELECT COUNT(*) as cnt FROM complaints c WHERE c.category = ? AND c.created_at >= datetime('now', '-60 days') AND c.created_at < datetime('now', '-30 days') ${districtClause}`, params);

    categoryData[cat] = {
      total: total?.cnt || 0,
      resolved: resolved?.cnt || 0,
      pending: pending?.cnt || 0,
      avgResolutionDays: avgTime?.avg_days || 0,
      repeats: repeats?.cnt || 0,
      avgSatisfaction: satisfaction?.avg_rating || 5.0,
      satisfactionCount: satisfaction?.cnt || 0,
      recentComplaints: recent?.cnt || 0,
      previousComplaints: previous?.cnt || 0,
    };
  }

  // ─── 2. Compute scores per category ───────────────────────
  const categoryScores = {};
  for (const cat of CATEGORIES) {
    const d = categoryData[cat];
    if (d.total === 0) {
      // No complaints = healthy
      categoryScores[cat] = {
        score: 95,
        label: CATEGORY_LABELS[cat],
        tier: getHealthTier(95),
        trend: 'stable',
        trendPct: 0,
        stats: d,
      };
      continue;
    }

    // Resolution Rate score (35% weight) — higher is better
    const resolutionRate = d.total > 0 ? d.resolved / d.total : 1;
    const resolutionScore = resolutionRate * 100;

    // Resolution Time score (25% weight) — faster is better
    const slaDays = SLA_DAYS[cat] || 5;
    const timeRatio = d.avgResolutionDays > 0 ? Math.min(d.avgResolutionDays / slaDays, 3) : 0.5;
    const timeScore = Math.max(0, 100 - (timeRatio - 1) * 50);

    // Pending density score (20% weight) — fewer pending is better
    const pendingRatio = d.total > 0 ? d.pending / d.total : 0;
    const pendingScore = Math.max(0, 100 - pendingRatio * 150);

    // Satisfaction score (10% weight) — higher rating is better
    const satScore = ((d.avgSatisfaction || 5) / 5) * 100;

    // Repeat complaint penalty (10% weight) — fewer repeats is better
    const repeatRatio = d.total > 0 ? d.repeats / d.total : 0;
    const repeatScore = Math.max(0, 100 - repeatRatio * 200);

    // Weighted average
    const rawScore = (
      resolutionScore * 0.35 +
      timeScore * 0.25 +
      pendingScore * 0.20 +
      satScore * 0.10 +
      repeatScore * 0.10
    );
    const finalScore = Math.round(Math.max(0, Math.min(100, rawScore)));

    // Trend calculation
    let trend = 'stable';
    let trendPct = 0;
    if (d.previousComplaints > 0) {
      trendPct = Math.round(((d.recentComplaints - d.previousComplaints) / d.previousComplaints) * 100);
      if (trendPct > 10) trend = 'declining'; // more complaints = declining health
      else if (trendPct < -10) trend = 'improving'; // fewer complaints = improving
    } else if (d.recentComplaints > 0) {
      trend = 'new_activity';
      trendPct = 0;
    }

    categoryScores[cat] = {
      score: finalScore,
      label: CATEGORY_LABELS[cat],
      tier: getHealthTier(finalScore),
      trend,
      trendPct: Math.abs(trendPct),
      stats: d,
    };
  }

  // ─── 3. Overall Civic Health Score ────────────────────────
  // Weighted by category importance — roads & water most critical
  const WEIGHTS = { Roads: 0.25, Water: 0.20, Sanitation: 0.20, Electricity: 0.15, Traffic: 0.10, Environment: 0.05, Other: 0.05 };
  let overallScore = 0;
  let totalWeight = 0;
  for (const cat of CATEGORIES) {
    const w = WEIGHTS[cat] || 0.1;
    overallScore += categoryScores[cat].score * w;
    totalWeight += w;
  }
  overallScore = Math.round(overallScore / totalWeight);

  // ─── 4. AI Insights ──────────────────────────────────────
  const insights = generateInsights(categoryScores, categoryData);

  // ─── 5. Forecasting ──────────────────────────────────────
  const forecast = generateForecast(categoryScores, categoryData, overallScore);

  // ─── 6. District Rankings ─────────────────────────────────
  let rankings = [];
  if (!district) {
    rankings = await computeDistrictRankings(db);
  }

  return {
    overallScore,
    overallTier: getHealthTier(overallScore),
    categories: categoryScores,
    insights,
    forecast,
    rankings,
    district: district || 'All Districts',
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate natural-language insights from complaint patterns
 */
function generateInsights(categoryScores, categoryData) {
  const insights = [];

  // Find worst and best categories
  const sorted = Object.entries(categoryScores)
    .filter(([cat]) => categoryData[cat].total > 0)
    .sort((a, b) => a[1].score - b[1].score);

  if (sorted.length === 0) {
    insights.push({
      type: 'positive',
      icon: '✨',
      text: 'No civic complaints have been filed yet. The city health baseline is excellent.',
    });
    return insights;
  }

  const worst = sorted[0];
  const best = sorted[sorted.length - 1];

  // Worst category insight
  if (worst[1].score < 60) {
    const data = categoryData[worst[0]];
    insights.push({
      type: 'critical',
      icon: '🔴',
      text: `${worst[1].label} health is ${worst[1].tier.label.toLowerCase()} (${worst[1].score}/100) with ${data.pending} unresolved complaints and an average resolution time of ${Math.round(data.avgResolutionDays)} days.`,
    });
  }

  // Best category insight
  if (best[1].score >= 70 && sorted.length > 1) {
    insights.push({
      type: 'positive',
      icon: '🟢',
      text: `${best[1].label} is performing well with a health score of ${best[1].score}/100. ${categoryData[best[0]].resolved} out of ${categoryData[best[0]].total} complaints resolved.`,
    });
  }

  // Trend-based insights
  for (const [cat, scores] of Object.entries(categoryScores)) {
    const data = categoryData[cat];
    if (scores.trend === 'declining' && data.total > 2) {
      insights.push({
        type: 'warning',
        icon: '📉',
        text: `${scores.label} health dropped — complaints increased by ${scores.trendPct}% in the last 30 days.`,
      });
    } else if (scores.trend === 'improving' && data.total > 2) {
      insights.push({
        type: 'positive',
        icon: '📈',
        text: `${scores.label} health improved — complaints decreased by ${scores.trendPct}% compared to the previous month.`,
      });
    }
  }

  // Resolution time warning
  for (const [cat, data] of Object.entries(categoryData)) {
    const sla = SLA_DAYS[cat] || 5;
    if (data.avgResolutionDays > sla * 1.5 && data.resolved > 0) {
      insights.push({
        type: 'warning',
        icon: '⏰',
        text: `${CATEGORY_LABELS[cat]} average resolution time (${Math.round(data.avgResolutionDays)} days) exceeds SLA target of ${sla} days by ${Math.round(((data.avgResolutionDays / sla) - 1) * 100)}%.`,
      });
    }
  }

  // High repeat complaints
  for (const [cat, data] of Object.entries(categoryData)) {
    if (data.repeats > 2) {
      insights.push({
        type: 'warning',
        icon: '🔁',
        text: `${CATEGORY_LABELS[cat]} has ${data.repeats} repeat complaint(s), indicating recurring issues that need systemic fixes.`,
      });
    }
  }

  // Satisfaction insight
  const lowSat = Object.entries(categoryData)
    .filter(([, d]) => d.satisfactionCount > 0 && d.avgSatisfaction < 3)
    .sort((a, b) => a[1].avgSatisfaction - b[1].avgSatisfaction);

  if (lowSat.length > 0) {
    const [cat, data] = lowSat[0];
    insights.push({
      type: 'critical',
      icon: '😞',
      text: `Citizen satisfaction for ${CATEGORY_LABELS[cat]} is low (${data.avgSatisfaction.toFixed(1)}/5.0 from ${data.satisfactionCount} reviews). Focus on quality of resolution.`,
    });
  }

  // Overall positive if everything is good
  if (insights.filter(i => i.type === 'critical').length === 0 && sorted.length > 0) {
    const avgScore = sorted.reduce((acc, [, s]) => acc + s.score, 0) / sorted.length;
    if (avgScore >= 75) {
      insights.push({
        type: 'positive',
        icon: '🏆',
        text: `Overall civic health is strong. Most departments are meeting or exceeding performance targets.`,
      });
    }
  }

  return insights.slice(0, 8); // Cap at 8 insights
}

/**
 * Generate 30-day health forecast
 */
function generateForecast(categoryScores, categoryData, currentScore) {
  let pendingImpact = 0;
  let trendImpact = 0;
  let reasons = [];

  for (const [cat, scores] of Object.entries(categoryScores)) {
    const data = categoryData[cat];

    // Pending complaints will drag score down
    if (data.pending > 3) {
      pendingImpact -= data.pending * 0.8;
      reasons.push(`${data.pending} unresolved ${CATEGORY_LABELS[cat]} complaints`);
    }

    // Declining trends will continue
    if (scores.trend === 'declining') {
      trendImpact -= scores.trendPct * 0.3;
    } else if (scores.trend === 'improving') {
      trendImpact += scores.trendPct * 0.2;
    }
  }

  const rawPredicted = currentScore + pendingImpact + trendImpact;
  const predictedScore = Math.round(Math.max(0, Math.min(100, rawPredicted)));
  const scoreDelta = predictedScore - currentScore;

  let riskLevel = 'Low';
  if (scoreDelta <= -15) riskLevel = 'Critical';
  else if (scoreDelta <= -8) riskLevel = 'High';
  else if (scoreDelta <= -3) riskLevel = 'Moderate';

  let reason = 'Stable complaint trends and manageable backlog.';
  if (reasons.length > 0) {
    reason = `Predicted decline due to: ${reasons.slice(0, 3).join(', ')}.`;
  } else if (scoreDelta > 0) {
    reason = 'Improving trends suggest continued health improvement.';
  }

  return {
    currentScore,
    predictedScore,
    scoreDelta,
    riskLevel,
    riskColor: riskLevel === 'Critical' ? '#ef4444' : riskLevel === 'High' ? '#f97316' : riskLevel === 'Moderate' ? '#eab308' : '#10b981',
    reason,
    predictedTier: getHealthTier(predictedScore),
    timeframe: '30 days',
  };
}

/**
 * Compute rankings across all districts
 */
async function computeDistrictRankings(db) {
  const districts = await dbAll(db,
    `SELECT DISTINCT district FROM complaints WHERE district IS NOT NULL AND district != '' ORDER BY district`);

  const rankings = [];
  for (const { district } of districts) {
    const total = await dbGet(db,
      `SELECT COUNT(*) as cnt FROM complaints WHERE district = ?`, [district]);
    const resolved = await dbGet(db,
      `SELECT COUNT(*) as cnt FROM complaints WHERE district = ? AND status IN ('Resolved','Completed')`, [district]);
    const pending = await dbGet(db,
      `SELECT COUNT(*) as cnt FROM complaints WHERE district = ? AND status NOT IN ('Resolved','Completed','Rejected')`, [district]);

    const resRate = total.cnt > 0 ? resolved.cnt / total.cnt : 1;
    const pendingRate = total.cnt > 0 ? pending.cnt / total.cnt : 0;
    const score = Math.round(Math.max(0, Math.min(100, resRate * 60 + (1 - pendingRate) * 40)));

    rankings.push({
      district,
      score,
      tier: getHealthTier(score),
      total: total.cnt,
      resolved: resolved.cnt,
      pending: pending.cnt,
    });
  }

  return rankings.sort((a, b) => b.score - a.score);
}

module.exports = { computeHealthScores };
