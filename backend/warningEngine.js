const { v4: uuidv4 } = require('uuid');

const RUN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

async function runWarningAnalysis(db) {
    console.log("[WarningEngine] Running AI Warning Analysis...");

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const generateWarningId = () => 'WARN-' + uuidv4().substring(0, 8).toUpperCase();

    const existingWarnings = new Promise((resolve, reject) => {
        db.all("SELECT * FROM warnings WHERE status != 'Closed' AND status != 'Resolved'", (err, rows) => {
            if (err) reject(err); else resolve(rows || []);
        });
    });

    const activeWarnings = await existingWarnings;

    // Helper to check if a similar warning already exists to prevent spam
    const hasExistingWarning = (type, area, ward) => {
        return activeWarnings.some(w => w.warning_type === type && w.area === area && (w.ward === ward || !ward));
    };

    const insertWarning = (warning) => {
        return new Promise((resolve, reject) => {
            const id = generateWarningId();
            db.run(
                `INSERT INTO warnings (id, warning_type, area, ward, department, risk_level, confidence_score, description, status, related_complaints)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, warning.type, warning.area, warning.ward || 'Unknown', warning.department || 'Multiple',
                    warning.risk, warning.confidence, warning.description, 'Open', JSON.stringify(warning.related || [])
                ],
                function (err) {
                    if (err) {
                        console.error("[WarningEngine] Failed to insert warning:", err.message);
                        resolve(false);
                    } else {
                        console.log(`[WarningEngine] 🚨 NEW WARNING GENERATED: ${warning.type} in ${warning.area}`);
                        resolve(true);
                    }
                }
            );
        });
    };

    // Fetch all complaints
    const complaints = await new Promise((resolve, reject) => {
        db.all("SELECT * FROM complaints", (err, rows) => {
            if (err) reject(err); else resolve(rows || []);
        });
    });

    // RULE 1: Rapid Complaint Growth (Surge)
    // Compare last 7 days vs previous 7 days per category & address
    const recentComplaints = complaints.filter(c => c.created_at >= sevenDaysAgo);
    const previousComplaints = complaints.filter(c => c.created_at >= fourteenDaysAgo && c.created_at < sevenDaysAgo);

    const groupByCategoryAndArea = (list) => {
        const groups = {};
        list.forEach(c => {
            const key = `${c.category}_${c.address || 'Unknown'}`;
            if (!groups[key]) groups[key] = { count: 0, ids: [], category: c.category, area: c.address, ward: c.ward_number, dept: c.department_id };
            groups[key].count++;
            groups[key].ids.push(c.id);
        });
        return groups;
    };

    const recentGroups = groupByCategoryAndArea(recentComplaints);
    const prevGroups = groupByCategoryAndArea(previousComplaints);

    for (const key in recentGroups) {
        const rCount = recentGroups[key].count;
        const pCount = prevGroups[key] ? prevGroups[key].count : 0;
        
        // If it went from 0 or 1 to >= 5, or grew significantly
        if (rCount >= 5 && (pCount === 0 || rCount > pCount * 2)) {
            const data = recentGroups[key];
            if (!hasExistingWarning(`${data.category} Surge`, data.area, data.ward)) {
                const growth = pCount === 0 ? "New massive spike" : `${Math.round(((rCount - pCount) / pCount) * 100)}% increase`;
                await insertWarning({
                    type: `${data.category} Surge`,
                    area: data.area,
                    ward: data.ward,
                    department: data.dept,
                    risk: rCount >= 10 ? 'Critical' : 'High',
                    confidence: 85,
                    description: `Rapid growth detected: ${rCount} complaints filed in the last 7 days (vs ${pCount} in the prior week). ${growth} in ${data.category}-related complaints.`,
                    related: data.ids
                });
            }
        }
    }

    // RULE 2: Multi-Category Correlation (e.g. Water + Sewage + Roads)
    const areaCategoryMap = {};
    recentComplaints.forEach(c => {
        const area = c.address || 'Unknown';
        if (!areaCategoryMap[area]) areaCategoryMap[area] = { categories: new Set(), ids: [], ward: c.ward_number };
        areaCategoryMap[area].categories.add(c.category);
        areaCategoryMap[area].ids.push(c.id);
    });

    for (const area in areaCategoryMap) {
        const cats = Array.from(areaCategoryMap[area].categories);
        if (cats.length >= 3 && areaCategoryMap[area].ids.length >= 5) {
            if (!hasExistingWarning("Infrastructure Failure Risk", area, areaCategoryMap[area].ward)) {
                await insertWarning({
                    type: "Infrastructure Failure Risk",
                    area: area,
                    ward: areaCategoryMap[area].ward,
                    department: "Multiple",
                    risk: "Critical",
                    confidence: 92,
                    description: `Multiple related issues detected simultaneously: ${cats.join(', ')}. This suggests a possible systemic infrastructure failure (e.g. major pipeline burst causing road damage and water supply issues).`,
                    related: areaCategoryMap[area].ids
                });
            }
        }
    }

    // RULE 3: Unresolved Complaint Cluster
    const pendingThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const pendingComplaints = complaints.filter(c => c.status !== 'Resolved' && c.created_at < pendingThreshold);
    const pendingAreaGroups = {};
    pendingComplaints.forEach(c => {
        const area = c.address || 'Unknown';
        if (!pendingAreaGroups[area]) pendingAreaGroups[area] = { count: 0, ids: [], ward: c.ward_number };
        pendingAreaGroups[area].count++;
        pendingAreaGroups[area].ids.push(c.id);
    });

    for (const area in pendingAreaGroups) {
        if (pendingAreaGroups[area].count >= 10) {
            if (!hasExistingWarning("Governance Delay Warning", area, pendingAreaGroups[area].ward)) {
                await insertWarning({
                    type: "Governance Delay Warning",
                    area: area,
                    ward: pendingAreaGroups[area].ward,
                    department: "Multiple",
                    risk: "High",
                    confidence: 90,
                    description: `Large cluster of ${pendingAreaGroups[area].count} unresolved complaints detected older than 7 days. Escalation is strongly recommended.`,
                    related: pendingAreaGroups[area].ids
                });
            }
        }
    }

    // RULE 5: Critical Safety Risk
    const criticalKeywords = ['fire', 'electric shock', 'open manhole', 'collapsed', 'contamination', 'accident'];
    for (const c of recentComplaints) {
        const text = `${c.title} ${c.description}`.toLowerCase();
        const matchedKw = criticalKeywords.find(kw => text.includes(kw));
        
        if (matchedKw || c.urgency_level === 'Emergency') {
            if (!hasExistingWarning("Critical Safety Risk", c.address, c.ward_number)) {
                await insertWarning({
                    type: "Critical Safety Risk",
                    area: c.address || 'Unknown',
                    ward: c.ward_number,
                    department: c.department_id,
                    risk: "Critical",
                    confidence: 95,
                    description: `Emergency hazard detected matching critical parameters ("${matchedKw || c.urgency_level}"). Immediate response required to ensure public safety.`,
                    related: [c.id]
                });
            }
        }
    }

    console.log("[WarningEngine] Analysis complete.");
}

function startWarningEngine(db) {
    console.log("[WarningEngine] Initializing 15-minute background jobs...");
    // Run immediately on start
    setTimeout(() => runWarningAnalysis(db), 5000);
    // Then every interval
    setInterval(() => runWarningAnalysis(db), RUN_INTERVAL_MS);
}

module.exports = { startWarningEngine };
